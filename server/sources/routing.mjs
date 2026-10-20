// Routensuche für Open Stuttgart, Stufe 1 (siehe Bericht „Routing und Gastronomie“, Abschnitt 6).
//   modus=oepnv → EFA-BW XML_TRIP_REQUEST2 (NVBW, dl-de/by-2-0): Tür zu Tür, Echtzeit, Rollstuhl-/Kinderwagenprofil
//   modus=fuss  → Valhalla pedestrian (FOSSGIS e. V.) mit Höhenprofil
//   modus=rad   → Valhalla bicycle („Pedelec“) und BRouter trekking („Fahrrad“, rechnet Steigungen ein)
//   modus=auto  → OSRM car (FOSSGIS e. V.), dazu freie Parkhäuser am Ziel
// Ortssuche für Start und Ziel über den EFA-Stopfinder (Haltestellen, Adressen, Orte), kein eigener Geocoder.
//
// Rücksicht auf die Dienste: höflicher Abruf je Host aus cache.mjs (FOSSGIS und BRouter höchstens 1 Anfrage/s),
// Koordinaten auf 4 Nachkommastellen gerundet, Zeit auf 2 Minuten. Zwischenspeicher: ÖPNV 60 s, sonst 24 h.
// Transitous/MOTIS wird bewusst nicht genutzt (Routing nur nach vorheriger Absprache mit den Betreibern).
import { cached, fetchJson } from '../cache.mjs';
import { aufzuegeNahe, distanzM } from './aufzuege.mjs';
import { sharing } from './sharing.mjs';
import { parking } from './parking.mjs';

const EFA = 'https://www.efa-bw.de/nvbw';
const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const OSRM = 'https://routing.openstreetmap.de/routed-car/route/v1/driving';
const BROUTER = 'https://brouter.de/brouter';

const OSM = 'Kartendaten © OpenStreetMap-Mitwirkende (ODbL 1.0)';
const QUELLE = {
  oepnv: 'EFA-BW (NVBW), dl-de/by-2-0; Aufzugsstatus: DB InfraGO OpenStation (SIRI-FM), Aufzugsdaten: BFRK der NVBW (dl-de/by-2-0)',
  fuss: `Valhalla (FOSSGIS e. V.), ${OSM}`,
  rad: `Valhalla (FOSSGIS e. V.) und BRouter (brouter.de), ${OSM}`,
  auto: `OSRM (FOSSGIS e. V.), ${OSM}; Parkhäuser: Stadt Stuttgart / PBW über MobiData BW`,
};
const EFA_QUELLE = 'EFA-BW (NVBW), dl-de/by-2-0';

const MODI = ['oepnv', 'fuss', 'rad', 'auto'];
const PROFILE = ['standard', 'rollstuhl', 'kinderwagen'];
const TAG = 24 * 3600_000;

const fehler = (msg) => Object.assign(new Error(msg), { status: 400 });
const r4 = (x) => Math.round(x * 1e4) / 1e4;

// ---------- Zeit: EFA liefert UTC, die Demo zeigt Europe/Berlin ----------

