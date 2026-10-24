// Werkzeuge für die Feature-Handler: Ortsauflösung, Stadtbezirk, CKAN-Tabellen,
// WFS-Abfragen und kleine Auswertungen. Alles bleibt serverseitig und cachefähig.
import { cached, fetchJson } from '../../cache.mjs';
import { geocode } from '../../sources/schnittstellen.mjs';
import { facilities } from '../../sources/nearby.mjs';
import { runSource } from '../run-source.mjs';
import { bboxAround, haversine } from '../util.mjs';
import { parseNum } from '../util.mjs';

export const CITY = { lat: 48.7758, lon: 9.1829, label: 'Stuttgart' };

/** Ort aus `ort`, `q`, `lat`/`lon` oder Standard Stadtmitte. */
export async function resolvePlace(params = {}, { fallback = CITY } = {}) {
  const lat = Number(params.lat);
  const lon = Number(params.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { lat, lon, label: String(params.ort ?? params.q ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`), type: 'Koordinate' };
  }
  const q = String(params.ort ?? params.q ?? '').trim();
  if (!q) return fallback;
  const r = await geocode(q, 8);
  const hit = r.items?.[0];
  if (!hit) throw Object.assign(new Error(`„${q}“ konnte nicht verortet werden.`), { status: 404 });
  return { ...hit, label: hit.label ?? q };
}

const DISTRICT_LAYER = 'GEOLINE_FLEX:A62_GK_KLGL_STADTBEZIRK_EPSG25832';
const districtCache = { at: 0, features: [] };

async function districtFeatures() {
  if (Date.now() - districtCache.at < 24 * 3600_000 && districtCache.features.length) return districtCache.features;
  const url = `https://geoserver.stuttgart.de/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature`
    + `&typeNames=${encodeURIComponent(DISTRICT_LAYER)}&count=100&outputFormat=application/json&srsName=EPSG:4326`;
  const j = await fetchJson(url, { timeout: 45_000 });
  districtCache.features = j.features ?? [];
  districtCache.at = Date.now();
  return districtCache.features;
}

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polys = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

/** Stadtbezirk am Punkt (amtliche Grenzen, WFS). */
export async function districtAt(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    const fs = await districtFeatures();
    const pt = [lon, lat];
    const hit = fs.find((f) => polys(f.geometry).some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h))));
    if (!hit) return null;
    const p = hit.properties ?? {};
    const name = p.STBNAM_T ?? p.NAME ?? p.Name ?? p.name ?? null;
    return name ? { name: String(name).trim(), number: p.STBNUM_T ?? p.NR ?? null, props: p } : null;
  } catch {
    return null;
  }
}

/** Gleicht einen Bezirksnamen tolerant ab („Mitte“, „Bad Cannstatt“, „Sillenbuch“). */
export function sameDistrict(a, b) {
  const norm = (s) => String(s ?? '').toLowerCase().replace(/^stuttgart[-\s]*/, '').replace(/[^a-zäöüß]/g, '');
  const x = norm(a); const y = norm(b);
  return !!x && (x === y || x.includes(y) || y.includes(x));
}

/** Alle Zeilen eines CKAN-Datensatzes (bis 5.000) über den Quellen-Adapter. */
export async function ckanRows(id, params = {}) {
  const r = await runSource(id, { ...params, limit: Math.min(Number(params.limit) || 60_000, 60_000) });
  if (!r.rows) throw new Error(`Datensatz ${id} lieferte keine Tabelle`);
  return r.rows;
}

/** Spaltenname über regulären Ausdruck finden. */
export function col(row, pattern) {
  if (!row) return null;
  return Object.keys(row).find((k) => pattern.test(k)) ?? null;
}

export function rowNum(row, pattern) {
  const k = col(row, pattern);
  return k ? parseNum(row[k]) : null;
}

export function maxYear(rows, pattern = /jahr|stichtag|datum/i) {
  let best = null;
  for (const row of rows) {
    const key = col(row, pattern);
    if (!key) continue;
    const raw = String(row[key] ?? '');
    const m = /((?:19|20)\d{2})/.exec(raw);
    if (!m) continue;
    const y = Number(m[1]);
    if (best == null || y > best) best = y;
  }
  return best;
}

export function rowsForYear(rows, year, pattern = /jahr|stichtag|datum/i) {
  return rows.filter((row) => {
    const key = col(row, pattern);
    return key && String(row[key] ?? '').includes(String(year));
  });
}

export function rowsForDistrict(rows, district, pattern = /stadtbezirk|bezirk|stadtteil/i) {
  const key = rows.length ? col(rows[0], pattern) : null;
  if (!key) return rows;
  return rows.filter((row) => sameDistrict(row[key], district));
}

/** Summe einer Spalte über Zeilen. */
export function sum(rows, pattern) {
  let total = 0;
  let any = false;
  for (const row of rows) {
    const v = rowNum(row, pattern);
    if (v != null) { total += v; any = true; }
  }
  return any ? total : null;
}

/** WFS-Layer im Umkreis; nutzt dieselbe Achsenordnung wie die Stadt-Adapter. */
export async function wfsItems(layer, lat, lon, radiusMeters = 800, count = 200, base = 'https://geoserver.stuttgart.de/geoserver/ows') {
  const bbox = bboxAround(lat, lon, radiusMeters);
  const wfsBbox = [bbox[1], bbox[0], bbox[3], bbox[2]].map((x) => x.toFixed(6)).join(',');
  const url = `${base}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(layer)}`
    + `&count=${count}&outputFormat=application/json&srsName=EPSG:4326&bbox=${wfsBbox},urn:ogc:def:crs:EPSG::4326`;
  const j = await fetchJson(url, { timeout: 45_000 });
  return j.features ?? [];
}

