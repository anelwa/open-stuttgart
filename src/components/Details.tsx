import { useMemo, useState } from 'react';
import { usePolling, useNow } from '../lib/api';
import { useData } from '../lib/data';
import { AIR_COLOR, AIR_LABEL, ago, fmtDate, fmtNum, fmtTime, occupancy, openingHours, ubaHour } from '../lib/format';
import type { Departure, DeparturesResponse, Selection } from '../lib/types';
import { Icon } from './Icon';
import { LineBadge } from './LineBadge';
import { ErrorNote, LiveDot } from './ui';
import { Sparkline } from './Sparkline';
import { AroundStop, EventDetail, PlaceDetail } from './CultureDetails';
import { RainLine } from './Rain';
import { PlanB } from './PlanB';

type Close = { onClose: () => void };
type Nav = { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void };

export function SheetHead({ eyebrow, title, onClose, children, tone = 'ink' }: Close & { eyebrow: string; title: string; children?: React.ReactNode; tone?: string }) {
  return (
    <header className={`sheet-head tone-${tone}`}>
      <div className="sheet-head-top">
        <span className="eyebrow">{eyebrow}</span>
        <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Schließen"><Icon name="close" size={20} /></button>
      </div>
      <h2>{title}</h2>
      {children}
    </header>
  );
}

const KIND_LABEL: Record<string, string> = { sbahn: 'S-Bahn', stadtbahn: 'Stadtbahn', bus: 'Bus', zug: 'Züge', zahnrad: 'Zacke/Seilbahn', rufbus: 'Rufbus' };

function Countdown({ d, now }: { d: Departure; now: number }) {
  const t = Date.parse(d.estimated ?? d.planned);
  const min = Math.round((t - now) / 60000);
  if (d.cancelled) return <span className="dep-time cancelled">fällt aus</span>;
  return (
    <span className="dep-time">
      {min <= 0 ? <strong>jetzt</strong> : min < 60 ? <><strong>{min}</strong><small> min</small></> : <strong>{fmtTime(t)}</strong>}
    </span>
  );
}

