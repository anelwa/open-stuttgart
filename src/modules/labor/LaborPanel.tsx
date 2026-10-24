import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleProps } from '../types';
import { getJson, usePolling } from '../../lib/api';
import { tr, useLang } from '../../lib/i18n';
import { ErrorNote, Section, SkeletonRows, Source } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Sparkline } from '../../components/Sparkline';
import { SpeakButton } from '../../components/SpeakButton';
import '../../styles/labor.css';

type Tab = 'werkzeuge' | 'quellen' | 'verbesserungen' | 'fortschritt';
const REPO = 'https://github.com/anelwa/open-stuttgart';

interface InputDef {
  key: string; label: string; type: 'place' | 'text' | 'number' | 'select' | 'date';
  placeholder?: string; required?: boolean; options?: [string, string][];
}
interface FeatureMeta {
  number: number; key: string; id: string; title: string; category: string;
  summary: string; inputs: InputDef[]; status: 'live' | 'geplant';
}
interface SourceMeta {
  id: string; title: string; category: string; group: string; kind: string;
  license: string; attribution: string; url: string; summary: string;
  status: 'live' | 'geplant' | 'key'; ttl: string; note: string | null;
}
interface Catalog<T> { count: number; live: number; planned: number; features?: T[]; sources?: T[]; categories?: { id: string; label: string; count: number; live: number }[]; groups?: { id: string; count: number }[]; leitsatz?: string }
interface Overview { sources: { count: number; live: number; planned: number; key: number; groups: { id: string; count: number }[] }; features: { count: number; live: number; planned: number; categories: { id: string; label: string; count: number; live: number }[] }; improvements: { count: number; done: number; open: number; categories: { id: string; label: string; count: number; done: number }[] } }
interface Improvement { number: number; id: string; title: string; category: string; summary: string; status: 'done' | 'offen' }
interface ImprovementCatalog { count: number; done: number; open: number; categories: { id: string; label: string; count: number; done: number }[]; improvements: Improvement[] }
interface Fact { label: string; value: string | number | null; note?: string | null }
interface ListItem { title: string; subtitle?: string | null; href?: string | null; note?: string | null; lat?: number | null; lon?: number | null }
interface TableBlock { type: 'table'; title: string; columns: string[]; rows: (string | number | null)[][]; note?: string | null }
interface ListBlock { type: 'list'; title: string; items: ListItem[]; note?: string | null }
interface FactsBlock { type: 'facts'; title: string; items: Fact[] }
interface TextBlock { type: 'text'; title: string; text: string; tone?: string | null }
interface ChartBlock { type: 'chart'; title: string; labels: string[]; values: number[]; unit?: string; note?: string | null }
interface LinksBlock { type: 'links'; title: string; items: { title: string; href: string; note?: string | null }[] }
interface ImageBlock { type: 'image'; title: string; src: string; alt?: string }
type Block = TableBlock | ListBlock | FactsBlock | TextBlock | ChartBlock | LinksBlock | ImageBlock;

interface FeatureResult {
  id: string; number: number; category: string; title: string; subtitle: string | null;
  summary: string; facts: Fact[]; blocks: Block[]; points: { lat: number; lon: number; label: string }[];
  geojson?: GeoJSON.FeatureCollection | null;
  sources: { name: string; url: string; license: string }[]; limits: string[];
  speech?: string | null;
  updated: string; durationMs: number; status: string; error?: string;
}

interface SourceResult {
  id: string; title: string; subtitle: string | null; kind: string; license: string; attribution: string;
  sourceUrl: string; summary: string; note: string | null; fetchedAt: string; limits: string[];
  type: 'table' | 'geojson' | 'points' | 'json' | 'text';
  columns?: string[]; rows?: Record<string, unknown>[]; rowCount?: number; totalRows?: number; truncated?: boolean;
  features?: GeoJSON.Feature[]; points?: { lat: number; lon: number; name?: string; label?: string; props?: Record<string, unknown> }[];
  items?: ListItem[]; json?: unknown; text?: string; dataset?: { url: string; title: string } | null; error?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  kiez: 'Mein Kiez', unterwegs: 'Unterwegs', umwelt: 'Umwelt & Gesundheit', freizeit: 'Freizeit',
  wissen: 'Wissen & Bildung', alltag: 'Verwaltung & Alltag', notfall: 'Sicherheit & Notfall',
  daten: 'Daten & Transparenz', teilen: 'Teilen & Zugang', spiel: 'Spiel & Community',
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(+d) ? String(iso) : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function fcFromPoints(points: { lat: number; lon: number; label: string }[], title: string): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map((p, i) => ({
      type: 'Feature' as const,
      id: `labor-${i}`,
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
      properties: { _layer: 'labor', _layerTitle: title, _name: p.label, _props: JSON.stringify(p) },
    })),
  };
}

