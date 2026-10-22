import { Disclosure } from './ui';
import { Icon } from './Icon';
import { ALLE_THEMEN } from '../lib/anliegen';
import { tr, useLang } from '../lib/i18n';

/**
 * Der Einstieg im linken Panel.
 *
 * Die Anliegen liegen als Schnellaktionen dauerhaft über der Karte und die Suche als Pill
 * unten zentral — beides immer erreichbar. Dieser Bereich hält sich deshalb zurück:
 * eine kurze Orientierung und die vollständige Themenliste für alles, was kein Anliegen ist.
 */
export function StartPanel({ onModule }: { onModule: (id: string) => void }) {
  useLang();
  return (
    <div className="start">
      <h2 className="start-title">{tr('Was möchtest du tun?')}</h2>
      <p className="start-sub">
        {tr('Wähle ein Anliegen oder suche direkt nach Ort, Haltestelle oder Thema.')}
      </p>

      <Disclosure label="Alle Themen" defaultOpen count={ALLE_THEMEN.length}>
        <ul className="themen-list">
          {ALLE_THEMEN.map((m) => (
            <li key={m.id}>
              <button type="button" className="themen-row" onClick={() => onModule(m.id)}>
                <Icon name={m.icon} size={18} />
                <span>
                  <span className="themen-label">{tr(m.label)}</span>
                  <span className="themen-hint">{tr(m.hint)}</span>
                </span>
                <Icon name="chevron" size={15} className="chev-right" />
              </button>
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
