/**
 * Voice Mode ohne Server: Spracherkennung und Sprachausgabe des Browsers.
 * Kein Audio wird gespeichert. Wo der Browser keine Erkennung anbietet, bleibt Text der Weg.
 */

interface SpeechAlternative { transcript: string; confidence: number }
interface SpeechResult { isFinal: boolean; length: number; [index: number]: SpeechAlternative }
interface SpeechResultList { length: number; [index: number]: SpeechResult }
interface SpeechEventLike extends Event { resultIndex: number; results: SpeechResultList }
interface SpeechErrorLike extends Event { error: string; message?: string }

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return !!recognitionCtor();
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export interface RecognizerOptions {
  lang?: string;
  continuous?: boolean;
  onStart?: () => void;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string, code: string) => void;
  onEnd?: () => void;
}

export class BrowserRecognizer {
  private rec: RecognitionLike | null = null;
  private stopped = false;
  private options: RecognizerOptions = {};

  get active() {
    return !!this.rec;
  }

  start(options: RecognizerOptions = {}) {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      options.onError?.('Dieser Browser kann Sprache nicht erkennen. Du kannst tippen.', 'unsupported');
      return false;
    }
    this.stop();
    this.options = options;
    this.stopped = false;
    const rec = new Ctor();
    this.rec = rec;
    rec.lang = options.lang ?? 'de-DE';
    rec.continuous = options.continuous ?? false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => options.onStart?.();
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          const text = alt.transcript.trim();
          if (text) options.onFinal?.(text);
        } else {
          interim += alt.transcript;
        }
      }
      if (interim.trim()) options.onInterim?.(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      const message = e.error === 'not-allowed'
        ? 'Der Zugriff auf das Mikrofon ist nicht freigegeben.'
        : e.error === 'no-speech'
          ? 'Ich habe nichts gehört. Versuch es bitte noch einmal.'
          : e.error === 'audio-capture'
            ? 'Kein Mikrofon gefunden.'
            : e.error === 'network'
              ? 'Die Spracherkennung braucht gerade eine Verbindung.'
              : 'Die Spracherkennung hat nicht funktioniert.';
      options.onError?.(message, e.error);
    };
    rec.onend = () => {
      if (this.rec === rec) this.rec = null;
      options.onEnd?.();
      // Freihändig: nach einer Pause weiterhören, solange nicht bewusst gestoppt wurde.
      if (!this.stopped && this.options.continuous) {
        window.setTimeout(() => {
          if (!this.stopped && !this.rec) this.start(this.options);
        }, 350);
      }
    };
    try {
      rec.start();
      return true;
    } catch {
      this.rec = null;
      options.onError?.('Die Spracherkennung konnte nicht gestartet werden.', 'start');
      return false;
    }
  }

  stop() {
    this.stopped = true;
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      try { rec.stop(); } catch { /* egal */ }
    }
  }

  /** Harte Unterbrechung, z. B. wenn der Nutzer den Bot stört. */
  abort() {
    this.stopped = true;
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      try { rec.abort(); } catch { /* egal */ }
    }
  }
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

function germanVoice(): SpeechSynthesisVoice | null {
  if (!speechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const de = voices.filter((v) => /^de([-_]|$)/i.test(v.lang));
  return de.find((v) => /google|natural|premium|deutsch/i.test(v.name)) ?? de[0] ?? null;
}

export function cancelSpeech() {
  if (!speechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch { /* egal */ }
  currentUtterance = null;
}

/** Spricht einen Text. Rejects nicht, damit ein Sprechfehler nie eine Antwort blockiert. */
export function speak(text: string, opts: { lang?: string; rate?: number; onStart?: () => void; onEnd?: () => void; onError?: () => void } = {}): Promise<void> {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean || !speechSynthesisSupported()) {
    opts.onEnd?.();
    return Promise.resolve();
  }
  cancelSpeech();
  return new Promise((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(clean.slice(0, 1200));
      u.lang = opts.lang ?? 'de-DE';
      u.rate = opts.rate ?? 0.98;
      u.pitch = 1;
      const voice = germanVoice();
      if (voice) u.voice = voice;
      currentUtterance = u;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (currentUtterance === u) currentUtterance = null;
        opts.onEnd?.();
        resolve();
      };
      u.onstart = () => opts.onStart?.();
      u.onend = done;
      u.onerror = () => { opts.onError?.(); done(); };
      window.speechSynthesis.speak(u);
      // Manche Browser feuern bei stornierten Utterances kein end.
      window.setTimeout(done, Math.min(120_000, 4_000 + clean.length * 85));
    } catch {
      opts.onError?.();
      opts.onEnd?.();
      resolve();
    }
  });
}

export function speechActive(): boolean {
  return speechSynthesisSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
}
