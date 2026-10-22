import { useEffect, useMemo, useState } from 'react';
import { usePolling, useNow } from '../lib/api';
import { useData } from '../lib/data';
import { AIR_COLOR, AIR_LABEL, ago, fmtDate, fmtNum, fmtTime, occupancy, openingHours, ubaHour } from '../lib/format';
import type { Departure, DeparturesResponse, Selection } from '../lib/types';
import { Icon } from './Icon';
import { LineBadge } from './LineBadge';
import { ErrorNote, LiveDot, DetailFallback } from './ui';
import { Sparkline } from './Sparkline';
import { AroundStop, EventDetail, PlaceDetail } from './CultureDetails';
import { RainLine } from './Rain';
import { PlanB } from './PlanB';
import { FacilityDetail } from './FacilityDetail';
import { GebaeudeDetail, LeistungDetail } from './VerwaltungDetail';
import { WissenDetail } from './WissenDetail';
import { Explain } from '../lib/info';
import { setVehicleTrips, type VehicleTrip } from '../lib/vehicles';

type Close = { onClose: () => void };
type Nav = { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void };

export function SheetHead({ eyebrow, title, onClose, children, tone = 'ink' }: Close & { eyebrow: string; title: string; children?: React.ReactNode; tone?: string }) {
  return (
    <header className={`sheet-head tone-${tone}`}>
      <div className="sheet-head-top">
        <span className="eyebrow">{eyebrow}</span>
        <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Schließen"><Icon name="close" size={20} /></button>
      </div>
      <h2 id="detail-title">{title}</h2>
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
          <span className="live-label"><LiveDot stale={!!error || data?.realtimeAvailable === false} /> {updatedAt ? `${data?.realtimeAvailable === false ? (data.ersatzEchtzeit ? 'Echtzeit (Ersatzquelle)' : 'Fahrplan') : 'Echtzeit'}, ${ago(updatedAt, now)}` : 'Lade Abfahrten …'}</span>
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
        {data?.realtimeAvailable === false && (
          <p className="notice small">{data.ersatzEchtzeit
            ? `Die Fahrplanauskunft EFA-BW liefert derzeit keine Echtzeitdaten. Verspätungen für ${data.ersatzEchtzeit} Abfahrten stammen ersatzweise aus dem landesweiten Echtzeitfeed (NVBW über gtfs.de, CC BY-SA 4.0); übrige Zeiten nach Fahrplan.`
            : 'Für diese Haltestelle liegen derzeit keine Echtzeitdaten vor. Angezeigt werden Fahrplanzeiten.'}</p>
        )}
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
        <StopBikeAndRide stopId={sel.id} lngLat={sel.lngLat} />
        <StopVehicles stopId={sel.id} />
        <PlanB deps={deps} here={sel.lngLat} stopName={data?.stop.name ?? sel.name} now={now} select={select} flyTo={flyTo} />
        <LineWorks lines={lines} select={select} flyTo={flyTo} />
        <AroundStop lngLat={sel.lngLat} select={select} flyTo={flyTo} />
        <p className="source"><Icon name="info" size={14} /> Abfahrten: EFA-BW (NVBW), dl-de/by-2-0. Abfrage höchstens alle 20 Sekunden.</p>
      </div>
    </div>
  );
}

type BikeBoxSite = {
  id: string | number; name: string; address: string; beschreibung?: string | null; purpose?: string;
  capacity: number | null; free: number | null; live: boolean; bookableUrl: string | null; photoUrl?: string | null;
  fee: string | null; dist?: number | null;
};

