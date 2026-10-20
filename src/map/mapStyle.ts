// Eigene Kartengestaltung auf Basis der freien OpenFreeMap-Vektorkacheln (OpenMapTiles-Schema).
// Warme Grautöne der Stuttgarter Web-CI, Relief aus offenen Höhendaten, damit der Talkessel sichtbar wird.
import type { StyleSpecification, ExpressionSpecification } from 'maplibre-gl';

export type Theme = 'light' | 'dark';

interface Palette {
  land: string;
  residential: string;
  industrial: string;
  park: string;
  wood: string;
  water: string;
  waterLine: string;
  building: string;
  buildingLine: string;
  extrusion: string;
  roadMinor: string;
  roadMajor: string;
  roadCasing: string;
  motorway: string;
  motorwayCasing: string;
  path: string;
  rail: string;
  label: string;
  labelStrong: string;
  labelWater: string;
  halo: string;
  shadow: string;
  highlight: string;
  shadeOpacity: number;
  boundary: string;
}

const PALETTES: Record<Theme, Palette> = {
  light: {
    land: '#F4F2EE',
    residential: '#EFECE6',
    industrial: '#ECE9E3',
    park: '#DCE7D0',
    wood: '#CFDEC1',
    water: '#B9D3DF',
    waterLine: '#A3C4D3',
    building: '#E5E1D9',
    buildingLine: '#D6D0C5',
    extrusion: '#E8E4DC',
    roadMinor: '#FFFFFF',
    roadMajor: '#FFFFFF',
    roadCasing: '#DED8CC',
    motorway: '#FBE6B0',
    motorwayCasing: '#E6C878',
    path: '#D4CDBF',
    rail: '#C9C2B5',
    label: '#6B6A70',
    labelStrong: '#26262C',
    labelWater: '#4F7A8C',
    halo: '#F4F2EE',
    shadow: '#473B28',
    highlight: '#FFFFFF',
    shadeOpacity: 0.38,
    boundary: '#B9B2A4',
  },
  dark: {
    land: '#18181B',
    residential: '#1C1C20',
    industrial: '#1E1E22',
    park: '#1C2620',
    wood: '#1D2A21',
    water: '#0E2330',
    waterLine: '#16364A',
    building: '#26262B',
    buildingLine: '#2F2F35',
    extrusion: '#2C2C33',
    roadMinor: '#2A2A30',
    roadMajor: '#35353C',
    roadCasing: '#121214',
    motorway: '#5A4614',
    motorwayCasing: '#2B2209',
    path: '#33333A',
    rail: '#3A3A42',
    label: '#A8A59E',
    labelStrong: '#ECEAE4',
    labelWater: '#6F9DB3',
    halo: '#18181B',
    shadow: '#000000',
    highlight: '#3B3B44',
    shadeOpacity: 0.55,
    boundary: '#4A4A52',
  },
};

const z = (stops: [number, number][]): ExpressionSpecification =>
  ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()] as ExpressionSpecification;

const name: ExpressionSpecification = ['coalesce', ['get', 'name:de'], ['get', 'name'], ['get', 'name_int']];

