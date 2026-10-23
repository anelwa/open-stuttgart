import type { OverlayKey } from '../../map/overlays';
import type { Selection } from '../types';

/** Ein Ort, wie ihn der Bot an die Oberfläche übergibt. */
export interface BotPlace {
  lat: number;
  lon: number;
  label: string;
  id?: string;
}

export interface BotSource {
  name: string;
  url?: string;
  license?: string;
  fetchedAt?: string;
}

export interface BotRoutePlan {
  from: BotPlace;
  to: BotPlace;
  mode: 'oepnv' | 'rad' | 'fuss' | 'auto';
  profile?: 'standard' | 'rollstuhl' | 'kinderwagen';
  durationMin: number;
  transfers?: number | null;
  geometry?: GeoJSON.LineString | GeoJSON.MultiLineString;
  estimated?: boolean;
}

export interface BotOffice {
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

export interface BotEvent {
  id: string;
  title: string;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  category?: string | null;
  price?: string | null;
  free?: boolean | null;
  lat?: number | null;
  lon?: number | null;
  url?: string | null;
  verified?: string | null;
}

export interface BotWeather {
  temperature: number;
  condition?: string;
  icon?: string;
  precipitation?: number;
  time?: string;
}

export interface BotParking {
  id: number | string;
  name: string;
  address?: string | null;
  free: number | null;
  capacity: number | null;
  fee?: string | null;
  lat: number;
  lon: number;
  distanceM?: number | null;
}

export interface BotFacility {
  id: string;
  cat: string;
  name: string;
  lat: number;
  lon: number;
  address?: string | null;
  hours?: string | null;
  live?: string | null;
  info?: string[];
  closed?: boolean;
}

export interface BotKnowledgeHit {
  id?: number;
  title: string;
  type?: string;
  snippet?: string | null;
  url?: string | null;
  source?: string | null;
}

export interface BotAddressProfile {
  label: string;
  district?: string | null;
  facts: { label: string; value: string }[];
}

export type BotCard =
  | { type: 'office'; office: BotOffice; alternatives?: BotOffice[] }
  | { type: 'route'; plan: BotRoutePlan; alternatives?: BotRoutePlan[] }
  | { type: 'events'; items: BotEvent[]; note?: string }
  | { type: 'weather'; now: BotWeather; hours?: BotWeather[]; warning?: string }
  | { type: 'parking'; site: BotParking; walkMin?: number | null }
  | { type: 'knowledge'; hits: BotKnowledgeHit[] }
  | { type: 'places'; title?: string; items: { id?: string; name: string; detail?: string | null; lat?: number | null; lon?: number | null }[] }
  | { type: 'address'; profile: BotAddressProfile }
  | { type: 'not_possible'; reason: string; link?: string };

/**
 * Typisierte Absichten. Das Modell darf nur diese Formen erzeugen; die App führt sie aus.
 * Kein DOM-Zugriff, kein freies HTML, keine beliebigen URLs.
 */
export type BotUiAction =
  | { type: 'open_module'; module: string; focus?: string; anliegen?: string }
  | { type: 'close_module' }
  | { type: 'set_layer'; key: OverlayKey; on: boolean }
  | { type: 'set_layers'; on: OverlayKey[]; off?: OverlayKey[]; only?: boolean }
  | { type: 'show_nearby'; items: BotFacility[]; color?: Record<string, string>; fit?: boolean }
  | { type: 'clear_nearby' }
  | { type: 'fly_to'; lon: number; lat: number; zoom?: number }
  | { type: 'fit_bounds'; bbox: [number, number, number, number]; maxZoom?: number }
  | { type: 'select'; selection: Selection }
  | { type: 'clear_selection' }
  | { type: 'show_route'; from?: BotPlace; to: BotPlace; mode?: 'oepnv' | 'rad' | 'fuss' | 'auto'; profile?: 'standard' | 'rollstuhl' | 'kinderwagen'; fit?: boolean }
  | { type: 'clear_route' }
  | { type: 'search'; query: string; submit?: boolean }
  | { type: 'open_document'; id: number }
  | { type: 'open_info'; page: string; anchor?: string }
  | { type: 'module_command'; module: string; command: string; args?: Record<string, unknown> }
  | { type: 'set_theme'; theme: 'light' | 'dark' }
  | { type: 'set_terrain'; on: boolean }
  | { type: 'set_aerial'; on: boolean; year?: string }
  | { type: 'play_radar'; frame?: number | 'now'; play?: boolean }
  | { type: 'set_sheet'; level: 'mini' | 'peek' | 'open' }
  | { type: 'highlight'; layer: OverlayKey; ids: string[]; ttlMs?: number }
  | { type: 'toast'; text: string; tone?: 'info' | 'success' | 'warn' };

/** Ein Auftrag vom Server. `auto` heißt: sofort ausführen, nicht nur als Knopf zeigen. */
export interface BotActionRequest {
  id: string;
  action: BotUiAction;
  auto?: boolean;
  label?: string;
  confirm?: boolean;
}

export interface BotReceipt {
  actionId: string;
  status: 'ok' | 'error';
  label: string;
  message?: string;
  undoable?: boolean;
}

export interface BotContext {
  module: string | null;
  focus: string | null;
  anliegen: string | null;
  selection: { type: string; id?: string; name?: string } | null;
  center: [number, number];
  zoom: number;
  bbox: [number, number, number, number];
  layers: OverlayKey[];
  route: { from?: BotPlace; to?: BotPlace; mode?: string; active: boolean } | null;
  theme: 'light' | 'dark';
  locale: 'de' | 'en';
  localTime: string;
  location: { lat: number; lon: number; label?: string; accuracy?: number } | null;
  lastActions: string[];
}

export interface BotMeta {
  model?: string | null;
  llm?: boolean;
  fallback?: boolean;
  latencyMs?: number;
  tools?: string[];
  budget?: { limitUsd: number; spentUsd: number };
}

/** Antwort von POST /api/bot. `actions` sind sichtbare Knöpfe, `ui` sind automatische Aktionen. */
export interface BotResponse {
  sessionId: string;
  reply: string;
  speech?: string;
  suggestions?: string[];
  actions?: LegacyBotAction[];
  ui?: BotActionRequest[];
  cards?: BotCard[];
  sources?: BotSource[];
  limits?: string[];
  office?: BotOffice | null;
  alternatives?: BotOffice[];
  meta?: BotMeta;
}

/** Bestehende, sichtbare Knöpfe (Termin, Online, Route, Karte, Link, Standort). */
export interface LegacyBotAction {
  type: 'booking' | 'route' | 'map' | 'link' | 'online' | 'location';
  label: string;
  url?: string;
  lat?: number;
  lon?: number;
  name?: string;
  gebaeudeId?: string | null;
}
