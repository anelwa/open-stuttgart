import { OVERLAY_LAYERS, type OverlayKey } from '../../map/overlays';
import type { BotUiAction } from './types';

const OVERLAY_KEYS = new Set(Object.keys(OVERLAY_LAYERS) as OverlayKey[]);
const MODULES = new Set(['nearby', 'verwaltung', 'route', 'mobility', 'environment', 'culture', 'wasgeht', 'bartouren', 'sun', 'wissen']);
const INFO_PAGES = new Set(['grundsaetze', 'werte', 'barrierefreiheit', 'leicht', 'daten', 'stadt']);
const ROUTE_MODES = new Set(['oepnv', 'rad', 'fuss', 'auto']);
const PROFILES = new Set(['standard', 'rollstuhl', 'kinderwagen']);
const SELECTION_TYPES = new Set(['stop', 'parking', 'roadwork', 'air', 'sharing', 'water', 'event', 'facility', 'place', 'verwaltung_gebaeude', 'verwaltung_leistung', 'wissen']);

/** Stuttgart plus kleiner regionaler Saum. */
export const STUTTGART_BBOX = { minLon: 8.85, maxLon: 9.55, minLat: 48.55, maxLat: 49.05 };

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 400) => typeof v === 'string' ? v.slice(0, max) : '';
const num = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : null;
const inBox = (lat: number, lon: number) =>
  lat >= STUTTGART_BBOX.minLat && lat <= STUTTGART_BBOX.maxLat
  && lon >= STUTTGART_BBOX.minLon && lon <= STUTTGART_BBOX.maxLon;

function validPlace(raw: unknown): { lat: number; lon: number; label: string; id?: string } | null {
  if (!isRec(raw)) return null;
  const lat = num(raw.lat);
  const lon = num(raw.lon);
  if (lat == null || lon == null || !inBox(lat, lon)) return null;
  return { lat, lon, label: str(raw.label, 160) || 'Ort', ...(str(raw.id, 120) ? { id: str(raw.id, 120) } : {}) };
}

function validOverlayList(raw: unknown, max = 30): OverlayKey[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is OverlayKey => typeof x === 'string' && OVERLAY_KEYS.has(x as OverlayKey)))].slice(0, max);
}

