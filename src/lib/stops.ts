import { useEffect, useState } from 'react';
import type { StopProps } from './types';

export type StopFeature = GeoJSON.Feature<GeoJSON.Point, StopProps>;

let cache: StopFeature[] | null = null;
let pending: Promise<StopFeature[]> | null = null;

export function loadStops() {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch('/data/stops.geojson').then((r) => r.json()).then((d) => (cache = d.features as StopFeature[]));
  return pending;
}

export function useStops() {
  const [stops, setStops] = useState<StopFeature[]>(cache ?? []);
  useEffect(() => { if (!cache) loadStops().then(setStops); }, []);
  return stops;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/str\.?(\s|$)/g, 'strasse$1');

/** Lokale Suche über alle Haltestellen: Wortanfang zuerst, dann Teiltreffer, gewichtet nach Fahrten. */
export function searchStops(stops: StopFeature[], q: string, limit = 7) {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  const scored: [number, StopFeature][] = [];
  for (const s of stops) {
    const name = norm(s.properties.name);
    let score = -1;
    if (name.startsWith(n)) score = 3;
    else if (name.split(/[\s(-]+/).some((w) => w.startsWith(n))) score = 2;
    else if (name.includes(n)) score = 1;
    if (score > 0) scored.push([score * 1e6 + s.properties.trips, s]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, s]) => s);
}
