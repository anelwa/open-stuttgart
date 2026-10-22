import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Explain } from '../lib/info';
import { tr, useLang } from '../lib/i18n';

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={onChange}>
      <span className="knob" />
    </button>
  );
}

export function LayerRow({ icon, tone, title, meta, on, onToggle, loading }: {
  icon: string; tone: string; title: string; meta: ReactNode; on: boolean; onToggle: () => void; loading?: boolean;
}) {
  useLang();
  title = tr(title);
  return (
    <div className={`layer-row ${on ? 'is-on' : ''}`}>
      <span className={`tile tone-${tone}`}><Icon name={icon} size={20} /></span>
      <button type="button" className="layer-text" onClick={onToggle} aria-label={`${title} ${on ? 'ausblenden' : 'einblenden'}`}>
        <span className="layer-title">{title}</span>
        <span className="layer-meta">{loading ? <span className="skeleton" style={{ width: 120 }} /> : meta}</span>
      </button>
      <Switch on={on} onChange={onToggle} label={title} />
    </div>
  );
}

/**
 * Inhaltsabschnitt. Ohne `collapsible` ist der Abschnitt immer offen und der Titel
 * eine reine Überschrift. Mit `collapsible` wird er zur aufklappbaren Tiefe-Ebene —
 * so bleibt der Lesefluss kurz, ohne Inhalte zu verlieren.
 */
export function Section({
  title, aside, explain, collapsible, defaultOpen = true, className, children,
}: { title: string; aside?: ReactNode; explain?: string; collapsible?: boolean; defaultOpen?: boolean; className?: string; children: ReactNode }) {
  useLang();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);

  const head = (
    <header className="section-head">
      {collapsible ? (
        <button type="button" className="section-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="chevron" size={15} className={open ? 'chev-down' : 'chev-right'} />
          <h3>{tr(title)}</h3>
        </button>
      ) : <h3>{tr(title)}</h3>}
      {(aside || explain) && <span className="section-aside">{aside}{explain && <Explain id={explain} />}</span>}
    </header>
  );

  return (
    <section className={`section ${collapsible ? 'is-collapsible' : ''} ${open ? '' : 'is-collapsed'} ${className ?? ''}`}>
      {head}
      {open && children}
    </section>
  );
}

/**
 * Aufklappbarer Block für die Tiefe-Ebene: Quellen, Lizenzen, Methodik, Grenzen der
 * Berechnung. Die Transparenz bleibt erhalten, steht aber nicht im Lesefluss.
 */
export function Disclosure({ label, children, defaultOpen = false, count }: {
  label: string; children: ReactNode; defaultOpen?: boolean; count?: number;
}) {
  useLang();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`disclosure ${open ? 'is-open' : ''}`}>
      <button type="button" className="disclosure-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="chevron" size={14} className={open ? 'chev-down' : 'chev-right'} />
        <span>{tr(label)}</span>
        {count != null && <span className="disclosure-count">{count}</span>}
      </button>
      {open && <div className="disclosure-body">{children}</div>}
    </div>
  );
}

/**
 * Bremst lange Listen: zeigt die ersten `first` Einträge und den Rest erst nach Klick.
 * Das ist der wirksamste Hebel gegen die 150-Ereignis-Blöcke in Kultur und Was geht.
 */
export function ShowMore({ children, first = 6, label, asList }: { children: ReactNode[]; first?: number; label?: string; asList?: boolean }) {
  useLang();
  const items = Array.isArray(children) ? children : [children];
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, first);
  const rest = items.length - shown.length;
  const more = rest > 0 && (
    <button type="button" className="show-more" onClick={() => setAll(true)}>
      <Icon name="chevron" size={14} className="chev-down" />
      {label ? tr(label) : `${rest} weitere anzeigen`}
    </button>
  );
  const less = all && items.length > first && (
    <button type="button" className="show-more is-secondary" onClick={() => setAll(false)}>
      <Icon name="chevron" size={14} className="chev-up" />
      {tr('Weniger anzeigen')}
    </button>
  );
  return (
    <>
      {shown}
      {more && (asList ? <li className="show-more-row">{more}</li> : more)}
      {less && (asList ? <li className="show-more-row">{less}</li> : less)}
    </>
  );
}

export function LiveDot({ stale }: { stale?: boolean }) {
  return <span className={`live-dot ${stale ? 'stale' : ''}`} aria-hidden />;
}

/** Platzhalter für Listen: zeigt die Form der kommenden Inhalte statt einer grauen Fläche. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <span className="skeleton skeleton-dot" />
          <span className="skeleton-row-text">
            <span className="skeleton" style={{ width: `${62 + ((i * 11) % 24)}%` }} />
            <span className="skeleton" style={{ width: `${38 + ((i * 7) % 28)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Einheitlicher Zustand für Details, deren Datensatz (noch) fehlt. Statt einer
 * weißen Fläche gibt es eine Erklärung, den Weg zurück und – wo möglich – erneut laden.
 */
export function DetailFallback({ title, text, onClose, onRetry }: {
  title: string; text: string; onClose: () => void; onRetry?: () => void;
}) {
  return (
    <div className="sheet-inner">
      <header className="sheet-head">
        <div className="sheet-head-top">
          <span className="eyebrow">Details</span>
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Schließen"><Icon name="close" size={20} /></button>
        </div>
        <h2 id="detail-title">{title}</h2>
      </header>
      <div className="sheet-body">
        <div className="detail-fallback">
          <Icon name="info" size={24} />
          <p>{text}</p>
          <div className="row-actions">
            <button type="button" className="link-btn" onClick={onClose}>Zurück</button>
            {onRetry && <button type="button" className="link-btn secondary" onClick={onRetry}>Erneut laden</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Quellen- und Lizenzangabe. Mit `disclosure` eingeklappt — die Transparenz bleibt
 * vollständig erhalten, steht aber nicht im Lesefluss. Kurze Angaben direkt am Wert
 * bleiben ohne `disclosure` sichtbar.
 */
export function Source({ children, disclosure, label = 'Quellen und Lizenzen' }: {
  children: ReactNode; disclosure?: boolean; label?: string;
}) {
  if (disclosure) {
    return (
      <Disclosure label={label} defaultOpen={false}>
        <p className="source"><Icon name="info" size={14} /> {children}</p>
      </Disclosure>
    );
  }
  return <p className="source"><Icon name="info" size={14} /> {children}</p>;
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const friendly = friendlyError(text);
  return (
    <div className="error-note" role="status" title={text}>
      <Icon name="warn" size={16} />
      <span>{friendly}</span>
      {onRetry && <button type="button" onClick={onRetry}>Erneut laden</button>}
    </div>
  );
}

/** Technische Fehlertexte (502, Failed to fetch) werden zu einer verständlichen Zeile. */
export function friendlyError(text: string): string {
  const raw = text.trim();
  if (/failed to fetch|networkerror|load failed/i.test(raw)) return 'Die Datenquelle ist gerade nicht erreichbar. Bitte später erneut versuchen.';
  const withoutCode = raw
    .replace(/[:\s-]*(?:HTTP\s*)?5\d{2}\b.*$/i, '')
    .replace(/[:\s-]+$/g, '');
  if (withoutCode && withoutCode !== raw) return `${withoutCode}. Die Datenquelle antwortet gerade nicht.`;
  return raw;
}