export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export function buildStyle(theme: Theme): StyleSpecification {
  const p = PALETTES[theme];
  const notTunnel: ExpressionSpecification = ['!=', ['get', 'brunnel'], 'tunnel'];
  const roadClass = (classes: string[]): ExpressionSpecification =>
    ['all', ['match', ['get', 'class'], classes, true, false], notTunnel] as ExpressionSpecification;

  return {
    version: 8,
    name: `stuttgart-${theme}`,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Daten © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>-Mitwirkende',
      },
      hillshade: {
        type: 'raster-dem',
        tiles: [DEM_TILES],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution: 'Relief: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank">Mapzen Terrain Tiles</a>',
      },
      terrain: { type: 'raster-dem', tiles: [DEM_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 14 },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': p.land } },
      {
        id: 'landuse-residential', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood'], true, false],
        paint: { 'fill-color': p.residential, 'fill-opacity': z([[10, 0.6], [14, 1]]) },
      },
      {
        id: 'landuse-industrial', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['industrial', 'commercial', 'railway', 'retail'], true, false],
        paint: { 'fill-color': p.industrial },
      },
      {
        id: 'landcover-wood', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': p.wood, 'fill-opacity': 0.9 },
      },
      {
        id: 'landcover-grass', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['grass', 'farmland', 'wetland'], true, false],
        paint: { 'fill-color': p.park, 'fill-opacity': 0.55 },
      },
      {
        id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park',
        paint: { 'fill-color': p.park, 'fill-opacity': 0.9 },
      },
      {
        id: 'landuse-green', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['cemetery', 'stadium', 'pitch', 'playground', 'garden'], true, false],
        paint: { 'fill-color': p.park, 'fill-opacity': 0.75 },
      },
      {
        id: 'hillshade', type: 'hillshade', source: 'hillshade',
        paint: {
          'hillshade-shadow-color': p.shadow,
          'hillshade-highlight-color': p.highlight,
          'hillshade-accent-color': p.shadow,
          'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 9, 0.45, 13, p.shadeOpacity, 16, 0.18],
          'hillshade-illumination-direction': 315,
        },
      },
      {
        id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water',
        filter: notTunnel,
        paint: { 'fill-color': p.water },
      },
      {
        id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
        filter: ['all', notTunnel, ['match', ['get', 'class'], ['river', 'canal'], true, false]],
        paint: { 'line-color': p.waterLine, 'line-width': z([[10, 1], [16, 4]]) },
      },
      {
        id: 'aeroway', type: 'fill', source: 'omt', 'source-layer': 'aeroway', minzoom: 11,
        filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
        paint: { 'fill-color': p.industrial },
      },
      {
        id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-color': p.building,
          'fill-outline-color': p.buildingLine,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
        },
      },
      // Straßen
      {
        id: 'road-path', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 14,
        filter: roadClass(['path', 'track']),
        paint: { 'line-color': p.path, 'line-width': z([[14, 0.6], [18, 2]]), 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'road-minor-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 13,
        filter: roadClass(['minor', 'service']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.roadCasing, 'line-width': z([[13, 1], [18, 14]]) },
      },
      {
        id: 'road-major-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 10,
        filter: roadClass(['primary', 'secondary', 'tertiary', 'trunk']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.roadCasing, 'line-width': z([[10, 1.2], [18, 24]]) },
      },
      {
        id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: roadClass(['minor', 'service']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.roadMinor, 'line-width': z([[12, 0.5], [18, 11]]) },
      },
      {
        id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 8,
        filter: roadClass(['primary', 'secondary', 'tertiary', 'trunk']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.roadMajor, 'line-width': z([[8, 0.6], [18, 20]]) },
      },
      {
        id: 'road-motorway-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: roadClass(['motorway']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.motorwayCasing, 'line-width': z([[6, 1], [18, 26]]) },
      },
      {
        id: 'road-motorway', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: roadClass(['motorway']),
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.motorway, 'line-width': z([[6, 0.6], [18, 22]]) },
      },
      {
        id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
        filter: ['all', ['match', ['get', 'class'], ['rail', 'transit'], true, false], notTunnel],
        paint: { 'line-color': p.rail, 'line-width': z([[11, 0.6], [17, 2.2]]) },
      },
      {
        id: 'building-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 15,
        paint: {
          'fill-extrusion-vertical-gradient': false,
          'fill-extrusion-color': p.extrusion,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 0.8],
        },
      },
      {
        id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary', minzoom: 9,
        filter: ['all', ['==', ['get', 'admin_level'], 6], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': p.boundary, 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.6 },
      },
      // Beschriftung
      {
        id: 'label-water', type: 'symbol', source: 'omt', 'source-layer': 'waterway', minzoom: 12,
        filter: ['==', ['get', 'class'], 'river'],
        layout: {
          'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Italic'],
          'text-size': 13, 'text-letter-spacing': 0.2, 'symbol-spacing': 400,
        },
        paint: { 'text-color': p.labelWater, 'text-halo-color': p.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'label-road', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 14,
        filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'minor', 'trunk'], true, false],
        layout: {
          'symbol-placement': 'line', 'text-field': name, 'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10.5, 18, 14],
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.6 },
      },
      {
        id: 'label-quarter', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 12.5,
        filter: ['match', ['get', 'class'], ['neighbourhood', 'quarter'], true, false],
        layout: {
          'text-field': name, 'text-font': ['Noto Sans Regular'], 'text-size': 11.5,
          'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.5, 'text-opacity': 0.85 },
      },
      {
        id: 'label-suburb', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 10.5, maxzoom: 15,
        filter: ['match', ['get', 'class'], ['suburb', 'village', 'hamlet'], true, false],
        layout: {
          'text-field': name, 'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 14, 14],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.14, 'text-max-width': 8,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.8 },
      },
      {
        id: 'label-town', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 8, maxzoom: 14,
        filter: ['match', ['get', 'class'], ['town', 'city'], true, false],
        layout: {
          'text-field': name, 'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 12, 12, 17],
          'text-max-width': 8,
        },
        paint: { 'text-color': p.labelStrong, 'text-halo-color': p.halo, 'text-halo-width': 2 },
      },
    ],
  };
}
