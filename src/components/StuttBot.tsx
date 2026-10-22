import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { StuttBotMark } from './StuttBotMark';
import { usePlanRoute } from '../lib/routeCtx';
import '../styles/stuttbot.css';

interface BotLocation {
  lat: number;
  lon: number;
  label?: string;
}

interface BotAction {
  type: 'booking' | 'route' | 'map' | 'link' | 'online' | 'location';
  label: string;
  url?: string;
  lat?: number;
  lon?: number;
  name?: string;
  gebaeudeId?: string | null;
}

interface BotOffice {
  name: string;
  address: string;
  open: boolean | null;
  openText: string | null;
  onlyAppointment: boolean | null;
  waitMin: number | null;
  waitText: string | null;
  waitStatus: number | null;
  waitFeeling: string | null;
  booking: string | null;
  lat: number;
  lon: number;
  gebaeudeId?: string | null;
  distM: number | null;
  travelMin: number | null;
  travelLabel: string | null;
  totalMin: number | null;
}

interface BotMeta {
  model?: string | null;
  llm?: boolean;
  fallback?: boolean;
  budget?: { limitUsd: number; spentUsd: number };
}

interface BotResponse {
  sessionId: string;
  reply: string;
  suggestions?: string[];
  actions?: BotAction[];
  office?: BotOffice | null;
  alternatives?: BotOffice[];
  meta?: BotMeta;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  office?: BotOffice | null;
  alternatives?: BotOffice[];
  actions?: BotAction[];
  suggestions?: string[];
  fallback?: boolean;
  error?: boolean;
}

const START_SUGGESTIONS = [
  'Personalausweis beantragen',
  'Wohnsitz anmelden',
  'Führerschein beantragen',
  'Termin im Bürgerbüro',
];

