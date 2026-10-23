import type { Route, RouteProgress, Station } from './types';

const circle = (center: [number, number], radiusM: number, steps = 64): [number, number][] => {
  const [lon, lat] = center;
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.25, Math.cos((lat * Math.PI) / 180)));
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]);
  }
  return pts;
};

export function stationStatus(s: Station, solved: Set<string>, currentId: string | null): 'solved' | 'current' | 'open' | 'bonus' {
  if (solved.has(s.id)) return 'solved';
  if (s.id === currentId) return 'current';
  if (s.kind === 'bonus') return 'bonus';
  return 'open';
}

export function routeCoords(route: Route): [number, number][] {
  if (route.line?.length) return route.line;
  return route.stations
    .filter((s) => s.kind !== 'bonus')
    .sort((a, b) => a.no - b.no)
    .map((s) => s.point);
}

export function routeBounds(route: Route): [[number, number], [number, number]] {
  const pts = routeCoords(route);
  const use = pts.length > 1 ? pts : route.stations.map((s) => s.point);
  const lons = use.map((p) => p[0]);
  const lats = use.map((p) => p[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

export function buildSpielGeo(route: Route, progress: RouteProgress | null, currentId: string | null): GeoJSON.FeatureCollection {
  const solved = new Set(progress?.solved ?? []);
  const features: GeoJSON.Feature[] = [];
  const coords = routeCoords(route);
  if (coords.length > 1) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { _kind: 'line', color: route.color, title: route.title },
    });
  }
  for (const s of route.stations) {
    const status = stationStatus(s, solved, currentId);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: s.point },
      properties: {
        _kind: 'station', id: s.id, no: s.no, name: s.name, kind: s.kind,
        code: s.code ?? '', status, current: status === 'current', color: route.color,
        radius: s.radiusM, ticket: !!s.ticket,
      },
    });
    if (s.id === currentId) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circle(s.point, s.radiusM)] },
        properties: { _kind: 'area', color: route.color },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
