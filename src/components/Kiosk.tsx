import { useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data';
import { useNow, usePolling } from '../lib/api';
import { fmtDec, fmtTime } from '../lib/format';
import { weatherIconName } from './Icon';
import { Icon } from './Icon';

interface Bb { id: string; label: string; text: string; waitMin: number | null; address?: string; lat?: number; lon?: number }
interface BbAntwort { items: Bb[] }

/**
 * Kiosk-/Public-Display-Profil: große Schrift, keine Bedienelemente, rotierende Karten.
 * Aufruf über ?display=kiosk. Geeignet für Bürgerbüros, Bibliotheken und Schulen.
 */
export function Kiosk() {
  const data = useData();
  const now = useNow(10_000);
  const [slide, setSlide] = useState(0);
  const waits = usePolling<BbAntwort>('/api/nearby/buergerbueros', 120_000);
  const slides = useMemo(() => {
    const w = data.weather.data;
    const air = data.air.data?.stations ?? [];
    const events = (data.events.data?.events ?? []).slice(0, 7);
    const parking = (data.parking.data?.sites ?? []).filter((p) => p.free != null).sort((a, b) => (b.free ?? 0) - (a.free ?? 0)).slice(0, 7);
    const bb = (waits.data?.items ?? []).filter((b) => b.waitMin != null).sort((a, b) => (a.waitMin ?? 999) - (b.waitMin ?? 999)).slice(0, 7);
    return [
      { key: 'wetter', title: 'Wetter & Luft', icon: 'sun', w, air },
      { key: 'wartezeit', title: 'Bürgerbüros', icon: 'clock', bb },
      { key: 'termine', title: 'Was geht heute', icon: 'ticket', events },
      { key: 'parken', title: 'Freie Parkplätze', icon: 'parking', parking },
    ];
  }, [data.weather.data, data.air.data, data.events.data, data.parking.data, waits.data]);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 12_000);
    return () => clearInterval(t);
  }, [slides.length]);

  const s = slides[slide];
  const bb = 'bb' in s ? s.bb ?? [] : [];
  const events = 'events' in s ? s.events ?? [] : [];
  const parking = 'parking' in s ? s.parking ?? [] : [];
  const close = () => {
    const u = new URL(location.href); u.searchParams.delete('display'); location.href = u.toString();
  };

  return (
    <div className="kiosk" role="region" aria-label="Open Stuttgart Kiosk">
      <header className="kiosk-head">
        <div className="kiosk-brand"><span className="kiosk-dot" /> Open Stuttgart <em>Kiosk</em></div>
        <div className="kiosk-clock">{fmtTime(now)}<small>{new Date(now).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>
        <button type="button" className="kiosk-close" onClick={close} aria-label="Kiosk schließen"><Icon name="close" size={20} /></button>
      </header>

      <main className="kiosk-body">
        <div className="kiosk-slide-head"><Icon name={s.icon} size={34} /><h1>{s.title}</h1></div>

        {s.key === 'wetter' && s.w && (
          <div className="kiosk-wetter">
            <div className="kiosk-temp"><Icon name={weatherIconName(s.w.icon)} size={88} /><strong>{fmtDec(s.w.temperature)}°</strong><span>{s.w.condition}</span></div>
            <div className="kiosk-facts">
              <div><span>Luft</span><strong>{s.air[0]?.label ?? '—'}</strong></div>
              <div><span>Wind</span><strong>{fmtDec(s.w.wind)} km/h</strong></div>
              <div><span>Regen</span><strong>{fmtDec(s.w.precipitation)} mm</strong></div>
              <div><span>Station</span><strong>{s.w.station}</strong></div>
            </div>
            <div className="kiosk-hours">
              {(s.w.hourly ?? []).slice(0, 6).map((h) => (
                <div key={h.t}><span>{fmtTime(h.t)}</span><Icon name={weatherIconName(h.icon)} size={26} /><strong>{fmtDec(h.temperature)}°</strong></div>
              ))}
            </div>
          </div>
        )}

        {s.key === 'wartezeit' && (
          <ul className="kiosk-list">
            {bb.map((b) => (
              <li key={b.id}>
                <span className="kiosk-list-main"><strong>{b.label}</strong><small>{b.address}</small></span>
                <span className={`kiosk-wait ${(b.waitMin ?? 0) >= 60 ? 'is-long' : (b.waitMin ?? 0) >= 30 ? 'is-mid' : 'is-ok'}`}>{b.waitMin} Min</span>
              </li>
            ))}
            {!bb.length && <li className="kiosk-empty">Die Wartezeiten sind außerhalb der Öffnungszeiten nicht verfügbar.</li>}
          </ul>
        )}

        {s.key === 'termine' && (
          <ul className="kiosk-list">
            {events.map((e) => (
              <li key={e.id}>
                <span className="kiosk-list-main"><strong>{e.title}</strong><small>{[e.start, e.location].filter(Boolean).join(' · ')}</small></span>
                {e.start && <span className="kiosk-time">{e.start}</span>}
              </li>
            ))}
            {!events.length && <li className="kiosk-empty">Für heute sind keine Termine geladen.</li>}
          </ul>
        )}

        {s.key === 'parken' && (
          <ul className="kiosk-list">
            {parking.map((p) => (
              <li key={p.id}>
                <span className="kiosk-list-main"><strong>{p.name}</strong><small>{p.address}</small></span>
                <span className="kiosk-free"><strong>{p.free}</strong> frei</span>
              </li>
            ))}
            {!parking.length && <li className="kiosk-empty">Keine Live-Belegung verfügbar.</li>}
          </ul>
        )}
      </main>

      <footer className="kiosk-foot">
        <div className="kiosk-dots">{slides.map((x, i) => <span key={x.key} className={i === slide ? 'on' : ''} />)}</div>
        <span>Offene Daten der Landeshauptstadt Stuttgart · ohne Konto, ohne Werbung</span>
      </footer>
    </div>
  );
}