const fmtBerlin = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function berlinTeile(d) {
  const p = Object.fromEntries(fmtBerlin.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Abstand Europe/Berlin zu UTC in Minuten (60 oder 120). */
function berlinOffsetMin(d) {
  const t = berlinTeile(d);
  return Math.round((Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi, t.s) - Math.floor(+d / 1000) * 1000) / 60000);
}

const pad = (n) => String(n).padStart(2, '0');

/** ISO-Zeit mit Offset in Europe/Berlin, z. B. 2026-10-21T07:57:00+02:00 */
export function berlinIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return null;
  const off = berlinOffsetMin(d);
  const local = new Date(+d + off * 60000).toISOString().slice(0, 19);
  const sign = off >= 0 ? '+' : '-';
  return `${local}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/** Zeitangabe aus der Anfrage: ISO mit Offset oder ohne (dann Ortszeit Stuttgart). Auf 2 Minuten abgerundet. */
function zeitAusAnfrage(zeit) {
  if (zeit == null || String(zeit).trim() === '') return null;
  const s = String(zeit).trim();
  let ms;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) ms = Date.parse(s);
  else {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (!m) throw fehler('Ungültige Zeitangabe (erwartet ISO 8601, z. B. 2026-10-21T08:00)');
    const naiv = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
    ms = naiv - berlinOffsetMin(new Date(naiv)) * 60000;
    ms = naiv - berlinOffsetMin(new Date(ms)) * 60000; // Umstellungstage
  }
  if (!Number.isFinite(ms)) throw fehler('Ungültige Zeitangabe');
  return new Date(Math.floor(ms / 120_000) * 120_000);
}

function efaDatumZeit(d) {
  const t = berlinTeile(d);
  return { date: `${t.y}${pad(t.mo)}${pad(t.d)}`, time: `${pad(t.h)}${pad(t.mi)}` };
}

// ---------- Orte: „lat,lon“ oder EFA-Kennung ----------

function parseOrt(v, rolle) {
  const s = String(v ?? '').trim();
  if (!s) throw fehler(`${rolle} fehlt`);
  const m = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(s);
  if (m) {
    const lat = r4(+m[1]);
    const lon = r4(+m[2]);
    // Baden-Württemberg mit Rand; die Fahrplanauskunft deckt ohnehin nur das Land ab
    if (lat < 47.4 || lat > 49.9 || lon < 7.4 || lon > 10.6) throw fehler(`${rolle} liegt außerhalb von Baden-Württemberg`);
    return { lat, lon, key: `${lat},${lon}` };
  }
  if (s.length > 300 || /[\u0000-\u001f]/.test(s)) throw fehler(`${rolle}: ungültige Angabe`);
  return { id: s, key: s };
}

async function stopfinder(name, typ = 'any') {
  const url = `${EFA}/XML_STOPFINDER_REQUEST?outputFormat=rapidJSON&coordOutputFormat=${encodeURIComponent('WGS84[dd.ddddd]')}` +
    `&type_sf=${typ}&name_sf=${encodeURIComponent(name)}`;
  const d = await fetchJson(url, { timeout: 20000 });
  return d.locations ?? [];
}

/** Koordinate zu einem Ort; EFA-Kennungen werden über den Stopfinder aufgelöst (24 h zwischengespeichert). */
async function ortKoordinate(o) {
  if (o.lat != null) return o;
  const { value } = await cached(`ortkoord:${o.id}`, TAG, async () => {
    const locs = await stopfinder(o.id, /^de:\d{5}:\d+$/.test(o.id) ? 'stop' : 'any');
    const l = locs.find((x) => Array.isArray(x.coord));
    if (!l) throw fehler('Ort nicht gefunden');
    return { lat: r4(l.coord[0]), lon: r4(l.coord[1]), label: l.name ?? null };
  });
  return { ...o, ...value };
}

// ---------- Geometrie ----------

/** Valhalla-Polyline mit 6 Nachkommastellen → [[lon, lat], …] */
function decodePolyline6(str) {
  const out = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += delta; else lon += delta;
    }
    out.push([lon / 1e6, lat / 1e6]);
  }
  return out;
}

const laenge = (geo) => geo.reduce((s, p, i) => (i ? s + distanzM(geo[i - 1][1], geo[i - 1][0], p[1], p[0]) : 0), 0);

/** Höhenmeter mit einfacher Hysterese (kleine Schwankungen des Höhenmodells unter `schwelle` zählen nicht). */
function hoehenmeter(werte, schwelle = 3) {
  const w = (werte ?? []).filter((v) => Number.isFinite(v));
  if (w.length < 2) return { auf: null, ab: null };
  let auf = 0, ab = 0, ref = w[0];
  for (const v of w) {
    const d = v - ref;
    if (d >= schwelle) { auf += d; ref = v; } else if (d <= -schwelle) { ab -= d; ref = v; }
  }
  return { auf: Math.round(auf), ab: Math.round(ab) };
}

const meterText = (m) => (m >= 1000 ? `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km` : `${Math.round(m / 10) * 10 || Math.round(m)} m`);

// ---------- ÖPNV über EFA ----------

function artAusKlasse(cls) {
  // EFA-Produktklassen wie in efa.mjs; 97 = im Fahrzeug bleiben, 98–100 = Fußweg
  switch (cls) {
    case 0: case 13: case 14: case 15: case 16: return 'zug';
    case 1: return 'sbahn';
    case 2: case 3: case 4: return 'stadtbahn';
    case 8: return 'zahnrad';
    case 10: return 'rufbus';
    case 97: return 'sitzenbleiben';
    case 98: case 99: case 100: return 'fuss';
    case 105: return 'taxi';
    case 107: return 'rad';
    default: return 'bus';
  }
}

const ortName = (p) => (p?.type === 'platform' ? p.parent?.disassembledName ?? p.name : p?.disassembledName ?? p?.name) ?? null;
const stationId = (p) => {
  const id = p?.type === 'platform' ? p.parent?.id ?? p.id : p?.id;
  return /^de:\d{5}:\d+/.test(id ?? '') ? id.split(':').slice(0, 3).join(':') : null;
};
const ll = (c) => (Array.isArray(c) ? [c[1], c[0]] : null); // EFA [lat, lon] → [lon, lat]

const RICHTUNG = {
  LEFT: 'links', RIGHT: 'rechts', SLIGHT_LEFT: 'halblinks', SLIGHT_RIGHT: 'halbrechts',
  SHARP_LEFT: 'scharf links', SHARP_RIGHT: 'scharf rechts', STRAIGHT: 'geradeaus',
};

function efaAnweisung(p) {
  const name = (p.name ?? '').trim();
  const dir = RICHTUNG[p.turnDirection];
  let text;
  if (p.manoeuvre === 'TURN' && dir) text = `${dir[0].toUpperCase()}${dir.slice(1)} abbiegen${name ? `: ${name}` : ''}`;
  else text = name || null;
  if (!text) return null;
  return p.distance > 0 ? `${text}, ${meterText(p.distance)}` : text;
}

const TYP_INDOOR = { LIFT: 'aufzug', ELEVATOR: 'aufzug', STAIRS: 'treppe', ESCALATOR: 'rolltreppe', RAMP: 'rampe' };
const RICHTUNG_EBENE = { UP: 'aufwärts', DOWN: 'abwärts' };

function efaEbenenwechsel(l) {
  const out = [];
  for (const fp of l.footPathInfo ?? []) {
    for (const e of fp.footPathElem ?? []) {
      const typ = TYP_INDOOR[e.type];
      if (!typ) continue;
      const a = e.origin?.coord, b = e.destination?.coord;
      const lat = a && b ? (a[0] + b[0]) / 2 : (a ?? b)?.[0] ?? null;
      const lon = a && b ? (a[1] + b[1]) / 2 : (a ?? b)?.[1] ?? null;
      const von = e.origin?.name, nach = e.destination?.name;
      out.push({
        typ, richtung: RICHTUNG_EBENE[e.level] ?? null, ebeneVon: e.levelFrom ?? null, ebeneNach: e.levelTo ?? null,
        beschreibung: e.description || (von && nach && von !== nach ? `${von} → ${nach}` : von ?? nach ?? null),
        stufen: e.attributes?.numberSteps > 0 ? e.attributes.numberSteps : null,
        dauerSek: e.attributes?.duration || fp.duration || null,
        lat, lon, stationIds: uniq([stationId(e.origin), stationId(e.destination)]),
      });
    }
  }
  for (const p of l.pathDescriptions ?? []) {
    const typ = TYP_INDOOR[p.properties?.INDOOR_TYPE];
    if (!typ) continue;
    out.push({
      typ, richtung: RICHTUNG_EBENE[p.properties?.FLOOR_LEVEL_CHANGE_DIRECTION] ?? null,
      ebeneVon: null, ebeneNach: null, beschreibung: p.name || null, stufen: null,
      dauerSek: p.duration ?? null, lat: p.coord?.[0] ?? null, lon: p.coord?.[1] ?? null,
      stationIds: uniq([stationId(l.origin), stationId(l.destination)]),
    });
  }
  return out;
}

const uniq = (a) => [...new Set(a.filter(Boolean))];

function efaAbschnitt(l) {
  const cls = l.transportation?.product?.class;
  const art = artAusKlasse(cls);
  let geometrie = (l.coords ?? []).map(ll).filter(Boolean);
  // Ohne Linienverlauf (kommt bei einzelnen Fahrten vor) wenigstens die Halte verbinden
  if (geometrie.length < 2) geometrie = (l.stopSequence ?? []).map((h) => ll(h.coord)).filter(Boolean);
  const o = l.origin ?? {}, z = l.destination ?? {};
  const basis = {
    art,
    von: ortName(o), nach: ortName(z),
    vonId: o.type === 'platform' ? o.parent?.id ?? o.id : o.id ?? null,
    nachId: z.type === 'platform' ? z.parent?.id ?? z.id : z.id ?? null,
    ab: berlinIso(o.departureTimePlanned), abPrognose: berlinIso(o.departureTimeEstimated),
    an: berlinIso(z.arrivalTimePlanned), anPrognose: berlinIso(z.arrivalTimeEstimated),
    dauerMin: Math.round((l.duration ?? 0) / 60),
    meter: Math.round(l.distance ?? laenge(geometrie)),
    geometrie,
    stoerungen: uniq((l.infos ?? []).flatMap((i) => (i.infoLinks ?? []).map((x) => x.urlText ?? x.subtitle))),
  };
  if (art === 'fuss' || art === 'sitzenbleiben') {
    return {
      ...basis,
      anweisungen: (l.pathDescriptions ?? []).map(efaAnweisung).filter(Boolean),
      ebenenwechsel: efaEbenenwechsel(l),
    };
  }
  const t = l.transportation ?? {};
  const props = l.properties ?? {};
  const hoehe = props.vehicleAccess?.[0]?.height;
  const planned = o.departureTimePlanned, est = o.departureTimeEstimated;
  return {
    ...basis,
    linie: t.disassembledName ?? t.number ?? t.name ?? null,
    name: t.name ?? null,
    richtung: t.destination?.name ?? null,
    betreiber: t.operator?.name ?? null,
    steigVon: o.properties?.platformName ?? (o.type === 'platform' ? o.disassembledName : null) ?? null,
    steigNach: z.properties?.platformName ?? (z.type === 'platform' ? z.disassembledName : null) ?? null,
    verspaetungMin: est && planned ? Math.round((Date.parse(est) - Date.parse(planned)) / 60000) : null,
    echtzeit: Boolean(l.isRealtimeControlled ?? est),
    ausfall: (l.realtimeStatus ?? []).includes('TRIP_CANCELLED') || l.isCancelled === true,
    zwischenhalte: Math.max(0, (l.stopSequence?.length ?? 2) - 2),
    niederflur: props.PlanLowFloorVehicle === '1' ? true : null,
    rollstuhl: props.PlanWheelChairAccess === '1' ? true : null,
    // 1000 mm steht in der EFA für „unbekannt bzw. nicht stufenlos“
    einstiegshoeheMm: Number.isFinite(hoehe) && hoehe !== 1000 ? hoehe : null,
    hinweise: uniq((l.hints ?? []).map((h) => h.content)),
  };
}

function efaVariante(j) {
  const legs = j.legs ?? [];
  const abschnitte = legs.map(efaAbschnitt);
  const erst = legs[0]?.origin ?? {}, letzt = legs.at(-1)?.destination ?? {};
  const ab = erst.departureTimeEstimated ?? erst.departureTimePlanned;
  const an = letzt.arrivalTimeEstimated ?? letzt.arrivalTimePlanned;
  const fahrten = abschnitte.filter((a) => a.art !== 'fuss' && a.art !== 'sitzenbleiben');
  // Störungen an Anlagen (FaSta: Aufzüge, Rolltreppen) gehören für die Barrierefreiheit nach oben
  const anlagen = uniq((legs.flatMap((l) => l.infos ?? []))
    .filter((i) => i.type === 'infrastructure' || String(i.id ?? '').startsWith('FaSta'))
    .flatMap((i) => (i.infoLinks ?? []).map((x) => x.urlText)));
  return {
    ab: berlinIso(erst.departureTimePlanned), abPrognose: berlinIso(erst.departureTimeEstimated),
    an: berlinIso(letzt.arrivalTimePlanned), anPrognose: berlinIso(letzt.arrivalTimeEstimated),
    dauerMin: ab && an ? Math.round((Date.parse(an) - Date.parse(ab)) / 60000) : null,
    umstiege: j.interchanges ?? Math.max(0, fahrten.length - 1),
    fussMeter: abschnitte.filter((a) => a.art === 'fuss').reduce((s, a) => s + (a.meter ?? 0), 0),
    anstiegMeter: null,
    ausfall: fahrten.some((a) => a.ausfall),
    hinweise: anlagen,
    abschnitte,
  };
}

function efaProfil(profil) {
  if (profil === 'rollstuhl') return '&imparedOptionsActive=1&wheelchair=on&noSolidStairs=on&noEscalators=on&lowPlatformVhcl=on';
  if (profil === 'kinderwagen') return '&imparedOptionsActive=1&wheelchair=on&noSolidStairs=on&noEscalators=on';
  return '';
}

function efaOrt(o, rolle) {
  if (o.lat != null) return `&type_${rolle}=coord&name_${rolle}=${encodeURIComponent(`${o.lon.toFixed(5)}:${o.lat.toFixed(5)}:WGS84[dd.ddddd]`)}`;
  return `&type_${rolle}=${/^de:\d{5}:\d+/.test(o.id) ? 'stop' : 'any'}&name_${rolle}=${encodeURIComponent(o.id)}`;
}

async function oepnv(a, b, t, ankunft, profil) {
  let when = '';
  let zeitKey = `jetzt${Math.floor(Date.now() / 120_000)}`;
  if (t) {
    const { date, time } = efaDatumZeit(t);
    when = `&itdDate=${date}&itdTime=${time}`;
    zeitKey = `${date}${time}`;
  }
  const url = `${EFA}/XML_TRIP_REQUEST2?outputFormat=rapidJSON&coordOutputFormat=${encodeURIComponent('WGS84[dd.ddddd]')}` +
    `&locationServerActive=1&useRealtime=1&calcNumberOfTrips=4&itdTripDateTimeDepArr=${ankunft ? 'arr' : 'dep'}${when}` +
    efaOrt(a, 'origin') + efaOrt(b, 'destination') + efaProfil(profil);
  const key = `route:oepnv:${a.key}:${b.key}:${zeitKey}:${ankunft ? 'an' : 'ab'}:${profil}`;
  const { value, at, fresh } = await cached(key, 60_000, async () => {
    const d = await fetchJson(url, { timeout: 30000 });
    const varianten = (d.journeys ?? []).slice(0, 6).map(efaVariante);
    const l0 = d.journeys?.[0]?.legs?.[0]?.origin;
    return { varianten, start: l0?.coord ? { lat: l0.coord[0], lon: l0.coord[1] } : null };
  });
  // Aufzugsstatus ändert sich schneller als die Verbindung: nach dem Zwischenspeicher ergänzen
  const varianten = structuredClone(value.varianten);
  await Promise.all(varianten.map((v) => aufzugStatus(v, profil)));
  if (profil !== 'standard') varianten.sort((x, y) => (x.nutzbar === false) - (y.nutzbar === false));
  const hinweise = [];
  if (!varianten.length) hinweise.push('Keine Verbindung gefunden.');
  if (profil !== 'standard') {
    hinweise.push('Profil ohne Treppen und Rolltreppen' + (profil === 'rollstuhl' ? ', mit stufenlosem Einstieg' : '') +
      '. Aufzüge der SSB-Stadtbahn haben keinen offenen Live-Status; ihr Zustand ist unbekannt.');
  }
  return { varianten, hinweise, start: a.lat != null ? a : value.start, at, fresh };
}

const uhrzeit = (iso) => (iso ? iso.slice(11, 16) : null);

/** Ergänzt `ebenenwechsel[].status` für Aufzüge aus BFRK und SIRI-FM und kennzeichnet unbrauchbare Varianten. */
async function aufzugStatus(v, profil) {
  for (const ab of v.abschnitte) {
    for (const e of ab.ebenenwechsel ?? []) {
      if (e.typ !== 'aufzug' || e.lat == null) continue;
      // Mit bekannter Station nur deren Aufzüge, sonst (Fußroute) nur ein sehr naher Aufzug: lieber „unbekannt“ als falsch zugeordnet
      const nahe = e.stationIds?.length
        ? await aufzuegeNahe(e.lat, e.lon, { radiusM: 150, stationIds: e.stationIds, wartenMs: 5000 })
        : await aufzuegeNahe(e.lat, e.lon, { radiusM: 40, wartenMs: 5000 });
      const a = nahe[0];
      if (a) {
        e.status = a.status;
        e.statusQuelle = a.statusQuelle;
        e.stand = berlinIso(a.stand);
        e.statusHinweis = a.statusHinweis;
        e.aufzug = { id: a.id, station: a.station, beschreibung: a.beschreibung, fastaId: a.fastaId, distanzM: a.distanzM };
      } else {
        e.status = 'unbekannt';
        e.statusQuelle = null;
        e.stand = null;
        e.statusHinweis = 'Aufzug nicht in den Daten der DB bzw. der BFRK enthalten (z. B. SSB-Stadtbahn), kein Live-Status';
        e.aufzug = null;
      }
      const wo = a ? `${a.station}, ${a.beschreibung}` : e.beschreibung ?? ab.von;
      v.hinweise.push(`Aufzug ${wo}: ${e.status}${e.stand ? `, Stand ${uhrzeit(e.stand)} Uhr` : ''}`);
      if (e.status === 'außer Betrieb' && profil !== 'standard') {
        v.nutzbar = false;
        v.hinweise.push('Ein benötigter Aufzug ist außer Betrieb. Die Verbindung ist im gewählten Profil voraussichtlich nicht nutzbar.');
      }
    }
  }
  if (v.nutzbar !== false) v.nutzbar = !v.ausfall;
  v.hinweise = uniq(v.hinweise);
}

// ---------- Fuß und Rad über Valhalla ----------

const VALHALLA_EBENE = { 39: 'aufzug', 40: 'treppe', 41: 'rolltreppe' }; // ElevatorEnter, StepsEnter, EscalatorEnter

async function valhalla(a, b, costing, options) {
  const body = {
    locations: [{ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }],
    costing, costing_options: { [costing]: options }, elevation_interval: 30, language: 'de-DE', units: 'kilometers',
  };
  const d = await fetchJson(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`, { timeout: 30000 });
  if (!d.trip?.legs?.length) throw new Error('Valhalla: keine Route');
  return d.trip;
}

