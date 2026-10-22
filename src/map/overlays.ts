// Fachebenen über der Grundkarte: Netz, Haltestellen, Parken, Sharing, Baustellen, Luft, Pegel.
import type { Map as MlMap, ExpressionSpecification, FilterSpecification } from 'maplibre-gl';
import type { Theme } from './mapStyle';
import { AIR_COLOR } from '../lib/format';
import { SHADE_COORDS } from '../lib/useSun';

export const AERIAL_YEARS = ['2006', '2009', '2011', '2013', '2015', '2017', '2019', '2021', '2023', '2025'];
export const aerialTiles = (year: string) =>
  `https://geoserver.stuttgart.de/geoserver/Base/wms?service=WMS&version=1.3.0&request=GetMap&layers=A62_Luftbild_${year}_EPSG25832&styles=&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/jpeg`;

export const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export type OverlayKey = 'network' | 'stops' | 'parking' | 'sharing' | 'roadworks' | 'bike' | 'air' | 'water' | 'events' | 'places' | 'sun' | 'radar' | 'aerial' | 'nearby' | 'live' | 'route' | 'vehicles' | 'traffic' | 'warnung' | 'flug' | 'kaltluft' | 'unfall' | 'hike' | 'wissen';

export const OVERLAY_LAYERS: Record<OverlayKey, string[]> = {
  bike: ['bike-routes'],
  network: ['net-casing', 'net-line', 'net-label'],
  stops: ['stops-bus', 'stops-rail', 'stops-rail-label', 'stops-bus-label'],
  sharing: ['share-cluster', 'share-cluster-count', 'share-point', 'share-station-count'],
  roadworks: ['roadworks'],
  parking: ['parking-dot', 'parking-icon'],
  air: ['air-halo', 'air-circle', 'air-label'],
  water: ['water-gauge'],
  places: ['places-icon'],
  events: ['events-pin'],
  sun: ['sun-shade'],
  radar: ['radar-rain'],
  aerial: ['aerial'],
  nearby: ['nearby-dot', 'nearby-label'],
  live: ['live-dot', 'live-label'],
  route: ['route-glow', 'route-casing', 'route-line', 'route-walk', 'route-end', 'route-end-label'],
  vehicles: ['vehicles-path', 'vehicles-dot', 'vehicles-label'],
  traffic: ['traffic-line', 'traffic-dot'],
  warnung: ['warnung-fill', 'warnung-line', 'warnung-label'],
  flug: ['flug-dot', 'flug-label'],
  kaltluft: ['kaltluft-line'],
  unfall: ['unfall-dot'],
  hike: ['hike-line', 'hike-label'],
  wissen: ['wissen-fill', 'wissen-line', 'wissen-dot', 'wissen-label'],
};

export const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const zl = (stops: [number, number][]): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], ...stops.flat()] as ExpressionSpecification;

