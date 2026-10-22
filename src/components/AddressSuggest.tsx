// Adress- und Ortssuche mit Vorschlagsliste: gemeinsame Bausteine für „Weg“ und „In meiner Nähe“.
// Die Liste schwebt über dem Inhalt, hält die Eingabe im Fokus und lässt sich mit den Pfeiltasten bedienen.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Icon } from './Icon';
import { getJson } from '../lib/api';

export type SuggestItem = {
  key: string;
  title: string;
  detail?: string | null;
  /** Kurzes Etikett rechts, z. B. „Adresse“ oder „Haltestelle“ */
  kind: string;
  icon: string;
  lat: number;
  lon: number;
  id?: string;
  street?: string | null;
  nr?: string | null;
};

type SuggestState = { items: SuggestItem[]; loading: boolean; error: string | null };

/**
 * Lädt Vorschläge verzögert und bricht die vorige Anfrage ab. Die bisherigen Treffer bleiben
 * während des Tippens stehen, damit die Liste nicht bei jedem Zeichen leer aufblitzt.
 */
export function useSuggestions<T>(
  url: string | null,
  map: (data: T) => SuggestItem[],
  delay = 180,
): SuggestState {
  const [state, setState] = useState<SuggestState>({ items: [], loading: !!url, error: null });
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!url) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(async () => {
      try {
        const data = await getJson<T>(url, ctrl.signal);
        if (live) setState({ items: mapRef.current(data), loading: false, error: null });
      } catch (e) {
        if (live && !ctrl.signal.aborted) {
          setState({ items: [], loading: false, error: (e as Error).message });
        }
      }
    }, delay);
    return () => { live = false; clearTimeout(timer); ctrl.abort(); };
  }, [url, delay]);

  return state;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Markiert die eingegebenen Wörter im Vorschlag, damit der Treffer sofort ins Auge fällt. */
function Match({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.map(escapeRe).join('|')})`, 'gi');
  const wanted = new Set(words.map((w) => w.toLowerCase()));
  return (
    <>
      {text.split(re).map((part, i) => (
        wanted.has(part.toLowerCase()) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
      ))}
    </>
  );
}

/** Tastatursteuerung für das Eingabefeld; die aktive Zeile wird im Elternteil gehalten. */
export function suggestionKeys(items: SuggestItem[], active: number, onActive: (i: number) => void, onPick: (s: SuggestItem) => void, onClose: () => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) onActive(Math.min(active + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) onActive(Math.max(active - 1, 0));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      onPick(items[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
}

export function SuggestionList({
  id, items, query, active, loading, error, empty, onActive, onPick,
}: {
  id: string;
  items: SuggestItem[];
  query: string;
  active: number;
  loading: boolean;
  error: string | null;
  empty: string;
  onActive: (i: number) => void;
  onPick: (s: SuggestItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(false);

  // Nahe am unteren Rand (vor allem im mobilen Bottom Sheet) klappt die Liste nach oben.
  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = el?.parentElement?.getBoundingClientRect();
    if (!el || !anchor) return;
    const scroller = el.closest('.panel-scroll')?.getBoundingClientRect();
    const top = Math.max(0, scroller?.top ?? 0);
    const bottom = Math.min(window.innerHeight, scroller?.bottom ?? window.innerHeight);
    const spaceBelow = bottom - anchor.bottom;
    const spaceAbove = anchor.top - top;
    setUp(spaceBelow < Math.min(el.offsetHeight, 320) && spaceAbove > spaceBelow);
  }, [items.length, loading, error]);

  return (
    <div ref={ref} className={`suggest-pop ${up ? 'is-up' : ''}`}>
      {loading && <p className="suggest-status">{items.length ? 'Aktualisiere …' : 'Suche läuft …'}</p>}
      {!loading && error && <p className="suggest-status">Suche derzeit nicht möglich.</p>}
      {!loading && !error && items.length === 0 && <p className="suggest-status">{empty}</p>}
      {items.length > 0 && (
        <ul className="suggest-list" id={id} role="listbox" aria-label="Adressvorschläge">
          {items.map((s, i) => (
            <li
              key={s.key}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`suggest-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => onActive(i)}
              onMouseDown={(e) => { e.preventDefault(); onPick(s); }}
            >
              <span className="suggest-icon" aria-hidden><Icon name={s.icon} size={16} /></span>
              <span className="suggest-main">
                <span className="suggest-title"><Match text={s.title} query={query} /></span>
                {s.detail && <span className="suggest-detail">{s.detail}</span>}
              </span>
              <span className="suggest-kind">{s.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
