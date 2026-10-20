// Eisenbahn am Stuttgarter Hauptbahnhof: Soll, Ist, Ausfälle, Gleiswechsel und Verspätungsgründe der DB.
//   Stuttgart Hbf (oben, Kopfbahnhof)  EVA 8000096
//   Stuttgart Hbf (tief, S-Bahn)       EVA 8098096
//
// Bevorzugte Quelle: DB Timetables-API im DB API Marketplace (offiziell, kostenlose Registrierung).
//   Schlüssel aus den Umgebungsvariablen OS_DB_CLIENT_ID und OS_DB_API_KEY (Header DB-Client-Id / DB-Api-Key).
// ÜBERGANG: Ohne diese Variablen wird die inoffizielle IRIS-TTS-Schnittstelle der DB genutzt
//   (iris.noncd.db.de, ohne Schlüssel, gleiche Datenstruktur plan/fchg, Grundlage von bahn.expert).
//   IRIS ist nicht dokumentiert und kann ohne Ankündigung entfallen. Für den Dauerbetrieb bitte eine
//   Client-ID registrieren und die beiden Variablen setzen; dann entfällt der Übergangsweg.
//
// Abrufe: plan je Bahnhof und Stunde höchstens einmal pro Stunde (zusätzlich auf der Platte zwischengespeichert),
// fchg (alle bekannten Änderungen) je Bahnhof höchstens alle 3 Minuten, Abstand je Host mindestens 2 s (cache.mjs).
//
// Gründe: Meldungen vom Typ „d“ (Verspätungsursache) werden über server/data/iris-codes.json übersetzt
// (Tabelle aus Travel::Status::DE::IRIS, Lizenz siehe Dateikopf).
//
// Historie: bahnHistorie() liest server/data/db-puenktlichkeit-hbf.json (erzeugt mit
// scripts/db-puenktlichkeit-hbf.py aus piebro/deutsche-bahn-data, CC BY 4.0 Deutsche Bahn).
import { readFileSync } from 'node:fs';
import { cached, diskStore, fetchText } from '../cache.mjs';

const IRIS = 'https://iris.noncd.db.de/iris-tts/timetable';
const DB_API = 'https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1';

const STATIONEN = [
  { eva: '8000096', name: 'Stuttgart Hbf', teil: 'oben' },
  { eva: '8098096', name: 'Stuttgart Hbf (tief)', teil: 'tief' },
];

const PLAN_TTL = 3600_000;
const FCHG_TTL = 3 * 60_000;

const QUELLE_DB = 'Verspätungsdaten DB: Deutsche Bahn (CC BY 4.0)';
const QUELLE_CODES = 'Übersetzung der Meldungscodes: Travel::Status::DE::IRIS (Perl-5-Lizenz)';

const CODES = JSON.parse(readFileSync(new URL('../data/iris-codes.json', import.meta.url), 'utf8')).codes;

const disk = diskStore('db-plan');

// ---------- Zugang ----------

function zugang() {
  const id = process.env.OS_DB_CLIENT_ID;
  const key = process.env.OS_DB_API_KEY;
  if (id && key) {
    return {
      offiziell: true,
      base: DB_API,
      init: { headers: { 'DB-Client-Id': id, 'DB-Api-Key': key, Accept: 'application/xml' }, timeout: 20000 },
    };
  }
  // ÜBERGANG: inoffizielle IRIS-Schnittstelle, nur solange keine Client-ID hinterlegt ist
  return { offiziell: false, base: IRIS, init: { timeout: 20000 } };
}

// ---------- Zeit ----------

