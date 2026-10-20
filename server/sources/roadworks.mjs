// Baustellen des Tiefbauamts Stuttgart (WFS geoserver.stuttgart.de, Open Data Stuttgart).
// Die Ressourcennamen im Portal sind vertauscht; wir lesen beide Ebenen und werten STATUS aus.
import { readFileSync } from 'node:fs';
import { cached, fetchJson } from '../cache.mjs';

// Liniennetz (Stadtbahn, S-Bahn) aus dem aufbereiteten Fahrplan, um Baustellen den Linien zuzuordnen
let network = null;
function loadNetwork() {
  if (network) return network;
  try {
    const d = JSON.parse(readFileSync(new URL('../../public/data/network.geojson', import.meta.url), 'utf8'));
    network = d.features.map((f) => ({
      line: f.properties.line, color: f.properties.color, text: f.properties.text,
      parts: f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates,
    }));
  } catch { network = []; }
  return network;
}

const KX = 111320 * Math.cos((48.78 * Math.PI) / 180), KY = 110540;
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Linien, deren Verlauf höchstens `maxM` Meter an einem Punkt vorbeiführt */
function linesNear(lon, lat, maxM = 30) {
  const px = lon * KX, py = lat * KY;
  const hits = [];
  for (const l of loadNetwork()) {
    let hit = false;
    for (const part of l.parts) {
      for (let i = 1; i < part.length && !hit; i++) {
        const [ax, ay] = part[i - 1], [bx, by] = part[i];
        if (Math.abs(ax - lon) > 0.01 && Math.abs(bx - lon) > 0.01) continue;
        if (segDist(px, py, ax * KX, ay * KY, bx * KX, by * KY) <= maxM) hit = true;
      }
      if (hit) break;
    }
    if (hit && !hits.some((h) => h.line === l.line)) hits.push({ line: l.line, color: l.color, text: l.text });
  }
  return hits.sort((a, b) => a.line.localeCompare(b.line, 'de', { numeric: true }));
}

const WFS = 'https://geoserver.stuttgart.de/gdc/Verkehr_Mobilitaet/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeName=';
const LAYERS = [
  'Verkehr_Mobilitaet:A66_BAUM_BAUSTELLEN_DATE_WEB_im_Bau_EPSG25832',
  'Verkehr_Mobilitaet:A66_BAUM_BAUSTELLEN_DATE_WEB_geplant_EPSG25832',
];

const toIso = (d) => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export async function roadworks() {
  const { value, at, fresh } = await cached('roadworks', 15 * 60_000, async () => {
    const all = [];
    const seen = new Set();
    for (const layer of LAYERS) {
      const d = await fetchJson(WFS + encodeURIComponent(layer));
      for (const f of d.features ?? []) {
        const p = f.properties ?? {};
        const [lon, lat] = f.geometry?.coordinates ?? [];
        if (lon == null) continue;
        const key = `${p.STRASSENNAME}|${p.ANFANG}|${lon.toFixed(5)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({
          id: key,
          street: p.STRASSENNAME ?? '',
          where: p.DETAILS_STANDORT ?? '',
          from: toIso(p.ANFANG),
          to: toIso(p.ENDE),
          work: p.ART_ARBEIT ?? '',
          impact: p.VERKEHRSAUSWIRKUNG ?? '',
          timing: p.ZEITL_REGELUNG ?? '',
          status: p.STATUS === 'im Bau' ? 'active' : 'planned',
          lat: +lat.toFixed(6),
          lon: +lon.toFixed(6),
          lines: linesNear(lon, lat),
        });
      }
    }
    return all;
  });
  return { items: value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Landeshauptstadt Stuttgart, Tiefbauamt (Open Data)' };
}

export async function bikeRoutes() {
  const { value } = await cached('bikeroutes', 24 * 3600_000, async () =>
    fetchJson(WFS + encodeURIComponent('Verkehr_Mobilitaet:A61_RAD_HAUPTRADROUTEN_EPSG25832'), { timeout: 30000 }));
  // Koordinaten auf 5 Stellen kürzen, Eigenschaften auf das Nötige
  const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(5), +c[1].toFixed(5)] : c.map(round));
  return {
    type: 'FeatureCollection',
    features: (value.features ?? []).filter((f) => f.geometry).map((f) => ({
      type: 'Feature',
      geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
      properties: { name: f.properties?.ROUTENNAME ?? f.properties?.NAME ?? f.properties?.HRR_NR ?? '' },
    })),
  };
}
