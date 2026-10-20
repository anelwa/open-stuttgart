import type { StopFeature } from './stops';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Entfernung in Metern zwischen zwei [lon, lat]-Punkten */
export function distM(a: [number, number], b: [number, number]) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Gehzeit in Minuten: Luftlinie mal 1,3 für Umwege, 75 m pro Minute */
export const walkMin = (m: number) => Math.max(1, Math.round((m * 1.3) / 75));

export interface NearStop { stop: StopFeature; dist: number; walk: number }

/**
 * Nächste Haltestellen zu einem Punkt. Liegt eine Bahnhaltestelle kaum weiter weg als der nächste Bus,
 * kommt sie nach vorn, weil sie für die Anreise meist die bessere Wahl ist.
 */
export function nearestStops(stops: StopFeature[], p: [number, number], n = 3, maxM = 1500): NearStop[] {
  const all = stops
    .map((s) => ({ stop: s, dist: distM(p, s.geometry.coordinates as [number, number]) }))
    .filter((x) => x.dist <= maxM)
    .sort((a, b) => a.dist - b.dist)
    .map((x) => ({ ...x, walk: walkMin(x.dist) }));
  const seen = new Set<string>();
  const unique = all.filter((x) => (seen.has(x.stop.properties.name) ? false : (seen.add(x.stop.properties.name), true)));
  const rail = unique.find((x) => x.stop.properties.kind !== 'bus');
  const first = unique[0];
  if (rail && first && rail !== first && rail.walk <= first.walk + 5) {
    return [rail, ...unique.filter((x) => x !== rail)].slice(0, n);
  }
  return unique.slice(0, n);
}

export function within<T extends { lon?: number; lat?: number }>(items: T[], p: [number, number], maxM: number) {
  return items
    .filter((x) => x.lon != null && x.lat != null)
    .map((x) => ({ item: x, dist: distM(p, [x.lon!, x.lat!]) }))
    .filter((x) => x.dist <= maxM)
    .sort((a, b) => a.dist - b.dist);
}
