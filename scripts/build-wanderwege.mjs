#!/usr/bin/env node
// Holt ausgeschilderte Wander- und Weinwanderwege aus OpenStreetMap (ODbL) für den Stuttgarter Raum.
// Ergebnis: server/data/wanderwege-osm.json (MultiLineString + Metadaten). Der Server führt diese
// Routen mit den offiziellen WFS-Wegen der Stadt zusammen.
// Aufruf: node scripts/build-wanderwege.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'server/data/wanderwege-osm.json');
const BBOX = [48.55, 8.9, 48.95, 9.45];
const UA = 'open-stuttgart/0.2 (nicht kommerzielles Open-Data-Projekt; Kontakt über das Repository)';
const QUERY = `[out:json][timeout:90];
(
  relation["route"~"hiking|foot"]["name"~"Blaustrümpflerweg|Stuttgarter Rundwanderweg|Rößleweg|4-Burgen|Vier-Burgen|Heslacher|Pfaffensee|Georg-Fahrbach|HW 5|Stuttgarter Weinwanderweg",i](${BBOX.join(',')});
);
out body geom;`;

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const length = (coords) => coords.reduce((sum, line) => sum + line.reduce((s, p, i, arr) => (i ? s + dist([arr[i - 1][1], arr[i - 1][0]], [p[1], p[0]]) : s), 0), 0);

console.log('Frage Overpass ab …');
const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(QUERY)}`;
const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
if (!res.ok) {
  if (existsSync(OUT)) {
    console.warn(`Overpass antwortet mit ${res.status}; die vorhandene Datei bleibt unverändert.`);
    process.exit(0);
  }
  throw new Error(`Overpass antwortet mit ${res.status}`);
}
const d = await res.json();
const items = [];
// Nur den Stuttgarter Ausschnitt behalten; lange Fernwege (HW 5) werden an der Bbox gekappt.
const inBox = (lon, lat, pad = 0.02) => lon >= BBOX[1] - pad && lon <= BBOX[3] + pad && lat >= BBOX[0] - pad && lat <= BBOX[2] + pad;
const clip = (geom) => {
  const out = [];
  let cur = [];
  for (const p of geom) {
    const lon = +p.lon.toFixed(5), lat = +p.lat.toFixed(5);
    if (inBox(lon, lat)) cur.push([lon, lat]);
    else { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
};
for (const rel of d.elements ?? []) {
  const tags = rel.tags ?? {};
  const lines = (rel.members ?? [])
    .filter((m) => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length > 1)
    .flatMap((m) => clip(m.geometry));
  if (!lines.length) continue;
  // Segmente zusammenführen, wenn sie aneinander anschließen; sonst als MultiLineString behalten.
  const coords = lines.length === 1 ? [lines[0]] : lines;
  const name = tags.name ?? `Wanderweg ${rel.id}`;
  const wein = /wein/i.test(name);
  const km = tags.distance ? Number(String(tags.distance).replace(',', '.')) : length(coords) / 1000;
  items.push({
    id: `osm-${rel.id}`,
    osmId: rel.id,
    art: wein ? 'wein' : 'osm',
    artLabel: wein ? 'Weinwanderweg (OSM)' : 'Wanderweg (OSM)',
    farbe: wein ? '#8E2F4A' : '#6B4A2E',
    name,
    beschreibung: tags.description ?? tags.note ?? null,
    laengeKm: Number.isFinite(km) ? +km.toFixed(2) : null,
    aufstiegM: null,
    abstiegM: null,
    start: tags.from ?? null,
    ziel: tags.to ?? null,
    netz: tags.network ?? null,
    ref: tags.ref ?? null,
    url: `https://www.openstreetmap.org/relation/${rel.id}`,
    geometrie: { type: 'MultiLineString', coordinates: coords },
    bbox: (() => {
      const pts = coords.flat();
      return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
    })(),
  });
}
items.sort((a, b) => a.name.localeCompare(b.name, 'de'));
const out = {
  stand: new Date().toISOString().slice(0, 10),
  quelle: 'OpenStreetMap-Routenrelationen, Overpass API',
  url: 'https://www.openstreetmap.org/',
  lizenz: 'ODbL 1.0, © OpenStreetMap-Mitwirkende',
  hinweis: 'Ausgeschilderte Routen; Geometrien können Lücken enthalten, wenn Wege außerhalb des Stuttgarter Ausschnitts liegen. Keine Navigation mit Ansage.',
  items,
};
writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(`Geschrieben: ${OUT} (${items.length} Routen)`);
for (const x of items) console.log(`  ${x.art.padEnd(4)} ${x.name} (${x.laengeKm ?? '?'} km, ${x.geometrie.coordinates.length} Linien)`);