function validSelection(raw: unknown): BotUiAction | null {
  if (!isRec(raw) || typeof raw.type !== 'string' || !SELECTION_TYPES.has(raw.type)) return null;
  const type = raw.type;
  if (type === 'stop') {
    const id = str(raw.id, 80);
    const name = str(raw.name, 160);
    const ll = raw.lngLat;
    const lon = Array.isArray(ll) ? num(ll[0]) : null;
    const lat = Array.isArray(ll) ? num(ll[1]) : null;
    if (!id || lat == null || lon == null || !inBox(lat, lon)) return null;
    return { type: 'select', selection: { type: 'stop', id, name, lngLat: [lon, lat] } };
  }
  if (type === 'water') return { type: 'select', selection: { type: 'water' } };
  if (type === 'verwaltung_leistung') {
    const url = str(raw.url, 1000);
    if (!/^https:\/\/(www\.)?stuttgart\.de\//i.test(url)) return null;
    const lat = num(raw.lat); const lon = num(raw.lon);
    return { type: 'select', selection: { type: 'verwaltung_leistung', url, ...(lat != null && lon != null ? { lat, lon } : {}) } };
  }
  if (type === 'verwaltung_gebaeude') {
    const id = str(raw.id, 120);
    if (!id) return null;
    return { type: 'select', selection: { type: 'verwaltung_gebaeude', id } };
  }
  // Die übrigen Typen werden nur mit einer ID ausgewählt. Die App prüft, ob sie existiert.
  const id = str(raw.id, 160);
  if (!id) return null;
  switch (type) {
    case 'parking': {
      const n = Number(id);
      return Number.isFinite(n) ? { type: 'select', selection: { type: 'parking', id: n } } : null;
    }
    case 'roadwork': return { type: 'select', selection: { type: 'roadwork', id } };
    case 'air': return { type: 'select', selection: { type: 'air', id } };
    case 'sharing': return { type: 'select', selection: { type: 'sharing', id } };
    case 'event': return { type: 'select', selection: { type: 'event', id } };
    case 'place': return { type: 'select', selection: { type: 'place', id } };
    default: return null;
  }
}

/**
 * Validiert eine Aktion aus dem Netz. Die App führt nur das aus, was hier durchkommt.
 * Unbekannte oder unsinnige Aktionen werden still verworfen.
 */
export function validateBotAction(raw: unknown): BotUiAction | null {
  if (!isRec(raw) || typeof raw.type !== 'string') return null;
  switch (raw.type) {
    case 'open_module': {
      const module = str(raw.module, 60);
      if (!MODULES.has(module)) return null;
      return {
        type: 'open_module', module,
        ...(str(raw.focus, 80) ? { focus: str(raw.focus, 80) } : {}),
        ...(str(raw.anliegen, 80) ? { anliegen: str(raw.anliegen, 80) } : {}),
      };
    }
    case 'close_module':
      return { type: 'close_module' };
    case 'set_layer': {
      const key = str(raw.key, 40);
      if (!OVERLAY_KEYS.has(key as OverlayKey)) return null;
      return { type: 'set_layer', key: key as OverlayKey, on: raw.on === true };
    }
    case 'set_layers': {
      const on = validOverlayList(raw.on);
      const off = validOverlayList(raw.off);
      if (!on.length && !off.length && raw.only !== true) return null;
      return { type: 'set_layers', on, ...(off.length ? { off } : {}), ...(raw.only === true ? { only: true } : {}) };
    }
    case 'show_nearby': {
      if (!Array.isArray(raw.items)) return null;
      const items = raw.items.slice(0, 500).flatMap((x) => {
        if (!isRec(x)) return [];
        const id = str(x.id, 160); const name = str(x.name, 160); const cat = str(x.cat, 60);
        const lat = num(x.lat); const lon = num(x.lon);
        if (!id || !name || !cat || lat == null || lon == null || !inBox(lat, lon)) return [];
        return [{
          id, name, cat, lat, lon,
          ...(str(x.address, 240) ? { address: str(x.address, 240) } : {}),
          ...(str(x.hours, 240) ? { hours: str(x.hours, 240) } : {}),
          ...(str(x.live, 240) ? { live: str(x.live, 240) } : {}),
          ...(Array.isArray(x.info) ? { info: x.info.filter((s): s is string => typeof s === 'string').slice(0, 8) } : {}),
          ...(x.closed === true ? { closed: true } : {}),
        }];
      });
      if (!items.length) return null;
      const color: Record<string, string> | undefined = isRec(raw.color)
        ? Object.fromEntries(Object.entries(raw.color).filter(([, v]) => typeof v === 'string').slice(0, 30)) as Record<string, string>
        : undefined;
      return { type: 'show_nearby', items, ...(color ? { color } : {}), fit: raw.fit !== false };
    }
    case 'clear_nearby':
      return { type: 'clear_nearby' };
    case 'fly_to': {
      const lat = num(raw.lat); const lon = num(raw.lon);
      if (lat == null || lon == null || !inBox(lat, lon)) return null;
      const zoom = num(raw.zoom);
      return { type: 'fly_to', lat, lon, ...(zoom != null ? { zoom: Math.max(2, Math.min(19, zoom)) } : {}) };
    }
    case 'fit_bounds': {
      const b = raw.bbox;
      if (!Array.isArray(b) || b.length !== 4) return null;
      const [minLon, minLat, maxLon, maxLat] = b.map(num);
      if ([minLon, minLat, maxLon, maxLat].some((x) => x == null)) return null;
      if (!inBox(minLat!, minLon!) || !inBox(maxLat!, maxLon!)) return null;
      const z = num(raw.maxZoom);
      return { type: 'fit_bounds', bbox: [minLon!, minLat!, maxLon!, maxLat!], ...(z != null ? { maxZoom: z } : {}) };
    }
    case 'select':
      return validSelection(raw.selection);
    case 'clear_selection':
      return { type: 'clear_selection' };
    case 'show_route': {
      const to = validPlace(raw.to);
      if (!to) return null;
      const from = raw.from ? validPlace(raw.from) : null;
      const mode = str(raw.mode, 20);
      const profile = str(raw.profile, 20);
      return {
        type: 'show_route', to,
        ...(from ? { from } : {}),
        ...(ROUTE_MODES.has(mode) ? { mode: mode as 'oepnv' | 'rad' | 'fuss' | 'auto' } : {}),
        ...(PROFILES.has(profile) ? { profile: profile as 'standard' | 'rollstuhl' | 'kinderwagen' } : {}),
        fit: raw.fit !== false,
      };
    }
    case 'clear_route':
      return { type: 'clear_route' };
    case 'search': {
      const query = str(raw.query, 240).trim();
      return query ? { type: 'search', query, submit: raw.submit === true } : null;
    }
    case 'open_document': {
      const id = num(raw.id);
      return id != null && id > 0 ? { type: 'open_document', id } : null;
    }
    case 'open_info': {
      const page = str(raw.page, 40);
      return INFO_PAGES.has(page) ? { type: 'open_info', page, ...(str(raw.anchor, 80) ? { anchor: str(raw.anchor, 80) } : {}) } : null;
    }
    case 'module_command': {
      const module = str(raw.module, 60);
      const command = str(raw.command, 60);
      if (!MODULES.has(module) || !command) return null;
      return { type: 'module_command', module, command, ...(isRec(raw.args) ? { args: raw.args } : {}) };
    }
    case 'set_theme':
      return raw.theme === 'light' || raw.theme === 'dark' ? { type: 'set_theme', theme: raw.theme } : null;
    case 'set_terrain':
      return { type: 'set_terrain', on: raw.on === true };
    case 'set_aerial': {
      const year = str(raw.year, 4);
      return { type: 'set_aerial', on: raw.on === true, ...(/^\d{4}$/.test(year) ? { year } : {}) };
    }
    case 'play_radar': {
      const frame = raw.frame === 'now' ? 'now' : num(raw.frame);
      return { type: 'play_radar', ...(frame != null ? { frame } : {}), ...(typeof raw.play === 'boolean' ? { play: raw.play } : {}) };
    }
    case 'set_sheet': {
      const level = str(raw.level, 10);
      return level === 'mini' || level === 'peek' || level === 'open' ? { type: 'set_sheet', level } : null;
    }
    case 'highlight': {
      const layer = str(raw.layer, 40);
      const ids = Array.isArray(raw.ids) ? raw.ids.filter((x): x is string => typeof x === 'string').slice(0, 100) : [];
      if (!OVERLAY_KEYS.has(layer as OverlayKey) || !ids.length) return null;
      const ttl = num(raw.ttlMs);
      return { type: 'highlight', layer: layer as OverlayKey, ids, ...(ttl != null ? { ttlMs: Math.max(500, Math.min(15000, ttl)) } : {}) };
    }
    case 'toast': {
      const text = str(raw.text, 240).trim();
      if (!text) return null;
      const tone = raw.tone === 'success' || raw.tone === 'warn' ? raw.tone : 'info';
      return { type: 'toast', text, tone };
    }
    default:
      return null;
  }
}

export function actionLabel(action: BotUiAction): string {
  switch (action.type) {
    case 'open_module': return 'Bereich geöffnet';
    case 'close_module': return 'Bereich geschlossen';
    case 'set_layer': return action.on ? 'Ebene eingeschaltet' : 'Ebene ausgeschaltet';
    case 'set_layers': return 'Ebenen geändert';
    case 'show_nearby': return `${action.items.length} Orte eingeblendet`;
    case 'clear_nearby': return 'Orte ausgeblendet';
    case 'fly_to': return 'Karte verschoben';
    case 'fit_bounds': return 'Kartenausschnitt gesetzt';
    case 'select': return 'Objekt ausgewählt';
    case 'clear_selection': return 'Auswahl aufgehoben';
    case 'show_route': return 'Route gesetzt';
    case 'clear_route': return 'Route entfernt';
    case 'search': return 'Suche geöffnet';
    case 'open_document': return 'Dokument geöffnet';
    case 'open_info': return 'Erklärung geöffnet';
    case 'module_command': return 'Ansicht angepasst';
    case 'set_theme': return action.theme === 'dark' ? 'Dunkle Ansicht' : 'Helle Ansicht';
    case 'set_terrain': return action.on ? '3D-Gelände an' : '3D-Gelände aus';
    case 'set_aerial': return action.on ? 'Luftbild an' : 'Luftbild aus';
    case 'play_radar': return 'Regenradar';
    case 'set_sheet': return 'Ansicht angepasst';
    case 'highlight': return 'Hervorhebung';
    case 'toast': return 'Hinweis';
    default: return 'Aktion';
  }
}