function newId() {
  try { return crypto.randomUUID(); } catch { return `sb-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function readSavedLocation(): BotLocation | null {
  try {
    const saved = JSON.parse(localStorage.getItem('os-adresse') ?? 'null');
    const [lon, lat] = saved?.lngLat ?? [];
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat: Number(lat), lon: Number(lon), label: saved.label ?? saved.address ?? 'Meine Adresse' };
    }
  } catch { /* egal */ }
  return null;
}

const ACTION_ICON: Record<BotAction['type'], string> = {
  booking: 'calendar',
  online: 'external',
  link: 'external',
  route: 'route',
  map: 'pin',
  location: 'locate',
};

function waitTone(o: BotOffice) {
  if (o.onlyAppointment) return 'termin';
  if (o.open === false || o.waitStatus === 0) return 'zu';
  if (o.waitStatus === 11 || (o.waitStatus ?? 0) >= 10) return 'voll';
  if ((o.waitStatus ?? 0) >= 6) return 'lang';
  return 'kurz';
}

export function StuttBot({
  open,
  onClose,
  onMap,
}: {
  open: boolean;
  onClose: () => void;
  onMap: (lngLat: [number, number], name: string, id?: string) => void;
}) {
  const planRoute = usePlanRoute();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState<{ llm?: boolean } | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => {
    try { return localStorage.getItem('os-bot-session') || newId(); } catch { return newId(); }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedLocation = useRef<BotLocation | null>(readSavedLocation());
  const locationSent = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('os-bot-session', sessionId); } catch { /* egal */ }
  }, [sessionId]);

  useEffect(() => {
    if (!open) return;
    if (!status) {
      fetch('/api/bot/health')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setStatus({ llm: !!d.llm }); })
        .catch(() => setStatus({ llm: false }));
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 160);
    return () => window.clearTimeout(t);
  }, [open, status]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  const addMessage = (m: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: newId() }]);
  };

  const send = async (raw?: string, locOverride?: BotLocation) => {
    const text = (raw ?? input).trim();
    if (busy || (!text && !locOverride)) return;
    setBusy(true);
    setInput('');
    if (text) addMessage({ role: 'user', text });
    else if (locOverride) addMessage({ role: 'user', text: '📍 Mein Standort' });

    const firstLocation = !locationSent.current && savedLocation.current ? savedLocation.current : null;
    try {
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          location: locOverride ?? firstLocation,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Fehler ${res.status}`);
      const bot = data as BotResponse;
      if (bot.sessionId) setSessionId(bot.sessionId);
      locationSent.current = true;
      addMessage({
        role: 'assistant',
        text: bot.reply,
        office: bot.office ?? null,
        alternatives: bot.alternatives ?? [],
        actions: bot.actions ?? [],
        suggestions: bot.suggestions ?? [],
        fallback: !!bot.meta?.fallback,
      });
      if (typeof bot.meta?.llm === 'boolean') setStatus({ llm: bot.meta.llm });
    } catch (err) {
      addMessage({
        role: 'assistant',
        text: `Ich konnte gerade nicht antworten: ${(err as Error).message}. Versuch es bitte noch einmal.`,
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      addMessage({ role: 'assistant', text: 'Dieser Browser kann den Standort nicht ermitteln. Nenne mir bitte eine Adresse oder PLZ.', error: true });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void send('', {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: 'Mein Standort',
        });
      },
      (err) => {
        setLocating(false);
        addMessage({
          role: 'assistant',
          text: err.code === err.PERMISSION_DENIED
            ? 'Der Standort ist nicht freigegeben. Du kannst ihn in den Browser-Einstellungen erlauben oder mir eine Adresse nennen.'
            : 'Den Standort konnte ich nicht ermitteln. Nenne mir bitte eine Adresse oder PLZ.',
          error: true,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const handleAction = (a: BotAction) => {
    if (a.type === 'location') { useMyLocation(); return; }
    if (a.type === 'route' && a.lat != null && a.lon != null) {
      planRoute({ lat: a.lat, lon: a.lon, label: a.name ?? 'Ziel' });
      onClose();
      return;
    }
    if (a.type === 'map' && a.lat != null && a.lon != null) {
      onMap([a.lon, a.lat], a.name ?? 'Ziel', a.gebaeudeId ?? undefined);
      onClose();
      return;
    }
    if (a.url) window.open(a.url, '_blank', 'noopener,noreferrer');
  };

  const last = messages[messages.length - 1];
  const showSuggestions = !busy && last?.role === 'assistant' && (last.suggestions?.length ?? 0) > 0;

  return (
    <>
      <div className={`sb-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside
        className={`sb-panel ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="StuttBot"
        aria-hidden={!open}
      >
        <header className="sb-head">
          <div className="sb-head-mark">
            <StuttBotMark size={46} badge />
          </div>
          <div className="sb-head-text">
            <div className="sb-title-row">
              <h2>StuttBot</h2>
              <span className="sb-beta">Beta</span>
            </div>
            <p>Amt, Termin, Weg – frag einfach.</p>
          </div>
          <button type="button" className="sb-close" onClick={onClose} aria-label="StuttBot schließen">
            <Icon name="close" size={19} />
          </button>
        </header>

        <div className="sb-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="sb-hero">
              <StuttBotMark size={92} badge title="StuttBot" />
              <h3>Hi, ich bin StuttBot.</h3>
              <p>
                Ich finde die passende Leistung, das nächste Bürgerbüro mit Wartezeit und den Weg dorthin.
                Sag mir einfach, was du vorhast.
              </p>
              <div className="sb-hero-chips">
                {START_SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="sb-chip" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <p className="sb-hero-note">
                <Icon name="info" size={14} />
                <span>Keine Rechtsberatung. Angaben aus stuttgart.de, Wartezeiten live.</span>
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`sb-msg sb-msg--${m.role} ${m.error ? 'is-error' : ''}`}>
              {m.role === 'assistant' && (
                <div className="sb-avatar">
                  <StuttBotMark size={28} badge />
                </div>
              )}
              <div className="sb-bubble-wrap">
                <div className="sb-bubble">
                  <p>{m.text}</p>
                  {m.office && <OfficeCard office={m.office} alternatives={m.alternatives} onAction={handleAction} />}
                  {(m.actions?.length ?? 0) > 0 && (
                    <div className="sb-actions">
                      {m.actions!.map((a) => (
                        a.url ? (
                          <a
                            key={`${a.type}-${a.label}-${a.url}`}
                            className={`sb-action ${a.type === 'booking' ? 'is-primary' : ''}`}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Icon name={ACTION_ICON[a.type]} size={15} />
                            {a.label}
                          </a>
                        ) : (
                          <button
                            key={`${a.type}-${a.label}`}
                            type="button"
                            className={`sb-action ${a.type === 'location' ? 'is-primary' : ''}`}
                            onClick={() => handleAction(a)}
                            disabled={a.type === 'location' && locating}
                          >
                            <Icon name={ACTION_ICON[a.type]} size={15} />
                            {a.type === 'location' && locating ? 'Standort wird ermittelt …' : a.label}
                          </button>
                        )
                      ))}
                    </div>
                  )}
                </div>
                {m.role === 'assistant' && m.fallback && (
                  <span className="sb-mode">Regelbasiert beantwortet</span>
                )}
              </div>
            </div>
          ))}

          {showSuggestions && (
            <div className="sb-followups">
              {last.suggestions!.map((s) => (
                <button key={s} type="button" className="sb-chip" onClick={() => void send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {busy && (
            <div className="sb-msg sb-msg--assistant">
              <div className="sb-avatar"><StuttBotMark size={28} badge /></div>
              <div className="sb-typing" aria-label="StuttBot schreibt">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        <form
          className="sb-composer"
          onSubmit={(e) => { e.preventDefault(); void send(); }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frag mich z. B. nach einem Personalausweis …"
            aria-label="Nachricht an StuttBot"
            maxLength={1200}
            disabled={busy}
          />
          <button type="submit" className="sb-send" disabled={busy || !input.trim()} aria-label="Senden">
            <Icon name="chevron" size={20} />
          </button>
        </form>
        <footer className="sb-foot">
          <span>{status?.llm ? 'Mit Gemini · Angaben aus stuttgart.de' : 'Regelmodus · Angaben aus stuttgart.de'}</span>
          <span>Keine Rechtsberatung</span>
        </footer>
      </aside>
    </>
  );
}

function OfficeCard({
  office,
  alternatives,
  onAction,
}: {
  office: BotOffice;
  alternatives?: BotOffice[];
  onAction: (a: BotAction) => void;
}) {
  const tone = waitTone(office);
  return (
    <div className={`sb-office is-${tone}`}>
      <div className="sb-office-top">
        <Icon name="home" size={17} />
        <strong>{office.name}</strong>
        {office.onlyAppointment && <span className="sb-office-state is-appt">nur mit Termin</span>}
        {!office.onlyAppointment && office.open === false && <span className="sb-office-state">geschlossen</span>}
        {!office.onlyAppointment && office.open === true && <span className="sb-office-state is-open">offen</span>}
      </div>
      <p className="sb-office-address">{office.address}</p>
      <div className="sb-office-stats">
        <div>
          <span className="sb-stat-label">Wartezeit</span>
          <strong>{office.waitMin != null ? `ca. ${office.waitMin} Min` : 'keine Live-Angabe'}</strong>
          {office.waitFeeling && <small>{office.waitFeeling}</small>}
        </div>
        <div>
          <span className="sb-stat-label">{office.travelLabel ?? 'Anfahrt'}</span>
          <strong>{office.travelMin != null ? `${office.travelMin} Min` : '—'}</strong>
          {office.totalMin != null && <small>zusammen ca. {office.totalMin} Min</small>}
        </div>
      </div>
      {office.openText && <p className="sb-office-hours">{office.openText}</p>}
      {(alternatives?.length ?? 0) > 0 && (
        <details className="sb-alt">
          <summary>Weitere Bürgerbüros</summary>
          <ul>
            {alternatives!.map((a) => (
              <li key={`${a.name}-${a.address}`}>
                <span>{a.name}</span>
                <span>
                  {a.waitMin != null ? `${a.waitMin} Min Wartezeit` : 'keine Wartezeit-Angabe'}
                  {a.travelMin != null ? ` · ${a.travelMin} Min Anfahrt` : ''}
                  {a.totalMin != null ? ` · ca. ${a.totalMin} Min gesamt` : ''}
                </span>
                <button type="button" className="sb-alt-map" onClick={() => onAction({ type: 'map', label: 'Karte', lat: a.lat, lon: a.lon, name: a.name })}>
                  Karte
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