export function featurePoint(f) {
  if (!f?.geometry) return null;
  if (f.geometry.type === 'Point') return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
  const pts = [];
  const walk = (v) => { if (Array.isArray(v)) { if (typeof v[0] === 'number') pts.push(v); else v.forEach(walk); } };
  walk(f.geometry.coordinates);
  if (!pts.length) return null;
  return { lon: pts.reduce((s, p) => s + p[0], 0) / pts.length, lat: pts.reduce((s, p) => s + p[1], 0) / pts.length };
}

/** Einrichtungen aus dem vorhandenen Nähe-Modul (bereits normalisiert). */
export async function nearby(cat, opts = {}) {
  try {
    const r = await facilities(cat, opts);
    return r.items ?? [];
  } catch {
    return [];
  }
}

/** Amtliche Wetter- und Warnlagen (bereits gecacht). */
export async function weatherNow() {
  const { weather } = await import('../../sources/environment.mjs');
  return weather();
}
export async function warnNow() {
  const { warnungen } = await import('../../sources/environment.mjs');
  return warnungen();
}

/** Zahl aus deutschem Text. */
export function deNum(v) {
  return parseNum(v);
}

/** Kurze Zeitangabe für Berichte. */
export function timeLabel(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(+d)) return null;
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
export function dayLabel(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(+d)) return null;
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** Zufälliger, aber stabiler Wert für Quizfragen. */
export function seededPick(list, seed) {
  if (!list.length) return null;
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}

/** Quellenangabe für eine Register-Quelle. */
export async function sourceInfo(id) {
  const { SOURCE_BY_ID } = await import('../sources.mjs');
  const s = SOURCE_BY_ID.get(id);
  if (!s) return null;
  return { name: `${s.attribution} – ${s.title}`, url: s.url, license: s.license };
}

/** Enthaltendes Flächenobjekt eines WFS-Layers am Punkt. */
export async function areaAt(layer, lat, lon, radiusMeters = 1500) {
  const fs = await wfsItems(layer, lat, lon, radiusMeters, 300).catch(() => []);
  const pt = [lon, lat];
  for (const f of fs) {
    const ps = !f.geometry ? [] : f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
      : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    for (const p of ps) {
      if (!inRing(pt, p[0])) continue;
      if (p.slice(1).some((h) => inRing(pt, h))) continue;
      return f;
    }
  }
  return null;
}

/** Overpass-Abfrage für Features, die nur wenige OSM-Objekte brauchen. */
export async function overpassQuery(query, ttlMs = 30 * 60_000) {
  const { value } = await cached(`feature-overpass-${query.slice(0, 120)}`, ttlMs, async () => {
    const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt)',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!res.ok) throw new Error(`Overpass antwortet mit ${res.status}`);
        return res.json();
      } catch (err) { lastError = err; }
    }
    throw lastError ?? new Error('Overpass nicht erreichbar');
  });
  return value.elements ?? [];
}

/** Nächste Einträge mit Entfernung. */
export function nearest(items, lat, lon, n = 5, filter = () => true) {
  return items.filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon) && filter(x))
    .map((x) => ({ ...x, distance: haversine({ lat, lon }, { lat: x.lat, lon: x.lon }) }))
    .sort((a, b) => a.distance - b.distance).slice(0, n);
}

/** Anzahl Bäume im Umkreis (Baumkataster, gecacht). */
export async function treeCountAt(lat, lon, radiusMeters = 80) {
  const key = `extra-trees-${lat.toFixed(5)}-${lon.toFixed(5)}-${radiusMeters}`;
  const { value } = await cached(key, 24 * 3600_000, async () => {
    const fs = await wfsItems('Base:A67_GFM_BAUM_PLUS_EPSG25832', lat, lon, radiusMeters, 500, 'https://geoserver.stuttgart.de/geoserver/ows');
    return fs.length;
  });
  return value;
}

let stopsCache = null;
/** Nächste Haltestelle aus dem lokalen VVS-Soll-Fahrplan. */
export async function nearestStop(lat, lon) {
  if (!stopsCache) {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const file = fileURLToPath(new URL('../../../public/data/stops.geojson', import.meta.url));
    const fc = JSON.parse(readFileSync(file, 'utf8'));
    stopsCache = (fc.features ?? []).map((f) => ({
      id: f.properties?.id, name: f.properties?.name, lines: f.properties?.lines ?? [],
      lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0],
    })).filter((x) => x.id && Number.isFinite(x.lat) && Number.isFinite(x.lon));
  }
  return nearest(stopsCache, lat, lon, 1)[0] ?? null;
}

/** Abstand Punkt zu Linie in Metern (ebene Näherung). */
export function pointLineMeters(pt, line) {
  if (!Array.isArray(line) || line.length < 2) return Infinity;
  const k = 111_320 * Math.cos((pt[1] * Math.PI) / 180);
  const xy = ([x, y]) => [(x - pt[0]) * k, (y - pt[1]) * 111_320];
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = xy(line[i - 1]); const [bx, by] = xy(line[i]);
    const dx = bx - ax; const dy = by - ay; const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Alle Linien einer Route als Koordinatenketten. */
export function routeLines(routeResult) {
  const v = routeResult?.varianten?.[0];
  return (v?.abschnitte ?? []).map((a) => a.geometrie).filter((g) => Array.isArray(g) && g.length > 1);
}

/** Zeit heute (oder morgen, wenn vorbei) aus HH:MM. */
export function targetTime(hhmm, fallback = '23:30') {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  const [h, min] = m ? [Number(m[1]), Number(m[2])] : fallback.split(':').map(Number);
  const d = new Date();
  d.setHours(h, min, 0, 0);
  if (d.getTime() < Date.now() + 2 * 60_000) d.setDate(d.getDate() + 1);
  return d;
}
