import type { ComponentType } from 'react';
import type { OverlayKey } from '../map/overlays';
import type { Facility, Selection } from '../lib/types';
import type { Place } from '../lib/routeCtx';

export interface ModuleProps {
  visible: Record<OverlayKey, boolean>;
  toggle: (k: OverlayKey) => void;
  /**
   * Gewähltes Anliegen. Das Panel lässt davon die Reihenfolge und die Offenheit seiner
   * Abschnitte abhängen — Inhalte bleiben vorhanden, werden aber nicht alle zugleich gezeigt.
   */
  focus?: string;
  select: (s: Selection) => void;
  flyTo: (lngLat: [number, number], zoom?: number) => void;
  /** Kartenausschnitt auf einen Bereich legen; berücksichtigt Panel und Detailansicht */
  fitBounds: (bounds: [[number, number], [number, number]], opts?: { maxZoom?: number }) => void;
  /** Ebene gezielt ein- oder ausschalten */
  setLayer: (k: OverlayKey, on: boolean) => void;
  /** Aktueller Kartenmittelpunkt [lon, lat] */
  center: [number, number];
  /** Rasterbild für die Sonnen- und Schattenebene (Data-URL) */
  setSunImage: (url: string | null) => void;
  /** Gewähltes Radarbild (Index), null = aktuelles */
  radarFrame: number | null;
  setRadarFrame: (i: number | null) => void;
  /** Punkte der Nähe-Suche auf der Karte */
  setNearby: (d: { items: Facility[]; color: Record<string, string> } | null) => void;
  /** Gewählte Verbindung als Linien auf der Karte */
  setRoute: (fc: GeoJSON.FeatureCollection | null) => void;
  /** Ziel aus „Verbindung suchen“ einer Detailansicht */
  routeTarget: Place | null;
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