function valhallaVariante(trip, art, bezeichnung) {
  const leg = trip.legs[0];
  const geometrie = decodePolyline6(leg.shape);
  const hm = hoehenmeter(leg.elevation);
  const meter = Math.round((trip.summary?.length ?? 0) * 1000);
  const dauerMin = Math.round((trip.summary?.time ?? 0) / 60);
  const ebenenwechsel = (leg.maneuvers ?? [])
    .filter((m) => VALHALLA_EBENE[m.type])
    .map((m) => {
      const p = geometrie[m.begin_shape_index] ?? [];
      return { typ: VALHALLA_EBENE[m.type], richtung: null, ebeneVon: null, ebeneNach: null, beschreibung: m.instruction ?? null,
        stufen: null, dauerSek: Math.round(m.time ?? 0), lat: p[1] ?? null, lon: p[0] ?? null, stationIds: [] };
    });
  return {
    bezeichnung,
    ab: null, an: null, dauerMin, umstiege: 0,
    fussMeter: art === 'fuss' ? meter : 0,
    meter, anstiegMeter: hm.auf, abstiegMeter: hm.ab,
    hinweise: [], nutzbar: true,
    hoehenprofil: leg.elevation?.length ? { intervallMeter: leg.elevation_interval ?? 30, werte: leg.elevation.map((x) => Math.round(x)) } : null,
    abschnitte: [{
      art, von: 'Start', nach: 'Ziel', dauerMin, meter, geometrie,
      anweisungen: (leg.maneuvers ?? []).map((m) => { const t = (m.instruction ?? '').replace(/\.$/, ''); return t && m.length > 0.005 ? `${t}, ${meterText(m.length * 1000)}` : t; }).filter(Boolean),
      ebenenwechsel,
    }],
  };
}

