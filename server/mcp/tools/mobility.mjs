// Werkzeuge für Weg, Abfahrten, Bahn, Verkehr, Unfälle und Parken.
import { departures } from '../../sources/efa.mjs';
import { approaching } from '../../sources/vehicles.mjs';
import { route } from '../../sources/routing.mjs';
import { puenktlichkeitJetzt, puenktlichkeitTage } from '../../sources/gtfsrt.mjs';
import { bahnHbf, bahnHistorie } from '../../sources/db.mjs';
import { ankuenfteHbf, anschluss } from '../../sources/anschluss.mjs';
import { aufzuege } from '../../sources/aufzuege.mjs';
import { traffic } from '../../sources/traffic.mjs';
import { bikeRoutes, roadworks } from '../../sources/roadworks.mjs';
import { unfaelle, unfallStatistik } from '../../sources/unfall.mjs';
import { bikeAndRide, parkAndRide, parking, radzaehler } from '../../sources/parking.mjs';
import { sharing } from '../../sources/sharing.mjs';
import { tankpreise } from '../../sources/tanken.mjs';
import { laden } from '../../sources/nearby.mjs';
import { distanceMeters, toolError } from '../util.mjs';
import {
  COORD, bool, defineTool, enumStr, int, obj, resolvePlace, resolveStop, str, takeWithNote,
} from './shared.mjs';

const MODES = ['oepnv', 'fuss', 'rad', 'auto'];
const PROFILES = ['standard', 'rollstuhl', 'kinderwagen'];

async function routePoint(value, role) {
  const s = String(value ?? '').trim();
  if (!s) throw toolError(`${role} fehlt.`);
  if (/^de:\d{5}:\d+$/.test(s) || /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(s)) return { arg: s, label: s };
  const p = await resolvePlace(s, { label: role });
  return { arg: `${p.lat},${p.lon}`, label: p.label ?? s };
}

function nearby(items, center, radius, get = (x) => x) {
  if (!center) return items;
  return items
    .map((x) => {
      const o = get(x);
      return { ...x, distanzM: Number.isFinite(o?.lat) && Number.isFinite(o?.lon) ? distanceMeters(center.lat, center.lon, o.lat, o.lon) : null };
    })
    .filter((x) => x.distanzM == null || x.distanzM <= radius)
    .sort((a, b) => (a.distanzM ?? 1e9) - (b.distanzM ?? 1e9));
}