/** Bike+Ride-Fahrradboxen und Gepäck-/Helmschließfächer an oder unmittelbar neben dieser Haltestelle (MobiData BW ParkAPI v3 / WFS) */
function StopBikeAndRide({ stopId, lngLat }: { stopId: string; lngLat: [number, number] }) {
  const [lon, lat] = lngLat;
  const { data } = usePolling<{ sites: BikeBoxSite[] }>(`/api/bikeandride?stop=${encodeURIComponent(stopId)}&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, 120_000);
  const sites = data?.sites ?? [];
  if (!sites.length) return null;
  const boxes = sites.filter((s) => s.purpose !== 'ITEM');
  const lockers = sites.filter((s) => s.purpose === 'ITEM');
  const freiSumme = (list: BikeBoxSite[]) => {
    const live = list.filter((s) => s.free != null);
    return live.length ? live.reduce((a, s) => a + (s.free ?? 0), 0) : null;
  };
  const capSumme = (list: BikeBoxSite[]) => list.reduce((a, s) => a + (s.capacity ?? 0), 0);
  const freiBoxes = freiSumme(boxes);
  const freiLockers = freiSumme(lockers);
  return (
    <section className="section">
      <header className="section-head"><h3>Bike+Ride an dieser Haltestelle</h3><Explain id="bikeride" /></header>
      <p className="muted small">
        Bike+Ride am Gleis:{' '}
        {freiBoxes != null ? `noch ${freiBoxes} von ${capSumme(boxes)} Boxen frei` : `${capSumme(boxes)} Stellplätze`}
        {freiLockers != null ? ` · ${freiLockers} Schließfächer frei` : ''}
      </p>
      <ul className="near-list">
        {sites.slice(0, 4).map((s) => (
          <li key={s.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              {s.photoUrl && <img src={s.photoUrl} alt="" loading="lazy" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8 }} />}
              <span className="near-main">
                <span className="near-name">{s.name}</span>
                <span className="near-sub">
                  {s.purpose === 'ITEM' ? 'Schließfach' : 'Fahrradbox'}:{' '}
                  {s.free != null && s.capacity != null
                    ? <><strong>{s.free}</strong> von {s.capacity} frei</>
                    : s.capacity != null ? `${s.capacity} Stellplätze` : 'Bike+Ride-Anlage'}
                  {s.dist != null && s.dist > 30 ? ` · ${s.dist} m` : ''}
                  {s.fee ? ` · ${s.fee}` : ''}
                </span>
                {s.beschreibung && <span className="near-sub">{s.beschreibung.length > 90 ? `${s.beschreibung.slice(0, 90)} …` : s.beschreibung}</span>}
              </span>
              {s.bookableUrl && (
                <a className="chip" href={s.bookableUrl} target="_blank" rel="noreferrer">
                  Buchen <Icon name="external" size={14} />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Fahrzeuge, die diese Haltestelle anfahren, als berechnete Position auf der Karte */
function StopVehicles({ stopId }: { stopId: string }) {
  const [on, setOn] = useState(false);
  const { data, error, loading } = usePolling<{ available: boolean; trips: VehicleTrip[]; realtimeAvailable?: boolean | null; hinweis: string }>(on ? `/api/vehicles?stop=${encodeURIComponent(stopId)}` : null, 30_000);
  useEffect(() => { setVehicleTrips(on && data?.trips ? data.trips : []); }, [on, data]);
  useEffect(() => () => setVehicleTrips([]), [stopId]);
  return (
    <section className="section">
      <header className="section-head"><h3>Fahrzeuge auf dem Weg hierher</h3><Explain id="fahrzeuge" /></header>
      <button type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setOn((v) => !v)}>
        {on ? 'Fahrzeuge ausblenden' : 'Auf der Karte zeigen'}
      </button>
      {on && loading && !data && <p className="muted small">Lade Fahrtverläufe …</p>}
      {on && error && !data && <p className="muted small">Fahrtverläufe gerade nicht verfügbar.</p>}
      {on && data && (
        <p className="muted small">
          {data.trips.length ? `${data.trips.length} ${data.trips.length === 1 ? 'Fahrt' : 'Fahrten'} der nächsten 30 Minuten. ` : 'Keine Fahrt in den nächsten 30 Minuten. '}
          {data.realtimeAvailable === false ? 'Ohne Echtzeitdaten, Positionen nach Fahrplan. ' : ''}
          {data.hinweis}
        </p>
      )}
    </section>
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
  if (!s) return (
    <DetailFallback title="Parkhaus" onClose={onClose} onRetry={parking.error ? parking.reload : undefined}
      text={parking.loading ? 'Die Parkdaten werden geladen …' : parking.error ? 'Die Parkdaten sind derzeit nicht abrufbar.' : 'Dieses Parkhaus ist nicht mehr in der Liste enthalten.'} />
  );
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
  if (!r) return (
    <DetailFallback title="Baustelle" onClose={onClose} onRetry={roadworks.error ? roadworks.reload : undefined}
      text={roadworks.loading ? 'Die Baustellendaten werden geladen …' : roadworks.error ? 'Die Baustellendaten sind derzeit nicht abrufbar.' : 'Diese Baustelle ist nicht mehr in der Liste enthalten.'} />
  );
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
  if (!s) return (
    <DetailFallback title="Luftmessstation" onClose={onClose} onRetry={air.error ? air.reload : undefined}
      text={air.loading ? 'Die Luftmesswerte werden geladen …' : air.error ? 'Die Luftmesswerte sind derzeit nicht abrufbar.' : 'Diese Messstation ist nicht mehr in der Liste enthalten.'} />
  );
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
  if (!w) return (
    <DetailFallback title="Neckarpegel" onClose={onClose} onRetry={water.error ? water.reload : undefined}
      text={water.loading ? 'Der Pegelstand wird geladen …' : water.error ? 'Der Pegelstand ist derzeit nicht abrufbar.' : 'Für den Neckarpegel liegen keine Werte vor.'} />
  );
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
  if (!s) return (
    <DetailFallback title="Sharing-Fahrzeug" onClose={onClose} onRetry={sharing.error ? sharing.reload : undefined}
      text={sharing.loading ? 'Die Sharing-Daten werden geladen …' : sharing.error ? 'Die Sharing-Daten sind derzeit nicht abrufbar.' : 'Dieses Fahrzeug ist nicht mehr verfügbar.'} />
  );
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
    case 'facility': return <FacilityDetail key={sel.item.id} f={sel.item} onClose={onClose} select={select} flyTo={flyTo} />;
    case 'place': return <PlaceDetail key={sel.id} id={sel.id} onClose={onClose} select={select} flyTo={flyTo} />;
    case 'parking': return <ParkingDetail id={sel.id} onClose={onClose} />;
    case 'roadwork': return <RoadworkDetail id={sel.id} onClose={onClose} />;
    case 'air': return <AirDetail id={sel.id} onClose={onClose} />;
    case 'water': return <WaterDetail onClose={onClose} />;
    case 'sharing': return <SharingDetail id={sel.id} onClose={onClose} />;
    case 'verwaltung_gebaeude': return <GebaeudeDetail key={sel.id} id={sel.id} onClose={onClose} select={select} flyTo={flyTo} />;
    case 'verwaltung_leistung': return <LeistungDetail key={sel.url} url={sel.url} lat={sel.lat} lon={sel.lon} onClose={onClose} select={select} flyTo={flyTo} />;
    case 'wissen': return <WissenDetail key={`${sel.layer}-${sel.id}`} sel={sel} onClose={onClose} />;
  }
}
