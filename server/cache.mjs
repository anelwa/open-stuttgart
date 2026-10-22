// Kleiner Zwischenspeicher mit Ablaufzeit und höflichem Abruf je Host.
// Ziel: Quellen nur so oft fragen, wie es fachlich nötig ist (GBFS-ttl, Fahrplanauskunft
// höchstens alle 20 s je Haltestelle), und parallele Anfragen auf einen Abruf bündeln.

const store = new Map();
const inflight = new Map();
const lastHit = new Map();

export const USER_AGENT =
  'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt fuer die Stadt Stuttgart)';

// Mindestabstand zwischen zwei Abrufen beim selben Host (ms)
const HOST_GAP = {
  'www.efa-bw.de': 350,
  'www.stuttgart.de': 1000,
  'nominatim.openstreetmap.org': 1100, // Nutzungsrichtlinie: höchstens 1 Anfrage pro Sekunde
  'query.wikidata.org': 2000,
  'veranstaltungen-stadtbibliothek-stuttgart.de': 2000,
  'www.stuttgart-tourist.de': 5000, // Übergangsweise Detailseiten, siehe sources/events-extra.mjs
  'valhalla1.openstreetmap.de': 1100, // FOSSGIS: höchstens 1 Anfrage pro Sekunde
  'routing.openstreetmap.de': 1100, // FOSSGIS (OSRM): höchstens 1 Anfrage pro Sekunde
  'brouter.de': 1100, // Community-Server, sparsam nutzen
  'realtime.gtfs.de': 180_000, // GTFS-RT-Feed (rund 29 MB): höchstens alle 3 Minuten
  'iris.noncd.db.de': 2000, // DB IRIS (inoffiziell, Übergang bis zur DB-Timetables-API), siehe sources/db.mjs
  'apis.deutschebahn.com': 2000, // DB API Marketplace (Timetables)
  // Modul „Was geht“ (sources/wasgeht/): Termine höchstens alle 3–6 h je Quelle, Meldungen alle 15 min
  'www.theaterhaus.com': 2000,
  'www.imwizemann.de': 3000,
  'www.bix-stuttgart.de': 3000,
  'wagenhallen.de': 3000,
  'lka-longhorn.de': 3000,
  'loveyourartist.com': 3000,
  'lehmannclub.ticket.io': 3000,
  'protontheclub.ticket.io': 3000,
  'proton-the-club.ticket.io': 3000,
  'lehmann-discotronic.ticket.io': 3000,
  'clubkowalskistuttgart.ticket.io': 3000,
  'schonnice.ticket.io': 3000,
  'davidpuentez.ticket.io': 3000,
  'stuvus.uni-stuttgart.de': 3000,
  'www.uni-stuttgart.de': 3000,
  'www.uni-hohenheim.de': 5000, // robots.txt: Crawl-delay 5 für einzelne Bots, hier für alle angewandt
  'www.hft-stuttgart.de': 3000,
  'hdm-stuttgart.de': 3000,
  'www.abk-stuttgart.de': 10_000, // robots.txt: Crawl-delay 10
  // Venue-first-Quellen für „Was geht“ (sources/wasgeht/venuefeeds.mjs)
  'eintopf.info': 600, // öffentliche Tageslisten, höchstens alle 12 h (robots.txt sperrt /ical und /rss)
  'ku-bu.de': 3000,
  'www.fridaspier.de': 3000,
  'climax-institutes.de': 3000,
  'kowalskistuttgart.de': 3000,
  'www.evensos.de': 3000,
  'api.rausgegangen.de': 3000, // nur für einen ausdrücklich freigegebenen Partner-Export
  'feuerwehr.stuttgart.de': 1000,
  'api.mobidata-bw.de': 300,
  'api.brightsky.dev': 300,
  'opendata.dwd.de': 500,
  'warnung.bund.de': 500,
  'api.adsb.lol': 1000, // ADS-B-Echtzeitdaten, mehrmals pro Minute ist genug
  'api.energy-charts.info': 1000,
  'api.inaturalist.org': 500,
  'openmensa.org': 500,
  'aviationweather.gov': 1500,
  'www.swr.de': 2000,
  'www.presseportal.de': 2000, // nur RSS, HTML-Seiten haben Bot-Schutz
  'kessel.tv': 2000,
  'api.openstreetmap.org': 1500, // OSM-API: Änderungssätze für „Neu in der Stadt“, sparsam
  'geoserver.stuttgart.de': 500,
  default: 120,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url, init = {}) {
  const host = new URL(url).host;
  const gap = HOST_GAP[host] ?? HOST_GAP.default;
  const now = Date.now();
  const next = Math.max(now, (lastHit.get(host) ?? 0) + gap);
  lastHit.set(host, next);
  if (next > now) await sleep(next - now);
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(init.timeout ?? 15000),
  });
  if (!res.ok) throw new Error(`${host} antwortet mit ${res.status}`);
  return res;
}

export async function fetchJson(url, init) {
  const res = await politeFetch(url, init);
  return res.json();
}

/**
 * Liefert den gespeicherten Wert, solange er frisch ist; sonst wird `load` einmal
 * ausgeführt. Schlägt der Abruf fehl, wird der letzte gute Wert als `stale` geliefert.
 */
export async function cached(key, ttlMs, load) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return { ...hit, fresh: true };
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const value = await load();
      const entry = { value, at: Date.now() };
      store.set(key, entry);
      return { ...entry, fresh: true };
    } catch (err) {
      if (hit) return { ...hit, fresh: false, error: String(err.message ?? err) };
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// Dauerhafter Zwischenspeicher auf der Platte (server/.cache), damit nach einem Neustart
// nicht alle Termine und Adressen erneut abgefragt werden müssen.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('./.cache/', import.meta.url));
mkdirSync(DIR, { recursive: true });

export function diskStore(name) {
  const file = `${DIR}${name}.json`;
  let data = {};
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { /* neu */ }
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { writeFileSync(file, JSON.stringify(data)); } catch { /* egal */ } }, 2000);
  };
  return {
    get: (k, maxAgeMs = Infinity) => {
      const e = data[k];
      return e && Date.now() - e.at < maxAgeMs ? e.v : undefined;
    },
    set: (k, v) => { data[k] = { v, at: Date.now() }; save(); },
    entries: () => Object.entries(data).map(([k, e]) => [k, e.v]),
  };
}

export async function fetchText(url, init) {
  const res = await politeFetch(url, { ...init, headers: { Accept: '*/*', ...(init?.headers ?? {}) } });
  return res.text();
}

/** Binärer Abruf (z. B. Protobuf), liefert einen ArrayBuffer. */
export async function fetchBuffer(url, init) {
  const res = await politeFetch(url, { ...init, headers: { Accept: 'application/octet-stream, */*', ...(init?.headers ?? {}) } });
  return res.arrayBuffer();
}
