// Detailansichten für Veranstaltungen und Sehenswürdigkeiten, dazu die Bausteine, die Kultur mit
// Nahverkehr, Parken und Wetter verbinden: Hinkommen, Heimweg nach dem Ende, Wetter zur Beginnzeit, Umgebung.
import { useMemo, useState } from 'react';
import { usePolling, useNow } from '../lib/api';
import { useData } from '../lib/data';
import { useStops } from '../lib/stops';
import { nearestStops, walkMin, within } from '../lib/geo';
import { berlinDate, fmtDay, fmtDec, fmtTime, occupancy, WEATHER_LABEL } from '../lib/format';
import { fernsicht, isRainy, weatherAt } from '../lib/weather';
import type { CultureEvent, DeparturesResponse, Place, Selection, WikiSummary } from '../lib/types';
import { EVENT_GROUPS, eventGroup, PLACE_KINDS } from '../modules/culture/kinds';
import { Icon, weatherIconName } from './Icon';
import { RouteButtons } from './RouteButtons';
import { LineBadge } from './LineBadge';
import { SheetHead } from './Details';
import { Section, Source } from './ui';

type Nav = { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void };
type Close = { onClose: () => void };

const railLines = (lines: string[]) => lines.filter((l) => /^(S\d+|U\d+|\d+|N\d+|X\d+)$/.test(l));

/** Termin-Zeitraum lesbar: "19:30–22:00 Uhr", "ab 19:30 Uhr" oder "ganztägig" */
export function eventTime(e: CultureEvent) {
  if (e.noTime) return 'Uhrzeit laut Veranstalter';
  if (e.allDay || !e.start) return 'ganztägig';
  if (e.times && e.times.length > 1) return `${e.times.length} Termine, ${fmtTime(e.times[0])} bis ${fmtTime(e.times[e.times.length - 1])} Uhr`;
  return e.end && Date.parse(e.end) > Date.parse(e.start) ? `${fmtTime(e.start)}–${fmtTime(e.end)} Uhr` : `ab ${fmtTime(e.start)} Uhr`;
}

/** Ende eines Termins; ohne Angabe 2,5 Stunden nach Beginn (gekennzeichnet als Schätzung) */
function eventEnd(e: CultureEvent): { t: number; estimated: boolean } | null {
  if (e.allDay || !e.start) return null;
  const s = Date.parse(e.times?.[e.times.length - 1] ?? e.start);
  if (e.times && e.times.length > 1) return { t: s + 60 * 60_000, estimated: true };
  if (e.end && !e.endEstimated && Date.parse(e.end) > s && Date.parse(e.end) - s < 12 * 3600_000) return { t: Date.parse(e.end), estimated: false };
  return { t: s + 150 * 60_000, estimated: true };
}

