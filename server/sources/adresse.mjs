// "Meine Adresse": was für einen Ort in Stuttgart gilt, aus den Geodaten der Stadt (CC BY 4.0).
// Wahlbezirk und Wahllokal, Stadtbezirk, Starkregengefahr, Straßen- und Schienenlärm an der Fassade,
// nächster Notfall-Treffpunkt und kühle Orte. Dazu, sobald vorhanden, der Datensatz zu Verwaltungsgebäuden
// und Leistungen (server/data/verwaltung.json oder Pfad in OS_VERWALTUNG), siehe docs/verwaltung-datensatz.md.
// Je Ort (auf etwa 10 m gerundet) höchstens ein Abruf in 30 Tagen; die Ebenen ändern sich selten.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cached, fetchJson } from '../cache.mjs';
import { facilities } from './nearby.mjs';

const WFS2 = 'https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326';

/** Merkmale einer Ebene in einem Quadrat von 2r Metern um den Punkt. */
async function box(layer, lat, lon, r, count = 200) {
  const dLat = r / 111_320; const dLon = r / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((x) => x.toFixed(6)).join(',');
  const j = await fetchJson(`${WFS2}&typeName=GEOLINE_FLEX:${layer}_EPSG25832&count=${count}&bbox=${bbox},urn:ogc:def:crs:EPSG::4326`, { timeout: 20000 });
  return j.features ?? [];
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
const contains = (f, pt) => polys(f.geometry).some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));

