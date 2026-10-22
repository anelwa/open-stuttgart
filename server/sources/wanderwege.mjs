// Wander- und Weinwanderwege, Innenstadtrundweg und MTB-Downhill aus dem Geoserver der Stadt
// (GEOLINE_FLEX, CC BY 4.0). Die Linien werden mit Haltestellen, Trinkbrunnen und Toiletten
// im 150-Meter-Korridor verknüpft. Kein Live-Abruf bei OpenStreetMap im Betrieb.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cached, fetchJson } from '../cache.mjs';
import { facilities } from './nearby.mjs';

const WFS = (layer) => `https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GEOLINE_FLEX:${layer}_EPSG25832&outputFormat=application/json&srsName=EPSG:4326&count=5000`;
const STOPS = fileURLToPath(new URL('../../public/data/stops.geojson', import.meta.url));
const OSM_FILE = fileURLToPath(new URL('../data/wanderwege-osm.json', import.meta.url));
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const linesOf = (g) => (g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : []);
const first = (g) => linesOf(g)[0]?.[0] ?? null;
const last = (g) => {
  const ls = linesOf(g);
  const l = ls[ls.length - 1];
  return l?.[l.length - 1] ?? null;
};
const lengthOf = (g) => linesOf(g).flat().reduce((sum, p, i, arr) => (i ? sum + dist(arr[i - 1], p) : sum), 0);
const distToLine = (p, line) => {
  const k = 111_320 * Math.cos(rad(p[1]));
  const xy = ([x, y]) => [(x - p[0]) * k, (y - p[1]) * 111_320];
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
};
const distToGeom = (p, g) => Math.min(...linesOf(g).map((l) => distToLine(p, l)), Infinity);

let stopCache = null;
function stops() {
  if (!stopCache) {
    const fc = JSON.parse(readFileSync(STOPS, 'utf8'));
    stopCache = fc.features.map((f) => ({
      id: f.properties.id, name: f.properties.name, lines: f.properties.lines, kind: f.properties.kind,
      lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
    }));
  }
  return stopCache;
}
function nearestStop(p) {
  if (!p) return null;
  return stops().map((s) => ({ ...s, dist: Math.round(dist(p, [s.lon, s.lat])) })).sort((a, b) => a.dist - b.dist)[0] ?? null;
}
function nearestStops(p, n = 2) {
  if (!p) return [];
  const seen = new Set();
  return stops().map((s) => ({ ...s, dist: Math.round(dist(p, [s.lon, s.lat])) })).sort((a, b) => a.dist - b.dist)
    .filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true))).slice(0, n);
}

async function layer(name) {
  const d = await fetchJson(WFS(name), { timeout: 45000 });
  return d.features ?? [];
}

const ART = {
  wein: { label: 'Weinwanderweg', farbe: '#8E2F4A' },
  innenstadt: { label: 'Innenstadtrundweg', farbe: '#B85C00' },
  downhill: { label: 'MTB-Downhill', farbe: '#2E6B43' },
  osm: { label: 'Wanderweg (OSM)', farbe: '#6B4A2E' },
};

