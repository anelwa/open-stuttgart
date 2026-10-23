// Kuratierte Bar- und Drinking-Spot-Touren für Stuttgart.
//
// Die Touren liegen als redaktioneller Datensatz in server/data/bartouren.json.
// Öffnungszeiten, Barrierefreiheit und Koordinaten stammen aus dem OSM-Auszug
// public/data/gastro.geojson (ODbL, Stand 20.10.2026) sowie aus den Websites der
// Betriebe. Der Server ergänzt die nächsten Haltestellen und liefert Geometrie
// für die Kartenebene. Die Linien verbinden die Stationen; sie sind keine
// Navigation. Für den echten Weg gibt es das Modul „Weg“.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../data/bartouren.json', import.meta.url));
const STOPS = fileURLToPath(new URL('../../public/data/stops.geojson', import.meta.url));
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

const dist = (a, b) => {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

let raw = null;
let rawAt = null;
let stopCache = null;

function readTours() {
  if (raw) return raw;
  raw = JSON.parse(readFileSync(FILE, 'utf8'));
  rawAt = statSync(FILE).mtime.toISOString();
  if (!Array.isArray(raw.tours)) raw.tours = [];
  return raw;
}

function stops() {
  if (stopCache) return stopCache;
  try {
    const fc = JSON.parse(readFileSync(STOPS, 'utf8'));
    stopCache = (fc.features ?? []).map((f) => ({
      id: f.properties.id,
      name: f.properties.name,
      kind: f.properties.kind,
      lines: f.properties.lines ?? [],
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    }));
  } catch {
    stopCache = [];
  }
  return stopCache;
}

function nearestStops(lat, lon, n = 2) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  return stops()
    .map((s) => ({ ...s, dist: Math.round(dist([lon, lat], [s.lon, s.lat])), walkMin: Math.max(1, Math.round((dist([lon, lat], [s.lon, s.lat]) * 1.25) / 75)) }))
    .sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name, 'de'))
    .slice(0, n);
}

function bboxOf(stopsList) {
  const lats = stopsList.map((s) => s.lat);
  const lons = stopsList.map((s) => s.lon);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function enrich(t) {
  const tourStops = (t.stops ?? []).map((s, i) => ({
    ...s,
    index: i + 1,
    nearestStops: nearestStops(s.lat, s.lon, 2),
  }));
  return {
    ...t,
    stops: tourStops,
    stopCount: tourStops.length,
    bbox: bboxOf(tourStops),
    startStop: tourStops[0]?.nearestStops?.[0] ?? null,
    endStop: tourStops[tourStops.length - 1]?.nearestStops?.[0] ?? null,
  };
}

const tours = () => readTours().tours.map(enrich);

export function bartouren() {
  const data = readTours();
  return {
    items: tours(),
    updated: rawAt,
    stand: data.stand ?? null,
    source: data.source ?? 'OpenStreetMap (ODbL); Venue-Websites',
    license: data.license ?? null,
    hinweis: 'Die Linien verbinden die Stationen und sind keine Navigation. Öffnungszeiten, Einlass und Barrierefreiheit sind Momentaufnahmen; maßgeblich ist der Betrieb. Für den echten Weg das Modul „Weg“ nutzen.',
  };
}

export function bartour(id) {
  const t = tours().find((x) => x.id === id);
  return t ?? null;
}

/** Linien und Stationen für die Kartenebene „bartouren“. */
export function bartourenGeoJson() {
  const list = tours();
  const features = [];
  for (const t of list) {
    const coords = t.stops.map((s) => [s.lon, s.lat]);
    if (coords.length > 1) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          kind: 'tour', id: t.id, title: t.title, subtitle: t.subtitle,
          color: t.color, durationMin: t.durationMin, distanceM: t.distanceM,
          stops: t.stopCount,
        },
      });
    }
    for (const s of t.stops) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          kind: 'stop', tourId: t.id, tourTitle: t.title, stopIndex: s.index,
          name: s.name, address: s.address, role: s.role, color: t.color,
          openingHours: s.openingHours, wheelchair: s.wheelchair,
          optional: !!s.optional, label: `${s.index}. ${s.name}`,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** GPX der Stationen (nicht der Gehwege) für Offline-Karten. */
export function bartourGpx(id) {
  const t = bartour(id);
  if (!t) return null;
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
  const pts = t.stops.map((s) => `  <wpt lat="${s.lat}" lon="${s.lon}"><name>${esc(`${s.index}. ${s.name}`)}</name><desc>${esc(s.address)}</desc></wpt>`).join('\n');
  const rte = t.stops.map((s) => `  <rtept lat="${s.lat}" lon="${s.lon}"><name>${esc(s.name)}</name></rtept>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Open Stuttgart" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(t.title)} – ${esc(t.subtitle)}</name><desc>${esc(t.intro)}</desc></metadata>
${pts}
  <rte><name>${esc(t.title)}</name>
${rte}
  </rte>
</gpx>`;
}
