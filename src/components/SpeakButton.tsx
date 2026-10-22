import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * Kleiner Vorlesen-Knopf über die Web Speech API. Kein Server, keine Cloud:
 * der Text bleibt im Browser. Auf Geräten ohne Sprachausgabe erscheint der Knopf nicht.
 */
export function SpeakButton({ text, label = 'Vorlesen', compact = false }: { text: string; label?: string; compact?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch { /* egal */ } }, []);
  useEffect(() => { if (!supported) return; const on = () => setSpeaking(false); window.speechSynthesis.addEventListener?.('end', on); return () => window.speechSynthesis.removeEventListener?.('end', on); }, [supported]);

  if (!supported) return null;
  const start = () => {
    try {
      if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      u.rate = 0.95;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch { setSpeaking(false); }
  };
  return (
    <button type="button" className={`speak-btn ${compact ? 'is-compact' : ''} ${speaking ? 'is-speaking' : ''}`} onClick={start} aria-pressed={speaking} title={speaking ? 'Vorlesen stoppen' : label}>
      <Icon name={speaking ? 'pause' : 'play'} size={compact ? 14 : 15} />
      {!compact && <span>{speaking ? 'Stopp' : label}</span>}
    </button>
  );
}