export function GettingThere({ lngLat, select, flyTo, exclude, label }: Nav & { lngLat: [number, number]; exclude?: string; label?: string }) {
  const stops = useStops();
  const { parking } = useData();
  const [lon, lat] = lngLat;
  const near = useMemo(() => nearestStops(stops, [lon, lat]).filter((n) => n.stop.properties.id !== exclude), [stops, lon, lat, exclude]);
  const parks = useMemo(() => within((parking.data?.sites ?? []).filter((p) => p.free != null), [lon, lat], 900).slice(0, 2), [parking.data, lon, lat]);
  if (!stops.length) return null;
  return (
    <Section title="Anreise">
      <RouteButtons to={{ lat, lon, label: label ?? 'Ziel' }} />
      {near.length === 0 && <p className="muted small">Keine Haltestelle im Umkreis von 1,5 km.</p>}
      <ul className="near-list">
        {near.map(({ stop, walk }) => {
          const c = stop.geometry.coordinates as [number, number];
          const lines = railLines(stop.properties.lines);
          return (
            <li key={stop.properties.id}>
              <button type="button" onClick={() => { select({ type: 'stop', id: stop.properties.id, name: stop.properties.name, lngLat: c, lines: stop.properties.lines }); flyTo(c, 15.5); }}>
                <span className="walk"><Icon name="walk" size={16} /><strong>{walk}</strong><small>min</small></span>
                <span className="near-main">
                  <span className="near-name">{stop.properties.name}</span>
                  <span className="near-lines">{lines.slice(0, 7).map((l) => <LineBadge key={l} line={l} size="sm" />)}</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          );
        })}
        {parks.map(({ item: p, dist }) => (
          <li key={p.id}>
            <button type="button" onClick={() => { select({ type: 'parking', id: p.id }); flyTo([p.lon, p.lat], 15.5); }}>
              <span className="walk"><Icon name="walk" size={16} /><strong>{walkMin(dist)}</strong><small>min</small></span>
              <span className="near-main">
                <span className="near-name">{p.name}</span>
                <span className="near-sub"><span className={`occ-dot occ-${occupancy(p.free, p.capacity)}`} /> {p.free} freie Stellplätze (aktuell)</span>
              </span>
              <Icon name="chevron" size={16} className="muted" />
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Abfahrten ab der Haltestelle am Veranstaltungsort, nach dem (geschätzten) Ende */
function WayHome({ e }: { e: CultureEvent }) {
  const stops = useStops();
  const end = eventEnd(e);
  const stop = useMemo(() => (e.lon != null ? nearestStops(stops, [e.lon, e.lat!], 1)[0] : undefined), [stops, e.lon, e.lat]);
  const show = !!end && !!stop && end.t > Date.now() && end.t - Date.now() < 30 * 3600_000;
  const url = show ? `/api/departures?stop=${encodeURIComponent(stop!.stop.properties.id)}&at=${new Date(end!.t - 5 * 60_000).toISOString()}` : null;
  const { data, error } = usePolling<DeparturesResponse>(url, 10 * 60_000);
  if (!show) return null;
  const deps = (data?.departures ?? [])
    .filter((d) => Date.parse(d.estimated ?? d.planned) >= end!.t + stop!.walk * 60_000 - 60_000)
    .sort((a, b) => Date.parse(a.planned) - Date.parse(b.planned));
  // je Linie und Richtung nur die erste Fahrt
  const seen = new Set<string>();
  const first = deps.filter((d) => { const k = `${d.line}|${d.destination}`; return seen.has(k) ? false : (seen.add(k), true); }).slice(0, 6);
  const late = new Date(end!.t).getHours() >= 23 || new Date(end!.t).getHours() < 4;
  return (
    <Section title="Rückfahrt" aside={`Ende ${end!.estimated ? 'ca. ' : ''}${fmtTime(end!.t)} Uhr${end!.estimated ? ' (geschätzt)' : ''}`}>
      <p className="muted small home-intro">
        Erste Abfahrten je Linie und Richtung ab <strong>{stop!.stop.properties.name}</strong>, Fußweg {stop!.walk} min eingerechnet.
      </p>
      {error && !data && <p className="muted small">Fahrplanauskunft derzeit nicht erreichbar.</p>}
      {!data && !error && <span className="skeleton block" style={{ height: 80 }} />}
      {data && first.length === 0 && <p className="muted small">Für diesen Zeitraum liegen keine Abfahrten vor.</p>}
      <ul className="home-list">
        {first.map((d, i) => (
          <li key={`${d.line}-${d.planned}-${i}`}>
            <LineBadge line={d.line} kind={d.kind} size="sm" />
            <span className="dest">{d.destination}</span>
            <strong>{fmtTime(d.planned)}</strong>
          </li>
        ))}
      </ul>
      {late && <p className="note"><Icon name="moon" size={16} /> Spätes Veranstaltungsende: Nachtverkehr bitte in der Fahrplanauskunft des VVS prüfen.</p>}
    </Section>
  );
}

function WeatherAt({ iso, outdoorish }: { iso: string; outdoorish?: boolean }) {
  const { weather } = useData();
  const h = weatherAt(weather.data, iso);
  if (!h) return null;
  const rain = isRainy(h);
  return (
    <div className={`wx-at ${rain ? 'rain' : ''}`}>
      <Icon name={rain ? 'umbrella' : weatherIconName(h.icon)} size={22} />
      <div>
        <strong>{fmtTime(iso)} Uhr: {fmtDec(h.temperature, 0)} °C, {WEATHER_LABEL[h.icon] ?? 'wechselhaft'}</strong>
        <span className="small">{rain ? `Niederschlag erwartet (${fmtDec(h.precipitation)} mm/h)${outdoorish ? ', Veranstaltung ggf. im Freien' : ''}.` : 'Kein Niederschlag erwartet.'}</span>
      </div>
    </div>
  );
}

function NearbyPlaces({ lngLat, select, flyTo, skip }: Nav & { lngLat: [number, number]; skip?: string }) {
  const { places } = useData();
  const list = within(places.data?.places ?? [], lngLat, 600).filter((x) => x.item.id !== skip).sort((a, b) => b.item.rank - a.item.rank).slice(0, 4);
  if (!list.length) return null;
  return (
    <Section title="Sehenswürdigkeiten in der Umgebung">
      <ul className="thumb-list">
        {list.map(({ item: p, dist }) => (
          <li key={p.id}><PlaceRow p={p} meta={`${walkMin(dist)} min Fußweg`} onClick={() => { select({ type: 'place', id: p.id }); flyTo([p.lon, p.lat], 16); }} /></li>
        ))}
      </ul>
    </Section>
  );
}

function NearbyEvents({ lngLat, select, flyTo, skip, title = 'Veranstaltungen heute in der Umgebung', maxM = 600 }: Nav & { lngLat: [number, number]; skip?: string; title?: string; maxM?: number }) {
  const { events } = useData();
  const now = useNow(60_000);
  if (!events.data || events.data.date !== berlinDate(now)) return null;
  const list = within(events.data.events, lngLat, maxM)
    .filter((x) => x.item.id !== skip && (x.item.allDay || !x.item.start || (eventEnd(x.item)?.t ?? 0) > now))
    .sort((a, b) => (a.item.allDay ? 1 : 0) - (b.item.allDay ? 1 : 0) || Date.parse(a.item.start ?? '') - Date.parse(b.item.start ?? ''))
    .slice(0, 5);
  if (!list.length) return null;
  return (
    <Section title={title}>
      <ul className="event-list compact">
        {list.map(({ item: e }) => (
          <li key={e.id}><EventRow e={e} onClick={() => { select({ type: 'event', id: e.id }); if (e.lon != null) flyTo([e.lon, e.lat!], 15.5); }} /></li>
        ))}
      </ul>
    </Section>
  );
}

export function EventRow({ e, onClick, meta }: { e: CultureEvent; onClick: () => void; meta?: string }) {
  const now = Date.now();
  const running = !e.allDay && e.start && Date.parse(e.start) <= now && (eventEnd(e)?.t ?? 0) > now;
  return (
    <button type="button" className="event-row" onClick={onClick}>
      <span className={`ev-time ${e.allDay || !e.start ? 'allday' : ''}`}>
        {e.allDay || !e.start ? <Icon name="calendar" size={18} /> : <strong>{fmtTime(e.start)}</strong>}
        {running && <small>läuft</small>}
      </span>
      <span className="ev-main">
        <span className="ev-title">{e.status && <span className="ev-status">{e.status === 'abgesagt' ? 'Abgesagt' : 'Verschoben'}: </span>}{e.title}</span>
        <span className="ev-sub">
          {e.ready ? (e.venue || e.location?.split(',')[0] || 'Ort wird ermittelt') : <span className="skeleton" style={{ width: 110 }} />}
          {meta && <> · {meta}</>}
        </span>
      </span>
      {e.ready && <span className="ev-tag">{EVENT_GROUPS[eventGroup(e)]}</span>}
    </button>
  );
}

/** Vorschaubild mit Symbol als Ersatz, falls Commons das Bild nicht liefert */
export function Thumb({ src, icon, size = 22 }: { src?: string | null; icon: string; size?: number }) {
  const [ok, setOk] = useState(true);
  return src && ok ? <img src={src} alt="" loading="lazy" onError={() => setOk(false)} /> : <Icon name={icon} size={size} />;
}

export function PlaceRow({ p, onClick, meta }: { p: Place; onClick: () => void; meta?: string }) {
  const k = PLACE_KINDS[p.kind];
  return (
    <button type="button" className="place-row" onClick={onClick}>
      <span className="thumb" style={{ ['--k' as string]: k.color }}>
        <Thumb src={p.image?.replace('width=640', 'width=160')} icon={k.icon} />
      </span>
      <span className="ev-main">
        <span className="ev-title">{p.name}</span>
        <span className="ev-sub">{meta ?? p.description ?? k.label}</span>
      </span>
    </button>
  );
}

export function EventDetail({ id, onClose, select, flyTo }: Close & Nav & { id: string }) {
  const { events } = useData();
  const e = events.data?.events.find((x) => x.id === id);
  if (!e) return null;
  const lngLat: [number, number] | null = e.lon != null ? [e.lon, e.lat!] : null;
  const group = eventGroup(e);
  const same = (events.data?.events ?? []).filter((x) => x.id !== e.id && x.lat === e.lat && x.lon === e.lon && x.lat != null);
  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={[EVENT_GROUPS[group], e.district].filter(Boolean).join(' · ')} title={e.title} onClose={onClose} tone="amber">
        <p className="head-sub"><strong>{fmtDay(e.start ?? `${e.date}T12:00:00`)}</strong>, {eventTime(e)}</p>
      </SheetHead>
      <div className="sheet-body">
        <div className="where">
          <Icon name="pin" size={20} />
          <div>
            <strong>{e.venue || e.location?.split(',')[0] || 'Ort wird ermittelt'}</strong>
            {e.location && e.location !== e.venue && <span className="small muted">{e.location}</span>}
            {e.approx && <span className="small warn-text">Lage näherungsweise (Postleitzahlgebiet)</span>}
            {e.ready && !lngLat && <span className="small warn-text">Adresse konnte nicht verortet werden</span>}
          </div>
        </div>
        {e.status && <p className="ev-status-box">{e.status === 'abgesagt' ? 'Die Veranstaltung ist laut Quelle abgesagt.' : 'Die Veranstaltung ist laut Quelle verschoben.'}</p>}
        {e.teaser && <p className="teaser">{e.teaser}</p>}
        {((e.times && e.times.length > 1) || e.free != null || e.price || e.audience) && (
          <dl className="facts">
            {e.times && e.times.length > 1 && <><dt>Beginnzeiten</dt><dd>{e.times.map((t) => fmtTime(t)).join(', ')} Uhr</dd></>}
            {(e.free != null || e.price) && <><dt>Eintritt</dt><dd>{e.free ? 'frei' : e.price && e.price !== '0' ? `ab ${e.price} €` : 'kostenpflichtig'}</dd></>}
            {e.audience && <><dt>Zielgruppe</dt><dd>{e.audience}</dd></>}
          </dl>
        )}
        {e.tags && e.tags.length > 0 && <div className="chips small-chips">{e.tags.slice(0, 5).map((t) => <span key={t} className="chip static">{t}</span>)}</div>}
        {(e.sources ?? [{ name: 'Stadt Stuttgart', url: e.url }]).map((src) => (
          <a key={src.url} className="link-btn" href={src.url} target="_blank" rel="noreferrer">Eintrag bei {src.name} <Icon name="external" size={16} /></a>
        ))}
        {e.start && !e.allDay && <WeatherAt iso={e.start} outdoorish={group === 'sport' || group === 'fest'} />}
        {lngLat && <GettingThere lngLat={lngLat} select={select} flyTo={flyTo} label={e.location ?? e.title} />}
        <WayHome e={e} />
        {same.length > 0 && (
          <Section title="Weitere Veranstaltungen am selben Ort">
            <ul className="event-list compact">
              {same.slice(0, 5).map((x) => <li key={x.id}><EventRow e={x} onClick={() => select({ type: 'event', id: x.id })} /></li>)}
            </ul>
          </Section>
        )}
        {lngLat && <NearbyPlaces lngLat={lngLat} select={select} flyTo={flyTo} />}
        <Source>{(e.sources ?? []).map((x) => x.name).join(', ') || 'Landeshauptstadt Stuttgart, Veranstaltungskalender'}. Verortung © OpenStreetMap-Mitwirkende (Nominatim), Fahrplan EFA-BW.</Source>
      </div>
    </div>
  );
}

export function PlaceDetail({ id, onClose, select, flyTo }: Close & Nav & { id: string }) {
  const { places, weather } = useData();
  const p = places.data?.places.find((x) => x.id === id);
  const wiki = usePolling<WikiSummary>(p?.wiki ? `/api/wiki?title=${encodeURIComponent(p.wiki)}` : null, 24 * 3600_000);
  const [imgOk, setImgOk] = useState(true);
  if (!p) return null;
  const k = PLACE_KINDS[p.kind];
  const lngLat: [number, number] = [p.lon, p.lat];
  const fs = p.kind === 'aussicht' ? fernsicht(weather.data?.visibility, weather.data?.cloud) : null;
  return (
    <div className="sheet-inner">
      {p.image && imgOk && (
        <figure className="hero-img">
          <img src={p.image} alt={p.name} onError={() => setImgOk(false)} />
          {p.imagePage && <a href={p.imagePage} target="_blank" rel="noreferrer" className="img-credit">Bild: Wikimedia Commons</a>}
        </figure>
      )}
      <SheetHead eyebrow={k.label} title={p.name} onClose={onClose}>
        {p.description && <p className="head-sub">{p.description}</p>}
      </SheetHead>
      <div className="sheet-body">
        {fs && (
          <div className={`fernsicht lvl-${fs.level}`}>
            <Icon name="eye" size={22} />
            <div><strong>Sichtweite aktuell {fs.km} km ({fs.label})</strong><span className="small">{fs.hint}</span></div>
          </div>
        )}
        {wiki.data?.extract && (
          <>
            <p className="teaser">{wiki.data.extract}</p>
            {wiki.data.url && <a className="text-link" href={wiki.data.url} target="_blank" rel="noreferrer">Artikel in der Wikipedia <Icon name="external" size={14} /></a>}
          </>
        )}
        {wiki.loading && !wiki.data && <span className="skeleton block" style={{ height: 90 }} />}
        <GettingThere lngLat={lngLat} select={select} flyTo={flyTo} label={p.name} />
        <NearbyEvents lngLat={lngLat} select={select} flyTo={flyTo} title="Veranstaltungen heute in der Umgebung" />
        <NearbyPlaces lngLat={lngLat} select={select} flyTo={flyTo} skip={p.id} />
        <Source>Wikidata (CC0), Text Wikipedia (CC BY-SA 4.0), Bild Wikimedia Commons (Lizenz auf der Bildseite).</Source>
      </div>
    </div>
  );
}

/** Für die Haltestellenansicht: was rund um die Haltestelle heute los ist */
export function AroundStop({ lngLat, select, flyTo }: Nav & { lngLat: [number, number] }) {
  return (
    <>
      <NearbyEvents lngLat={lngLat} select={select} flyTo={flyTo} title="Veranstaltungen heute im Umkreis" maxM={700} />
      <NearbyPlaces lngLat={lngLat} select={select} flyTo={flyTo} />
    </>
  );
}