export async function wanderwege() {
  const { value, at, fresh } = await cached('wanderwege-stuttgart-v1', 24 * 3600_000, async () => {
    const [wein, innen, downhill, brunnen, toiletten] = await Promise.allSettled([
      layer('A62_WANDERN_WEINWANDERWEG'),
      layer('A62_POI_INNENSTADTRUNDWEG_LINIE'),
      layer('A62_RAD_DOWNHILL_LINIE_Strecke'),
      facilities('trinkbrunnen').then((r) => r.items).catch(() => []),
      facilities('toilette').then((r) => r.items).catch(() => []),
    ]);
    const br = brunnen.status === 'fulfilled' ? brunnen.value : [];
    const wc = toiletten.status === 'fulfilled' ? toiletten.value : [];
    const items = [];

    const add = (f, art, fallbackName) => {
      const p = f.properties ?? {};
      const g = f.geometry;
      if (!g || !linesOf(g).length) return;
      const start = first(g);
      const end = last(g);
      const startStop = nearestStop(start);
      const endStop = nearestStop(end);
      const laenge = p.STRECKE_KM ?? p.STRECKENLAENGE ?? p.LAENGE_KM;
      const name = p.STRECKENNAME ?? p.NAME ?? fallbackName;
      const richtung = p.RICHTUNG ?? p.ABSCHNITT ?? null;
      const brunnenCount = br.filter((x) => distToGeom([x.lon, x.lat], g) <= 150).length;
      const wcCount = wc.filter((x) => distToGeom([x.lon, x.lat], g) <= 150).length;
      items.push({
        id: `${art}-${f.id}`,
        art,
        artLabel: ART[art].label,
        farbe: ART[art].farbe,
        name: richtung && !String(name).includes(richtung) ? `${name} – ${richtung}` : name,
        beschreibung: [p.ART, p.ABSCHNITT, p.RICHTUNG].filter(Boolean).join(' · ') || null,
        laengeKm: laenge != null ? +Number(laenge).toFixed(2) : +(lengthOf(g) / 1000).toFixed(2),
        aufstiegM: p.AUFSTIEG_M != null ? Math.round(Number(p.AUFSTIEG_M)) : null,
        abstiegM: p.ABSTIEG_M != null ? Math.round(Number(p.ABSTIEG_M)) : null,
        start: p.STARTPUNKT ?? startStop?.name ?? null,
        ziel: p.ZIELPUNKT ?? endStop?.name ?? null,
        startStop: startStop ? { id: startStop.id, name: startStop.name, lines: startStop.lines, dist: startStop.dist, lat: startStop.lat, lon: startStop.lon } : null,
        endStop: endStop ? { id: endStop.id, name: endStop.name, lines: endStop.lines, dist: endStop.dist, lat: endStop.lat, lon: endStop.lon } : null,
        naechsteHaltestellen: [...new Map([...nearestStops(start), ...nearestStops(end)].map((s) => [s.id, s])).values()],
        brunnen: brunnenCount,
        toiletten: wcCount,
        geometrie: g,
        bbox: (() => {
          const pts = linesOf(g).flat();
          return [Math.min(...pts.map((p2) => p2[0])), Math.min(...pts.map((p2) => p2[1])), Math.max(...pts.map((p2) => p2[0])), Math.max(...pts.map((p2) => p2[1]))];
        })(),
      });
    };

    if (wein.status === 'fulfilled') for (const f of wein.value) add(f, 'wein', 'Stuttgarter Weinwanderweg');
    if (innen.status === 'fulfilled') for (const f of innen.value) add(f, 'innenstadt', 'Stuttgarter Innenstadtrundweg');
    if (downhill.status === 'fulfilled') for (const f of downhill.value) add(f, 'downhill', 'Woodpecker-Trail');

    // OSM-Routenrelationen (Blaustrümpflerweg, Rößleweg, 4-Burgen-Weg, Georg-Fahrbach-Weg, HW 5,
    // Stuttgarter Weinwanderwege), vorab mit scripts/build-wanderwege.mjs aufbereitet.
    try {
      const osm = JSON.parse(readFileSync(OSM_FILE, 'utf8'));
      for (const o of osm.items ?? []) {
        const g = o.geometrie;
        if (!g || !linesOf(g).length) continue;
        const start = first(g);
        const end = last(g);
        const startStop = nearestStop(start);
        const endStop = nearestStop(end);
        const b = o.bbox ?? (() => {
          const pts = linesOf(g).flat();
          return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
        })();
        items.push({
          id: o.id,
          art: o.art === 'wein' ? 'wein' : 'osm',
          artLabel: o.artLabel ?? ART[o.art === 'wein' ? 'wein' : 'osm'].label,
          farbe: o.farbe ?? ART[o.art === 'wein' ? 'wein' : 'osm'].farbe,
          name: o.name,
          beschreibung: o.beschreibung ?? ([o.netz, o.ref].filter(Boolean).join(' · ') || null),
          laengeKm: o.laengeKm != null ? +Number(o.laengeKm).toFixed(2) : +(lengthOf(g) / 1000).toFixed(2),
          aufstiegM: o.aufstiegM != null ? Math.round(Number(o.aufstiegM)) : null,
          abstiegM: o.abstiegM != null ? Math.round(Number(o.abstiegM)) : null,
          start: o.start ?? startStop?.name ?? null,
          ziel: o.ziel ?? endStop?.name ?? null,
          startStop: startStop ? { id: startStop.id, name: startStop.name, lines: startStop.lines, dist: startStop.dist, lat: startStop.lat, lon: startStop.lon } : null,
          endStop: endStop ? { id: endStop.id, name: endStop.name, lines: endStop.lines, dist: endStop.dist, lat: endStop.lat, lon: endStop.lon } : null,
          naechsteHaltestellen: [...new Map([...nearestStops(start), ...nearestStops(end)].map((s) => [s.id, s])).values()],
          brunnen: br.filter((x) => distToGeom([x.lon, x.lat], g) <= 150).length,
          toiletten: wc.filter((x) => distToGeom([x.lon, x.lat], g) <= 150).length,
          geometrie: g,
          bbox: b,
          url: o.url ?? null,
          netz: o.netz ?? null,
          ref: o.ref ?? null,
          quelle: 'OpenStreetMap (ODbL)',
        });
      }
    } catch { /* keine OSM-Datei: nur die offiziellen WFS-Wege */ }

    items.sort((a, b) => a.art.localeCompare(b.art) || a.name.localeCompare(b.name, 'de'));
    return { items, brunnen: br.length, toiletten: wc.length };
  });
  return {
    ...value,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0): Weinwanderwege, Innenstadtrundweg, Downhill-Strecke Degerloch. OSM-Routen: © OpenStreetMap-Mitwirkende (ODbL). Haltestellen: VVS/OpenStreetMap. Brunnen und Toiletten: Stadt Stuttgart.',
    hinweis: 'Die Wege sind ausgeschilderte Routen, keine Navigation mit Ansage. Höhenangaben und Längen stammen aus den Datensätzen; OSM-Routen können an der Stadtgrenze gekappt sein. Die Karte zeigt die Liniengeometrie.',
  };
}

/** GeoJSON für die Kartenebene „hike“ */
export async function wanderwegeGeoJson() {
  const d = await wanderwege();
  return {
    type: 'FeatureCollection',
    features: d.items.flatMap((w) => linesOf(w.geometrie).map((line, i) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: line },
      properties: { id: `${w.id}-${i}`, name: w.name, art: w.art, farbe: w.farbe, laengeKm: w.laengeKm, aufstiegM: w.aufstiegM, abstiegM: w.abstiegM },
    }))),
  };
}
