// Netzweite Echtzeit und Pünktlichkeit aus dem offenen GTFS-RT-Feed von gtfs.de.
// Quelle: https://realtime.gtfs.de/realtime-free.pb (ganz Deutschland, rund 29 MB, Stand laut
// gtfs.de alle 10 s). Lizenz: CC BY-SA 4.0 (gtfs.de); Echtzeitdaten Baden-Württemberg:
// NVBW/MobiData BW, Datenlizenz Deutschland – Namensnennung 2.0. Abgeleitete Datensätze
// (auch das Archiv unten) sind unter CC BY-SA 4.0 weiterzugeben.
//
// Ablauf: Solange der Server läuft, wird der Feed höchstens alle 180 s geholt, selbst dekodiert
// (Protobuf, nur die benötigten Felder) und auf den Raum Stuttgart gefiltert. Die Nummern im Feed
// (trip_id, stop_id, route_id) passen nur zum Statik-GTFS von gtfs.de; die Zuordnung steht in
// server/data/gtfsde-stuttgart.json (erzeugt mit scripts/gtfsde-stuttgart.mjs).
//
// Ergebnis:
//  1. puenktlichkeitJetzt(): Halte der letzten 60 Minuten je Verkehrsmittel und Linie,
//  2. verspaetungAnHalt(): aktuelle Prognose für eine Abfahrt (Ersatz, wenn EFA-BW keine Ist-Zeiten hat),
//  3. Tagesarchiv server/.cache/archiv/puenktlichkeit-JJJJ-MM-TT.csv (eine Zeile je Fahrt und Halt,
//     erste Beobachtung nach der Abfahrt) und puenktlichkeitTage(n) als Auswertung darüber.
// Abschalten mit OS_GTFSRT=0.
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { cached, fetchBuffer } from '../cache.mjs';

const URL_RT = 'https://realtime.gtfs.de/realtime-free.pb';
const TAKT = 180_000;
const FENSTER_S = 60 * 60; // Auswertungsfenster für "jetzt"
const MERKEN_S = 6 * 3600; // so lange bleiben Archivschlüssel zum Aussortieren doppelter Zeilen
const AKTIV = process.env.OS_GTFSRT !== '0';
const ARCHIV = fileURLToPath(new URL('../.cache/archiv/', import.meta.url));
const STATIK = fileURLToPath(new URL('../data/gtfsde-stuttgart.json', import.meta.url));
export const QUELLE = 'Echtzeitdaten: NVBW/MobiData BW (DL-DE-BY-2.0) über gtfs.de (CC BY-SA 4.0)';
const DEFINITION = 'Pünktlich: weniger als 3 Minuten Verspätung an der Abfahrt (an Endhalten: Ankunft). ' +
  'Mittel und p90 in Minuten; Verfrühungen zählen als 0. Ausgefallene Halte sind nicht eingerechnet.';
const ARTEN = ['Stadtbahn', 'Bus', 'S-Bahn', 'Regional/Fern'];

// ---------------------------------------------------------------------------------------------
// Zuordnung aus dem Statik-GTFS (einmal beim ersten Abruf geladen, rund 1 MB)

/** Verkehrsmittel aus route_type (GTFS und erweiterte Typen) und Linienname. */
function artVon(typ, name) {
  if (typ === 109 || ((typ === 2 || (typ >= 100 && typ < 200)) && /^S\s?\d/.test(name))) return 'S-Bahn';
  if (typ === 2 || (typ >= 100 && typ < 200)) return 'Regional/Fern';
  if (typ === 3 || typ === 200 || (typ >= 700 && typ < 800)) return 'Bus';
  // 0 Straßenbahn, 1 U-/Stadtbahn, 5 und 7 Seil- und Zahnradbahn
  if ([0, 1, 5, 7].includes(typ) || (typ >= 400 && typ < 500) || (typ >= 900 && typ < 1500)) return 'Stadtbahn';
  return null;
}

/** Linienname zum Vergleichen: ohne Leerzeichen, ohne führende Nullen, Großbuchstaben. */
const normLinie = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');

