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
