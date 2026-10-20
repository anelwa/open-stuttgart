// „Was geht“, Neu in der Stadt: Gastronomie und Läden, die in OpenStreetMap neu erfasst wurden, den Typ oder den Namen
// gewechselt haben oder als geschlossen markiert wurden (Spezifikation was-geht, Abschnitt 2, Klassen wie
// werkzeuge/osm_historie_klassifizieren.py). Lizenz ODbL, Namensnennung „© OpenStreetMap-Mitwirkende“.
//
// Verfahren: Overpass und Geofabrik sind aus dem Betrieb heraus nicht verlässlich erreichbar (Recherche 20.10.2026).
// Daher sparsam über die OSM-API: höchstens einmal am Tag die Änderungssätze (changesets) im Rechteck um Stuttgart
// seit dem letzten Lauf, davon nur kleine (höchstens 2000 Änderungen, Ausdehnung höchstens 0,5 Grad) herunterladen,
// jeden Änderungssatz nur einmal. Vorgängerversionen gesammelt (bis 100 je Anfrage), Abstand 1,5 s je Anfrage (HOST_GAP).
// Erster Lauf: die letzten OS_OPENINGS_BACKFILL_DAYS Tage (Standard 3). Abschaltbar mit OS_SCENE_OPENINGS=0.
// Zuordnung zum Stadtbezirk über die Stadtbezirksgrenzen der Stadt (Geoserver, CC BY 4.0); Punkte außerhalb entfallen.
import { diskStore, fetchJson, fetchText } from '../../cache.mjs';
import { berlinDate, text } from './common.mjs';
import { kesselNeueroeffnungen } from './news.mjs';