async function fuss(a, b, profil) {
  const opts = profil === 'rollstuhl' ? { type: 'wheelchair' } : profil === 'kinderwagen' ? { step_penalty: 900 } : {};
  const { value, at, fresh } = await cached(`route:fuss:${a.key}:${b.key}:${profil}`, TAG, async () => {
    const trip = await valhalla(a, b, 'pedestrian', opts);
    return [valhallaVariante(trip, 'fuss', 'Zu Fuß')];
  });
  const varianten = structuredClone(value);
  await Promise.all(varianten.map((v) => aufzugStatus(v, profil)));
  const hinweise = ['Höhenmeter aus dem Höhenmodell von Valhalla (30-m-Raster), Schwankungen unter 3 m nicht gezählt.'];
  if (profil === 'rollstuhl') hinweise.push('Rollstuhlprofil von Valhalla: meidet Treppen, sofern in OpenStreetMap erfasst. Steigungen und Bordsteine vor Ort prüfen.');
  if (profil === 'kinderwagen') hinweise.push('Treppen werden stark gemieden, sofern in OpenStreetMap erfasst.');
  return { varianten, hinweise, at, fresh };
}

// ---------- Rad: Valhalla („Pedelec“) und BRouter („Fahrrad“) ----------

async function brouter(a, b) {
  const lonlats = `${a.lon},${a.lat}|${b.lon},${b.lat}`;
  const d = await fetchJson(`${BROUTER}?lonlats=${encodeURIComponent(lonlats)}&profile=trekking&alternativeidx=0&format=geojson`, { timeout: 30000 });
  const f = d.features?.[0];
  if (!f) throw new Error('BRouter: keine Route');
  const p = f.properties ?? {};
  const geometrie = (f.geometry?.coordinates ?? []).map((c) => [c[0], c[1]]);
  const meter = Math.round(+p['track-length'] || laenge(geometrie));
  const dauerMin = Math.round((+p['total-time'] || 0) / 60);
  return {
    bezeichnung: 'Fahrrad',
    ab: null, an: null, dauerMin, umstiege: 0, fussMeter: 0, meter,
    anstiegMeter: Number.isFinite(+p['filtered ascend']) ? Math.round(+p['filtered ascend']) : null,
    abstiegMeter: null,
    hinweise: ['Fahrzeit nach BRouter (Profil trekking), Steigungen eingerechnet.'], nutzbar: true,
    hoehenprofil: null,
    abschnitte: [{ art: 'rad', von: 'Start', nach: 'Ziel', dauerMin, meter, geometrie, anweisungen: [], ebenenwechsel: [] }],
  };
}

