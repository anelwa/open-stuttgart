import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MlMap, GeoJSONSource, ImageSource, RasterTileSource, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { buildStyle, type Theme } from './mapStyle';
import { BLANK_PNG, aerialTiles, addOverlays, setOverlayVisibility, INTERACTIVE_LAYERS, OVERLAY_LAYERS, type OverlayKey } from './overlays';
import { registerIcons } from './icons';
import { getVehicleTrips, subscribeVehicles, vehiclePaths, vehiclePositions } from '../lib/vehicles';
import { fmtTime, occupancy } from '../lib/format';
import type { AirStation, Bartour, CultureEvent, Facility, Flugzeug, KaltluftPunkt, NinaWarnung, ParkingSite, Place, Roadwork, Selection, SharingItem, TrafficItem, Unfall, Wanderweg, Water } from '../lib/types';

export interface MapData {
  parking: ParkingSite[] | null;
  sharing: SharingItem[] | null;
  roadworks: Roadwork[] | null;
  air: AirStation[] | null;
  water: Water | null;
  bike: GeoJSON.FeatureCollection | null;
  events: CultureEvent[] | null;
  bartouren: Bartour[] | null;
  places: Place[] | null;
  sunImage: string | null;
  nearby: { items: Facility[]; color: Record<string, string> } | null;
  live: (Facility & { level: string; short: string })[] | null;
  route: GeoJSON.FeatureCollection | null;
  traffic: TrafficItem[] | null;
  warnungen: NinaWarnung[] | null;
  flug: Flugzeug[] | null;
  kaltluft: KaltluftPunkt[] | null;
  unfall: Unfall[] | null;
  wanderwege: Wanderweg[] | null;
  wissen: GeoJSON.FeatureCollection | null;
  spiel: GeoJSON.FeatureCollection | null;
  radarImage: { url: string; coords: [[number, number], [number, number], [number, number], [number, number]] } | null;
}

export interface MapHandle {
  flyTo: (lngLat: [number, number], zoom?: number) => void;
  fitBounds: (bounds: [[number, number], [number, number]], opts?: { maxZoom?: number }) => void;
  zoomBy: (d: number) => void;
  resetNorth: () => void;
  /** Eigenen Standort als Marker setzen und dorthin fahren. */
  locate: (lngLat: [number, number], zoom?: number) => void;
  /** Aktueller Ausschnitt für den Bot-Kontext. */
  getView: () => { center: [number, number]; zoom: number; bbox: [number, number, number, number] } | null;
  getMap: () => MlMap | null;
}

interface Props {
  theme: Theme;
  visible: Record<OverlayKey, boolean>;
  data: MapData;
  selection: Selection | null;
  selectedPoint: [number, number] | null;
  terrain: boolean;
  onSelect: (s: Selection | null) => void;
  onReady?: () => void;
  onMove?: (center: [number, number]) => void;
  /** Luftbild-Jahrgang und Deckkraft */
  aerial: { year: string; opacity: number };
  /** Aktuell verdeckte Ränder (Seitenleiste, Detailansicht, Bottom Sheet) */
  padding: { left: number; right: number; bottom: number };
  /** Ränder, sobald eine Detailansicht offen ist; Kamerafahrten zu Objekten zielen darauf */
  detailPadding: { left: number; right: number; bottom: number };
}

// Vite kann den dynamisch berechneten Worker-Pfad von MapLibre nicht erkennen, daher explizit setzen.
maplibregl.setWorkerUrl(workerUrl);

const HOME: [number, number] = [9.1800, 48.7790];

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
const pt = (lon: number, lat: number, properties: Record<string, unknown>): GeoJSON.Feature => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties,
});

