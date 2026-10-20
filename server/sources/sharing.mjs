// Sharing-Angebote (GBFS 2.3) über MobiData BW. Jeder Feed wird höchstens so oft geholt,
// wie sein eigenes `ttl` erlaubt (mindestens 60 s).
import { cached, fetchJson } from '../cache.mjs';

const BASE = 'https://api.mobidata-bw.de/sharing/gbfs/v2';
// Stadtgebiet Stuttgart plus etwas Rand
export const BBOX = { minLon: 9.03, minLat: 48.68, maxLon: 9.32, maxLat: 48.87 };
const inBox = (lat, lon) => lon >= BBOX.minLon && lon <= BBOX.maxLon && lat >= BBOX.minLat && lat <= BBOX.maxLat;

const SYSTEMS = [
  { id: 'stadtmobil_stuttgart', name: 'stadtmobil', kind: 'car', stations: true },
  { id: 'flinkster_carsharing', name: 'Flinkster', kind: 'car', stations: true },
  { id: 'regiorad_stuttgart', name: 'RegioRad', kind: 'bike', stations: true },
  { id: 'callabike', name: 'Call a Bike', kind: 'bike', stations: true },
  { id: 'dott_stuttgart', name: 'Dott', kind: 'scooter', stations: false },
  { id: 'bolt_stuttgart', name: 'Bolt', kind: 'scooter', stations: false },
  { id: 'lime_bw', name: 'Lime', kind: 'scooter', stations: false },
];

async function feed(system, name) {
  const url = `${BASE}/${system}/${name}`;
  const { value } = await cached(`gbfs:${system}:${name}`, name.endsWith('information') ? 6 * 3600_000 : 60_000, async () => {
    const d = await fetchJson(url, { timeout: 25000 });
    return d;
  });
  return value;
}

async function loadSystem(sys) {
  const out = [];
  let types = {};
  try {
    const vt = await feed(sys.id, 'vehicle_types');
    for (const t of vt.data?.vehicle_types ?? []) types[t.vehicle_type_id] = t.form_factor;
  } catch { /* nicht alle Systeme liefern Fahrzeugtypen */ }

  if (sys.stations) {
    const [info, status] = await Promise.all([feed(sys.id, 'station_information'), feed(sys.id, 'station_status')]);
    const st = new Map((status.data?.stations ?? []).map((s) => [s.station_id, s]));
    for (const s of info.data?.stations ?? []) {
      if (!inBox(s.lat, s.lon)) continue;
      const live = st.get(s.station_id);
      out.push({
        id: `${sys.id}:${s.station_id}`,
        system: sys.name,
        kind: sys.kind,
        station: true,
        name: s.name,
        lat: +s.lat.toFixed(6),
        lon: +s.lon.toFixed(6),
        available: live?.num_bikes_available ?? 0,
        capacity: s.capacity ?? null,
        renting: live ? live.is_renting !== false : true,
      });
    }
  }
  try {
    const fb = await feed(sys.id, 'free_bike_status');
    for (const b of fb.data?.bikes ?? []) {
      if (b.station_id || !inBox(b.lat, b.lon) || b.is_disabled || b.is_reserved) continue;
      const ff = types[b.vehicle_type_id];
      const kind = ff === 'car' ? 'car' : ff === 'bicycle' ? 'bike' : ff ? (ff.includes('scooter') ? 'scooter' : sys.kind) : sys.kind;
      out.push({
        id: `${sys.id}:${b.bike_id}`,
        system: sys.name,
        kind,
        station: false,
        lat: +(+b.lat).toFixed(6),
        lon: +(+b.lon).toFixed(6),
        range: b.current_range_meters ?? null,
      });
    }
  } catch { /* Feed fehlt bei reinen Stationssystemen */ }
  return out;
}

export async function sharing() {
  const { value, at, fresh } = await cached('sharing', 60_000, async () => {
    const results = await Promise.allSettled(SYSTEMS.map(loadSystem));
    const items = [];
    const systems = [];
    results.forEach((r, i) => {
      const sys = SYSTEMS[i];
      if (r.status === 'fulfilled') {
        items.push(...r.value);
        systems.push({ id: sys.id, name: sys.name, kind: sys.kind, count: r.value.length, ok: true });
      } else {
        systems.push({ id: sys.id, name: sys.name, kind: sys.kind, count: 0, ok: false, error: String(r.reason?.message ?? r.reason) });
      }
    });
    return { items, systems };
  });
  return { ...value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Anbieter über MobiData BW (GBFS 2.3)' };
}