async function rad(a, b) {
  const { value, at, fresh } = await cached(`route:rad:${a.key}:${b.key}`, TAG, async () => {
    const [br, vh] = await Promise.allSettled([
      brouter(a, b),
      valhalla(a, b, 'bicycle', { bicycle_type: 'Hybrid', use_hills: 0.5 }).then((t) => {
        const v = valhallaVariante(t, 'rad', 'Pedelec');
        v.hinweise.push('Fahrzeit nach Valhalla; Steigungen sind darin kaum berücksichtigt, die Zeit passt eher zu einem Pedelec.');
        return v;
      }),
    ]);
    const varianten = [br, vh].filter((r) => r.status === 'fulfilled').map((r) => r.value);
    if (!varianten.length) throw new Error(`Radrouting nicht verfügbar (${br.reason?.message}; ${vh.reason?.message})`);
    const fehlt = [br.status === 'rejected' ? 'BRouter (Fahrrad)' : null, vh.status === 'rejected' ? 'Valhalla (Pedelec)' : null].filter(Boolean);
    return { varianten, fehlt };
  });
  const hinweise = ['Höhenmeter bei Valhalla aus dem 30-m-Höhenmodell (Schwankungen unter 3 m nicht gezählt), bei BRouter gefiltert.'];
  if (value.fehlt.length) hinweise.push(`Derzeit nicht erreichbar: ${value.fehlt.join(', ')}.`);
  return { varianten: structuredClone(value.varianten), hinweise, at, fresh };
}