function toGeo(data: MapData) {
  return {
    parking: fc((data.parking ?? []).map((p) => pt(p.lon, p.lat, {
      id: p.id, name: p.name, occ: occupancy(p.free, p.capacity), ...(p.free != null ? { free: p.free } : {}),
    }))),
    sharing: fc((data.sharing ?? []).map((s) => pt(s.lon, s.lat, {
      id: s.id, kind: s.kind, station: s.station, available: s.available ?? 1, system: s.system, name: s.name ?? '',
    }))),
    roadworks: fc((data.roadworks ?? []).map((r) => pt(r.lon, r.lat, { id: r.id, status: r.status, street: r.street }))),
    air: fc((data.air ?? []).map((a) => pt(a.lon, a.lat, {
      id: a.id, name: a.name, index: a.index ?? -1, label: a.label ?? 'keine aktuellen Werte',
    }))),
    water: fc(data.water ? [pt(data.water.lon, data.water.lat, { value: data.water.value })] : []),
    bike: data.bike ?? fc([]),
    places: fc((data.places ?? []).map((p) => pt(p.lon, p.lat, { id: p.id, name: p.name, kind: p.kind, rank: p.rank }))),
    nearby: fc((data.nearby?.items ?? []).map((f, i) => pt(f.lon, f.lat, { id: f.id, i, name: f.name, closed: !!f.closed, rank: i, color: data.nearby?.color[f.cat] ?? '#26262C' }))),
    events: fc(eventVenues(data.events ?? [])),
    bartouren: fc((data.bartouren ?? []).flatMap((t) => [
      {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: t.stops.map((s) => [s.lon, s.lat]) },
        properties: {
          kind: 'tour', id: t.id, title: t.title, subtitle: t.subtitle,
          color: t.color, durationMin: t.durationMin, distanceM: t.distanceM, stops: t.stopCount,
        },
      },
      ...t.stops.map((s) => pt(s.lon, s.lat, {
        kind: 'stop', tourId: t.id, tourTitle: t.title, stopIndex: s.index,
        name: s.name, address: s.address, role: s.role, color: t.color,
        openingHours: s.openingHours, wheelchair: s.wheelchair, optional: !!s.optional,
        label: `${s.index}. ${s.name}`,
      })),
    ])),
    live: fc((data.live ?? []).map((f, i) => pt(f.lon, f.lat, { i, name: f.name, level: f.level, short: f.short, live: f.live ?? '' }))),
    traffic: fc((data.traffic ?? []).flatMap((t) => {
      const props = { typ: t.typ, text: `${t.typ}: ${t.text}` };
      const p = pt(t.lon, t.lat, props);
      return t.linie ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: t.linie }, properties: props } as GeoJSON.Feature, p] : [p];
    })),
    warnungen: fc((data.warnungen ?? []).flatMap((w) => {
      const props = { title: w.title, severity: w.severity, area: w.area };
      const feats: GeoJSON.Feature[] = w.polygon && w.polygon.length >= 3
        ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [w.polygon] }, properties: props }]
        : [];
      if (w.polygon?.length) {
        const c = w.polygon.reduce((s, p) => [s[0] + p[0] / w.polygon!.length, s[1] + p[1] / w.polygon!.length], [0, 0]);
        feats.push(pt(c[0], c[1], props));
      }
      return feats;
    })),
    flug: fc((data.flug ?? []).map((a) => pt(a.lon, a.lat, {
      callsign: a.callsign ?? a.reg ?? a.type ?? 'Flugzeug', reg: a.reg ?? '', type: a.type ?? '',
      alt: a.altFt ?? 0, heli: a.heli, niedrig: a.niedrig, dist: a.dist,
    }))),
    hike: fc((data.wanderwege ?? []).map((w) => ({
      type: 'Feature', geometry: w.geometrie,
      properties: {
        id: w.id, name: w.name, art: w.artLabel, laenge: w.laengeKm, aufstieg: w.aufstiegM, abstieg: w.abstiegM, farbe: w.farbe,
        text: `${w.name} · ${w.laengeKm.toLocaleString('de-DE')} km${w.aufstiegM != null ? ` · ${w.aufstiegM} m Anstieg` : ''}`,
      },
    }))),
    unfall: fc((data.unfall ?? []).map((u) => pt(u.lon, u.lat, {
      schwere: u.kategorie, rad: u.rad ? 1 : 0, fuss: u.fuss ? 1 : 0, pkw: u.pkw ? 1 : 0,
      jahr: u.jahr, monat: u.monat, stunde: u.stunde, art: u.art, id: u.id,
    }))),
    kaltluft: fc((data.kaltluft ?? []).map((p) => {
      // Kurzes Liniensegment in Strömungsrichtung als Pfeilersatz
      const len = 0.004;
      const rad = ((p.ri ?? 0) * Math.PI) / 180;
      const dLat = Math.cos(rad) * len;
      const dLon = Math.sin(rad) * len / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[p.lon, p.lat], [+(p.lon + dLon).toFixed(5), +(p.lat + dLat).toFixed(5)]] },
        properties: { ge: p.ge ?? 0.1, ri: p.ri },
      } as GeoJSON.Feature;
    })),
  };
}

