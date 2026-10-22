// Modul „Was geht“: Szene-Termine (abgeglichen mit dem Kulturmodul), Neu in der Stadt (OpenStreetMap) und Meldungen.
// Daten von /api/wasgeht, /api/openings und /api/news (server/sources/wasgeht.mjs). Spezifikation was-geht, Abschnitt 6.8.
import { useEffect, useMemo, useState } from 'react';
import type { ModuleProps } from '../types';
import type { CultureEvent, Facility } from '../../lib/types';
import { usePolling, useNow } from '../../lib/api';
import { berlinDate, dayLabel, fmtTime } from '../../lib/format';
import { Icon } from '../../components/Icon';
import { ErrorNote, LayerRow, Section, Source, SkeletonRows } from '../../components/ui';
import { MensaSection } from '../../components/Mensa';
import { Explain } from '../../lib/info';
import '../../styles/wasgeht.css';

// ---------- Typen der Antworten ----------
type Szene = 'konzert' | 'party' | 'comedy' | 'hochschule' | 'flohmarkt' | 'popup' | 'kneipe' | 'buehne' | 'jugend' | 'sonstiges';

interface WgEvent extends CultureEvent {
  scene?: Szene[];
  genre?: string | null;
  minAge?: 16 | 18 | null;
  ticketUrl?: string | null;
  priceMin?: number | null;
  doors?: string | null;
  venueId?: string | null;
  license?: string | null;
  soldOut?: boolean;
  collective?: { id: string; name: string; url: string | null; szene?: string | null } | null;
}

interface WgSource {
  id: string; name: string; group: string; url: string | null; license: string;
  count: number; total?: number; ok: boolean; updated: string | null; error: string | null;
  parts?: { name: string; url: string; count: number; ok: boolean }[];
}

interface WasGehtResponse {
  date: string; days: string[]; span: 'tag' | 'abend' | 'wochenende';
  events: WgEvent[]; total: number; counts: Record<Szene, number>; merged: number; pending: number;
  collectives?: { id: string; name: string; url: string | null; szene: string | null; anzahl: number }[];
  collectiveCount?: number;
  sources: WgSource[]; errors: string[]; hinweis: string;
}

interface Opening {
  id: string; name: string; kind: string | null; kindLabel: string; lat: number; lon: number; district: string | null;
  signal: 'neu_in_osm' | 'neuer_betrieb' | 'evtl_geschlossen'; since: string; sinceDate: string; address: string | null;
  previous?: { name?: string; kind?: string };
  press?: { name: string; url: string; title: string }[];
  source: { name: 'OpenStreetMap'; url: string; license: 'ODbL' };
}
interface OpeningsResponse { items: Opening[]; updated: string | null; running: boolean; error: string | null; hinweis: string; source: { attribution: string } }

interface NewsItem {
  id: string; title: string; teaser: string | null; url: string; published: string;
  source: string; sourceId: string; district: string | null; topic: 'verkehr' | 'blaulicht' | 'verwaltung' | 'kultur' | 'sonstiges';
}
interface NewsResponse { items: NewsItem[]; updated: string; sources: { id: string; name: string; url: string; license: string; count: number; ok: boolean; error: string | null }[]; hinweis: string }

interface StadtgedaechtnisItem {
  id: string; date: string; title: string; summary: string | null; url: string; source: string; license: string;
  topic: string; district: string | null; lat: number | null; lon: number | null; confidence: string;
}
interface StadtgedaechtnisResponse {
  items: StadtgedaechtnisItem[]; total: number; days: number; since: string; districts: string[];
  topics: Record<string, string>; byTopic: Record<string, number>; updated: string; hinweis: string;
  sources: { id: string; name: string; count: number; ok: boolean; hinweis: string }[];
}

// ---------- Beschriftungen ----------
const SZENE: { id: Szene; label: string; color: string }[] = [
  { id: 'konzert', label: 'Konzert', color: '#2B59C3' },
  { id: 'party', label: 'Party', color: '#6A1B9A' },
  { id: 'comedy', label: 'Comedy', color: '#C2410C' },
  { id: 'hochschule', label: 'Hochschule', color: '#1B7F3B' },
  { id: 'flohmarkt', label: 'Flohmarkt', color: '#8A6440' },
  { id: 'buehne', label: 'Bühne', color: '#A0522D' },
  { id: 'jugend', label: 'Jugend', color: '#00897B' },
  { id: 'sonstiges', label: 'Sonstiges', color: '#5D5C62' },
];
const JUNG: Szene[] = ['konzert', 'party', 'comedy', 'hochschule', 'flohmarkt', 'popup', 'kneipe', 'jugend'];
const SZENE_LABEL = Object.fromEntries(SZENE.map((s) => [s.id, s.label])) as Record<Szene, string>;

