// Parkhäuser Stuttgart über die ParkAPI von MobiData BW (Quelle stuttgart_carparks, Stadt Stuttgart / PBW).
// Nur Live-Abfrage für die Anzeige, kein Massenabruf: ein Request pro Minute für alle Nutzer zusammen.
import { cached, fetchJson } from '../cache.mjs';

const URL_SITES = 'https://api.mobidata-bw.de/park-api/api/public/v3/parking-sites?source_uid=stuttgart_carparks&limit=200';

export async function parking() {
  const { value, at, fresh } = await cached('parking', 60_000, async () => {
    const d = await fetchJson(URL_SITES);
    return (d.items ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address ?? '',
      operator: s.operator_name ?? '',
      type: s.type,
      lat: s.lat,
      lon: s.lon,
      capacity: s.realtime_capacity ?? s.capacity ?? null,
      free: s.has_realtime_data ? s.realtime_free_capacity ?? null : null,
      live: Boolean(s.has_realtime_data),
      status: s.realtime_opening_status ?? null,
      updatedAt: s.realtime_data_updated_at ?? null,
      fee: s.fee_description ?? null,
      maxHeight: s.max_height ?? null,
      openingHours: s.opening_hours ?? null,
      url: s.public_url ?? null,
      restrictions: (s.restrictions ?? []).map((r) => ({ type: r.type, capacity: r.capacity })),
    }));
  });
  return { sites: value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Stadt Stuttgart / PBW über MobiData BW (ParkAPI)' };
}
