import type { ReactNode } from 'react';
import { Icon } from './Icon';

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

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h3>{title}</h3>
        {aside && <span className="section-aside">{aside}</span>}
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
