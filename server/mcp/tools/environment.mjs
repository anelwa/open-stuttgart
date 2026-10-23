// Werkzeuge für Wetter, Luft, Wasser, Klima, Natur und Gesundheit.
import { air, warnungen, water, weather } from '../../sources/environment.mjs';
import { radar } from '../../sources/radar.mjs';
import { kaltluft, kessel } from '../../sources/kessel.mjs';
import { beobachtungen, giessRadar, pollenKarte } from '../../sources/natur.mjs';
import { gbif, foodsharing, osmNotes } from '../../sources/schnittstellen.mjs';
import { gesundheit, gruenstrom } from '../../sources/nearby.mjs';
import { hitze } from '../../sources/hitze.mjs';
import { toolError } from '../util.mjs';
import { COORD, bool, defineTool, enumStr, int, num, obj, optionalCenter, str } from './shared.mjs';

export const environmentTools = [
  defineTool({
    name: 'weather',
    title: 'Wetter, Warnungen, Radar',
    description: 'Aktuelles Wetter und 24-Stunden-Vorhersage für Stuttgart vom DWD über Bright Sky, optional amtliche Bevölkerungsschutz-Warnungen (BBK NINA/MoWaS mit Warngebiet und nächstem Notfall-Treffpunkt) und das Regenradar der letzten Stunde plus 50-Minuten-Vorhersage. Für „Regnet es gleich?“ include_radar=true.',
    sources: ['dwd', 'brightsky', 'nina'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      include_warnings: bool('Amtliche Warnungen (BBK NINA) mitliefern (Standard true).', { default: true }),
      include_radar: bool('Regenradar-Frames mitliefern (Standard false).', { default: false }),
    }),
    async execute(a) {
      const [w, warns, rad] = await Promise.all([
        weather(),
        a.include_warnings === false ? Promise.resolve(null) : warnungen().catch((err) => ({ error: err.message, items: [] })),
        a.include_radar ? radar().catch((err) => ({ error: err.message })) : Promise.resolve(null),
      ]);
      return {
        data: { weather: w, ...(warns ? { warnings: warns } : {}), ...(rad ? { radar: rad } : {}) },
        limits: [
          'Wetter ist eine Momentaufnahme der nächsten DWD-Station; lokale Abweichungen im Talkessel sind möglich.',
          ...(warns?.error ? [`Warnungen: ${warns.error}`] : []),
        ],
      };
    },
  }),

  defineTool({
    name: 'air_quality',
    title: 'Luftqualität',
    description: 'Aktuelle Luftqualität an den vier Stuttgarter UBA-Messstationen (Bad Cannstatt, Hohenheimer Straße, Am Neckartor, Hauptstätter Straße): UBA-Index, PM10, PM2,5, Ozon und Stickstoffdioxid mit 24-Stunden-Verlauf. Angaben mit Messzeit und Quelle.',
    sources: ['uba'],
    cost: 3,
    timeoutMs: 30_000,
    inputSchema: obj({}),
    async execute() {
      return { data: await air() };
    },
  }),

  defineTool({
    name: 'water',
    title: 'Neckarpegel',
    description: 'Wasserstand des Neckars am Pegel Cannstatt (PEGELONLINE) mit aktuellem Wert, Einheit, Messzeit, Hochwasser-/Niedrigwasserstatus und Verlauf der letzten 24 Stunden.',
    sources: ['pegel'],
    cost: 2,
    timeoutMs: 30_000,
    inputSchema: obj({}),
    async execute() {
      return { data: await water() };
    },
  }),

  defineTool({
    name: 'climate',
    title: 'Luftaustausch im Talkessel',
    description: 'Einschätzung des Luftaustauschs über Stuttgart: Modellwerte (Temperatur, Grenzschichthöhe, Wind) und gemessenes Höhenprofil für „Kessel“ sowie Kaltluftleitbahnen und Klimatope aus dem Klimaatlas für „Kaltluft“. Nützlich bei Inversionswetterlagen und für Abendspaziergänge.',
    sources: ['openmeteo', 'sensocommunity', 'stadtklima'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      topic: enumStr('Thema.', ['all', 'kessel', 'kaltluft'], { default: 'all' }),
    }),
    async execute(a) {
      const out = {};
      if (a.topic === 'all' || a.topic === 'kessel') out.kessel = await kessel();
      if (a.topic === 'all' || a.topic === 'kaltluft') out.kaltluft = await kaltluft();
      return { data: out, limits: ['Modellwerte, keine amtliche Messung; die Kaltluftkarte ist eine Planungsgrundlage.'] };
    },
  }),

  defineTool({
    name: 'nature',
    title: 'Stadt-Natur',
    description: 'Natur vor der Haustür: verifizierte Artenbeobachtungen von iNaturalist mit freien Fotos (topic="observations"), GBIF-Artenvorkommen (topic="gbif"), offene OpenStreetMap-Hinweise (topic="osm_notes"), Fairteiler von foodsharing (topic="foodsharing"), Gieß-Radar für Jungbäume mit Regenbilanz und nächstem Brunnen (topic="watering") oder Pollen-Hotspots aus dem Baumkataster (topic="pollen"). Für observations, gbif, osm_notes und watering werden lat/lon oder eine Adresse benötigt.',
    sources: ['inaturalist', 'gbif', 'osm', 'foodsharing', 'dwd', 'stuttgartGeo'],
    cost: 3,
    timeoutMs: 60_000,
    inputSchema: obj({
      topic: enumStr('Thema.', ['observations', 'gbif', 'osm_notes', 'foodsharing', 'watering', 'pollen'], { default: 'observations' }),
      address: str('Adresse oder Ort; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      radius_km: num('Radius in Kilometern für Beobachtungen und GBIF (0,3–10).', { minimum: 0.3, maximum: 10, default: 2 }),
      radius_m: int('Radius in Metern für OSM-Hinweise (100–5000).', { minimum: 100, maximum: 5000, default: 1500 }),
    }),
    async execute(a) {
      if (a.topic === 'foodsharing') return { data: await foodsharing() };
      if (a.topic === 'pollen') return { data: await pollenKarte() };
      const center = await optionalCenter({ lat: a.lat, lon: a.lon, near: a.address });
      if (a.topic === 'observations') {
        if (!center) throw toolError('Für Artbeobachtungen bitte lat/lon oder address angeben.');
        return { data: await beobachtungen(center.lat, center.lon, a.radius_km ?? 2) };
      }
      if (a.topic === 'gbif') {
        if (!center) throw toolError('Für GBIF bitte lat/lon oder address angeben.');
        return { data: await gbif(center.lat, center.lon, Math.round((a.radius_km ?? 2) * 1000)) };
      }
      if (a.topic === 'osm_notes') {
        const c = center ?? { lat: 48.7758, lon: 9.1829 };
        return { data: await osmNotes(c.lat, c.lon, a.radius_m ?? 1500) };
      }
      if (a.topic === 'watering') {
        if (!center) throw toolError('Für das Gieß-Radar bitte lat/lon oder address angeben.');
        return { data: await giessRadar(center.lat, center.lon) };
      }
      throw toolError('Unbekanntes Naturthema.');
    },
  }),

  defineTool({
    name: 'health',
    title: 'Gesundheit, Hitze, Grünstrom',
    description: 'Gesundheit und Energie für Stuttgart: Pollenflug und UV-Index (DWD), amtliche Hitzewarnung und Hitzetrend, Biowetter und gefühlte Temperatur (topic="all" oder "heat"), Zustand des Stromnetzes (topic="grid") und Grünstrom-Anteil im regionalen Netz mit bestem Zeitfenster (topic="green_power"). Optional mit Postleitzahl für den Grünstrom-Index.',
    sources: ['dwd', 'stromgedacht', 'energycharts'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      topic: enumStr('Thema.', ['all', 'pollen', 'uv', 'heat', 'grid', 'green_power'], { default: 'all' }),
      plz: str('Postleitzahl für den Grünstrom-Index (Standard 70173).', { maxLength: 5 }),
    }),
    async execute(a) {
      const plz = /^\d{5}$/.test(a.plz ?? '') ? a.plz : '70173';
      if (a.topic === 'green_power') return { data: await gruenstrom(plz) };
      if (a.topic === 'heat') return { data: await hitze() };
      if (a.topic === 'pollen') return { data: await pollenKarte() };
      const g = await gesundheit(plz);
      if (a.topic === 'uv') return { data: { uv: g.uv ?? null, source: g.source } };
      if (a.topic === 'grid') return { data: { strom: g.strom ?? null, source: g.source } };
      return { data: g, limits: ['Angaben des DWD und von TransnetBW; keine medizinische Beratung.'] };
    },
  }),
];