/** Termine am selben Ort zu einem Punkt bündeln; angezeigt wird der nächste Beginn. */
function eventVenues(events: CultureEvent[]) {
  const now = Date.now();
  const endOf = (e: CultureEvent) => (e.end ? Date.parse(e.end) : Date.parse(e.start!) + 150 * 60_000);
  const groups = new Map<string, CultureEvent[]>();
  for (const e of events) {
    if (e.lat == null || e.lon == null) continue;
    // Vorbei ist vorbei: beendete Termine verschwinden von der Karte
    if (!e.allDay && e.start && endOf(e) < now) continue;
    const k = `${e.lat.toFixed(4)},${e.lon.toFixed(4)}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.values()].map((list) => {
    const timed = list.filter((e) => !e.allDay && e.start).sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!));
    const next = timed.find((e) => Date.parse(e.start!) > now) ?? timed[0] ?? list[0];
    const started = !next.allDay && next.start && Date.parse(next.start) <= now;
    const time = next.allDay || !next.start ? 'ganztägig' : started ? (next.end ? `bis ${fmtTime(next.end)}` : 'läuft') : fmtTime(next.start);
    return pt(next.lon!, next.lat!, {
      id: next.id, title: next.title, allDay: !!next.allDay || !next.start || !!started, count: list.length,
      time: list.length > 1 ? `${time} +${list.length - 1}` : time,
    });
  });
}

export const MapView = forwardRef<MapHandle, Props>(function MapView(props, ref) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const hoverPopup = useRef<maplibregl.Popup | null>(null);
  const sunUrl = useRef<string | null>(null);
  const radarUrl = useRef<string | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);

  useImperativeHandle(ref, () => ({
    flyTo: (lngLat, zoom = 15) => {
      const m = mapRef.current;
      if (!m) return;
      m.flyTo({ center: lngLat, zoom: Math.max(m.getZoom(), zoom), padding: { top: 0, ...propsRef.current.detailPadding }, speed: 1.2, essential: true });
    },
    fitBounds: (bounds, opts) => {
      const m = mapRef.current;
      if (!m) return;
      const w = m.getContainer().clientWidth;
      const p = propsRef.current.padding;
      // Das Panel verdeckt je nach Ansicht einen Teil der Karte. Der Ausschnitt wird in die
      // tatsächlich sichtbare Fläche gelegt, damit Start, Ziel und Verlauf nicht darunter liegen.
      m.fitBounds(bounds, {
        padding: {
          top: 34,
          right: Math.min(p.right ?? 0, Math.round(w * 0.3)),
          bottom: p.bottom ?? 0,
          left: Math.min(p.left ?? 0, Math.round(w * 0.5)),
        },
        maxZoom: opts?.maxZoom ?? 16,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650,
        essential: true,
      });
    },
    zoomBy: (d) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + d, duration: 300 }),
    resetNorth: () => mapRef.current?.easeTo({ bearing: 0, pitch: propsRef.current.terrain ? 55 : 0, duration: 500 }),
    locate: (lngLat, zoom = 15) => {
      const m = mapRef.current;
      if (!m) return;
      if (!userMarker.current) {
        const dot = document.createElement('div');
        dot.className = 'user-location';
        dot.setAttribute('aria-hidden', 'true');
        dot.innerHTML = '<span></span>';
        userMarker.current = new maplibregl.Marker({ element: dot, anchor: 'center' }).setLngLat(lngLat).addTo(m);
      } else {
        userMarker.current.setLngLat(lngLat);
      }
      m.flyTo({
        center: lngLat,
        zoom: Math.max(m.getZoom(), zoom),
        padding: { top: 0, ...propsRef.current.padding },
        speed: 1.1,
        essential: true,
      });
    },
    getView: () => {
      const m = mapRef.current;
      if (!m) return null;
      const c = m.getCenter();
      const b = m.getBounds();
      return {
        center: [c.lng, c.lat],
        zoom: m.getZoom(),
        bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      };
    },
    getMap: () => mapRef.current,
  }));

  // Fahrzeuge: Positionen jede Sekunde neu berechnen, Linienverläufe nur bei neuen Daten
  const pushVehicles = (withPaths = false) => {
    const m = mapRef.current;
    const src = m?.getSource('vehicles') as GeoJSONSource | undefined;
    if (!m || !src) return;
    const list = getVehicleTrips();
    src.setData(vehiclePositions(list));
    if (withPaths) (m.getSource('vehicle-paths') as GeoJSONSource | undefined)?.setData(vehiclePaths(list));
  };
  useEffect(() => {
    const off = subscribeVehicles(() => pushVehicles(true));
    const id = setInterval(() => { if (getVehicleTrips().length) pushVehicles(); }, 1000);
    return () => { off(); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daten in die Quellen schreiben (nach jedem Stilwechsel erneut)
  const pushData = () => {
    const m = mapRef.current;
    if (!m || !m.getSource('parking')) return;
    const g = toGeo(propsRef.current.data);
    (m.getSource('parking') as GeoJSONSource).setData(g.parking);
    (m.getSource('sharing') as GeoJSONSource).setData(g.sharing);
    (m.getSource('roadworks') as GeoJSONSource).setData(g.roadworks);
    (m.getSource('air') as GeoJSONSource).setData(g.air);
    (m.getSource('water') as GeoJSONSource).setData(g.water);
    (m.getSource('bike') as GeoJSONSource).setData(g.bike);
    (m.getSource('places') as GeoJSONSource).setData(g.places);
    (m.getSource('events') as GeoJSONSource).setData(g.events);
    (m.getSource('bartouren') as GeoJSONSource | undefined)?.setData(g.bartouren);
    (m.getSource('nearby') as GeoJSONSource).setData(g.nearby);
    (m.getSource('live') as GeoJSONSource | undefined)?.setData(g.live);
    (m.getSource('route') as GeoJSONSource | undefined)?.setData(propsRef.current.data.route ?? fc([]));
    (m.getSource('traffic') as GeoJSONSource | undefined)?.setData(g.traffic);
    (m.getSource('warnung') as GeoJSONSource | undefined)?.setData(g.warnungen);
    (m.getSource('flug') as GeoJSONSource | undefined)?.setData(g.flug);
    (m.getSource('kaltluft') as GeoJSONSource | undefined)?.setData(g.kaltluft);
    (m.getSource('unfall') as GeoJSONSource | undefined)?.setData(g.unfall);
    (m.getSource('hike') as GeoJSONSource | undefined)?.setData(g.hike);
    (m.getSource('wissen') as GeoJSONSource | undefined)?.setData(propsRef.current.data.wissen ?? fc([]));
    (m.getSource('spiel') as GeoJSONSource | undefined)?.setData(propsRef.current.data.spiel ?? fc([]));
    pushVehicles(true);
    const sun = m.getSource('sun') as ImageSource | undefined;
    const img = propsRef.current.data.sunImage ?? BLANK_PNG;
    if (sun && sunUrl.current !== img) { sunUrl.current = img; sun.updateImage({ url: img }); }
    const rad = m.getSource('radar') as ImageSource | undefined;
    const ri = propsRef.current.data.radarImage;
    if (rad && radarUrl.current !== (ri?.url ?? null)) {
      radarUrl.current = ri?.url ?? null;
      rad.updateImage(ri ? { url: ri.url, coordinates: ri.coords } : { url: BLANK_PNG });
    }
    const sp = propsRef.current.selectedPoint;
    (m.getSource('selected') as GeoJSONSource).setData(fc(sp ? [pt(sp[0], sp[1], {})] : []));
  };

  const applyTerrain = (on: boolean, animate: boolean) => {
    const m = mapRef.current;
    if (!m) return;
    if (on) {
      m.setTerrain({ source: 'terrain', exaggeration: 1.6 });
      if (animate) m.easeTo({ pitch: 58, bearing: -20, duration: 1200 });
    } else {
      m.setTerrain(null);
      if (animate) m.easeTo({ pitch: 0, bearing: 0, duration: 900 });
    }
  };

  const aerialYear = useRef<string | null>(null);
  const applyAerial = () => {
    const m = mapRef.current;
    const src = m?.getSource('aerial') as RasterTileSource | undefined;
    if (!m || !src) return;
    const { year, opacity } = propsRef.current.aerial;
    if (aerialYear.current !== year) { aerialYear.current = year; src.setTiles([aerialTiles(year)]); }
    m.setPaintProperty('aerial', 'raster-opacity', opacity);
  };

  // Karte einmalig anlegen
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = new maplibregl.Map({
      container: el.current!,
      center: HOME,
      zoom: window.innerWidth < 700 ? 11.6 : 12.6,
      minZoom: 8,
      maxZoom: 19,
      maxPitch: 75,
      attributionControl: false,
      hash: 'karte', // Kartenausschnitt in der Adresse, damit Links teilbar sind
      fadeDuration: reduced ? 0 : 250,
      locale: {
        'NavigationControl.ZoomIn': 'Hineinzoomen',
        'NavigationControl.ZoomOut': 'Herauszoomen',
        'NavigationControl.ResetBearing': 'Nach Norden ausrichten',
        'GeolocateControl.FindMyLocation': 'Meinen Standort zeigen',
        'AttributionControl.ToggleAttribution': 'Quellen anzeigen',
      },
    });
    mapRef.current = m;
    m.setPadding({ top: 0, ...props.padding });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // 3D-Gebäude nur bei geneigter Karte, von oben wirken die Wände unruhig
    const syncBuildings = () => {
      if (m.getLayer('building-3d')) m.setLayoutProperty('building-3d', 'visibility', m.getPitch() > 12 ? 'visible' : 'none');
    };
    m.on('pitchend', syncBuildings);
    m.on('moveend', () => { const c = m.getCenter(); propsRef.current.onMove?.([c.lng, c.lat]); });

    m.on('style.load', () => {
      syncBuildings();
      const p = propsRef.current;
      registerIcons(m, p.theme === 'dark');
      aerialYear.current = null;
      sunUrl.current = null;
      radarUrl.current = null;
      addOverlays(m, p.theme, p.visible);
      pushData();
      applyAerial();
      if (p.terrain) applyTerrain(true, false);
      p.onReady?.();
    });

    // Stil erst setzen, wenn der Listener hängt (ein Stilobjekt kann sofort fertig sein)
    m.setStyle(buildStyle(props.theme));

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'hover-pop', maxWidth: '260px' });
    hoverPopup.current = popup;

    const label = (f: MapGeoJSONFeature): string | null => {
      const pr = f.properties as Record<string, unknown>;
      switch (f.layer.id) {
        case 'stops-rail': case 'stops-bus': return String(pr.name);
        case 'parking-icon': case 'parking-dot': return `${pr.name}${pr.free != null ? ` · ${pr.free} frei` : ''}`;
        case 'roadworks': return `Baustelle ${pr.street}`;
        case 'share-point': return pr.name ? `${pr.system} · ${pr.name} · ${pr.available} verfügbar` : `${pr.system}`;
        case 'share-cluster': return `${pr.point_count} Sharing-Angebote, zum Vergrößern antippen`;
        case 'air-circle': return `Luft ${pr.name}: ${pr.label}`;
        case 'water-gauge': return `Neckar Pegel Cannstatt: ${pr.value} cm`;
        case 'places-icon': return String(pr.name);
        case 'nearby-dot': return String(pr.name);
        case 'live-dot': return `${pr.name}: ${pr.live}`;
        case 'flug-dot': return `${pr.callsign}${pr.type ? ` (${pr.type})` : ''} · ${pr.alt} ft${pr.heli ? ' · Hubschrauber' : ''}`;
        case 'warnung-label': return `Warnung: ${pr.title} (${pr.severity})`;
        case 'kaltluft-line': return `Kaltluftabfluss, Richtung ${pr.ri}°, ${pr.ge} m/s`;
        case 'unfall-dot': {
          const schwere = Number(pr.schwere) === 1 ? 'getötet' : Number(pr.schwere) === 2 ? 'schwer verletzt' : 'leicht verletzt';
          return `Unfall ${pr.jahr}: ${schwere}${pr.rad ? ' · Rad beteiligt' : ''}${pr.fuss ? ' · Fuß beteiligt' : ''}`;
        }
        case 'hike-line': return String(pr.text ?? pr.name);
        case 'wissen-dot': case 'wissen-line': case 'wissen-fill': return String(pr._name ?? pr.NAME ?? pr.TITEL ?? '');
        case 'vehicles-dot': case 'traffic-dot': case 'traffic-line': return String(pr.text);
        case 'events-pin': return `${pr.time} · ${pr.title}${Number(pr.count) > 1 ? ` (und ${Number(pr.count) - 1} weitere hier)` : ''}`;
        case 'bartour-stop': return `${pr.tourTitle}: ${pr.name}`;
        default: return null;
      }
    };

    m.on('mousemove', (e: MapMouseEvent) => {
      const layers = INTERACTIVE_LAYERS.filter((id) => m.getLayer(id));
      const f = m.queryRenderedFeatures(e.point, { layers })[0];
      m.getCanvas().style.cursor = f ? 'pointer' : '';
      const text = f && label(f);
      if (text && window.matchMedia('(hover: hover)').matches) {
        popup.setLngLat(e.lngLat).setText(text).addTo(m);
      } else popup.remove();
    });
    m.on('mouseout', () => popup.remove());

    m.on('click', async (e: MapMouseEvent) => {
      const layers = INTERACTIVE_LAYERS.filter((id) => m.getLayer(id));
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [[e.point.x - 12, e.point.y - 12], [e.point.x + 12, e.point.y + 12]];
      const f = m.queryRenderedFeatures(bbox, { layers })[0];
      popup.remove();
      if (!f) { propsRef.current.onSelect(null); return; }
      const pr = f.properties as Record<string, unknown>;
      // Fahrzeuge und Verkehrsmeldungen: Text am Ort, ohne Detailansicht
      if (f.layer.id === 'vehicles-dot' || f.layer.id.startsWith('traffic-') || f.layer.id.startsWith('flug-')
        || f.layer.id.startsWith('warnung-') || f.layer.id === 'kaltluft-line' || f.layer.id === 'unfall-dot' || f.layer.id === 'hike-line') {
        new maplibregl.Popup({ offset: 12, maxWidth: '280px', className: 'info-pop' }).setLngLat(e.lngLat).setText(String(pr.text ?? label(f) ?? '')).addTo(m);
        return;
      }
      const coord = f.geometry.type === 'Point'
        ? f.geometry.coordinates as [number, number]
        : [e.lngLat.lng, e.lngLat.lat] as [number, number];
      switch (f.layer.id) {
        case 'stops-rail': case 'stops-bus': {
          const lines = typeof pr.lines === 'string' ? JSON.parse(pr.lines as string) : pr.lines;
          propsRef.current.onSelect({ type: 'stop', id: String(pr.id), name: String(pr.name), lngLat: coord, lines });
          break;
        }
        case 'parking-icon': case 'parking-dot': propsRef.current.onSelect({ type: 'parking', id: Number(pr.id) }); break;
        case 'roadworks': propsRef.current.onSelect({ type: 'roadwork', id: String(pr.id) }); break;
        case 'air-circle': propsRef.current.onSelect({ type: 'air', id: String(pr.id) }); break;
        case 'water-gauge': propsRef.current.onSelect({ type: 'water' }); break;
        case 'share-point': propsRef.current.onSelect({ type: 'sharing', id: String(pr.id) }); break;
        case 'events-pin': propsRef.current.onSelect({ type: 'event', id: String(pr.id) }); break;
        case 'bartour-stop': propsRef.current.onSelect({
          type: 'bartour-stop', tourId: String(pr.tourId), stopIndex: Number(pr.stopIndex), lngLat: coord,
        }); break;
        case 'places-icon': propsRef.current.onSelect({ type: 'place', id: String(pr.id) }); break;
        case 'nearby-dot': {
          const item = propsRef.current.data.nearby?.items[Number(pr.i)];
          if (item) propsRef.current.onSelect({ type: 'facility', item });
          break;
        }
        case 'live-dot': {
          const item = propsRef.current.data.live?.[Number(pr.i)];
          if (item) propsRef.current.onSelect({ type: 'facility', item });
          break;
        }
        case 'share-cluster': {
          const src = m.getSource('sharing') as GeoJSONSource;
          const zoom = await src.getClusterExpansionZoom(pr.cluster_id as number);
          m.easeTo({ center: coord, zoom: Math.min(zoom + 0.3, 18) });
          return;
        }
        case 'wissen-dot': case 'wissen-line': case 'wissen-fill': {
          let props: Record<string, unknown> = {};
          try { props = JSON.parse(String(pr._props ?? '{}')); } catch { /* leer */ }
          propsRef.current.onSelect({
            type: 'wissen', id: String(pr.id ?? ''), layer: String(pr._layer ?? ''),
            layerTitle: String(pr._layerTitle ?? 'Stadt-Layer'), name: String(pr._name ?? 'Objekt'),
            lngLat: coord, props,
          });
          break;
        }
      }
      m.easeTo({ center: coord, zoom: Math.max(m.getZoom(), 14.5), padding: { top: 0, ...propsRef.current.detailPadding }, duration: reduced ? 0 : 700 });
    });

    return () => { m.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Farbschema wechseln
  const themeRef = useRef(props.theme);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || themeRef.current === props.theme) return;
    themeRef.current = props.theme;
    m.setStyle(buildStyle(props.theme), { diff: false });
  }, [props.theme]);

  useEffect(() => { pushData(); }, [props.data, props.selectedPoint]);
  useEffect(() => { applyAerial(); }, [props.aerial.year, props.aerial.opacity]);

  // Seitenleiste und Detailansicht verdecken Teile der Karte: Mittelpunkt entsprechend verschieben
  const { left, right, bottom } = props.padding;
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const pad = { top: 0, left, right, bottom };
    // Läuft gerade eine Kamerafahrt zu einem Objekt, bringt sie ihre Ränder schon mit
    if (m.isMoving()) m.once('moveend', () => m.setPadding(pad));
    else m.easeTo({ padding: pad, duration: 350 });
  }, [left, right, bottom]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.getLayer('net-line')) return;
    (Object.keys(OVERLAY_LAYERS) as OverlayKey[]).forEach((k) => setOverlayVisibility(m, k, props.visible[k]));
  }, [props.visible]);

  const terrainRef = useRef(props.terrain);
  useEffect(() => {
    if (terrainRef.current === props.terrain) return;
    terrainRef.current = props.terrain;
    applyTerrain(props.terrain, true);
  }, [props.terrain]);

  return <div ref={el} className="map" role="region" aria-label="Karte von Stuttgart" />;
});
