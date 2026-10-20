// Verbindung und Weg: ÖPNV von Tür zu Tür (EFA, auf Wunsch stufenlos), Fahrrad, Pedelec, zu Fuß, Auto.
// Keine Navigation mit Ansage: für den Weg selbst wird an Navigations-Apps übergeben.
import { useEffect, useMemo, useState } from 'react';
import type { ModuleProps } from '../types';
import { usePolling } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { lineColors } from '../../lib/lines';
import { handoffLinks, type Place } from '../../lib/routeCtx';
import { Icon } from '../../components/Icon';
import { LineBadge } from '../../components/LineBadge';
import { Sparkline } from '../../components/Sparkline';
import { ErrorNote, Section, Source } from '../../components/ui';

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
type Hit = { label: string; typ: string; id: string; lat: number; lon: number };

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

function PlaceField({ label, value, onChange, center }: { label: string; value: Place | null; onChange: (p: Place | null) => void; center: [number, number] }) {
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const hits = usePolling<{ results: Hit[] }>(q.trim().length >= 3 ? `/api/orte/suche?q=${encodeURIComponent(q.trim())}` : null, 24 * 3600_000);
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
          <button type="button" className="link-quiet small" onClick={() => onChange(null)}>Ändern</button>
        </div>
      ) : (
        <>
          <div className="nearby-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Haltestelle, Adresse oder Ort" aria-label={`${label}: Haltestelle, Adresse oder Ort`} />
          </div>
          {q.trim().length >= 3 && (
            <ul className="addr-results">
              {(hits.data?.results ?? []).slice(0, 6).map((h) => (
                <li key={h.id}><button type="button" onClick={() => { onChange({ lat: h.lat, lon: h.lon, label: h.label.replace(/^Stuttgart, /, ''), id: h.id }); setQ(''); }}>{h.label.replace(/^Stuttgart, /, '')} <span className="muted small">{h.typ}</span></button></li>
              ))}
              {hits.data && !hits.data.results.length && <li className="muted small">Kein Ort gefunden.</li>}
            </ul>
          )}
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

function legColor(l: Leg) {
  if (l.art === 'fuss') return '#5D5C62';
  if (l.art === 'rad') return '#1E8A4F';
  if (l.art === 'auto') return '#2B59C3';
  return l.linie ? lineColors(l.linie).bg : '#26262C';
}

export function RoutePanel({ center, flyTo, setRoute, routeTarget, setLayer }: ModuleProps) {
  const [von, setVon] = useState<Place | null>(() => readAddr());
  const [nach, setNach] = useState<Place | null>(routeTarget);
  const [profil, setProfil] = useState('standard');
  const [mode, setMode] = useState<string>('oepnv');
  const [sel, setSel] = useState(0);
  const [zeit, setZeit] = useState('');
  useEffect(() => { if (routeTarget) { setNach(routeTarget); setSel(0); } }, [routeTarget]);
  useEffect(() => { setLayer('route', true); return () => setRoute(null); }, [setLayer, setRoute]);

  const base = von && nach ? `/api/route?von=${encodeURIComponent(pid(von))}&nach=${encodeURIComponent(pid(nach))}&profil=${profil}${zeit ? `&zeit=${encodeURIComponent(zeit)}` : ''}` : null;
  const oepnv = usePolling<Route>(base ? `${base}&modus=oepnv` : null, 60_000);
  const rad = usePolling<Route>(base ? `${base}&modus=rad` : null, 24 * 3600_000);
  const fuss = usePolling<Route>(base ? `${base}&modus=fuss` : null, 24 * 3600_000);
  const auto = usePolling<Route>(base && profil === 'standard' ? `${base}&modus=auto` : null, 24 * 3600_000);
  const res: Record<string, typeof oepnv> = { oepnv, rad, fuss, auto };
  const cur = res[mode];
  const v = cur.data?.varianten[Math.min(sel, (cur.data?.varianten.length ?? 1) - 1)];

  // Gewählte Variante auf der Karte
  useEffect(() => {
    if (!v || !von || !nach) { setRoute(null); return; }
    const feats: GeoJSON.Feature[] = v.abschnitte.filter((l) => (l.geometrie?.length ?? 0) > 1).map((l) => ({
      type: 'Feature', geometry: { type: 'LineString', coordinates: l.geometrie! }, properties: { color: legColor(mode === 'rad' ? { ...l, art: 'rad' } : mode === 'auto' ? { ...l, art: 'auto' } : l), walk: l.art === 'fuss' && mode !== 'rad' && mode !== 'auto' },
    }));
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [von.lon, von.lat] }, properties: { color: '#26262C' } });
    feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [nach.lon, nach.lat] }, properties: { color: '#FFB300' } });
    setRoute({ type: 'FeatureCollection', features: feats });
  }, [v, von, nach, mode, setRoute]);
  useEffect(() => {
    if (!von || !nach) return;
    const span = Math.max(Math.abs(von.lon - nach.lon), Math.abs(von.lat - nach.lat) * 1.5, 0.004);
    flyTo([(von.lon + nach.lon) / 2, (von.lat + nach.lat) / 2], Math.min(16, Math.max(10, Math.log2(180 / span) - 0.6)));
  }, [von, nach, flyTo]);

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
        <button type="button" className="icon-btn swap" aria-label="Start und Ziel tauschen" onClick={() => { setVon(nach); setNach(von); setSel(0); }}><Icon name="route" size={18} /></button>
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
          {cur.loading && !cur.data && <span className="skeleton block" style={{ height: 160, margin: '0 20px' }} />}
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
    </div>
  );
}
