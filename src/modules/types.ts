import type { ComponentType } from 'react';
import type { OverlayKey } from '../map/overlays';
import type { Selection } from '../lib/types';

export interface ModuleProps {
  visible: Record<OverlayKey, boolean>;
  toggle: (k: OverlayKey) => void;
  select: (s: Selection) => void;
  flyTo: (lngLat: [number, number], zoom?: number) => void;
  /** Ebene gezielt ein- oder ausschalten */
  setLayer: (k: OverlayKey, on: boolean) => void;
  /** Aktueller Kartenmittelpunkt [lon, lat] */
  center: [number, number];
  /** Rasterbild für die Sonnen- und Schattenebene (Data-URL) */
  setSunImage: (url: string | null) => void;
  /** Gewähltes Radarbild (Index), null = aktuelles */
  radarFrame: number | null;
  setRadarFrame: (i: number | null) => void;
}

/**
 * Ein Themenmodul der Plattform. Neue Module (Kultur, Termine, Sehenswürdigkeiten …)
 * werden in modules/index.ts registriert und bringen ihre Kartenebenen und ihr Panel mit.
 */
export interface ModuleDef {
  id: string;
  label: string;
  icon: string;
  status: 'live' | 'soon';
  overlays: OverlayKey[];
  Panel: ComponentType<ModuleProps>;
}
