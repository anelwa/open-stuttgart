import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { StuggiMark } from './StuggiMark';
import { SpeakButton } from './SpeakButton';
import type {
  BotActionRequest, BotCard, BotContext, BotEvent, BotOffice, BotParking, BotReceipt, BotResponse,
  BotRoutePlan, BotSource, BotUiAction, LegacyBotAction,
} from '../lib/bot/types';
import { BrowserRecognizer, cancelSpeech, speak, speechRecognitionSupported, speechSynthesisSupported } from '../lib/bot/voice';
import '../styles/stuttbot.css';

interface BotLocation {
  lat: number;
  lon: number;
  label?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: BotCard[];
  actions?: LegacyBotAction[];
  receipts?: BotReceipt[];
  sources?: BotSource[];
  limits?: string[];
  suggestions?: string[];
  fallback?: boolean;
  error?: boolean;
  fromVoice?: boolean;
}

const START_SUGGESTIONS = [
  'Zeig mir die Route von der Marienstraße 5 zum Marienplatz',
  'Personalausweis beantragen',
  'Was geht heute Abend bei Regen?',
  'Was weiß die Stadt über meine Adresse?',
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

const ACTION_ICON: Record<LegacyBotAction['type'], string> = {
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

const MODE_LABEL: Record<string, string> = { oepnv: 'Bahn/Bus', rad: 'Rad', fuss: 'zu Fuß', auto: 'Auto' };

export function StuttBot({
  open,
  onClose,
  onMap,
  onAction,
  onUndo,
  getContext,
  voiceRequest = 0,
  locale = 'de',
}: {
  open: boolean;
  onClose: () => void;
  onMap: (lngLat: [number, number], name: string, id?: string) => void;
  onAction: (action: BotUiAction) => BotReceipt;
  onUndo: (actionId: string) => void;
  getContext: () => BotContext;
  /** Zähler: jede Erhöhung startet den Voice Mode (z. B. aus der Suche). */
  voiceRequest?: number;
  locale?: 'de' | 'en';
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState<{ llm?: boolean } | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => {
    try { return localStorage.getItem('os-bot-session') || newId(); } catch { return newId(); }
  });
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const locationSent = useRef(false);
  const recognizer = useRef<BrowserRecognizer | null>(null);
  const speakRepliesRef = useRef(false);
  const handsFreeRef = useRef(false);
  const openRef = useRef(open);
  const busyRef = useRef(busy);
  speakRepliesRef.current = speakReplies;
  handsFreeRef.current = handsFree;
  openRef.current = open;
  busyRef.current = busy;

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (listening) { stopListening(); return; }
        cancelSpeech();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, listening]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  useEffect(() => () => {
    recognizer.current?.abort();
    cancelSpeech();
  }, []);

  const addMessage = useCallback((m: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: newId() }]);
  }, []);

  const stopListening = useCallback(() => {
    recognizer.current?.stop();
    setListening(false);
    setInterim('');
    setHandsFree(false);
  }, []);

  const sendRef = useRef<(raw?: string, locOverride?: BotLocation, opts?: { voice?: boolean }) => Promise<void>>(async () => {});

  const startListening = useCallback((hands = false) => {
    if (busyRef.current) return;
    if (!speechRecognitionSupported()) {
      setVoiceError('Dieser Browser kann Sprache nicht erkennen. Du kannst tippen – oder Chrome, Edge oder Safari verwenden.');
      return;
    }
    cancelSpeech();
    setVoiceError(null);
    setInterim('');
    setListening(true);
    if (!recognizer.current) recognizer.current = new BrowserRecognizer();
    recognizer.current.start({
      lang: locale === 'en' ? 'en-US' : 'de-DE',
      continuous: false,
      onStart: () => setListening(true),
      onInterim: (text) => setInterim(text),
      onFinal: (text) => {
        setInterim('');
        setListening(false);
        if (hands) setHandsFree(true);
        void sendRef.current(text, undefined, { voice: true });
      },
      onError: (message) => {
        setListening(false);
        setInterim('');
        setVoiceError(message);
      },
      onEnd: () => {
        setListening(false);
      },
    });
  }, [locale]); // send wird über sendRef aufgerufen

  const toggleMic = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }
    startListening(false);
  }, [listening, startListening, stopListening]);

  const voiceRequestRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    if (voiceRequest <= voiceRequestRef.current) {
      voiceRequestRef.current = voiceRequest;
      return;
    }
    voiceRequestRef.current = voiceRequest;
    const t = window.setTimeout(() => startListening(false), 320);
    return () => window.clearTimeout(t);
  }, [voiceRequest, open, startListening]);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      addMessage({ role: 'assistant', text: 'Dieser Browser kann den Standort nicht ermitteln. Nenne mir bitte eine Adresse oder PLZ.', error: true });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        void sendRef.current('', {
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
  }, [addMessage]);

  const runUiActions = useCallback((requests: BotActionRequest[] | undefined): BotReceipt[] => {
    const out: BotReceipt[] = [];
    for (const req of requests ?? []) {
      if (req.auto === false) continue;
      // Die Quittung kommt aus der App und trägt die ID, unter der der Undo-Snapshot liegt.
      out.push(onAction(req.action));
    }
    return out;
  }, [onAction]);

  const send = useCallback(async (raw?: string, locOverride?: BotLocation, opts?: { voice?: boolean }) => {
    const text = (raw ?? input).trim();
    if (busy || (!text && !locOverride)) return;
    setBusy(true);
    setInput('');
    setInterim('');
    if (text) addMessage({ role: 'user', text, fromVoice: opts?.voice });
    else if (locOverride) addMessage({ role: 'user', text: '📍 Mein Standort' });

    const firstLocation = !locationSent.current ? readSavedLocation() : null;
    try {
      const res = await fetch('/api/bot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          location: locOverride ?? firstLocation,
          context: getContext(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Fehler ${res.status}`);
      const bot = data as BotResponse;
      if (bot.sessionId) setSessionId(bot.sessionId);
      locationSent.current = true;
      const receipts = runUiActions(bot.ui);
      const cards = [...(bot.cards ?? [])];
      if (bot.office && !cards.some((c) => c.type === 'office')) {
        cards.unshift({ type: 'office', office: bot.office, alternatives: bot.alternatives ?? [] });
      }
      addMessage({
        role: 'assistant',
        text: bot.reply,
        cards,
        actions: bot.actions ?? [],
        receipts,
        sources: bot.sources ?? [],
        limits: bot.limits ?? [],
        suggestions: bot.suggestions ?? [],
        fallback: !!bot.meta?.fallback,
        fromVoice: opts?.voice,
      });
      if (typeof bot.meta?.llm === 'boolean') setStatus({ llm: !!bot.meta.llm && !bot.meta.fallback });

      const shouldSpeak = speechSynthesisSupported() && (opts?.voice || speakRepliesRef.current || handsFreeRef.current);
      if (shouldSpeak) {
        void speak(bot.speech || bot.reply, {
          lang: locale === 'en' ? 'en-US' : 'de-DE',
          onEnd: () => {
            if (handsFreeRef.current && openRef.current && !busyRef.current) {
              window.setTimeout(() => startListening(true), 350);
            }
          },
        });
      } else if (handsFreeRef.current && openRef.current) {
        window.setTimeout(() => startListening(true), 350);
      }
    } catch (err) {
      addMessage({
        role: 'assistant',
        text: `Ich konnte gerade nicht antworten: ${(err as Error).message}. Versuch es bitte noch einmal.`,
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }, [addMessage, busy, getContext, input, locale, runUiActions, sessionId, startListening]);

  sendRef.current = send;

  const handleLegacyAction = (a: LegacyBotAction) => {
    if (a.type === 'location') { useMyLocation(); return; }
    if (a.type === 'route' && a.lat != null && a.lon != null) {
      onAction({ type: 'show_route', to: { lat: a.lat, lon: a.lon, label: a.name ?? 'Ziel' }, fit: true });
      return;
    }
    if (a.type === 'map' && a.lat != null && a.lon != null) {
      onMap([a.lon, a.lat], a.name ?? 'Ziel', a.gebaeudeId ?? undefined);
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
        aria-label="StuggiAI"
        aria-hidden={!open}
      >
        <header className="sb-head">
          <div className="sb-head-mark">
            <StuggiMark size={46} badge />
          </div>
          <div className="sb-head-text">
            <div className="sb-title-row">
              <h2>StuggiAI</h2>
              <span className="sb-beta">Beta</span>
            </div>
            <p>Fragen, zeigen, machen – sag einfach.</p>
          </div>
          <button
            type="button"
            className={`sb-voice-toggle ${speakReplies ? 'on' : ''}`}
            onClick={() => {
              setSpeakReplies((v) => !v);
              if (speakReplies) cancelSpeech();
            }}
            aria-pressed={speakReplies}
            aria-label={speakReplies ? 'Vorlesen ausschalten' : 'Antworten vorlesen'}
            title={speakReplies ? 'Vorlesen aus' : 'Antworten vorlesen'}
          >
            <Icon name={speakReplies ? 'volume' : 'volumeOff'} size={18} />
          </button>
          <button type="button" className="sb-close" onClick={onClose} aria-label="StuggiAI schließen">
            <Icon name="close" size={19} />
          </button>
        </header>

        <div className="sb-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="sb-hero">
              <StuggiMark size={92} badge title="StuggiAI" />
              <h3>Hi, ich bin StuggiAI.</h3>
              <p>
                Ich kenne die Karte, die Ämter und die Wege. Sag mir, was du vorhast – ich zeige es dir
                und stelle die Karte passend ein.
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
                <span>Keine Rechtsberatung. Angaben aus stuttgart.de, Wartezeiten live. Jede Kartenaktion ist rückgängig.</span>
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`sb-msg sb-msg--${m.role} ${m.error ? 'is-error' : ''}`}>
              {m.role === 'assistant' && (
                <div className="sb-avatar">
                  <StuggiMark size={28} badge tone="accent" />
                </div>
              )}
              <div className="sb-bubble-wrap">
                <div className="sb-bubble">
                  <p>{m.text}</p>
                  {m.role === 'assistant' && <div className="sb-speak"><SpeakButton text={m.text} compact /></div>}
                  {m.cards?.map((card, i) => <BotCardView key={`${card.type}-${i}`} card={card} onAction={onAction} />)}
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
                            onClick={() => handleLegacyAction(a)}
                            disabled={a.type === 'location' && locating}
                          >
                            <Icon name={ACTION_ICON[a.type]} size={15} />
                            {a.type === 'location' && locating ? 'Standort wird ermittelt …' : a.label}
                          </button>
                        )
                      ))}
                    </div>
                  )}
                  {(m.receipts?.length ?? 0) > 0 && (
                    <ul className="sb-receipts" aria-label="Ausgeführte Kartenaktionen">
                      {m.receipts!.map((r) => (
                        <li key={r.actionId} className={r.status === 'error' ? 'is-error' : ''}>
                          <Icon name={r.status === 'error' ? 'warn' : 'check'} size={14} />
                          <span>{r.label}</span>
                          {r.undoable && (
                            <button type="button" className="sb-undo" onClick={() => onUndo(r.actionId)}>
                              <Icon name="undo" size={13} /> Rückgängig
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {((m.sources?.length ?? 0) > 0 || (m.limits?.length ?? 0) > 0) && (
                    <div className="sb-sources">
                      {m.sources?.map((s) => <span key={s.name} title={s.license ?? undefined}>{s.name}</span>)}
                      {m.limits?.map((l) => <span key={l} className="is-limit">{l}</span>)}
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
              <div className="sb-avatar"><StuggiMark size={28} badge tone="accent" /></div>
              <div className="sb-typing" aria-label="StuggiAI arbeitet">
                <span /><span /><span />
              </div>
            </div>
          )}
        </div>

        {(listening || voiceError) && (
          <div className={`sb-voice-live ${voiceError ? 'is-error' : ''}`} role="status" aria-live="polite">
            <span className="sb-wave" aria-hidden><i /><i /><i /><i /><i /></span>
            <span>{voiceError ?? (interim || 'Ich höre zu …')}</span>
            {listening && (
              <button type="button" className="sb-voice-stop" onClick={stopListening} aria-label="Sprachaufnahme beenden">
                <Icon name="stop" size={14} />
              </button>
            )}
          </div>
        )}

        <div className="sb-voicebar">
          <button
            type="button"
            className={`sb-voice-btn ${listening ? 'is-live' : ''}`}
            onClick={toggleMic}
            disabled={busy}
            aria-pressed={listening}
            title={speechRecognitionSupported() ? 'Sprechen' : 'Spracherkennung in diesem Browser nicht verfügbar'}
          >
            <Icon name="mic" size={16} />
            <span>{listening ? 'Ich höre zu …' : 'Sprechen'}</span>
          </button>
          <button
            type="button"
            className={`sb-voice-btn ${handsFree ? 'on' : ''}`}
            onClick={() => {
              setHandsFree((v) => {
                const next = !v;
                if (!next) stopListening();
                else window.setTimeout(() => startListening(true), 0);
                return next;
              });
            }}
            aria-pressed={handsFree}
            title="Nach jeder Antwort automatisch weiterhören"
          >
            <span className="sb-hf-dot" aria-hidden />
            <span>Freihändig</span>
          </button>
          <span className="sb-voice-hint">
            {speechRecognitionSupported() ? 'Sprache bleibt im Browser' : 'Tippen ist der Weg'}
          </span>
        </div>

        <form
          className="sb-composer"
          onSubmit={(e) => { e.preventDefault(); void send(); }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? (interim || 'Ich höre zu …') : 'Frag mich z. B. nach einem Personalausweis …'}
            aria-label="Nachricht an StuggiAI"
            maxLength={1200}
            disabled={busy}
          />
          <button type="submit" className="sb-send" disabled={busy || !input.trim()} aria-label="Senden">
            <Icon name="chevron" size={20} />
          </button>
        </form>
        <footer className="sb-foot">
          <span>{status?.llm ? 'Mit Gemini · Quellen an jeder Angabe' : 'Regelmodus · Quellen an jeder Angabe'}</span>
          <span>Keine Rechtsberatung</span>
        </footer>
      </aside>
    </>
  );
}

function BotCardView({ card, onAction }: {
  card: BotCard;
  onAction: (a: BotUiAction) => BotReceipt;
}) {
  switch (card.type) {
    case 'office':
      return <OfficeCard office={card.office} alternatives={card.alternatives} onAction={onAction} />;
    case 'route':
      return <RouteCard plan={card.plan} alternatives={card.alternatives} onAction={onAction} />;
    case 'events':
      return <EventsCard items={card.items} note={card.note} onAction={onAction} />;
    case 'weather':
      return <WeatherCard now={card.now} hours={card.hours} warning={card.warning} />;
    case 'parking':
      return <ParkingCard site={card.site} walkMin={card.walkMin} onAction={onAction} />;
    case 'knowledge':
      return <KnowledgeCard hits={card.hits} onAction={onAction} />;
    case 'places':
      return <PlacesCard title={card.title} items={card.items} onAction={onAction} />;
    case 'address':
      return <AddressCard profile={card.profile} />;
    case 'not_possible':
      return (
        <div className="sb-note is-warn">
          <Icon name="info" size={16} />
          <div>
            <strong>Das kann ich nicht</strong>
            <p>{card.reason}</p>
            {card.link && <a className="sb-action" href={card.link} target="_blank" rel="noopener noreferrer">Zur zuständigen Stelle</a>}
          </div>
        </div>
      );
  }
}

function OfficeCard({ office, alternatives, onAction }: {
  office: BotOffice;
  alternatives?: BotOffice[];
  onAction: (a: BotUiAction) => BotReceipt;
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
      <div className="sb-actions">
        <button type="button" className="sb-action is-primary" onClick={() => onAction({ type: 'show_route', to: { lat: office.lat, lon: office.lon, label: office.name }, fit: true })}>
          <Icon name="route" size={15} /> Route öffnen
        </button>
        <button type="button" className="sb-action" onClick={() => onAction({ type: 'fly_to', lat: office.lat, lon: office.lon, zoom: 16 })}>
          <Icon name="pin" size={15} /> Auf Karte
        </button>
        {office.booking && <a className="sb-action" href={office.booking} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={15} /> Termin buchen</a>}
      </div>
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
                <button type="button" className="sb-alt-map" onClick={() => onAction({ type: 'fly_to', lat: a.lat, lon: a.lon, zoom: 16 })}>
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

function RouteCard({ plan, alternatives, onAction }: {
  plan: BotRoutePlan;
  alternatives?: BotRoutePlan[];
  onAction: (a: BotUiAction) => BotReceipt;
}) {
  return (
    <div className="sb-route-card">
      <div className="sb-route-head">
        <span className="sb-route-mode"><Icon name={plan.mode === 'rad' ? 'bike' : plan.mode === 'fuss' ? 'walk' : plan.mode === 'auto' ? 'car' : 'train'} size={16} /> {MODE_LABEL[plan.mode] ?? plan.mode}</span>
        <strong>{plan.durationMin} Min</strong>
        {plan.estimated && <em>geschätzt</em>}
      </div>
      <p className="sb-route-path">{plan.from.label} → {plan.to.label}</p>
      <p className="sb-route-meta">
        {plan.transfers ? `${plan.transfers} Umstieg${plan.transfers > 1 ? 'e' : ''}` : 'ohne Umstieg'}
        {plan.profile && plan.profile !== 'standard' ? ` · ${plan.profile === 'rollstuhl' ? 'stufenlos' : 'mit Kinderwagen'}` : ''}
      </p>
      <div className="sb-actions">
        <button type="button" className="sb-action is-primary" onClick={() => onAction({ type: 'show_route', from: plan.from, to: plan.to, mode: plan.mode, profile: plan.profile, fit: true })}>
          <Icon name="route" size={15} /> Route auf Karte
        </button>
        <button type="button" className="sb-action" onClick={() => onAction({ type: 'fly_to', lat: plan.to.lat, lon: plan.to.lon, zoom: 16 })}>
          <Icon name="pin" size={15} /> Ziel
        </button>
      </div>
      {(alternatives?.length ?? 0) > 0 && (
        <details className="sb-alt">
          <summary>Alternativen</summary>
          <ul>
            {alternatives!.map((a, i) => (
              <li key={`${a.mode}-${i}`}>
                <span>{MODE_LABEL[a.mode] ?? a.mode}</span>
                <span>{a.durationMin} Min</span>
                <button type="button" className="sb-alt-map" onClick={() => onAction({ type: 'show_route', from: a.from, to: a.to, mode: a.mode, fit: true })}>Öffnen</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EventsCard({ items, note, onAction }: {
  items: BotEvent[];
  note?: string;
  onAction: (a: BotUiAction) => BotReceipt;
}) {
  const fmt = (iso?: string | null) => {
    if (!iso) return 'ganztägig';
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'Termin';
  };
  return (
    <div className="sb-list-card">
      {note && <p className="sb-card-note">{note}</p>}
      <ul>
        {items.slice(0, 5).map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                onAction({ type: 'select', selection: { type: 'event', id: e.id } });
                if (e.lat != null && e.lon != null) onAction({ type: 'fly_to', lat: e.lat, lon: e.lon, zoom: 15.5 });
              }}
            >
              <span className="sb-event-time">{fmt(e.start)}</span>
              <span className="sb-event-title">{e.title}</span>
              <span className="sb-event-place">{e.location ?? ''}{e.free ? ' · kostenlos' : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeatherCard({ now, hours, warning }: {
  now: { temperature: number; condition?: string; icon?: string; precipitation?: number; time?: string };
  hours?: { temperature: number; condition?: string; icon?: string; precipitation?: number; time?: string }[];
  warning?: string;
}) {
  return (
    <div className="sb-weather-card">
      <div className="sb-weather-now">
        <Icon name={now.icon ?? 'cloud'} size={26} />
        <strong>{Math.round(now.temperature)}°</strong>
        <span>{now.condition ?? 'Wetter'}</span>
      </div>
      {hours && hours.length > 0 && (
        <div className="sb-weather-hours">
          {hours.slice(0, 6).map((h, i) => (
            <span key={`${h.time}-${i}`}>
              <small>{h.time ? new Date(h.time).toLocaleTimeString('de-DE', { hour: '2-digit' }) : ''}</small>
              <Icon name={h.icon ?? 'cloud'} size={15} />
              <b>{Math.round(h.temperature)}°</b>
              {h.precipitation ? <em>{h.precipitation.toFixed(1)} mm</em> : null}
            </span>
          ))}
        </div>
      )}
      {warning && <p className="sb-card-note is-warn"><Icon name="warn" size={14} /> {warning}</p>}
    </div>
  );
}

function ParkingCard({ site, walkMin, onAction }: {
  site: BotParking;
  walkMin?: number | null;
  onAction: (a: BotUiAction) => BotReceipt;
}) {
  return (
    <div className="sb-parking-card">
      <div className="sb-office-top">
        <Icon name="parking" size={17} />
        <strong>{site.name}</strong>
        <span className="sb-parking-free">{site.free != null ? `${site.free} frei` : 'keine Live-Angabe'}</span>
      </div>
      <p className="sb-office-address">{site.address ?? 'Parkhaus'}{site.fee ? ` · ${site.fee}` : ''}</p>
      {walkMin != null && <p className="sb-card-note">Fußweg zum Ziel ca. {walkMin} Min</p>}
      <div className="sb-actions">
        <button type="button" className="sb-action is-primary" onClick={() => onAction({ type: 'show_route', to: { lat: site.lat, lon: site.lon, label: site.name }, mode: 'auto', fit: true })}>
          <Icon name="car" size={15} /> Route
        </button>
        <button type="button" className="sb-action" onClick={() => onAction({ type: 'fly_to', lat: site.lat, lon: site.lon, zoom: 16 })}>
          <Icon name="pin" size={15} /> Karte
        </button>
      </div>
    </div>
  );
}

function KnowledgeCard({ hits, onAction }: {
  hits: { id?: number; title: string; type?: string; snippet?: string | null; url?: string | null; source?: string | null }[];
  onAction: (a: BotUiAction) => BotReceipt;
}) {
  return (
    <div className="sb-list-card">
      <ul>
        {hits.slice(0, 5).map((h, i) => (
          <li key={`${h.id ?? h.title}-${i}`}>
            <button type="button" onClick={() => { if (h.id) onAction({ type: 'open_document', id: h.id }); else if (h.url) window.open(h.url, '_blank', 'noopener,noreferrer'); }}>
              <span className="sb-event-title">{h.title}</span>
              <span className="sb-event-place">{h.type ?? h.source ?? 'Dokument'}{h.snippet ? ` · ${h.snippet}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlacesCard({ title, items, onAction }: {
  title?: string;
  items: { id?: string; name: string; detail?: string | null; lat?: number | null; lon?: number | null }[];
  onAction: (a: BotUiAction) => BotReceipt;
}) {
  return (
    <div className="sb-list-card">
      {title && <p className="sb-card-note">{title}</p>}
      <ul>
        {items.slice(0, 6).map((item, i) => (
          <li key={`${item.id ?? item.name}-${i}`}>
            <button
              type="button"
              onClick={() => {
                if (item.lat != null && item.lon != null) onAction({ type: 'fly_to', lat: item.lat, lon: item.lon, zoom: 16 });
              }}
            >
              <span className="sb-event-title">{item.name}</span>
              {item.detail && <span className="sb-event-place">{item.detail}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddressCard({ profile }: { profile: { label: string; district?: string | null; facts: { label: string; value: string }[] } }) {
  return (
    <div className="sb-address-card">
      <div className="sb-office-top"><Icon name="home" size={17} /><strong>{profile.label}</strong>{profile.district && <span className="sb-office-state is-open">{profile.district}</span>}</div>
      <dl>
        {profile.facts.slice(0, 6).map((f) => (
          <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>
        ))}
      </dl>
    </div>
  );
}
