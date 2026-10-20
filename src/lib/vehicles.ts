// Berechnete Fahrzeugpositionen: Zeit je Halt (Ist vor Soll), lineare Interpolation entlang des Linienverlaufs.
// Die Daten lädt die Haltestellenansicht; die Karte rechnet die Positionen jede Sekunde neu.
import { lineColors } from './lines';

export interface TripStop {
  id: string; name: string; lat: number; lon: number;
  arrPlanned: string | null; arr: string | null; depPlanned: string | null; dep: string | null;
}
export interface VehicleTrip {
  key: string; line: string; destination: string; kind: string;
  stops: TripStop[]; path: [number, number][]; realtime: boolean;
}

let trips: VehicleTrip[] = [];
const subs = new Set<() => void>();
export function setVehicleTrips(t: VehicleTrip[]) { trips = t; subs.forEach((f) => f()); }
export const getVehicleTrips = () => trips;
export function subscribeVehicles(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

const KX = 111320 * Math.cos((48.78 * Math.PI) / 180), KY = 110540;
const t = (s: string | null) => (s ? Date.parse(s) : NaN);

interface Prepared { cum: number[]; at: number[]; times: { arr: number; dep: number; delay: number | null }[] }
const prepared = new WeakMap<VehicleTrip, Prepared>();

function prepare(trip: VehicleTrip): Prepared {
  const hit = prepared.get(trip);
  if (hit) return hit;
  const p = trip.path.length > 1 ? trip.path : trip.stops.map((s) => [s.lon, s.lat] as [number, number]);
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot((p[i][0] - p[i - 1][0]) * KX, (p[i][1] - p[i - 1][1]) * KY));
  // Halte auf den Verlauf projizieren (nächster Stützpunkt, Reihenfolge bleibt erhalten)
  const at: number[] = [];
  let from = 0;
  for (const s of trip.stops) {
    let best = from, bd = Infinity;
    for (let i = from; i < p.length; i++) {
      const d = Math.hypot((p[i][0] - s.lon) * KX, (p[i][1] - s.lat) * KY);
      if (d < bd) { bd = d; best = i; }
    }
    at.push(cum[best]);
    from = best;
  }
  // Ohne Ist-Zeit an einem Halt gilt die Verspätung des letzten Halts mit Ist-Zeit weiter
  let carry = 0;
  let known = false;
  const times = trip.stops.map((s) => {
    const ap = t(s.arrPlanned ?? s.depPlanned), dp = t(s.depPlanned ?? s.arrPlanned);
    const ae = t(s.arr), de = t(s.dep);
    if (!Number.isNaN(de)) { carry = de - dp; known = true; } else if (!Number.isNaN(ae)) { carry = ae - ap; known = true; }
    const arr = !Number.isNaN(ae) ? ae : ap + carry;
    const dep = !Number.isNaN(de) ? de : dp + carry;
    return { arr, dep: Math.max(dep, arr), delay: known ? Math.round(carry / 60000) : null };
  });
  const r = { cum, at, times };
  prepared.set(trip, r);
  return r;
}

function pointAt(path: [number, number][], cum: number[], d: number): [number, number] {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = path[i - 1], b = path[i];
  const seg = cum[i] - cum[i - 1];
  const f = seg > 0 ? Math.min(1, Math.max(0, (d - cum[i - 1]) / seg)) : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** Ein Punkt je Fahrzeug, das gerade unterwegs ist oder an einem Halt steht. */
export function vehiclePositions(list: VehicleTrip[], now = Date.now()): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const trip of list) {
    if (trip.stops.length < 2) continue;
    const { cum, at, times } = prepare(trip);
    const path = trip.path.length > 1 ? trip.path : trip.stops.map((s) => [s.lon, s.lat] as [number, number]);
    const n = times.length;
    if (now < times[0].dep - 60_000 || now > times[n - 1].arr) continue;
    let d = at[0], next = trip.stops[0].name, state = 'wartet an der Starthaltestelle';
    for (let i = 0; i < n; i++) {
      if (now < times[i].arr) {
        const prev = times[i - 1];
        const f = prev ? (now - prev.dep) / Math.max(1, times[i].arr - prev.dep) : 0;
        d = prev ? at[i - 1] + Math.min(1, Math.max(0, f)) * (at[i] - at[i - 1]) : at[i];
        next = trip.stops[i].name;
        state = `unterwegs nach ${next}`;
        break;
      }
      if (now <= times[i].dep) { d = at[i]; next = trip.stops[i + 1]?.name ?? trip.stops[i].name; state = `steht in ${trip.stops[i].name}`; break; }
    }
    const delay = times.reduce<number | null>((m, x) => (x.delay != null ? x.delay : m), null);
    const c = lineColors(trip.line, trip.kind);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pointAt(path, cum, d) },
      properties: {
        key: trip.key, line: trip.line, color: c.bg, fg: c.fg, rt: trip.realtime,
        text: `${trip.line} nach ${trip.destination}: ${state}${trip.realtime && delay != null ? (delay > 0 ? `, ${delay} min später als geplant` : ', pünktlich') : ', nach Fahrplan'}. Berechnete Position.`,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Linienverläufe der geladenen Fahrten, einmal je Linie und Richtung. */
export function vehiclePaths(list: VehicleTrip[]): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const trip of list) {
    const k = `${trip.line}>${trip.destination}`;
    if (seen.has(k) || trip.path.length < 2) continue;
    seen.add(k);
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: trip.path }, properties: { color: lineColors(trip.line, trip.kind).bg } });
  }
  return { type: 'FeatureCollection', features };
}
