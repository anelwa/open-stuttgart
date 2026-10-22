import { ANLIEGEN, type Anliegen } from '../lib/anliegen';
import { Icon } from './Icon';
import { tr, useLang } from '../lib/i18n';

/**
 * Schnellaktionen oben über der Karte — das Muster von Google Maps: eine horizontale
 * Reihe von Pillen mit Icon und Kurzlabel, scrollbar, ohne die Karte zu verdecken.
 * Sie ersetzen die bisherigen Themenreiter und den Anliegen-Block im Einstieg.
 */
export function QuickActions({ active, onPick }: {
  active: string | null;
  onPick: (a: Anliegen) => void;
}) {
  useLang();
  return (
    <nav className="quick-actions" aria-label="Anliegen">
      <ul>
        {ANLIEGEN.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              className={`quick-pill ${active === a.id ? 'on' : ''}`}
              aria-pressed={active === a.id}
              title={tr(a.hint)}
              onClick={() => onPick(a)}
            >
              <Icon name={a.icon} size={17} />
              <span>{tr(a.short)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
