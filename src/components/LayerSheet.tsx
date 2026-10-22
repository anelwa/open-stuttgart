// Globale Ebenen-Auswahl: bündelt die verstreuten Kartenebenen an einem Ort.
// Vorbild ist die „Ebenen“-Schaltfläche in Google Maps und die reduzierte Kartensteuerung
// in Apple Karten – übertragen in die warme Open-Stuttgart-Designsprache.
import { useEffect, useRef } from 'react';
import type { OverlayKey } from '../map/overlays';
import { Icon } from './Icon';

type Item = { key: OverlayKey; label: string; icon: string; meta?: string };
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: 'Verkehr und Wege',
    items: [
      { key: 'network', label: 'Stadtbahn und S-Bahn', icon: 'train', meta: 'Liniennetz' },
      { key: 'stops', label: 'Haltestellen', icon: 'stop', meta: 'Abfahrten antippen' },
      { key: 'vehicles', label: 'Fahrzeuge (berechnet)', icon: 'mobility', meta: 'keine GPS-Daten' },
      { key: 'traffic', label: 'Verkehrsmeldungen', icon: 'warn', meta: 'Stau, Sperrung, Unfall' },
      { key: 'roadworks', label: 'Baustellen', icon: 'cone', meta: 'aktiv und geplant' },
      { key: 'bike', label: 'Hauptradrouten', icon: 'bike', meta: 'Radnetz' },
      { key: 'hike', label: 'Wander- und Weinwege', icon: 'walk', meta: 'auch OSM-Routen' },
      { key: 'unfall', label: 'Unfallorte', icon: 'warn', meta: 'Unfallatlas 2025' },
    ],
  },
  {
    label: 'Orte und Termine',
    items: [
      { key: 'nearby', label: 'Einrichtungen der Nähe', icon: 'pin', meta: 'Kategorie im Panel wählen' },
      { key: 'events', label: 'Termine', icon: 'ticket', meta: 'Kultur und Szene' },
      { key: 'places', label: 'Sehenswürdigkeiten', icon: 'culture', meta: 'Museen, Parks, Denkmäler' },
      { key: 'parking', label: 'Parkhäuser', icon: 'parking', meta: 'freie Plätze' },
      { key: 'sharing', label: 'Sharing', icon: 'share', meta: 'Auto, Rad, Scooter' },
    ],
  },
  {
    label: 'Umwelt und Himmel',
    items: [
      { key: 'air', label: 'Luftmessstellen', icon: 'air', meta: 'UBA-Index' },
      { key: 'water', label: 'Neckarpegel', icon: 'water', meta: 'PEGELONLINE' },
      { key: 'warnung', label: 'Warngebiete (NINA)', icon: 'warn', meta: 'MoWaS / KATWARN' },
      { key: 'flug', label: 'Flugverkehr', icon: 'mobility', meta: 'ADS-B, Sonden, ISS' },
      { key: 'kaltluft', label: 'Kaltluftabfluss', icon: 'wind', meta: 'Klimaatlas' },
      { key: 'sun', label: 'Abendsonne / Schatten', icon: 'sun', meta: 'eigene Berechnung' },
      { key: 'radar', label: 'Regenradar', icon: 'rain', meta: 'DWD' },
    ],
  },
  {
    label: 'Karte',
    items: [
      { key: 'aerial', label: 'Luftbilder 2006–2025', icon: 'image', meta: 'Stadtmessungsamt' },
      { key: 'route', label: 'Gewählte Route', icon: 'route', meta: 'aus dem Modul Weg' },
      { key: 'live', label: 'Live-Zustände', icon: 'clock', meta: 'Wartezeiten, Bäder' },
    ],
  },
];

export function LayerSheet({ open, onClose, visible, toggle, theme, onTheme, terrain, onTerrain, onResetNorth }: {
  open: boolean; onClose: () => void; visible: Record<OverlayKey, boolean>; toggle: (k: OverlayKey) => void;
  theme: 'light' | 'dark'; onTheme: () => void; terrain: boolean; onTerrain: () => void; onResetNorth: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="layers-backdrop" onClick={onClose} role="presentation">
      <div className="layers-sheet" role="dialog" aria-modal="true" aria-labelledby="layers-title" ref={sheetRef} onClick={(e) => e.stopPropagation()}>
        <header className="layers-head">
          <div>
            <span className="eyebrow">Karte</span>
            <h3 id="layers-title">Ebenen</h3>
          </div>
          <button ref={closeRef} type="button" className="icon-btn ghost" onClick={onClose} aria-label="Ebenen schließen"><Icon name="close" size={18} /></button>
        </header>
        <p className="muted small layers-hint">Alle Ebenen an einem Ort. Die Auswahl bleibt auf diesem Gerät gespeichert.</p>
        {GROUPS.map((g) => (
          <section key={g.label} className="layers-group">
            <h4>{g.label}</h4>
            <div className="layers-list">
              {g.items.map((it) => (
                <button key={it.key} type="button" className={`layer-toggle ${visible[it.key] ? 'on' : ''}`}
                  aria-pressed={visible[it.key]} onClick={() => toggle(it.key)}>
                  <span className="layer-ico"><Icon name={it.icon} size={17} /></span>
                  <span className="layer-txt"><strong>{it.label}</strong>{it.meta && <small>{it.meta}</small>}</span>
                  <span className={`layer-switch ${visible[it.key] ? 'on' : ''}`} aria-hidden />
                </button>
              ))}
            </div>
          </section>
        ))}
        <footer className="layers-foot">
          <span className="muted small">Die Werte hinter den Ebenen sind unter „Wie entstehen die Werte?“ erklärt.</span>
        </footer>
      </div>
    </div>
  );
}
