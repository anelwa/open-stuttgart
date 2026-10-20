// Fahrplanauskunft EFA-BW (NVBW), JSON-Schnittstelle. Echtzeit-Abfahrten und Haltestellensuche.
// Lizenz der Daten: Datenlizenz Deutschland – Namensnennung 2.0 (NVBW / MobiData BW).
import { cached, fetchJson } from '../cache.mjs';

const BASE = 'https://www.efa-bw.de/nvbw';

function productKind(p) {
  // EFA-Produktklassen: 0 Zug, 1 S-Bahn, 2 U-Bahn, 3 Stadtbahn, 4 Straßenbahn, 5 Stadtbus,
  // 6 Regionalbus, 7 Schnellbus, 8 Seil-/Zahnradbahn, 10 Rufbus, 13–16 Regional- und Fernzüge
  switch (p?.class) {
    case 0: case 13: case 14: case 15: case 16: return 'zug';
    case 1: return 'sbahn';
    case 2: case 3: case 4: return 'stadtbahn';
    case 8: return 'zahnrad';
    case 10: return 'rufbus';
    default: return 'bus';
  }
}

const berlin = (d, opts) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', ...opts }).format(d);

/** Abfahrten ab jetzt oder, mit `atIso`, ab einem späteren Zeitpunkt (z. B. Heimweg nach einer Veranstaltung). */
export async function departures(stopId, atIso) {
  if (!/^de:\d{5}:\d+$/.test(stopId)) throw Object.assign(new Error('Ungültige Haltestelle'), { status: 400 });
  let when = '';
  let key = `dm:${stopId}`;
  const at = atIso ? new Date(atIso) : null;
  if (at && !Number.isNaN(+at) && at - Date.now() > 10 * 60_000) {
    // auf 5 Minuten runden, damit sich Anfragen den Cache teilen
    const t = new Date(Math.floor(+at / 300_000) * 300_000);
    const date = berlin(t, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/-/g, '');
    const time = berlin(t, { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
    when = `&itdDate=${date}&itdTime=${time}&itdDateTimeDepArr=dep`;
    key += `@${date}${time}`;
  }
  const url = `${BASE}/XML_DM_REQUEST?outputFormat=rapidJSON&type_dm=stop&name_dm=${encodeURIComponent(stopId)}` +
    `&mode=direct&useRealtime=1&limit=40&useProxFootSearch=0&deleteAssignedStops_dm=1${when}`;
  const { value, at: fetchedAt, fresh } = await cached(key, when ? 5 * 60_000 : 20_000, async () => {
    const d = await fetchJson(url);
    const events = (d.stopEvents ?? []).map((e) => {
      const t = e.transportation ?? {};
      const planned = e.departureTimePlanned;
      const estimated = e.departureTimeEstimated ?? null;
      const delayMin = estimated ? Math.round((Date.parse(estimated) - Date.parse(planned)) / 60000) : null;
      const cancelled = (e.realtimeStatus ?? []).includes('TRIP_CANCELLED') || e.isCancelled === true;
      return {
        line: t.disassembledName ?? t.number ?? t.name,
        kind: productKind(t.product),
        destination: t.destination?.name ?? '',
        planned,
        estimated,
        delayMin,
        realtime: Boolean(e.isRealtimeControlled),
        cancelled,
        platform: e.location?.properties?.platformName ?? e.location?.disassembledName ?? null,
        notes: (e.hints ?? []).map((h) => h.content).filter(Boolean).slice(0, 2),
      };
    });
    const loc = d.locations?.[0];
    return {
      stop: { id: stopId, name: loc?.disassembledName ?? loc?.name ?? stopId, fullName: loc?.name },
      departures: events,
    };
  });
  return { ...value, fetchedAt: new Date(fetchedAt).toISOString(), fresh };
}

export async function searchStops(q) {
  const query = String(q ?? '').trim().slice(0, 60);
  if (query.length < 2) return { results: [] };
  const url = `${BASE}/XML_STOPFINDER_REQUEST?outputFormat=rapidJSON&type_sf=any&anyObjFilter_sf=2&name_sf=${encodeURIComponent('Stuttgart ' + query)}`;
  const { value } = await cached(`sf:${query.toLowerCase()}`, 6 * 3600_000, async () => {
    const d = await fetchJson(url);
    return (d.locations ?? [])
      .filter((l) => l.type === 'stop' && /^de:\d{5}:\d+$/.test(l.id ?? ''))
      .slice(0, 8)
      .map((l) => ({ id: l.id, name: l.disassembledName ?? l.name, place: l.parent?.name ?? '', coord: l.coord }));
  });
  return { results: value };
}
