import { ANLIEGEN, type Anliegen } from '../lib/anliegen';
import { Icon } from './Icon';
import { StuttBotMark } from './StuttBotMark';
import { tr, useLang } from '../lib/i18n';

/**
 * Schnellaktionen oben über der Karte — das Muster von Google Maps: eine horizontale
 * Reihe von Pillen mit Icon und Kurzlabel, scrollbar, ohne die Karte zu verdecken.
 * Ganz links steht StuttBot mit eigenem Maskottchen; danach folgen die Anliegen.
 */
export function QuickActions({ active, onPick, onBot }: {
  active: string | null;
  onPick: (a: Anliegen) => void;
  onBot: () => void;
}) {
  useLang();
  return (
    <nav className="quick-actions" aria-label="Schnellzugriff">
      <ul>
        <li>
          <button
            type="button"
            className="quick-pill quick-pill--bot"
            title="StuttBot: Amt, Termin und Weg"
            onClick={onBot}
          >
            <StuttBotMark size={20} />
            <span>StuttBot</span>
          </button>
        </li>
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