function FactRow({ f }: { f: Fact }) {
  return (
    <div className="labor-fact">
      <span>{f.label}</span>
      <strong>{f.value ?? 'keine Angabe'}</strong>
      {f.note && <small>{f.note}</small>}
    </div>
  );
}

function Chart({ b }: { b: ChartBlock }) {
  const values = b.values.filter((v) => Number.isFinite(v));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values.at(-1);
  return (
    <div className="labor-chart">
      <div className="labor-chart-head">
        <strong>{b.title}</strong>
        <span>{last != null ? `${last.toLocaleString('de-DE')} ${b.unit ?? ''}` : ''}</span>
      </div>
      {values.length >= 2 ? (
        <Sparkline values={values} width={300} height={58} label={`${b.title}: ${min} bis ${max}`} />
      ) : (
        <div className="labor-chart-single">{values[0]?.toLocaleString('de-DE') ?? '–'} {b.unit ?? ''}</div>
      )}
      <div className="labor-chart-legend">
        <span>{b.labels[0] ?? ''}</span>
        <span>{b.labels.at(-1) ?? ''}</span>
      </div>
      {b.note && <p className="muted small">{b.note}</p>}
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.type === 'text') return <div className={`labor-text ${b.tone ? `is-${b.tone}` : ''}`}><h4>{b.title}</h4><p>{b.text}</p></div>;
  if (b.type === 'facts') return <div className="labor-facts-block"><h4>{b.title}</h4><div className="labor-facts">{b.items.map((f, i) => <FactRow key={i} f={f} />)}</div></div>;
  if (b.type === 'chart') return <Chart b={b} />;
  if (b.type === 'image') return <figure className="labor-figure"><img className="labor-image" src={b.src} alt={b.alt ?? b.title} loading="lazy" decoding="async" /><figcaption>{b.title}</figcaption></figure>;
  if (b.type === 'table') return (
    <div className="labor-table-wrap">
      <h4>{b.title}</h4>
      <div className="labor-table-scroll">
        <table className="labor-table">
          <caption>{b.title}</caption>
          <thead><tr>{b.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{b.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell == null || cell === '' ? '–' : String(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {b.note && <p className="muted small">{b.note}</p>}
    </div>
  );
  if (b.type === 'links') return (
    <div className="labor-links"><h4>{b.title}</h4><ul>{b.items.map((x, i) => (
      <li key={i}><a href={x.href} target={x.href.startsWith('#') ? undefined : '_blank'} rel="noreferrer"><strong>{x.title}</strong>{x.note && <small>{x.note}</small>}</a></li>
    ))}</ul></div>
  );
  if (b.type === 'list') return (
    <div className="labor-list"><h4>{b.title}</h4><ul>{b.items.map((x, i) => (
      <li key={i}>
        {x.href
          ? <a href={x.href} target={x.href.startsWith('#') ? undefined : '_blank'} rel="noreferrer"><strong>{x.title}</strong>{x.subtitle && <small>{x.subtitle}</small>}{x.note && <small>{x.note}</small>}</a>
          : <div><strong>{x.title}</strong>{x.subtitle && <small>{x.subtitle}</small>}{x.note && <small>{x.note}</small>}</div>}
      </li>
    ))}</ul>{b.note && <p className="muted small">{b.note}</p>}</div>
  );
  return null;
}

function FeatureForm({ feature, values, setValues, useCenter, setUseCenter, busy, onRun, onBack, missing }: {
  feature: FeatureMeta; values: Record<string, string>; setValues: (v: Record<string, string>) => void;
  useCenter: boolean; setUseCenter: (v: boolean) => void; busy: boolean; onRun: () => void; onBack: () => void;
  missing: string[];
}) {
  const hasPlace = feature.inputs.some((i) => i.type === 'place');
  return (
    <div className="labor-form">
      <button type="button" className="labor-back" onClick={onBack}><Icon name="chevron" size={14} className="chev-left" /> Alle Werkzeuge</button>
      <div className="labor-form-head">
        <span className="labor-number">{String(feature.number).padStart(3, '0')}</span>
        <div>
          <h3>{feature.title}</h3>
          <p className="muted small">{feature.summary}</p>
        </div>
      </div>
      {feature.inputs.map((input) => (
        <label key={input.key} className="labor-field">
          <span>{input.label}{input.required ? ' *' : ''}</span>
          {input.type === 'select' ? (
            <select value={values[input.key] ?? input.options?.[0]?.[0] ?? ''} onChange={(e) => setValues({ ...values, [input.key]: e.target.value })}>
              {(input.options ?? []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : input.type === 'number' ? (
            <input type="number" value={values[input.key] ?? ''} placeholder={input.placeholder} onChange={(e) => setValues({ ...values, [input.key]: e.target.value })} />
          ) : input.type === 'date' ? (
            <input type="date" value={values[input.key] ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setValues({ ...values, [input.key]: e.target.value })} />
          ) : (
            <input
              type="text"
              value={values[input.key] ?? ''}
              placeholder={useCenter && input.type === 'place' ? 'Kartenmitte verwenden' : input.placeholder}
              onChange={(e) => setValues({ ...values, [input.key]: e.target.value })}
            />
          )}
          {missing.includes(input.key) && <small className="labor-field-error" role="alert">Bitte ausfüllen.</small>}
        </label>
      ))}
      {hasPlace && (
        <button type="button" className={`chip labor-mini ${useCenter ? 'on' : ''}`} onClick={() => setUseCenter(!useCenter)}>
          <Icon name="pin" size={14} /> Kartenmitte statt Adresse
        </button>
      )}
      <button type="button" className="labor-run" onClick={onRun} disabled={busy}>
        {busy ? 'Wird berechnet …' : 'Ausführen'} <Icon name="chevron" size={15} />
      </button>
      <p className="labor-note">Die Antwort nennt Quelle, Lizenz und Grenzen. Rechenzeit und Abrufe werden serverseitig zwischengespeichert.</p>
    </div>
  );
}

function FeatureResultView({ result, onMap, onPrint }: { result: FeatureResult; onMap: () => void; onPrint: () => void }) {
  return (
    <div className="labor-result">
      <div className="labor-result-head">
        <span className="labor-kicker">Werkzeug {String(result.number).padStart(3, '0')} · {CATEGORY_LABELS[result.category] ?? result.category}</span>
        <h3>{result.title}</h3>
        {result.subtitle && <p className="labor-sub">{result.subtitle}</p>}
        <p className="labor-summary">{result.summary}</p>
        {result.speech && <div className="labor-speak"><SpeakButton text={result.speech} label="Ergebnis vorlesen" /></div>}
      </div>
      {result.facts.length > 0 && <div className="labor-facts">{result.facts.map((f, i) => <FactRow key={i} f={f} />)}</div>}
      {result.blocks.map((b, i) => <BlockView key={i} b={b} />)}
      {(result.points.length > 0 || result.geojson) && (
        <div className="labor-actions">
          <button type="button" className="chip labor-mini" onClick={onMap}><Icon name="pin" size={14} /> Auf der Karte zeigen</button>
          <button type="button" className="chip labor-mini" onClick={onPrint}><Icon name="copy" size={14} /> Link kopieren</button>
          <button type="button" className="chip labor-mini" onClick={() => window.print()}><Icon name="book" size={14} /> Datenblatt drucken</button>
          <a className="chip labor-mini" href={`${REPO}/issues/new?title=${encodeURIComponent(`Problem: ${result.title}`)}&body=${encodeURIComponent(`Werkzeug: ${result.id}\n\nBeschreibung:\n`)}`} target="_blank" rel="noreferrer"><Icon name="warn" size={14} /> Problem melden</a>
        </div>
      )}
      {result.sources.length > 0 && (
        <Source>
          {result.sources.map((s, i) => (
            <span key={i}>{i > 0 ? ' · ' : ''}{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name} <small>({s.license})</small></span>
          ))}
        </Source>
      )}
      {result.limits.length > 0 && (
        <div className="labor-limits">
          <strong>Grenzen</strong>
          <ul>{result.limits.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}
      <p className="labor-meta">Berechnet in {result.durationMs} ms · {fmtDate(result.updated)}</p>
    </div>
  );
}

function SourceView({ source, onMap }: { source: SourceResult; onMap: () => void }) {
  const points = source.points ?? (source.items ?? []).filter((x) => x.lat != null && x.lon != null).map((x) => ({ lat: x.lat!, lon: x.lon!, name: x.title })) ?? [];
  return (
    <div className="labor-result">
      <div className="labor-result-head">
        <span className="labor-kicker">{source.kind} · {source.license}</span>
        <h3>{source.title}</h3>
        {source.subtitle && <p className="labor-sub">{source.subtitle}</p>}
        <p className="labor-summary">{source.summary}</p>
      </div>
      {source.type === 'table' && source.rows && source.columns && (
        <div className="labor-table-wrap">
          <div className="labor-table-scroll">
            <table className="labor-table">
              <caption>{source.title}</caption>
              <thead><tr>{source.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>{source.rows.slice(0, 40).map((row, i) => <tr key={i}>{source.columns!.map((c) => <td key={c}>{row[c] == null || row[c] === '' ? '–' : String(row[c])}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="muted small">{source.rowCount ?? source.rows.length} von {source.totalRows ?? source.rows.length} Zeilen{source.truncated ? ' (gekürzt)' : ''}</p>
        </div>
      )}
      {source.type === 'geojson' && <p className="labor-summary">{source.features?.length ?? 0} Objekte im Ausschnitt.</p>}
      {source.type !== 'table' && source.items && source.items.length > 0 && (
        <ul className="labor-source-items">
          {source.items.slice(0, 30).map((x, i) => (
            <li key={i}>{x.href ? <a href={x.href} target="_blank" rel="noreferrer"><strong>{x.title}</strong>{x.subtitle && <small>{x.subtitle}</small>}</a> : <><strong>{x.title}</strong>{x.subtitle && <small>{x.subtitle}</small>}</>}</li>
          ))}
        </ul>
      )}
      {source.type === 'json' && source.json != null && (
        <details className="labor-json"><summary>Rohdaten anzeigen</summary><pre>{JSON.stringify(source.json, null, 2).slice(0, 12000)}</pre></details>
      )}
      {source.type === 'text' && source.text && <pre className="labor-json">{source.text.slice(0, 8000)}</pre>}
      <div className="labor-actions">
        {points.length > 0 && <button type="button" className="chip labor-mini" onClick={onMap}><Icon name="pin" size={14} /> Auf der Karte zeigen</button>}
        <a className="chip labor-mini" href={`/api/labor/quelle?id=${encodeURIComponent(source.id)}`} target="_blank" rel="noreferrer">JSON-Endpunkt</a>
        {source.sourceUrl && <a className="chip labor-mini" href={source.sourceUrl} target="_blank" rel="noreferrer">Originalquelle</a>}
      </div>
      <Source>{source.attribution} · {source.license}{source.dataset?.url && <> · <a href={source.dataset.url} target="_blank" rel="noreferrer">CKAN-Datensatz</a></>}</Source>
      {source.note && <p className="labor-note">{source.note}</p>}
      {source.limits.length > 0 && <div className="labor-limits"><strong>Grenzen</strong><ul>{source.limits.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
      <p className="labor-meta">Abgerufen {fmtDate(source.fetchedAt)}</p>
    </div>
  );
}

export function LaborPanel({ center, flyTo, fitBounds, setWissen, setLayer }: ModuleProps) {
  const lang = useLang();
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const h = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
      const t = h.get('labor-tab');
      if (t === 'werkzeuge' || t === 'quellen' || t === 'verbesserungen' || t === 'fortschritt') return t;
    } catch { /* egal */ }
    return 'werkzeuge';
  });
  const overview = usePolling<Overview>('/api/labor', 5 * 60_000);
  const features = usePolling<Catalog<FeatureMeta>>('/api/labor/werkzeuge', 60 * 60_000);
  const sources = usePolling<Catalog<SourceMeta>>('/api/labor/quellen', 60 * 60_000);
  const improvements = usePolling<ImprovementCatalog>('/api/labor/verbesserungen', 60 * 60_000);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('alle');
  const [selected, setSelected] = useState<FeatureMeta | null>(null);
  const [sourceSelected, setSourceSelected] = useState<SourceMeta | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [useCenter, setUseCenter] = useState(false);
  const [result, setResult] = useState<FeatureResult | null>(null);
  const [sourceResult, setSourceResult] = useState<SourceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const lastFeature = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openFeature = useCallback((f: FeatureMeta, initial: Record<string, string> = {}) => {
    lastFeature.current = f.id;
    setSelected(f); setResult(null); setError(null); setValues(initial); setUseCenter(false); setTab('werkzeuge');
    history.replaceState(null, '', `#labor=${encodeURIComponent(f.id)}${new URLSearchParams(initial).toString() ? `&${new URLSearchParams(initial).toString()}` : ''}`);
  }, []);

  const chooseTab = useCallback((id: Tab) => {
    setTab(id); setSelected(null); setSourceSelected(null); setResult(null); setSourceResult(null); setError(null);
    history.replaceState(null, '', `#labor-tab=${id}`);
  }, []);

  const moveListFocus = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = e.currentTarget.closest('.labor-feature-list');
    if (!list) return;
    const items = [...list.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
    const i = items.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const openSource = useCallback(async (s: SourceMeta) => {
    setSourceSelected(s); setSourceResult(null); setError(null); setTab('quellen');
    setBusy(true);
    try {
      const r = await getJson<SourceResult>(`/api/labor/quelle?id=${encodeURIComponent(s.id)}`);
      setSourceResult(r);
      history.replaceState(null, '', `#labor=quelle&id=${encodeURIComponent(s.id)}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const read = () => {
      const all = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
      const tabParam = all.get('labor-tab');
      if (tabParam === 'werkzeuge' || tabParam === 'quellen' || tabParam === 'verbesserungen' || tabParam === 'fortschritt') { setTab(tabParam); return; }
      const raw = location.hash.startsWith('#labor=') ? location.hash.slice(7) : '';
      if (!raw) return;
      const params = new URLSearchParams(raw);
      const id = params.get('labor') ?? raw.split('&')[0];
      if (id === 'quelle') {
        const sourceId = params.get('id');
        const s = sources.data?.sources?.find((x) => x.id === sourceId);
        if (s) void openSource(s);
        return;
      }
      const f = features.data?.features?.find((x) => x.id === id);
      if (f) {
        const initial: Record<string, string> = {};
        for (const input of f.inputs) if (params.get(input.key)) initial[input.key] = params.get(input.key)!;
        openFeature(f, initial);
      }
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [features.data, sources.data, openFeature, openSource]);

  const run = async () => {
    if (!selected) return;
    const absent = selected.inputs.filter((i) => i.required && !values[i.key] && !(i.type === 'place' && useCenter)).map((i) => i.key);
    if (absent.length) { setMissing(absent); setError('Bitte die markierten Pflichtfelder ausfüllen.'); return; }
    setMissing([]);
    setBusy(true); setError(null); setResult(null);
    try {
      const params = new URLSearchParams({ id: selected.id, ...values });
      if (useCenter) { params.set('lat', center[1].toFixed(5)); params.set('lon', center[0].toFixed(5)); }
      const r = await getJson<FeatureResult>(`/api/labor/werkzeug?${params.toString()}`);
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const showOnMap = (points: { lat: number; lon: number; label: string }[], title: string, geojson?: GeoJSON.FeatureCollection | null) => {
    if (geojson?.features?.length) {
      setWissen(geojson);
      setLayer('wissen', true);
      const coords = geojson.features.flatMap((f) => {
        const out: [number, number][] = [];
        const walk = (v: unknown) => { if (Array.isArray(v)) { if (typeof v[0] === 'number' && typeof v[1] === 'number') out.push([v[0], v[1]]); else v.forEach(walk); } };
        walk((f.geometry as GeoJSON.Geometry | null)?.type === 'GeometryCollection' ? null : (f.geometry as { coordinates?: unknown } | null)?.coordinates);
        return out;
      });
      if (coords.length) {
        const lons = coords.map((c) => c[0]); const lats = coords.map((c) => c[1]);
        fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { maxZoom: 15 });
      }
      return;
    }
    if (!points.length) return;
    setWissen(fcFromPoints(points, title));
    setLayer('wissen', true);
    const lons = points.map((p) => p.lon); const lats = points.map((p) => p.lat);
    fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { maxZoom: 16 });
    flyTo([points[0].lon, points[0].lat], 15);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* egal */ }
  };

  const featureList = useMemo(() => {
    const list = features.data?.features ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((f) => (cat === 'alle' || f.category === cat) && (!needle || `${f.title} ${f.summary} ${f.id}`.toLowerCase().includes(needle)));
  }, [features.data, q, cat]);

  const sourceList = useMemo(() => {
    const list = sources.data?.sources ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((s) => (!needle || `${s.title} ${s.summary} ${s.id} ${s.license} ${s.kind}`.toLowerCase().includes(needle)));
  }, [sources.data, q]);

  return (
    <div className="module labor">
      <div className="wiss-tabs seg" role="tablist" aria-label="Stadtlabor">
        {([['werkzeuge', 'Werkzeuge'], ['quellen', 'Quellen'], ['verbesserungen', 'Verbesserungen'], ['fortschritt', 'Fortschritt']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => chooseTab(id)}>{tr(label)}</button>
        ))}
      </div>

      {tab !== 'fortschritt' && (
        <div className="labor-toolbar">
          <label className="wiss-search">
            <Icon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'werkzeuge' ? 'Werkzeug suchen, z. B. Kiez, Regen, Bibliothek' : 'Quelle suchen, z. B. Wahl, Luft, LUBW'} aria-label="Suchen" />
          </label>
          {tab === 'werkzeuge' && (
            <div className="labor-chips">
              <button type="button" className={`chip labor-mini ${cat === 'alle' ? 'on' : ''}`} onClick={() => setCat('alle')}>Alle</button>
              {(features.data?.categories ?? []).map((c) => (
                <button key={c.id} type="button" className={`chip labor-mini ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label} <small>{c.live}/{c.count}</small></button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'werkzeuge' && !selected && (
        <div className="labor-pane">
          <p className="wiss-lead">{lang === 'en' ? '100 tools that turn open data into concrete answers. Every result names its source, licence and limits.' : '100 Werkzeuge, die aus den offenen Daten konkrete Antworten machen. Jedes Ergebnis nennt Quelle, Lizenz und Grenzen.'}</p>
          {features.loading && !features.data && <SkeletonRows rows={5} />}
          {features.slow && !features.data && <p className="labor-note">Die Quelle antwortet langsam. Du kannst warten oder die Seite später erneut öffnen.</p>}
          {features.error && <ErrorNote text={features.error} onRetry={features.reload} />}
          <ul className="labor-feature-list" onKeyDown={moveListFocus}>
            {(featureList.length ? featureList : []).map((f) => (
              <li key={f.id}>
                <button type="button" data-feature-id={f.id} className={`labor-feature ${f.status === 'live' ? 'is-live' : 'is-planned'}`} onClick={() => f.status === 'live' ? openFeature(f) : undefined} disabled={f.status !== 'live'}>
                  <span className="labor-number">{String(f.number).padStart(3, '0')}</span>
                  <span className="labor-feature-main">
                    <strong>{f.title}</strong>
                    <small>{f.summary}</small>
                    <em>{CATEGORY_LABELS[f.category] ?? f.category} {f.status === 'geplant' ? '· in Vorbereitung' : ''}</em>
                  </span>
                  <Icon name={f.status === 'live' ? 'chevron' : 'clock'} size={16} />
                </button>
              </li>
            ))}
          </ul>
          {!features.loading && featureList.length === 0 && <p className="muted small labor-empty"><Icon name="search" size={20} /> Kein Werkzeug gefunden. Suchbegriff kürzen oder Kategorie wechseln.</p>}
          <p className="labor-count">{featureList.length} von {features.data?.count ?? 100} Werkzeugen · {features.data?.live ?? 0} live</p>
        </div>
      )}

      {tab === 'werkzeuge' && selected && (
        <div className="labor-pane">
          {!result && <FeatureForm feature={selected} values={values} setValues={setValues} useCenter={useCenter} setUseCenter={setUseCenter} busy={busy} onRun={() => void run()} onBack={() => { const id = lastFeature.current; setSelected(null); setResult(null); setError(null); history.replaceState(null, '', '#labor'); requestAnimationFrame(() => { if (id) document.querySelector<HTMLElement>(`[data-feature-id="${id}"]`)?.focus(); }); }} missing={missing} />}
          {busy && <SkeletonRows rows={4} />}
          {error && <ErrorNote text={error} onRetry={() => void run()} />}
          {result && (
            <>
              <FeatureResultView result={result} onMap={() => showOnMap(result.points, result.title, result.geojson)} onPrint={() => void copyLink()} />
              {copied && <p className="labor-note">Link kopiert.</p>}
              <button type="button" className="labor-back" onClick={() => { setResult(null); setError(null); }}><Icon name="chevron" size={14} className="chev-left" /> Andere Eingabe</button>
            </>
          )}
        </div>
      )}

      {tab === 'quellen' && !sourceSelected && (
        <div className="labor-pane">
          <p className="wiss-lead">{lang === 'en' ? 'More than 100 new public interfaces and datasets: official statistics, WFS layers, state data and open APIs. All with licence and attribution.' : 'Über 100 neue öffentliche Schnittstellen und Datensätze: amtliche Statistik, WFS-Layer, Landesdaten und offene APIs. Alle mit Lizenz und Quellenangabe.'}</p>
          {sources.loading && !sources.data && <SkeletonRows rows={5} />}
          {sources.slow && !sources.data && <p className="labor-note">Der Quellenkatalog antwortet langsam. Die zuletzt geladenen Daten bleiben sichtbar.</p>}
          {sources.error && <ErrorNote text={sources.error} onRetry={sources.reload} />}
          <ul className="labor-feature-list" onKeyDown={moveListFocus}>
            {sourceList.map((s) => (
              <li key={s.id}>
                <button type="button" className="labor-feature is-live" onClick={() => void openSource(s)}>
                  <span className={`labor-source-dot is-${s.status}`} aria-hidden />
                  <span className="labor-feature-main">
                    <strong>{s.title}</strong>
                    <small>{s.summary}</small>
                    <em>{s.kind} · {s.license}</em>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              </li>
            ))}
          </ul>
          {!sources.loading && sourceList.length === 0 && <p className="muted small labor-empty"><Icon name="search" size={20} /> Keine Quelle gefunden. Anderes Stichwort versuchen.</p>}
          <p className="labor-count">{sourceList.length} von {sources.data?.count ?? 100} Quellen</p>
        </div>
      )}

      {tab === 'quellen' && sourceSelected && (
        <div className="labor-pane">
          {busy && <SkeletonRows rows={5} />}
          {error && <ErrorNote text={error} onRetry={() => void openSource(sourceSelected)} />}
          {sourceResult && (
            <>
              <SourceView source={sourceResult} onMap={() => showOnMap((sourceResult.points ?? []).map((p) => ({ lat: p.lat, lon: p.lon, label: p.label ?? p.name ?? sourceResult.title })), sourceResult.title)} />
              <button type="button" className="labor-back" onClick={() => { setSourceSelected(null); setSourceResult(null); setError(null); }}><Icon name="chevron" size={14} className="chev-left" /> Alle Quellen</button>
            </>
          )}
        </div>
      )}

      {tab === 'verbesserungen' && (
        <div className="labor-pane">
          <p className="wiss-lead">100 Verbesserungen für StuggiAI, Bedienung, Design, Zuverlässigkeit und Inhalt. Jede wird einzeln umgesetzt und hier abgehakt.</p>
          {improvements.loading && !improvements.data && <SkeletonRows rows={5} />}
          {improvements.slow && !improvements.data && <p className="labor-note">Der Verbesserungsstand antwortet langsam. Bitte kurz warten.</p>}
          {improvements.error && <ErrorNote text={improvements.error} onRetry={improvements.reload} />}
          <Section title="Fortschritt" aside={`${improvements.data?.done ?? 0}/${improvements.data?.count ?? 100}`}>
            <div className="labor-progress"><span style={{ width: `${((improvements.data?.done ?? 0) / (improvements.data?.count ?? 100)) * 100}%` }} /></div>
            <p className="labor-count">{improvements.data?.done ?? 0} umgesetzt · {improvements.data?.open ?? 100} offen</p>
            <div className="labor-cat-progress">
              {(improvements.data?.categories ?? []).map((c) => (
                <div key={c.id} className="labor-cat-row">
                  <span>{c.label}</span>
                  <div className="labor-progress small"><span style={{ width: `${(c.done / Math.max(c.count, 1)) * 100}%` }} /></div>
                  <strong>{c.done}/{c.count}</strong>
                </div>
              ))}
            </div>
          </Section>
          <ul className="labor-feature-list" onKeyDown={moveListFocus}>
            {(improvements.data?.improvements ?? []).map((x) => (
              <li key={x.id}>
                <div className={`labor-feature ${x.status === 'done' ? 'is-live' : 'is-planned'}`}>
                  <span className="labor-number">{String(x.number).padStart(3, '0')}</span>
                  <span className="labor-feature-main">
                    <strong>{x.title}</strong>
                    <small>{x.summary}</small>
                    <em>{improvements.data?.categories.find((c) => c.id === x.category)?.label ?? x.category} · {x.status === 'done' ? 'umgesetzt' : 'offen'}</em>
                  </span>
                  <Icon name={x.status === 'done' ? 'check' : 'clock'} size={16} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'fortschritt' && (
        <div className="labor-pane">
          <p className="wiss-lead">Das Erweiterungsprogramm in Zahlen. Quellen und Werkzeuge werden schrittweise ergänzt; jedes neue Werkzeug muss Quellen, Lizenz und Grenzen nennen.</p>
          <Section title="Schnittstellen und Datensätze" aside={`${overview.data?.sources.live ?? 0}/${overview.data?.sources.count ?? 100}`}>
            <div className="labor-progress"><span style={{ width: `${((overview.data?.sources.live ?? 0) / (overview.data?.sources.count ?? 100)) * 100}%` }} /></div>
            <p className="labor-count">{overview.data?.sources.live ?? 0} live · {overview.data?.sources.planned ?? 0} geplant · {overview.data?.sources.key ?? 0} mit Schlüssel</p>
          </Section>
          <Section title="Werkzeuge" aside={`${overview.data?.features.live ?? 0}/${overview.data?.features.count ?? 100}`}>
            <div className="labor-progress"><span style={{ width: `${((overview.data?.features.live ?? 0) / (overview.data?.features.count ?? 100)) * 100}%` }} /></div>
            <div className="labor-cat-progress">
              {(overview.data?.features.categories ?? []).map((c) => (
                <div key={c.id} className="labor-cat-row">
                  <span>{c.label}</span>
                  <div className="labor-progress small"><span style={{ width: `${(c.live / Math.max(c.count, 1)) * 100}%` }} /></div>
                  <strong>{c.live}/{c.count}</strong>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Verbesserungen" aside={`${overview.data?.improvements.done ?? 0}/${overview.data?.improvements.count ?? 100}`}>
            <div className="labor-progress"><span style={{ width: `${((overview.data?.improvements.done ?? 0) / (overview.data?.improvements.count ?? 100)) * 100}%` }} /></div>
            <p className="labor-count">StuggiAI, Bedienung, Design, Zuverlässigkeit und Inhalt – der Stand steht im Reiter „Verbesserungen“.</p>
          </Section>
          <Section title={tr('So funktioniert das Stadtlabor')} aside={lang === 'en' ? 'Help' : 'Hilfe'}>
            <p className="wiss-small">{lang === 'en' ? 'Three tabs: Tools answer concrete questions, Sources show the raw data with licence and fetch time, Improvements documents the work on StuggiAI, usability and design. Every result names source, licence, fetch time and limits. If a source fails, the last good value remains visible.' : 'Drei Reiter: Werkzeuge beantworten konkrete Fragen, Quellen zeigen die Rohdaten mit Lizenz und Abrufzeit, Verbesserungen dokumentiert den Ausbau von StuggiAI, Bedienung und Design. Jedes Ergebnis nennt Quelle, Lizenz, Abrufzeit und Grenzen. Wo eine Quelle ausfällt, bleibt der letzte gute Stand sichtbar.'}</p>
            <ul className="labor-principles">
              <li>Ort eingeben oder die Kartenmitte verwenden.</li>
              <li>Werkzeug ausführen; Pflichtfelder sind mit * markiert.</li>
              <li>Ergebnisse lassen sich vorlesen, auf der Karte zeigen und als Link teilen.</li>
              <li>Quellen öffnen die Originaldaten; die Lizenz steht direkt daneben.</li>
            </ul>
          </Section>

          <Section title="Quellen & Lizenzen" aside="transparent">
            <p className="wiss-small">Alle Quellen mit Lizenz, Attribution und Status stehen im Reiter „Quellen“ und maschinenlesbar unter <code>/api/labor/quellen</code>. Die fortlaufende Dokumentation liegt in <code>docs/erweiterungsprogramm.md</code> und <code>docs/verbesserungen.md</code>.</p>
            <p className="wiss-small"><a href={`${REPO}/issues/new?title=Quellenvorschlag`} target="_blank" rel="noreferrer">Quelle vorschlagen</a> · <a href={`${REPO}/issues/new?title=Problem%20im%20Stadtlabor`} target="_blank" rel="noreferrer">Problem melden</a></p>
          </Section>

          <Section title="Grundsätze" aside="verbindlich">
            <ul className="labor-principles">
              <li>Jede Quelle nennt Lizenz, Quellenangabe und Stand.</li>
              <li>Keine Quelle ohne Freigabe, kein stiller Fallback bei rechtlichen Unsicherheiten.</li>
              <li>Keine Personendaten, keine Bewegungsprofile, keine Werbung.</li>
              <li>Jedes Werkzeug sagt, was es nicht kann – besonders bei Prognosen und Modellen.</li>
              <li>Alle Abrufe laufen serverseitig, zwischengespeichert und mit höflichem Abstand.</li>
            </ul>
          </Section>
          <Section title="Prüfung" aside="npm run check:extras">
            <p className="wiss-small">Das Register wird automatisch geprüft: mindestens 100 Quellen, 100 Werkzeuge, eindeutige IDs, vollständige Lizenzangaben, lauffähige Adapter. Die technische Prüfung aller Quellen läuft separat mit <code>npm run check:extras -- --live</code>.</p>
          </Section>
        </div>
      )}
    </div>
  );
}