export const mobilityTools = [
  defineTool({
    name: 'geocode',
    title: 'Ort, Adresse oder Haltestelle finden',
    description: 'Verortet Adressen, Straßen, Orte, Haltestellen und Sehenswürdigkeiten in Stuttgart. scope="auto" nutzt den amtlichen gis6-Geocoder, scope="stop" den EFA-Haltestellenfinder, scope="place" den EFA-Stopfinder für Orte und Adressen. Liefert Koordinaten (WGS84), Typ und Quelle. Beispiele: „Marienplatz 1“, „Charlottenplatz“, „Schloss Solitude“.',
    sources: ['gis6', 'efa'],
    cost: 1,
    inputSchema: obj({
      q: str('Suchbegriff, mindestens 2 Zeichen.', { minLength: 2, maxLength: 200 }),
      scope: enumStr('auto = amtlicher Geocoder, stop = nur Haltestellen, place = EFA-Ortssuche.', ['auto', 'stop', 'place'], { default: 'auto' }),
      limit: int('Maximale Anzahl Treffer (1–20).', { minimum: 1, maximum: 20, default: 5 }),
    }, ['q']),
    async execute(a) {
      const { geocode } = await import('../../sources/schnittstellen.mjs');
      const { searchStops } = await import('../../sources/efa.mjs');
      const { ortSuche } = await import('../../sources/routing.mjs');
      if (a.scope === 'stop') return { data: await searchStops(a.q) };
      if (a.scope === 'place') return { data: await ortSuche(a.q) };
      const [official, ort] = await Promise.allSettled([geocode(a.q, a.limit), ortSuche(a.q)]);
      return {
        data: {
          items: official.status === 'fulfilled' ? official.value.items : [],
          orte: ort.status === 'fulfilled' ? ort.value.results : [],
          source: 'Landeshauptstadt Stuttgart, gis6 Location Finder; EFA-BW Stopfinder',
        },
        limits: [
          official.status === 'rejected' ? `Amtlicher Geocoder derzeit nicht erreichbar (${official.reason?.message ?? 'Fehler'}).` : null,
        ],
      };
    },
  }),

  defineTool({
    name: 'plan_route',
    title: 'Route planen',
    description: 'Berechnet eine Route von A nach B mit EFA-BW/Valhalla/OSRM: ÖPNV mit Echtzeit, zu Fuß, mit dem Rad oder dem Auto. Profile „rollstuhl“ und „kinderwagen“ nur für ÖPNV und zu Fuß. Start und Ziel dürfen Adressen, Ortsnamen, Haltestellen-IDs (de:08111:…) oder „lat,lon“ sein. Liefert Varianten mit Dauer, Umstiegen, Ab-/Ankunft, Hinweisen und Quellen.',
    sources: ['efa', 'osm', 'parkapi'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      from: str('Start: Adresse, Ort, Haltestellen-ID oder „lat,lon“.', { maxLength: 300 }),
      to: str('Ziel: Adresse, Ort, Haltestellen-ID oder „lat,lon“.', { maxLength: 300 }),
      mode: enumStr('Verkehrsmittel.', MODES, { default: 'oepnv' }),
      profile: enumStr('Barrierefreiheit (nur ÖPNV und zu Fuß).', PROFILES, { default: 'standard' }),
      time: str('Gewünschte Abfahrts- oder Ankunftszeit als ISO-8601, z. B. 2026-10-24T19:30:00+02:00.', { maxLength: 40 }),
      arrive_by: bool('true = time ist die Ankunftszeit; false/leer = Abfahrtszeit.', { default: false }),
    }, ['from', 'to']),
    async execute(a) {
      const [from, to] = await Promise.all([routePoint(a.from, 'Start'), routePoint(a.to, 'Ziel')]);
      const r = await route({
        von: from.arg,
        nach: to.arg,
        modus: a.mode ?? 'oepnv',
        profil: a.profile ?? 'standard',
        zeit: a.time,
        ankunft: a.arrive_by,
      });
      return {
        data: { ...r, startLabel: from.label, zielLabel: to.label },
        limits: (r.hinweise ?? []).slice(0, 4),
      };
    },
  }),

  defineTool({
    name: 'departures',
    title: 'Nächste Abfahrten',
    description: 'Zeigt die nächsten Abfahrten an einer Stuttgarter Haltestelle mit Linie, Ziel, Soll- und Ist-Zeit, Verspätung, Steig und Ausfällen. Optional mit berechneten Fahrzeugpositionen (keine GPS-Daten) für die nächsten 30 Minuten. Haltestelle als Name („Charlottenplatz“) oder EFA-ID („de:08111:6115“).',
    sources: ['efa', 'gtfsrt'],
    cost: 2,
    timeoutMs: 30_000,
    inputSchema: obj({
      stop: str('Haltestellenname oder EFA-ID.', { maxLength: 120 }),
      at: str('Optionaler Zeitpunkt als ISO-8601; leer = jetzt.', { maxLength: 40 }),
      limit: int('Maximale Anzahl Abfahrten (1–40).', { minimum: 1, maximum: 40, default: 12 }),
      include_vehicles: bool('Berechnete Fahrzeugpositionen ergänzen (Standard false, teurer Abruf).', { default: false }),
    }, ['stop']),
    async execute(a) {
      const stop = await resolveStop(a.stop);
      const [d, v] = await Promise.all([
        departures(stop.id, a.at),
        a.include_vehicles ? approaching(stop.id).catch(() => null) : Promise.resolve(null),
      ]);
      const { shown, limits } = takeWithNote(d.departures ?? [], a.limit ?? 12, 'Abfahrten');
      if (!d.realtimeAvailable) limits.push('EFA-BW liefert für diese Haltestelle keine Ist-Zeiten; die Soll-Zeiten gelten.');
      return {
        data: { ...d, stop: { ...d.stop, name: d.stop?.name ?? stop.name }, departures: shown, ...(v ? { vehicles: v } : {}) },
        limits,
      };
    },
  }),

  defineTool({
    name: 'transit',
    title: 'Bahn, Pünktlichkeit, Anschluss, Aufzüge',
    description: 'Sammelwerkzeug für den Bahn- und Nahverkehr: topic="punctuality" liefert die Pünktlichkeit der letzten 60 Minuten (optional days für das Tagesarchiv), topic="rail" Abfahrten/Ankünfte am Hauptbahnhof oder die Monatshistorie, topic="transfer" prüft einen Anschluss (ohne arrival_key kommt die Ankunftsliste), topic="elevators" den Live-Status der DB-Aufzüge.',
    sources: ['gtfsrt', 'db', 'efa'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      topic: enumStr('Thema.', ['punctuality', 'rail', 'transfer', 'elevators'], { default: 'punctuality' }),
      days: int('Für topic="punctuality": Anzahl Archivtage (1–31); leer = letzte 60 Minuten.', { minimum: 1, maximum: 31 }),
      part: enumStr('Für topic="rail": Umfang.', ['all', 'history'], { default: 'all' }),
      arrival_key: str('Für topic="transfer": Schlüssel aus der Ankunftsliste (Feld key).', { maxLength: 80 }),
      line: str('Für topic="transfer": abfahrende Linie, z. B. „U5“ oder „S1“.', { maxLength: 20 }),
      destination: str('Für topic="transfer": Richtung/Ziel der abfahrenden Linie.', { maxLength: 120 }),
    }),
    async execute(a) {
      if (a.topic === 'elevators') return { data: await aufzuege() };
      if (a.topic === 'rail') {
        if (a.part === 'history') return { data: await bahnHistorie() };
        return { data: await bahnHbf() };
      }
      if (a.topic === 'transfer') {
        if (!a.arrival_key) {
          const r = await ankuenfteHbf();
          return {
            data: r,
            hint: 'Mit arrival_key (Feld key einer Ankunft), line und optional destination den Anschluss prüfen.',
          };
        }
        if (!a.line) throw toolError('Für topic="transfer" wird line benötigt, z. B. „U5“.');
        return { data: await anschluss(a.arrival_key, a.line, a.destination) };
      }
      if (a.days) return { data: await puenktlichkeitTage(a.days) };
      return { data: await puenktlichkeitJetzt() };
    },
  }),

  defineTool({
    name: 'traffic',
    title: 'Verkehr und Baustellen',
    description: 'Aktuelle Verkehrsmeldungen (Unfälle, Staus, Sperrungen, Baustellen) aus DATEX II und Autobahn GmbH, Baustellen des Tiefbauamts mit Zeitraum und Wirkung sowie das städtische Hauptradroutennetz. topic="all" liefert alle drei Bereiche. Für „warum steht es?“ zuerst topic="incidents".',
    sources: ['datex', 'autobahn', 'stuttgartGeo'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      topic: enumStr('Bereich.', ['all', 'incidents', 'roadworks', 'bike_routes'], { default: 'all' }),
      limit: int('Maximale Anzahl Einträge je Bereich (1–100).', { minimum: 1, maximum: 100, default: 15 }),
    }),
    async execute(a) {
      const lim = a.limit ?? 15;
      const out = {};
      const limits = [];
      if (a.topic === 'all' || a.topic === 'incidents') {
        const r = await traffic();
        out.incidents = { ...r, items: (r.items ?? []).slice(0, lim) };
        if (r.items?.length > lim) limits.push(`Verkehrsmeldungen: ${lim} von ${r.items.length} angezeigt.`);
        if (!r.lmsVerfuegbar) limits.push('Landesmeldestelle DATEX II derzeit nicht erreichbar.');
      }
      if (a.topic === 'all' || a.topic === 'roadworks') {
        const r = await roadworks();
        out.roadworks = { ...r, items: (r.items ?? []).slice(0, lim) };
        if (r.items?.length > lim) limits.push(`Baustellen: ${lim} von ${r.items.length} angezeigt.`);
      }
      if (a.topic === 'all' || a.topic === 'bike_routes') {
        const r = await bikeRoutes();
        out.bikeRoutes = { ...r, features: (r.features ?? []).slice(0, lim) };
      }
      return { data: out, limits };
    },
  }),

  defineTool({
    name: 'accidents',
    title: 'Unfallatlas',
    description: 'Unfälle mit Personenschaden in Stuttgart aus dem Unfallatlas 2025: im Umkreis einer Adresse/Koordinate (Radius bis 5 km), im Kartenausschnitt oder als Stadtstatistik. Filter nach Beteiligung (Rad, Fuß, Pkw, Krad, Güterverkehr) und Schwere (tödlich, schwer, leicht).',
    sources: ['unfallatlas'],
    cost: 2,
    inputSchema: obj({
      address: str('Adresse oder Ort für den Umkreis; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      radius: int('Radius in Metern (50–5000).', { minimum: 50, maximum: 5000, default: 500 }),
      bbox: str('Kartenausschnitt „minLon,minLat,maxLon,maxLat“ (nur ohne lat/lon).', { maxLength: 120 }),
      art: enumStr('Beteiligung.', ['alle', 'rad', 'fuss', 'pkw', 'krad', 'gkfz', 'sonstige'], { default: 'alle' }),
      severity: enumStr('Schwere.', ['alle', 'tote', 'schwer', 'leicht'], { default: 'alle' }),
      limit: int('Maximale Anzahl Unfälle (1–500).', { minimum: 1, maximum: 500, default: 100 }),
      statistics: bool('Nur Stadtstatistik und Schwerpunkte, ohne Einzelfälle.', { default: false }),
    }),
    async execute(a) {
      if (a.statistics) return { data: unfallStatistik() };
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon) };
      else if (a.address) center = await resolvePlace(a.address);
      const r = unfaelle({
        ...(center ? { lat: center.lat, lon: center.lon, r: a.radius } : {}),
        ...(a.bbox ? { bbox: a.bbox } : {}),
        art: a.art,
        schwere: a.severity,
        limit: a.limit,
      });
      return {
        data: r,
        limits: [
          'Unfallatlas: Angaben ohne Gewähr; die amtliche Unfallstatistik kann abweichen.',
          r.total > (a.limit ?? 100) ? `${a.limit} von ${r.total} Unfällen angezeigt.` : null,
        ],
      };
    },
  }),

  defineTool({
    name: 'parking',
    title: 'Parken, Sharing, Laden, Tanken',
    description: 'Live-Informationen rund ums Auto und Rad: Parkhäuser mit freien Plätzen (kind="car"), Park+Ride (kind="park_and_ride"), Bike+Ride und Schließfächer (kind="bike_and_ride"), Sharing-Fahrzeuge (kind="sharing"), Fahrradzählstellen (kind="bike_counters"), Ladepunkte (kind="charging") und Kraftstoffpreise (kind="fuel"). Optional nach Nähe zu Adresse oder Koordinate filtern.',
    sources: ['parkapi', 'gbfs', 'mobidata', 'ocpdb', 'tankerkoenig', 'ecocounter'],
    cost: 3,
    timeoutMs: 45_000,
    inputSchema: obj({
      kind: enumStr('Art der Anlage.', ['car', 'park_and_ride', 'bike_and_ride', 'sharing', 'bike_counters', 'charging', 'fuel'], { default: 'car' }),
      address: str('Nähe zu dieser Adresse; alternativ lat/lon.', { maxLength: 200 }),
      ...COORD,
      radius: int('Umkreis in Metern (100–5000).', { minimum: 100, maximum: 5000, default: 1500 }),
      limit: int('Maximale Anzahl Treffer (1–100).', { minimum: 1, maximum: 100, default: 15 }),
      purpose: enumStr('Für bike_and_ride: nur Fahrradboxen oder nur Schließfächer.', ['all', 'BIKE', 'ITEM'], { default: 'all' }),
      plz: str('Postleitzahl für charging (Standard 70173).', { maxLength: 5 }),
    }),
    async execute(a) {
      const limit = a.limit ?? 15;
      let center = null;
      if (Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lon))) center = { lat: Number(a.lat), lon: Number(a.lon) };
      else if (a.address) center = await resolvePlace(a.address);
      const radius = a.radius ?? 1500;

      if (a.kind === 'fuel') {
        const r = await tankpreise();
        return { data: { ...r, stations: (r.stations ?? []).slice(0, limit) }, limits: ['Preise ohne Gewähr; maßgeblich ist die Zapfsäule.'] };
      }
      if (a.kind === 'charging') {
        const c = center ?? { lat: 48.7758, lon: 9.1829 };
        const r = await laden(c.lat, c.lon, a.plz ?? '70173');
        return { data: { ...r, items: (r.items ?? []).slice(0, limit) }, limits: ['Live-Verfügbarkeit je Ladepunkt kann sich minütlich ändern.'] };
      }
      if (a.kind === 'sharing') {
        const r = await sharing();
        const items = nearby(r.items ?? [], center, center ? radius : Infinity, (x) => x).slice(0, limit);
        return { data: { ...r, items, gesamt: r.items?.length ?? 0 }, limits: center ? null : ['Ohne Standort sind die ersten Fahrzeuge geliefert; für Nähe lat/lon oder address angeben.'] };
      }
      if (a.kind === 'bike_counters') {
        const r = await radzaehler();
        const items = nearby(r.stations ?? r.items ?? [], center, center ? radius : Infinity, (x) => x).slice(0, limit);
        return { data: { ...r, stations: items } };
      }
      if (a.kind === 'bike_and_ride') {
        const r = await bikeAndRide(null, center?.lat, center?.lon, {
          purpose: a.purpose && a.purpose !== 'all' ? a.purpose : null,
          radius,
        });
        return { data: { ...r, sites: (r.sites ?? []).slice(0, limit) } };
      }
      if (a.kind === 'park_and_ride') {
        const r = await parkAndRide();
        const sites = nearby(r.sites ?? [], center, center ? radius : Infinity, (x) => x).slice(0, limit);
        return { data: { ...r, sites, gesamt: r.sites?.length ?? 0 } };
      }
      const r = await parking();
      const filtered = nearby(r.sites ?? [], center, center ? radius : Infinity);
      const sites = (center ? filtered : filtered.sort((a, b) => (b.free ?? -1) - (a.free ?? -1))).slice(0, limit);
      return { data: { ...r, sites, gesamt: r.sites?.length ?? 0 } };
    },
  }),
];
