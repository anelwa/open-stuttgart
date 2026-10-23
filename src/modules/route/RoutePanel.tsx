// Verbindung und Weg: ÖPNV von Tür zu Tür (EFA, auf Wunsch stufenlos), Fahrrad, Pedelec, zu Fuß, Auto.
// Keine Navigation mit Ansage: für den Weg selbst wird an Navigations-Apps übergeben.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { useOnDemand, usePolling } from '../../lib/api';
import { useData } from '../../lib/data';
import { distToLine } from '../../lib/geo';
import { fmtTime } from '../../lib/format';
import { lineColors } from '../../lib/lines';
import { handoffLinks, type Place } from '../../lib/routeCtx';
import { FUELS, fmtPrice, fmtStand, fuelPrice, tankFacility, type Fuel, type TankResponse } from '../../lib/tanken';
import { tr } from '../../lib/i18n';
import { SuggestionList, suggestionKeys, useSuggestions, type SuggestItem } from '../../components/AddressSuggest';
import { Icon } from '../../components/Icon';
import { LineBadge } from '../../components/LineBadge';
import { Sparkline } from '../../components/Sparkline';
import { ErrorNote, Section, Source, SkeletonRows } from '../../components/ui';
import type { WanderwegeAntwort } from '../../lib/types';

type Ebene = { typ: string; richtung?: string; beschreibung: string; status?: string; stand?: string | null; statusHinweis?: string };
type Leg = {
  art: string; von: string; nach: string; ab?: string; abPrognose?: string; an?: string; anPrognose?: string; dauerMin: number; meter?: number;
  linie?: string; richtung?: string; steigVon?: string; steigNach?: string; verspaetungMin?: number; echtzeit?: boolean; ausfall?: boolean;
  rollstuhl?: boolean | null; niederflur?: boolean | null; geometrie?: [number, number][]; anweisungen?: string[]; ebenenwechsel?: Ebene[]; hinweise?: string[]; stoerungen?: string[];
};
type Variante = {
  ab?: string; abPrognose?: string; an?: string; anPrognose?: string; dauerMin: number; umstiege?: number; fussMeter?: number; anstiegMeter?: number | null;
  ausfall?: boolean; nutzbar?: boolean; hinweise: string[]; abschnitte: Leg[]; bezeichnung?: string; meter?: number; abstiegMeter?: number; hoehenprofil?: { intervallMeter: number; werte: number[] };
};
type Route = { modus: string; profil: string; quelle: string; hinweise: string[]; varianten: Variante[] };
type Hit = { label: string; typ: string; id: string; lat: number; lon: number; ort?: string | null };

const MODES = [
  { id: 'oepnv', label: 'Bus und Bahn', icon: 'train' },
  { id: 'rad', label: 'Rad', icon: 'bike' },
  { id: 'fuss', label: 'zu Fuß', icon: 'walk' },
  { id: 'auto', label: 'Auto', icon: 'car' },
] as const;
const PROFILES = [{ id: 'standard', label: 'Standard' }, { id: 'rollstuhl', label: 'Stufenlos' }, { id: 'kinderwagen', label: 'Mit Kinderwagen' }];
const dur = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`);
const km = (m?: number) => (m == null ? '' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);
const pid = (p: Place) => p.id ?? `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
const readAddr = (): Place | null => { try { const o = JSON.parse(localStorage.getItem('os-adresse') ?? 'null'); return o ? { lat: o.lngLat[1], lon: o.lngLat[0], label: o.label } : null; } catch { return null; } };

const ORT_KIND: Record<string, { label: string; icon: string }> = {
  haltestelle: { label: 'Haltestelle', icon: 'stop' },
  adresse: { label: 'Adresse', icon: 'pin' },
  strasse: { label: 'Straße', icon: 'route' },
  ort: { label: 'Ort', icon: 'pin' },
  ortsteil: { label: 'Stadtteil', icon: 'pin' },
  gemeinde: { label: 'Gemeinde', icon: 'pin' },
};

