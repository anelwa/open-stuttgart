// Strukturierte Darstellung eines Kontakts: Anrufen, Mailen, Öffnungszeiten,
// Leistungen und Adresse. Wird im Dokumentenleser und im Kontaktregister verwendet.
import { useState } from 'react';
import type { Kontakt } from '../lib/kontakt';
import { jetztStatus, standText, telHref } from '../lib/kontakt';
import { Icon } from './Icon';
import '../styles/kontakt.css';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="kd-copy"
      aria-label={`${value} kopieren`}
      title="Kopieren"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }, () => {});
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      <span>{copied ? 'Kopiert' : 'Kopieren'}</span>
    </button>
  );
}

export function KontaktStatus({ k }: { k: Kontakt }) {
  const status = jetztStatus(k.hours);
  if (status.text) {
    return (
      <p className={`kd-status is-${status.state}`}>
        <span className="kd-status-dot" aria-hidden />
        {status.text}
      </p>
    );
  }
  if (k.availability) {
    return (
      <p className="kd-status is-info">
        <Icon name="clock" size={15} />
        {k.availability}
      </p>
    );
  }
  return null;
}

export function KontaktBody({ k, onOpenDoc, onShowOnMap }: {
  k: Kontakt;
  onOpenDoc?: (id: number) => void;
  onShowOnMap?: (k: Kontakt) => void;
}) {
  const primary = k.phones[0];
  const canMap = k.lat != null && k.lon != null && onShowOnMap;

  return (
    <div className="kd">
      <KontaktStatus k={k} />

      <div className="kd-actions">
        {primary && (
          <a className="kd-action kd-action--call" href={telHref(primary.number)}>
            <Icon name="phone" size={18} />
            <span>
              <strong>Anrufen</strong>
              <small>{primary.number}</small>
            </span>
          </a>
        )}
        {k.email && (
          <a className="kd-action" href={`mailto:${k.email}`}>
            <Icon name="mail" size={18} />
            <span>
              <strong>E-Mail</strong>
              <small>Schreiben</small>
            </span>
          </a>
        )}
        {canMap && (
          <button type="button" className="kd-action" onClick={() => onShowOnMap!(k)}>
            <Icon name="pin" size={18} />
            <span>
              <strong>Karte</strong>
              <small>Anfahrt</small>
            </span>
          </button>
        )}
        {k.url && (
          <a className="kd-action" href={k.url} target="_blank" rel="noreferrer">
            <Icon name="external" size={18} />
            <span>
              <strong>Website</strong>
              <small>Originalseite</small>
            </span>
          </a>
        )}
      </div>

      {(k.phones.length > 0 || k.email) && (
        <section className="kd-section">
          <h3>Kontakt</h3>
          <dl className="kd-facts">
            {k.phones.map((p, i) => (
              <div key={`${p.number}-${i}`}>
                <dt>{p.label}</dt>
                <dd>
                  <a href={telHref(p.number)}>{p.number}</a>
                  <CopyButton value={p.number} />
                </dd>
              </div>
            ))}
            {k.email && (
              <div>
                <dt>E-Mail</dt>
                <dd>
                  <a href={`mailto:${k.email}`}>{k.email}</a>
                  <CopyButton value={k.email} />
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {k.hours.length > 0 && (
        <section className="kd-section">
          <h3>Öffnungszeiten</h3>
          <div className="kd-hours">
            {k.hours.map((group, gi) => (
              <div className="kd-hours-group" key={`${group.label}-${gi}`}>
                <h4>{group.label}</h4>
                <dl>
                  {group.rows.map((row, ri) => {
                    const today = new Date().toLocaleDateString('de-DE', { weekday: 'long' }).toLowerCase() === row.day.toLowerCase();
                    return (
                      <div key={`${row.day}-${ri}`} className={today ? 'is-today' : ''}>
                        <dt>{row.day}{today && <span className="kd-today">heute</span>}</dt>
                        <dd>{row.times || '—'}{row.note && <span className="kd-note">{row.note}</span>}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {k.hours.length === 0 && k.hoursText && (
        <section className="kd-section">
          <h3>Öffnungszeiten</h3>
          <p className="kd-text">{k.hoursText}</p>
        </section>
      )}

      {k.services.length > 0 && (
        <section className="kd-section">
          <h3>Leistungen <span className="kd-count">{k.services.length}</span></h3>
          <ul className="kd-services">
            {k.services.map((s) => (
              <li key={s.url}>
                {s.documentId != null && onOpenDoc ? (
                  <button type="button" onClick={() => onOpenDoc(s.documentId!)}>
                    <span>{s.name}</span>
                    {s.online && <small>Online</small>}
                    <Icon name="chevron" size={15} className="muted" />
                  </button>
                ) : (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <span>{s.name}</span>
                    {s.online && <small>Online</small>}
                    <Icon name="external" size={14} className="muted" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {k.address && (
        <section className="kd-section">
          <h3>Adresse</h3>
          <p className="kd-address">
            <Icon name="pin" size={16} />
            <span>
              <strong>{k.address}</strong>
              {k.district && <small>Stadtbezirk {k.district}</small>}
            </span>
          </p>
        </section>
      )}

      {k.description && !k.services.length && (
        <section className="kd-section">
          <h3>Hinweis</h3>
          <p className="kd-text">{k.description}</p>
        </section>
      )}

      <footer className="kd-source">
        <Icon name="info" size={14} />
        <span>
          {k.source}
          {k.checkedAt ? ` · Stand ${standText(k.checkedAt)}` : ''}
          {k.confidence === 'amtlich' ? ' · amtliche Angabe' : k.confidence === 'redaktionell geprüft' ? ' · redaktionell geprüft' : ''}
          {k.sourceUrl && <> · <a href={k.sourceUrl} target="_blank" rel="noreferrer">Quelle öffnen</a></>}
        </span>
      </footer>
    </div>
  );
}

export function KontaktDetailView({ k, onClose, onOpenDoc, onShowOnMap }: {
  k: Kontakt;
  onClose: () => void;
  onOpenDoc?: (id: number) => void;
  onShowOnMap?: (k: Kontakt) => void;
}) {
  return (
    <div className="kd-detail">
      <header className="kd-head">
        <div className="kd-head-top">
          <span className={`kd-badge kind-${k.kind}`}>
            <Icon name={k.kind === 'notruf' ? 'warn' : k.kind === 'notdienst' ? 'health' : 'contact'} size={14} />
            {k.category ?? k.kindLabel}
          </span>
          <button type="button" className="icon-btn ghost" onClick={onClose} aria-label="Kontakt schließen">
            <Icon name="close" size={19} />
          </button>
        </div>
        <h2>{k.name}</h2>
        {k.organization && <p className="kd-org">{k.organization}</p>}
        {k.address && <p className="kd-address-line">{k.address}{k.district ? ` · ${k.district}` : ''}</p>}
      </header>
      <KontaktBody k={k} onOpenDoc={onOpenDoc} onShowOnMap={onShowOnMap} />
    </div>
  );
}