// ---------- Auto über OSRM ----------

const OSRM_RICHTUNG = {
  left: 'links', right: 'rechts', 'slight left': 'halblinks', 'slight right': 'halbrechts',
  'sharp left': 'scharf links', 'sharp right': 'scharf rechts', straight: 'geradeaus', uturn: 'wenden',
};

function osrmAnweisung(s) {
  const m = s.maneuver ?? {};
  const dir = OSRM_RICHTUNG[m.modifier];
  const name = s.name || s.ref || '';
  const auf = name ? ` auf ${name}` : '';
  let text;
  switch (m.type) {
    case 'depart': text = `Losfahren${auf}`; break;
    case 'arrive': return 'Ziel erreicht';
    case 'roundabout': case 'rotary': text = `Im Kreisverkehr ${m.exit ? `die ${m.exit}. Ausfahrt nehmen` : 'weiterfahren'}${auf}`; break;
    case 'merge': text = `Einfädeln${auf}`; break;
    case 'on ramp': text = `Auffahrt nehmen${auf}`; break;
    case 'off ramp': text = `Ausfahrt nehmen${auf}`; break;
    case 'fork': text = `An der Gabelung ${dir ?? 'weiter'}${auf}`; break;
    case 'continue': case 'new name': text = `Weiter${auf}`; break;
    default: text = dir === 'wenden' ? 'Wenden' : dir === 'geradeaus' || !dir ? `Weiter${auf}` : `${dir[0].toUpperCase()}${dir.slice(1)} abbiegen${auf}`;
  }
  return s.distance > 0 ? `${text}, ${meterText(s.distance)}` : text;
}