export function StopDetail({ sel, onClose, select, flyTo }: Close & Nav & { sel: Extract<Selection, { type: 'stop' }> }) {
  const { data, error, loading, updatedAt, reload } = usePolling<DeparturesResponse>(`/api/departures?stop=${encodeURIComponent(sel.id)}`, 30_000);
  const now = useNow(10_000);
  const [filter, setFilter] = useState<string>('all');

  const deps = useMemo(() => (data?.departures ?? [])
    .filter((d) => Date.parse(d.estimated ?? d.planned) > now - 60_000)
    .sort((a, b) => Date.parse(a.estimated ?? a.planned) - Date.parse(b.estimated ?? b.planned)), [data, now]);
  const kinds = useMemo(() => {
    const order = ['sbahn', 'stadtbahn', 'zahnrad', 'bus', 'rufbus', 'zug'];
    return [...new Set(deps.map((d) => d.kind))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [deps]);
  const shown = deps.filter((d) => filter === 'all' || d.kind === filter).slice(0, 18);
  const lines = (sel.lines ?? []).filter((l) => /^(S\d+|U\d+|\d+|N\d+|X\d+)$/.test(l));

  return (
    <div className="sheet-inner">
      <SheetHead eyebrow="Haltestelle" title={data?.stop.name ?? sel.name} onClose={onClose}>
        {lines.length > 0 && (
          <div className="badge-row">{lines.slice(0, 12).map((l) => <LineBadge key={l} line={l} size="sm" />)}</div>
        )}
      </SheetHead>
      <div className="sheet-body">
        <RainLine lngLat={sel.lngLat} departures={deps} />
        <div className="dep-toolbar">
          <span className="live-label"><LiveDot stale={!!error} /> {updatedAt ? `Echtzeit, ${ago(updatedAt, now)}` : 'Lade Abfahrten …'}</span>
          {kinds.length > 1 && (
            <div className="seg small" role="tablist" aria-label="Verkehrsmittel filtern">
              <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Alle</button>
              {kinds.map((k) => (
                <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{KIND_LABEL[k] ?? k}</button>
              ))}
            </div>
          )}
        </div>
        {error && !data && <ErrorNote text={`Abfahrten nicht verfügbar: ${error}`} onRetry={reload} />}
        {loading && !data && (
          <ul className="dep-list">{Array.from({ length: 6 }, (_, i) => <li key={i} className="dep-row"><span className="skeleton" style={{ width: '100%', height: 22 }} /></li>)}</ul>
        )}
        {data && shown.length === 0 && <p className="muted">Keine bevorstehenden Abfahrten.</p>}
        <ul className="dep-list">
          {shown.map((d, i) => (
            <li key={`${d.line}-${d.planned}-${i}`} className={`dep-row ${d.cancelled ? 'is-cancelled' : ''}`}>
              <LineBadge line={d.line} kind={d.kind} />
              <span className="dep-dest">
                <span className="dest">{d.destination}</span>
                <span className="dep-sub">
                  {fmtTime(d.planned)}
                  {d.delayMin != null && d.delayMin > 0 && <span className={`delay ${d.delayMin >= 5 ? 'crit' : 'warn'}`}> +{d.delayMin}</span>}
                  {d.delayMin === 0 && d.realtime && <span className="ontime"> pünktlich</span>}
                  {d.platform && <span> · {/^\d+$/.test(d.platform) ? `${d.kind === 'sbahn' || d.kind === 'zug' ? 'Gleis' : 'Steig'} ${d.platform}` : d.platform}</span>}
                </span>
              </span>
              <Countdown d={d} now={now} />
            </li>
          ))}
        </ul>
        <PlanB deps={deps} here={sel.lngLat} stopName={data?.stop.name ?? sel.name} now={now} select={select} flyTo={flyTo} />
        <LineWorks lines={lines} select={select} flyTo={flyTo} />
        <AroundStop lngLat={sel.lngLat} select={select} flyTo={flyTo} />
        <p className="source"><Icon name="info" size={14} /> Abfahrten: EFA-BW (NVBW), dl-de/by-2-0. Abfrage höchstens alle 20 Sekunden.</p>
      </div>
    </div>
  );
}

/** Baustellen im Bau, die an Linien dieser Haltestelle liegen */
function LineWorks({ lines, select, flyTo }: Nav & { lines: string[] }) {
  const { roadworks } = useData();
  const hits = (roadworks.data?.items ?? []).filter((r) => r.status === 'active' && r.lines?.some((l) => lines.includes(l.line)));
  if (!hits.length) return null;
  return (
    <section className="section">
      <header className="section-head"><h3>Baustellen an diesen Linien</h3><span className="section-aside">{hits.length} im Bau</span></header>
      <ul className="near-list">
        {hits.slice(0, 6).map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => { select({ type: 'roadwork', id: r.id }); flyTo([r.lon, r.lat], 16); }}>
              <span className="near-main">
                <span className="near-name">{r.street}</span>
                <span className="near-lines">{r.lines.filter((l) => lines.includes(l.line)).map((l) => <LineBadge key={l.line} line={l.line} size="sm" />)}</span>
                {r.impact && <span className="near-sub">{r.impact.length > 90 ? `${r.impact.slice(0, 90)} …` : r.impact}</span>}
              </span>
              <Icon name="chevron" size={16} className="muted" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ParkingDetail({ id, onClose }: Close & { id: number }) {
  const { parking } = useData();
  const s = parking.data?.sites.find((p) => p.id === id);
  if (!s) return null;
  const occ = occupancy(s.free, s.capacity);
  const used = s.capacity && s.free != null ? 1 - s.free / s.capacity : null;
  const R: Record<string, string> = { DISABLED: 'Behindertenparkplätze', WOMEN: 'Frauenparkplätze', CHARGING: 'Ladeplätze', FAMILY: 'Familienparkplätze', CARSHARING: 'Carsharing' };
  return (
    <div className="sheet-inner">
      <SheetHead eyebrow="Parkhaus" title={s.name} onClose={onClose}>
        <p className="head-sub">{s.address}</p>
      </SheetHead>
      <div className="sheet-body">
        <div className="park-hero">
          <div className={`park-free occ-${occ}`}>
            <span className="num">{s.free ?? '–'}</span>
            <span className="lbl">{s.free != null ? 'Plätze frei' : 'keine Echtzeitdaten'}</span>
          </div>
          {used != null && (
            <div className="park-gauge">
              <div className="occ-bar big" aria-label={`${Math.round(used * 100)} Prozent belegt`}><span className={`occ-${occ}`} style={{ width: `${used * 100}%` }} /></div>
              <span className="muted small">{Math.round(used * 100)} % belegt von {fmtNum(s.capacity!)} Plätzen</span>
            </div>
          )}
        </div>
        <dl className="facts">
          {s.openingHours && <div><dt>Geöffnet</dt><dd>{openingHours(s.openingHours)}</dd></div>}
          {s.fee && <div><dt>Preise</dt><dd>{s.fee}</dd></div>}
          {s.maxHeight && <div><dt>Einfahrtshöhe</dt><dd>{(s.maxHeight / 100).toLocaleString('de-DE')} m</dd></div>}
          {s.restrictions.length > 0 && <div><dt>Besondere Plätze</dt><dd>{s.restrictions.map((r) => `${r.capacity} ${R[r.type] ?? r.type}`).join(', ')}</dd></div>}
          <div><dt>Betreiber</dt><dd>{s.operator}</dd></div>
          {s.updatedAt && <div><dt>Stand</dt><dd>{fmtTime(s.updatedAt)} Uhr</dd></div>}
        </dl>
        {s.url && <a className="link-btn" href={s.url} target="_blank" rel="noreferrer">Seite des Betreibers <Icon name="external" size={16} /></a>}
        <p className="source"><Icon name="info" size={14} /> Stadt Stuttgart, PBW über MobiData BW (ParkAPI).</p>
      </div>
    </div>
  );
}

export function RoadworkDetail({ id, onClose }: Close & { id: string }) {
  const { roadworks } = useData();
  const r = roadworks.data?.items.find((x) => x.id === id);
  if (!r) return null;
  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={r.status === 'active' ? 'Baustelle, im Bau' : 'Baustelle, geplant'} title={r.street} onClose={onClose} tone="amber">
        <p className="head-sub">{r.where}</p>
      </SheetHead>
      <div className="sheet-body">
        {r.from && r.to && (
          <div className="timeline">
            <div><span className="muted small">Beginn</span><strong>{fmtDate(r.from)}</strong></div>
            <div className="tl-line" aria-hidden><span style={{ width: `${Math.min(100, Math.max(0, ((Date.now() - Date.parse(r.from)) / (Date.parse(r.to) + 86400000 - Date.parse(r.from))) * 100))}%` }} /></div>
            <div><span className="muted small">Ende</span><strong>{fmtDate(r.to)}</strong></div>
          </div>
        )}
        {r.lines?.length > 0 && (
          <div className="rw-lines">
            <span className="muted small">Linien im Umkreis von 30 m</span>
            <div className="badge-row">{r.lines.map((l) => <LineBadge key={l.line} line={l.line} size="sm" />)}</div>
            <span className="muted small">Tunnelabschnitte sind nicht unterschieden; Auswirkungen auf den Betrieb laut Fahrplanauskunft prüfen.</span>
          </div>
        )}
        <dl className="facts">
          <div><dt>Arbeiten</dt><dd>{r.work}</dd></div>
          {r.impact && <div><dt>Auswirkung</dt><dd>{r.impact}</dd></div>}
          {r.timing && <div><dt>Zeitliche Regelung</dt><dd>{r.timing}</dd></div>}
        </dl>
        <p className="source"><Icon name="info" size={14} /> Landeshauptstadt Stuttgart, Tiefbauamt (Open Data).</p>
      </div>
    </div>
  );
}

export function AirDetail({ id, onClose }: Close & { id: string }) {
  const { air } = useData();
  const s = air.data?.stations.find((x) => x.id === id);
  if (!s) return null;
  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={`Luftmessstation · ${s.type}`} title={s.name} onClose={onClose}>
        <p className="head-sub">{s.code}{s.measuredAt ? `, Messstunde bis ${ubaHour(s.measuredAt)} Uhr` : ''}</p>
      </SheetHead>
      <div className="sheet-body">
        {s.index == null ? (
          <ErrorNote text="Für diese Station liegen aktuell keine Werte vor." />
        ) : (
          <>
            <div className="air-hero" style={{ ['--c' as string]: AIR_COLOR[s.index] }}>
              <span className="air-hero-dot" />
              <div><strong>{AIR_LABEL[s.index]}</strong><span className="muted small">Luftqualitätsindex des Umweltbundesamts</span></div>
            </div>
            <ul className="comp-list">
              {s.components.map((c) => (
                <li key={c.id}>
                  <span className="comp-name">{c.name}</span>
                  <span className="comp-bar"><span style={{ width: `${(c.index + 1) * 20}%`, background: AIR_COLOR[c.index] }} /></span>
                  <span className="comp-val">{c.value} <small>µg/m³</small></span>
                </li>
              ))}
            </ul>
            {s.history && s.history.length > 2 && (
              <div className="hist">
                <span className="muted small">Index der letzten {s.history.length} Stunden</span>
                <div className="hist-bars">
                  {s.history.map((h) => <span key={h.t} title={`${ubaHour(h.t)} Uhr: ${AIR_LABEL[h.index]}`} style={{ height: `${(h.index + 1) * 20}%`, background: AIR_COLOR[h.index] }} />)}
                </div>
              </div>
            )}
          </>
        )}
        <p className="source"><Icon name="info" size={14} /> Umweltbundesamt mit Daten der LUBW, dl-de/by-2-0.</p>
      </div>
    </div>
  );
}

export function WaterDetail({ onClose }: Close) {
  const { water } = useData();
  const w = water.data;
  if (!w) return null;
  return (
    <div className="sheet-inner">
      <SheetHead eyebrow="Pegel" title="Neckar in Bad Cannstatt" onClose={onClose}>
        <p className="head-sub">Cannstatt Schleuse UP, Stand {fmtTime(w.measuredAt)} Uhr</p>
      </SheetHead>
      <div className="sheet-body">
        <div className="water-card static">
          <span className="water-val">{w.value}<small> cm</small></span>
          <Sparkline values={w.series.map((s) => s.v)} width={300} height={70} color="var(--water)" label="Wasserstand der letzten 24 Stunden" />
          <span className="muted small">Verlauf der letzten 24 Stunden, {w.state === 'normal' ? 'normaler Wasserstand' : w.state}</span>
        </div>
        <p className="source"><Icon name="info" size={14} /> Wasserstraßen- und Schifffahrtsverwaltung des Bundes, PEGELONLINE.</p>
      </div>
    </div>
  );
}

export function SharingDetail({ id, onClose }: Close & { id: string }) {
  const { sharing } = useData();
  const s = sharing.data?.items.find((x) => x.id === id);
  if (!s) return null;
  const kind = { car: 'Carsharing', bike: 'Leihrad', scooter: 'E-Scooter' }[s.kind];
  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={`${kind} · ${s.system}`} title={s.name || `${kind} von ${s.system}`} onClose={onClose} />
      <div className="sheet-body">
        <dl className="facts">
          {s.station && <div><dt>Verfügbar</dt><dd><strong>{s.available}</strong>{s.capacity ? ` von ${s.capacity}` : ''}</dd></div>}
          {s.range != null && <div><dt>Reichweite</dt><dd>etwa {Math.round(s.range / 1000)} km</dd></div>}
          <div><dt>Anbieter</dt><dd>{s.system}</dd></div>
        </dl>
        <p className="source"><Icon name="info" size={14} /> Anbieterdaten über MobiData BW (GBFS).</p>
      </div>
    </div>
  );
}

export function DetailSheet({ sel, onClose, select, flyTo }: Close & Nav & { sel: Selection }) {
  switch (sel.type) {
    case 'stop': return <StopDetail key={sel.id} sel={sel} onClose={onClose} select={select} flyTo={flyTo} />;
    case 'event': return <EventDetail key={sel.id} id={sel.id} onClose={onClose} select={select} flyTo={flyTo} />;
    case 'place': return <PlaceDetail key={sel.id} id={sel.id} onClose={onClose} select={select} flyTo={flyTo} />;
    case 'parking': return <ParkingDetail id={sel.id} onClose={onClose} />;
    case 'roadwork': return <RoadworkDetail id={sel.id} onClose={onClose} />;
    case 'air': return <AirDetail id={sel.id} onClose={onClose} />;
    case 'water': return <WaterDetail onClose={onClose} />;
    case 'sharing': return <SharingDetail id={sel.id} onClose={onClose} />;
  }
}