/** Haltname zum Vergleichen zwischen EFA-BW und gtfs.de. */
export const normName = (s) => String(s ?? '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/,\s*stuttgart$/, '').replace(/^stuttgart[\s,-]+(?=\S)/, '')
  .replace(/\bhbf\b/g, 'hauptbahnhof').replace(/\bbf\b/g, 'bahnhof').replace(/strasse\b/g, 'str')
  .replace(/[^a-z0-9]+/g, ' ').trim();

let S = null;
function statik() {
  if (S) return S;
  const d = JSON.parse(readFileSync(STATIK, 'utf8'));
  const halte = new Map();
  const namen = new Map(); // normierter Name -> stop_ids
  for (const [id, [name, lat, lon]] of Object.entries(d.halte)) {
    halte.set(id, { name, lat, lon });
    const k = normName(name);
    if (!namen.has(k)) namen.set(k, []);
    namen.get(k).push(id);
  }
  const routen = new Map();
  for (const [id, [name, typ]] of Object.entries(d.routen)) {
    const art = artVon(typ, name);
    if (art) routen.set(id, { linie: name.replace(/^0+(?=\d)/, ''), norm: normLinie(name), art });
  }
  const fahrten = new Map();
  const ids = d.fahrten.id.split(','); const r = d.fahrten.route.split(',');
  for (let i = 0; i < ids.length; i++) fahrten.set(ids[i], r[i]);
  S = { halte, namen, routen, fahrten, erzeugt: d.erzeugt };
  return S;
}

// ---------------------------------------------------------------------------------------------
// Protobuf-Dekodierung (GTFS-RT 2.0), nur die benötigten Felder:
// FeedMessage{1 header, 2 entity}  FeedHeader{3 timestamp}  FeedEntity{3 trip_update}
// TripUpdate{1 trip, 2 stop_time_update}
// TripDescriptor{1 trip_id, 3 start_date, 4 schedule_relationship, 5 route_id}
// StopTimeUpdate{1 stop_sequence, 2 arrival, 3 departure, 4 stop_id, 5 schedule_relationship}
// StopTimeEvent{1 delay, 2 time}

let P = 0; // Leseposition im Puffer

function vi(b) {
  let x = 0; let m = 1; let c;
  do { c = b[P++]; x += (c & 0x7f) * m; m *= 128; } while (c & 0x80);
  return x;
}
/** int32 (negative Werte stehen als 10-Byte-Varint im Puffer). */
function i32(b) {
  const s = P; const x = vi(b);
  if (P - s <= 5 && x <= 0x7fffffff) return x;
  return ((b[s] & 0x7f) | ((b[s + 1] & 0x7f) << 7) | ((b[s + 2] & 0x7f) << 14) | ((b[s + 3] & 0x7f) << 21) | ((b[s + 4] & 0x0f) << 28)) | 0;
}
function skip(b, wt) {
  if (wt === 0) vi(b);
  else if (wt === 1) P += 8;
  else if (wt === 2) { const n = vi(b); P += n; } else if (wt === 5) P += 4;
  else throw new Error(`Protobuf: unbekannter Feldtyp ${wt}`);
}
const str = (b, s, e) => b.toString('utf8', s, e);

function event(b, s, e) {
  P = s; let delay = null; let time = null;
  while (P < e) {
    const tag = vi(b); const f = tag >>> 3; const wt = tag & 7;
    if (f === 1 && wt === 0) delay = i32(b);
    else if (f === 2 && wt === 0) time = vi(b);
    else skip(b, wt);
  }
  return { delay, time };
}

/** StopTimeUpdate nur dekodieren, wenn der Halt im Raum Stuttgart liegt. */
function stopTimeUpdate(b, s, e, halte) {
  P = s; let seq = null; let stopId = null; let rel = 0; let aS = -1; let aE = -1; let dS = -1; let dE = -1;
  while (P < e) {
    const tag = vi(b); const f = tag >>> 3; const wt = tag & 7;
    if (wt === 2) {
      const n = vi(b); const a = P; P += n;
      if (f === 2) { aS = a; aE = a + n; } else if (f === 3) { dS = a; dE = a + n; } else if (f === 4) stopId = str(b, a, a + n);
    } else if (f === 1 && wt === 0) seq = vi(b);
    else if (f === 5 && wt === 0) rel = vi(b);
    else skip(b, wt);
  }
  if (stopId == null || !halte.has(stopId)) return null;
  const arr = aS >= 0 ? event(b, aS, aE) : null;
  const dep = dS >= 0 ? event(b, dS, dE) : null;
  P = e;
  return { seq, stopId, rel, arr, dep };
}

function tripDescriptor(b, s, e) {
  P = s; const t = { tripId: '', startDate: '', rel: 0, routeId: '' };
  while (P < e) {
    const tag = vi(b); const f = tag >>> 3; const wt = tag & 7;
    if (wt === 2) {
      const n = vi(b); const a = P; P += n;
      if (f === 1) t.tripId = str(b, a, a + n); else if (f === 3) t.startDate = str(b, a, a + n); else if (f === 5) t.routeId = str(b, a, a + n);
    } else if (f === 4 && wt === 0) t.rel = vi(b);
    else skip(b, wt);
  }
  return t;
}

function tripUpdate(b, s, e, halte, onTrip) {
  P = s; let trip = null; const stus = [];
  while (P < e) {
    const tag = vi(b); const f = tag >>> 3; const wt = tag & 7;
    if (wt === 2) {
      const n = vi(b); const a = P; P += n;
      if (f === 1) { trip = tripDescriptor(b, a, a + n); P = a + n; } else if (f === 2) { const u = stopTimeUpdate(b, a, a + n, halte); P = a + n; if (u) stus.push(u); }
    } else skip(b, wt);
  }
  if (trip && stus.length) onTrip(trip, stus);
}

/** Ganzen Feed durchgehen; ruft onTrip(trip, stus) für Fahrten mit Halten im Raum. Liefert Kopf und Zähler. */
function dekodiere(b, halte, onTrip) {
  P = 0; let ts = 0; let entities = 0; let tripUpdates = 0;
  const end = b.length;
  while (P < end) {
    const tag = vi(b); const f = tag >>> 3; const wt = tag & 7;
    if (wt !== 2) { skip(b, wt); continue; }
    const n = vi(b); const s = P; const e = s + n; P = e;
    if (f === 1) { // FeedHeader
      P = s;
      while (P < e) { const t = vi(b); if ((t >>> 3) === 3 && (t & 7) === 0) ts = vi(b); else skip(b, t & 7); }
    } else if (f === 2) { // FeedEntity
      entities++; P = s;
      while (P < e) {
        const t = vi(b); const wt2 = t & 7;
        if ((t >>> 3) === 3 && wt2 === 2) { const m = vi(b); const a = P; tripUpdates++; tripUpdate(b, a, a + m, halte, onTrip); P = a + m; } else skip(b, wt2);
      }
    }
    P = e;
  }
  return { ts, entities, tripUpdates };
}

// ---------------------------------------------------------------------------------------------
// Zeitangaben in Ortszeit

const FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
/** Unix-Sekunden -> "2026-10-20T15:45:00+02:00" */
function isoBerlin(sec) {
  const lokal = FMT.format(new Date(sec * 1000)).replace(' ', 'T');
  const off = Math.round((Date.parse(`${lokal}Z`) / 1000 - sec) / 60);
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'); const m = String(Math.abs(off) % 60).padStart(2, '0');
  return `${lokal}${off < 0 ? '-' : '+'}${h}:${m}`;
}

// ---------------------------------------------------------------------------------------------
// Zustand

mkdirSync(ARCHIV, { recursive: true });
let fenster = []; // beobachtete Halte: { ist, linie, art, delay, ausfall }
const gesehen = new Map(); // Archivschlüssel linie|stop_id|soll -> Soll (Unix-Sekunden)
let prognose = new Map(); // stop_id|Linie|Soll-Minute -> Verspätung (s), aus dem letzten Abruf
let stand = null; // Zeitstempel des Feeds (Unix-Sekunden)
let messung = null;
let fehler = null;
let timer = null;
let erster = null;
let warnung = false;

const archivDatei = (datum) => `${ARCHIV}puenktlichkeit-${datum}.csv`;
const KOPF = 'datum,linie,art,stop_id,haltname,soll,verspaetung_s,ausfall\n';
const feld = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Archiv von heute und gestern lesen: Schlüssel gegen doppelte Zeilen nach einem Neustart, dazu das Fenster der letzten Stunde. */
function archivSchluesselLaden() {
  const jetzt = Date.now() / 1000;
  for (const sec of [jetzt - 86400, jetzt]) {
    const f = archivDatei(isoBerlin(sec).slice(0, 10));
    if (!existsSync(f)) continue;
    for (const z of readFileSync(f, 'utf8').split('\n').slice(1)) {
      const c = csvZeile(z);
      if (c.length < 8) continue;
      const soll = Date.parse(c[5]) / 1000;
      if (soll > jetzt - MERKEN_S) gesehen.set(`${c[1]}|${c[3]}|${c[5]}`, soll);
      // Beobachtungen der letzten Stunde wieder ins Fenster für "jetzt" übernehmen
      const ausfall = c[7] === '1'; const delay = ausfall ? null : +c[6];
      if (soll + (delay ?? 0) >= jetzt - FENSTER_S) fenster.push({ ist: soll + (delay ?? 0), linie: c[1], art: c[2], delay, ausfall });
    }
  }
}

function csvZeile(z) {
  if (!z.includes('"')) return z.split(',');
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < z.length; i++) {
    const c = z[i];
    if (q) { if (c === '"') { if (z[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Einen Abruf holen, dekodieren und in Fenster, Prognose und Archiv übernehmen. */
async function abruf() {
  const st = statik();
  const t0 = Date.now();
  let buf = Buffer.from(await fetchBuffer(URL_RT, { timeout: 120_000 }));
  const bytes = buf.length;
  const t1 = Date.now();
  const neuePrognose = new Map();
  const zeilen = new Map(); // Datum -> CSV-Text
  const neu = [];
  const z = { fahrtenImRaum: 0, ueberFahrt: 0, ueberRoute: 0, ohneZuordnung: 0, halte: 0, ohneZeit: 0, ausfallNaeherung: 0 };
  let ts = 0;
  const offen = []; // Fahrten erst nach dem Kopf auswerten (Kopf steht in der Regel vorn, sicher ist sicher)
  const kopf = dekodiere(buf, st.halte, (trip, stus) => offen.push([trip, stus]));
  buf = null; // den großen Puffer sofort freigeben
  ts = kopf.ts || Math.floor(Date.now() / 1000);
  for (const [trip, stus] of offen) {
    z.fahrtenImRaum++;
    let rid = st.fahrten.get(trip.tripId);
    if (rid != null) z.ueberFahrt++;
    else if (trip.routeId && st.routen.has(trip.routeId)) { rid = trip.routeId; z.ueberRoute++; } else { z.ohneZuordnung++; continue; }
    const route = st.routen.get(rid);
    if (!route) continue;
    const fahrtAusfall = trip.rel === 3; // CANCELED
    // Soll und Ist je Halt; ausfallende Halte (SKIPPED) haben im Feed keine Zeiten und
    // bekommen näherungsweise Soll/Ist des vorigen (sonst des nächsten) Halts der Fahrt.
    stus.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    const zeiten = stus.map((u) => {
      const ev = u.dep && (u.dep.time != null || u.dep.delay != null) ? u.dep : u.arr;
      return ev && ev.time != null && ev.delay != null ? { soll: ev.time - ev.delay, ist: ev.time, delay: ev.delay } : null;
    });
    for (let i = 0; i < stus.length; i++) {
      const u = stus[i];
      const ausfall = fahrtAusfall || u.rel === 1; // SKIPPED
      let zt = zeiten[i];
      if (zt) {
        z.halte++;
        neuePrognose.set(`${u.stopId}|${route.norm}|${Math.round(zt.soll / 60)}`, ausfall ? null : zt.delay);
      } else if (ausfall) {
        let j = i - 1; while (j >= 0 && !zeiten[j]) j--;
        if (j < 0) { j = i + 1; while (j < stus.length && !zeiten[j]) j++; }
        if (j >= stus.length) { z.ohneZeit++; continue; }
        zt = { soll: zeiten[j].soll, ist: zeiten[j].ist, delay: null };
        z.ausfallNaeherung++;
      } else { z.ohneZeit++; continue; }
      if (zt.ist > ts) continue; // noch nicht abgefahren
      const sollIso = isoBerlin(zt.soll);
      const key = `${route.linie}|${u.stopId}|${sollIso}`;
      if (gesehen.has(key)) continue;
      gesehen.set(key, zt.soll);
      neu.push({ ist: zt.ist, linie: route.linie, art: route.art, delay: zt.delay, ausfall });
      const datum = sollIso.slice(0, 10);
      zeilen.set(datum, (zeilen.get(datum) ?? '') +
        `${datum},${feld(route.linie)},${route.art},${u.stopId},${feld(st.halte.get(u.stopId).name)},${sollIso},${ausfall ? '' : zt.delay},${ausfall ? 1 : 0}\n`);
    }
  }
  for (const [datum, text] of zeilen) {
    const f = archivDatei(datum);
    try { appendFileSync(f, existsSync(f) ? text : KOPF + text); } catch (e) { console.warn('gtfsrt: Archiv nicht schreibbar', e.message); }
  }
  fenster = fenster.concat(neu).filter((x) => x.ist >= ts - FENSTER_S);
  for (const [k, soll] of gesehen) if (soll < ts - MERKEN_S) gesehen.delete(k);
  prognose = neuePrognose;
  stand = ts;
  fehler = null;
  messung = {
    abruf: new Date(t0).toISOString(), bytes, ladezeit_ms: t1 - t0, dekodierzeit_ms: Date.now() - t1,
    feedAlter_s: Math.round(t0 / 1000 - ts), entities: kopf.entities, tripUpdates: kopf.tripUpdates,
    neueArchivzeilen: neu.length, ...z,
    trefferquote: z.fahrtenImRaum ? Math.round((z.ueberFahrt / z.fahrtenImRaum) * 1000) / 10 : null,
  };
  // Neue Statik bei gtfs.de vergibt neue trip_ids: dann scripts/gtfsde-stuttgart.mjs erneut ausführen
  if (messung.trefferquote != null && messung.trefferquote < 80 && !warnung) {
    warnung = true;
    console.warn(`gtfsrt: nur ${messung.trefferquote} % der Fahrten zugeordnet, server/data/gtfsde-stuttgart.json mit node scripts/gtfsde-stuttgart.mjs neu erzeugen`);
  }
}

/** Abrufe starten (idempotent). index.mjs ruft das beim Start auf; die Exporte starten sonst bei Bedarf. */
export function startGtfsrt() {
  if (!AKTIV || erster) return erster;
  archivSchluesselLaden();
  const run = async () => {
    const t0 = Date.now();
    try { await abruf(); } catch (e) {
      fehler = String(e.message ?? e);
      console.warn('gtfsrt:', fehler);
    }
    timer = setTimeout(run, Math.max(10_000, TAKT - (Date.now() - t0)));
    timer.unref?.();
  };
  erster = run();
  return erster;
}

export const gtfsrtMessung = () => ({ messung, fehler, stand: stand ? new Date(stand * 1000).toISOString() : null });

// ---------------------------------------------------------------------------------------------
// Auswertung

const r1 = (x) => Math.round(x * 10) / 10;
/** Kennzahlen aus Verspätungen in Sekunden. */
function kennzahlen(delays) {
  const n = delays.length;
  if (!n) return { n: 0, mittel: null, p90: null, puenktlich3: null, anteil3: null };
  const v = delays.map((d) => Math.max(0, d)).sort((a, b) => a - b);
  const unter3 = v.filter((d) => d < 180).length;
  return {
    n,
    mittel: r1(v.reduce((a, b) => a + b, 0) / n / 60),
    p90: r1(v[Math.min(n - 1, Math.ceil(0.9 * n) - 1)] / 60),
    puenktlich3: Math.round((unter3 / n) * 1000) / 10,
    anteil3: Math.round(((n - unter3) / n) * 1000) / 10,
  };
}

function auswerten(eintraege, minN, top) {
  const jeArt = new Map(ARTEN.map((a) => [a, { d: [], ausfall: 0 }]));
  const jeLinie = new Map();
  for (const e of eintraege) {
    const a = jeArt.get(e.art);
    if (!a) continue;
    const k = `${e.art}|${e.linie}`;
    if (!jeLinie.has(k)) jeLinie.set(k, { linie: e.linie, art: e.art, d: [], ausfall: 0 });
    const l = jeLinie.get(k);
    if (e.ausfall) { a.ausfall++; l.ausfall++; continue; }
    a.d.push(e.delay); l.d.push(e.delay);
  }
  const verkehrsmittel = [...jeArt].map(([art, a]) => {
    const k = kennzahlen(a.d);
    return { art, halte: k.n, puenktlich3: k.puenktlich3, mittel: k.mittel, p90: k.p90, ausfaelle: a.ausfall };
  });
  const linien = [...jeLinie.values()]
    .map((l) => { const k = kennzahlen(l.d); return { linie: l.linie, art: l.art, mittel: k.mittel, p90: k.p90, anteil3: k.anteil3, n: k.n, ausfaelle: l.ausfall }; })
    .filter((l) => l.n >= minN)
    .sort((a, b) => b.mittel - a.mittel || b.p90 - a.p90);
  return { verkehrsmittel, linien: top ? linien.slice(0, top) : linien, linienGesamt: linien.length };
}

/**
 * Pünktlichkeit der letzten 60 Minuten im Raum Stuttgart.
 * @returns {Promise<{stand: string|null, verkehrsmittel: {art: string, halte: number, puenktlich3: number|null, mittel: number|null}[],
 *   linien: {linie: string, art: string, mittel: number, p90: number, anteil3: number, n: number}[], quelle: string}>}
 */
export async function puenktlichkeitJetzt() {
  if (!AKTIV) return { aktiv: false, stand: null, verkehrsmittel: [], linien: [], quelle: QUELLE, hinweis: 'Abgeschaltet (OS_GTFSRT=0).' };
  if (!stand) await startGtfsrt();
  if (!stand) throw new Error(`GTFS-RT nicht verfügbar${fehler ? `: ${fehler}` : ''}`);
  const { verkehrsmittel, linien, linienGesamt } = auswerten(fenster, 20, 10);
  return {
    aktiv: true,
    stand: new Date(stand * 1000).toISOString(),
    fenster_min: FENSTER_S / 60,
    verkehrsmittel,
    linien,
    linienGesamt,
    definition: DEFINITION,
    abdeckung: messung && {
      fahrtenImRaum: messung.fahrtenImRaum, zugeordnet: messung.ueberFahrt + messung.ueberRoute,
      trefferquote: messung.trefferquote, statik: S?.erzeugt ?? null,
    },
    veraltet: Date.now() / 1000 - stand > 15 * 60 || undefined,
    fehler: fehler ?? undefined,
    quelle: QUELLE,
  };
}

/**
 * Aktuelle Verspätung einer Fahrt an einem Halt in Minuten, oder null, wenn der Feed sie nicht
 * eindeutig liefert. Zuordnung über Haltname, Linie und Soll-Zeit (±1 Minute).
 * @param {string} stopName Haltname wie bei EFA-BW, z. B. "Charlottenplatz"
 * @param {string} line Linie, z. B. "U5" oder "42"
 * @param {string} plannedIso Soll-Zeit als ISO-Zeitpunkt
 * @returns {number|null}
 */
export function verspaetungAnHalt(stopName, line, plannedIso) {
  if (!AKTIV) return null;
  if (!erster) { startGtfsrt(); return null; }
  if (!stand || Date.now() / 1000 - stand > 10 * 60) return null;
  const st = statik();
  const m = Math.round(Date.parse(plannedIso) / 60000);
  if (!Number.isFinite(m)) return null;
  const ids = st.namen.get(normName(stopName));
  if (!ids) return null;
  const ln = normLinie(line);
  for (const dm of [0, -1, 1]) {
    for (const id of ids) {
      const d = prognose.get(`${id}|${ln}|${m + dm}`);
      if (d != null) return Math.round(d / 60);
    }
  }
  return null;
}

/**
 * Auswertung je Linie und Verkehrsmittel über die letzten n Archivtage (einschließlich heute).
 * @param {number} [n=7]
 */
export async function puenktlichkeitTage(n = 7) {
  n = Math.max(1, Math.min(60, Math.floor(+n) || 7));
  const { value } = await cached(`gtfsrt-tage:${n}`, 10 * 60_000, async () => {
    const dateien = readdirSync(ARCHIV).filter((f) => /^puenktlichkeit-\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort().slice(-n);
    const alle = []; const tage = [];
    for (const f of dateien) {
      const datum = f.slice(15, 25); const proTag = [];
      const rl = createInterface({ input: createReadStream(ARCHIV + f, 'utf8'), crlfDelay: Infinity });
      let kopf = true;
      for await (const z of rl) {
        if (kopf) { kopf = false; continue; }
        const c = csvZeile(z);
        if (c.length < 8) continue;
        const e = { linie: c[1], art: c[2], delay: +c[6], ausfall: c[7] === '1' };
        alle.push(e); proTag.push(e);
      }
      tage.push({ datum, verkehrsmittel: auswerten(proTag, Infinity, 0).verkehrsmittel });
    }
    const { verkehrsmittel, linien } = auswerten(alle, 50, 0);
    return {
      tage, von: tage[0]?.datum ?? null, bis: tage.at(-1)?.datum ?? null,
      verkehrsmittel, linien, definition: DEFINITION,
      hinweis: 'Eigenes Archiv dieser Anwendung: je Fahrt und Halt die erste Beobachtung nach der Abfahrt, Abruf alle 3 Minuten, nur solange der Server läuft. Tage mit Lücken sind unvollständig. Linien mit mindestens 50 Halten.',
      quelle: QUELLE,
    };
  });
  return value;
}