async function auto(a, b) {
  const { value, at, fresh } = await cached(`route:auto:${a.key}:${b.key}`, TAG, async () => {
    const d = await fetchJson(`${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`, { timeout: 30000 });
    const r = d.routes?.[0];
    if (!r) throw new Error('OSRM: keine Route');
    const meter = Math.round(r.distance);
    const dauerMin = Math.round(r.duration / 60);
    return [{
      bezeichnung: 'Auto',
      ab: null, an: null, dauerMin, umstiege: 0, fussMeter: 0, meter, anstiegMeter: null, abstiegMeter: null,
      hinweise: ['Fahrzeit ohne aktuelle Verkehrslage und ohne Parksuche.'], nutzbar: true, hoehenprofil: null,
      abschnitte: [{
        art: 'auto', von: 'Start', nach: 'Ziel', dauerMin, meter,
        geometrie: r.geometry?.coordinates ?? [],
        anweisungen: (r.legs ?? []).flatMap((l) => l.steps ?? []).map(osrmAnweisung).filter(Boolean),
        ebenenwechsel: [],
      }],
    }];
  });
  return { varianten: structuredClone(value), hinweise: [], at, fresh };
}

// ---------- Hinweise aus Live-Daten (Sharing am Start, Parkhäuser am Ziel) ----------

const mitFrist = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), ms))]);

async function sharingAmStart(o) {
  try {
    const s = await mitFrist(sharing(), 4000);
    const nah = s.items.filter((i) => distanzM(o.lat, o.lon, i.lat, i.lon) <= 200);
    const zahl = (kind) => nah.filter((i) => i.kind === kind).reduce((n, i) => n + (i.station ? (i.renting ? i.available ?? 0 : 0) : 1), 0);
    const r = { radiusM: 200, leihraeder: zahl('bike'), roller: zahl('scooter'), autos: zahl('car') };
    const teile = [
      r.leihraeder ? `${r.leihraeder} ${r.leihraeder === 1 ? 'Leihrad' : 'Leihräder'}` : null,
      r.roller ? `${r.roller} E-Scooter` : null,
      r.autos ? `${r.autos} Carsharing-${r.autos === 1 ? 'Fahrzeug' : 'Fahrzeuge'}` : null,
    ].filter(Boolean);
    return { ...r, text: teile.length ? `Im Umkreis von 200 m um den Start: ${teile.join(', ')}.` : null };
  } catch {
    return null;
  }
}

async function parkenAmZiel(o) {
  try {
    const p = await mitFrist(parking(), 4000);
    return p.sites
      .map((s) => ({ s, d: distanzM(o.lat, o.lon, s.lat, s.lon) }))
      .filter((x) => x.d <= 800)
      .sort((x, y) => x.d - y.d)
      .slice(0, 5)
      .map(({ s, d }) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, distanzM: Math.round(d), frei: s.free, live: s.live }));
  } catch {
    return null;
  }
}

// ---------- Öffentliche Funktionen ----------

/**
 * GET /api/route
 * @param {{von:string, nach:string, modus?:string, zeit?:string, ankunft?:string|number|boolean, profil?:string}} p
 *   von, nach: „lat,lon“ oder EFA-Kennung (Haltestelle de:08111:6115 oder Kennung aus /api/orte/suche)
 */
