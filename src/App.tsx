import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle } from './map/MapView';
import type { Theme } from './map/mapStyle';
import { AERIAL_YEARS, type OverlayKey } from './map/overlays';
import { MODULES } from './modules';
import { DataProvider, useData } from './lib/data';
import type { Selection } from './lib/types';
import { Icon, weatherIconName } from './components/Icon';
import { Search } from './components/Search';
import { DetailSheet } from './components/Details';
import { BigEventBanner } from './components/BigEvent';
import { AIR_COLOR, AIR_LABEL, fmtDec } from './lib/format';
import { loadStops } from './lib/stops';
import { nowFrame, radarCoords, radarImage } from './lib/rain';

const DEFAULT_VISIBLE: Record<OverlayKey, boolean> = {
  network: true, stops: true, parking: true, sharing: false, roadworks: true, bike: false, air: true, water: true, events: true, places: true, sun: false, radar: true, aerial: false,
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
  const mobile = useMedia('(max-width: 760px)');
  const [theme, setTheme] = useState<Theme>(() => readPref('theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [moduleId, setModuleId] = useState(() => readPref('module', 'mobility'));
  const [visible, setVisible] = useState<Record<OverlayKey, boolean>>(() => ({ ...DEFAULT_VISIBLE, ...readPref('layers', {}) }));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [terrain, setTerrain] = useState(false);
  const [sheet, setSheet] = useState<'peek' | 'open'>('peek');
  const [ready, setReady] = useState(false);
  const [center, setCenter] = useState<[number, number]>([9.18, 48.779]);
  const [sunImage, setSunImage] = useState<string | null>(null);
  const [radarFrame, setRadarFrame] = useState<number | null>(null);
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
  useEffect(() => writePref('module', moduleId), [moduleId]);
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
      case 'place': { const p = data.places.data?.places.find((x) => x.id === selection.id); return p ? [p.lon, p.lat] : null; }
    }
  }, [selection, data]);

  const select = useCallback((s: Selection | null) => {
    setSelection(s);
    if (s && mobile) setSheet('peek');
  }, [mobile]);

  const detailPadding = useMemo(() => mobile
    ? { left: 0, right: 0, bottom: Math.round(window.innerHeight * 0.6) }
    : { left: 440, right: 440, bottom: 0 }, [mobile]);
  const padding = useMemo(() => selection ? detailPadding : mobile
    ? { left: 0, right: 0, bottom: Math.round(window.innerHeight * 0.45) }
    : { left: 440, right: 0, bottom: 0 }, [mobile, selection, detailPadding]);

  const flyTo = useCallback((c: [number, number], z?: number) => mapRef.current?.flyTo(c, z), []);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelection(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mod = MODULES.find((m) => m.id === moduleId) ?? MODULES[0];
  const w = data.weather.data;
  const airWorst = (data.air.data?.stations ?? []).reduce<number | null>((m, s) => (s.index == null ? m : m == null || s.index > m ? s.index : m), null);

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
  }), [sunImage, radarImg, data.parking.data, data.sharing.data, data.roadworks.data, data.air.data, data.water.data, data.bike.data, data.events.data, data.places.data]);

  const showDetail = !!selection;

  return (
    <div className={`app ${mobile ? 'is-mobile' : ''} sheet-${sheet} ${showDetail ? 'has-detail' : ''}`}>
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
      {!ready && <div className="map-loading" aria-hidden><span /></div>}

      <aside className="panel" aria-label="Themen und Ebenen">
        {mobile && (
          <button type="button" className="sheet-handle" aria-label={sheet === 'open' ? 'Bereich verkleinern' : 'Bereich vergrößern'}
            onClick={() => setSheet((s) => (s === 'open' ? 'peek' : 'open'))}><span /></button>
        )}
        <header className="brand">
          <div className="brand-row">
            <img className="brand-logo" src="/logo.svg" alt="" width="40" height="40" />
            <div className="brand-text">
              <h1><em>Open</em> Stuttgart</h1>
              <p>Offene Daten der Landeshauptstadt auf einer Karte</p>
            </div>
            <span className="demo-tag">Demo</span>
          </div>
          <Search onPick={(s) => {
            const c = s.geometry.coordinates as [number, number];
            select({ type: 'stop', id: s.properties.id, name: s.properties.name, lngLat: c, lines: s.properties.lines });
            flyTo(c, 15);
          }} />
        </header>

        <nav className="module-tabs" role="tablist" aria-label="Themen">
          {MODULES.map((m) => (
            <button key={m.id} role="tab" type="button" aria-selected={m.id === mod.id} className={m.id === mod.id ? 'active' : ''}
              onClick={() => { setModuleId(m.id); if (mobile) setSheet('open'); }}>
              <Icon name={m.icon} size={18} />
              <span>{m.label}</span>
              {m.status === 'soon' && <small className="soon">bald</small>}
            </button>
          ))}
        </nav>

        <div className="panel-scroll">
          <mod.Panel visible={visible} toggle={toggle} select={select} flyTo={flyTo} setLayer={setLayer} center={center} setSunImage={setSunImage} radarFrame={radarFrame} setRadarFrame={setRadarFrame} />
        </div>
      </aside>

      {!mobile && <BigEventBanner select={select} flyTo={flyTo} />}
      <div className="status-cluster">
        {w && (
          <button type="button" className="status-pill" onClick={() => setModuleId('environment')} aria-label={`Wetter ${fmtDec(w.temperature)} Grad, Details anzeigen`}>
            <Icon name={weatherIconName(w.icon)} size={18} />
            <strong>{fmtDec(w.temperature)}°</strong>
          </button>
        )}
        {airWorst != null && (
          <button type="button" className="status-pill" onClick={() => setModuleId('environment')} aria-label={`Luftqualität ${AIR_LABEL[airWorst]}`}>
            <span className="dot" style={{ background: AIR_COLOR[airWorst] }} />
            <span>Luft {AIR_LABEL[airWorst]}</span>
          </button>
        )}
      </div>

      <div className="map-controls" role="group" aria-label="Kartensteuerung">
        <button type="button" className="ctrl" onClick={() => mapRef.current?.zoomBy(1)} aria-label="Hineinzoomen"><Icon name="plus" /></button>
        <button type="button" className="ctrl" onClick={() => mapRef.current?.zoomBy(-1)} aria-label="Herauszoomen"><Icon name="minus" /></button>
        <span className="ctrl-gap" />
        <button type="button" className={`ctrl ${terrain ? 'on' : ''}`} onClick={() => setTerrain((t) => !t)} aria-pressed={terrain} aria-label="3D-Ansicht mit Gelände" title="3D-Gelände">
          <span className="ctrl-txt">3D</span>
        </button>
        <button type="button" className={`ctrl ${visible.aerial ? 'on' : ''}`} onClick={() => toggle('aerial')} aria-pressed={visible.aerial} aria-label="Luftbilder 2006 bis 2025" title="Luftbilder">
          <Icon name="image" />
        </button>
        <button type="button" className="ctrl" onClick={() => mapRef.current?.resetNorth()} aria-label="Nach Norden ausrichten"><Icon name="compass" /></button>
        <button type="button" className="ctrl" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? 'Helle Ansicht' : 'Dunkle Ansicht'}>
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
        <aside className="detail" aria-label="Details" aria-live="polite">
          <DetailSheet sel={selection!} onClose={() => setSelection(null)} select={select} flyTo={flyTo} />
        </aside>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
