import type { ReactNode } from 'react';
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

export function Section({ title, aside, explain, children }: { title: string; aside?: ReactNode; explain?: string; children: ReactNode }) {
  useLang();
  return (
    <section className="section">
      <header className="section-head">
        <h3>{tr(title)}</h3>
        {(aside || explain) && <span className="section-aside">{aside}{explain && <Explain id={explain} />}</span>}
      </header>
      {children}
    </section>
  );
}

export function LiveDot({ stale }: { stale?: boolean }) {
  return <span className={`live-dot ${stale ? 'stale' : ''}`} aria-hidden />;
}

export function Source({ children }: { children: ReactNode }) {
  return <p className="source"><Icon name="info" size={14} /> {children}</p>;
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="error-note" role="status">
      <Icon name="warn" size={16} />
      <span>{text}</span>
      {onRetry && <button type="button" onClick={onRetry}>Erneut laden</button>}
    </div>
  );
}