const R = 6371000;
const dist = (a, b) => {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180; const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
/** Kürzester Abstand vom Punkt zu einer Linie (Meter, ebene Näherung). */
function lineDist(pt, g) {
  const k = 111_320 * Math.cos((pt[1] * Math.PI) / 180);
  const xy = ([x, y]) => [(x - pt[0]) * k, (y - pt[1]) * 111_320];
  const lines = g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : [];
  let best = Infinity;
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const [ax, ay] = xy(l[i - 1]); const [bx, by] = xy(l[i]);
      const dx = bx - ax; const dy = by - ay; const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}
const nearest = (items, pt, n, filter = () => true) => items.filter(filter)
  .map((f) => ({ ...f, dist: Math.round(dist(pt, [f.lon, f.lat])) })).sort((a, b) => a.dist - b.dist).slice(0, n);

// ---------- Wahlbezirk und Wahllokal ----------
async function wahl(lat, lon) {
  const pt = [lon, lat];
  const area = (await box('A12_GBE_WAHLBEZAREA', lat, lon, 30, 20)).find((f) => contains(f, pt));
  if (!area) return null;
  const p = area.properties;
  const { value: lokale } = await cached('wfs-wahllokale-raw', 24 * 3600_000, async () =>
    (await fetchJson(`${WFS2}&typeName=GEOLINE_FLEX:A12_GBE_WAHLLOKALE_EPSG25832`, { timeout: 30000 })).features ?? []);
  const l = lokale.find((f) => f.properties.WBZ_AKTUEL === p.AWBEZ_T);
  const lp = l?.properties;
  return {
    bezirk: p.AWBEZ_T, briefwahlbezirk: p.BWBEZ_T, stadtbezirk: p.STBNAM_T,
    landtagswahlkreis: p.LWKNAM_T ? `${p.LWKNUM_T} ${p.LWKNAM_T}` : null,
    bundestagswahlkreis: p.BWKNAM_T ? `${p.BWKNUM_T} ${p.BWKNAM_T}` : null,
    stand: p.STAND,
    lokal: lp ? {
      name: lp.RAUM_WBEN1, address: [lp.RAUM_WBEN2, lp.RAUM_WBEN3].filter(Boolean).join(', '),
      lat: l.geometry?.coordinates?.[1] ?? null, lon: l.geometry?.coordinates?.[0] ?? null,
      lage: lp.RAUM_LAGE, zugang: lp.RAUM_ZUGAN, tuer: lp.RAUM_TÜRB, lift: lp.RAUM_LIFT, barrierefrei: lp.BARRIEREFR, stand: lp.STAND,
    } : null,
  };
}

// ---------- Starkregen: Fließwege mit erhöhter Gefahr und Überflutungsausdehnung ----------
const SZENARIEN = [
  ['A66_SRGS_UEBERFLUTUNGSAUSD_SEL', 'seltenem Starkregen'],
  ['A66_SRGS_UEBERFLUTUNGSAUSD_AUS', 'außergewöhnlichem Starkregen'],
  ['A66_SRGS_UEBERFLUTUNGSAUSD_EXT', 'extremem Starkregen'],
];
async function starkregen(lat, lon) {
  const pt = [lon, lat];
  const flaechen = [];
  for (const [layer, label] of SZENARIEN) {
    const fs = await box(layer, lat, lon, 25, 50);
    flaechen.push({ szenario: label, betroffen: fs.some((f) => contains(f, pt)), nahe: fs.length > 0 });
  }
  const wege = await box('A66_SRGS_UEBERFLUTUNGSGEFAHR', lat, lon, 100, 100);
  const naechster = wege.length ? Math.round(Math.min(...wege.map((f) => lineDist(pt, f.geometry)))) : null;
  return { flaechen, fliessweg: naechster != null && naechster <= 100 ? naechster : null };
}

// ---------- Lärm: Fassadenpegel der Lärmkartierung 2022 ----------
const normStreet = (s) => (s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/stra(ß|ss)e|str\./g, 'str').replace(/[^a-zäöü0-9]/g, '');
async function laerm(lat, lon, street, nr) {
  const out = {};
  for (const [key, layer] of [['strasse', 'A36_LAERM2022_FASSADENPEGEL_STR'], ['schiene', 'A36_LAERM2022_FASSADENPEGEL_BAHN']]) {
    const fs = (await box(layer, lat, lon, 35, 300)).filter((f) => f.properties.LDEN != null);
    if (!fs.length) { out[key] = null; continue; }
    const own = street && nr ? fs.filter((f) => normStreet(f.properties.STRNAME) === normStreet(street) && String(f.properties.HAUSNR ?? '').trim() === String(nr).trim()) : [];
    const pick = own.length ? own : fs;
    const top = pick.reduce((a, b) => (b.properties.LDEN > a.properties.LDEN ? b : a));
    out[key] = {
      lden: Math.round(top.properties.LDEN * 10) / 10, ln: top.properties.LN != null ? Math.round(top.properties.LN * 10) / 10 : null,
      gebaeude: own.length ? 'dieses Gebäude, lauteste Fassade' : 'lauteste Fassade im Umkreis von etwa 35 m',
      adresse: top.properties.STRNAME ? `${top.properties.STRNAME.trim()} ${top.properties.HAUSNR ?? ''}`.trim() : null,
    };
  }
  return out;
}

// ---------- Verwaltungsgebäude und Leistungen (Datensatz aus dem Stadtseiten-Crawl) ----------
const VERW_FILE = process.env.OS_VERWALTUNG ?? fileURLToPath(new URL('../data/verwaltung.json', import.meta.url));
let verwCache = { mtime: 0, items: [] };
export function verwaltungItems() {
  if (!existsSync(VERW_FILE)) return [];
  const m = statSync(VERW_FILE).mtimeMs;
  if (m !== verwCache.mtime) {
    try {
      const raw = JSON.parse(readFileSync(VERW_FILE, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.items ?? raw.features?.map((f) => ({ ...f.properties, lon: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1] })) ?? [];
      verwCache = { mtime: m, items: list.filter((x) => Number.isFinite(+x.lat) && Number.isFinite(+x.lon)).map((x) => ({ ...x, lat: +x.lat, lon: +x.lon })) };
    } catch (e) {
      console.warn(`Verwaltungsdatensatz nicht lesbar: ${e.message}`);
    }
  }
  return verwCache.items;
}

export async function profil(lat, lon, street, nr) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw Object.assign(new Error('lat und lon angeben'), { status: 400 });
  if (lat < 48.68 || lat > 48.87 || lon < 9.03 || lon > 9.32) throw Object.assign(new Error('Ort liegt außerhalb Stuttgarts'), { status: 400 });
  const la = lat.toFixed(4); const lo = lon.toFixed(4);
  const pt = [lon, lat];
  const { value } = await cached(`profil-${la}-${lo}-${street ?? ''}-${nr ?? ''}`, 30 * 86400_000, async () => {
    const [w, s, l] = await Promise.allSettled([wahl(lat, lon), starkregen(lat, lon), laerm(lat, lon, street, nr)]);
    return {
      wahl: w.status === 'fulfilled' ? w.value : { error: 'Wahlbezirke derzeit nicht abrufbar' },
      starkregen: s.status === 'fulfilled' ? s.value : { error: 'Starkregenkarte derzeit nicht abrufbar' },
      laerm: l.status === 'fulfilled' ? l.value : { error: 'Lärmkarte derzeit nicht abrufbar' },
    };
  });
  const [notfall, kuehl, brunnen, toilette] = await Promise.all(['notfall', 'kuehl', 'trinkbrunnen', 'toilette'].map((c) => facilities(c).then((r) => r.items).catch(() => [])));
  const verw = verwaltungItems();
  return {
    ...value,
    notfall: nearest(notfall, pt, 1, (f) => f.info?.includes('Notfall-Treffpunkt'))[0] ?? null,
    leuchtturm: nearest(notfall, pt, 1, (f) => f.info?.includes('Notfall-Leuchtturm'))[0] ?? null,
    kuehl: nearest(kuehl, pt, 3),
    trinkbrunnen: nearest(brunnen, pt, 1)[0] ?? null,
    toilette: nearest(toilette, pt, 1)[0] ?? null,
    verwaltung: verw.length ? nearest(verw, pt, 5) : null,
    source: 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0): Wahlbezirke und Wahllokale, Starkregengefahrenkarte, Lärmkartierung 2022, Notfall-Treffpunkte, kühle Orte',
  };
}
