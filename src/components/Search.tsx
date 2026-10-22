// Ein einziges Suchfeld für alles: Haltestellen, Leistungen, Ämter, Seiten und Dokumente.
// Die Haltestellen werden lokal in den 724 Halten des Fahrplans gefunden (sofort), die
// übrigen Treffer kommen aus der lokalen SQLite-/FTS5-Datenbank. Bisher gab es zwei
// getrennte Suchfelder nebeneinander — das war der offensichtlichste Mangel am Einstieg.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { LineBadge } from './LineBadge';
import { searchStops, useStops, type StopFeature } from '../lib/stops';
import { getJson } from '../lib/api';
import { Explain } from '../lib/info';
import { friendlyError } from './ui';
import '../styles/search.css';

type Facet = { type: string; label: string; count: number };
type DocResult = {
  id: number; title: string; url: string; type: string; typeLabel: string; source: string;
  district: string | null; modified: string | null; snippet: string | null; rank: number | null;
};
type SearchResponse = {
  q: string; type: string | null; total: number; limit: number; offset: number;
  items: DocResult[]; facets: Facet[]; source: string; hinweis: string;
};

function Highlight({ text }: { text: string | null }) {
  if (!text) return null;
  const parts = String(text).split(/\[\[|\]\]/);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</>;
}

function useDocSearch(open: boolean, q: string, type: string | null, limit: number) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || q.trim().length < 2) { setData(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await getJson<SearchResponse>(
          `/api/search?q=${encodeURIComponent(q)}&limit=${limit}${type ? `&type=${encodeURIComponent(type)}` : ''}`,
          ctrl.signal,
        );
        setData(d); setError(null);
      } catch (e) {
        if (!ctrl.signal.aborted) setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [open, q, type, limit]);
  return { data, error, loading };
}

type Hit =
  | { kind: 'stop'; stop: StopFeature }
  | { kind: 'doc'; doc: DocResult };

