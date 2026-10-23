import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { useData } from '../../lib/data';
import { useNow } from '../../lib/api';
import { useStops } from '../../lib/stops';
import { nearestStops } from '../../lib/geo';
import { berlinDate, dayLabel, fmtDec, fmtTime } from '../../lib/format';
import { eveningOutlook, fernsicht } from '../../lib/weather';
import type { CultureEvent, PlaceKind } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { ErrorNote, LayerRow, Section, ShowMore, Disclosure, SkeletonRows } from '../../components/ui';
import { EventRow, PlaceRow, Thumb } from '../../components/CultureDetails';
import { EVENT_GROUPS, eventGroup, INDOOR, PLACE_KINDS, PLACE_ORDER, type EventGroup } from './kinds';

type Filter = 'all' | 'indoor' | EventGroup;

function endOf(e: CultureEvent) {
  if (!e.start) return 0;
  return e.end ? Date.parse(e.end) : Date.parse(e.start) + 150 * 60_000;
}

export function CulturePanel({ visible, toggle, select, flyTo, focus, botCommand }: ModuleProps) {
  const { events, eventDate, setEventDate, places, weather } = useData();
  const stops = useStops();
  const now = useNow(60_000);
  const today = berlinDate(now);
  const date = events.data?.date ?? eventDate ?? today;
  const isToday = date === today;
  const [filter, setFilter] = useState<Filter>('all');
  const [showAllDay, setShowAllDay] = useState(false);
  const [kind, setKind] = useState<PlaceKind | 'all'>('all');
  const [placeCount, setPlaceCount] = useState(6);
  const lastBotCommand = useRef('');

  // Filter aus dem Bot: „nur Museen“, „nur heute“, „nur indoor“.
  useEffect(() => {
    if (!botCommand || botCommand.module !== 'culture' || lastBotCommand.current === botCommand.id) return;
    lastBotCommand.current = botCommand.id;
    const value = String(botCommand.args?.value ?? '');
    if (botCommand.command === 'kind' && value) {
      setKind(value as PlaceKind | 'all');
    } else if (botCommand.command === 'filter' && value) {
      setFilter(value as Filter);
    } else if (botCommand.command === 'tag' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setEventDate(value);
    }
  }, [botCommand, setEventDate]);

  const list = events.data?.events ?? [];
  const groups = useMemo(() => {
    const c = new Map<EventGroup, number>();
    for (const e of list) if (e.ready) c.set(eventGroup(e), (c.get(eventGroup(e)) ?? 0) + 1);
    return [...c.entries()].filter(([g]) => g !== 'sonst').sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [list]);

  const matches = (e: CultureEvent) => filter === 'all' || (filter === 'indoor' ? INDOOR.includes(eventGroup(e)) : eventGroup(e) === filter);
  const filtered = list.filter((e) => !e.ready || matches(e));
  const timed = filtered.filter((e) => e.start && !e.allDay).sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!));
  const allDay = filtered.filter((e) => !e.start || e.allDay);
  const upcoming = isToday ? timed.filter((e) => Date.parse(e.start!) > now) : timed;
  const running = isToday ? timed.filter((e) => Date.parse(e.start!) <= now && endOf(e) > now) : [];
  const past = isToday ? timed.length - upcoming.length - running.length : 0;

  const stopMeta = (e: CultureEvent) => {
    if (e.lon == null || !stops.length) return undefined;
    const n = nearestStops(stops, [e.lon, e.lat!], 1)[0];
    return n ? `${n.stop.properties.name} ${n.walk} min` : undefined;
  };
  const open = (e: CultureEvent) => { select({ type: 'event', id: e.id }); if (e.lon != null) flyTo([e.lon, e.lat!], 15); };

  const outlook = isToday ? eveningOutlook(weather.data, now) : null;
  const fs = fernsicht(weather.data?.visibility, weather.data?.cloud);
  const indoorCount = list.filter((e) => e.ready && INDOOR.includes(eventGroup(e)) && (!isToday || !e.start || Date.parse(e.start) > now)).length;

  const allPlaces = places.data?.places ?? [];
  const kindCounts = useMemo(() => {
    const c: Partial<Record<PlaceKind, number>> = {};
    for (const p of allPlaces) c[p.kind] = (c[p.kind] ?? 0) + 1;
    return c;
  }, [allPlaces]);
  const shownPlaces = allPlaces.filter((p) => kind === 'all' || p.kind === kind);
  const viewpoints = allPlaces.filter((p) => p.kind === 'aussicht').slice(0, 8);

  return (
    <div className="module">
      <div className="culture-hero">
        <span className="eyebrow">Veranstaltungen {isToday ? 'heute' : `am ${dayLabel(date, now)}`}</span>
        <h3>
          {events.data
            ? isToday
              ? <>{upcoming.length} bevorstehend{running.length > 0 && <>, {running.length} laufend</>}</>
              : <>{list.length} Einträge im Kalender</>
            : 'Daten werden geladen …'}
        </h3>
        {outlook && (
          <p className="hero-line">
            <Icon name={outlook.rainFrom ? 'umbrella' : 'moon'} size={18} />
            {outlook.rainFrom
              ? <span>Niederschlag ab {fmtTime(outlook.rainFrom)} Uhr erwartet. {indoorCount} Veranstaltungen in Gebäuden.{' '}
                  {filter !== 'indoor' && <button type="button" className="inline-btn" onClick={() => setFilter('indoor')}>Anzeigen</button>}</span>
              : <span>Bis 24 Uhr kein Niederschlag erwartet. {fmtTime(outlook.at20.t)} Uhr: {fmtDec(outlook.at20.temperature, 0)} °C.</span>}
          </p>
        )}
        {fs && isToday && (
          <p className="hero-line">
            <Icon name="eye" size={18} />
            <span>Sichtweite {fs.km} km ({fs.label}).</span>
          </p>
        )}
      </div>

      {events.data && (
        <div className="day-strip" role="tablist" aria-label="Tag wählen">
          {events.data.days.map((d) => (
            <button key={d.date} role="tab" type="button" aria-selected={d.date === date} className={d.date === date ? 'active' : ''}
              onClick={() => { setEventDate(d.date === today ? null : d.date); setFilter('all'); }}>
              <span>{dayLabel(d.date, now)}</span>
              <small>{d.count}</small>
            </button>
          ))}
        </div>
      )}

      <Section title="Veranstaltungen" explain="termine" aside={events.data && events.data.pending > 0 ? `Verortung läuft, ${events.data.pending} ausstehend` : undefined}>
        {groups.length > 0 && (
          <div className="chips filter-chips">
            <button type="button" className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>Alle</button>
            {INDOOR.some((g) => groups.find(([x]) => x === g)) && (
              <button type="button" className={`chip ${filter === 'indoor' ? 'on' : ''}`} onClick={() => setFilter('indoor')}><Icon name="umbrella" size={14} /> In Gebäuden</button>
            )}
            {groups.map(([g, n]) => (
              <button key={g} type="button" className={`chip ${filter === g ? 'on' : ''}`} onClick={() => setFilter(g)}>{EVENT_GROUPS[g]} <small>{n}</small></button>
            ))}
          </div>
        )}
        {events.error && !events.data && <ErrorNote text={`Veranstaltungen nicht verfügbar: ${events.error}`} onRetry={events.reload} />}
        {!events.data && !events.error && <SkeletonRows rows={5} />}
        {running.length > 0 && (
          <>
            <h4 className="list-head">Laufend</h4>
            <ul className="event-list">{running.slice(0, 4).map((e) => <li key={e.id}><EventRow e={e} meta={stopMeta(e)} onClick={() => open(e)} /></li>)}</ul>
          </>
        )}
        {upcoming.length > 0 && (
          <>
            {isToday && <h4 className="list-head">Bevorstehend</h4>}
            <ul className="event-list">
              <ShowMore first={8} asList>
                {upcoming.map((e) => <li key={e.id}><EventRow e={e} meta={stopMeta(e)} onClick={() => open(e)} /></li>)}
              </ShowMore>
            </ul>
          </>
        )}
        {events.data && upcoming.length === 0 && running.length === 0 && (
          <p className="muted small">{filter === 'all' ? 'Heute keine weiteren Veranstaltungen mit Uhrzeit.' : 'Keine Veranstaltungen in dieser Auswahl.'}</p>
        )}
        {allDay.length > 0 && (
          <>
            <h4 className="list-head">Ganztägig</h4>
            <ul className="event-list">
              {(showAllDay ? allDay : allDay.slice(0, 3)).map((e) => <li key={e.id}><EventRow e={e} meta={stopMeta(e)} onClick={() => open(e)} /></li>)}
            </ul>
            {allDay.length > 3 && (
              <button type="button" className="more-btn" onClick={() => setShowAllDay((v) => !v)}>
                {showAllDay ? 'Weniger anzeigen' : `Alle ${allDay.length} ganztägigen Veranstaltungen anzeigen`}
              </button>
            )}
          </>
        )}
        {past > 0 && <p className="muted small past-note">{past} bereits beendete Veranstaltungen ausgeblendet.</p>}
      </Section>

      <Section title="Auf der Karte" collapsible defaultOpen={false}>
        <div className="layer-list">
          <LayerRow icon="ticket" tone="amber" title="Veranstaltungen" on={visible.events} onToggle={() => toggle('events')}
            meta={events.data ? `${list.filter((e) => e.lon != null).length} von ${list.length} verortet, ${dayLabel(date, now)}` : 'lädt'} loading={!events.data} />
          <LayerRow icon="culture" tone="ink" title="Sehenswürdigkeiten" on={visible.places} onToggle={() => toggle('places')}
            meta={places.data ? `${allPlaces.length} Orte aus Wikidata` : 'lädt'} loading={!places.data} />
        </div>
      </Section>

      {viewpoints.length > 0 && (
        <Section title="Aussichtspunkte" aside={fs ? `Sicht ${fs.km} km` : undefined} collapsible defaultOpen={false}>
          {fs && <p className="muted small">{fs.hint}</p>}
          <ul className="card-strip">
            {viewpoints.map((p) => (
              <li key={p.id}>
                <button type="button" className="view-card" onClick={() => { select({ type: 'place', id: p.id }); flyTo([p.lon, p.lat], 15); }}>
                  <span className="view-img"><Thumb src={p.image?.replace('width=640', 'width=320')} icon="view" size={26} /></span>
                  <span className="view-name">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sehenswürdigkeiten" aside={places.data ? `${shownPlaces.length} Orte` : undefined} collapsible defaultOpen={focus === 'orte'}>
        <div className="chips filter-chips">
          <button type="button" className={`chip ${kind === 'all' ? 'on' : ''}`} onClick={() => { setKind('all'); setPlaceCount(6); }}>Alle</button>
          {PLACE_ORDER.filter((k) => kindCounts[k]).map((k) => (
            <button key={k} type="button" className={`chip ${kind === k ? 'on' : ''}`} onClick={() => { setKind(k); setPlaceCount(6); }}>
              <span className="kind-dot" style={{ background: PLACE_KINDS[k].color }} /> {PLACE_KINDS[k].plural}
            </button>
          ))}
        </div>
        {places.error && !places.data && <ErrorNote text={`Orte nicht verfügbar: ${places.error}`} onRetry={places.reload} />}
        {!places.data && !places.error && <SkeletonRows rows={4} />}
        <ul className="thumb-list">
          {shownPlaces.slice(0, placeCount).map((p) => (
            <li key={p.id}><PlaceRow p={p} onClick={() => { select({ type: 'place', id: p.id }); flyTo([p.lon, p.lat], 16); }} /></li>
          ))}
        </ul>
        {shownPlaces.length > placeCount && (
          <button type="button" className="more-btn" onClick={() => setPlaceCount((n) => n + 12)}>Weitere anzeigen</button>
        )}
      </Section>

      <Disclosure label="Quellen und Lizenzen" defaultOpen={false}>
        <p className="source">
          Veranstaltungskalender der Landeshauptstadt Stuttgart (Einträge mit Verweis auf die Originalseite), Orte aus Wikidata (CC0),
          Bilder Wikimedia Commons, Verortung © OpenStreetMap-Mitwirkende.
        </p>
      </Disclosure>
    </div>
  );
}
