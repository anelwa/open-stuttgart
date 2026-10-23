// Dokumentenleser: zeigt ein Dokument aus dem Register mit Ablauf, Zuständigkeit,
// Bezugsquellen, verwandten Dokumenten, Backlinks und Originalseite.
// Die Daten kommen aus der lokal erzeugten SQLite-/FTS5-Datenbank (server/data/suche.sqlite).
import { useEffect, useRef, useState } from 'react';
import { getJson } from '../lib/api';
import { fmtTime } from '../lib/format';
import type { Kontakt } from '../lib/kontakt';
import { KontaktBody } from './KontaktDetail';
import { Icon } from './Icon';
import '../styles/search.css';
import '../styles/kontakt.css';

type Step = { ord: number; title: string; text: string };
type SourceLink = { role: string; label: string | null; id: number | null; title: string | null; url: string | null; doc_type: string | null };
type LinkItem = { id: number | null; title: string | null; url: string | null; doc_type?: string | null; anchor?: string | null; typeLabel?: string };

export type DocumentDetail = {
  id: number; title: string; url: string; doc_type: string; typeLabel: string; source: string;
  summary: string | null; text: string | null; modified_at: string | null; fetched_at: string | null;
  district: string | null; lat: number | null; lon: number | null; status: string;
  service: null | {
    id: number; name: string; leika: string | null; summary: string | null; legal_basis: string | null;
    fees: string | null; processing_time: string | null; digital: number; responsible: string | null;
  };
  steps: Step[]; sources: SourceLink[]; backlinks: LinkItem[]; outlinks: LinkItem[]; related: (LinkItem & { shared: number })[];
  chunks: { ord: number; text: string }[];
  contact?: Kontakt | null;
  lizenz?: string;
};

export const TYPE_ICON: Record<string, string> = {
  leistung: 'home', dienststelle: 'pin', kontakt: 'phone', seite: 'info', pressemitteilung: 'calendar', online_angebot: 'external', dokument: 'info', haltestelle: 'stop',
};

const ROLE_LABEL: Record<string, string> = {
  'angeboten_in': 'angeboten in', 'verweis': 'Verweis', 'zuständig': 'zuständig', 'online': 'Online-Dienst', 'quelle': 'Quelle',
};

