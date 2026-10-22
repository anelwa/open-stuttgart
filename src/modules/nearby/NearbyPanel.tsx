import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { usePolling } from '../../lib/api';
import { distM, walkMin } from '../../lib/geo';
import type { Facility } from '../../lib/types';
import { SuggestionList, suggestionKeys, useSuggestions, type SuggestItem } from '../../components/AddressSuggest';
import { Icon } from '../../components/Icon';
import { ErrorNote, LayerRow, Section, Source, SkeletonRows } from '../../components/ui';
import { MensaSection } from '../../components/Mensa';
import { fmtTime } from '../../lib/format';
import { CAT_COLOR, CAT_GROUPS, type FacilitiesResponse } from './cats';
import { MyAddress, type BbItem } from './MyAddress';
import { VerwaltungSection } from './VerwaltungSection';
import { Explain } from '../../lib/info';
import { icsFile } from './ics';
import { openState } from '../../lib/openingHours';
import { tr, useLang } from '../../lib/i18n';

type Origin = { lngLat: [number, number]; label: string; kind: 'karte' | 'gps' | 'adresse' | 'punkt'; street?: string | null; nr?: string | null };
type Addr = { label: string; street: string | null; nr: string | null; lat: number; lon: number };
type Best = { zeit: string; value: number } | null | undefined;
type Quote = { anteil: number; n: number } | null | undefined;
type Bb = BbItem & { waitMin: number | null; best?: Best };
type Bad = { id: number; name: string; count: number; max: number; usual?: { value: number; n: number } | null; best?: Best; areas: { name: string; count: number; max: number }[]; lat?: number; lon?: number; address?: string };
type Waste = { street: string; nr: string; dates: { type: string; date: string; rhythm: string | null }[]; error?: string; source: string };
type Charger = { id: string; name: string; address: string; lat: number; lon: number; operator: string | null; total: number; available: number | null; maxKw: number | null };
type Gruenstrom = { plz: string; aktuell: { t: number; share: number; signal: number; text: string | null } | null; bestesFenster: { von: number; bis: number; share: number } | null } | null;

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);
const readAddr = (): Origin | null => { try { return JSON.parse(localStorage.getItem('os-adresse') ?? 'null'); } catch { return null; } };
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const diff = Math.round((+d - +today) / 86400_000);
  const w = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'numeric' });
  return diff === 0 ? `heute (${w})` : diff === 1 ? `morgen (${w})` : w;
};

const STUFE = (s: number) => (s >= 11 ? 'alle Wartemarken vergeben' : s >= 10 ? '150 Minuten oder mehr' : `etwa ${Math.round(s) * 15} Minuten`);
/** Vergleich mit dem eigenen Verlauf: gleicher Wochentag, gleiche Viertelstunde */
function usualBb(b: Bb) {
  if (!b.usual) return 'Üblich um diese Zeit: noch zu wenige Messungen';
  const diff = b.status - b.usual.value;
  const cmp = Math.abs(diff) < 1 ? 'wie üblich' : diff > 0 ? 'länger als üblich' : 'kürzer als üblich';
  return `Üblich um diese Zeit: ${STUFE(b.usual.value)}, heute ${cmp}`;
}
function quoteText(q: Quote, since: string | null | undefined) {
  const seit = since ? ` Aufzeichnung seit ${new Date(`${since}T12:00:00`).toLocaleDateString('de-DE')}.` : '';
  return q ? `„Üblich um diese Zeit“ traf in den letzten vier Wochen bei ${q.anteil} % von ${q.n} Prüfungen zu.${seit}` : `Trefferquote von „üblich um diese Zeit“ wird ermittelt.${seit}`;
}
function usualBad(b: Bad) {
  if (!b.usual) return 'Üblich um diese Zeit: noch zu wenige Messungen';
  const u = Math.round(b.usual.value);
  const diff = b.count - u;
  const cmp = Math.abs(diff) <= Math.max(10, u * 0.15) ? 'etwa wie üblich' : diff > 0 ? 'voller als üblich' : 'leerer als üblich';
  return `Üblich um diese Zeit: ${u} Personen, heute ${cmp}`;
}

type Geocache = {
  id: string; code: string | null; name: string; art: string | null; groesse: string | null;
  schwierigkeit: number | null; gelaende: number | null; lat: number; lon: number; url: string | null; dist?: number;
};
type GeocacheAntwort = { items: Geocache[]; total: number; error: string | null; source: string; lizenz: string; hinweis: string; suchlink: string };