function PlaceField({ label, value, onChange, center }: { label: string; value: Place | null; onChange: (p: Place | null) => void; center: [number, number] }) {
  const id = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);
  const query = q.trim();
  const { items, loading, error } = useSuggestions<{ results: Hit[] }>(
    query.length >= 2 ? `/api/orte/suche?q=${encodeURIComponent(query)}` : null,
    (d) => {
      const seen = new Set<string>();
      const out: SuggestItem[] = [];
      for (const [i, h] of d.results.entries()) {
        const kind = ORT_KIND[h.typ] ?? { label: 'Ort', icon: 'pin' };
        const title = h.label.replace(/^Stuttgart,\s*/, '');
        const key = `${title}|${h.typ}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key: `${h.id}-${i}`,
          title,
          detail: h.ort && h.ort !== 'Stuttgart' ? h.ort : null,
          kind: kind.label,
          icon: kind.icon,
          lat: h.lat,
          lon: h.lon,
          id: h.id,
        });
      }
      return out;
    },
    180,
  );
  const show = open && query.length >= 2;

  useEffect(() => setActive(0), [query]);
  useEffect(() => () => { if (blurTimer.current) window.clearTimeout(blurTimer.current); }, []);

  const pick = (s: SuggestItem) => {
    onChange({ lat: s.lat, lon: s.lon, label: s.title, id: s.id });
    setQ('');
    setOpen(false);
  };
  const close = () => { setOpen(false); inputRef.current?.blur(); };
  const home = readAddr();
  const gps = () => {
    setErr(null);
    navigator.geolocation?.getCurrentPosition(
      (p) => onChange({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'Eigener Standort' }),
      () => setErr('Standort nicht verfügbar. Bitte Freigabe im Browser prüfen oder einen Ort eingeben.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <div className="place-field">
      <span className="eyebrow">{label}</span>
      {value ? (
        <div className="place-chosen">
          <strong>{value.label}</strong>
          <button type="button" className="link-quiet small" onClick={() => {
            onChange(null);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}>Ändern</button>
        </div>
      ) : (
        <>
          <div className="nearby-search-wrap">
            <div className="nearby-search">
              <Icon name="search" size={16} />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => { if (blurTimer.current) window.clearTimeout(blurTimer.current); setOpen(true); }}
                onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 120); }}
                onKeyDown={suggestionKeys(items, active, setActive, pick, close)}
                placeholder="Haltestelle, Adresse oder Ort"
                aria-label={`${label}: Haltestelle, Adresse oder Ort`}
                role="combobox"
                aria-expanded={show}
                aria-controls={id}
                aria-autocomplete="list"
                aria-activedescendant={show && items[active] ? `${id}-${active}` : undefined}
                autoComplete="off"
              />
              {q && (
                <button type="button" className="suggest-clear" aria-label="Eingabe löschen"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setQ(''); setOpen(false); inputRef.current?.focus(); }}>
                  <Icon name="close" size={15} />
                </button>
              )}
            </div>
            {show && (
              <SuggestionList id={id} items={items} query={query} active={active} loading={loading} error={error}
                empty="Kein Ort gefunden." onActive={setActive} onPick={pick} />
            )}
          </div>
          <div className="nearby-actions">
            <button type="button" className="chip on-dark" onClick={gps}><Icon name="locate" size={16} /> Eigener Standort</button>
            {home && <button type="button" className="chip on-dark" onClick={() => onChange(home)}><Icon name="home" size={16} /> {home.label}</button>}
            <button type="button" className="chip on-dark" onClick={() => onChange({ lat: center[1], lon: center[0], label: 'Kartenmitte' })}>Kartenmitte</button>
          </div>
          {err && <p className="small">{err}</p>}
        </>
      )}
    </div>
  );
}

/** Ausgeschilderte Wege der Stadt: Weinwanderwege, Innenstadtrundweg und Woodpecker-Trail. */
function WanderSection({ fitBounds, flyTo, setRoute, setLayer, select }: { fitBounds: ModuleProps['fitBounds']; flyTo: ModuleProps['flyTo']; setRoute: (g: GeoJSON.FeatureCollection | null) => void; setLayer: (k: 'hike', on: boolean) => void; select: ModuleProps['select'] }) {
  const d = usePolling<WanderwegeAntwort>('/api/wanderwege', 24 * 3600_000);
  const [art, setArt] = useState<'alle' | 'wein' | 'innenstadt' | 'downhill' | 'osm'>('alle');
  const items = (d.data?.items ?? []).filter((w) => art === 'alle' || w.art === art);
  if (d.error && !d.data) return null;
  const startOf = (g: GeoJSON.Geometry): [number, number] | null => g.type === 'LineString' ? (g.coordinates[0] as [number, number])
    : g.type === 'MultiLineString' ? (g.coordinates[0]?.[0] as [number, number]) : null;
  const show = (w: (typeof items)[number]) => {
    const start = startOf(w.geometrie);
    setRoute({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: w.geometrie, properties: { color: w.farbe } },
        ...(start ? [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: start }, properties: { role: 'start', label: 'Start' } }] : []),
      ],
    });
    setLayer('hike', false);
    const [minLon, minLat, maxLon, maxLat] = w.bbox;
    if ([minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
      fitBounds([[minLon, minLat], [maxLon, maxLat]], { maxZoom: 14.5 });
    }
  };
  return (
    <Section title="Wanderwege und Rundwege" explain="wanderwege" aside={d.data ? `${d.data.items.length} Wege` : undefined}>
      <p className="muted small">
        Offizielle Routen der Stadt mit Länge, Auf- und Abstieg sowie Haltestellen am Start und Ziel. Beim Anklicken wird die Linie
        auf der Karte gezeigt; die Haltestellen öffnen den Abfahrtsmonitor.
      </p>
      <div className="chips filter-chips">
        {([['alle', 'Alle'], ['wein', 'Weinwanderwege'], ['osm', 'OSM-Wanderwege'], ['innenstadt', 'Innenstadt'], ['downhill', 'Downhill']] as const).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${art === id ? 'on' : ''}`} aria-pressed={art === id} onClick={() => setArt(id)}>{label}</button>
        ))}
        <button type="button" className="chip" onClick={() => setLayer('hike', true)}>Alle Linien auf der Karte</button>
      </div>
      {!d.data && !d.error && <span className="skeleton block" style={{ height: 120 }} />}
      <ul className="near-list">
        {items.map((w) => (
          <li key={w.id}>
            <button type="button" onClick={() => show(w)}>
              <span className="walk" aria-hidden><Icon name={w.art === 'downhill' ? 'bike' : 'walk'} size={18} /></span>
              <span className="near-main">
                <span className="near-name">{w.name}</span>
                <span className="near-sub">
                  {w.artLabel} · {w.laengeKm.toLocaleString('de-DE')} km
                  {w.aufstiegM != null ? ` · ↑ ${w.aufstiegM} m` : ''}{w.abstiegM != null ? ` · ↓ ${w.abstiegM} m` : ''}
                </span>
                <span className="near-sub muted small">
                  {w.start ? `Start: ${w.start}` : ''}{w.ziel ? ` · Ziel: ${w.ziel}` : ''}
                  {w.brunnen ? ` · ${w.brunnen} Trinkbrunnen` : ''}{w.toiletten ? ` · ${w.toiletten} Toiletten` : ''}
                </span>
              </span>
              <Icon name="chevron" size={16} className="muted" />
            </button>
            {(w.startStop || w.endStop) && (
              <div className="row-actions">
                {((w.startStop && w.endStop && w.startStop.id === w.endStop.id
                  ? [['Start/Ziel', w.startStop]]
                  : [['Start', w.startStop], ['Ziel', w.endStop]]) as readonly (readonly [string, typeof w.startStop])[]).map(([label, st]) => st && (
                  <button key={`${w.id}-${label}`} type="button" className="chip" onClick={() => {
                    select({ type: 'stop', id: st.id, name: st.name, lngLat: [st.lon, st.lat], lines: st.lines });
                    flyTo([st.lon, st.lat], 15.5);
                  }}>
                    {label}: Abfahrten {st.name}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">{d.data?.hinweis}</p>
      <Source>{d.data?.source ?? 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0).'}</Source>
    </Section>
  );
}

function legColor(l: Leg) {
  if (l.art === 'fuss') return '#5D5C62';
  if (l.art === 'rad') return '#1E8A4F';
  if (l.art === 'auto') return '#2B59C3';
  return l.linie ? lineColors(l.linie).bg : '#26262C';
}

/** Umschließendes Rechteck einer Feature-Sammlung; deckt auch MultiLineString und Polygone ab. */
function boundsOf(fc: GeoJSON.FeatureCollection): [[number, number], [number, number]] | null {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const add = ([lon, lat]: GeoJSON.Position) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  };
  const walk = (g: GeoJSON.Geometry) => {
    switch (g.type) {
      case 'Point': add(g.coordinates); break;
      case 'MultiPoint': case 'LineString': g.coordinates.forEach(add); break;
      case 'MultiLineString': case 'Polygon': g.coordinates.forEach((ring) => ring.forEach(add)); break;
      case 'MultiPolygon': g.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(add))); break;
      case 'GeometryCollection': g.geometries.forEach(walk); break;
    }
  };
  for (const f of fc.features) if (f.geometry) walk(f.geometry);
  return minLon <= maxLon ? [[minLon, minLat], [maxLon, maxLat]] : null;
}

export function RoutePanel({ center, flyTo, fitBounds, select, setRoute, routeTarget, setLayer, setNearby, botCommand }: ModuleProps) {
  const { unfaelle } = useData();
  const [von, setVon] = useState<Place | null>(() => routeTarget?.from ?? readAddr());
  const [nach, setNach] = useState<Place | null>(routeTarget);
  const [profil, setProfil] = useState<string>(routeTarget?.profile ?? 'standard');
  const [mode, setMode] = useState<string>(routeTarget?.mode ?? 'oepnv');
  const [sel, setSel] = useState(0);
  const [zeit, setZeit] = useState('');
  useEffect(() => {
    if (!routeTarget) return;
    if (routeTarget.from) setVon(routeTarget.from);
    setNach(routeTarget);
    if (routeTarget.mode) setMode(routeTarget.mode);
    if (routeTarget.profile) setProfil(routeTarget.profile);
    setSel(0);
  }, [routeTarget]);

  // Typisierte Wünsche aus dem Bot: „nimm das Rad“, „stufenlos“, „in einer Stunde“.
  const lastBotCommand = useRef('');
  useEffect(() => {
    if (!botCommand || botCommand.module !== 'route') return;
    if (lastBotCommand.current === botCommand.id) return;
    lastBotCommand.current = botCommand.id;
    const a = botCommand.args ?? {};
    if (botCommand.command === 'mode' && ['oepnv', 'rad', 'fuss', 'auto'].includes(String(a.mode))) {
      setMode(String(a.mode)); setSel(0);
    } else if (botCommand.command === 'profile' && ['standard', 'rollstuhl', 'kinderwagen'].includes(String(a.profile))) {
      setProfil(String(a.profile)); setSel(0);
    } else if (botCommand.command === 'time') {
      setZeit(String(a.time ?? '')); setSel(0);
    } else if (botCommand.command === 'now') {
      setZeit(''); setSel(0);
    } else if (botCommand.command === 'swap') {
      setVon(nach); setNach(von); setSel(0);
    }
  }, [botCommand, nach, von]);
  useEffect(() => { setLayer('route', true); return () => setRoute(null); }, [setLayer, setRoute]);

  const base = von && nach ? `/api/route?von=${encodeURIComponent(pid(von))}&nach=${encodeURIComponent(pid(nach))}&profil=${profil}${zeit ? `&zeit=${encodeURIComponent(zeit)}` : ''}` : null;
  const oepnv = usePolling<Route>(base ? `${base}&modus=oepnv` : null, 60_000);
  const rad = usePolling<Route>(base ? `${base}&modus=rad` : null, 24 * 3600_000);
  const fuss = usePolling<Route>(base ? `${base}&modus=fuss` : null, 24 * 3600_000);
  const auto = usePolling<Route>(base && profil === 'standard' ? `${base}&modus=auto` : null, 24 * 3600_000);
  const res: Record<string, typeof oepnv> = { oepnv, rad, fuss, auto };
  const cur = res[mode];
  const v = cur.data?.varianten[Math.min(sel, (cur.data?.varianten.length ?? 1) - 1)];
  const [tankFuel, setTankFuel] = useState<Fuel>('e10');
  const tanken = useOnDemand<TankResponse>(mode === 'auto' && base ? '/api/nearby/tanken' : null);

  // Unfallatlas im 30-Meter-Korridor der gewählten Route (nur Unfälle mit Personenschaden)
  const unfallRoute = useMemo(() => {
    const lines = (v?.abschnitte ?? []).flatMap((l) => (l.geometrie && l.geometrie.length > 1 ? [l.geometrie] : []));
    const all = unfaelle.data?.items ?? [];
    if (!lines.length || !all.length) return null;
    const lons = lines.flat().map((p) => p[0]);
    const lats = lines.flat().map((p) => p[1]);
    const minLon = Math.min(...lons) - 0.001, maxLon = Math.max(...lons) + 0.001;
    const minLat = Math.min(...lats) - 0.001, maxLat = Math.max(...lats) + 0.001;
    const pts = all.filter((u) => u.lon >= minLon && u.lon <= maxLon && u.lat >= minLat && u.lat <= maxLat)
      .map((u) => ({ ...u, dist: Math.min(...lines.map((line) => distToLine([u.lon, u.lat], line))) }))
      .filter((u) => u.dist <= 30);
    return {
      total: pts.length,
      rad: pts.filter((u) => u.rad).length,
      fuss: pts.filter((u) => u.fuss).length,
      tote: pts.filter((u) => u.kategorie === 1).length,
      schwer: pts.filter((u) => u.kategorie === 2).length,
      items: pts.sort((a, b) => a.dist - b.dist).slice(0, 4),
    };
  }, [v, unfaelle.data]);

  // Günstigste Tankstellen im 1,5-km-Korridor der Auto-Route.
  const tankRoute = useMemo(() => {
    if (mode !== 'auto') return null;
    const lines = (v?.abschnitte ?? []).flatMap((l) => (l.geometrie && l.geometrie.length > 1 ? [l.geometrie] : []));
    const all = tanken.data?.stations ?? [];
    if (!lines.length || !all.length) return null;
    const lons = lines.flat().map((p) => p[0]);
    const lats = lines.flat().map((p) => p[1]);
    const pad = 0.02;
    const minLon = Math.min(...lons) - pad, maxLon = Math.max(...lons) + pad;
    const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
    const near = all
      .filter((s) => s.lon >= minLon && s.lon <= maxLon && s.lat >= minLat && s.lat <= maxLat)
      .map((s) => ({ ...s, dist: Math.min(...lines.map((line) => distToLine([s.lon, s.lat], line))) }))
      .filter((s) => s.dist <= 1500);
    const withPrice = near.filter((s) => fuelPrice(s, tankFuel) != null);
    return {
      total: near.length,
      items: withPrice.sort((a, b) => {
        if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
        return (fuelPrice(a, tankFuel)! - fuelPrice(b, tankFuel)!) || a.dist - b.dist;
      }).slice(0, 3),
      all: near,
    };
  }, [mode, v, tanken.data, tankFuel]);

  // Gewählte Variante auf der Karte: Linien, Start und Ziel. Der Ausschnitt wird nur bei
  // einem echten Wechsel neu gesetzt, nicht bei jeder Aktualisierung der Echtzeitdaten.
  const lastFit = useRef('');
  useEffect(() => {
    if (!von || !nach) { setRoute(null); lastFit.current = ''; return; }
    if (!v) return;
    const feats: GeoJSON.Feature[] = v.abschnitte.filter((l) => (l.geometrie?.length ?? 0) > 1).map((l) => ({
      type: 'Feature', geometry: { type: 'LineString', coordinates: l.geometrie! }, properties: { color: legColor(mode === 'rad' ? { ...l, art: 'rad' } : mode === 'auto' ? { ...l, art: 'auto' } : l), walk: l.art === 'fuss' && mode !== 'rad' && mode !== 'auto' },
    }));
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [von.lon, von.lat] }, properties: { role: 'start', label: 'Start' } });
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [nach.lon, nach.lat] }, properties: { role: 'end', label: 'Ziel' } });
    const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: feats };
    setRoute(fc);

    const first = v.abschnitte.find((l) => (l.geometrie?.length ?? 0) > 1)?.geometrie?.[0];
    const lastLeg = [...v.abschnitte].reverse().find((l) => (l.geometrie?.length ?? 0) > 1)?.geometrie;
    const fitKey = [mode, sel, von.lat, von.lon, nach.lat, nach.lon, first?.join(','), lastLeg?.at(-1)?.join(',')].join('|');
    if (fitKey === lastFit.current) return;
    lastFit.current = fitKey;
    const b = boundsOf(fc);
    if (b) fitBounds(b, { maxZoom: 16 });
  }, [v, von, nach, mode, sel, setRoute, fitBounds]);

  useEffect(() => {
    if (!von || !nach) return;
    if (!v && (cur.data || cur.error)) {
      setRoute(null);
      lastFit.current = '';
    }
  }, [v, cur.data, cur.error, von, nach, setRoute]);

  const summary = (id: string) => {
    const r = res[id];
    if (id === 'auto' && profil !== 'standard') return 'nicht bei diesem Profil';
    if (r.error && !r.data) return 'nicht verfügbar';
    if (!r.data) return '…';
    const f = r.data.varianten[0];
    if (!f) return 'keine Verbindung';
    if (id === 'oepnv') return `${dur(f.dauerMin)}${f.ab ? `, ab ${fmtTime(f.abPrognose ?? f.ab)}` : ''}`;
    if (id === 'rad') return r.data.varianten.map((x) => `${x.bezeichnung ?? 'Rad'} ${dur(x.dauerMin)}`).join(' · ');
    return `${dur(f.dauerMin)}${f.anstiegMeter ? `, ${f.anstiegMeter} m Anstieg` : ''}`;
  };

  return (
    <div className="module route">
      <div className="culture-hero nearby-hero route-hero">
        <PlaceField label="Von" value={von} onChange={(p) => { setVon(p); setSel(0); }} center={center} />
        <button type="button" className="icon-btn swap" aria-label="Start und Ziel tauschen" title="Start und Ziel tauschen" onClick={() => { setVon(nach); setNach(von); setSel(0); }}><Icon name="swap" size={18} /></button>
        <PlaceField label="Nach" value={nach} onChange={(p) => { setNach(p); setSel(0); }} center={center} />
        <div className="route-opts">
          <div className="seg" role="radiogroup" aria-label="Profil">
            {PROFILES.map((p) => <button key={p.id} type="button" role="radio" aria-checked={profil === p.id} className={profil === p.id ? 'on' : ''} onClick={() => { setProfil(p.id); setSel(0); }}>{p.label}</button>)}
          </div>
          <label className="small route-time">Abfahrt <input type="datetime-local" value={zeit} onChange={(e) => setZeit(e.target.value)} aria-label="Abfahrtszeit, leer für jetzt" />{zeit && <button type="button" className="link-quiet small" onClick={() => setZeit('')}>jetzt</button>}</label>
        </div>
      </div>

      {!base && <p className="muted small nearby-hint">Start und Ziel wählen. In jeder Detailansicht führt „Verbindung suchen“ hierher.</p>}

      {base && (
        <>
          <div className="mode-compare" role="tablist" aria-label="Verkehrsart">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => { setMode(m.id); setSel(0); }}>
                <Icon name={m.icon} size={18} /><span className="mc-label">{m.label}</span><span className="mc-val">{summary(m.id)}</span>
              </button>
            ))}
          </div>

          {cur.error && !cur.data && <ErrorNote text="Verbindung derzeit nicht abrufbar." onRetry={cur.reload} />}
          {cur.loading && !cur.data && <div style={{ margin: "0 20px" }}><SkeletonRows rows={4} /></div>}
          {cur.data && cur.data.hinweise.length > 0 && <ul className="route-notes">{cur.data.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}

          {mode === 'oepnv' && cur.data && (
            <Section title="Verbindungen" explain="route">
              <ul className="trip-list">
                {cur.data.varianten.map((x, i) => (
                  <li key={i}>
                    <button type="button" className={i === sel ? 'on' : ''} aria-pressed={i === sel} onClick={() => setSel(i)}>
                      <span className="trip-time"><strong>{fmtTime(x.abPrognose ?? x.ab!)}</strong> bis {fmtTime(x.anPrognose ?? x.an!)}</span>
                      <span className="trip-lines">{x.abschnitte.filter((l) => l.linie).map((l, k) => <LineBadge key={k} line={l.linie!} size="sm" />)}</span>
                      <span className="trip-meta">{dur(x.dauerMin)} · {x.umstiege ? `${x.umstiege} Umstieg${x.umstiege > 1 ? 'e' : ''}` : 'ohne Umstieg'}{x.fussMeter ? ` · ${km(x.fussMeter)} zu Fuß` : ''}{x.nutzbar === false ? ' · Aufzug gestört' : ''}{x.ausfall ? ' · Ausfall' : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {v && (
            <Section title={mode === 'oepnv' ? 'Verlauf' : (v.bezeichnung ?? MODES.find((m) => m.id === mode)!.label)} explain="route">
              {mode !== 'oepnv' && (
                <dl className="facts">
                  <div><dt>Dauer</dt><dd>{dur(v.dauerMin)}{mode === 'rad' && cur.data!.varianten.length > 1 ? ` (${cur.data!.varianten.map((x) => `${x.bezeichnung} ${dur(x.dauerMin)}`).join(', ')})` : ''}</dd></div>
                  <div><dt>Strecke</dt><dd>{km(v.meter)}</dd></div>
                  {v.anstiegMeter != null && <div><dt>Höhenmeter</dt><dd>{v.anstiegMeter} m bergauf{v.abstiegMeter != null ? `, ${v.abstiegMeter} m bergab` : ''}</dd></div>}
                </dl>
              )}
              {v.hoehenprofil && v.hoehenprofil.werte.length > 2 && (
                <div className="elev"><Sparkline values={v.hoehenprofil.werte} width={340} height={56} color="#1E8A4F" label={`Höhenprofil von ${Math.round(Math.min(...v.hoehenprofil.werte))} bis ${Math.round(Math.max(...v.hoehenprofil.werte))} m`} />
                  <span className="small muted">Höhe {Math.round(Math.min(...v.hoehenprofil.werte))} bis {Math.round(Math.max(...v.hoehenprofil.werte))} m</span></div>
              )}
              {mode === 'oepnv' && (
                <ol className="legs">
                  {v.abschnitte.map((l, i) => (
                    <li key={i} className={`leg leg-${l.art === 'fuss' ? 'walk' : 'ride'}`} style={{ ['--c' as string]: legColor(l) }}>
                      <div className="leg-head">
                        {l.ab && <span className="leg-time">{fmtTime(l.abPrognose ?? l.ab)}{l.verspaetungMin ? <em className="late"> +{l.verspaetungMin}</em> : null}</span>}
                        <span className="leg-title">
                          {l.art === 'fuss' ? <><Icon name="walk" size={16} /> {dur(l.dauerMin)} zu Fuß{l.meter ? `, ${km(l.meter)}` : ''}</> : <><LineBadge line={l.linie ?? '?'} size="sm" /> Richtung {l.richtung}</>}
                        </span>
                      </div>
                      <div className="leg-body small">
                        {l.art !== 'fuss' && <span className="block">{l.von}{l.steigVon ? `, Gleis/Steig ${l.steigVon}` : ''} bis {l.nach}{l.an ? `, an ${fmtTime(l.anPrognose ?? l.an)}` : ''}{l.ausfall ? ' (fällt aus)' : ''}</span>}
                        {l.art !== 'fuss' && profil !== 'standard' && <span className="block muted">{l.rollstuhl ? 'stufenloser Einstieg' : l.niederflur ? 'Niederflurfahrzeug' : 'stufenloser Einstieg nicht angegeben'}</span>}
                        {(l.ebenenwechsel ?? []).map((e, k) => (
                          <span key={k} className={`block ebene ${e.status === 'außer Betrieb' ? 'warn-text' : ''}`}>{e.beschreibung}{e.typ === 'aufzug' ? `: ${e.status ?? 'Status unbekannt'}${e.stand ? `, Stand ${fmtTime(e.stand)} Uhr` : ''}` : ''}</span>
                        ))}
                        {(l.stoerungen ?? []).slice(0, 2).map((s) => <span key={s} className="block muted">{s}</span>)}
                      </div>
                    </li>
                  ))}
                  <li className="leg leg-end"><div className="leg-head"><span className="leg-time">{fmtTime(v.anPrognose ?? v.an!)}</span><span className="leg-title">{nach?.label}</span></div></li>
                </ol>
              )}
              {v.hinweise.length > 0 && <ul className="route-notes">{v.hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
            </Section>
          )}

          {unfallRoute && (
            <Section title="Sicher unterwegs" explain="unfall">
              <p className="small">
                Im 30-Meter-Korridor dieser Route: <strong>{unfallRoute.total}</strong> {unfallRoute.total === 1 ? 'Unfall' : 'Unfälle'} mit Personenschaden
                {unfallRoute.rad ? `, davon ${unfallRoute.rad} mit Rad` : ''}{unfallRoute.fuss ? ` und ${unfallRoute.fuss} mit Fuß` : ''}.
                {unfallRoute.tote ? ` ${unfallRoute.tote} davon endete tödlich.` : ''}
                {unfallRoute.total === 0 ? ' Für diesen Abschnitt sind keine Unfälle mit Personenschaden erfasst.' : ''}
              </p>
              {unfallRoute.items.length > 0 && (
                <ul className="route-notes">
                  {unfallRoute.items.map((u) => (
                    <li key={u.id}>
                      {u.kategorie === 1 ? 'Tödlicher' : u.kategorie === 2 ? 'Schwerer' : 'Leichter'} Unfall
                      {u.jahr ? ` ${u.jahr}` : ''}{u.rad ? ', Rad beteiligt' : ''}{u.fuss ? ', Fuß beteiligt' : ''} – {Math.round(u.dist)} m neben der Route.
                    </li>
                  ))}
                </ul>
              )}
              <div className="row-actions">
                <button type="button" className="chip" onClick={() => { setLayer('unfall', true); flyTo([nach!.lon, nach!.lat], 14); }}>
                  Unfallorte auf der Karte
                </button>
              </div>
              <p className="muted small">Unfallatlas 2025 (dl-de/by-2-0); nur Unfälle mit Personenschaden, keine Sachschäden. Der Korridor ist eine Näherung, keine Bewertung der Sicherheit der Route. Blitzerwarnungen sind für Fahrende in Deutschland nicht erlaubt; deshalb zeigt die App Unfallschwerpunkte statt Messstellen.</p>
            </Section>
          )}

          {mode === 'auto' && v && (
            <Section title={tr('Günstigste Tankstelle auf der Route')} explain="tanken">
              <div className="chips filter-chips">
                {FUELS.map((f) => (
                  <button key={f.id} type="button" className={`chip ${tankFuel === f.id ? 'on' : ''}`} aria-pressed={tankFuel === f.id} onClick={() => setTankFuel(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
              {!tanken.data && !tanken.error && <SkeletonRows rows={2} />}
              {tanken.error && !tanken.data && <p className="small">{tr('Tankpreise derzeit nicht abrufbar.')}</p>}
              {tanken.error && tanken.data && <p className="muted small">Aktualisierung fehlgeschlagen; angezeigt wird der letzte geladene Stand.</p>}
              {tanken.data && tankRoute && (
                tankRoute.items.length ? (
                  <ul className="near-list">
                    {tankRoute.items.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => {
                          const f = tankFacility(s, tanken.data!.stand, tanken.data!.source);
                          select({ type: 'facility', item: f });
                          flyTo([f.lon, f.lat], 16);
                        }}>
                          <span className="tank-price">
                            <strong>{fmtPrice(fuelPrice(s, tankFuel))}</strong>
                            <small>{FUELS.find((f) => f.id === tankFuel)?.label}</small>
                          </span>
                          <span className="near-main">
                            <span className="near-name">{s.name}{!s.isOpen && <span className="tank-closed">geschlossen</span>}</span>
                            <span className="near-sub">{[`${Math.round(s.dist)} m neben der Route`, s.address].filter(Boolean).join(' · ')}</span>
                          </span>
                          <Icon name="chevron" size={16} className="muted" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="small">Keine Tankstelle mit {FUELS.find((f) => f.id === tankFuel)?.label}-Preis im 1,5-km-Korridor der Route.</p>
                )
              )}
              {tankRoute && tankRoute.items.length > 0 && (
                <div className="row-actions">
                  <button type="button" className="chip" onClick={() => {
                    setNearby({ items: tankRoute.all.map((s) => tankFacility(s, tanken.data!.stand, tanken.data!.source)), color: { tanken: '#D97706' } });
                    setLayer('nearby', true);
                  }}>
                    <Icon name="pin" size={16} /> {tr('Tankstellen auf der Karte')}
                  </button>
                </div>
              )}
              {tanken.data && (
                <Source>{tanken.data.source}. Abgerufen {fmtStand(tanken.data.stand)} Uhr. Preise ohne Gewähr; maßgeblich ist die Zapfsäule.</Source>
              )}
              {tanken.data?.provider === 'infranode' && (
                <p className="muted small">Keyloser Abruf: nur 5 km um die Stadtmitte. Für Routen in die Außenbezirke ist ein Tankerkönig-Key nötig.</p>
              )}
            </Section>
          )}

          {nach && (
            <Section title="Weg öffnen in">
              <div className="handoff-row">
                {handoffLinks(nach, von?.label === 'Eigener Standort' ? null : von).map((l) => <a key={l.name} className="chip" href={l.url} target="_blank" rel="noreferrer">{l.name} <Icon name="external" size={14} /></a>)}
              </div>
              <p className="muted small">Open Stuttgart bietet keine Navigation mit Ansage. Für die Führung unterwegs übergeben diese Links Start und Ziel an die gewohnte App.</p>
            </Section>
          )}
          <Source>{cur.data?.quelle ?? 'EFA-BW (NVBW), dl-de/by-2-0. Wege: © OpenStreetMap-Mitwirkende, Valhalla und OSRM (FOSSGIS), BRouter.'}</Source>
        </>
      )}

      <WanderSection fitBounds={fitBounds} flyTo={flyTo} setRoute={setRoute} setLayer={setLayer} select={select} />
    </div>
  );
}
