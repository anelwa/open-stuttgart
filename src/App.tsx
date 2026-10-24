import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MapView, type MapData, type MapHandle } from './map/MapView';
import type { Theme } from './map/mapStyle';
import { AERIAL_YEARS, type OverlayKey } from './map/overlays';
import { MODULES } from './modules';
import { DataProvider, useData } from './lib/data';
import type { Facility, Selection } from './lib/types';
import { Icon, weatherIconName } from './components/Icon';
import { Search, type SearchHandle } from './components/Search';
import { DocumentReader } from './components/DocumentReader';
import { DetailSheet } from './components/Details';
import { BigEventBanner } from './components/BigEvent';
import { AIR_COLOR, AIR_LABEL, fmtDec } from './lib/format';
import { loadStops } from './lib/stops';
import { nowFrame, radarCoords, radarImage } from './lib/rain';
import { InfoProvider, type InfoPage } from './lib/info';
import { useLive } from './lib/live';
import { RouteProvider, type RouteRequest } from './lib/routeCtx';
import { LANGS, setLang, tr, useLang } from './lib/i18n';
import { InfoPages } from './components/InfoPages';
import { LayerSheet } from './components/LayerSheet';
import { StartPanel } from './components/StartPanel';
import { QuickActions } from './components/QuickActions';
import { ANLIEGEN, type Anliegen } from './lib/anliegen';
import { Disclosure } from './components/ui';
import { StuttBot } from './components/StuttBot';
import { Kiosk } from './components/Kiosk';
import { KontaktSheet } from './components/KontaktSheet';
import type { Kontakt } from './lib/kontakt';
import { objectUrl } from './components/WissenDetail';
import type { BotContext, BotReceipt, BotUiAction } from './lib/bot/types';
import { actionLabel, validateBotAction } from './lib/bot/actions';
import type { ModuleCommand } from './modules/types';

const DEFAULT_VISIBLE: Record<OverlayKey, boolean> = {
  network: true, stops: true, parking: true, sharing: false, roadworks: true, bike: false, air: true, water: true, events: true, places: true, sun: false, radar: true, aerial: false, nearby: true, live: true, route: true, vehicles: true, traffic: false, warnung: true, flug: false, kaltluft: false, unfall: false, hike: false, wissen: false, bartouren: false, spiel: false, umland: false,
};

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}
function writePref(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* privat */ }
}

