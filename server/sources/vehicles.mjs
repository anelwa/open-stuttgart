// Berechnete Fahrzeugpositionen aus Fahrplan und Echtzeitprognosen (EFA-BW, Fahrtverlauf mit Gleisverlauf).
// Offene GPS-Positionen der SSB-Fahrzeuge gibt es nicht. Die Position wird im Browser zwischen zwei Halten
// entlang des Linienverlaufs interpoliert. Umleitungen und Ersatzverkehr bildet die Rechnung nicht ab.
// Lizenz: Datenlizenz Deutschland – Namensnennung 2.0 (NVBW / MobiData BW).
import { cached, fetchJson } from '../cache.mjs';
import { departures } from './efa.mjs';

const BASE = 'https://www.efa-bw.de/nvbw';
const berlin = (d, opts) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', ...opts }).format(d);
const MAX_TRIPS = 6;

/** Fahrtverlauf einer Fahrt: alle Halte mit Soll- und Ist-Zeiten und der Linienverlauf. */
export async function trip({ line, stop, tripCode, planned }) {
  if (!line || !/^\d+$/.test(String(stop ?? '')) || !/^\d+$/.test(String(tripCode ?? '')) || Number.isNaN(Date.parse(planned)))
    throw Object.assign(new Error('Ungültige Fahrt'), { status: 400 });
  const t = new Date(planned);
  const date = berlin(t, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/-/g, '');
  const time = berlin(t, { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
  const url = `${BASE}/XML_STOPSEQCOORD_REQUEST?outputFormat=rapidJSON&line=${encodeURIComponent(line)}&stop=${stop}` +
    `&tripCode=${tripCode}&date=${date}&time=${time}&coordOutputFormat=WGS84%5Bdd.ddddd%5D&useRealtime=1&tStOTType=ALL`;
  const { value } = await cached(`trip:${line}:${tripCode}:${date}`, 30_000, async () => {
    const d = await fetchJson(url);
    const leg = d.leg ?? {};
    const tr = leg.transportation ?? {};
    const stops = (leg.stopSequence ?? []).map((s) => ({
      id: s.parent?.id ?? s.id,
      name: s.disassembledName ?? s.parent?.disassembledName ?? s.name,
      lat: s.coord?.[0], lon: s.coord?.[1],
      arrPlanned: s.arrivalTimePlanned ?? null,
      arr: s.arrivalTimeEstimated ?? null,
      depPlanned: s.departureTimePlanned ?? null,
      dep: s.departureTimeEstimated ?? null,
    })).filter((s) => s.lat && s.lon);
    return {
      line: tr.disassembledName ?? tr.number ?? tr.name ?? '',
      destination: tr.destination?.name ?? '',
      product: tr.product?.class ?? null,
      stops,
      // Linienverlauf als [lon, lat] für die Karte
      path: (leg.coords ?? []).map(([la, lo]) => [lo, la]),
      realtime: stops.some((s) => s.arr || s.dep),
    };
  });
  return value;
}

/**
 * Fahrzeuge, die eine Haltestelle in den nächsten 30 Minuten anfahren, jeweils mit Fahrtverlauf.
 * Kostet 1 + n Anfragen bei EFA-BW (n höchstens 6); Ergebnisse 30 Sekunden zwischengespeichert.
 */
export async function approaching(stopId) {
  if (process.env.OS_VEHICLES === '0') return { available: false, trips: [] };
  const dm = await departures(stopId);
  const now = Date.now();
  const picks = [];
  const seen = new Set();
  for (const d of dm.departures) {
    if (!d.trip || d.cancelled || d.kind === 'zug' || d.kind === 'rufbus') continue;
    const t = Date.parse(d.estimated ?? d.planned);
    if (t - now > 30 * 60_000) break;
    const k = `${d.trip.line}:${d.trip.tripCode}`;
    if (seen.has(k)) continue;
    seen.add(k);
    picks.push(d);
    if (picks.length >= MAX_TRIPS) break;
  }
  const trips = [];
  for (const d of picks) {
    try {
      const tr = await trip(d.trip);
      trips.push({ ...tr, line: tr.line || d.line, destination: d.destination || tr.destination, kind: d.kind, key: `${d.trip.line}:${d.trip.tripCode}` });
    } catch { /* eine fehlende Fahrt verhindert die übrigen nicht */ }
  }
  return {
    available: true,
    stop: dm.stop,
    realtimeAvailable: dm.realtimeAvailable,
    trips,
    hinweis: 'Positionen sind aus Fahrplan und Echtzeitprognosen berechnet, keine GPS-Daten der Fahrzeuge. Abweichungen von einigen hundert Metern sind möglich. Umleitungen und Ersatzverkehr bildet die Berechnung nicht ab.',
    quelle: 'Fahrplan- und Echtzeitdaten: EFA-BW (NVBW, MobiData BW), Datenlizenz Deutschland – Namensnennung 2.0',
  };
}
