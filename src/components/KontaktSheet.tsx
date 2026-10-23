// Schnellzugriff auf das Kontaktregister: Notrufe stehen sofort ohne Netzanfrage
// im Bundle, alle Ämter und Dienste kommen aus der lokalen SQLite-Suche.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getJson } from '../lib/api';
import {
  KONTAKT_GRUPPEN, KONTAKT_GRUPPE_KINDS, wichtigeKontakte,
  type Kontakt, type KontaktSearchResponse, type KontaktStats,
} from '../lib/kontakt';
import { Icon } from './Icon';
import { KontaktDetailView } from './KontaktDetail';
import { friendlyError } from './ui';
import '../styles/kontakt.css';

const NOTFALL_IDS = [
  'notruf-feuerwehr-rettungsdienst',
  'notruf-polizei',
  'notdienst-aerztlicher-bereitschaftsdienst',
];

function KontaktZeile({ k, onOpen }: { k: Kontakt; onOpen: (k: Kontakt) => void }) {
  const phone = k.phones[0];
  return (
    <li className="k-list-item">
      <button type="button" className="k-list-row" onClick={() => onOpen(k)}>
        <span className={`k-list-icon is-${k.kind}`}>
          <Icon name={k.kind === 'notruf' ? 'warn' : k.kind === 'notdienst' ? 'health' : k.kind === 'technik' ? 'home' : k.kind === 'tier' ? 'leaf' : 'contact'} size={17} />
        </span>
        <span className="k-list-main">
          <span className="k-list-name">{k.name}</span>
          <span className="k-list-meta">
            {[k.organization, k.category, k.address, k.availability].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      {phone && (
        <a
          className="k-list-call"
          href={`tel:${phone.number.replace(/[^\d+]/g, '')}`}
          aria-label={`${k.name} anrufen: ${phone.number}`}
          title={`${phone.label}: ${phone.number}`}
        >
          <Icon name="phone" size={15} />
          <span>{phone.number}</span>
        </a>
      )}
    </li>
  );
}

export function KontaktSheet({ open, onClose, onOpenDocument, onShowOnMap }: {
  open: boolean;
  onClose: () => void;
  onOpenDocument: (id: number) => void;
  onShowOnMap: (k: Kontakt) => void;
}) {
  const [q, setQ] = useState('');
  const [gruppe, setGruppe] = useState<string | null>(null);
  const [data, setData] = useState<KontaktSearchResponse | null>(null);
  const [stats, setStats] = useState<KontaktStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Kontakt | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const offline = useMemo(() => wichtigeKontakte(), []);
  const notfall = useMemo(
    () => NOTFALL_IDS.map((id) => offline.find((k) => k.id === id)).filter(Boolean) as Kontakt[],
    [offline],
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    getJson<KontaktStats>('/api/kontakte/stats').then(setStats).catch(() => setStats(null));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '60' });
        if (q.trim()) params.set('q', q.trim());
        if (gruppe) params.set('gruppe', gruppe);
        const d = await getJson<KontaktSearchResponse>(`/api/kontakte?${params}`, ctrl.signal);
        if (alive) { setData(d); setError(null); }
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message);
        const needle = q.trim().toLowerCase();
        const fallback = offline.filter((k) => {
          if (gruppe && !(KONTAKT_GRUPPE_KINDS[gruppe] ?? []).includes(k.kind)) return false;
          if (!needle) return true;
          return [k.name, k.organization, k.category, k.description, k.address, (k.phones ?? []).map((p) => p.number).join(' ')]
            .filter(Boolean).join(' ').toLowerCase().includes(needle);
        });
        setData({
          q: q.trim(), total: fallback.length, limit: 60, offset: 0, items: fallback,
          gruppen: [], source: 'Open Stuttgart – Kontaktregister',
          hinweis: 'Die Online-Suche ist gerade nicht erreichbar. Die redaktionell geprüften Kontakte stehen lokal bereit.',
        });
      } finally {
        if (alive) setLoading(false);
      }
    }, q.trim() ? 180 : 0);
    return () => { alive = false; ctrl.abort(); clearTimeout(t); };
  }, [open, q, gruppe, offline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open || e.key !== 'Escape') return;
      e.stopPropagation();
      if (selected) { setSelected(null); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, selected, onClose]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [selected]);

  if (!open) return null;

  const items = data?.items ?? [];
  const gruppen = data?.gruppen?.length ? data.gruppen : KONTAKT_GRUPPEN.map((g) => ({ ...g, count: 0 }));
  const openKontakt = (k: Kontakt) => {
    setSelected(k);
    getJson<Kontakt>(`/api/kontakte/${encodeURIComponent(k.id)}`)
      .then((full) => setSelected((prev) => (prev?.id === k.id ? full : prev)))
      .catch(() => { /* Kurzansicht bleibt stehen */ });
  };

  return (
    <div className="k-sheet-backdrop" onClick={onClose} role="presentation">
      <aside className="k-sheet" role="dialog" aria-modal="true" aria-labelledby="k-sheet-title" onClick={(e) => e.stopPropagation()}>
        <header className="k-sheet-head">
          <div className="k-sheet-title">
            <h2 id="k-sheet-title">{selected ? 'Kontakt' : 'Kontakt & Notfall'}</h2>
            <div className="k-sheet-head-actions">
              <a className="k-sheet-emergency" href="tel:112" aria-label="Notruf 112 anrufen">
                <Icon name="phone" size={14} />
                112
              </a>
              <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Kontaktregister schließen">
                <Icon name="close" size={20} />
              </button>
            </div>
          </div>
          {!selected && (
            <>
              <p className="k-sheet-sub">
                {stats
                  ? `${stats.contacts.toLocaleString('de-DE')} Kontakte · ${stats.with_phone.toLocaleString('de-DE')} mit Telefon · ${stats.with_hours.toLocaleString('de-DE')} mit Öffnungszeiten`
                  : 'Notrufe, Ämter, Beratung und technische Dienste an einem Ort'}
              </p>
              <div className="k-sheet-search">
                <Icon name="search" size={18} />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setSelected(null); }}
                  placeholder="Suchen: Fundbüro, Reisepass, Apotheke, 112 …"
                  aria-label="Kontaktregister durchsuchen"
                  type="search"
                />
                {q && (
                  <button type="button" className="icon-btn ghost" onClick={() => setQ('')} aria-label="Suche leeren">
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
            </>
          )}
          {selected && (
            <button type="button" className="k-sheet-back" onClick={() => setSelected(null)}>
              <Icon name="chevron" size={14} />
              Zurück zur Suche
            </button>
          )}
        </header>

        <div className={`k-sheet-body ${selected ? 'is-detail' : ''}`} ref={bodyRef}>
          {selected ? (
            <KontaktDetailView
              k={selected}
              onClose={() => setSelected(null)}
              onOpenDoc={(id) => { onClose(); onOpenDocument(id); }}
              onShowOnMap={(k) => { onClose(); onShowOnMap(k); }}
            />
          ) : (
            <>
              {!q.trim() && (
                <>
                  <div className="k-emergency">
                    {notfall.map((k) => (
                      <a key={k.id} href={k.phones[0] ? `tel:${k.phones[0].number.replace(/[^\d+]/g, '')}` : (k.url ?? '#')}>
                        <small>{k.category}</small>
                        <strong>{k.name}</strong>
                        <span>{k.phones[0]?.number ?? 'Öffnen'}</span>
                      </a>
                    ))}
                  </div>
                  <div className="k-gruppen" role="group" aria-label="Kontakte nach Gruppe filtern">
                    <button type="button" className={`chip ${!gruppe ? 'on' : ''}`} aria-pressed={!gruppe} onClick={() => setGruppe(null)}>
                      Alle
                    </button>
                    {gruppen.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={`chip ${gruppe === g.id ? 'on' : ''}`}
                        aria-pressed={gruppe === g.id}
                        onClick={() => setGruppe(gruppe === g.id ? null : g.id)}
                      >
                        {g.label} {g.count > 0 && <small>{g.count.toLocaleString('de-DE')}</small>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p className="k-sheet-section-label">
                {q.trim() ? `Treffer für „${q.trim()}“` : gruppe ? gruppen.find((g) => g.id === gruppe)?.label : 'Wichtige Kontakte'}
                <span className="muted"> · {data?.total ?? 0}</span>
              </p>

              {error && !items.length && <p className="k-sheet-empty">{friendlyError(`Kontaktregister nicht verfügbar: ${error}`)}</p>}
              {loading && !items.length && <p className="k-sheet-empty">Lade Kontakte …</p>}
              {!loading && !error && items.length === 0 && (
                <p className="k-sheet-empty">Keine Kontakte für „{q.trim()}“ gefunden. Versuche „Bürgerbüro“, „Reisepass“ oder „Notdienst“.</p>
              )}

              <ul className="k-list">
                {items.map((k) => <KontaktZeile key={k.id} k={k} onOpen={openKontakt} />)}
              </ul>

              <footer className="k-sheet-foot">
                <Icon name="info" size={14} /> {data?.hinweis ?? stats?.hinweis ?? 'Angaben ohne Gewähr. Im Notfall 112.'}
                <br />
                Quelle: {data?.source ?? stats?.source ?? 'Landeshauptstadt Stuttgart'}.
              </footer>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