/** Fremde Ticket-URLs dürfen den Render nie zum Absturz bringen. */
function ticketHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}
const CAT_COLOR: Record<string, string> = Object.fromEntries(SZENE.map((s) => [`wasgeht_${s.id}`, s.color]));
const SIGNAL: Record<Opening['signal'], string> = {
  neu_in_osm: 'Neu in OpenStreetMap',
  neuer_betrieb: 'Neuer Betrieb an dieser Adresse',
  evtl_geschlossen: 'Möglicherweise geschlossen',
};
const TOPIC: Record<NewsItem['topic'] | 'alle', string> = { alle: 'Alle', blaulicht: 'Blaulicht', verkehr: 'Verkehr', verwaltung: 'Verwaltung', kultur: 'Kultur', sonstiges: 'Sonstiges' };

type Ansicht = { kind: 'abend' } | { kind: 'wochenende' } | { kind: 'tag'; date: string };

const euro = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
function preis(e: WgEvent) {
  if (e.free || e.priceMin === 0) return 'Eintritt frei';
  if (e.priceMin != null) return `ab ${euro(e.priceMin)} Euro`;
  return null;
}
const hauptSzene = (e: WgEvent): Szene => (e.scene?.find((s) => s !== 'sonstiges') ?? 'sonstiges');
const osmId = (osm: string | null | undefined) => (osm ? osm.replace(/^node\//, 'n').replace(/^way\//, 'w').replace(/^relation\//, 'r') : null);

export function WasGehtPanel({ visible, toggle, select, flyTo, setNearby, setLayer, center }: ModuleProps) {
  const now = useNow(60_000);
  const today = berlinDate(now);
  const [ansicht, setAnsicht] = useState<Ansicht>({ kind: 'abend' });
  const [jung, setJung] = useState(true);
  const [szene, setSzene] = useState<Szene | null>(null);
  const [frei, setFrei] = useState(false);
  const [bis10, setBis10] = useState(false);
  const [nurKollektive, setNurKollektive] = useState(false);
  const [kollektiv, setKollektiv] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [topic, setTopic] = useState<NewsItem['topic'] | 'alle'>('alle');
  const [neuCount, setNeuCount] = useState(6);
  const [listeCount, setListeCount] = useState(12);
  const [newsCount, setNewsCount] = useState(10);
  const [sgTopic, setSgTopic] = useState<string>('alle');
  const [sgDistrict, setSgDistrict] = useState<string>('alle');
  const [sgCount, setSgCount] = useState(20);

  const url = ansicht.kind === 'abend' ? `/api/wasgeht?date=${today}&span=abend`
    : ansicht.kind === 'wochenende' ? `/api/wasgeht?date=${today}&span=wochenende`
      : `/api/wasgeht?date=${ansicht.date}&span=tag`;
  const wg = usePolling<WasGehtResponse>(url, 10 * 60_000);
  const neu = usePolling<OpeningsResponse>('/api/openings?days=30', 60 * 60_000);
  const meldungen = usePolling<NewsResponse>('/api/news', 5 * 60_000);
  const stadt = usePolling<StadtgedaechtnisResponse>('/api/stadtgedaechtnis?days=30', 15 * 60_000);

  const alle = wg.data?.events ?? [];
  const liste = useMemo(() => alle.filter((e) => (!jung || e.scene?.some((s) => JUNG.includes(s)))
    && (!szene || e.scene?.includes(szene))
    && (!nurKollektive || !!e.collective)
    && (!kollektiv || e.collective?.id === kollektiv)
    && (!frei || e.free === true || e.priceMin === 0)
    && (!bis10 || e.free === true || (e.priceMin != null && e.priceMin <= 10))), [alle, jung, szene, frei, bis10, nurKollektive, kollektiv]);
  const zaehler = useMemo(() => {
    const c: Partial<Record<Szene, number>> = {};
    for (const e of alle) if (!jung || e.scene?.some((s) => JUNG.includes(s))) for (const s of e.scene ?? []) c[s] = (c[s] ?? 0) + 1;
    return c;
  }, [alle, jung]);

  // Kartenpunkte je Ort; mehrere Termine am selben Ort als ein Punkt mit Liste
  const orte = useMemo<Facility[]>(() => {
    const m = new Map<string, Facility>();
    for (const e of liste) {
      if (e.lat == null || e.lon == null) continue;
      const key = e.venueId ?? `${e.lat.toFixed(4)},${e.lon.toFixed(4)}`;
      const zeile = `${e.start && !e.allDay ? `${fmtTime(e.start)} Uhr` : 'ganztägig'}: ${e.title}`;
      const f = m.get(key);
      if (f) { f.info = [...(f.info ?? []), zeile]; continue; }
      m.set(key, {
        id: `wasgeht-${key}`, cat: `wasgeht_${hauptSzene(e)}`, name: (e.venue ?? e.location ?? 'Veranstaltungsort').split(',')[0],
        lat: e.lat, lon: e.lon, address: [e.location, e.district].filter(Boolean).join(', ') || null, web: e.url, info: [zeile],
      });
    }
    return [...m.values()];
  }, [liste]);

  useEffect(() => { setLayer('nearby', true); return () => setNearby(null); }, [setLayer, setNearby]);
  useEffect(() => { setNearby(orte.length ? { items: orte, color: CAT_COLOR } : null); }, [orte, setNearby]);

  const tage = Array.from({ length: 14 }, (_, i) => berlinDate(now + i * 86400_000));
  const ortZeigen = (e: WgEvent) => {
    if (e.lon == null || e.lat == null) return;
    const f = orte.find((o) => o.lat === e.lat && o.lon === e.lon) ?? orte.find((o) => o.id === `wasgeht-${e.venueId}`);
    if (f) select({ type: 'facility', item: f });
    flyTo([e.lon, e.lat], 16);
  };
  const neuItems = (neu.data?.items ?? []).filter((x) => x.signal !== 'evtl_geschlossen');
  const zu = (neu.data?.items ?? []).filter((x) => x.signal === 'evtl_geschlossen');
  const newsItems = (meldungen.data?.items ?? []).filter((n) => topic === 'alle' || n.topic === topic);
  const sgItems = (stadt.data?.items ?? []).filter((x) => (sgTopic === 'alle' || x.topic === sgTopic) && (sgDistrict === 'alle' || x.district === sgDistrict));

  let lastDay = '';
  return (
    <div className="module wasgeht">
      <div className="wg-hero">
        <span className="eyebrow">Was geht <Explain id="wasgeht" /></span>
        <h3>
          {wg.data
            ? <>{liste.length} {liste.length === 1 ? 'Termin' : 'Termine'} {ansicht.kind === 'abend' ? 'heute Abend' : ansicht.kind === 'wochenende' ? 'am Wochenende' : `am ${dayLabel(ansicht.date, now)}`}</>
            : 'Daten werden geladen …'}
        </h3>
        <p className="wg-hero-line">Konzerte, Partys, Comedy, Hochschulen und Flohmärkte aus offenen Quellen, abgeglichen mit dem Veranstaltungskalender.</p>
      </div>

      <div className="seg wg-seg" role="tablist" aria-label="Zeitraum wählen">
        <button type="button" role="tab" aria-selected={ansicht.kind === 'abend'} className={ansicht.kind === 'abend' ? 'active' : ''} onClick={() => setAnsicht({ kind: 'abend' })}>Heute Abend</button>
        <button type="button" role="tab" aria-selected={ansicht.kind === 'tag' && ansicht.date === tage[1]} className={ansicht.kind === 'tag' && ansicht.date === tage[1] ? 'active' : ''} onClick={() => setAnsicht({ kind: 'tag', date: tage[1] })}>Morgen</button>
        <button type="button" role="tab" aria-selected={ansicht.kind === 'wochenende'} className={ansicht.kind === 'wochenende' ? 'active' : ''} onClick={() => setAnsicht({ kind: 'wochenende' })}>Wochenende</button>
      </div>
      <div className="day-strip" role="tablist" aria-label="Tag wählen">
        {tage.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={ansicht.kind === 'tag' && ansicht.date === d} className={ansicht.kind === 'tag' && ansicht.date === d ? 'active' : ''}
            onClick={() => setAnsicht({ kind: 'tag', date: d })}>
            <span>{dayLabel(d, now)}</span>
          </button>
        ))}
      </div>

      <Section title="Termine" explain="wasgeht" aside={wg.data && wg.data.pending > 0 ? `Kalender wird ergänzt, ${wg.data.pending} ausstehend` : undefined}>
        <div className="chips filter-chips">
          <button type="button" className={`chip ${jung ? 'on' : ''}`} aria-pressed={jung} onClick={() => setJung((v) => !v)}>Junges Publikum</button>
          {SZENE.filter((s) => zaehler[s.id]).map((s) => (
            <button key={s.id} type="button" className={`chip ${szene === s.id ? 'on' : ''}`} aria-pressed={szene === s.id} onClick={() => setSzene(szene === s.id ? null : s.id)}>
              <span className="kind-dot" style={{ background: s.color }} /> {s.label} <small>{zaehler[s.id]}</small>
            </button>
          ))}
          <button type="button" className={`chip ${nurKollektive ? 'on' : ''}`} aria-pressed={nurKollektive} onClick={() => { setNurKollektive((v) => !v); setKollektiv(null); }}>
            Kollektive &amp; freie Szene {wg.data?.collectiveCount ? <small>{wg.data.collectiveCount}</small> : null}
          </button>
          {(wg.data?.collectives ?? []).filter((k) => k.anzahl > 0).slice(0, 8).map((k) => (
            <button key={k.id} type="button" className={`chip ${kollektiv === k.id ? 'on' : ''}`} aria-pressed={kollektiv === k.id}
              onClick={() => { setKollektiv(kollektiv === k.id ? null : k.id); setNurKollektive(false); }}>
              {k.name} <small>{k.anzahl}</small>
            </button>
          ))}
          <button type="button" className={`chip ${frei ? 'on' : ''}`} aria-pressed={frei} onClick={() => setFrei((v) => !v)}>Kostenlos</button>
          <button type="button" className={`chip ${bis10 ? 'on' : ''}`} aria-pressed={bis10} onClick={() => setBis10((v) => !v)}>Bis 10 Euro</button>
        </div>
        {nurKollektive && <p className="muted small wg-note">Kollektive werden aus dem Veranstaltungsregister (Schlagwort <code>kollektiv:…</code>) und aus Nennungen im Titel erkannt. Die Zuordnung ist ein Hinweis, keine Bestätigung des Veranstalters.</p>}
        {kollektiv && <p className="muted small wg-note">Gefiltert auf alle Termine des Kollektivs, unabhängig vom Ort. <button type="button" className="link-quiet small" onClick={() => setKollektiv(null)}>Filter aufheben</button></p>}
        {jung && <p className="muted small wg-note">„Junges Publikum“ zeigt Konzerte, Partys, Comedy, Hochschule und Flohmärkte. Eine Altersgruppe wird damit nicht unterstellt.</p>}
        {wg.error && !wg.data && <ErrorNote text={`Termine nicht verfügbar: ${wg.error}`} onRetry={wg.reload} />}
        {!wg.data && !wg.error && <SkeletonRows rows={5} />}
        {wg.data && liste.length === 0 && (
          <p className="muted small">Für diese Auswahl liegen aus den angebundenen Quellen keine Termine vor.</p>
        )}
        <ul className="event-list wg-list">
          {liste.slice(0, listeCount).map((e) => {
            const head = wg.data && wg.data.days.length > 1 && e.date !== lastDay ? e.date : null;
            lastDay = e.date;
            const p = preis(e);
            const isOpen = offen === e.id;
            const host = ticketHost(e.ticketUrl);
            return (
              <li key={e.id}>
                {head && <h4 className="list-head">{dayLabel(head, now)}</h4>}
                <button type="button" className="event-row wg-row" aria-expanded={isOpen} onClick={() => { setOffen(isOpen ? null : e.id); if (!isOpen && e.lon != null) flyTo([e.lon, e.lat!], 15); }}>
                  <span className={`ev-time ${e.allDay || !e.start ? 'allday' : ''}`}>
                    {e.allDay || !e.start ? <Icon name="calendar" size={18} /> : <strong>{fmtTime(e.start)}</strong>}
                    {e.doors && <small>Einl. {fmtTime(e.doors)}</small>}
                  </span>
                  <span className="ev-main">
                    <span className="ev-title">{e.status && <span className="ev-status">{e.status === 'abgesagt' ? 'Abgesagt' : 'Verschoben'}: </span>}{e.title}</span>
                    <span className="ev-sub">{[e.venue ?? e.location?.split(',')[0], e.district].filter(Boolean).join(' · ') || 'Ort nicht angegeben'}</span>
                    <span className="wg-facts">
                      {e.genre && <span>{e.genre}</span>}
                      {p && <span>{p}</span>}
                      {e.soldOut && <span>ausverkauft</span>}
                      {e.minAge && <span>ab {e.minAge}</span>}
                    </span>
                  </span>
                  <span className="wg-src">
                    <span className="kind-dot" style={{ background: SZENE.find((s) => s.id === hauptSzene(e))?.color }} />
                    <small>{SZENE_LABEL[hauptSzene(e)]}</small>
                    {e.collective && <small className="wg-collective">{e.collective.name}</small>}
                  </span>
                </button>
                {isOpen && (
                  <div className="wg-detail">
                    {e.teaser && <p className="small">{e.teaser}</p>}
                    <dl className="wg-dl">
                      {e.start && !e.allDay && <><dt>Beginn</dt><dd>{fmtTime(e.start)} Uhr{e.doors ? `, Einlass ${fmtTime(e.doors)} Uhr` : ''}</dd></>}
                      {e.location && <><dt>Ort</dt><dd>{[e.venue, e.location].filter(Boolean).join(', ')}</dd></>}
                      {p && <><dt>Preis</dt><dd>{p}</dd></>}
                      {e.collective && (
                        <><dt>Kollektiv</dt><dd>
                          <button type="button" className="link-quiet" onClick={() => { setKollektiv(e.collective!.id); setNurKollektive(false); setOffen(null); }}>
                            {e.collective.name}
                          </button>
                          {e.collective.szene ? ` · ${e.collective.szene}` : ''}
                          {e.collective.url && <> · <a href={e.collective.url} target="_blank" rel="noreferrer">Seite</a></>}
                        </dd></>
                      )}
                      {e.verified && (
                        <>
                          <dt>Bestätigung</dt>
                          <dd>
                            {e.verified === 'venue' ? 'Hausquelle, vom Veranstalter angekündigt'
                              : e.verified === 'official' ? 'städtische Quelle'
                                : e.verified === 'ticket' ? 'Ticketanbieter'
                                  : e.verified === 'register' ? 'offenes Veranstaltungsregister'
                                    : 'Aggregator, nicht vom Veranstalter bestätigt'}
                            {e.lastSeen ? ` · zuletzt ${new Date(e.lastSeen).toLocaleDateString('de-DE')}` : ''}
                          </dd>
                        </>
                      )}
                      <dt>Quelle</dt>
                      <dd>{(e.sources ?? []).map((s, i) => <span key={s.name}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}</dd>
                    </dl>
                    <div className="wg-actions">
                      {e.ticketUrl && host && <a className="link-btn" href={e.ticketUrl} target="_blank" rel="noreferrer">Tickets bei {host} <Icon name="external" size={16} /></a>}
                      <a className="link-btn secondary" href={e.url} target="_blank" rel="noreferrer">Seite des Veranstalters <Icon name="external" size={16} /></a>
                      {e.lon != null && <button type="button" className="link-btn secondary" onClick={() => ortZeigen(e)}><Icon name="pin" size={16} /> Ort und Anreise</button>}
                    </div>
                    <p className="muted small">Angaben ohne Gewähr, maßgeblich ist der Veranstalter.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {liste.length > listeCount && (
          <button type="button" className="more-btn" onClick={() => setListeCount((n) => n + 15)}>
            {liste.length - listeCount} weitere Termine anzeigen
          </button>
        )}
        {wg.data && <p className="muted small wg-note">{wg.data.total} Termine im Zeitraum, {wg.data.merged} Einträge aus mehreren Quellen zusammengeführt. Die Quellen je Termin stehen in der Detailansicht.</p>}
      </Section>

      <Section title="Auf der Karte" collapsible defaultOpen={false}>
        <div className="layer-list">
          <LayerRow icon="ticket" tone="amber" title="Orte der angezeigten Termine" on={visible.nearby} onToggle={() => toggle('nearby')}
            meta={wg.data ? `${orte.length} Orte, ${liste.filter((e) => e.lat != null).length} von ${liste.length} Terminen verortet` : 'lädt'} loading={!wg.data} />
        </div>
      </Section>

      <Section title="Neu in der Stadt" aside={neu.data?.updated ? `Stand ${dayLabel(berlinDate(neu.data.updated), now)}` : undefined} collapsible defaultOpen={false}>
        <p className="muted small wg-note">Neu in OpenStreetMap erfasst. Das ist nicht in jedem Fall eine Neueröffnung.</p>
        {neu.error && !neu.data && <ErrorNote text={`Neu in der Stadt nicht verfügbar: ${neu.error}`} onRetry={neu.reload} />}
        {!neu.data && !neu.error && <span className="skeleton block" style={{ height: 90 }} />}
        {neu.data && neuItems.length === 0 && <p className="muted small">{neu.data.running ? 'Auswertung der Änderungen läuft.' : 'Keine Einträge in den letzten 30 Tagen.'}</p>}
        <ul className="event-list wg-neu">
          {neuItems.slice(0, neuCount).map((o) => <li key={o.id}><NeuRow o={o} onClick={() => { select({ type: 'facility', item: openingFacility(o) }); flyTo([o.lon, o.lat], 17); }} /></li>)}
        </ul>
        {neuItems.length > neuCount && <button type="button" className="more-btn" onClick={() => setNeuCount((n) => n + 10)}>Weitere anzeigen</button>}
        {zu.length > 0 && (
          <details className="wg-details">
            <summary>{zu.length} möglicherweise geschlossen</summary>
            <ul className="event-list wg-neu">
              {zu.slice(0, 20).map((o) => <li key={o.id}><NeuRow o={o} onClick={() => { select({ type: 'facility', item: openingFacility(o) }); flyTo([o.lon, o.lat], 17); }} /></li>)}
            </ul>
          </details>
        )}
        <Source>
          {neu.data?.source.attribution ?? '© OpenStreetMap-Mitwirkende'} (ODbL 1.0), Stadtbezirke: Landeshauptstadt Stuttgart (CC BY 4.0).
          Gegenprüfung über Kessel.TV (nur Titel und Link). Fehlt ein Ort oder ist er falsch, kann er direkt in OpenStreetMap ergänzt werden.
        </Source>
      </Section>

      <AbendTipps lngLat={center} />

      <FreizeitSection select={select} flyTo={flyTo} />

      <Section title="Meldungen" aside={meldungen.data ? `${newsItems.length} Meldungen` : undefined} collapsible defaultOpen={false}>
        <div className="chips filter-chips">
          {(Object.keys(TOPIC) as (keyof typeof TOPIC)[]).map((t) => (
            <button key={t} type="button" className={`chip ${topic === t ? 'on' : ''}`} aria-pressed={topic === t} onClick={() => { setTopic(t); setNewsCount(10); }}>{TOPIC[t]}</button>
          ))}
        </div>
        {meldungen.error && !meldungen.data && <ErrorNote text={`Meldungen nicht verfügbar: ${meldungen.error}`} onRetry={meldungen.reload} />}
        {!meldungen.data && !meldungen.error && <span className="skeleton block" style={{ height: 120 }} />}
        <ul className="wg-news">
          {newsItems.slice(0, newsCount).map((n) => (
            <li key={n.id}>
              <span className="wg-news-meta">
                <span>{berlinDate(n.published) === today ? `${fmtTime(n.published)} Uhr` : `${dayLabel(berlinDate(n.published), now)}, ${fmtTime(n.published)} Uhr`}</span>
                <span>{n.source}</span>
                {n.district && <span>{n.district}</span>}
              </span>
              <a href={n.url} target="_blank" rel="noreferrer" className="wg-news-title">{n.title}</a>
              {n.teaser && <span className="wg-news-teaser">{n.teaser}</span>}
            </li>
          ))}
        </ul>
        {newsItems.length > newsCount && <button type="button" className="more-btn" onClick={() => setNewsCount((n) => n + 15)}>Weitere anzeigen</button>}
        <Source>
          {meldungen.data?.hinweis ?? 'Nur Titel, Zeit und Link.'} Quellen:{' '}
          {(meldungen.data?.sources ?? []).map((s, i) => (
            <span key={s.id}>{i > 0 && '; '}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> ({s.license}){!s.ok && ' – derzeit nicht erreichbar'}</span>
          ))}
        </Source>
      </Section>

      <Section title="Stadtgedächtnis: Was sich geändert hat" explain="stadtgedaechtnis" collapsible defaultOpen={false}
        aside={stadt.data ? `${stadt.data.total} Einträge, ${stadt.data.days} Tage` : undefined}>
        <p className="muted small">
          Ein Archiv der öffentlichen Veränderungen: Meldungen, amtliche Bekanntmachungen, neu erfasste Orte und Änderungen an
          Verwaltungsseiten. Jeder Eintrag nennt Datum, Quelle und Lizenz. Keine Volltexte, keine Personendaten.
        </p>
        <div className="chips filter-chips">
          <button type="button" className={`chip ${sgTopic === 'alle' ? 'on' : ''}`} aria-pressed={sgTopic === 'alle'} onClick={() => setSgTopic('alle')}>
            Alle <small>{stadt.data?.total ?? 0}</small>
          </button>
          {Object.entries(stadt.data?.topics ?? {}).map(([id, label]) => (
            <button key={id} type="button" className={`chip ${sgTopic === id ? 'on' : ''}`} aria-pressed={sgTopic === id} onClick={() => setSgTopic(id)}>
              {label} <small>{stadt.data?.byTopic[id] ?? 0}</small>
            </button>
          ))}
        </div>
        {(stadt.data?.districts.length ?? 0) > 0 && (
          <label className="small sg-filter">
            Stadtbezirk{' '}
            <select value={sgDistrict} onChange={(e) => setSgDistrict(e.target.value)} aria-label="Stadtbezirk filtern">
              <option value="alle">alle</option>
              {stadt.data!.districts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
        {stadt.error && !stadt.data && <ErrorNote text={`Stadtgedächtnis nicht verfügbar: ${stadt.error}`} onRetry={stadt.reload} />}
        {!stadt.data && !stadt.error && <span className="skeleton block" style={{ height: 140 }} />}
        {stadt.data && sgItems.length === 0 && <p className="muted small">Für diese Auswahl liegen keine Änderungen vor.</p>}
        <ul className="wg-news sg-list">
          {sgItems.slice(0, sgCount).map((x) => (
            <li key={x.id}>
              <span className="wg-news-meta">
                <span>{dayLabel(x.date, now)}</span>
                <span className="sg-topic">{stadt.data?.topics[x.topic] ?? x.topic}</span>
                <span>{x.source}</span>
                {x.district && <span>{x.district}</span>}
                <span className={`sg-conf sg-${x.confidence}`} title="Sicherheit der Zuordnung">Quelle {x.confidence}</span>
              </span>
              <a href={x.url} target="_blank" rel="noreferrer" className="wg-news-title">{x.title}</a>
              {x.summary && <span className="wg-news-teaser">{x.summary}</span>}
              <span className="sg-license">{x.license}</span>
            </li>
          ))}
        </ul>
        {sgItems.length > sgCount && <button type="button" className="more-btn" onClick={() => setSgCount((n) => n + 20)}>Weitere anzeigen</button>}
        {stadt.data && <p className="muted small">{stadt.data.hinweis}</p>}
        <div className="row-actions">
          <a className="chip" href="/api/stadtgedaechtnis.rss?days=30"><Icon name="calendar" size={16} /> Als RSS abonnieren</a>
          <a className="link-quiet small" href="https://www.stuttgart.de/rathaus/amtliche-bekanntmachungen/" target="_blank" rel="noreferrer">Amtliche Bekanntmachungen der Stadt</a>
        </div>
        <Source>
          Quellen: {(stadt.data?.sources ?? []).map((s) => `${s.name} (${s.count})`).join('; ')}.
          Meldungen nur mit Titel, Zeit und Link; Bekanntmachungen mit Titel, Zeitraum und PDF-Link; OpenStreetMap unter ODbL; Verwaltungsseiten mit Quellenangabe.
          Das Archiv wird bei jedem Abruf fortgeschrieben, der erste Vergleichslauf setzt nur den Stand.
        </Source>
      </Section>

      <Section title="Quellen und Lizenzen" collapsible defaultOpen={false}>
        {wg.data && (
          <ul className="wg-sources">
            {wg.data.sources.map((s) => (
              <li key={s.id}>
                <span className={`wg-state ${s.ok ? 'ok' : 'err'}`} aria-label={s.ok ? 'erreichbar' : 'gestört'} />
                <span className="wg-src-main">
                  <strong>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}</strong>
                  <span className="muted small">{s.count} im Zeitraum{s.updated ? `, abgerufen ${fmtTime(s.updated)} Uhr` : ''}{s.error ? `. ${s.error}` : ''}</span>
                  <span className="muted small">{s.license}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Source>
          Übernommen werden Titel, Zeit, Ort, Preis, Status und Link der Quelle, keine Beschreibungstexte oder Bilder. Ortsangaben © OpenStreetMap-Mitwirkende (ODbL).
          Nicht angebunden, weil gesperrt oder vorbehalten: Resident Advisor, rausgegangen, Shotgun, regioactive, Eventim, Stuttgarter Zeitung und Stuttgarter Nachrichten.
        </Source>
      </Section>
    </div>
  );
}

function NeuRow({ o, onClick }: { o: Opening; onClick: () => void }) {
  return (
    <div className="wg-neu-row">
      <button type="button" className="event-row" onClick={onClick}>
        <span className={`ev-time allday wg-sig-${o.signal}`}><Icon name={o.signal === 'evtl_geschlossen' ? 'minus' : 'plus'} size={18} /></span>
        <span className="ev-main">
          <span className="ev-title">{o.name}</span>
          <span className="ev-sub">{[o.kindLabel, o.district].filter(Boolean).join(' · ')}</span>
          <span className="wg-facts">
            <span>{SIGNAL[o.signal]}</span>
            {o.previous && <span>vorher: {[o.previous.name, o.previous.kind?.replace(/^shop=/, 'Laden ')].filter(Boolean).join(', ')}</span>}
            <span>gemeldet in OpenStreetMap am {new Date(`${o.sinceDate}T12:00:00`).toLocaleDateString('de-DE')}</span>
          </span>
        </span>
      </button>
      <span className="wg-links small">
        <a href={o.source.url} target="_blank" rel="noreferrer">Objekt in OpenStreetMap</a>
        {o.press?.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer">auch berichtet: {p.name}</a>)}
      </span>
    </div>
  );
}

function openingFacility(o: Opening): Facility {
  return {
    id: o.id, cat: 'wasgeht_neu', name: o.name, lat: o.lat, lon: o.lon, address: [o.address, o.district].filter(Boolean).join(', ') || null,
    info: [o.kindLabel, SIGNAL[o.signal], `gemeldet in OpenStreetMap am ${new Date(`${o.sinceDate}T12:00:00`).toLocaleDateString('de-DE')}`],
    osm: osmId(o.source.url.replace('https://www.openstreetmap.org/', '')),
  };
}

interface FreizeitRoute {
  id: string;
  art: 'weinwanderweg' | 'innenstadtrundweg' | 'downhill';
  name: string;
  beschreibung: string | null;
  laengeKm: number | null;
  url: string | null;
  lat: number;
  lon: number;
  zacke?: {
    line: string;
    talStopId: string;
    talStopName: string;
    talCoords: [number, number];
    bergStopId: string;
    bergStopName: string;
    bergCoords: [number, number];
    hinweis: string;
  };
}

function FreizeitSection({ select, flyTo }: Pick<ModuleProps, 'select' | 'flyTo'>) {
  const routen = usePolling<{ items: FreizeitRoute[]; source: string }>('/api/freizeit/routen', 24 * 3600_000);
  const chill = usePolling<{ items: Facility[] }>('/api/nearby/facilities?cat=chillorte', 24 * 3600_000);
  const rItems = routen.data?.items ?? [];
  const cItems = chill.data?.items ?? [];
  if (!rItems.length && !cItems.length) return null;

  const downhill = rItems.find((r) => r.art === 'downhill');
  const wander = rItems.filter((r) => r.art !== 'downhill');

  return (
    <Section title="Draußen unterwegs: Strecken und Jugend-Chillorte" aside={cItems.length ? `${cItems.length} Chillorte` : undefined} collapsible defaultOpen={false}>
      {downhill && (
        <div className="wg-detail" style={{ marginBottom: 10 }}>
          <strong>{downhill.name}</strong>
          <p className="small muted">{downhill.beschreibung}</p>
          {downhill.zacke && (
            <div className="wg-actions">
              <button type="button" className="chip" onClick={() => {
                select({ type: 'stop', id: downhill.zacke!.talStopId, name: downhill.zacke!.talStopName, lngLat: downhill.zacke!.talCoords, lines: ['10', 'U1', 'U14'] });
                flyTo(downhill.zacke!.talCoords, 15.5);
              }}>
                Abfahrten Zacke (Linie 10) ab {downhill.zacke.talStopName}
              </button>
              <button type="button" className="chip" onClick={() => flyTo([downhill.lon, downhill.lat], 15)}>
                Strecke auf der Karte
              </button>
            </div>
          )}
        </div>
      )}
      {wander.length > 0 && (
        <>
          <h4 className="list-head">Weinwanderwege und Rundwege ({wander.length})</h4>
          <div className="chips filter-chips">
            {wander.slice(0, 8).map((w) => (
              <button key={w.id} type="button" className="chip" onClick={() => flyTo([w.lon, w.lat], 14.5)}>
                {w.name}{w.laengeKm ? ` (${w.laengeKm} km)` : ''}
              </button>
            ))}
          </div>
        </>
      )}
      {cItems.length > 0 && (
        <>
          <h4 className="list-head">Jugend-Chillorte der Stadt ({cItems.length})</h4>
          <div className="chips filter-chips">
            {cItems.slice(0, 8).map((c) => (
              <button key={c.id} type="button" className="chip" onClick={() => { select({ type: 'facility', item: c }); flyTo([c.lon, c.lat], 16); }}>
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
      <Source disclosure>
        Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0): Jugend-Chillorte (Jugendamt), Weinwanderwege, Innenstadtrundweg und Downhill-Strecke Degerloch.
      </Source>
    </Section>
  );
}

// ---------- Abend-Tipps: Schließfächer und Fahrradboxen am Hbf, Tagesgericht für Studierende ----------
type BoxSite = {
  id: string | number; name: string; purpose?: string; capacity: number | null; free: number | null;
  live: boolean; bookableUrl: string | null; fee: string | null; dist?: number | null;
};

/** Nächste freie Schließfächer und Fahrradboxen am Hauptbahnhof bzw. in der Stadtmitte, dazu ein Mensa-Tipp */
function AbendTipps({ lngLat }: { lngLat: [number, number] }) {
  // Bezugspunkt Hauptbahnhof (Arnulf-Klett-Platz); der Umkreis deckt die Stadtmitte ab
  const hbf: [number, number] = [9.1808, 48.7831];
  const boxen = usePolling<{ sites: BoxSite[]; lockerSites: BoxSite[]; bikeSites: BoxSite[] }>(
    `/api/bikeandride?lat=${hbf[1]}&lon=${hbf[0]}&radius=3000`, 5 * 60_000,
  );
  const s = boxen.data;
  const locker = (s?.lockerSites ?? []).find((x) => x.free == null || x.free > 0) ?? (s?.lockerSites ?? [])[0];
  const box = (s?.bikeSites ?? []).find((x) => x.free == null || x.free > 0) ?? (s?.bikeSites ?? [])[0];
  return (
    <Section title="Unterwegs am Abend" explain="bikeride" collapsible defaultOpen={false}>
      {locker && (
        <p className="small">
          Nächstes freies Schließfach für Rucksack oder Helm: <strong>{locker.name}</strong>
          {locker.dist != null ? ` (${locker.dist} m)` : ''}
          {locker.free != null && locker.capacity != null ? ` – noch ${locker.free} von ${locker.capacity} frei` : ''}
          {locker.fee ? ` · ${locker.fee}` : ''}
          {locker.bookableUrl && <> · <a href={locker.bookableUrl} target="_blank" rel="noreferrer">Buchen</a></>}
        </p>
      )}
      {box && (
        <p className="small">
          Fahrradbox am Hbf oder in der Stadtmitte: <strong>{box.name}</strong>
          {box.dist != null ? ` (${box.dist} m)` : ''}
          {box.free != null && box.capacity != null ? ` – noch ${box.free} von ${box.capacity} frei` : ''}
          {box.bookableUrl && <> · <a href={box.bookableUrl} target="_blank" rel="noreferrer">Buchen</a></>}
        </p>
      )}
      {!locker && !box && boxen.data && <p className="muted small">Im Umkreis von 3 km sind derzeit keine Schließfächer oder Fahrradboxen erfasst.</p>}
      <MensaSection lngLat={lngLat} compact />
      <p className="muted small">Boxen und Schließfächer: MobiData BW (ParkAPI, dl-de/by-2-0), Echtzeit-Angaben der Betreiber.</p>
    </Section>
  );
}
