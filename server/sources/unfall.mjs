// Unfallatlas des Bundes für Stuttgart: punktgenaue Straßenverkehrsunfälle mit Personenschaden.
// Quelle: Statistische Ämter des Bundes und der Länder, Unfallatlas (dl-de/by-2-0).
// Der Auszug wird mit scripts/build-unfaelle.mjs erzeugt (einmal jährlich nach Veröffentlichung).
// Keine Sachschäden, keine Adressen, keine Personendaten – nur Ort, Zeit, Unfallart und Beteiligung.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = process.env.OS_UNFAELLE ?? fileURLToPath(new URL('../data/unfaelle-stuttgart.json', import.meta.url));
let cache = null;

function load() {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  cache = { ...raw, items: (raw.items ?? []).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon)) };
  return cache;
}

const R = 6371000;
export function distM(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const ART_FILTER = {
  rad: (x) => x.rad,
  fuss: (x) => x.fuss,
  pkw: (x) => x.pkw,
  krad: (x) => x.krad,
  gkfz: (x) => x.gkfz,
  sonstige: (x) => x.sonstige,
  alle: () => true,
};
const SCHWERE_FILTER = {
  tote: (x) => x.kategorie === 1,
  schwer: (x) => x.kategorie === 2,
  leicht: (x) => x.kategorie === 3,
  alle: () => true,
};

export function stats(list) {
  return {
    gesamt: list.length,
    tote: list.filter((x) => x.kategorie === 1).length,
    schwer: list.filter((x) => x.kategorie === 2).length,
    leicht: list.filter((x) => x.kategorie === 3).length,
    rad: list.filter((x) => x.rad).length,
    fuss: list.filter((x) => x.fuss).length,
    pkw: list.filter((x) => x.pkw).length,
  };
}

/** Einfache Rasterung für Unfallschwerpunkte (rund 250 m × 280 m). */
function schwerpunkte(list, max = 8) {
  const cells = new Map();
  for (const x of list) {
    const key = `${Math.round(x.lat / 0.0025)}:${Math.round(x.lon / 0.004)}`;
    const c = cells.get(key) ?? { lat: 0, lon: 0, anzahl: 0, rad: 0, fuss: 0, tote: 0 };
    c.lat += x.lat; c.lon += x.lon; c.anzahl += 1;
    if (x.rad) c.rad += 1;
    if (x.fuss) c.fuss += 1;
    if (x.kategorie === 1) c.tote += 1;
    cells.set(key, c);
  }
  return [...cells.values()]
    .map((c) => ({ lat: +(c.lat / c.anzahl).toFixed(5), lon: +(c.lon / c.anzahl).toFixed(5), anzahl: c.anzahl, rad: c.rad, fuss: c.fuss, tote: c.tote }))
    .sort((a, b) => b.anzahl - a.anzahl || b.rad - a.rad)
    .slice(0, max);
}

/**
 * Unfälle im Umkreis, im Kartenausschnitt oder im Stadtgebiet.
 * `bbox` = minLon,minLat,maxLon,maxLat; `lat`/`lon` + `r` (Meter) haben Vorrang.
 */
export function unfaelle({ lat, lon, r = 500, bbox, art = 'alle', schwere = 'alle', limit = 2500 } = {}) {
  const data = load();
  const artF = ART_FILTER[art] ?? ART_FILTER.alle;
  const schwereF = SCHWERE_FILTER[schwere] ?? SCHWERE_FILTER.alle;
  let list = data.items.filter((x) => artF(x) && schwereF(x));
  let bezug = null;
  const hasPoint = lat != null && String(lat).trim() !== '' && lon != null && String(lon).trim() !== '';
  const la = hasPoint ? Number(lat) : NaN;
  const lo = hasPoint ? Number(lon) : NaN;
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    const radius = Math.min(5000, Math.max(50, Number(r) || 500));
    bezug = { art: 'umkreis', lat: la, lon: lo, radius };
    list = list
      .map((x) => ({ ...x, dist: Math.round(distM(la, lo, x.lat, x.lon)) }))
      .filter((x) => x.dist <= radius)
      .sort((a, b) => a.dist - b.dist);
  } else if (bbox) {
    const [minLon, minLat, maxLon, maxLat] = String(bbox).split(',').map(Number);
    if ([minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
      bezug = { art: 'bbox', minLon, minLat, maxLon, maxLat };
      list = list.filter((x) => x.lon >= minLon && x.lon <= maxLon && x.lat >= minLat && x.lat <= maxLat);
    }
  }
  const total = list.length;
  const shown = list.slice(0, Math.min(5000, Math.max(1, Number(limit) || 2500)));
  return {
    stand: data.stand,
    bezug,
    items: shown,
    total,
    stats: stats(list),
    schwerpunkte: schwerpunkte(list),
    kodierung: data.kodierung,
    hinweis: data.hinweis,
    source: `${data.quelle} (${data.lizenz})`,
    url: data.url,
  };
}

export function unfallStatistik() {
  const data = load();
  return {
    stand: data.stand,
    stats: stats(data.items),
    schwerpunkte: schwerpunkte(data.items),
    kodierung: data.kodierung,
    hinweis: data.hinweis,
    source: `${data.quelle} (${data.lizenz})`,
    url: data.url,
  };
}

/** Abstand eines Punktes zu einer Linie in Metern (für den Routen-Korridor). */
export function distToLine(lat, lon, line) {
  const k = 111_320 * Math.cos((lat * Math.PI) / 180);
  const xy = ([x, y]) => [(x - lon) * k, (y - lat) * 111_320];
  let best = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    const [ax, ay] = xy(line[i - 1]);
    const [bx, by] = xy(line[i]);
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Unfälle im Korridor einer Route (LineString-Koordinaten [lon,lat]). */
export function unfallKorridor(line, radius = 30, schwere = 'alle') {
  const data = load();
  const f = SCHWERE_FILTER[schwere] ?? SCHWERE_FILTER.alle;
  const pts = data.items.filter(f).map((x) => ({ ...x, dist: distToLine(x.lat, x.lon, line) }))
    .filter((x) => x.dist <= radius)
    .sort((a, b) => a.dist - b.dist);
  return { radius, total: pts.length, stats: stats(pts), items: pts.slice(0, 50), source: `${data.quelle} (${data.lizenz})` };
}