export async function route({ von, nach, modus = 'oepnv', zeit, ankunft, profil = 'standard' } = {}) {
  modus = String(modus || 'oepnv').toLowerCase();
  profil = String(profil || 'standard').toLowerCase();
  if (!MODI.includes(modus)) throw fehler('Unbekannter Modus (oepnv, fuss, rad, auto)');
  if (!PROFILE.includes(profil)) throw fehler('Unbekanntes Profil (standard, rollstuhl, kinderwagen)');
  if ((modus === 'rad' || modus === 'auto') && profil !== 'standard') profil = 'standard';
  const a = parseOrt(von, 'Start');
  const b = parseOrt(nach, 'Ziel');
  const arr = ankunft === true || ankunft === 1 || ankunft === '1' || ankunft === 'true';
  const t = zeitAusAnfrage(zeit);

  let res;
  let ka = a, kb = b;
  if (modus === 'oepnv') {
    res = await oepnv(a, b, t, arr, profil);
    if (res.start) ka = res.start;
  } else {
    [ka, kb] = await Promise.all([ortKoordinate(a), ortKoordinate(b)]);
    if (ka.lat === kb.lat && ka.lon === kb.lon) throw fehler('Start und Ziel sind identisch');
    res = modus === 'fuss' ? await fuss(ka, kb, profil) : modus === 'rad' ? await rad(ka, kb) : await auto(ka, kb);
    // Ab- und Ankunft aus der gewünschten Zeit (oder jetzt) und der Dauer
    const basis = t ?? new Date(Math.floor(Date.now() / 60000) * 60000);
    for (const v of res.varianten) {
      const ms = v.dauerMin * 60000;
      const abMs = arr ? +basis - ms : +basis;
      v.ab = berlinIso(new Date(abMs).toISOString());
      v.an = berlinIso(new Date(abMs + ms).toISOString());
    }
  }

  const hinweise = [...res.hinweise];
  const extra = {};
  if (modus !== 'auto' && ka?.lat != null) {
    const s = await sharingAmStart(ka);
    if (s) { extra.sharingAmStart = s; if (s.text) hinweise.push(s.text); }
  }
  if (modus === 'auto' && kb?.lat != null) {
    const p = await parkenAmZiel(kb);
    if (p) {
      extra.parkenAmZiel = p;
      const frei = p.filter((x) => x.live && x.frei > 0).slice(0, 3);
      if (frei.length) hinweise.push(`Parkhäuser am Ziel mit freien Plätzen: ${frei.map((x) => `${x.name} (${x.frei} frei, ${x.distanzM} m)`).join(', ')}.`);
      else if (p.length) hinweise.push('Parkhäuser am Ziel: derzeit keine Live-Angabe zu freien Plätzen.');
      else hinweise.push('Keine städtischen Parkhäuser im Umkreis von 800 m um das Ziel.');
    }
  }

  return {
    modus,
    profil,
    von: ka?.lat != null ? { lat: ka.lat, lon: ka.lon, ...(a.id ? { id: a.id } : {}) } : { id: a.id },
    nach: kb?.lat != null ? { lat: kb.lat, lon: kb.lon, ...(b.id ? { id: b.id } : {}) } : { id: b.id },
    zeit: t ? berlinIso(t.toISOString()) : null,
    ankunft: arr,
    quelle: QUELLE[modus],
    abgerufen: new Date(res.at).toISOString(),
    aktuell: res.fresh,
    hinweise: uniq(hinweise),
    varianten: res.varianten,
    ...extra,
  };
}

const TYP = { stop: 'haltestelle', singlehouse: 'adresse', street: 'strasse', address: 'adresse', poi: 'ort', locality: 'gemeinde', suburb: 'ortsteil' };

/** GET /api/orte/suche: Haltestellen, Adressen und Orte aus dem EFA-Stopfinder (type_sf=any), 24 h zwischengespeichert. */
export async function ortSuche(q) {
  const query = String(q ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (query.length < 2) return { results: [], quelle: EFA_QUELLE };
  const { value } = await cached(`ortsuche:${query.toLowerCase()}`, TAG, async () => {
    const mitStadt = /^stuttgart\b/i.test(query) ? query : `Stuttgart ${query}`;
    let locs = await stopfinder(mitStadt);
    const best = Math.max(0, ...locs.map((l) => l.matchQuality ?? 0));
    // Treffer außerhalb Stuttgarts (z. B. „Esslingen Bahnhof“) findet der Stopfinder nur ohne Stadtnamen
    if (mitStadt !== query && best < 900) {
      const roh = await stopfinder(query).catch(() => []);
      const ids = new Set(locs.map((l) => l.id));
      locs = [...locs, ...roh.filter((l) => !ids.has(l.id))];
    }
    return locs
      // nur Baden-Württemberg mit Rand, wie bei der Routensuche
      .filter((l) => Array.isArray(l.coord) && l.id && l.coord[0] >= 47.4 && l.coord[0] <= 49.9 && l.coord[1] >= 7.4 && l.coord[1] <= 10.6)
      .sort((x, y) => (y.matchQuality ?? 0) - (x.matchQuality ?? 0))
      .slice(0, 10)
      .map((l) => ({
        label: l.name ?? l.disassembledName,
        typ: TYP[l.type] ?? l.type,
        id: l.id,
        lat: +l.coord[0].toFixed(6),
        lon: +l.coord[1].toFixed(6),
        ort: l.parent?.name ?? null,
      }));
  });
  return { results: value, quelle: EFA_QUELLE };
}