export function addOverlays(map: MlMap, theme: Theme, visible: Record<OverlayKey, boolean>) {
  const dark = theme === 'dark';
  const ink = dark ? '#ECEAE4' : '#26262C';
  const card = dark ? '#211F1F' : '#FFFFFF';
  const land = dark ? '#18181B' : '#F4F2EE';
  const halo = dark ? '#18181B' : '#FFFFFF';
  const muted = dark ? '#BDBAB2' : '#5D5C62';
  const before = 'label-water';

  map.addSource('network', { type: 'geojson', data: '/data/network.geojson' });
  map.addSource('stops', { type: 'geojson', data: '/data/stops.geojson' });
  map.addSource('bike', { type: 'geojson', data: EMPTY });
  map.addSource('parking', { type: 'geojson', data: EMPTY });
  map.addSource('sharing', {
    type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 44, clusterMaxZoom: 16,
    clusterProperties: {
      car: ['+', ['case', ['==', ['get', 'kind'], 'car'], 1, 0]],
      bike: ['+', ['case', ['==', ['get', 'kind'], 'bike'], 1, 0]],
      scooter: ['+', ['case', ['==', ['get', 'kind'], 'scooter'], 1, 0]],
    },
  });
  map.addSource('roadworks', { type: 'geojson', data: EMPTY });
  map.addSource('air', { type: 'geojson', data: EMPTY });
  map.addSource('water', { type: 'geojson', data: EMPTY });
  map.addSource('places', { type: 'geojson', data: EMPTY });
  map.addSource('events', { type: 'geojson', data: EMPTY });
  map.addSource('nearby', { type: 'geojson', data: EMPTY });
  map.addSource('live', { type: 'geojson', data: EMPTY });
  map.addSource('route', { type: 'geojson', data: EMPTY });
  map.addSource('vehicles', { type: 'geojson', data: EMPTY });
  map.addSource('vehicle-paths', { type: 'geojson', data: EMPTY });
  map.addSource('traffic', { type: 'geojson', data: EMPTY });
  map.addSource('warnung', { type: 'geojson', data: EMPTY });
  map.addSource('flug', { type: 'geojson', data: EMPTY });
  map.addSource('kaltluft', { type: 'geojson', data: EMPTY });
  map.addSource('unfall', { type: 'geojson', data: EMPTY });
  map.addSource('hike', { type: 'geojson', data: EMPTY });
  map.addSource('wissen', { type: 'geojson', data: EMPTY });
  map.addSource('selected', { type: 'geojson', data: EMPTY });

  const vis = (k: OverlayKey) => ({ visibility: visible[k] ? 'visible' : 'none' }) as const;

  // Luftbilder des Stadtmessungsamts (WMS), Jahrgang per aerialTiles() umschaltbar
  map.addSource('aerial', { type: 'raster', tiles: [aerialTiles(AERIAL_YEARS[AERIAL_YEARS.length - 1])], tileSize: 256, minzoom: 13, maxzoom: 20,
    attribution: 'Luftbilder: Landeshauptstadt Stuttgart, Stadtmessungsamt' });
  map.addLayer({ id: 'aerial', type: 'raster', source: 'aerial', layout: vis('aerial'), paint: { 'raster-opacity': 1, 'raster-fade-duration': 150 } }, map.getLayer('boundary') ? 'boundary' : before);

  // Sonne und Schatten (Abendsonne-Finder), unter allen Linien und Beschriftungen
  map.addSource('sun', { type: 'image', url: BLANK_PNG, coordinates: SHADE_COORDS });
  map.addLayer({
    id: 'sun-shade', type: 'raster', source: 'sun', layout: vis('sun'),
    paint: { 'raster-opacity': 0.9, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
  }, map.getLayer('water') ? 'water' : before);

  // Niederschlagsradar
  map.addSource('radar', { type: 'image', url: BLANK_PNG, coordinates: SHADE_COORDS });
  map.addLayer({
    id: 'radar-rain', type: 'raster', source: 'radar', layout: vis('radar'),
    paint: { 'raster-opacity': 0.85, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 },
  }, before);

  // Hauptradrouten
  map.addLayer({
    id: 'bike-routes', type: 'line', source: 'bike', layout: { ...vis('bike'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': dark ? '#5BC48A' : '#1E8A4F', 'line-width': zl([[11, 1.2], [16, 4]]), 'line-dasharray': [1.5, 1.2], 'line-opacity': 0.9 },
  }, before);

  // Schienennetz
  map.addLayer({
    id: 'net-casing', type: 'line', source: 'network', layout: { ...vis('network'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': land, 'line-width': zl([[9, 2.5], [12, 5], [16, 11]]), 'line-opacity': 0.95 },
  }, before);
  map.addLayer({
    id: 'net-line', type: 'line', source: 'network', layout: { ...vis('network'), 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, ['match', ['get', 'mode'], 'sbahn', 1.6, 1.1], 12, ['match', ['get', 'mode'], 'sbahn', 3.4, 2.6], 16, ['match', ['get', 'mode'], 'sbahn', 7, 6]],
      'line-opacity': zl([[9, 0.75], [12, 0.95]]),
    },
  }, before);

  // Haltestellen
  map.addLayer({
    id: 'stops-bus', type: 'circle', source: 'stops', minzoom: 13.5, layout: vis('stops'),
    filter: ['==', ['get', 'kind'], 'bus'],
    paint: {
      'circle-radius': zl([[13.5, 2], [17, 5.5]]),
      'circle-color': card,
      'circle-stroke-color': dark ? '#E57373' : '#C8102E',
      'circle-stroke-width': zl([[13.5, 1], [17, 2]]),
      'circle-opacity': zl([[13.5, 0], [14, 1]]),
      'circle-stroke-opacity': zl([[13.5, 0], [14, 1]]),
    },
  });
  map.addLayer({
    id: 'stops-rail', type: 'circle', source: 'stops', minzoom: 10, layout: vis('stops'),
    filter: ['!=', ['get', 'kind'], 'bus'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        10, ['case', ['>', ['get', 'trips'], 8000], 2.6, 1.4],
        13, ['case', ['>', ['get', 'trips'], 8000], 5.2, 3.6],
        16, ['case', ['>', ['get', 'trips'], 8000], 9, 7]],
      'circle-color': card,
      'circle-stroke-color': ink,
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, ['case', ['==', ['get', 'kind'], 'sbahn'], 3, 2.2]],
    },
  });
  map.addLayer({
    id: 'stops-rail-label', type: 'symbol', source: 'stops', minzoom: 11.5, layout: {
      ...vis('stops'),
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, ['case', ['>', ['get', 'trips'], 8000], 11.5, 10], 16, ['case', ['>', ['get', 'trips'], 8000], 15, 13]],
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
      'text-radial-offset': 0.9,
      'text-justify': 'auto',
      'text-max-width': 9,
      'symbol-sort-key': ['-', 0, ['get', 'trips']],
      'text-optional': true,
    },
    filter: ['all', ['!=', ['get', 'kind'], 'bus'], ['any', ['>=', ['zoom'], 13], ['>', ['get', 'trips'], 6000]]] as FilterSpecification,
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });
  map.addLayer({
    id: 'stops-bus-label', type: 'symbol', source: 'stops', minzoom: 15.5, layout: {
      ...vis('stops'),
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11.5,
      'text-variable-anchor': ['left', 'right', 'top'],
      'text-radial-offset': 0.8,
      'text-max-width': 8,
    },
    filter: ['==', ['get', 'kind'], 'bus'],
    paint: { 'text-color': muted, 'text-halo-color': halo, 'text-halo-width': 1.6 },
  });

  map.addLayer({
    id: 'net-label', type: 'symbol', source: 'network', minzoom: 13.5, layout: {
      ...vis('network'),
      'symbol-placement': 'line', 'symbol-spacing': 320,
      'text-field': ['get', 'line'], 'text-font': ['Noto Sans Bold'], 'text-size': 10.5,
      'text-keep-upright': true,
    },
    paint: { 'text-color': ['get', 'text'], 'text-halo-color': ['get', 'color'], 'text-halo-width': 3 },
  });

  // Sharing
  map.addLayer({
    id: 'share-cluster', type: 'circle', source: 'sharing', filter: ['has', 'point_count'], layout: vis('sharing'),
    paint: {
      'circle-color': card,
      'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 9, 30, 14, 200, 19],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': ['case',
        ['>=', ['get', 'car'], ['max', ['get', 'bike'], ['get', 'scooter']]], '#2B59C3',
        ['>=', ['get', 'bike'], ['get', 'scooter']], '#0F8A6B', '#7A3FB0'],
      'circle-opacity': 0.96,
    },
  });
  map.addLayer({
    id: 'share-cluster-count', type: 'symbol', source: 'sharing', filter: ['has', 'point_count'],
    layout: { ...vis('sharing'), 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true },
    paint: { 'text-color': ink },
  });
  map.addLayer({
    id: 'share-point', type: 'symbol', source: 'sharing', filter: ['!', ['has', 'point_count']],
    layout: {
      ...vis('sharing'),
      'icon-image': ['concat', 'share-', ['get', 'kind']],
      'icon-size': zl([[12, 0.75], [16, 1]]),
      'icon-allow-overlap': true,
    },
    paint: { 'icon-opacity': ['case', ['all', ['get', 'station'], ['==', ['get', 'available'], 0]], 0.45, 1] },
  });
  map.addLayer({
    id: 'share-station-count', type: 'symbol', source: 'sharing', minzoom: 14.5,
    filter: ['all', ['!', ['has', 'point_count']], ['get', 'station']] as FilterSpecification,
    layout: {
      ...vis('sharing'), 'text-field': ['to-string', ['get', 'available']], 'text-font': ['Noto Sans Bold'], 'text-size': 11,
      'text-offset': [1.1, -0.9], 'text-allow-overlap': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  // Baustellen
  map.addLayer({
    id: 'roadworks', type: 'symbol', source: 'roadworks',
    filter: ['any', ['==', ['get', 'status'], 'active'], ['>=', ['zoom'], 13]] as FilterSpecification,
    layout: {
      ...vis('roadworks'),
      'icon-image': ['case', ['==', ['get', 'status'], 'active'], 'roadwork', 'roadwork-planned'],
      'icon-size': zl([[10, 0.5], [13, 0.7], [16, 1]]),
      'icon-allow-overlap': true,
      'symbol-sort-key': ['case', ['==', ['get', 'status'], 'active'], 1, 0],
    },
  });

  // Parkhäuser mit Belegung
  const occColor = ['match', ['get', 'occ'], 'ok', '#1B7F3B', 'mid', '#C98500', 'full', '#C62828', '#77767C'] as ExpressionSpecification;
  map.addLayer({
    id: 'parking-dot', type: 'circle', source: 'parking', maxzoom: 14, layout: vis('parking'),
    filter: ['!=', ['get', 'occ'], 'none'],
    paint: {
      'circle-color': occColor, 'circle-radius': zl([[10, 3.5], [14, 6]]),
      'circle-stroke-color': card, 'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'parking-icon', type: 'symbol', source: 'parking', minzoom: 14,
    filter: ['any', ['!=', ['get', 'occ'], 'none'], ['>=', ['zoom'], 16]] as FilterSpecification,
    layout: {
      ...vis('parking'),
      'icon-image': ['concat', 'park-', ['get', 'occ']],
      'icon-size': zl([[14, 0.8], [16, 1]]),
      'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 13.5, ['case', ['has', 'free'], ['concat', ['to-string', ['get', 'free']], ' frei'], '']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-anchor': 'left',
      'text-offset': [1.35, 0],
      'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  // Luftmessstationen
  const airColor = ['match', ['get', 'index'], 0, AIR_COLOR[0], 1, AIR_COLOR[1], 2, AIR_COLOR[2], 3, AIR_COLOR[3], 4, AIR_COLOR[4], '#8E8D92'] as ExpressionSpecification;
  map.addLayer({
    id: 'air-halo', type: 'circle', source: 'air', layout: vis('air'),
    paint: { 'circle-color': airColor, 'circle-radius': zl([[10, 14], [15, 30]]), 'circle-opacity': 0.18, 'circle-blur': 0.4 },
  });
  map.addLayer({
    id: 'air-circle', type: 'circle', source: 'air', layout: vis('air'),
    paint: { 'circle-color': airColor, 'circle-radius': zl([[10, 6], [15, 10]]), 'circle-stroke-color': card, 'circle-stroke-width': 2.5 },
  });
  map.addLayer({
    id: 'air-label', type: 'symbol', source: 'air', minzoom: 13.5, layout: {
      ...vis('air'), 'text-field': ['concat', 'Luft ', ['get', 'label']], 'text-font': ['Noto Sans Bold'],
      'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  map.addLayer({
    id: 'water-gauge', type: 'symbol', source: 'water', layout: {
      ...vis('water'), 'icon-image': 'gauge', 'icon-size': zl([[10, 0.75], [15, 1]]), 'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 12, ['concat', ['get', 'value'], ' cm']], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5,
      'text-anchor': 'left', 'text-offset': [1.4, 0],
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  // Sehenswürdigkeiten: bekannte Orte (viele Wikipedia-Sprachen) zuerst, Rest erst beim Hineinzoomen
  map.addLayer({
    id: 'places-icon', type: 'symbol', source: 'places', minzoom: 11,
    filter: ['any', ['>=', ['get', 'rank'], 25], ['>=', ['zoom'], 13.5]] as FilterSpecification,
    layout: {
      ...vis('places'),
      'icon-image': ['concat', 'place-', ['get', 'kind']],
      'icon-size': zl([[11, 0.72], [15, 1]]),
      'symbol-sort-key': ['-', 0, ['get', 'rank']],
      'text-field': ['step', ['zoom'], '', 14.5, ['get', 'name']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-max-width': 9,
      'text-variable-anchor': ['top', 'left', 'right'],
      'text-radial-offset': 1.25,
      'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  // Veranstaltungen des gewählten Tages, mit Beginnzeit
  // Einrichtungen der Nähe-Suche (Farbe je Kategorie aus den Daten)
  map.addLayer({
    id: 'nearby-dot', type: 'circle', source: 'nearby',
    layout: { ...vis('nearby'), 'circle-sort-key': ['get', 'rank'] },
    paint: {
      'circle-radius': zl([[10, 3.5], [14, 6], [17, 9]]),
      'circle-color': ['get', 'color'],
      'circle-stroke-color': dark ? '#1b1b1f' : '#ffffff',
      'circle-stroke-width': 1.6,
      'circle-opacity': ['case', ['get', 'closed'], 0.45, 1],
    },
  });
  map.addLayer({
    id: 'nearby-label', type: 'symbol', source: 'nearby', minzoom: 14.5,
    layout: { ...vis('nearby'), 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-max-width': 10,
      'text-variable-anchor': ['top', 'left', 'right'], 'text-radial-offset': 0.9, 'text-optional': true },
    paint: { 'text-color': ink, 'text-halo-color': dark ? '#1b1b1f' : '#ffffff', 'text-halo-width': 1.4 },
  });
  // Gewählte Verbindung: breiter Schein, Fassung und kräftige Linie in Linienfarbe.
  // Fußwege werden hell bzw. dunkel gestrichelt und bleiben so auch auf Luftbildern sichtbar.
  map.addLayer({
    id: 'route-glow', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'],
    layout: { ...vis('route'), 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': zl([[9, 10], [13, 18], [16, 24]]),
      'line-opacity': dark ? 0.32 : 0.2,
      'line-blur': 5,
    },
  });
  map.addLayer({
    id: 'route-casing', type: 'line', source: 'route', filter: ['==', ['geometry-type'], 'LineString'],
    layout: { ...vis('route'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': card, 'line-width': zl([[9, 6], [13, 11], [16, 15]]), 'line-opacity': 0.95 },
  });
  map.addLayer({
    id: 'route-line', type: 'line', source: 'route', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['get', 'walk']]],
    layout: { ...vis('route'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': zl([[9, 3.2], [13, 6], [16, 8.5]]) },
  });
  map.addLayer({
    id: 'route-walk', type: 'line', source: 'route', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['get', 'walk']],
    layout: { ...vis('route'), 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': dark ? '#ECEAE4' : '#26262C',
      'line-width': zl([[9, 2.6], [13, 4.2], [16, 5.6]]),
      'line-dasharray': [0.55, 1.6],
      'line-opacity': 0.95,
    },
  });
  map.addLayer({
    id: 'route-end', type: 'circle', source: 'route', filter: ['==', ['geometry-type'], 'Point'],
    layout: vis('route'),
    paint: {
      'circle-radius': zl([[9, 5], [13, 7], [16, 9]]),
      'circle-color': ['case', ['==', ['get', 'role'], 'start'], ink, '#FFB300'],
      'circle-stroke-color': card,
      'circle-stroke-width': 2.5,
    },
  });
  map.addLayer({
    id: 'route-end-label', type: 'symbol', source: 'route', filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'label']],
    layout: {
      ...vis('route'), 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'],
      'text-size': zl([[9, 10], [13, 11.5]]), 'text-anchor': 'bottom', 'text-offset': [0, -0.9],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': ['case', ['==', ['get', 'role'], 'end'], dark ? '#FFD166' : '#8A5A00', ink],
      'text-halo-color': card,
      'text-halo-width': 2.5,
    },
  });
  // Amtliche Verkehrsmeldungen: Abschnitt als Linie, Meldung als Punkt, Farbe nach Art
  const trafficColor = ['match', ['get', 'typ'], 'Unfall', '#C62828', 'Stau', '#E65100', 'Sperrung', ink, 'Baustelle', '#C28800', '#8A8A90'] as ExpressionSpecification;
  map.addLayer({
    id: 'traffic-line', type: 'line', source: 'traffic', filter: ['==', ['geometry-type'], 'LineString'],
    layout: { ...vis('traffic'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': trafficColor, 'line-width': zl([[10, 2.5], [15, 6]]), 'line-opacity': 0.75 },
  });
  map.addLayer({
    id: 'traffic-dot', type: 'circle', source: 'traffic', filter: ['==', ['geometry-type'], 'Point'],
    layout: vis('traffic'),
    paint: { 'circle-radius': zl([[10, 5], [15, 8]]), 'circle-color': trafficColor, 'circle-stroke-color': halo, 'circle-stroke-width': 2 },
  });
  // Berechnete Fahrzeugpositionen der gewählten Haltestelle
  map.addLayer({
    id: 'vehicles-path', type: 'line', source: 'vehicle-paths',
    layout: { ...vis('vehicles'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': zl([[10, 1.5], [15, 3]]), 'line-opacity': 0.45, 'line-dasharray': [2, 1.5] },
  });
  map.addLayer({
    id: 'vehicles-dot', type: 'circle', source: 'vehicles',
    layout: vis('vehicles'),
    paint: {
      'circle-radius': zl([[10, 7], [15, 11]]),
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', ['get', 'rt'], 1, 0.55],
      'circle-stroke-color': ink, 'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: 'vehicles-label', type: 'symbol', source: 'vehicles',
    layout: { ...vis('vehicles'), 'text-field': ['get', 'line'], 'text-font': ['Noto Sans Bold'], 'text-size': zl([[10, 8], [15, 10.5]]), 'text-allow-overlap': true },
    paint: { 'text-color': ['get', 'fg'] },
  });
  // Live-Zustände städtischer Einrichtungen: Bäder (Auslastung) und Bürgerbüros (Wartezeit)
  map.addLayer({
    id: 'live-dot', type: 'circle', source: 'live',
    layout: vis('live'),
    paint: {
      'circle-radius': zl([[10, 6], [14, 9], [17, 11]]),
      'circle-color': ['match', ['get', 'level'], 'ok', '#1B7F3B', 'mittel', '#C28800', 'hoch', '#C62828', '#8A8A90'],
      'circle-stroke-color': dark ? '#1b1b1f' : '#ffffff',
      'circle-stroke-width': 2.5,
    },
  });
  map.addLayer({
    id: 'live-label', type: 'symbol', source: 'live', minzoom: 11.5,
    layout: { ...vis('live'), 'text-field': ['get', 'short'], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5,
      'text-anchor': 'left', 'text-offset': [1.1, 0], 'text-optional': true, 'text-allow-overlap': false },
    paint: { 'text-color': ink, 'text-halo-color': dark ? '#1b1b1f' : '#ffffff', 'text-halo-width': 1.6 },
  });
  map.addLayer({
    id: 'events-pin', type: 'symbol', source: 'events',
    layout: {
      ...vis('events'),
      'icon-image': ['case', ['get', 'allDay'], 'event-allday', 'event-pin'],
      'icon-anchor': 'bottom',
      'icon-size': zl([[10, 0.7], [14, 0.95]]),
      'icon-allow-overlap': true,
      'symbol-sort-key': ['case', ['get', 'allDay'], 1, 0],
      'text-field': ['step', ['zoom'], '', 12.5, ['get', 'time']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11.5,
      'text-anchor': 'left',
      'text-offset': [1.2, -1.4],
      'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  // Amtliche Warnungen (BBK NINA / MoWaS): betroffenes Gebiet als Fläche mit Kennzeichnung
  const warnColor = ['match', ['get', 'severity'], 'Extreme', '#B71C1C', 'Severe', '#C62828', 'Moderate', '#E65100', '#C28800'] as ExpressionSpecification;
  map.addLayer({
    id: 'warnung-fill', type: 'fill', source: 'warnung', filter: ['==', ['geometry-type'], 'Polygon'],
    layout: vis('warnung'),
    paint: { 'fill-color': warnColor, 'fill-opacity': 0.22 },
  });
  map.addLayer({
    id: 'warnung-line', type: 'line', source: 'warnung', filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { ...vis('warnung'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': warnColor, 'line-width': zl([[9, 2], [14, 4]]), 'line-dasharray': [2, 1.5] },
  });
  map.addLayer({
    id: 'warnung-label', type: 'symbol', source: 'warnung', filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      ...vis('warnung'), 'text-field': ['get', 'title'], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5,
      'text-max-width': 9, 'text-variable-anchor': ['top', 'left', 'right'], 'text-radial-offset': 1.1, 'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  // Luftfahrzeuge im Umkreis (ADS-B): Hubschrauber gelb, tieffliegende Flugzeuge rot
  map.addLayer({
    id: 'flug-dot', type: 'circle', source: 'flug', minzoom: 9, layout: vis('flug'),
    paint: {
      'circle-radius': zl([[9, 3], [13, 5], [16, 8]]),
      'circle-color': ['case', ['get', 'heli'], '#C28800', ['get', 'niedrig'], '#C62828', '#2B59C3'],
      'circle-stroke-color': card, 'circle-stroke-width': 1.8,
    },
  });
  map.addLayer({
    id: 'flug-label', type: 'symbol', source: 'flug', minzoom: 11.5, layout: {
      ...vis('flug'),
      'text-field': ['concat', ['coalesce', ['get', 'callsign'], ['get', 'reg'], '?'], ' · ', ['to-string', ['get', 'alt']], ' ft'],
      'text-font': ['Noto Sans Bold'], 'text-size': 10.5,
      'text-variable-anchor': ['top', 'left', 'right'], 'text-radial-offset': 1, 'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.8 },
  });

  // Kaltluftabfluss im Talkessel (Klimaatlas): Strömungspfeile nach Richtung und Geschwindigkeit
  map.addLayer({
    id: 'kaltluft-line', type: 'line', source: 'kaltluft', minzoom: 10,
    layout: { ...vis('kaltluft'), 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['interpolate', ['linear'], ['get', 'ge'], 0.1, '#8FD3E8', 0.6, '#2B7FBF', 1.5, '#0F3D6B'],
      'line-width': zl([[10, 1], [14, 2.6]]),
      'line-opacity': zl([[10, 0.5], [13, 0.85]]),
    },
  });

  // Ausgeschilderte Wander-, Weinwander- und Downhillwege (Geoserver der Stadt)
  map.addLayer({
    id: 'hike-line', type: 'line', source: 'hike', minzoom: 9.5,
    layout: { ...vis('hike'), 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['coalesce', ['get', 'farbe'], '#8E2F4A'],
      'line-width': zl([[10, 1.4], [14, 3], [16, 5]]),
      'line-opacity': 0.9,
      'line-dasharray': [2, 1.2],
    },
  }, 'stops-rail');
  map.addLayer({
    id: 'hike-label', type: 'symbol', source: 'hike', minzoom: 12.5, layout: {
      ...vis('hike'), 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 10.5,
      'symbol-placement': 'line', 'text-max-angle': 30, 'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.8 },
  }, 'stops-rail');

  // Unfallatlas: Unfälle mit Personenschaden, Farbe nach Schwere, Größe nach Schwere
  map.addLayer({
    id: 'unfall-dot', type: 'circle', source: 'unfall', minzoom: 9.5, layout: vis('unfall'),
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, ['case', ['==', ['get', 'schwere'], 1], 5, ['==', ['get', 'schwere'], 2], 3.5, 2.5],
        16, ['case', ['==', ['get', 'schwere'], 1], 10, ['==', ['get', 'schwere'], 2], 7, 5],
      ],
      'circle-color': ['match', ['get', 'schwere'], 1, '#B71C1C', 2, '#EF6C00', '#F9A825'],
      'circle-opacity': 0.88,
      'circle-stroke-color': card,
      'circle-stroke-width': 1,
    },
  }, 'stops-rail');

  // Freie WFS-Layer aus dem Stadt-Layer-Katalog: Flächen, Linien und Punkte.
  map.addLayer({
    id: 'wissen-fill', type: 'fill', source: 'wissen',
    filter: ['==', ['geometry-type'], 'Polygon'], layout: vis('wissen'),
    paint: { 'fill-color': '#2B7FBF', 'fill-opacity': 0.2 },
  });
  map.addLayer({
    id: 'wissen-line', type: 'line', source: 'wissen',
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
    layout: { ...vis('wissen'), 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#1F6FA8', 'line-width': zl([[10, 1.2], [14, 2.6], [17, 4]]), 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: 'wissen-dot', type: 'circle', source: 'wissen',
    filter: ['==', ['geometry-type'], 'Point'], layout: vis('wissen'),
    paint: {
      'circle-radius': zl([[10, 3.5], [14, 6], [17, 8]]),
      'circle-color': '#2B7FBF', 'circle-stroke-color': card, 'circle-stroke-width': 1.8,
    },
  });
  map.addLayer({
    id: 'wissen-label', type: 'symbol', source: 'wissen', minzoom: 13.5,
    filter: ['has', '_name'], layout: {
      ...vis('wissen'), 'text-field': ['get', '_name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11,
      'text-variable-anchor': ['top', 'left', 'right'], 'text-radial-offset': 0.9, 'text-optional': true,
      'text-max-width': 10,
    },
    paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.6 },
  });

  // Auswahl
  map.addLayer({
    id: 'selected-halo', type: 'circle', source: 'selected',
    paint: { 'circle-color': '#FFB300', 'circle-radius': zl([[10, 14], [16, 26]]), 'circle-opacity': 0.35, 'circle-stroke-color': '#FFB300', 'circle-stroke-width': 2 },
  }, 'stops-rail');
}

export function setOverlayVisibility(map: MlMap, key: OverlayKey, on: boolean) {
  for (const id of OVERLAY_LAYERS[key]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }
}

export const INTERACTIVE_LAYERS = ['stops-rail', 'stops-bus', 'parking-icon', 'parking-dot', 'roadworks', 'share-point', 'share-cluster', 'air-circle', 'water-gauge', 'events-pin', 'places-icon', 'nearby-dot', 'live-dot', 'vehicles-dot', 'traffic-dot', 'traffic-line', 'flug-dot', 'warnung-label', 'kaltluft-line', 'unfall-dot', 'hike-line', 'wissen-dot', 'wissen-line', 'wissen-fill'];
