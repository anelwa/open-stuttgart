// Gemeinsame Bausteine für das Erweiterungsprogramm: Ortsauflösung, Geometrie,
// Berichtsblöcke und Quellenangaben. Die Funktionen liefern bewusst einfache,
// serialisierbare Objekte, die Oberfläche und MCP gemeinsam verwenden können.

export const STUTTGART = { lat: 48.7758, lon: 9.1829, label: 'Stuttgart' };
export const STADT_BBOX = [9.03, 48.68, 9.32, 48.87];

export function bboxAround(lat, lon, radiusMeters) {
  const dLat = radiusMeters / 111_320;
  const dLon = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((x) => +x.toFixed(6));
}
export function bboxString(bbox) {
  return bbox.map((x) => Number(x).toFixed(6)).join(',');
}
export function bboxPolygon(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return `POLYGON((${minLon} ${minLat},${maxLon} ${minLat},${maxLon} ${maxLat},${minLon} ${maxLat},${minLon} ${minLat}))`;
}
export function haversine(a, b) {
  if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lon) || !Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return null;
  const R = 6_371_000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = ((b.lat - a.lat) * Math.PI) / 180;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
export function km(meters) {
  if (meters == null) return null;
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
export function geometryCenter(geometry) {
  if (!geometry) return null;
  const pts = [];
  const walk = (v) => {
    if (!Array.isArray(v)) return;
    if (typeof v[0] === 'number' && typeof v[1] === 'number') { pts.push(v); return; }
    for (const x of v) walk(x);
  };
  walk(geometry.coordinates);
  const valid = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!valid.length) return null;
  return {
    lon: +(valid.reduce((s, p) => s + p[0], 0) / valid.length).toFixed(6),
    lat: +(valid.reduce((s, p) => s + p[1], 0) / valid.length).toFixed(6),
  };
}
export function featurePoints(fc, nameKeys = ['NAME', 'Name', 'name', 'TITEL', 'Titel', 'BEZEICHNUNG', 'Bezeichnung', 'STRASSE', 'Strasse']) {
  return (fc?.features ?? []).map((f, i) => {
    const c = geometryCenter(f.geometry);
    if (!c) return null;
    const p = f.properties ?? {};
    const name = nameKeys.map((k) => p[k]).find((v) => v != null && String(v).trim()) ?? `Objekt ${i + 1}`;
    return { id: String(f.id ?? i), name: String(name).trim(), lat: c.lat, lon: c.lon, props: p };
  }).filter(Boolean);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
export function dateDe(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function timeDe(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return null;
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
export function numDe(n, digits = 0) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits });
}
export function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
export function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((x) => {
    const k = typeof key === 'function' ? key(x) : x?.[key];
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/** Einheitlicher Bericht: Blöcke, Kartenpunkte, Quellen, Grenzen. */
export function report({ title, subtitle = null, summary = null, facts = [], blocks = [], points = [], geojson = null, sources = [], actions = [], limits = [], speech = null, updated = new Date().toISOString() }) {
  return {
    title,
    subtitle,
    summary,
    facts: facts.filter(Boolean),
    blocks: blocks.filter(Boolean),
    points: points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon)),
    geojson,
    sources: sources.filter(Boolean),
    actions: actions.filter(Boolean),
    limits,
    speech,
    updated,
  };
}

export const block = {
  text: (title, text, tone = null) => ({ type: 'text', title, text, tone }),
  facts: (title, items) => ({ type: 'facts', title, items: items.filter(Boolean) }),
  list: (title, items, note = null) => ({ type: 'list', title, items: items.filter(Boolean), note }),
  table: (title, columns, rows, note = null) => ({ type: 'table', title, columns, rows, note }),
  chart: (title, labels, values, unit = '', note = null) => ({ type: 'chart', title, labels, values, unit, note }),
  links: (title, items) => ({ type: 'links', title, items: items.filter(Boolean) }),
  map: (title, points) => ({ type: 'map', title, points: points.filter(Boolean) }),
};

export function source(name, url, license, note = null) {
  return { name, url, license, note };
}

export function action(label, href, kind = 'link') {
  return { label, href, kind };
}

/** Entfernt HTML und kürzt Text für Listen. */
export function clean(value, max = 400) {
  const s = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Sprachneutrale, kurze Zahl aus einem CKAN-Wert. */
export function parseNum(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s || /^-+$/.test(s)) return null;
  s = s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
