import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { LineBadge } from './LineBadge';
import { searchStops, useStops, type StopFeature } from '../lib/stops';

export function Search({ onPick }: { onPick: (s: StopFeature) => void }) {
  const stops = useStops();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const results = searchStops(stops, q);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (s: StopFeature) => {
    onPick(s);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="search" ref={box}>
      <Icon name="search" size={18} className="search-icon" />
      <input
        type="search"
        value={q}
        placeholder="Haltestelle suchen"
        aria-label="Haltestelle suchen"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) pick(results[active]);
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && q.length >= 2 && (
        <ul className="search-results" id={listId} role="listbox">
          {results.length === 0 && <li className="empty">Keine Haltestelle gefunden</li>}
          {results.map((s, i) => (
            <li
              key={s.properties.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
            >
              <span className="res-name">{s.properties.name}{!s.properties.city && <small> Region</small>}</span>
              <span className="res-lines">{s.properties.lines.slice(0, 4).map((l: string) => <LineBadge key={l} line={l} size="sm" />)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