const fmtBerlin = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
function berlinTeile(d) {
  const p = Object.fromEntries(fmtBerlin.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}
const pad = (n) => String(n).padStart(2, '0');

/** DB-Zeitangabe JJMMTTHHMM (Ortszeit Europe/Berlin) → Date */
export function dbZeit(s) {
  const m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const naiv = Date.UTC(2000 + +m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ms = naiv;
  for (let i = 0; i < 2; i++) {
    const t = berlinTeile(new Date(ms));
    const off = Date.UTC(t.y, t.mo - 1, t.d, t.h, t.mi) - Math.floor(ms / 60000) * 60000;
    ms = naiv - off;
  }
  return new Date(ms);
}

/** Schlüssel JJMMTT/HH für die plan-Abfrage */
function planStunde(d) {
  const t = berlinTeile(d);
  return `${pad(t.y % 100)}${pad(t.mo)}${pad(t.d)}/${pad(t.h)}`;
}

// ---------- XML (flache DB-Struktur, ohne Bibliothek) ----------

function attrs(tag) {
  const o = {};
  for (const m of tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) o[m[1]] = m[2] ?? m[3];
  return o;
}

/** Ein Element ar/dp (selbstschließend oder mit Meldungen) */
function element(body, name) {
  const re = new RegExp(`<${name}\\b([^>]*?)(/>|>([\\s\\S]*?)</${name}>)`);
  const m = re.exec(body);
  if (!m) return null;
  const a = attrs(m[1]);
  a.meldungen = m[3] ? [...m[3].matchAll(/<m\b([^>]*?)\/?>/g)].map((x) => attrs(x[1])) : [];
  return a;
}

/** <s>-Einträge einer plan- oder fchg-Antwort */
function stops(xml) {
  const out = [];
  for (const m of xml.matchAll(/<s\b([^>]*)>([\s\S]*?)<\/s>/g)) {
    const s = attrs(m[1]);
    const body = m[2];
    const tlTag = /<tl\b([^>]*?)\/?>/.exec(body);
    out.push({
      id: s.id,
      tl: tlTag ? attrs(tlTag[1]) : null,
      ar: element(body, 'ar'),
      dp: element(body, 'dp'),
    });
  }
  return out;
}

// ---------- Abruf ----------

async function plan(eva, stunde, z) {
  const key = `${z.offiziell ? 'api' : 'iris'}:${eva}:${stunde}`;
  const disked = disk.get(key, PLAN_TTL);
  if (disked) return disked;
  const { value } = await cached(`dbplan:${key}`, PLAN_TTL, async () => {
    const xml = await fetchText(`${z.base}/plan/${eva}/${stunde}`, z.init);
    return stops(xml);
  });
  disk.set(key, value);
  return value;
}

async function fchg(eva, z) {
  const { value, at } = await cached(`dbfchg:${z.offiziell ? 'api' : 'iris'}:${eva}`, FCHG_TTL, async () => {
    const xml = await fetchText(`${z.base}/fchg/${eva}`, z.init);
    return stops(xml);
  });
  return { liste: value, at };
}

// ---------- Aufbereitung ----------

const FERN = new Set(['ICE', 'IC', 'EC', 'ECE', 'TGV', 'RJ', 'RJX', 'NJ', 'EN', 'FLX', 'WB', 'EST']);

function gattung(tl) {
  if (!tl) return 'Regio';
  if (tl.c === 'S' || tl.f === 'S') return 'S';
  if (tl.f === 'F' || FERN.has(tl.c)) return 'Fern';
  return 'Regio';
}

/** Verspätungsgründe (Meldungstyp d), neueste zuerst, ohne Wiederholungen */
function gruende(...elemente) {
  const ms = elemente.flatMap((e) => e?.meldungen ?? []).filter((m) => m.t === 'd' && m.c);
  ms.sort((a, b) => String(b.ts ?? '').localeCompare(String(a.ts ?? '')));
  const out = [];
  for (const m of ms) {
    const text = CODES[m.c] ?? `Meldung ${m.c}`;
    if (!out.includes(text)) out.push(text);
  }
  return out;
}

const ziel = (pth) => (pth ? pth.split('|').filter(Boolean).at(-1) ?? null : null);
const herkunft = (pth) => (pth ? pth.split('|').filter(Boolean)[0] ?? null : null);

/** Zusammenführen von Soll (plan) und Änderungen (fchg) für einen Halt und eine Richtung */
function ereignis(p, c, richtung, station) {
  const soll = dbZeit(p?.pt);
  if (!soll) return null;
  const ausfall = c?.cs === 'c' || p?.cs === 'c';
  // bei Ausfall gilt die Sollzeit (ct ist dann nur die letzte Prognose vor der Absage)
  const ist = ausfall ? soll : dbZeit(c?.ct) ?? soll;
  // bei Ausfällen ist der geänderte Laufweg leer, dann den geplanten nehmen
  const pth = c?.cpth || p?.ppth;
  return {
    soll,
    ist,
    verspaetung: Math.round((ist - soll) / 60000),
    istBekannt: Boolean(c?.ct),
    gleisSoll: p?.pp ?? null,
    gleis: c?.cp ?? p?.pp ?? null,
    ausfall,
    zusatz: c?.cs === 'a',
    ort: richtung === 'ab' ? ziel(pth) : herkunft(pth),
    station,
  };
}

/**
 * Lädt Soll und Änderungen für beide Hbf-Bahnhöfe (Stunde −1 bis +2) und liefert je Zugfahrt
 * Ankunft und Abfahrt. Grundlage für bahnHbf() und den Abgleich in anschluss.mjs.
 */
async function laden() {
  const z = zugang();
  const jetzt = new Date();
  const stunden = [-1, 0, 1, 2].map((h) => planStunde(new Date(+jetzt + h * 3600_000)));
  const fahrten = [];
  const hinweise = [];
  let stand = 0;
  const alleGruende = new Map(); // Grund → Menge der Fahrt-IDs
  for (const st of STATIONEN) {
    const planListe = [];
    for (const h of stunden) {
      try {
        planListe.push(...await plan(st.eva, h, z));
      } catch (err) {
        hinweise.push(`Sollfahrplan ${st.name} ${h.slice(7)} Uhr nicht abrufbar (${err.message}).`);
      }
    }
    let aend = [];
    try {
      const f = await fchg(st.eva, z);
      aend = f.liste;
      stand = Math.max(stand, f.at);
    } catch (err) {
      hinweise.push(`Änderungen ${st.name} nicht abrufbar (${err.message}); angezeigt wird der Sollfahrplan.`);
    }
    const aendNachId = new Map(aend.map((s) => [s.id, s]));
    for (const s of aend) {
      for (const g of gruende(s.ar, s.dp)) {
        if (!alleGruende.has(g)) alleGruende.set(g, new Set());
        alleGruende.get(g).add(s.id.replace(/-\d+$/, '')); // Fahrt ohne Halt-Index
      }
    }
    const planNachId = new Map(planListe.map((s) => [s.id, s]));
    // Zusatzfahrten stehen nur in fchg (mit eigener Sollzeit)
    for (const s of aend) if (!planNachId.has(s.id) && (s.ar?.pt || s.dp?.pt) && s.tl) planNachId.set(s.id, s);
    for (const [id, p] of planNachId) {
      const c = aendNachId.get(id);
      const tl = p.tl ?? c?.tl;
      const gat = gattung(tl);
      const linieRoh = p.dp?.l ?? p.ar?.l ?? null;
      const linie = linieRoh ?? `${tl?.c ?? ''} ${tl?.n ?? ''}`.trim();
      fahrten.push({
        id,
        eva: st.eva,
        teil: st.teil,
        zug: `${tl?.c ?? ''} ${tl?.n ?? ''}`.trim(),
        zugnummer: tl?.n ?? null,
        linie,
        gattung: gat,
        an: ereignis(p.ar, c?.ar, 'an', st.name),
        ab: ereignis(p.dp, c?.dp, 'ab', st.name),
        gruende: gruende(c?.ar, c?.dp),
      });
    }
  }
  const gruendeHaeufig = [...alleGruende]
    .map(([grund, ids]) => ({ grund, zuege: ids.size }))
    .sort((a, b) => b.zuege - a.zuege)
    .slice(0, 10);
  return { fahrten, gruendeHaeufig, offiziell: z.offiziell, hinweise, stand: stand ? new Date(stand).toISOString() : null };
}

function zeile(f, e) {
  return {
    zug: f.zug,
    linie: f.linie,
    gattung: f.gattung,
    ziel: e.ort,
    gleisSoll: e.gleisSoll,
    gleis: e.gleis,
    gleiswechsel: Boolean(e.gleisSoll && e.gleis && e.gleisSoll !== e.gleis),
    soll: e.soll.toISOString(),
    ist: e.ist.toISOString(),
    verspaetung: e.ausfall ? null : e.verspaetung,
    istBekannt: e.istBekannt,
    ausfall: e.ausfall,
    zusatzfahrt: e.zusatz,
    station: e.station,
    gruende: f.gruende,
  };
}

/**
 * Abfahrten und Ankünfte der Eisenbahn am Stuttgarter Hbf (oben und tief) für die nächsten 90 Minuten,
 * mit Verspätung, Ausfall, Gleiswechsel und Verspätungsgründen. Bei Ankünften steht in `ziel` der Startbahnhof.
 */
export async function bahnHbf() {
  const d = await laden();
  const jetzt = Date.now();
  const fenster = (e) => e && +e.ist >= jetzt - 2 * 60_000 && +e.soll <= jetzt + 90 * 60_000;
  const nachIst = (a, b) => a.ist.localeCompare(b.ist) || a.soll.localeCompare(b.soll);
  const abfahrten = d.fahrten.filter((f) => fenster(f.ab)).map((f) => zeile(f, f.ab)).sort(nachIst).slice(0, 80);
  const ankuenfte = d.fahrten.filter((f) => fenster(f.an)).map((f) => zeile(f, f.an)).sort(nachIst).slice(0, 80);
  for (const a of ankuenfte) { a.herkunft = a.ziel; delete a.ziel; }
  return {
    abfahrten,
    ankuenfte,
    gruendeHaeufig: d.gruendeHaeufig,
    quelle: d.offiziell
      ? `${QUELLE_DB}, DB Timetables-API (DB API Marketplace). ${QUELLE_CODES}`
      : `${QUELLE_DB}, übergangsweise über die inoffizielle Schnittstelle IRIS-TTS der DB. ${QUELLE_CODES}`,
    offiziell: d.offiziell,
    stand: d.stand,
    abgerufen: new Date().toISOString(),
    hinweise: [
      ...d.hinweise,
      ...(d.offiziell ? [] : ['Übergangsweise inoffizielle DB-Schnittstelle (IRIS); der Betrieb kann jederzeit enden.']),
      'Die häufigsten Gründe zählen Züge mit Meldungen im aktuellen Änderungsstand der DB für beide Bahnhofsteile, nicht nur die angezeigten Fahrten.',
    ],
  };
}

/**
 * Ist-Daten der DB je Zugnummer (für den Abgleich mit EFA in anschluss.mjs).
 * Liefert Map Zugnummer → { an, ab, gruende } mit Date-Werten; fehlt die Quelle, eine leere Map.
 */
export async function bahnZugstatus() {
  try {
    const d = await laden();
    const map = new Map();
    for (const f of d.fahrten) if (f.zugnummer) map.set(f.zugnummer, { an: f.an, ab: f.ab, gruende: f.gruende, teil: f.teil });
    return map;
  } catch {
    return new Map();
  }
}

// ---------- Historie ----------

let historie = null;

/** Monatswerte Pünktlichkeit Stuttgart Hbf je Gattung (S, RE-RB, Fern) aus der vorab erzeugten Datei. */
export async function bahnHistorie() {
  if (!historie) historie = JSON.parse(readFileSync(new URL('../data/db-puenktlichkeit-hbf.json', import.meta.url), 'utf8'));
  return historie;
}