/** Geocaching über Opencaching.de: nur Startkoordinaten und Listing-Fakten, keine Spoiler. */
function GeocacheSection({ lngLat }: { lngLat: [number, number] }) {
  const g = usePolling<GeocacheAntwort>(`/api/geocaches?lat=${lngLat[1].toFixed(4)}&lon=${lngLat[0].toFixed(4)}&r=5000`, 12 * 3600_000);
  const d = g.data;
  if (!d && !g.error) return null;
  if (!d && g.error) return null;
  return (
    <Section title="Geocaching in der Nähe" explain="geocache" aside={d?.items.length ? `${d.items.length} Caches im Umkreis von 5 km` : undefined}>
      {d?.items.length ? (
        <ul className="near-list">
          {d.items.slice(0, 8).map((c) => (
            <li key={c.id}>
              <a href={c.url ?? d.suchlink} target="_blank" rel="noreferrer" className="near-main" style={{ display: 'flex', gap: 8, padding: '6px 0' }}>
                <span className="near-name">{c.name}{c.code ? ` · ${c.code}` : ''}</span>
                <span className="near-sub">
                  {[c.art, c.groesse, c.schwierigkeit != null ? `D ${c.schwierigkeit}` : null, c.gelaende != null ? `T ${c.gelaende}` : null, c.dist != null ? fmtDist(c.dist) : null].filter(Boolean).join(' · ')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small">
          {d?.error ?? 'Derzeit sind keine Geocaches geladen.'}{' '}
          <a href={d?.suchlink ?? 'https://www.opencaching.de/'} target="_blank" rel="noreferrer">Auf Opencaching.de suchen</a>.
        </p>
      )}
      <p className="muted small">{d?.hinweis}</p>
      <Source>{d?.lizenz ?? 'CC BY-NC-ND 3.0 DE (Opencaching.de), nur Fakten und Link zum Listing.'}</Source>
    </Section>
  );
}

export function NearbyPanel({ center, flyTo, select, setNearby, setLayer, visible, toggle }: ModuleProps) {
  const [origin, setOrigin] = useState<Origin>(() => readAddr() ?? { lngLat: center, label: 'Kartenmitte', kind: 'karte' });
  const [cat, setCat] = useState<string>(() => { try { return localStorage.getItem('os-kategorie') ?? 'spielplatz'; } catch { return 'spielplatz'; } });
  const [diet, setDiet] = useState<'vegan' | 'vegetarian' | null>(null);
  const [onlyDiet, setOnlyDiet] = useState(false);
  const [verwOnMap, setVerwOnMap] = useState(false);
  const [q, setQ] = useState('');
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrActive, setAddrActive] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const addrId = useId();
  const addrInput = useRef<HTMLInputElement>(null);
  const addrBlur = useRef<number | null>(null);

  // Kartenmitte folgt der Karte, solange kein fester Standort gewählt ist
  useEffect(() => { if (origin.kind === 'karte') setOrigin((o) => ({ ...o, lngLat: center })); }, [center, origin.kind]);
  useEffect(() => { try { localStorage.setItem('os-kategorie', cat); } catch { /* egal */ } }, [cat]);
  useEffect(() => { setLayer('nearby', true); return () => setNearby(null); }, [setLayer, setNearby]);

  const addrQuery = q.trim();
  const addr = useSuggestions<{ items: Addr[] }>(
    addrQuery.length >= 3 ? `/api/nearby/adresse?q=${encodeURIComponent(addrQuery)}` : null,
    (d) => {
      const seen = new Set<string>();
      const out: SuggestItem[] = [];
      for (const [i, a] of d.items.entries()) {
        const title = a.street ? [a.street, a.nr].filter(Boolean).join(' ') : a.label.split(',')[0];
        const detail = a.label.includes(',') ? a.label.split(',').slice(1).join(',').trim() : 'Stuttgart';
        const key = `${title}|${detail}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key: `${key}-${i}`,
          title,
          detail,
          kind: 'Adresse',
          icon: 'pin',
          lat: a.lat,
          lon: a.lon,
          street: a.street,
          nr: a.nr,
          id: `${a.lat},${a.lon}`,
        });
      }
      return out;
    },
    220,
  );
  const showAddr = addrOpen && addrQuery.length >= 3;
  useEffect(() => setAddrActive(0), [addrQuery]);
  useEffect(() => () => { if (addrBlur.current) window.clearTimeout(addrBlur.current); }, []);
  const dietParam = diet ? `&diet=${diet}${onlyDiet ? '-only' : ''}` : '';
  const fac = usePolling<FacilitiesResponse>(`/api/nearby/facilities?cat=${cat}${dietParam}`, 24 * 3600_000);
  const bb = usePolling<{ items: Bb[]; source: string; since: string | null; quote: Quote }>('/api/nearby/buergerbueros', 60_000);
  const baeder = usePolling<{ items: Bad[]; source: string; since: string | null; quote: Quote }>('/api/nearby/baeder', 60_000);
  const [lon, lat] = origin.lngLat;
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const laden = usePolling<{ items: Charger[]; gruenstrom?: Gruenstrom; source: string }>(`/api/nearby/laden?lat=${key.split(',')[0]}&lon=${key.split(',')[1]}`, 120_000);
  const [wasteQ, setWasteQ] = useState<{ street: string; nr: string } | null>(() => (origin.street && origin.nr ? { street: origin.street, nr: origin.nr } : null));
  useEffect(() => { if (origin.street && origin.nr) setWasteQ({ street: origin.street, nr: origin.nr }); }, [origin.street, origin.nr]);
  const waste = usePolling<Waste>(wasteQ ? `/api/nearby/abfall?street=${encodeURIComponent(wasteQ.street)}&nr=${encodeURIComponent(wasteQ.nr)}` : null, 6 * 3600_000);

  useLang();
  const essen = cat.startsWith('essen_');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyStep, setOnlyStep] = useState(false);
  const sorted = useMemo(() => (fac.data?.items ?? [])
    .filter((f) => !essen || ((!onlyOpen || openState(f.hours)?.open) && (!onlyStep || f.wheelchair === 'yes')))
    .map((f) => ({ f, d: distM([lon, lat], [f.lon, f.lat]) }))
    .sort((a, b) => a.d - b.d), [fac.data, lon, lat, essen, onlyOpen, onlyStep]);
  useEffect(() => {
    if (verwOnMap || !fac.data) return;
    setNearby({ items: sorted.map((x) => x.f), color: CAT_COLOR });
  }, [verwOnMap, sorted, fac.data, setNearby]);

  const bbNear = useMemo(() => (bb.data?.items ?? []).filter((b) => b.lat != null)
    .map((b) => ({ b, d: distM([lon, lat], [b.lon!, b.lat!]) })).sort((a, b) => a.d - b.d).slice(0, 3), [bb.data, lon, lat]);
  const badNear = useMemo(() => (baeder.data?.items ?? [])
    .map((b) => ({ b, d: b.lat != null ? distM([lon, lat], [b.lon!, b.lat!]) : Infinity })).sort((a, b) => a.d - b.d), [baeder.data, lon, lat]);
  const chargers = useMemo(() => (laden.data?.items ?? [])
    .map((c) => ({ c, d: distM([lon, lat], [c.lon, c.lat]) })).sort((a, b) => a.d - b.d).slice(0, 5), [laden.data, lon, lat]);

  const useGps = () => {
    setGpsError(null);
    if (!navigator.geolocation) { setGpsError('Standortbestimmung wird vom Browser nicht unterstützt.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { const ll: [number, number] = [p.coords.longitude, p.coords.latitude]; setOrigin({ lngLat: ll, label: 'Eigener Standort', kind: 'gps' }); flyTo(ll, 15); },
      () => setGpsError('Standort nicht verfügbar. Bitte Freigabe im Browser prüfen oder eine Adresse eingeben.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const pickAddr = (a: SuggestItem) => {
    const o: Origin = {
      lngLat: [a.lon, a.lat],
      label: [a.title, a.detail && a.detail !== 'Stuttgart' ? a.detail : null].filter(Boolean).join(', '),
      kind: 'adresse',
      street: a.street,
      nr: a.nr,
    };
    setOrigin(o); setQ(''); setAddrOpen(false); flyTo(o.lngLat, 15.5);
    try { localStorage.setItem('os-adresse', JSON.stringify(o)); } catch { /* egal */ }
  };
  const resetOrigin = () => { setOrigin({ lngLat: center, label: 'Kartenmitte', kind: 'karte' }); try { localStorage.removeItem('os-adresse'); } catch { /* egal */ } };
  const open = (f: Facility) => { select({ type: 'facility', item: f }); flyTo([f.lon, f.lat], 16); };

  // Nächster Abfuhrtermin je Abfallart
  const nextWaste = useMemo(() => {
    const seen = new Map<string, Waste['dates'][number]>();
    for (const d of waste.data?.dates ?? []) if (!seen.has(d.type) && d.date >= new Date().toISOString().slice(0, 10)) seen.set(d.type, d);
    return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [waste.data]);

  return (
    <div className="module nearby">
      <div className="culture-hero nearby-hero">
        <span className="eyebrow">{tr('Bezugspunkt')}</span>
        <h3>{origin.label}</h3>
        <div className="nearby-actions">
          <button type="button" className="chip on-dark" onClick={useGps}><Icon name="locate" size={16} /> {tr('Eigener Standort')}</button>
          {origin.kind === 'karte' && <button type="button" className="chip on-dark" onClick={() => setOrigin({ lngLat: center, label: 'Gewählter Punkt', kind: 'punkt' })}><Icon name="pin" size={16} /> {tr('Angaben für die Kartenmitte')}</button>}
          {origin.kind !== 'karte' && <button type="button" className="chip on-dark" onClick={resetOrigin}>{tr('Kartenmitte verwenden')}</button>}
        </div>
        <div className="nearby-search-wrap">
          <div className="nearby-search">
            <Icon name="search" size={16} />
            <input
              ref={addrInput}
              value={q}
              onChange={(e) => { setQ(e.target.value); setAddrOpen(true); }}
              onFocus={() => { if (addrBlur.current) window.clearTimeout(addrBlur.current); setAddrOpen(true); }}
              onBlur={() => { addrBlur.current = window.setTimeout(() => setAddrOpen(false), 120); }}
              onKeyDown={suggestionKeys(addr.items, addrActive, setAddrActive, pickAddr, () => { setAddrOpen(false); addrInput.current?.blur(); })}
              placeholder="Adresse eingeben, z. B. Eberhardstraße 10"
              aria-label="Adresse suchen"
              role="combobox"
              aria-expanded={showAddr}
              aria-controls={addrId}
              aria-autocomplete="list"
              aria-activedescendant={showAddr && addr.items[addrActive] ? `${addrId}-${addrActive}` : undefined}
              autoComplete="off"
            />
            {q && (
              <button type="button" className="suggest-clear" aria-label="Adresseingabe löschen"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setQ(''); setAddrOpen(false); addrInput.current?.focus(); }}>
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
          {showAddr && (
            <SuggestionList id={addrId} items={addr.items} query={addrQuery} active={addrActive}
              loading={addr.loading} error={addr.error} empty="Keine Adresse in Stuttgart gefunden."
              onActive={setAddrActive} onPick={pickAddr} />
          )}
        </div>
        {gpsError && <p className="small">{gpsError}</p>}
      </div>

      {origin.kind !== 'karte'
        ? <MyAddress lngLat={origin.lngLat} street={origin.street} nr={origin.nr} label={origin.label} bb={bb.data?.items ?? []} select={select} flyTo={flyTo} />
        : <p className="muted small nearby-hint">Für Wahllokal, Grundschule, Starkregen, Lärm und Notfall-Treffpunkt eine Adresse eingeben, den eigenen Standort verwenden oder „Angaben für die Kartenmitte“ wählen.</p>}

      <Section title="Auf der Karte" collapsible defaultOpen={false}>
        <LayerRow icon="clock" tone="green" title="Live-Zustände der Stadt" on={visible.live} onToggle={() => toggle('live')}
          meta={`Wartezeit in ${bb.data?.items.length ?? '…'} Bürgerbüros, Besucherzahl in ${baeder.data?.items.length ?? '…'} Bädern`} />
        <LayerRow icon="pin" tone="ink" title="Einrichtungen der gewählten Kategorie" on={visible.nearby} onToggle={() => toggle('nearby')}
          meta={fac.data ? `${fac.data.label}, nächste zuerst` : 'wird geladen'} />
      </Section>

      <Section title="Bürgerbüros, aktuelle Wartezeit" aside={<Explain id="buergerbuero" />}>
        {bb.error && !bb.data && <ErrorNote text="Wartezeitanzeige derzeit nicht erreichbar." onRetry={bb.reload} />}
        {!bb.data && !bb.error && <span className="skeleton block" style={{ height: 120 }} />}
        <ul className="near-list">
          {bbNear.map(({ b, d }) => (
            <li key={b.id}>
              <button type="button" onClick={() => b.lat != null && open({ id: `bb-${b.id}`, cat: 'buergerbuero', name: b.name ?? `Bürgerbüro ${b.label}`, lat: b.lat, lon: b.lon!, address: b.address, booking: b.booking, web: b.url, info: b.notes, live: b.text })}>
                <span className={`wait-dot w-${b.status === 0 ? 'zu' : b.status === 11 ? 'voll' : b.status >= 6 ? 'lang' : b.status >= 3 ? 'mittel' : 'kurz'}`} aria-hidden />
                <span className="near-main">
                  <span className="near-name">{b.name ?? `Bürgerbüro ${b.label}`}</span>
                  <span className="near-sub">{b.text} · {fmtDist(d)}</span>
                  {b.status > 0 && <span className="near-sub usual">{usualBb(b)}</span>}
                  {b.status > 0 && b.best && <span className="near-sub usual">Beste Zeit heute laut Verlauf: {b.best.zeit} Uhr ({STUFE(b.best.value)})</span>}
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">Termine: <a href="https://stuttgart.konsentas.de/" target="_blank" rel="noreferrer">Online-Terminvereinbarung der Bürgerbüros</a>.</p>
        <p className="muted small">{quoteText(bb.data?.quote, bb.data?.since)}</p>
      </Section>

      <VerwaltungSection
        lngLat={origin.lngLat}
        select={select}
        flyTo={flyTo}
        mapActive={verwOnMap}
        onToggleMap={() => setVerwOnMap((v) => !v)}
        setNearby={setNearby}
      />

      <Section title="Abfuhrtermine" aside={<>{waste.data?.street ? `${waste.data.street} ${waste.data.nr}` : null}<Explain id="abfuhr" /></>}>
        {!wasteQ && (
          <form className="waste-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const s = String(f.get('s') ?? '').trim(); const n = String(f.get('n') ?? '').trim(); if (s && n) setWasteQ({ street: s, nr: n }); }}>
            <input name="s" placeholder="Straße" aria-label="Straße" />
            <input name="n" placeholder="Nr." aria-label="Hausnummer" className="nr" />
            <button type="submit" className="chip">Abfragen</button>
          </form>
        )}
        {wasteQ && !waste.data && !waste.error && <span className="skeleton block" style={{ height: 80 }} />}
        {waste.error && <ErrorNote text="Abfuhrtermine derzeit nicht abrufbar." onRetry={waste.reload} />}
        {waste.data?.error && <p className="small warn-text">{waste.data.error}</p>}
        {nextWaste.length > 0 && (
          <dl className="facts waste-list">
            {nextWaste.map((d) => <div key={d.type}><dt><i className={`bin bin-${d.type.replace(/\s/g, '').toLowerCase()}`} />{d.type}</dt><dd>{dayLabel(d.date)}{d.rhythm ? `, ${d.rhythm.replace('-wöchentl.', '-wöchentlich').replace(/^0/, '')}` : ''}</dd></div>)}
          </dl>
        )}
        <div className="row-actions">
          {waste.data?.dates?.length ? <button type="button" className="chip" onClick={() => icsFile(waste.data!)}><Icon name="calendar" size={16} /> Als Kalenderdatei speichern</button> : null}
          {wasteQ && <button type="button" className="link-quiet small" onClick={() => setWasteQ(null)}>Andere Adresse</button>}
        </div>
        <p className="muted small">Quelle: Abfallwirtschaft Stuttgart. Sperrmüll und Grüngut über die <a href="https://www.stuttgart.de/aws" target="_blank" rel="noreferrer">AWS</a> anmelden.</p>
      </Section>

      <Section title="Einrichtungen in der Nähe" aside={<>{fac.data ? `${fac.data.items.length} im Stadtgebiet` : null}<Explain id={essen ? "gastro" : "einrichtungen"} /></>}>
        {CAT_GROUPS.map((g) => (
          <div key={g.label} className="cat-group">
            <span className="cat-group-label">{tr(g.label)}</span>
            <div className="chips filter-chips">
              {g.cats.map((c) => (
                <button key={c.id} type="button" className={`chip ${!verwOnMap && cat === c.id ? 'on' : ''}`} onClick={() => { setVerwOnMap(false); setCat(c.id); if (!c.id.startsWith('essen_')) { setDiet(null); setOnlyDiet(false); } }}>
                  <i className="cat-dot" style={{ background: CAT_COLOR[c.id] }} />{tr(c.label)}
                </button>
              ))}
            </div>
          </div>
        ))}
        {essen && (
          <>
            <div className="chips filter-chips essen-filter">
              <button type="button" className={`chip ${onlyOpen ? 'on' : ''}`} aria-pressed={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>{tr('Jetzt geöffnet')}</button>
              <button type="button" className={`chip ${onlyStep ? 'on' : ''}`} aria-pressed={onlyStep} onClick={() => setOnlyStep((v) => !v)}>{tr('Stufenlos zugänglich')}</button>
              <button type="button" className={`chip ${diet === 'vegan' ? 'on' : ''}`} aria-pressed={diet === 'vegan'} onClick={() => { setDiet(diet === 'vegan' ? null : 'vegan'); setOnlyDiet(false); }}>Vegan</button>
              <button type="button" className={`chip ${diet === 'vegetarian' ? 'on' : ''}`} aria-pressed={diet === 'vegetarian'} onClick={() => { setDiet(diet === 'vegetarian' ? null : 'vegetarian'); setOnlyDiet(false); }}>Vegetarisch</button>
              {diet && (
                <button type="button" className={`chip ${onlyDiet ? 'on' : ''}`} aria-pressed={onlyDiet} onClick={() => setOnlyDiet((v) => !v)}>
                  Nur komplett {diet === 'vegan' ? 'vegan' : 'vegetarisch'}
                </button>
              )}
            </div>
            {diet && (
              <p className="muted small diet-note">
                {onlyDiet
                  ? `Nur Betriebe, die laut OpenStreetMap ausschließlich ${diet === 'vegan' ? 'vegan' : 'vegetarisch'} sind.`
                  : `Alle Betriebe mit ${diet === 'vegan' ? 'veganen' : 'vegetarischen'} Gerichten – auch solche, die zusätzlich Fleisch anbieten.`}
                {' '}Die Angabe stammt aus OpenStreetMap und kann veraltet sein; maßgeblich ist die Karte des Betriebs.
              </p>
            )}
          </>
        )}
        {fac.error && !fac.data && <ErrorNote text="Daten derzeit nicht abrufbar." onRetry={fac.reload} />}
        {!fac.data && !fac.error && <SkeletonRows rows={5} />}
        <ul className="near-list">
          {sorted.slice(0, 8).map(({ f, d }) => (
            <li key={f.id}>
              <button type="button" onClick={() => open(f)}>
                <span className="walk"><Icon name="walk" size={16} /><strong>{walkMin(d)}</strong><small>min</small></span>
                <span className="near-main">
                  <span className="near-name">{f.name}{f.diet && <span className={`diet-tag diet-${f.diet}`}>{f.diet === 'vegan-only' ? 'nur vegan' : f.diet === 'vegan' ? 'vegan' : f.diet === 'vegetarian-only' ? 'nur vegetarisch' : 'vegetarisch'}</span>}</span>
                  <span className="near-sub">{[fmtDist(d), essen ? openState(f.hours)?.text ?? (f.hours ? 'Öffnungszeiten siehe Eintrag' : 'Öffnungszeiten nicht erfasst') : f.address, ...(f.info ?? []).slice(0, essen ? 1 : 2)].filter(Boolean).join(' · ')}</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {cat.startsWith('verein_') && (
        <p className="muted small nearby-hint">
          Gezeigt werden öffentliche Sportanlagen, Bürgerhäuser, Jugendtreffs und Kulturorte mit eigener Adresse – keine Wohnadressen
          von Vorständen. Vereine ohne eigenes Vereinsheim erscheinen deshalb nicht als Kartenpunkt. Angaben aus dem städtischen
          Einrichtungsverzeichnis (CC BY 4.0); für verbindliche Auskünfte gilt die verlinkte Seite der Einrichtung. <Explain id="vereine" />
        </p>
      )}

      {essen && (
        <p className="muted small nearby-hint">
          Essen und Trinken: Angaben aus OpenStreetMap ohne Bewertung und ohne bezahlte Reihenfolge, nächste zuerst. Ergebnisse amtlicher
          Lebensmittelkontrollen veröffentlicht das Land auf <a href="https://www.verbraucherinfo-bw.de/" target="_blank" rel="noreferrer">verbraucherinfo-bw.de</a>.
        </p>
      )}

      <MensaSection lngLat={origin.lngLat} />

      <GeocacheSection lngLat={origin.lngLat} />

      <Section title="Bäder, aktuelle Besucherzahl" aside={<Explain id="baeder" />}>
        <ul className="bath-list">
          {badNear.map(({ b, d }) => {
            const pct = b.max ? Math.min(100, Math.round((b.count / b.max) * 100)) : 0;
            return (
              <li key={b.id}>
                <div className="bath-head"><strong>{b.name}</strong><span className="muted small">{Number.isFinite(d) ? fmtDist(d) : ''}</span></div>
                <div className={`bath-bar ${pct >= 90 ? 'crit' : pct >= 70 ? 'warn' : ''}`}><span style={{ width: `${pct}%` }} /></div>
                <span className="small muted">{b.count} von {b.max} Personen{b.count > b.max ? ' (Kapazität überschritten)' : ''}{b.areas.filter((a) => /sauna/i.test(a.name)).map((a) => ` · Sauna: ${a.count} von ${a.max}`).join('')}</span>
                {b.max > 0 && <span className="small muted block">{usualBad(b)}{b.best ? `; am wenigsten los heute laut Verlauf um ${b.best.zeit} Uhr (etwa ${Math.round(b.best.value)} Personen)` : ''}</span>}
              </li>
            );
          })}
        </ul>
      </Section>

      {baeder.data && <p className="muted small nearby-hint">{quoteText(baeder.data.quote, baeder.data.since)}</p>}

      <Section title="Ladepunkte im Umkreis von 1 km" aside={<>{chargers.length ? `${laden.data?.items.length} Standorte` : null}<Explain id="laden" /></>}>
        {laden.data?.gruenstrom?.aktuell && (
          <p className="small">
            Aktuell {Math.round(laden.data.gruenstrom.aktuell.share)} % Grünstrom im Stuttgarter Netz
            {laden.data.gruenstrom.bestesFenster
              ? ` – grüner Spitzenwert im Vorhersagezeitraum von ${fmtTime(laden.data.gruenstrom.bestesFenster.von)} bis ${fmtTime(laden.data.gruenstrom.bestesFenster.bis)} Uhr (rund ${Math.round(laden.data.gruenstrom.bestesFenster.share)} %).`
              : '.'}
          </p>
        )}
        {laden.data && !chargers.length && <p className="muted small">Keine Ladepunkte im Umkreis.</p>}
        <ul className="near-list">
          {chargers.map(({ c, d }) => (
            <li key={c.id}>
              <button type="button" onClick={() => open({ id: `lp-${c.id}`, cat: 'laden', name: c.name, lat: c.lat, lon: c.lon, address: c.address,
                info: [c.operator, `${c.total} Ladepunkte`, c.maxKw ? `bis ${c.maxKw} kW` : null].filter(Boolean) as string[],
                live: c.available != null ? `${c.available} von ${c.total} frei` : 'Belegung nicht gemeldet' })}>
                <span className="near-main">
                  <span className="near-name">{c.name}</span>
                  <span className="near-sub">{[fmtDist(d), `${c.total} Ladepunkte`, c.maxKw ? `bis ${c.maxKw} kW` : null, c.available != null ? `${c.available} frei` : 'Belegung nicht gemeldet'].filter(Boolean).join(' · ')}</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Source disclosure>
        Einrichtungen: Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0). Wartezeiten: Bürgerbüros der Stadt. Besucherzahlen: Stuttgarter Bäder.
        Abfuhrtermine: AWS. Ladepunkte: MobiData BW (OCPDB). Adresssuche © OpenStreetMap-Mitwirkende. Entfernungen in Luftlinie.
        Der Standort wird nur für diese Abfragen verwendet und nicht gespeichert. Eine eingegebene Adresse bleibt lokal auf diesem Gerät gespeichert.
      </Source>
    </div>
  );
}
