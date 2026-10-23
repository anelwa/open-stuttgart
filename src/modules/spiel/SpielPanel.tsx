// Modul „Kesselcode“: fünf Routen, ein Routenbuch, Antworten vor Ort.
// Der Fortschritt bleibt lokal; Antworten werden über /api/spiel/pruefen geprüft.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ModuleProps } from '../types';
import { OVERLAY_LAYERS, type OverlayKey } from '../../map/overlays';
import { Icon } from '../../components/Icon';
import { Disclosure, ErrorNote, Section, SkeletonRows, Source } from '../../components/ui';
import { useSpiel } from './useSpiel';
import { buildSpielGeo, routeBounds } from './spielMap';
import type { Route, RouteProgress, RouteSummary, Station } from './types';
import '../../styles/spiel.css';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const DIFFICULTY_LABEL = ['', 'leicht', 'entspannt', 'anspruchsvoll', 'sportlich', 'Königsetappe'];

const fmtDuration = ([a, b]: [number, number]) => a === b
  ? `${(a / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.`
  : `${(a / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })}–${(b / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.`;

const fmtElapsed = (ms: number) => {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}:${String(m).padStart(2, '0')} Std.` : `${m} Min.`;
};

const fmtDate = (iso?: string) => iso
  ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
  : '';

const distM = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function Difficulty({ n }: { n: number }) {
  return (
    <span className="spiel-diff" aria-label={`Schwierigkeit ${n} von 5: ${DIFFICULTY_LABEL[n]}`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} aria-hidden />)}
    </span>
  );
}

function RouteCard({ r, progress, open, onToggle, onStart, onReset }: {
  r: RouteSummary;
  progress: RouteProgress | null;
  open: boolean;
  onToggle: () => void;
  onStart: () => void;
  onReset: () => void;
}) {
  const solved = progress?.solved.length ?? 0;
  const pct = Math.round((solved / Math.max(1, r.stationCount)) * 100);
  const done = !!progress?.completedAt;
  return (
    <article className={`spiel-card ${open ? 'is-open' : ''} ${done ? 'is-done' : ''}`} style={{ '--spiel-color': r.color } as CSSProperties}>
      <button type="button" className="spiel-card-head" aria-expanded={open} onClick={onToggle}>
        <span className="spiel-card-swatch" aria-hidden />
        <span className="spiel-card-main">
          <span className="spiel-kicker">Kapitel {ROMAN[r.chapter]} · {DIFFICULTY_LABEL[r.difficulty]}</span>
          <span className="spiel-card-title">{r.title}</span>
          <span className="spiel-card-sub">{r.subtitle}</span>
          <span className="spiel-card-meta">
            <Difficulty n={r.difficulty} />
            <span>{fmtDuration(r.durationMin)}</span>
            <span>{r.distanceKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km</span>
            <span>{r.stationCount} Stationen</span>
          </span>
        </span>
        <span className="spiel-card-side">
          {done
            ? <span className="spiel-done-chip"><Icon name="check" size={13} /> geschlossen</span>
            : solved > 0
              ? <span className="spiel-progress-chip">{solved}/{r.stationCount}</span>
              : <span className="spiel-open-chip">offen</span>}
          <Icon name="chevron" size={17} className={open ? 'chev-down' : 'chev-right'} />
        </span>
      </button>
      <div className="spiel-card-progress" aria-hidden><span style={{ width: `${pct}%` }} /></div>
      {open && (
        <div className="spiel-card-body">
          <p className="spiel-intro">{r.description}</p>
          <dl className="spiel-facts">
            <div><dt>Start</dt><dd>{r.start}</dd></div>
            <div><dt>Ziel</dt><dd>{r.end}</dd></div>
            <div><dt>Beste Zeit</dt><dd>{r.season}</dd></div>
            <div><dt>Anreise</dt><dd>{r.access}</dd></div>
            <div><dt>Barrierefreiheit</dt><dd>{r.accessibility}</dd></div>
            <div><dt>Lösungswort</dt><dd>{r.wordLength} Buchstaben</dd></div>
          </dl>
          <details className="spiel-details">
            <summary>Sicherheit und Hinweise</summary>
            <ul>{r.safety.map((s) => <li key={s}>{s}</li>)}</ul>
          </details>
          <div className="spiel-actions">
            <button type="button" className="link-btn" onClick={onStart}>
              <Icon name={done ? 'undo' : solved > 0 ? 'play' : 'compass'} size={16} />
              {done ? 'Noch einmal spielen' : solved > 0 ? 'Fortsetzen' : 'Route starten'}
            </button>
            {done && (
              <button type="button" className="link-btn secondary" onClick={onReset}>
                <Icon name="undo" size={16} /> Zurücksetzen
              </button>
            )}
            <button type="button" className="link-btn secondary" onClick={onToggle}>
              <Icon name="close" size={16} /> Schließen
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function StationCard({ station, route, solved, current, hintLevel, wrong, answer, setAnswer, feedback, onCheck, onHint, onSolution, onMap, onLocate, onContinue, locationMsg, busy }: {
  station: Station;
  route: Route;
  solved: boolean;
  current: boolean;
  hintLevel: number;
  wrong: number;
  answer: string;
  setAnswer: (v: string) => void;
  feedback: { correct: boolean; message: string } | null;
  onCheck: () => void;
  onHint: () => void;
  onSolution: () => void;
  onMap: () => void;
  onLocate: () => void;
  onContinue: () => void;
  locationMsg: string | null;
  busy: boolean;
}) {
  const isBonus = station.kind === 'bonus';
  const hint = hintLevel > 0 ? station.hints[Math.min(hintLevel, 3) - 1] : null;
  return (
    <div className={`spiel-station ${solved ? 'is-solved' : ''} ${current ? 'is-current' : ''} ${isBonus ? 'is-bonus' : ''}`} style={{ '--spiel-color': route.color } as CSSProperties}>
      <div className="spiel-station-head">
        <span className="spiel-station-no">{isBonus ? 'Bonus' : station.kind === 'prologue' ? 'Start' : `Station ${station.no}`}</span>
        <span className="spiel-station-state">
          {solved ? 'Gelöst' : current ? 'Aktuell' : isBonus ? 'Freiwillig' : 'Offen'}
          {station.ticket && <span className="spiel-ticket">Ticket</span>}
        </span>
      </div>
      <h3 className="spiel-station-name">{station.name}</h3>
      <p className="spiel-prompt">{station.prompt}</p>

      {solved ? (
        <div className="spiel-fact">
          <div className="spiel-fact-head">
            <span className="spiel-seal"><Icon name="check" size={14} /></span>
            <span>Siegel gesetzt{station.code ? ` · Code ${station.code}` : ''}</span>
          </div>
          <p>{station.fact}</p>
          <Source>{station.license} · <a href={station.source} target="_blank" rel="noreferrer">Quelle</a></Source>
          <div className="spiel-actions">
            <button type="button" className="link-btn" onClick={onContinue}>
              <Icon name="chevron" size={16} className="chev-right" /> Weiter
            </button>
          </div>
        </div>
      ) : (
        <>
          <label className="spiel-answer-label" htmlFor="spiel-answer">
            {station.answerType === 'number' ? 'Zahl eingeben' : station.answerType === 'live' ? 'Uhrzeit eingeben' : 'Antwort eingeben'}
          </label>
          <div className="spiel-answer-row">
            <input
              id="spiel-answer"
              className="spiel-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onCheck(); }}
              inputMode={station.answerType === 'number' ? 'decimal' : 'text'}
              placeholder={station.answerType === 'number' ? 'Zahl' : station.answerType === 'live' ? 'z. B. 20:15' : 'Deine Antwort'}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="link-btn spiel-check" onClick={onCheck} disabled={busy || !answer.trim()}>
              {busy ? 'Prüfe …' : 'Prüfen'}
            </button>
          </div>
          {feedback && (
            <p className={`spiel-feedback ${feedback.correct ? 'ok' : 'err'}`} role="status" aria-live="polite">
              <Icon name={feedback.correct ? 'check' : 'info'} size={15} /> {feedback.message}
            </p>
          )}
          {locationMsg && <p className="spiel-location" role="status">{locationMsg}</p>}

          <div className="spiel-hint-box">
            {hint ? (
              <>
                <span className="spiel-hint-label">Hinweis {Math.min(hintLevel, 3)} von 3</span>
                <p>{hint}</p>
              </>
            ) : (
              <p className="muted small">Du kannst drei Hinweise nutzen. Sie kosten Kesselpunkte, aber kein Siegel.</p>
            )}
            <div className="spiel-hint-actions">
              {hintLevel < 3 && (
                <button type="button" className="link-btn secondary" onClick={onHint}>
                  <Icon name="info" size={15} /> {hintLevel ? 'Nächster Hinweis' : 'Hinweis'}
                </button>
              )}
              {wrong >= 3 && hintLevel < 3 && (
                <button type="button" className="link-btn secondary" onClick={onSolution}>
                  <Icon name="eye" size={15} /> Lösung zeigen
                </button>
              )}
            </div>
          </div>

          <div className="spiel-map-actions">
            <button type="button" className="link-btn secondary" onClick={onMap}>
              <Icon name="pin" size={16} /> Suchgebiet zeigen
            </button>
            <button type="button" className="link-btn secondary" onClick={onLocate}>
              <Icon name="locate" size={16} /> Bin ich hier?
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Finale({ route, solved, word, setWord, message, onFinish, onReset }: {
  route: Route;
  solved: Set<string>;
  word: string;
  setWord: (v: string) => void;
  message: string | null;
  onFinish: () => void;
  onReset: () => void;
}) {
  const codes = route.stations.filter((s) => s.kind === 'main').map((s) => ({ id: s.id, code: s.code ?? '?', solved: solved.has(s.id) }));
  return (
    <div className="spiel-finale" style={{ '--spiel-color': route.color } as CSSProperties}>
      <span className="spiel-finale-kicker">Finale · Kapitel {ROMAN[route.chapter]}</span>
      <h3>Setze das Lösungswort zusammen</h3>
      <p>Die Hauptstationen haben dir Buchstaben gegeben. Tippe das Wort ein, um das Kapitel zu schließen.</p>
      <div className="spiel-codes" aria-label="Gesammelte Buchstaben">
        {codes.map((c) => <span key={c.id} className={c.solved ? 'is-on' : ''}>{c.solved ? c.code : '·'}</span>)}
      </div>
      <div className="spiel-answer-row">
        <input
          className="spiel-answer"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onFinish(); }}
          placeholder={`${route.wordLength} Buchstaben`}
          autoComplete="off"
          spellCheck={false}
          aria-label="Lösungswort"
        />
        <button type="button" className="link-btn spiel-check" onClick={onFinish} disabled={!word.trim()}>
          Abschließen
        </button>
      </div>
      {message && <p className="spiel-feedback err" role="status">{message}</p>}
      <div className="spiel-actions">
        <button type="button" className="link-btn secondary" onClick={onReset}>
          <Icon name="undo" size={16} /> Route zurücksetzen
        </button>
      </div>
    </div>
  );
}

function Routenbuch({ routes, progressFor, onStart, onReset }: {
  routes: RouteSummary[];
  progressFor: (id: string) => RouteProgress | null;
  onStart: (id: string) => void;
  onReset: (id: string) => void;
}) {
  const done = routes.filter((r) => progressFor(r.id)?.completedAt).length;
  return (
    <div className="spiel-book">
      <div className="spiel-book-head">
        <span className="eyebrow">Routenbuch</span>
        <strong>{done} von {routes.length} Kapiteln</strong>
      </div>
      <div className="spiel-book-seals">
        {routes.map((r) => {
          const p = progressFor(r.id);
          const isDone = !!p?.completedAt;
          return (
            <button key={r.id} type="button" className={`spiel-book-seal ${isDone ? 'is-done' : ''}`} onClick={() => onStart(r.id)} title={isDone ? `${r.title} · ${fmtDate(p?.completedAt)}` : `${r.title} starten`}>
              <span className="spiel-seal-circle" style={{ borderColor: r.color, color: isDone ? r.color : 'var(--muted)' }}>
                {isDone ? <Icon name="check" size={16} /> : ROMAN[r.chapter]}
              </span>
              <span>{r.title}</span>
            </button>
          );
        })}
      </div>
      {done === routes.length ? (
        <div className="spiel-wappen">
          <span className="spiel-wappen-seal">K</span>
          <div>
            <strong>Kesselwappen</strong>
            <p>Alle fünf Kapitel sind geschlossen. Du hast dir die Stadt erlaufen.</p>
          </div>
        </div>
      ) : (
        <p className="muted small">Das Kesselwappen erscheint, wenn alle fünf Kapitel mindestens mit „Kundig“ abgeschlossen sind. Für den Prototyp zählt der Abschluss.</p>
      )}
      <div className="spiel-book-actions">
        {routes.map((r) => progressFor(r.id) ? (
          <button key={r.id} type="button" className="link-btn secondary spiel-small" onClick={() => onReset(r.id)}>
            <Icon name="undo" size={14} /> {r.title} zurücksetzen
          </button>
        ) : null)}
      </div>
    </div>
  );
}

export function SpielPanel({ visible, toggle, setLayer, fitBounds, flyTo, setSpiel }: ModuleProps) {
  const spiel = useSpiel();
  const [openRouteId, setOpenRouteId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const [finaleWord, setFinaleWord] = useState('');
  const [finaleMsg, setFinaleMsg] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const lastFit = useRef<string | null>(null);
  const deepLinkDone = useRef(false);
  const previousLayers = useRef<Record<OverlayKey, boolean> | null>(null);
  const focusActive = useRef(false);

  // Während einer Route den Großveranstaltungs-Hinweis ausblenden; er verdeckt
  // sonst den Suchraum auf der Karte.
  useEffect(() => {
    if (spiel.activeId) document.documentElement.dataset.spiel = 'active';
    else delete document.documentElement.dataset.spiel;
    return () => { delete document.documentElement.dataset.spiel; };
  }, [spiel.activeId]);

  // Spiel-Fokus: Während einer Route treten die anderen Kartenebenen zurück.
  // Die vorherige Auswahl wird beim Verlassen wiederhergestellt.
  useEffect(() => {
    if (spiel.activeId && !focusActive.current) {
      previousLayers.current = { ...visible };
      focusActive.current = true;
      for (const k of Object.keys(OVERLAY_LAYERS) as OverlayKey[]) {
        if (k !== 'spiel') setLayer(k, false);
      }
      setLayer('spiel', true);
    } else if (!spiel.activeId && focusActive.current) {
      focusActive.current = false;
      const prev = previousLayers.current;
      if (prev) {
        for (const k of Object.keys(OVERLAY_LAYERS) as OverlayKey[]) {
          if (k !== 'spiel') setLayer(k, prev[k]);
        }
        previousLayers.current = null;
      }
      setLayer('spiel', false);
    }
  }, [spiel.activeId, visible, setLayer]);

  // Route auf die Karte legen und die Spiel-Ebene einschalten.
  useEffect(() => {
    if (!spiel.routeData) {
      setSpiel(null);
      setLayer('spiel', false);
      return;
    }
    setSpiel(buildSpielGeo(spiel.routeData, spiel.activeProgress, spiel.currentStop?.id ?? null));
  }, [spiel.routeData, spiel.activeProgress, spiel.currentStop, setSpiel]);

  // Sobald die Route geladen ist, die Spiel-Ebene sichtbar machen. Ein späteres
  // manuelles Ausblenden bleibt erhalten, weil dieser Effekt nur bei Routenwechsel läuft.
  useEffect(() => {
    if (spiel.routeData) setLayer('spiel', true);
  }, [spiel.routeData?.id, setLayer]);

  // Beim Start die ganze Route in den sichtbaren Kartenausschnitt legen.
  useEffect(() => {
    if (!spiel.activeId) { lastFit.current = null; return; }
    if (!spiel.routeData) return;
    const key = `${spiel.activeId}:${spiel.routeData.id}`;
    if (lastFit.current === key) return;
    lastFit.current = key;
    fitBounds(routeBounds(spiel.routeData), { maxZoom: 14.5 });
  }, [spiel.activeId, spiel.routeData, fitBounds]);

  // Beim Verlassen des Moduls die Spiel-Ebene aufräumen.
  useEffect(() => () => {
    setSpiel(null);
    const prev = previousLayers.current;
    if (prev) {
      for (const k of Object.keys(OVERLAY_LAYERS) as OverlayKey[]) {
        if (k !== 'spiel') setLayer(k, prev[k]);
      }
      previousLayers.current = null;
    }
    setLayer('spiel', false);
  }, [setSpiel, setLayer]);

  // Tiefenlink ?spiel=…
  useEffect(() => {
    if (deepLinkDone.current || !spiel.list.data) return;
    deepLinkDone.current = true;
    const id = new URLSearchParams(location.search).get('spiel');
    if (id && spiel.list.data.routes.some((r) => r.id === id)) spiel.resumeRoute(id);
  }, [spiel.list.data, spiel.resumeRoute]);

  // Beim Stationswechsel Eingabe und Rückmeldung zurücksetzen.
  const stationId = spiel.station?.id ?? null;
  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setLocationMsg(null);
    setFinaleMsg(null);
    setShared(false);
  }, [stationId]);

  useEffect(() => {
    if (!spiel.completed) return;
    setFinaleMsg(null);
  }, [spiel.completed]);

  const start = (id: string) => {
    const p = spiel.progressFor(id);
    if (p?.completedAt) spiel.resetRoute(id);
    spiel.startRoute(id);
    setOpenRouteId(null);
    setAnswer('');
    setFeedback(null);
    setFinaleWord('');
    setFinaleMsg(null);
    setShared(false);
  };

  const backToOverview = () => {
    spiel.selectStation(null);
    spiel.closeRoute();
  };

  const check = async () => {
    if (!spiel.station) return;
    setBusy(true);
    const res = await spiel.checkAnswer(spiel.station, answer);
    setBusy(false);
    setFeedback(res);
    if (res.correct) spiel.selectStation(spiel.station.id);
  };

  const revealSolution = () => {
    if (!spiel.station) return;
    spiel.revealSolution(spiel.station);
  };

  const locate = () => {
    const s = spiel.station;
    if (!s) return;
    if (!navigator.geolocation) { setLocationMsg('Dieser Browser kann keinen Standort ermitteln.'); return; }
    setLocationMsg('Standort wird geprüft …');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = distM(pos.coords.latitude, pos.coords.longitude, s.point[1], s.point[0]);
        const r = s.radiusM;
        if (d <= r * 1.5) setLocationMsg('Du bist da. Schau dich um.');
        else if (d <= r * 4) setLocationMsg('Du bist in der Nähe. Der Suchraum ist auf der Karte markiert.');
        else if (d <= 800) setLocationMsg('Noch ein Stück. Tippe auf „Suchgebiet zeigen“.');
        else setLocationMsg('Du bist noch weit entfernt. Tippe auf „Suchgebiet zeigen“.');
      },
      (err) => setLocationMsg(err.code === err.PERMISSION_DENIED
        ? 'Standort nicht freigegeben. Du kannst trotzdem „Ich bin da“ nutzen.'
        : 'Standort konnte nicht ermittelt werden.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const share = async () => {
    if (!spiel.routeData) return;
    const text = `${spiel.routeData.title} – ${spiel.badge ?? 'Kapitel abgeschlossen'} · ${fmtElapsed(spiel.elapsedMs)} · ${spiel.points} Kesselpunkte`;
    const url = `${location.origin}${location.pathname}?spiel=${encodeURIComponent(spiel.routeData.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Kesselcode', text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
    } catch {
      try { await navigator.clipboard.writeText(`${text} ${url}`); setShared(true); } catch { /* egal */ }
    }
  };

  const routes = spiel.list.data?.routes ?? [];
  const active = spiel.routeData;
  const station = spiel.station;
  const solved = station ? spiel.isSolved(station.id) : false;
  const hintLevel = station ? spiel.hintsFor(station.id) : 0;
  const wrong = station ? spiel.wrongFor(station.id) : 0;
  const current = !!station && !solved && spiel.currentStop?.id === station.id;
  const solvedCount = spiel.activeProgress?.solved.length ?? 0;

  if (spiel.list.error && !spiel.list.data) {
    return (
      <div className="module spiel-module">
        <div className="spiel-hero">
          <span className="eyebrow"><Icon name="compass" size={14} /> Kesselcode</span>
          <h3>Stadtspiel wird geladen</h3>
          <p className="spiel-hero-line">Die Routen kommen aus dem Open-Stuttgart-Server.</p>
        </div>
        <ErrorNote text={`Spielrouten nicht verfügbar: ${spiel.list.error}`} onRetry={spiel.list.reload} />
      </div>
    );
  }

  if (!spiel.list.data) {
    return (
      <div className="module spiel-module">
        <div className="spiel-hero">
          <span className="eyebrow"><Icon name="compass" size={14} /> Kesselcode</span>
          <h3>Fünf Wege durch Stuttgart</h3>
          <p className="spiel-hero-line">Routen und Stationen werden geladen …</p>
        </div>
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (spiel.activeId && !active && spiel.route.error) {
    return (
      <div className="module spiel-module">
        <div className="spiel-active-bar">
          <button type="button" className="spiel-back" onClick={backToOverview}>
            <Icon name="chevron" size={15} className="chev-left" /> Kapitel
          </button>
        </div>
        <ErrorNote text={`Route nicht verfügbar: ${spiel.route.error}`} onRetry={spiel.route.reload} />
      </div>
    );
  }

  if (active) {
    return (
      <div className="module spiel-module spiel-active">
        <div className="spiel-active-bar">
          <button type="button" className="spiel-back" onClick={backToOverview}>
            <Icon name="chevron" size={15} className="chev-left" /> Kapitel
          </button>
          <span className="spiel-active-time"><Icon name="clock" size={14} /> {fmtElapsed(spiel.elapsedMs)}</span>
          <button type="button" className={`spiel-pause ${spiel.isPaused ? 'is-paused' : ''}`} onClick={spiel.togglePause} disabled={spiel.completed}>
            <Icon name={spiel.isPaused ? 'play' : 'pause'} size={14} /> {spiel.isPaused ? 'Weiter' : 'Pause'}
          </button>
        </div>
        <div className="spiel-active-head" style={{ '--spiel-color': active.color } as CSSProperties}>
          <span className="eyebrow">Kapitel {ROMAN[active.chapter]}</span>
          <h3>{active.title}</h3>
          <p>{active.subtitle}</p>
          <div className="spiel-progress-line">
            <span><i style={{ width: `${Math.round((solvedCount / Math.max(1, active.stationCount)) * 100)}%` }} /></span>
            <strong>{solvedCount}/{active.stationCount}</strong>
          </div>
          <div className="spiel-active-meta">
            <Difficulty n={active.difficulty} />
            <span>{spiel.points} Kesselpunkte</span>
            {spiel.badge && <span className="spiel-badge">{spiel.badge}</span>}
          </div>
        </div>

        {spiel.completed ? (
          <div className="spiel-complete">
            <span className="spiel-complete-seal" style={{ borderColor: active.color, color: active.color }}><Icon name="check" size={24} /></span>
            <h3>Kapitel {ROMAN[active.chapter]} geschlossen</h3>
            <p>{spiel.badge ? `Du bist ${spiel.badge}.` : 'Du hast die Route abgeschlossen.'} {fmtElapsed(spiel.elapsedMs)} · {spiel.points} Kesselpunkte.</p>
            <div className="spiel-actions">
              <button type="button" className="link-btn" onClick={share}><Icon name="share" size={16} /> {shared ? 'Link kopiert' : 'Ergebnis teilen'}</button>
              <button type="button" className="link-btn secondary" onClick={() => start(active.id)}><Icon name="undo" size={16} /> Noch einmal</button>
            </div>
            <button type="button" className="link-btn secondary" onClick={backToOverview}><Icon name="chevron" size={16} className="chev-left" /> Zur Übersicht</button>
          </div>
        ) : spiel.allMainSolved && !station ? (
          <Finale
            route={active}
            solved={spiel.solved}
            word={finaleWord}
            setWord={setFinaleWord}
            message={finaleMsg}
            onFinish={async () => {
              const res = await spiel.finish(finaleWord);
              setFinaleMsg(res.correct ? null : res.message);
            }}
            onReset={() => start(active.id)}
          />
        ) : station ? (
          <>
            <StationCard
              station={station}
              route={active}
              solved={solved}
              current={current}
              hintLevel={hintLevel}
              wrong={wrong}
              answer={answer}
              setAnswer={setAnswer}
              feedback={feedback}
              onCheck={check}
              onHint={() => spiel.revealHint(station)}
              onSolution={revealSolution}
              onMap={() => flyTo(station.point, 15.8)}
              onLocate={locate}
              onContinue={() => {
                spiel.selectStation(null);
                setAnswer('');
                setFeedback(null);
              }}
              locationMsg={locationMsg}
              busy={busy}
            />
            {station.kind === 'bonus' && (
              <button type="button" className="link-btn secondary spiel-back-main" onClick={() => spiel.selectStation(null)}>
                <Icon name="chevron" size={15} className="chev-left" /> Zur Hauptroute
              </button>
            )}
            {spiel.allMainSolved && (
              <div className="spiel-finale-hint">
                <Icon name="check" size={16} /> Alle Hauptstationen sind gelöst.
                <button type="button" className="link-btn" onClick={() => spiel.selectStation(null)}>Zum Finale</button>
              </div>
            )}
          </>
        ) : (
          <Finale
            route={active}
            solved={spiel.solved}
            word={finaleWord}
            setWord={setFinaleWord}
            message={finaleMsg}
            onFinish={async () => {
              const res = await spiel.finish(finaleWord);
              setFinaleMsg(res.correct ? null : res.message);
            }}
            onReset={() => start(active.id)}
          />
        )}

        <Section title="Stationen" aside={`${solvedCount} von ${active.stationCount} Siegeln`} collapsible defaultOpen={false}>
          <ol className="spiel-station-list">
            {active.stations.map((s) => {
              const isDone = spiel.isSolved(s.id);
              const isCurrent = spiel.currentStop?.id === s.id;
              const clickable = s.kind === 'bonus' || isDone || isCurrent;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`spiel-station-row ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} ${s.kind === 'bonus' ? 'is-bonus' : ''}`}
                    onClick={() => clickable && spiel.selectStation(s.id)}
                    disabled={!clickable}
                  >
                    <span className="spiel-row-no">{s.kind === 'bonus' ? '+' : s.no}</span>
                    <span className="spiel-row-main">
                      <span className="spiel-row-name">{isDone || isCurrent || s.kind === 'bonus' ? s.name : `Station ${s.no}`}</span>
                      <span className="spiel-row-sub">
                        {s.kind === 'bonus' ? 'Bonusstation' : s.kind === 'prologue' ? 'Start' : `Hauptstation · Code ${isDone ? s.code : '?'}`}
                        {s.ticket ? ' · Eintritt' : ''}
                      </span>
                    </span>
                    <span className={`spiel-row-state ${isDone ? 'done' : isCurrent ? 'current' : ''}`}>
                      {isDone ? <Icon name="check" size={15} /> : isCurrent ? 'jetzt' : s.kind === 'bonus' ? 'frei' : 'offen'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section title="Stadtwissen" aside={solvedCount === 1 ? '1 Karte' : `${solvedCount} Karten`} collapsible defaultOpen={false}>
          {active.stations.filter((s) => spiel.isSolved(s.id)).length === 0 && <p className="muted small">Noch keine Station gelöst. Das erste Siegel wartet.</p>}
          <ul className="spiel-fact-list">
            {active.stations.filter((s) => spiel.isSolved(s.id)).map((s) => (
              <li key={s.id}>
                <details>
                  <summary><span>{s.name}</span><small>{s.code ? `Code ${s.code}` : 'Bonus'}</small></summary>
                  <p>{s.fact}</p>
                  <Source>{s.license} · <a href={s.source} target="_blank" rel="noreferrer">Quelle</a></Source>
                </details>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Auf der Karte" collapsible defaultOpen={false}>
          <div className="layer-list">
            <div className={`layer-row ${visible.spiel ? 'is-on' : ''}`}>
              <span className="tile tone-ink"><Icon name="compass" size={20} /></span>
              <div className="layer-text"><span className="layer-title">Spielroute</span><span className="layer-meta">Suchraum, Stationen und Verlauf</span></div>
              <button type="button" className="link-btn secondary spiel-small" onClick={() => toggle('spiel')}>{visible.spiel ? 'Ausblenden' : 'Einblenden'}</button>
            </div>
          </div>
        </Section>

        <Disclosure label="Quellen und Lizenzen">
          <p className="source">
            Routen und Aufgaben: eigene Redaktion. Fakten aus Wikidata, Wikipedia, Stadt Stuttgart, SSB und
            Mercedes-Benz Museum, jeweils an der Station mit Quelle und Lizenz. Koordinaten aus OpenStreetMap
            (Nominatim, ODbL). Die Linie verbindet die Stationen; sie ist keine Navigation. Fortschritt bleibt lokal.
          </p>
        </Disclosure>
      </div>
    );
  }

  return (
    <div className="module spiel-module">
      <div className="spiel-hero">
        <span className="eyebrow"><Icon name="compass" size={14} /> Kesselcode <span className="spiel-hero-dot" /> Stadtspiel</span>
        <h3>Fünf Wege durch Stuttgart</h3>
        <p className="spiel-hero-line">
          Eine Schnitzeljagd mit Antworten, die wirklich vor Ort stehen: Jahreszahlen, Tiere, Stufen und
          Symbole. Kein Konto, kein Tracking, kein Countdown. Nur du, die Stadt und ein Routenbuch.
        </p>
        <p className="spiel-hero-meta">
          {routes.length} Kapitel · {routes.reduce((n, r) => n + r.stationCount, 0)} Stationen · ein Kesselwappen
        </p>
      </div>

      <Section title="Kapitel" aside={spiel.list.data ? `${routes.length} Routen` : undefined}>
        <div className="spiel-route-list">
          {routes.map((r) => (
            <RouteCard
              key={r.id}
              r={r}
              progress={spiel.progressFor(r.id)}
              open={openRouteId === r.id}
              onToggle={() => setOpenRouteId((id) => id === r.id ? null : r.id)}
              onStart={() => start(r.id)}
              onReset={() => { spiel.resetRoute(r.id); setOpenRouteId(null); }}
            />
          ))}
        </div>
      </Section>

      <Section title="Routenbuch" aside={`${routes.filter((r) => spiel.progressFor(r.id)?.completedAt).length} geschlossen`}>
        <Routenbuch
          routes={routes}
          progressFor={spiel.progressFor}
          onStart={start}
          onReset={(id) => spiel.resetRoute(id)}
        />
        <div className="spiel-book-actions">
          <button type="button" className="link-btn secondary spiel-small" onClick={spiel.exportProgress}>
            <Icon name="copy" size={14} /> Routenbuch exportieren
          </button>
          <button type="button" className="link-btn secondary spiel-small" onClick={() => {
            if (window.confirm('Alle Routen und Fortschritte löschen?')) spiel.resetAll();
          }}>
            <Icon name="undo" size={14} /> Alles zurücksetzen
          </button>
        </div>
      </Section>

      <Section title="So funktioniert es" collapsible defaultOpen={false}>
        <ol className="spiel-howto">
          <li><strong>Route wählen.</strong> Jedes Kapitel ist ein Spaziergang mit sechs bis acht Hauptstationen.</li>
          <li><strong>Suchraum finden.</strong> Die Karte zeigt einen Kreis, keinen exakten Pin. Die Aufgabe sagt dir, wonach du schauen sollst.</li>
          <li><strong>Antwort eintragen.</strong> Zahl, Jahr, Wort oder Uhrzeit – die App prüft serverseitig.</li>
          <li><strong>Siegel und Stadtwissen.</strong> Jede gelöste Station gibt einen kurzen, belegten Text mit Quelle.</li>
          <li><strong>Finale.</strong> Die Buchstaben der Hauptstationen ergeben das Lösungswort. Damit schließt du das Kapitel.</li>
        </ol>
        <p className="muted small">
          Hinweise kosten Kesselpunkte, aber kein Siegel. Pausen sind erlaubt. Es gibt keine globale Bestenliste
          und keine Push-Nachrichten.
        </p>
      </Section>

      <Section title="Auf der Karte" collapsible defaultOpen={false}>
        <div className="layer-list">
          <div className={`layer-row ${visible.spiel ? 'is-on' : ''}`}>
            <span className="tile tone-ink"><Icon name="compass" size={20} /></span>
            <div className="layer-text"><span className="layer-title">Spielroute</span><span className="layer-meta">erscheint, sobald du eine Route startest</span></div>
            <button type="button" className="link-btn secondary spiel-small" onClick={() => toggle('spiel')}>{visible.spiel ? 'Ausblenden' : 'Einblenden'}</button>
          </div>
        </div>
        <p className="muted small">Die Linie ist eine Orientierung, keine Navigation. Für den echten Weg das Modul „Weg“ nutzen.</p>
      </Section>

      <Disclosure label="Quellen und Lizenzen">
        <p className="source">
          {spiel.list.data?.source} Stand {spiel.list.data?.stand}. {spiel.list.data?.license}. Koordinaten aus
          OpenStreetMap (Nominatim, ODbL). Keine Antworten im Browser; der Fortschritt bleibt lokal.
        </p>
      </Disclosure>
    </div>
  );
}