export function DocumentView({ d, loading, error, onOpen, onShowOnMap }: {
  d: DocumentDetail; loading: boolean; error: string | null; onOpen: (id: number) => void;
  onShowOnMap?: (k: Kontakt) => void;
}) {
  const text = d.text ?? '';
  const shown = text.length > 4200 ? `${text.slice(0, 4200).replace(/\s\S*$/, '')} …` : text;
  return (
    <div className="cmdk-detail">
      {loading && <p className="cmdk-state">Lade Dokument …</p>}
      {error && <p className="cmdk-error">{error}</p>}
      <div className="cmdk-detail-head">
        <span className={`cmdk-type type-${d.doc_type}`}><Icon name={TYPE_ICON[d.doc_type] ?? 'info'} size={15} />{d.typeLabel}</span>
        <h2>{d.title}</h2>
        <p className="cmdk-meta">
          {(d.contact?.source ?? d.source)}{d.district ? ` · ${d.district}` : ''}
          {d.modified_at ? ` · zuletzt geändert ${new Date(d.modified_at).toLocaleDateString('de-DE')}` : ''}
          {d.service ? ` · ${d.service.digital ? 'Online-Dienst vorhanden' : 'kein Online-Dienst hinterlegt'}` : ''}
        </p>
      </div>

      {d.contact ? (
        <KontaktBody k={d.contact} onOpenDoc={onOpen} onShowOnMap={onShowOnMap} />
      ) : (
        <>
          {d.summary && <p className="cmdk-summary">{d.summary}</p>}

      {d.service && (
        <section className="cmdk-section">
          <h3>Ablauf und Zuständigkeit</h3>
          <dl className="cmdk-facts">
            {d.service.responsible && <div><dt>Zuständig</dt><dd>{d.service.responsible}</dd></div>}
            {d.service.processing_time && <div><dt>Bearbeitungsdauer</dt><dd>{d.service.processing_time}</dd></div>}
            {d.service.fees && <div><dt>Gebühren</dt><dd>{d.service.fees}</dd></div>}
            {d.service.legal_basis && <div><dt>Rechtsgrundlage</dt><dd>{d.service.legal_basis}</dd></div>}
            {d.service.leika && <div><dt>LEIKA</dt><dd>{d.service.leika}</dd></div>}
          </dl>
          {d.steps.length > 0 ? (
            <ol className="cmdk-steps">
              {d.steps.map((s) => (
                <li key={`${s.ord}-${s.title}`}>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          ) : <p className="muted small">Für diese Leistung sind keine einzelnen Ablaufschritte hinterlegt.</p>}
        </section>
      )}

      {d.text && (
        <section className="cmdk-section">
          <h3>Inhalt</h3>
          <p className="cmdk-text">{shown}</p>
          {text.length > 4200 && <p className="muted small">Gekürzt. Der vollständige Text steht auf der Originalseite.</p>}
        </section>
      )}
        </>
      )}

      {d.sources.length > 0 && (
        <section className="cmdk-section">
          <h3>Bezugsquellen</h3>
          <ul className="cmdk-links">
            {d.sources.map((s, i) => (
              <li key={`${s.role}-${s.id ?? i}`}>
                <span className="cmdk-role">{ROLE_LABEL[s.role] ?? s.role}</span>
                {s.id != null ? (
                  <button type="button" className="link-quiet" onClick={() => onOpen(s.id!)}>{s.title ?? s.url}</button>
                ) : s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title ?? s.url}</a> : <span>{s.title ?? s.label ?? 'Quelle'}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!d.contact && d.related.length > 0 && (
        <section className="cmdk-section">
          <h3>Verwandte Dokumente <span className="muted small">(gemeinsame Bezüge)</span></h3>
          <ul className="cmdk-links">
            {d.related.map((r) => (
              <li key={r.id}>
                <button type="button" className="link-quiet" onClick={() => r.id != null && onOpen(r.id)}>{r.title}</button>
                <span className="muted small">{r.shared >= 2 ? `${r.shared} gemeinsame Bezüge` : 'thematisch verwandt'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!d.contact && d.backlinks.length > 0 && (
        <section className="cmdk-section">
          <h3>Verweist hierher</h3>
          <ul className="cmdk-links">
            {d.backlinks.slice(0, 12).map((b, i) => (
              <li key={`${b.id ?? i}`}>
                {b.id != null
                  ? <button type="button" className="link-quiet" onClick={() => onOpen(b.id!)}>{b.title}</button>
                  : <span>{b.title ?? b.url}</span>}
                {b.anchor && <span className="muted small">„{b.anchor}“</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="cmdk-detail-foot">
        <a className="chip" href={d.contact?.url ?? d.contact?.sourceUrl ?? d.url} target="_blank" rel="noreferrer">Originalseite öffnen <Icon name="external" size={14} /></a>
        {d.fetched_at && <span className="muted small">Abgerufen {fmtTime(d.fetched_at)} Uhr</span>}
        {d.lizenz && <span className="muted small">{d.lizenz}</span>}
      </footer>
    </div>
  );
}

/**
 * Dokumentenleser als eigenständige Ansicht. Wird geöffnet, wenn in der Suche ein
 * Dokument gewählt wird — und über alle Bezugsquellen, verwandten Dokumente und
 * Backlinks hinweg weiterverfolgt, ohne die Suche zu verlassen.
 */
export function DocumentReader({ id, onClose, onShowOnMap }: {
  id: number | null;
  onClose: () => void;
  onShowOnMap?: (k: Kontakt) => void;
}) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const readerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (id == null) { setDoc(null); return; }
    let alive = true;
    setLoading(true); setError(null);
    getJson<DocumentDetail>(`/api/documents/${id}`)
      .then((d) => { if (alive) setDoc(d); })
      .catch((e) => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (id == null) return;
    const previous = document.activeElement as HTMLElement | null;
    readerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [id, onClose]);

  if (id == null) return null;

  return (
    <div className="reader-backdrop" onClick={onClose} role="presentation">
      <aside className="reader" role="dialog" aria-modal="true" aria-labelledby="reader-title" tabIndex={-1} ref={readerRef} onClick={(e) => e.stopPropagation()}>
        <header className="reader-head">
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Leser schließen">
            <Icon name="close" size={18} />
          </button>
          <span className="reader-title" id="reader-title">{loading ? 'Lade Dokument …' : doc?.title ?? 'Dokument'}</span>
        </header>
        <div className="reader-body">
          {error && <p className="cmdk-error">{error}</p>}
          {doc && <DocumentView d={doc} loading={loading} error={error} onShowOnMap={onShowOnMap} onOpen={(next) => { setDoc(null); setLoading(true); getJson<DocumentDetail>(`/api/documents/${next}`).then(setDoc).catch((e) => setError((e as Error).message)).finally(() => setLoading(false)); }} />}
        </div>
      </aside>
    </div>
  );
}
