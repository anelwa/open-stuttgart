// Alternativen bei Ausfall oder großer Verspätung: nächste Fahrt derselben Linie,
// Leihfahrzeuge und Nachbarhaltestellen in Gehweite.
import { Explain } from '../lib/info';
import { useMemo } from 'react';
import { useData } from '../lib/data';
import { distM, walkMin } from '../lib/geo';
import { useStops } from '../lib/stops';
import { fmtTime } from '../lib/format';
import type { Departure, Selection } from '../lib/types';
import { LineBadge } from './LineBadge';
import { Icon } from './Icon';

const KIND = { bike: 'Leihrad', scooter: 'E-Scooter', car: 'Carsharing' } as const;
const t = (d: Departure) => Date.parse(d.estimated ?? d.planned);

export function PlanB({ deps, here, stopName, now, select, flyTo }: {
  deps: Departure[]; here: [number, number]; stopName: string; now: number;
  select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void;
}) {
  const { sharing } = useData();
  const stops = useStops();
  // Betroffene Fahrten in den nächsten 30 Minuten
  const hit = deps.filter((d) => (d.cancelled || (d.delayMin ?? 0) > 10) && Date.parse(d.planned) < now + 30 * 60_000);
  const vehicles = useMemo(() => {
    if (!hit.length) return [];
    const best = new Map<string, { kind: keyof typeof KIND; dist: number; n: number; lngLat: [number, number] }>();
    for (const s of sharing.data?.items ?? []) {
      if (s.station && !s.available) continue;
      const dist = distM(here, [s.lon, s.lat]);
      if (dist > 300) continue;
      const b = best.get(s.kind);
      if (!b) best.set(s.kind, { kind: s.kind, dist, n: 1, lngLat: [s.lon, s.lat] });
      else { b.n += 1; if (dist < b.dist) { b.dist = dist; b.lngLat = [s.lon, s.lat]; } }
    }
    return [...best.values()].sort((a, b) => a.dist - b.dist);
  }, [hit.length, sharing.data, here]);
  const neighbours = useMemo(() => {
    if (!hit.length) return [];
    const seen = new Set<string>([stopName]);
    return stops
      .map((s) => ({ s, dist: distM(here, s.geometry.coordinates as [number, number]) }))
      .filter((x) => x.dist <= 500 && x.dist > 30)
      .sort((a, b) => a.dist - b.dist)
      .filter((x) => (seen.has(x.s.properties.name) ? false : (seen.add(x.s.properties.name), true)))
      .slice(0, 4);
  }, [hit.length, stops, here, stopName]);
  if (!hit.length) return null;

  return (
    <section className="section planb">
      <header className="section-head"><h3>Alternativen</h3><span className="section-aside">Schätzung<Explain id="planb" /></span></header>
      <ul className="planb-list">
        {hit.slice(0, 3).map((d, i) => {
          const next = deps.find((x) => x !== d && !x.cancelled && x.line === d.line && x.destination === d.destination && t(x) > Date.parse(d.planned));
          return (
            <li key={`${d.line}-${d.planned}-${i}`}>
              <LineBadge line={d.line} kind={d.kind} size="sm" />
              <span>
                {d.cancelled ? 'Fällt aus' : `+${d.delayMin} min`}: {fmtTime(d.planned)} Uhr Richtung {d.destination}.{' '}
                {next ? <>Nächste Fahrt derselben Linie {fmtTime(t(next))} Uhr{next.delayMin ? ` (+${next.delayMin})` : ''}.</> : 'Keine weitere Fahrt derselben Linie in der Auskunft.'}
              </span>
            </li>
          );
        })}
      </ul>
      {vehicles.length > 0 && (
        <ul className="near-list">
          {vehicles.map((v) => (
            <li key={v.kind}>
              <button type="button" onClick={() => flyTo(v.lngLat, 17)}>
                <span className="near-main">
                  <span className="near-name">{KIND[v.kind]}, {Math.round(v.dist)} m</span>
                  <span className="near-sub">{v.n} {v.n === 1 ? 'Fahrzeug oder Station' : 'Fahrzeuge oder Stationen'} im Umkreis von 300 m</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {neighbours.length > 0 && (
        <ul className="near-list">
          {neighbours.map(({ s, dist }) => {
            const c = s.geometry.coordinates as [number, number];
            return (
              <li key={s.properties.id}>
                <button type="button" onClick={() => { select({ type: 'stop', id: s.properties.id, name: s.properties.name, lngLat: c, lines: s.properties.lines }); flyTo(c, 16); }}>
                  <span className="near-main">
                    <span className="near-name">{s.properties.name}</span>
                    <span className="near-sub">{Math.round(dist)} m, etwa {walkMin(dist)} min Fußweg</span>
                    {s.properties.lines?.length > 0 && <span className="near-lines">{s.properties.lines.slice(0, 8).map((l) => <LineBadge key={l} line={l} size="sm" />)}</span>}
                  </span>
                  <Icon name="chevron" size={16} className="muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted small">Entfernungen in Luftlinie. Verfügbarkeit der Leihfahrzeuge laut Anbieterdaten, Stand der letzten Abfrage.</p>
    </section>
  );
}