function newBotActionId() {
  try { return crypto.randomUUID(); } catch { return `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

function readBotLocation(): BotContext['location'] {
  try {
    const saved = JSON.parse(localStorage.getItem('os-adresse') ?? 'null');
    const [lon, lat] = saved?.lngLat ?? [];
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat: Number(lat), lon: Number(lon), label: saved.label ?? saved.address ?? 'Meine Adresse' };
    }
  } catch { /* egal */ }
  return null;
}

interface BotSnapshot {
  moduleId: string | null;
  focus: string | null;
  anliegenId: string | null;
  visible: Record<OverlayKey, boolean>;
  selection: Selection | null;
  theme: Theme;
  terrain: boolean;
  aerial: { year: string; opacity: number };
  routeTarget: RouteRequest | null;
  routeGeo: GeoJSON.FeatureCollection | null;
  sheet: 'mini' | 'peek' | 'open';
  center: [number, number];
}

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

function Shell() {
  const data = useData();
  const mapRef = useRef<MapHandle>(null);
  const searchRef = useRef<SearchHandle>(null);
  const botUndo = useRef(new Map<string, BotSnapshot>());
  const botActionLog = useRef<string[]>([]);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const mobile = useMedia('(max-width: 900px)');
  const compact = useMedia('(max-width: 1180px)');
  const lang = useLang();
  const [theme, setTheme] = useState<Theme>(() => readPref('theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  // null = Einstieg ohne vorgewähltes Thema. Der Startzustand fragt nach dem Anliegen,
  // statt den Datenbestand eines Themas sofort zu zeigen.
  const [moduleId, setModuleId] = useState<string | null>(() => readPref('module-v2', null));
  const [focus, setFocus] = useState<string | null>(() => readPref('focus-v2', null));
  const [anliegenId, setAnliegenId] = useState<string | null>(() => readPref('anliegen-v2', null));
  const [visible, setVisible] = useState<Record<OverlayKey, boolean>>(() => ({ ...DEFAULT_VISIBLE, ...readPref('layers', {}) }));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [terrain, setTerrain] = useState(false);
  const [sheet, setSheet] = useState<'mini' | 'peek' | 'open'>('peek');
  const [ready, setReady] = useState(false);
  const [center, setCenter] = useState<[number, number]>([9.18, 48.779]);
  const [spielGeo, setSpielGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [sunImage, setSunImage] = useState<string | null>(null);
  const [radarFrame, setRadarFrame] = useState<number | null>(null);
  const [nearby, setNearby] = useState<MapData['nearby']>(null);
  const [wissen, setWissen] = useState<GeoJSON.FeatureCollection | null>(null);
  const [info, setInfo] = useState<{ page: InfoPage; anchor?: string } | null>(null);
  const [docId, setDocId] = useState<number | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [botVoiceRequest, setBotVoiceRequest] = useState(0);
  const [kontaktOpen, setKontaktOpen] = useState(false);
  const [moduleCommand, setModuleCommand] = useState<ModuleCommand | null>(null);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const openInfo = useCallback((page: InfoPage, anchor?: string) => setInfo({ page, anchor }), []);
  const [aerial, setAerial] = useState({ year: AERIAL_YEARS[AERIAL_YEARS.length - 1], opacity: 1 });
  const radarImg = useMemo(() => {
    const r = data.radar.data;
    if (!r || !visible.radar || !r.frames.length) return null;
    const img = radarImage(r, radarFrame ?? nowFrame(r));
    return img ? { url: img.url, coords: radarCoords(r) } : null;
  }, [data.radar.data, visible.radar, radarFrame]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#141414' : '#26262C');
    writePref('theme', theme);
  }, [theme]);
  useEffect(() => {
    writePref('module-v2', moduleId); writePref('focus-v2', focus); writePref('anliegen-v2', anliegenId);
  }, [moduleId, focus, anliegenId]);
  useEffect(() => writePref('layers', visible), [visible]);

  const toggle = useCallback((k: OverlayKey) => setVisible((v) => ({ ...v, [k]: !v[k] })), []);
  const setLayer = useCallback((k: OverlayKey, on: boolean) => setVisible((v) => (v[k] === on ? v : { ...v, [k]: on })), []);

  const selectedPoint = useMemo<[number, number] | null>(() => {
    if (!selection) return null;
    switch (selection.type) {
      case 'stop': return selection.lngLat;
      case 'parking': { const p = data.parking.data?.sites.find((s) => s.id === selection.id); return p ? [p.lon, p.lat] : null; }
      case 'roadwork': { const r = data.roadworks.data?.items.find((s) => s.id === selection.id); return r ? [r.lon, r.lat] : null; }
      case 'air': { const a = data.air.data?.stations.find((s) => s.id === selection.id); return a ? [a.lon, a.lat] : null; }
      case 'sharing': { const s = data.sharing.data?.items.find((x) => x.id === selection.id); return s ? [s.lon, s.lat] : null; }
      case 'water': return data.water.data ? [data.water.data.lon, data.water.data.lat] : null;
      case 'event': { const e = data.events.data?.events.find((x) => x.id === selection.id); return e?.lon != null ? [e.lon, e.lat!] : null; }
      case 'facility': return [selection.item.lon, selection.item.lat];
      case 'place': { const p = data.places.data?.places.find((x) => x.id === selection.id); return p ? [p.lon, p.lat] : null; }
      case 'verwaltung_gebaeude': return selection.lngLat ?? null;
      case 'verwaltung_leistung': return selection.lon != null && selection.lat != null ? [selection.lon, selection.lat] : null;
      case 'wissen': return selection.lngLat;
      case 'bartour-stop': return selection.lngLat;
      case 'umland': {
        const z = data.umland.data?.items.find((x) => x.id === selection.id);
        return z ? [z.lon, z.lat] : selection.lngLat;
      }
    }
  }, [selection, data]);

  const select = useCallback((s: Selection | null) => {
    setSelection(s);
    if (s && mobile) setSheet('peek');
  }, [mobile]);

  const sheetDrag = useRef<{ startY: number; moved: boolean } | null>(null);
  const pageDrag = useRef<{ mode: 'sheet' | 'module' | 'detail'; startY: number; moved: boolean } | null>(null);
  const suppressSheetClick = useRef(false);
  const deepLinkDone = useRef(false);
  const cycleSheet = useCallback(() => {
    setSheet((s) => (s === 'mini' ? 'peek' : s === 'peek' ? 'open' : 'mini'));
  }, []);

  const backToStart = useCallback(() => {
    setModuleId(null);
    setFocus(null);
    setAnliegenId(null);
    setSelection(null);
    setWissen(null);
    setSpielGeo(null);
    setModuleCommand(null);
    setVisible((v) => ({ ...v, ...(v.wissen ? { wissen: false } : {}), ...(v.spiel ? { spiel: false } : {}) }));
    setSheet('peek');
  }, []);

  const startPageDrag = (mode: 'sheet' | 'module' | 'detail') => (e: ReactPointerEvent<HTMLElement>) => {
    if (!mobile) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    if (mode === 'detail' && !(e.target as HTMLElement).closest('.sheet-head, .mobile-grab')) return;
    pageDrag.current = { mode, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const movePageDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (!pageDrag.current) return;
    if (Math.abs(e.clientY - pageDrag.current.startY) > 8) pageDrag.current.moved = true;
  };

  const endPageDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = pageDrag.current;
    pageDrag.current = null;
    if (!drag?.moved) return;
    const dy = e.clientY - drag.startY;
    if (drag.mode === 'detail' && dy > 70) { setSelection(null); return; }
    // Module verhalten sich wie das Startblatt: nach unten ziehen gibt die Karte frei,
    // ohne das Modul (und damit eine geplante Route) zu verlassen. Zurück geht es über
    // die Brotkrume. So bleibt die Route beim Blick auf die Karte erhalten.
    if (drag.mode === 'sheet' || drag.mode === 'module') {
      if (dy > 36) setSheet((s) => (dy > 150 ? 'mini' : s === 'open' ? 'peek' : 'mini'));
      else if (dy < -36) setSheet((s) => (dy < -150 ? 'open' : s === 'mini' ? 'peek' : 'open'));
    }
  };

  const sheetBottom = sheet === 'mini' ? 0.1 : sheet === 'open' ? 0.86 : 0.42;

  useEffect(() => {
    if (!locateMsg) return;
    const t = setTimeout(() => setLocateMsg(null), 4500);
    return () => clearTimeout(t);
  }, [locateMsg]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateMsg('Dieser Browser kann keinen Standort ermitteln.');
      return;
    }
    setLocateMsg('Standort wird ermittelt …');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.locate([pos.coords.longitude, pos.coords.latitude], 15);
        setLocateMsg(null);
      },
      (err) => {
        setLocateMsg(err.code === err.PERMISSION_DENIED
          ? 'Standort nicht freigegeben. Bitte in den Browser-Einstellungen erlauben.'
          : 'Standort konnte nicht ermittelt werden. Bitte erneut versuchen.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const detailPadding = useMemo(() => mobile
    ? { left: 0, right: 0, bottom: Math.round(window.innerHeight * 0.62) }
    : compact
      ? { left: 0, right: 412, bottom: 0 }
      : { left: 440, right: 440, bottom: 0 }, [mobile, compact]);
  const padding = useMemo(() => selection ? detailPadding : mobile
    ? { left: 0, right: 0, bottom: Math.round(window.innerHeight * sheetBottom) }
    : { left: compact ? 396 : 440, right: botOpen ? 436 : 0, bottom: 0 }, [mobile, compact, selection, detailPadding, sheetBottom, botOpen]);

  const flyTo = useCallback((c: [number, number], z?: number) => mapRef.current?.flyTo(c, z), []);
  const fitBounds = useCallback((bounds: [[number, number], [number, number]], opts?: { maxZoom?: number }) => mapRef.current?.fitBounds(bounds, opts), []);
  /** Kontakt auf der Karte zeigen; bei bekannten Gebäuden die Verwaltungsdetails öffnen. */
  const showKontaktOnMap = useCallback((k: Kontakt) => {
    if (k.lat == null || k.lon == null) return;
    setKontaktOpen(false);
    setDocId(null);
    flyTo([k.lon, k.lat], 16);
    if (k.buildingId) select({ type: 'verwaltung_gebaeude', id: k.buildingId, lngLat: [k.lon, k.lat] });
  }, [flyTo, select]);

  // Permanente Links (?o=…): Objekt nach dem Laden der Daten auswählen.
  useEffect(() => {
    if (deepLinkDone.current) return;
    const q = new URLSearchParams(location.search);
    const kind = q.get('o');
    if (!kind) { deepLinkDone.current = true; return; }
    const id = q.get('id') ?? '';
    if (kind === 'wissen') {
      const lat = Number(q.get('lat')); const lon = Number(q.get('lon'));
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        select({
          type: 'wissen', id, layer: q.get('layer') ?? '', layerTitle: q.get('lt') ?? 'Stadt-Layer',
          name: q.get('name') ?? 'Objekt', lngLat: [lon, lat], props: {},
        });
        setTimeout(() => flyTo([lon, lat], 16), 500);
      }
      deepLinkDone.current = true;
      return;
    }
    if (kind === 'parking' && data.parking.data) {
      const p = data.parking.data.sites.find((x) => String(x.id) === id);
      if (p) { select({ type: 'parking', id: p.id }); flyTo([p.lon, p.lat], 15); }
      deepLinkDone.current = true;
    } else if (kind === 'roadwork' && data.roadworks.data) {
      const r = data.roadworks.data.items.find((x) => x.id === id);
      if (r) { select({ type: 'roadwork', id: r.id }); flyTo([r.lon, r.lat], 15); }
      deepLinkDone.current = true;
    } else if (kind === 'place' && data.places.data) {
      const p = data.places.data.places.find((x) => x.id === id);
      if (p) { select({ type: 'place', id: p.id }); flyTo([p.lon, p.lat], 15); }
      deepLinkDone.current = true;
    } else if (kind === 'air' && data.air.data) {
      const a = data.air.data.stations.find((x) => x.id === id);
      if (a) { select({ type: 'air', id: a.id }); flyTo([a.lon, a.lat], 15); }
      deepLinkDone.current = true;
    } else if (kind === 'sharing' && data.sharing.data) {
      const x = data.sharing.data.items.find((s) => s.id === id);
      if (x) { select({ type: 'sharing', id: x.id }); flyTo([x.lon, x.lat], 15); }
      deepLinkDone.current = true;
    } else if (kind === 'water' && data.water.data) {
      select({ type: 'water' }); flyTo([data.water.data.lon, data.water.data.lat], 14);
      deepLinkDone.current = true;
    } else if (kind === 'event' && data.events.data) {
      const e = data.events.data.events.find((x) => x.id === id);
      if (e) { select({ type: 'event', id: e.id }); if (e.lon != null && e.lat != null) flyTo([e.lon, e.lat], 15); }
      deepLinkDone.current = true;
    } else if (kind === 'verwaltung_gebaeude') {
      const lat = Number(q.get('lat')); const lon = Number(q.get('lon'));
      select({ type: 'verwaltung_gebaeude', id, ...(Number.isFinite(lat) && Number.isFinite(lon) ? { lngLat: [lon, lat] as [number, number] } : {}) });
      if (Number.isFinite(lat) && Number.isFinite(lon)) flyTo([lon, lat], 15);
      deepLinkDone.current = true;
    } else if (kind === 'leistung') {
      const url = q.get('url');
      if (url) {
        const lat = Number(q.get('lat')); const lon = Number(q.get('lon'));
        select({ type: 'verwaltung_leistung', url, ...(Number.isFinite(lat) ? { lat } : {}), ...(Number.isFinite(lon) ? { lon } : {}) });
        deepLinkDone.current = true;
      }
    } else if (kind === 'umland' && data.umland.data) {
      const z = data.umland.data.items.find((x) => x.id === id);
      if (z) {
        setModuleId('umland'); setFocus('ziele'); setAnliegenId('umland');
        select({ type: 'umland', id: z.id, lngLat: [z.lon, z.lat] });
        flyTo([z.lon, z.lat], 13);
      }
      deepLinkDone.current = true;
    } else if (kind === 'facility') {
      const cat = q.get('cat');
      if (cat && id && !deepLinkDone.current) {
        deepLinkDone.current = true;
        fetch(`/api/nearby/facilities?cat=${encodeURIComponent(cat)}`)
          .then((r) => r.json())
          .then((d: { items?: Facility[] }) => {
            const item = (d.items ?? []).find((x) => x.id === id);
            if (item) {
              select({ type: 'facility', item });
              flyTo([item.lon, item.lat], 15);
            }
          }).catch(() => { /* egal */ });
      }
    }
  }, [data.parking.data, data.roadworks.data, data.places.data, data.air.data, data.sharing.data, data.water.data, data.events.data, data.umland.data, select, flyTo]);

  // Tiefe Links: ?spiel=kessel-code öffnet das Stadtspiel.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('spiel');
    if (!id) return;
    setModuleId('spiel');
    setFocus('routen');
    setAnliegenId('spiel');
    setSelection(null);
    if (mobile) setSheet('open');
  }, [mobile]);

  // Tiefe Links: ?stop=de:08111:6115
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('stop');
    if (!id) return;
    loadStops().then((stops) => {
      const s = stops.find((x) => x.properties.id === id);
      if (s) {
        const c = s.geometry.coordinates as [number, number];
        setSelection({ type: 'stop', id, name: s.properties.name, lngLat: c, lines: s.properties.lines });
        setTimeout(() => mapRef.current?.flyTo(c, 15), 600);
      }
    });
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    if (selection?.type === 'stop') url.searchParams.set('stop', selection.id);
    else url.searchParams.delete('stop');
    history.replaceState(null, '', url);
  }, [selection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelection(null); setDocId(null); setLayersOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mod = MODULES.find((m) => m.id === moduleId) ?? null;
  const w = data.weather.data;
  const airWorst = (data.air.data?.stations ?? []).reduce<number | null>((m, s) => (s.index == null ? m : m == null || s.index > m ? s.index : m), null);

  const live = useLive(visible.live);
  const [routeGeo, setRouteGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [routeTarget, setRouteTarget] = useState<RouteRequest | null>(null);
  const activeAnliegen = useMemo(() => ANLIEGEN.find((a) => a.id === anliegenId) ?? null, [anliegenId]);

  const planRoute = useCallback((p: RouteRequest) => {
    setRouteTarget(p); setModuleId('route'); setFocus('route'); setAnliegenId('anreise');
    setSelection(null); setModuleCommand(null); if (mobile) setSheet('peek');
  }, [mobile]);

  /** Ein Anliegen öffnet das zuständige Panel, schaltet die passenden Ebenen zu und setzt den Fokus. */
  const openAnliegen = useCallback((a: Anliegen) => {
    setModuleId(a.module);
    setFocus(a.focus);
    setAnliegenId(a.id);
    setSelection(null);
    setModuleCommand(null);
    if (a.module !== 'spiel') {
      setSpielGeo(null);
      setVisible((v) => (v.spiel ? { ...v, spiel: false } : v));
    }
    setVisible((v) => {
      const next = { ...v };
      for (const k of a.layers) next[k] = true;
      return next;
    });
    // Der Weg ist eine Kartenaufgabe: Beim Öffnen bleibt die Karte sichtbar.
    if (mobile) setSheet(a.module === 'route' ? 'peek' : 'open');
  }, [mobile]);

  /**
   * Öffnet ein Themenmodul direkt („Alle Themen") oder aus einer Statusanzeige.
   * Der Anliegen-Kontext wird dabei bewusst gesetzt oder gelöscht, damit Brotkrume
   * und aktive Schnellaktion immer dasselbe versprechen.
   */
  const openModule = useCallback((id: string, f?: string, aId: string | null = null) => {
    setModuleId(id);
    setFocus(f ?? null);
    setAnliegenId(aId);
    setSelection(null);
    setModuleCommand(null);
    if (id !== 'spiel') {
      setSpielGeo(null);
      setVisible((v) => (v.spiel ? { ...v, spiel: false } : v));
    }
    // Beim Weg bleibt mehr Karte sichtbar: Die Route soll beim Öffnen direkt erkennbar sein.
    if (mobile) setSheet(id === 'route' ? 'peek' : 'open');
  }, [mobile]);

  /** Snapshot für „Rückgängig“: nur UI-Zustand, keine Daten und keine Chattexte. */
  const takeBotSnapshot = (): BotSnapshot => ({
    moduleId, focus, anliegenId,
    visible: { ...visible },
    selection,
    theme, terrain,
    aerial: { ...aerial },
    routeTarget,
    routeGeo,
    sheet,
    center,
  });

  const restoreBotSnapshot = (s: BotSnapshot) => {
    setModuleId(s.moduleId);
    setFocus(s.focus);
    setAnliegenId(s.anliegenId);
    setVisible({ ...s.visible });
    setSelection(s.selection);
    setTheme(s.theme);
    setTerrain(s.terrain);
    setAerial({ ...s.aerial });
    setRouteTarget(s.routeTarget);
    setRouteGeo(s.routeGeo);
    setSheet(s.sheet);
    setModuleCommand(null);
    mapRef.current?.flyTo(s.center);
  };

  const rememberUndo = (id: string, snap: BotSnapshot) => {
    botUndo.current.set(id, snap);
    if (botUndo.current.size > 12) {
      const first = botUndo.current.keys().next().value;
      if (first) botUndo.current.delete(first);
    }
  };

  const undoBotAction = (actionId: string) => {
    const snap = botUndo.current.get(actionId);
    if (!snap) return;
    restoreBotSnapshot(snap);
    botUndo.current.delete(actionId);
    setLocateMsg('Rückgängig gemacht.');
  };

  /** Eine Existenzprüfung, damit eine Bot-Auswahl nie ins Leere zeigt. */
  const selectionExists = (s: Selection): boolean => {
    switch (s.type) {
      case 'parking': {
        const list = data.parking.data?.sites;
        return !list || list.some((x) => String(x.id) === String(s.id));
      }
      case 'roadwork': {
        const list = data.roadworks.data?.items;
        return !list || list.some((x) => x.id === s.id);
      }
      case 'air': {
        const list = data.air.data?.stations;
        return !list || list.some((x) => x.id === s.id);
      }
      case 'sharing': {
        const list = data.sharing.data?.items;
        return !list || list.some((x) => x.id === s.id);
      }
      case 'event': {
        const list = data.events.data?.events;
        return !list || list.some((x) => x.id === s.id);
      }
      case 'place': {
        const list = data.places.data?.places;
        return !list || list.some((x) => x.id === s.id);
      }
      case 'bartour-stop': {
        const list = data.bartouren.data?.items;
        return !list || list.some((t) => t.id === s.tourId && t.stops.some((x) => x.index === s.stopIndex));
      }
      case 'umland': {
        const list = data.umland.data?.items;
        return !list || list.some((x) => x.id === s.id);
      }
      default:
        return true;
    }
  };

  const highlightPoint = (layer: OverlayKey, ids: string[]): [number, number] | null => {
    const has = (id: unknown) => ids.some((x) => String(x) === String(id));
    if (layer === 'parking') {
      const hit = data.parking.data?.sites.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'roadworks') {
      const hit = data.roadworks.data?.items.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'events') {
      const hit = data.events.data?.events.find((x) => has(x.id));
      return hit?.lon != null && hit.lat != null ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'places') {
      const hit = data.places.data?.places.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'umland') {
      const hit = data.umland.data?.items.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'air') {
      const hit = data.air.data?.stations.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'sharing') {
      const hit = data.sharing.data?.items.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'nearby') {
      const hit = nearby?.items.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'unfall') {
      const hit = data.unfaelle.data?.items.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    if (layer === 'live') {
      const hit = live?.find((x) => has(x.id));
      return hit ? [hit.lon, hit.lat] : null;
    }
    return null;
  };

  /**
   * Der Action Bus. Das Modell sendet Absichten, hier werden sie validiert und ausgeführt.
   * Jede Aktion bekommt eine Quittung; der Snapshot davor macht sie rückgängig.
   */
  const handleBotAction = (incoming: BotUiAction): BotReceipt => {
    const action = validateBotAction(incoming);
    if (!action) {
      return { actionId: newBotActionId(), status: 'error', label: 'Aktion nicht möglich', message: 'Ungültige Kartenaktion.', undoable: false };
    }
    const id = newBotActionId();
    const snap = takeBotSnapshot();
    try {
      switch (action.type) {
        case 'open_module': {
          setModuleId(action.module);
          setFocus(action.focus ?? null);
          setAnliegenId(action.anliegen ?? null);
          setSelection(null);
          if (mobile) setSheet(action.module === 'route' ? 'peek' : 'open');
          break;
        }
        case 'close_module':
          backToStart();
          break;
        case 'set_layer':
          setVisible((v) => ({ ...v, [action.key]: action.on }));
          break;
        case 'set_layers':
          setVisible((v) => {
            const next = { ...v };
            if (action.only) {
              for (const k of Object.keys(next) as OverlayKey[]) next[k] = false;
            }
            for (const k of action.on) next[k] = true;
            for (const k of action.off ?? []) next[k] = false;
            return next;
          });
          break;
        case 'show_nearby': {
          setVisible((v) => ({ ...v, nearby: true }));
          setNearby({ items: action.items as Facility[], color: action.color ?? {} });
          if (action.items.length === 1 || action.fit === false) {
            const first = action.items[0];
            mapRef.current?.flyTo([first.lon, first.lat], 15.5);
          } else {
            const lons = action.items.map((x) => x.lon);
            const lats = action.items.map((x) => x.lat);
            mapRef.current?.fitBounds(
              [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
              { maxZoom: 15.5 },
            );
          }
          break;
        }
        case 'clear_nearby':
          setNearby(null);
          break;
        case 'fly_to':
          if (!mapRef.current) throw new Error('Karte ist noch nicht bereit.');
          mapRef.current.flyTo([action.lon, action.lat], action.zoom ?? 15);
          break;
        case 'fit_bounds':
          if (!mapRef.current) throw new Error('Karte ist noch nicht bereit.');
          mapRef.current.fitBounds(
            [[action.bbox[0], action.bbox[1]], [action.bbox[2], action.bbox[3]]],
            { maxZoom: action.maxZoom ?? 16 },
          );
          break;
        case 'select':
          if (!selectionExists(action.selection)) throw new Error('Das Objekt ist nicht mehr in den Daten.');
          select(action.selection);
          break;
        case 'clear_selection':
          setSelection(null);
          break;
        case 'show_route':
          planRoute({
            ...action.to,
            ...(action.from ? { from: action.from } : {}),
            ...(action.mode ? { mode: action.mode } : {}),
            ...(action.profile ? { profile: action.profile } : {}),
          });
          break;
        case 'clear_route':
          setRouteTarget(null);
          setRouteGeo(null);
          break;
        case 'search':
          searchRef.current?.open(action.query);
          break;
        case 'open_document':
          setDocId(action.id);
          break;
        case 'open_info':
          setInfo({ page: action.page as InfoPage, anchor: action.anchor });
          break;
        case 'module_command':
          setModuleCommand({ id, module: action.module, command: action.command, args: action.args });
          if (moduleId !== action.module) {
            setModuleId(action.module);
            setSelection(null);
          }
          break;
        case 'set_theme':
          setTheme(action.theme);
          break;
        case 'set_terrain':
          setTerrain(action.on);
          break;
        case 'set_aerial':
          setVisible((v) => ({ ...v, aerial: action.on }));
          if (action.year && AERIAL_YEARS.includes(action.year)) {
            setAerial((a) => ({ ...a, year: action.year! }));
          }
          break;
        case 'play_radar':
          setVisible((v) => ({ ...v, radar: action.play !== false }));
          if (action.play !== false) {
            setRadarFrame(action.frame === 'now' || action.frame == null ? null : Math.max(0, Math.min(200, Math.round(action.frame))));
          }
          break;
        case 'set_sheet':
          setSheet(action.level);
          break;
        case 'highlight': {
          setVisible((v) => ({ ...v, [action.layer]: true }));
          const point = highlightPoint(action.layer, action.ids);
          if (point && mapRef.current) {
            mapRef.current.flyTo(point, 15.5);
            setLocateMsg(`Hervorgehoben: ${action.ids.length} Objekt${action.ids.length === 1 ? '' : 'e'}.`);
          } else {
            setLocateMsg('Zum Hervorheben ist kein Objekt in den geladenen Daten.');
          }
          break;
        }
        case 'toast':
          setLocateMsg(action.text);
          break;
      }
      rememberUndo(id, snap);
      botActionLog.current = [...botActionLog.current, action.type].slice(-12);
      const label = action.type === 'open_module'
        ? `${MODULES.find((m) => m.id === action.module)?.label ?? 'Bereich'} geöffnet`
        : actionLabel(action);
      return { actionId: id, status: 'ok', label, undoable: action.type !== 'toast' };
    } catch (err) {
      return {
        actionId: id,
        status: 'error',
        label: 'Aktion fehlgeschlagen',
        message: (err as Error).message,
        undoable: false,
      };
    }
  };

  const getBotContext = (): BotContext => {
    const view = mapRef.current?.getView();
    const mapCenter = view?.center ?? center;
    const bbox = view?.bbox ?? [mapCenter[0] - 0.02, mapCenter[1] - 0.02, mapCenter[0] + 0.02, mapCenter[1] + 0.02];
    const selectionName = selection && 'name' in selection && typeof selection.name === 'string'
      ? selection.name
      : selection?.type === 'facility' ? selection.item.name : undefined;
    return {
      module: moduleId,
      focus,
      anliegen: anliegenId,
      selection: selection ? {
        type: selection.type,
        ...('id' in selection ? { id: String(selection.id) } : {}),
        ...(selectionName ? { name: selectionName } : {}),
      } : null,
      center: [mapCenter[0], mapCenter[1]],
      zoom: view?.zoom ?? 14,
      bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
      layers: (Object.keys(visible) as OverlayKey[]).filter((k) => visible[k]),
      route: routeTarget ? {
        ...(routeTarget.from ? { from: routeTarget.from } : {}),
        to: { lat: routeTarget.lat, lon: routeTarget.lon, label: routeTarget.label },
        ...(routeTarget.mode ? { mode: routeTarget.mode } : {}),
        active: !!routeGeo,
      } : null,
      theme,
      locale: lang === 'en' ? 'en' : 'de',
      localTime: new Date().toISOString(),
      location: readBotLocation(),
      lastActions: [...botActionLog.current],
    };
  };

  // Beim Wechsel des Themas beginnt das Panel wieder oben. Sonst landet man nach
  // einem Modulwechsel mitten im vorherigen Inhalt.
  useEffect(() => {
    panelScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [moduleId, focus, anliegenId]);

  // Auf kleinen Desktops weicht das Panel dem Detail (siehe design-pass.css).
  const mapData = useMemo(() => ({
    parking: data.parking.data?.sites ?? null,
    sharing: data.sharing.data?.items ?? null,
    roadworks: data.roadworks.data?.items ?? null,
    air: data.air.data?.stations ?? null,
    water: data.water.data ?? null,
    bike: data.bike.data ?? null,
    events: data.events.data?.events ?? null,
    bartouren: data.bartouren.data?.items ?? null,
    places: data.places.data?.places ?? null,
    umland: data.umland.data?.items ?? null,
    sunImage,
    radarImage: radarImg,
    nearby,
    live,
    route: routeGeo,
    traffic: data.traffic.data?.items ?? null,
    warnungen: data.warnungen.data?.items ?? null,
    flug: data.flug.data?.aircraft ?? null,
    kaltluft: data.kaltluft.data?.punkte ?? null,
    unfall: data.unfaelle.data?.items ?? null,
    wanderwege: data.wanderwege.data?.items ?? null,
    wissen,
    spiel: spielGeo,
  }), [data.traffic.data, sunImage, radarImg, nearby, live, routeGeo, spielGeo, data.parking.data, data.sharing.data, data.roadworks.data, data.air.data, data.water.data, data.bike.data, data.events.data, data.bartouren.data, data.places.data, data.umland.data, data.warnungen.data, data.flug.data, data.kaltluft.data, data.unfaelle.data, data.wanderwege.data, wissen]);

  const showDetail = !!selection;
  const kiosk = new URLSearchParams(location.search).get('display') === 'kiosk';
  if (kiosk) return <Kiosk />;

  return (
    <InfoProvider open={openInfo}>
    <RouteProvider plan={planRoute}>
    <div className={`app ${mobile ? 'is-mobile' : ''} ${mod ? 'has-module' : ''} sheet-${sheet} ${showDetail ? 'has-detail' : ''} ${botOpen ? 'bot-open' : ''}`}>
      <MapView
        ref={mapRef}
        theme={theme}
        visible={visible}
        data={mapData}
        selection={selection}
        selectedPoint={selectedPoint}
        terrain={terrain}
        onSelect={select}
        onReady={() => setReady(true)}
        onMove={setCenter}
        aerial={aerial}
        padding={padding}
        detailPadding={detailPadding}
      />
      {!ready && (
        <div className="map-loading" role="status" aria-live="polite">
          <span className="map-loading-spinner" aria-hidden />
          <p>Karte wird geladen …</p>
        </div>
      )}
      <a className="skip-link" href="#panel-content">{tr('Zum Inhalt springen')}</a>

      <QuickActions
        active={anliegenId}
        onPick={(a) => { setAnliegenId(a.id); openAnliegen(a); }}
        onBot={() => { setBotOpen(true); setSelection(null); }}
        onContacts={() => { setKontaktOpen(true); setSelection(null); }}
      />

      <aside className={`panel ${mod ? 'has-module' : ''}`} aria-label="Themen und Ebenen">
        {mobile && (
          <button
            type="button"
            className="sheet-handle"
            aria-label={sheet === 'mini' ? 'Bereich öffnen' : sheet === 'peek' ? 'Bereich vergrößern' : 'Bereich verkleinern'}
            aria-controls="panel-content"
            title="Ziehen oder tippen, um den Bereich zu vergrößern oder zu verkleinern"
            onPointerDown={(e) => {
              sheetDrag.current = { startY: e.clientY, moved: false };
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!sheetDrag.current) return;
              if (Math.abs(e.clientY - sheetDrag.current.startY) > 8) sheetDrag.current.moved = true;
            }}
            onPointerUp={(e) => {
              const drag = sheetDrag.current;
              sheetDrag.current = null;
              if (!drag?.moved) return;
              suppressSheetClick.current = true;
              window.setTimeout(() => { suppressSheetClick.current = false; }, 400);
              const dy = e.clientY - drag.startY;
              if (dy > 36) setSheet((s) => (dy > 150 ? 'mini' : s === 'open' ? 'peek' : 'mini'));
              else if (dy < -36) setSheet((s) => (dy < -150 ? 'open' : s === 'mini' ? 'peek' : 'open'));
            }}
            onPointerCancel={() => { sheetDrag.current = null; }}
            onClick={() => {
              if (suppressSheetClick.current) { suppressSheetClick.current = false; return; }
              cycleSheet();
            }}
          ><span /></button>
        )}
        <header
          className="brand"
          onPointerDown={startPageDrag('sheet')}
          onPointerMove={movePageDrag}
          onPointerUp={endPageDrag}
          onPointerCancel={() => { pageDrag.current = null; }}
        >
          <div className="brand-row">
            <img className="brand-logo" src="/logo.svg" alt="" width="40" height="40" />
            <div className="brand-text">
              <h1><em>Open</em> Stuttgart</h1>
              <p>{tr('Offene Daten der Landeshauptstadt auf einer Karte')}</p>
            </div>
            {w && (
              <button
                type="button"
                className="brand-weather"
                onClick={() => openModule('environment', 'wetter', 'wetter')}
                aria-label={`Wetter ${fmtDec(w.temperature)} Grad, Luftqualität und Vorhersage`}
                title="Wetter und Luftqualität"
              >
                <Icon name={weatherIconName(w.icon)} size={17} />
                <strong>{fmtDec(w.temperature)}°</strong>
              </button>
            )}
          </div>
        </header>

        <div className="panel-scroll" id="panel-content" tabIndex={-1} ref={panelScrollRef}>
          {mod ? (
            <>
              <div
                className="panel-crumb"
                onPointerDown={startPageDrag('module')}
                onPointerMove={movePageDrag}
                onPointerUp={endPageDrag}
                onPointerCancel={() => { pageDrag.current = null; }}
              >
                <button type="button" className="crumb-back" onClick={backToStart}>
                  <Icon name="chevron" size={15} className="chev-left" />
                  <span>{tr('Einstieg')}</span>
                </button>
                <div className="crumb-titles">
                  <h2 className="crumb-title">{tr(activeAnliegen?.label ?? mod.label)}</h2>
                  {activeAnliegen && activeAnliegen.module !== mod.id && <span className="crumb-context">{tr(mod.label)}</span>}
                </div>
              </div>
              <mod.Panel focus={focus ?? undefined} visible={visible} toggle={toggle} select={select} flyTo={flyTo} fitBounds={fitBounds} setLayer={setLayer} center={center} setSunImage={setSunImage} radarFrame={radarFrame} setRadarFrame={setRadarFrame} setNearby={setNearby} setWissen={setWissen} setSpiel={setSpielGeo} setRoute={setRouteGeo} routeTarget={routeTarget} botCommand={moduleCommand} />
            </>
          ) : (
            <StartPanel onModule={(id) => openModule(id)} />
          )}
          <Disclosure label="Über diese Anwendung" defaultOpen={false} count={6}>
            <nav className="about-links" aria-label="Über diese Anwendung">
              <button type="button" onClick={() => openInfo('grundsaetze')}>{tr('Grundsätze')}</button>
              <button type="button" onClick={() => openInfo('werte')}>{tr('Wie entstehen die Werte?')}</button>
              <button type="button" onClick={() => openInfo('daten')}>{tr('Offene Daten')}</button>
              <button type="button" onClick={() => openInfo('barrierefreiheit')}>{tr('Barrierefreiheit')}</button>
              <button type="button" onClick={() => openInfo('leicht')}>{tr('Leichte Sprache')}</button>
              {LANGS.filter((l) => l.id !== lang).map((l) => (
                <button key={l.id} type="button" lang={l.id} onClick={() => setLang(l.id)}>{l.label}</button>
              ))}
            </nav>
          </Disclosure>
        </div>
      </aside>

      {!mobile && <BigEventBanner select={select} flyTo={flyTo} />}
      <div className="status-cluster">
        {w && (
          <button type="button" className="status-pill" title="Wetter und Vorhersage" onClick={() => openModule('environment', 'wetter', 'wetter')} aria-label={`Wetter ${fmtDec(w.temperature)} Grad, Details anzeigen`}>
            <Icon name={weatherIconName(w.icon)} size={18} />
            <strong>{fmtDec(w.temperature)}°</strong>
          </button>
        )}
        {airWorst != null && (
          <button type="button" className="status-pill" title="Luftqualität" onClick={() => openModule('environment', 'wetter', 'wetter')} aria-label={`Luftqualität ${AIR_LABEL[airWorst]}, Details anzeigen`}>
            <span className="dot" style={{ background: AIR_COLOR[airWorst] }} />
            <span>Luft {AIR_LABEL[airWorst]}</span>
          </button>
        )}
      </div>

      <div className="map-controls" role="group" aria-label="Kartensteuerung">
        <button type="button" className="ctrl ctrl--locate" data-tip="Mein Standort" onClick={locateMe} aria-label="Mein Standort anzeigen" title="Mein Standort">
          <Icon name="locate" />
        </button>
        <span className="ctrl-gap" />
        <button type="button" className="ctrl" data-tip="Hineinzoomen" onClick={() => mapRef.current?.zoomBy(1)} aria-label="Hineinzoomen"><Icon name="plus" /></button>
        <button type="button" className="ctrl" data-tip="Herauszoomen" onClick={() => mapRef.current?.zoomBy(-1)} aria-label="Herauszoomen"><Icon name="minus" /></button>
        <span className="ctrl-gap" />
        <button type="button" className={`ctrl ${layersOpen ? 'on' : ''}`} data-tip="Kartenebenen" onClick={() => setLayersOpen((v) => !v)} aria-pressed={layersOpen} aria-label="Kartenebenen" title="Ebenen">
          <Icon name="layers" />
        </button>
        <button type="button" className={`ctrl ctrl--3d ${terrain ? 'on' : ''}`} data-tip="3D-Gelände" onClick={() => setTerrain((t) => !t)} aria-pressed={terrain} aria-label="3D-Ansicht mit Gelände" title="3D-Gelände">
          <span className="ctrl-txt">3D</span>
        </button>
        <button type="button" className={`ctrl ctrl--aerial ${visible.aerial ? 'on' : ''}`} data-tip="Luftbilder" onClick={() => toggle('aerial')} aria-pressed={visible.aerial} aria-label="Luftbilder 2006 bis 2025" title="Luftbilder">
          <Icon name="image" />
        </button>
        <button type="button" className="ctrl ctrl--compass" data-tip="Nach Norden" onClick={() => mapRef.current?.resetNorth()} aria-label="Nach Norden ausrichten"><Icon name="compass" /></button>
        <span className="ctrl-gap ctrl-gap--theme" />
        <button type="button" className="ctrl ctrl--theme" data-tip={theme === 'dark' ? 'Helle Ansicht' : 'Dunkle Ansicht'} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? 'Helle Ansicht' : 'Dunkle Ansicht'}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>

      {visible.aerial && (
        <div className="aerial-card" role="group" aria-label="Luftbild">
          <div className="aerial-head">
            <strong>Luftbild {aerial.year}</strong>
            <span className="muted small">Stadtmessungsamt, ab Zoomstufe 13</span>
            <button type="button" className="icon-btn ghost" onClick={() => toggle('aerial')} aria-label="Luftbild ausblenden"><Icon name="close" size={18} /></button>
          </div>
          <div className="aerial-years" role="tablist" aria-label="Jahrgang">
            {AERIAL_YEARS.map((y) => (
              <button key={y} type="button" role="tab" aria-selected={y === aerial.year} className={y === aerial.year ? 'active' : ''} onClick={() => setAerial((a) => ({ ...a, year: y }))}>{y}</button>
            ))}
          </div>
          <label className="aerial-opacity">
            <span className="muted small">Deckkraft</span>
            <input type="range" min={0} max={1} step={0.05} value={aerial.opacity} onChange={(e) => setAerial((a) => ({ ...a, opacity: Number(e.target.value) }))} />
          </label>
        </div>
      )}

      {showDetail && (
        <aside
          className="detail"
          aria-label="Details"
          aria-labelledby="detail-title"
          onPointerDown={startPageDrag('detail')}
          onPointerMove={movePageDrag}
          onPointerUp={endPageDrag}
          onPointerCancel={() => { pageDrag.current = null; }}
        >
          <div className="mobile-grab" aria-hidden />
          <button
            type="button"
            className="detail-share"
            aria-label="Link zu diesem Objekt kopieren"
            title="Link zu diesem Objekt kopieren"
            onClick={() => {
              const url = objectUrl(selection!);
              navigator.clipboard?.writeText(url)
                .then(() => setLocateMsg('Link kopiert'))
                .catch(() => setLocateMsg(url));
            }}
          >
            <Icon name="share" size={17} />
          </button>
          <DetailSheet sel={selection!} onClose={() => setSelection(null)} select={select} flyTo={flyTo} />
        </aside>
      )}
      {info && <InfoPages page={info.page} anchor={info.anchor} onPage={(page) => setInfo({ page })} onClose={() => setInfo(null)} />}
      <DocumentReader id={docId} onClose={() => setDocId(null)} onShowOnMap={showKontaktOnMap} />
      <KontaktSheet
        open={kontaktOpen}
        onClose={() => setKontaktOpen(false)}
        onOpenDocument={(id) => { setKontaktOpen(false); setDocId(id); }}
        onShowOnMap={showKontaktOnMap}
      />
      <Search
        ref={searchRef}
        onPickStop={(s) => {
          const c = s.geometry.coordinates as [number, number];
          select({ type: 'stop', id: s.properties.id, name: s.properties.name, lngLat: c, lines: s.properties.lines });
          flyTo(c, 15);
        }}
        onOpenDocument={(id) => setDocId(id)}
        onRoute={() => { setAnliegenId('anreise'); openModule('route', 'route', 'anreise'); }}
        onVoice={() => { setBotOpen(true); setBotVoiceRequest((n) => n + 1); }}
      />
      <LayerSheet open={layersOpen} onClose={() => setLayersOpen(false)} visible={visible} toggle={toggle} theme={theme} onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} terrain={terrain} onTerrain={() => setTerrain((t) => !t)} onResetNorth={() => mapRef.current?.resetNorth()} />
      <StuttBot
        open={botOpen}
        onClose={() => setBotOpen(false)}
        onMap={(lngLat, _name, id) => {
          setVisible((v) => (v.nearby ? v : { ...v, nearby: true }));
          flyTo(lngLat, 16);
          if (id) select({ type: 'verwaltung_gebaeude', id, lngLat });
        }}
        onAction={handleBotAction}
        onUndo={undoBotAction}
        getContext={getBotContext}
        voiceRequest={botVoiceRequest}
        locale={lang === 'en' ? 'en' : 'de'}
      />
      {locateMsg && (
        <div className="app-toast" role="status">
          <Icon name="locate" size={18} />
          <span>{locateMsg}</span>
          <button type="button" className="icon-btn ghost" aria-label="Hinweis schließen" onClick={() => setLocateMsg(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
    </RouteProvider>
    </InfoProvider>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