const API = 'https://api.openstreetmap.org/api/0.6';
const BBOX = '9.03,48.69,9.32,48.87';
const H = 3600_000;
const store = diskStore('wasgeht-osm-v1');
const GASTRO = /^(restaurant|cafe|bar|pub|nightclub|fast_food|biergarten|ice_cream)$/;
const LIFECYCLE = /^(disused|was|abandoned|removed|demolished):(amenity|shop)$/;
const KIND = {
  restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', pub: 'Kneipe', nightclub: 'Club', fast_food: 'Imbiss', biergarten: 'Biergarten', ice_cream: 'Eisdiele',
};
const poi = (t) => (t?.amenity && GASTRO.test(t.amenity) ? t.amenity : t?.shop && t.shop !== 'vacant' ? `shop=${t.shop}` : null);
const closedTags = (t) => Object.keys(t ?? {}).some((k) => LIFECYCLE.test(k)) || t?.shop === 'vacant';
export const kindLabel = (k) => (k?.startsWith('shop=') ? `Laden (${k.slice(5).replace(/_/g, ' ')})` : KIND[k] ?? k ?? 'Ort');
const norm = (s) => text(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const unxml = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ---------- Stadtbezirke (Polygone, 30 Tage) ----------
let bezirke = null;
async function stadtbezirke() {
  if (bezirke) return bezirke;
  let fc = store.get('bezirke', 30 * 24 * H);
  if (!fc) {
    const d = await fetchJson('https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeName=GEOLINE_FLEX:A62_GK_KLGL_STADTBEZIRK_EPSG25832', { timeout: 60000 });
    fc = d.features.map((f) => ({ name: f.properties.STADTBEZIRK, geometry: f.geometry }));
    store.set('bezirke', fc);
  }
  bezirke = fc;
  return fc;
}
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function bezirkAt(list, lon, lat) {
  for (const b of list) {
    const polys = b.geometry?.type === 'Polygon' ? [b.geometry.coordinates] : b.geometry?.type === 'MultiPolygon' ? b.geometry.coordinates : [];
    if (polys.some((p) => inRing([lon, lat], p[0]) && !p.slice(1).some((h) => inRing([lon, lat], h)))) return b.name;
  }
  return null;
}

// ---------- osmChange lesen ----------
export function parseChange(xml) {
  const out = [];
  for (const blk of xml.matchAll(/<(create|modify|delete)>([\s\S]*?)<\/\1>/g)) {
    for (const m of blk[2].matchAll(/<(node|way)\s([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
      const a = Object.fromEntries([...m[2].matchAll(/([\w:]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
      const body = m[3] ?? '';
      out.push({
        action: blk[1], type: m[1], id: a.id, version: Number(a.version), timestamp: a.timestamp,
        lat: a.lat != null ? Number(a.lat) : null, lon: a.lon != null ? Number(a.lon) : null,
        tags: Object.fromEntries([...body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)].map((t) => [unxml(t[1]), unxml(t[2])])),
      });
    }
  }
  return out;
}

async function previous(list) {
  const map = new Map();
  for (const type of ['node', 'way']) {
    const ids = [...new Set(list.filter((e) => e.type === type && e.version > 1).map((e) => `${e.id}v${e.version - 1}`))];
    for (let i = 0; i < ids.length; i += 100) {
      try {
        const d = await fetchJson(`${API}/${type}s.json?${type}s=${ids.slice(i, i + 100).join(',')}`, { timeout: 60000 });
        for (const el of d.elements ?? []) map.set(`${el.type}/${el.id}`, el);
      } catch { /* einzelne Versionen fehlen (z. B. geschwärzt): ohne Vorgänger weiter */ }
    }
  }
  return map;
}

async function wayCenter(id) {
  const d = await fetchJson(`${API}/way/${id}/full.json`, { timeout: 60000 });
  const nodes = (d.elements ?? []).filter((e) => e.type === 'node');
  if (!nodes.length) return null;
  return { lat: nodes.reduce((s, n) => s + n.lat, 0) / nodes.length, lon: nodes.reduce((s, n) => s + n.lon, 0) / nodes.length };
}

/** Einordnung eines geänderten Objekts nach Spezifikation Abschnitt 2 (nur Klassen, die angezeigt werden). */
function classify(e, prev) {
  const cur = e.tags; const pt = prev?.visible === false ? {} : prev?.tags ?? null;
  if (e.action === 'create') return poi(cur) ? { signal: 'neu_in_osm' } : null;
  if (e.action === 'delete') return pt && poi(pt) ? { signal: 'evtl_geschlossen', tags: pt } : null;
  if (!pt) return null;
  if (poi(cur)) {
    if (!poi(pt)) return { signal: 'neu_in_osm' };
    if (poi(pt) !== poi(cur)) return { signal: 'neuer_betrieb', previous: { kind: poi(pt), name: pt.name } };
    const a = norm(pt.name); const b = norm(cur.name);
    if (a && b && !a.includes(b) && !b.includes(a)) return { signal: 'neuer_betrieb', previous: { name: pt.name } };
    return null;
  }
  if (closedTags(cur) && poi(pt)) return { signal: 'evtl_geschlossen', tags: pt };
  return null;
}

let running = false;
let lastError = null;
/** Ein Lauf: neue Änderungssätze seit dem letzten Lauf auswerten. */
async function lauf() {
  if (running || process.env.OS_SCENE_OPENINGS === '0') return;
  const st = store.get('state') ?? {};
  if (st.ran && Date.now() - st.ran < 24 * H) return;
  running = true;
  try {
    const list = await stadtbezirke();
    const back = Number(process.env.OS_OPENINGS_BACKFILL_DAYS ?? 3);
    const from = st.until ?? Date.now() - back * 24 * H;
    const until = Date.now() - 10 * 60_000;
    const sets = new Map();
    let to = until;
    for (let page = 0; page < 15; page += 1) {
      const d = await fetchJson(`${API}/changesets.json?bbox=${BBOX}&closed=true&time=${new Date(from).toISOString()},${new Date(to).toISOString()}`, { timeout: 60000 });
      for (const c of d.changesets ?? []) sets.set(c.id, c);
      if ((d.changesets ?? []).length < 100) break;
      to = Math.min(...d.changesets.map((c) => Date.parse(c.created_at))) + 1000;
    }
    const done = store.get('done') ?? {}; // bereits ausgewertete Änderungssätze
    const todo = [...sets.values()].filter((c) => !done[c.id] && c.changes_count > 0 && c.changes_count <= 2000
      && c.max_lon - c.min_lon <= 0.5 && c.max_lat - c.min_lat <= 0.5);
    const items = store.get('items') ?? {};
    let n = 0;
    for (const c of todo) {
      let els;
      try { els = parseChange(await fetchText(`${API}/changeset/${c.id}/download`, { timeout: 60000, headers: { Accept: 'application/xml' } })); } catch { continue; }
      const deletes = els.filter((e) => e.action === 'delete' && e.type === 'node');
      const need = els.filter((e) => (e.action === 'modify' && (poi(e.tags) || closedTags(e.tags))) || (e.action === 'delete' && e.type === 'node' && deletes.length <= 20));
      const prev = need.length ? await previous(need) : new Map();
      for (const e of els) {
        if (e.action === 'create' && !poi(e.tags)) continue;
        const k = classify(e, prev.get(`${e.type}/${e.id}`));
        if (!k) continue;
        const tags = k.tags ?? e.tags;
        let pos = e.lat != null ? { lat: e.lat, lon: e.lon } : null;
        const p = prev.get(`${e.type}/${e.id}`);
        if (!pos && p?.lat != null) pos = { lat: p.lat, lon: p.lon };
        if (!pos && e.type === 'way') pos = await wayCenter(e.id).catch(() => null);
        if (!pos) continue;
        const district = bezirkAt(list, pos.lon, pos.lat);
        if (!district) continue; // außerhalb des Stadtkreises
        const id = `osm:${e.type}/${e.id}`;
        items[id] = {
          id, name: tags.name ?? tags['disused:name'] ?? tags['was:name'] ?? null, kind: poi(tags) ?? poi(prev.get(`${e.type}/${e.id}`)?.tags) ?? null,
          lat: +pos.lat.toFixed(6), lon: +pos.lon.toFixed(6), district, signal: k.signal, since: c.closed_at ?? e.timestamp,
          ...(k.previous ? { previous: k.previous } : {}),
          address: [tags['addr:street'] && `${tags['addr:street']} ${tags['addr:housenumber'] ?? ''}`.trim(), tags['addr:postcode']].filter(Boolean).join(', ') || null,
          source: { name: 'OpenStreetMap', url: `https://www.openstreetmap.org/${e.type}/${e.id}`, license: 'ODbL' },
        };
        n += 1;
      }
      done[c.id] = Date.parse(c.closed_at ?? c.created_at);
      if (Object.keys(done).length % 25 === 0) { store.set('done', done); store.set('items', items); }
    }
    for (const [id, t] of Object.entries(done)) if (t < Date.now() - 30 * 24 * H) delete done[id];
    store.set('done', done);
    // Einträge älter als 90 Tage verwerfen
    const cut = Date.now() - 90 * 24 * H;
    for (const [id, it] of Object.entries(items)) if (Date.parse(it.since) < cut) delete items[id];
    store.set('items', items);
    store.set('state', { ran: Date.now(), until, changesets: sets.size, downloaded: todo.length, found: n });
    lastError = null;
  } catch (err) {
    lastError = String(err.message ?? err);
  } finally {
    running = false;
  }
}

/** Neu in der Stadt (6.7: GET /api/openings?days=30). Antwortet sofort mit dem gespeicherten Stand; der Lauf erfolgt im Hintergrund. */
export async function neueroeffnungen({ days = 30, signal } = {}) {
  const run = lauf();
  if (!store.get('items')) await Promise.race([run, new Promise((r) => setTimeout(r, 5000))]);
  const st = store.get('state') ?? {};
  const since = Date.now() - Math.min(90, Math.max(1, Number(days) || 30)) * 24 * H;
  let press = [];
  try { press = await kesselNeueroeffnungen(); } catch { /* Gegenprüfung entfällt */ }
  const items = Object.values(store.get('items') ?? {})
    .filter((x) => Date.parse(x.since) >= since && x.name && (!signal || x.signal === signal))
    .map((x) => {
      const n = norm(x.name);
      const t = Date.parse(x.since);
      const hits = n.length >= 4 ? press.filter((p) => Math.abs(Date.parse(p.published) - t) <= 14 * 24 * H && ` ${norm(p.title)} `.includes(` ${n} `)) : [];
      return { ...x, kindLabel: kindLabel(x.kind), sinceDate: berlinDate(new Date(x.since)), ...(hits.length ? { press: hits.slice(0, 3).map((p) => ({ name: 'Kessel.TV', url: p.url, title: p.title })) } : {}) };
    })
    .sort((a, b) => b.since.localeCompare(a.since));
  return {
    items,
    updated: st.ran ? new Date(st.ran).toISOString() : null,
    running, error: lastError,
    stats: { changesets: st.changesets ?? null, downloaded: st.downloaded ?? null, found: st.found ?? null },
    source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0', attribution: '© OpenStreetMap-Mitwirkende' },
    hinweis: 'Neu in OpenStreetMap erfasst. Das ist nicht in jedem Fall eine Neueröffnung. Stadtbezirke: Landeshauptstadt Stuttgart (CC BY 4.0). Gegenprüfung: Kessel.TV (nur Titel und Link).',
  };
}