export function Search({
  onPickStop, onOpenDocument, onRoute,
}: {
  onPickStop: (s: StopFeature) => void;
  onOpenDocument: (id: number) => void;
  /** Aktion rechts im Pill — führt zur Routenplanung */
  onRoute?: () => void;
}) {
  const stops = useStops();
  const [q, setQ] = useState('');
  const [type, setType] = useState<string | null>(null);
  const [limit, setLimit] = useState(12);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const stopHits = useMemo<StopFeature[]>(
    () => (q.trim().length >= 2 ? searchStops(stops, q).slice(0, 5) : []),
    [stops, q],
  );
  const { data, error, loading } = useDocSearch(open, q, type, limit);
  const docs = data?.items ?? [];

  const hits = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    for (const s of stopHits) out.push({ kind: 'stop', stop: s });
    for (const d of docs) out.push({ kind: 'doc', doc: d });
    return out;
  }, [stopHits, docs]);

  useEffect(() => { setActive(0); setLimit(12); }, [q, type]);

  // Cmd/Ctrl+K setzt den Fokus in dieses eine Suchfeld.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (h: Hit) => {
    if (h.kind === 'stop') { onPickStop(h.stop); setOpen(false); setQ(''); }
    else if (h.kind === 'doc') { onOpenDocument(h.doc.id); setOpen(false); }
    setActive(0);
  };

  const clear = () => {
    setQ('');
    setType(null);
    inputRef.current?.focus();
  };

  const facets = data?.facets ?? [];
  const showPanel = open && q.trim().length >= 2;

  return (
    <div className="search-dock" ref={box}>
      <div
        className={`search-pill ${showPanel ? 'is-open' : ''}`}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) inputRef.current?.focus();
        }}
      >
        <Icon name="search" size={19} className="search-icon" />
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder="Ort, Haltestelle, Amt …"
        aria-label="Alles durchsuchen: Ort, Haltestelle, Amt, Leistung oder Anliegen"
        role="combobox"
        aria-expanded={showPanel && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={hits[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && hits[active]) { e.preventDefault(); choose(hits[active]); }
        }}
      />
        {q ? (
          <button type="button" className="search-clear" aria-label="Suche leeren" onClick={clear}>
            <Icon name="close" size={16} />
          </button>
        ) : (
          <>
            <kbd className="search-kbd">⌘ K</kbd>
            {onRoute && (
              <button type="button" className="search-go" aria-label="Route planen" title="Route planen" onClick={onRoute}>
                <Icon name="route" size={18} />
              </button>
            )}
          </>
        )}
      </div>

      {showPanel && (
        <div className="search-panel">
          <div className="search-panel-head">
            <span className="search-panel-title">Suchergebnisse</span>
            <button type="button" className="icon-btn ghost" aria-label="Suche schließen" onClick={() => { setOpen(false); inputRef.current?.blur(); }}>
              <Icon name="close" size={18} />
            </button>
          </div>
          {facets.length > 0 && (
            <div className="search-facets" role="group" aria-label="Dokumenttyp filtern">
              <button type="button" className={`chip ${!type ? 'on' : ''}`} aria-pressed={!type} onClick={() => setType(null)}>
                Alle <small>{data?.total ?? 0}</small>
              </button>
              {facets.map((f) => (
                <button key={f.type} type="button" className={`chip ${type === f.type ? 'on' : ''}`} aria-pressed={type === f.type}
                  onClick={() => setType(type === f.type ? null : f.type)}>
                  {f.label} <small>{f.count}</small>
                </button>
              ))}
            </div>
          )}

          <ul className="search-list" id={listId} role="listbox" aria-label="Suchergebnisse">
            {hits.length === 0 && (
              <li className="search-empty">
                {loading ? 'Suche läuft …' : error ? friendlyError(`Suche nicht verfügbar: ${error}`) : `Keine Treffer für „${q.trim()}“.`}
              </li>
            )}

            {stopHits.length > 0 && (
              <li className="search-group" role="presentation">
                <span className="search-group-label">Haltestellen</span>
              </li>
            )}
            {stopHits.map((s) => {
              const i = hits.findIndex((h) => h.kind === 'stop' && h.stop === s);
              return (
                <li
                  key={s.properties.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`search-hit ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose({ kind: 'stop', stop: s }); }}
                >
                  <span className="search-hit-icon"><Icon name="stop" size={17} /></span>
                  <span className="search-hit-main">
                    <span className="search-hit-title">{s.properties.name}{!s.properties.city && <small> Region</small>}</span>
                    <span className="search-hit-meta">Haltestelle</span>
                  </span>
                  <span className="search-hit-lines">{s.properties.lines.slice(0, 4).map((l: string) => <LineBadge key={l} line={l} size="sm" />)}</span>
                </li>
              );
            })}

            {docs.length > 0 && (
              <li className="search-group" role="presentation">
                <span className="search-group-label">Seiten, Leistungen und Dokumente</span>
              </li>
            )}
            {docs.map((d) => {
              const i = hits.findIndex((h) => h.kind === 'doc' && h.doc === d);
              return (
                <li
                  key={d.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`search-hit ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose({ kind: 'doc', doc: d }); }}
                >
                  <span className="search-hit-icon"><Icon name={d.type === 'leistung' ? 'home' : d.type === 'dienststelle' ? 'pin' : d.type === 'online_angebot' ? 'external' : 'info'} size={17} /></span>
                  <span className="search-hit-main">
                    <span className="search-hit-title">{d.title}</span>
                    {d.snippet && <span className="search-hit-snippet"><Highlight text={d.snippet} /></span>}
                    <span className="search-hit-meta">
                      {d.typeLabel}{d.district ? ` · ${d.district}` : ''} · {d.source}
                    </span>
                  </span>
                  <Icon name="chevron" size={15} className="muted" />
                </li>
              );
            })}

            {data && data.total > docs.length && (
              <li className="search-more-row" role="presentation">
                {docs.length < 50 ? (
                  <button type="button" className="show-more" onClick={() => setLimit((n) => Math.min(50, n + 20))}>
                    Weitere Treffer laden <span className="muted">({docs.length} von {data.total})</span>
                  </button>
                ) : (
                  <p className="muted small">Die besten {docs.length} von {data.total} Treffern. Suche verfeinern, um mehr zu sehen.</p>
                )}
              </li>
            )}

          </ul>

          <footer className="search-foot">
            <span>
              {loading ? 'Suche läuft …' : data ? `${data.total} Treffer · ${data.source}` : 'Lokale Suche, keine Anfrage an Dritte'}
              <Explain id="suche" />
            </span>
            <span className="search-keys"><kbd>↑</kbd><kbd>↓</kbd> wählen <kbd>↵</kbd> öffnen</span>
          </footer>
        </div>
      )}
    </div>
  );
}
