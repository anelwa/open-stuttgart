import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MapView, type MapData, type MapHandle } from './map/MapView';
import type { Theme } from './map/mapStyle';
import { AERIAL_YEARS, type OverlayKey } from './map/overlays';
import { MODULES } from './modules';
import { DataProvider, useData } from './lib/data';
import type { Selection } from './lib/types';
import { Icon, weatherIconName } from './components/Icon';
import { Search } from './components/Search';
import { DocumentReader } from './components/DocumentReader';
import { DetailSheet } from './components/Details';
import { BigEventBanner } from './components/BigEvent';
import { AIR_COLOR, AIR_LABEL, fmtDec } from './lib/format';
import { loadStops } from './lib/stops';
import { nowFrame, radarCoords, radarImage } from './lib/rain';
import { InfoProvider, type InfoPage } from './lib/info';
import { useLive } from './lib/live';
import { RouteProvider, type Place as RoutePlace } from './lib/routeCtx';
import { LANGS, setLang, tr, useLang } from './lib/i18n';
import { InfoPages } from './components/InfoPages';
import { LayerSheet } from './components/LayerSheet';
import { StartPanel } from './components/StartPanel';
import { QuickActions } from './components/QuickActions';
import { ANLIEGEN, type Anliegen } from './lib/anliegen';
import { Disclosure } from './components/ui';
import { StuttBot } from './components/StuttBot';

const DEFAULT_VISIBLE: Record<OverlayKey, boolean> = {
  network: true, stops: true, parking: true, sharing: false, roadworks: true, bike: false, air: true, water: true, events: true, places: true, sun: false, radar: true, aerial: false, nearby: true, live: true, route: true, vehicles: true, traffic: false, warnung: true, flug: false, kaltluft: false, unfall: false, hike: false,
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
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const mobile = useMedia('(max-width: 900px)');
  const compact = useMedia('(max-width: 1180px)');
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
  const [sunImage, setSunImage] = useState<string | null>(null);
  const [radarFrame, setRadarFrame] = useState<number | null>(null);
  const [nearby, setNearby] = useState<MapData['nearby']>(null);
  const [info, setInfo] = useState<{ page: InfoPage; anchor?: string } | null>(null);
  const [docId, setDocId] = useState<number | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
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
    }
  }, [selection, data]);

  const select = useCallback((s: Selection | null) => {
    setSelection(s);
    if (s && mobile) setSheet('peek');
  }, [mobile]);

  const sheetDrag = useRef<{ startY: number; moved: boolean } | null>(null);
  const pageDrag = useRef<{ mode: 'sheet' | 'module' | 'detail'; startY: number; moved: boolean } | null>(null);
  const suppressSheetClick = useRef(false);
  const cycleSheet = useCallback(() => {
    setSheet((s) => (s === 'mini' ? 'peek' : s === 'peek' ? 'open' : 'mini'));
  }, []);

  const backToStart = useCallback(() => {
    setModuleId(null);
    setFocus(null);
    setAnliegenId(null);
    setSelection(null);
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
    if (drag.mode === 'module' && dy > 70) { backToStart(); return; }
    if (drag.mode === 'sheet') {
      if (dy > 36) setSheet((s) => (dy > 120 ? 'mini' : s === 'open' ? 'peek' : 'mini'));
      else if (dy < -36) setSheet((s) => (dy < -120 ? 'open' : s === 'mini' ? 'peek' : 'open'));
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
  const [routeTarget, setRouteTarget] = useState<RoutePlace | null>(null);
  const activeAnliegen = useMemo(() => ANLIEGEN.find((a) => a.id === anliegenId) ?? null, [anliegenId]);

  const planRoute = useCallback((p: RoutePlace) => {
    setRouteTarget(p); setModuleId('route'); setFocus('route'); setAnliegenId('anreise');
    setSelection(null); if (mobile) setSheet('peek');
  }, [mobile]);

  /** Ein Anliegen öffnet das zuständige Panel, schaltet die passenden Ebenen zu und setzt den Fokus. */
  const openAnliegen = useCallback((a: Anliegen) => {
    setModuleId(a.module);
    setFocus(a.focus);
    setAnliegenId(a.id);
    setSelection(null);
    setVisible((v) => {
      const next = { ...v };
      for (const k of a.layers) next[k] = true;
      return next;
    });
    if (mobile) setSheet('open');
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
    // Beim Weg bleibt mehr Karte sichtbar: Die Route soll beim Öffnen direkt erkennbar sein.
    if (mobile) setSheet(id === 'route' ? 'peek' : 'open');
  }, [mobile]);

  // Beim Wechsel des Themas beginnt das Panel wieder oben. Sonst landet man nach
  // einem Modulwechsel mitten im vorherigen Inhalt.
  useEffect(() => {
    panelScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [moduleId, focus, anliegenId]);

  // Auf kleinen Desktops weicht das Panel dem Detail (siehe design-pass.css).
  const lang = useLang();
  const mapData = useMemo(() => ({
    parking: data.parking.data?.sites ?? null,
    sharing: data.sharing.data?.items ?? null,
    roadworks: data.roadworks.data?.items ?? null,
    air: data.air.data?.stations ?? null,
    water: data.water.data ?? null,
    bike: data.bike.data ?? null,
    events: data.events.data?.events ?? null,
    places: data.places.data?.places ?? null,
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
  }), [data.traffic.data, sunImage, radarImg, nearby, live, routeGeo, data.parking.data, data.sharing.data, data.roadworks.data, data.air.data, data.water.data, data.bike.data, data.events.data, data.places.data, data.warnungen.data, data.flug.data, data.kaltluft.data, data.unfaelle.data, data.wanderwege.data]);

  const showDetail = !!selection;

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
              <mod.Panel focus={focus ?? undefined} visible={visible} toggle={toggle} select={select} flyTo={flyTo} fitBounds={fitBounds} setLayer={setLayer} center={center} setSunImage={setSunImage} radarFrame={radarFrame} setRadarFrame={setRadarFrame} setNearby={setNearby} setRoute={setRouteGeo} routeTarget={routeTarget} />
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
          <DetailSheet sel={selection!} onClose={() => setSelection(null)} select={select} flyTo={flyTo} />
        </aside>
      )}
      {info && <InfoPages page={info.page} anchor={info.anchor} onPage={(page) => setInfo({ page })} onClose={() => setInfo(null)} />}
      <DocumentReader id={docId} onClose={() => setDocId(null)} />
      <Search
        onPickStop={(s) => {
          const c = s.geometry.coordinates as [number, number];
          select({ type: 'stop', id: s.properties.id, name: s.properties.name, lngLat: c, lines: s.properties.lines });
          flyTo(c, 15);
        }}
        onOpenDocument={(id) => setDocId(id)}
        onRoute={() => { setAnliegenId('anreise'); openModule('route', 'route', 'anreise'); }}
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
