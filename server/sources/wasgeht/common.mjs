// Gemeinsame Hilfen für das Modul „Was geht“: Ortsliste, Textbereinigung, Zeit in Europe/Berlin,
// Zwischenspeicher je Quelle (Speicher und Platte) und Stadtbezirke.
import { readFileSync } from 'node:fs';
import { cached, diskStore } from '../../cache.mjs';
import { dist } from '../events-extra.mjs';

const DATA = JSON.parse(readFileSync(new URL('../../data/venues.json', import.meta.url), 'utf8'));
export const VENUES = DATA.venues;
export const TICKETIO_SHOPS = DATA.ticketio;
export const LYA_PROFILES = DATA.lya;
export const venueById = Object.fromEntries(VENUES.map((v) => [v.id, v]));

export const BEZIRKE = ['Mitte', 'Nord', 'Ost', 'Süd', 'West', 'Bad Cannstatt', 'Birkach', 'Botnang', 'Degerloch', 'Feuerbach', 'Hedelfingen',
  'Möhringen', 'Mühlhausen', 'Münster', 'Obertürkheim', 'Plieningen', 'Sillenbuch', 'Stammheim', 'Untertürkheim', 'Vaihingen', 'Wangen', 'Weilimdorf', 'Zuffenhausen'];

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', hellip: '…', times: '×', euro: '€' };
/** HTML-Fragment in einzeiligen Text: Tags entfernen, Entitäten auflösen, Leerraum zusammenfassen. */
export const text = (s) => String(s ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n] ?? m)
  .replace(/\s+/g, ' ').trim();

const norm = (s) => text(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const ALIASES = VENUES.flatMap((v) => v.aliases.map((a) => [` ${norm(a)} `, v.id])).sort((a, b) => b[0].length - a[0].length);

/** Ort aus der Ortsliste zu einem Namen oder einer Adresse (längster passender Alias), sonst null. */
export function venueOf(name) {
  if (!name) return null;
  const n = ` ${norm(name)} `;
  return ALIASES.find(([a]) => n.includes(a))?.[1] ?? null;
}

/** Ortsfelder eines Termins aus der Ortsliste; room ist der Saal, falls die Quelle ihn nennt. */
export function venueFields(id, room) {
  const v = venueById[id];
  if (!v) return {};
  return {
    venueId: v.id, venue: room ? `${v.name}, ${room}` : v.name, location: v.address, lat: v.lat, lon: v.lon,
    ...(v.approx ? { approx: true } : {}), district: v.district,
  };
}

/** Ortsliste ohne interne Felder, für die Oberfläche. */
export const venueList = () => VENUES.map(({ aliases, ...v }) => v);

/** Abstand eines Termins zum Ort der Ortsliste in Metern, null ohne verwertbare Koordinaten. */
export function distToVenue(e, id) {
  const v = venueById[id];
  if (!v || e.lat == null || e.approx) return null;
  return dist(e, v);
}

// ---------- Zeit ----------
export const berlinDate = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);
export const berlinHM = (d) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
export const addDays = (day, n) => berlinDate(new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000));
export const today = () => berlinDate(new Date());

/** Tag der Szene: Beginn zwischen 0 und 6 Uhr zählt zum Vortag („Freitagnacht“). */
export function sceneDay(e) {
  if (!e.start || e.allDay) return e.date;
  const s = new Date(e.start);
  const h = Number(berlinHM(s).slice(0, 2));
  return h < 6 ? addDays(berlinDate(s), -1) : berlinDate(s);
}

/** Preisangabe in Euro als Zahl ("12,50 EUR", "ab 9 €", 12) oder null. */
export function euro(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = /(\d+(?:[.,]\d{1,2})?)/.exec(String(v ?? '').replace(/(\d)\.(\d{3})/g, '$1$2'));
  return m ? Number(m[1].replace(',', '.')) : null;
}
export const priceText = (n) => (n == null ? null : n === 0 ? 'Eintritt frei' : `ab ${n.toLocaleString('de-DE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} Euro`);

/** Altersangabe nur, wenn der Text sie ausdrücklich nennt („ab 18“, „18+“). */
export function minAgeOf(...parts) {
  const t = parts.filter(Boolean).join(' ');
  const m = /\b(?:ab|Einlass ab)\s*(16|18)(?:\s*J(?:ahren|\.)?)?\b(?!\s*(?:Uhr|:|\.\d))|\b(16|18)\s*\+/i.exec(t);
  return m ? Number(m[1] ?? m[2]) : null;
}

/** Stadtbezirk, wenn ein Bezirksname im Text steht („Stuttgart-Degerloch“, „in Bad Cannstatt“). */
export function districtOf(s) {
  const t = String(s ?? '');
  for (const b of [...BEZIRKE].sort((a, c) => c.length - a.length)) {
    // Mitte, Nord, Ost, Süd, West nur mit Stadtnamen, sonst zu viele Fehltreffer („Mitte Oktober“)
    const re = ['Mitte', 'Nord', 'Ost', 'Süd', 'West'].includes(b) ? new RegExp(`Stuttgart[- ]${b}(?![a-zäöüß])`) : new RegExp(`(?<![A-Za-zäöüß])${b}(?![a-zäöüß])`);
    if (re.test(t)) return b;
  }
  return null;
}

// ---------- Zwischenspeicher je Quelle ----------
const disk = diskStore('wasgeht-v1');

/**
 * Lädt eine Quelle höchstens alle ttlMs. Der letzte gute Stand liegt auf der Platte und wird bei Fehlern
 * (oder vor dem ersten Abruf nach einem Neustart) geliefert. Abschaltbar mit OS_SCENE_<KEY>=0.
 */
export async function quelle(key, ttlMs, load) {
  const env = `OS_SCENE_${key.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  if (process.env[env] === '0') return { items: [], at: null, ok: false, off: true, error: `abgeschaltet (${env}=0)` };
  const fresh = disk.get(key, ttlMs);
  if (fresh) return { items: fresh.items, at: fresh.at, ok: true };
  try {
    const r = await cached(`wasgeht:${key}`, ttlMs, async () => {
      const items = await load();
      const at = Date.now();
      disk.set(key, { items, at });
      return { items, at };
    });
    return { items: r.value.items, at: r.value.at, ok: !r.error, ...(r.error ? { error: r.error } : {}) };
  } catch (err) {
    const old = disk.get(key);
    return { items: old?.items ?? [], at: old?.at ?? null, ok: false, error: String(err.message ?? err) };
  }
}

/** Letzter gespeicherter Stand einer Quelle, gleich welchen Alters. */
export function letzterStand(key) {
  const old = disk.get(key);
  return { items: old?.items ?? [], at: old?.at ?? null, ok: false, pending: true };
}

/** Wartet höchstens ms auf ein Ergebnis; danach läuft der Abruf im Hintergrund weiter. */
export async function bisZu(promise, ms, fallback) {
  let timer;
  const late = new Promise((r) => { timer = setTimeout(() => r(fallback), ms); });
  try { return await Promise.race([promise, late]); } finally { clearTimeout(timer); }
}

export { disk as wasgehtDisk };
