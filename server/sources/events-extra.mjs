// Weitere Terminquellen neben dem städtischen Veranstaltungskalender:
// - OpenLigaDB: Heimspiele des VfB Stuttgart in der Bundesliga (offene REST-Schnittstelle)
// - Stadtbibliothek Stuttgart: schema.org-Event in den Listenseiten, je Tag abgerufen
// - Stuttgart-Marketing (stuttgart-tourist.de): schema.org-Event in den Detailseiten. Übergangslösung bis zu
//   einem offiziellen Export: Sitemap höchstens 1x täglich, Detailseiten nacheinander mit 5 s Abstand im
//   Hintergrund, jede Seite höchstens alle 7 Tage. Gesperrte Pfade laut robots.txt werden nicht verwendet.
//   Abschaltbar mit OS_MARKETING=0.
// Abgleich mit dem Stadtkalender nach stuttgart-api-recherche/kultur (Abschnitt 4): Zeit, Ort und Titel.
import { cached, diskStore, fetchJson, fetchText } from '../cache.mjs';

const berlinDate = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);
const berlinHM = (d) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(d);
const short = (s, n = 260) => { const t = (s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n).replace(/\s\S*$/, '')} …` : t; };
/** Ortszeit ohne Zonenangabe (Europe/Berlin) in einen Zeitpunkt umrechnen, unabhängig von der Zeitzone des Servers. */
function berlinLocal(s) {
  const d = new Date(`${s.slice(0, 19)}Z`);
  const off = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Berlin' })) - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(+d - off);
}
const ldBlocks = (html) => [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap((m) => { try { const d = JSON.parse(m[1]); return Array.isArray(d) ? d : [d]; } catch { return []; } });

// ---------- OpenLigaDB ----------
const ARENA = { venue: 'MHPArena', location: 'Mercedesstraße 87, 70372 Stuttgart', lat: 48.7922, lon: 9.2320 };

async function liga() {
  const { value } = await cached('openligadb', 12 * 3600_000, async () => {
    const now = new Date();
    const season = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const d = await fetchJson(`https://api.openligadb.de/getmatchdata/bl1/${season}`);
    return d.filter((m) => /VfB Stuttgart/.test(m.team1?.teamName ?? '')).map((m) => {
      const start = new Date(m.matchDateTimeUTC);
      return {
        id: `liga-${m.matchID}`,
        title: `Fußball-Bundesliga: VfB Stuttgart – ${m.team2.teamName}`,
        teaser: `${m.group?.groupName ?? 'Spieltag'}, ${m.leagueName}.`,
        url: 'https://www.openligadb.de/',
        date: berlinDate(start),
        start: start.toISOString(),
        end: new Date(+start + 115 * 60_000).toISOString(),
        endEstimated: true,
        allDay: false,
        category: 'Sport Fußball',
        ...ARENA,
        district: 'Bad Cannstatt',
        ready: true,
        sources: [{ name: 'OpenLigaDB', url: 'https://www.openligadb.de/' }],
      };
    });
  });
  return value;
}

// ---------- Stadtbibliothek ----------
const BIB = 'https://veranstaltungen-stadtbibliothek-stuttgart.de';
const bibStore = diskStore('bib-days-v1');

function bibEvent(e) {
  const multi = !/T/.test(e.endDate ?? '') && e.endDate && e.endDate.slice(0, 10) > e.startDate.slice(0, 10);
  const start = berlinLocal(e.startDate);
  const allDay = multi || /T00:00:00$/.test(e.startDate);
  const audience = e.audience?.audienceType ?? null;
  const loc = e.location ?? {};
  const street = loc.address?.streetAddress ?? '';
  const venue = loc.name && loc.name !== 'Externe Veranstaltung'
    ? (/bibliothek/i.test(loc.name) ? loc.name : `Stadtteilbibliothek ${loc.name}`) : null;
  return {
    id: `bib-${/id=(\d+)/.exec(e.url)?.[1] ?? e.url}`,
    title: e.name,
    teaser: short(e.description),
    url: e.url,
    from: e.startDate.slice(0, 10),
    to: (e.endDate ?? e.startDate).slice(0, 10),
    start: allDay ? null : start.toISOString(),
    end: !allDay && /T/.test(e.endDate ?? '') ? berlinLocal(e.endDate).toISOString() : null,
    allDay,
    category: `Bibliothek ${audience ?? ''} ${/kind|familie|jugend/i.test(audience ?? '') ? 'Kinder' : 'Bildung'}`,
    audience,
    free: e.offers?.price === '0' ? true : e.offers?.price ? false : null,
    status: /Cancelled/.test(e.eventStatus ?? '') ? 'abgesagt' : /Postponed|Rescheduled/.test(e.eventStatus ?? '') ? 'verschoben' : null,
    location: [street, /\b70\d{3}\b/.test(street) ? '' : 'Stuttgart'].filter(Boolean).join(', '),
    venue,
    sources: [{ name: 'Stadtbibliothek Stuttgart', url: e.url }],
  };
}

/** Termine der Stadtbibliothek für einen Tag. Der Abruf läuft im Hintergrund (Listenseiten ab diesem Datum,
 * höchstens 6, dann Verortung); bis dahin liefert die Funktion null. */
const bibLoading = new Map();
function bibDay(day, geocode) {
  const list = bibStore.get(day, 12 * 3600_000);
  if (list === undefined && !bibLoading.has(day)) {
    bibLoading.set(day, (async () => {
      const found = [];
      for (let page = 1; page <= 6; page += 1) {
        const html = await fetchText(`${BIB}/events?datstart=${day}${page > 1 ? `&page=${page}` : ''}`, { timeout: 20000 });
        const evs = ldBlocks(html).filter((b) => b['@type'] === 'Event' && b.startDate).map(bibEvent);
        found.push(...evs);
        if (!evs.length || evs.some((e) => e.from > day)) break;
      }
      const seen = new Set();
      const out = found.filter((e) => e.from <= day && e.to >= day && !seen.has(e.id) && seen.add(e.id));
      for (const e of out) {
        const g = await geocode(e.location);
        if (g) Object.assign(e, { lat: g.lat, lon: g.lon, approx: g.approx || undefined, venue: e.venue ?? g.name });
      }
      bibStore.set(day, out);
    })().catch(() => {}).finally(() => bibLoading.delete(day)));
  }
  return list === undefined ? null : list.map((e) => ({ ...e, date: day, ready: true }));
}

// ---------- Stuttgart-Marketing ----------
const TOURIST = 'https://www.stuttgart-tourist.de';
const mStore = diskStore('marketing-v1');
const mIndex = diskStore('marketing-index');
const HORIZON = 120 * 86400_000;
let crawling = false;

async function sitemap() {
  let urls = mIndex.get('urls', 24 * 3600_000);
  if (!urls) {
    const xml = await fetchText(`${TOURIST}/data/sitemap/stuttgart_de.xml`, { timeout: 120000 });
    urls = [...xml.matchAll(/<loc>(https:\/\/www\.stuttgart-tourist\.de\/e-[^<]+)<\/loc>/g)].map((m) => m[1]);
    mIndex.set('urls', urls);
  }
  return urls;
}

function marketingPage(url, html) {
  const now = Date.now();
  const evs = ldBlocks(html).flatMap((b) => (b['@type'] === 'WebPage' ? [].concat(b.mainEntity ?? []) : [b])).filter((b) => b['@type'] === 'Event');
  if (!evs.length) return null;
  const e0 = evs[0];
  const loc = e0.location ?? {};
  const a = loc.address ?? {};
  return {
    title: e0.name,
    teaser: short(e0.description),
    venue: loc.name ?? null,
    location: [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    lat: loc.geo?.latitude ?? null,
    lon: loc.geo?.longitude ?? null,
    organizer: e0.organizer?.name ?? null,
    free: /True/.test(String(e0.isAccessibleForFree)) ? true : /False/.test(String(e0.isAccessibleForFree)) ? false : null,
    price: e0.offers?.price ?? (Array.isArray(e0.offers) ? e0.offers[0]?.price : null) ?? null,
    terms: evs.map((e) => ({ start: e.startDate, end: e.endDate ?? null, status: /Cancelled/.test(e.eventStatus ?? '') ? 'abgesagt' : /Postponed|Rescheduled/.test(e.eventStatus ?? '') ? 'verschoben' : null }))
      .filter((t) => { const s = Date.parse(t.start); return s > now - 86400_000 && s < now + HORIZON; }),
  };
}

/** Hintergrundabruf: zuerst nie gelesene Seiten, dann solche, die älter als 7 Tage sind. */
async function crawl() {
  if (crawling || process.env.OS_MARKETING === '0') return;
  crawling = true;
  try {
    const urls = await sitemap();
    const todo = urls.filter((u) => mStore.get(u, 7 * 86400_000) === undefined);
    for (const u of todo) {
      try {
        const html = await fetchText(u, { timeout: 60000 });
        mStore.set(u, marketingPage(u, html));
      } catch {
        mStore.set(u, null); // Fehler merken, in 7 Tagen erneut
      }
    }
  } catch { /* Sitemap nicht erreichbar, nächster Versuch beim nächsten Aufruf */ }
  crawling = false;
}

let mDays = { at: 0, map: new Map() };
function marketingDay(day) {
  crawl();
  if (Date.now() - mDays.at > 5 * 60_000) mDays = { at: Date.now(), map: marketingIndex() };
  return mDays.map.get(day) ?? [];
}

/** Alle Termine aus dem Plattenspeicher, nach Tag gruppiert (mehrtägige an jedem Tag). */
function marketingIndex() {
  const map = new Map();
  // Mehrere Termine derselben Seite an einem Tag (Führungen, Zeitfenster) werden zu einem Eintrag mit Uhrzeitenliste
  const add = (d, e) => {
    if (!map.has(d)) map.set(d, []);
    const list = map.get(d);
    const prev = e.start && list.find((x) => x.url === e.url && x.start);
    if (prev) { prev.times = [...(prev.times ?? [prev.start]), e.start].sort(); return; }
    list.push({ ...e, date: d });
  };
  const first = berlinDate(new Date());
  const last = berlinDate(new Date(Date.now() + 45 * 86400_000));
  for (const [url, p] of mStore.entries()) {
    if (!p) continue;
    p.terms.forEach((t, i) => {
      const s = new Date(t.start);
      const endDay = t.end ? berlinDate(new Date(t.end)) : berlinDate(s);
      const startDay = berlinDate(s);
      const multi = endDay > startDay;
      const allDay = multi || berlinHM(s) === '00:00';
      const ev = {
        id: `sm-${url.split('/e-')[1]}-${i}`,
        title: p.title, teaser: p.teaser, url,
        start: allDay ? null : s.toISOString(),
        end: !allDay && t.end ? new Date(t.end).toISOString() : null,
        allDay,
        category: `${p.venue ?? ''} ${p.organizer ?? ''}`,
        venue: p.venue, location: p.location,
        ...(p.lat != null ? { lat: p.lat, lon: p.lon } : {}),
        free: p.free, price: p.price, status: t.status,
        ready: true,
        sources: [{ name: 'Stuttgart-Marketing', url }],
      };
      // Mehrtägige Einträge (Ausstellungen) an jedem Tag im Zeitraum, höchstens 45 Tage im Voraus
      for (let d = startDay < first ? first : startDay; d <= endDay && d <= last; d = berlinDate(new Date(Date.parse(`${d}T12:00:00Z`) + 86400_000))) add(d, ev);
    });
  }
  return map;
}

export function marketingStatus() {
  let n = 0;
  for (const [, p] of mStore.entries()) if (p !== undefined) n += 1;
  return { pages: n, total: mIndex.get('urls')?.length ?? null, crawling };
}

// ---------- Abgleich ----------
const norm = (s) => (s ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9 ]+/g, ' ');
const tokens = (s) => new Set(norm(s).split(/\s+/).filter((w) => w.length > 3));
function titleSim(a, b) {
  const na = norm(a).replace(/\s+/g, ' ').trim(); const nb = norm(b).replace(/\s+/g, ' ').trim();
  if (na && nb && (na.includes(nb) || nb.includes(na))) return 1;
  const A = tokens(a); const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}
const placeName = (s) => norm(s).replace(/\b(stuttgart|saal|grosses haus|kleines haus)\b/g, '').replace(/\s+/g, ' ').trim();
function dist(a, b) {
  const k = Math.PI / 180; const x = (b.lon - a.lon) * k * Math.cos(((a.lat + b.lat) / 2) * k); const y = (b.lat - a.lat) * k;
  return Math.hypot(x, y) * 6371000;
}

function same(a, b) {
  // Zeit
  if (a.date !== b.date) return false;
  if (a.start && b.start && !a.allDay && !b.allDay && Math.abs(Date.parse(a.start) - Date.parse(b.start)) > 30 * 60_000) return false;
  const sim = titleSim(a.title, b.title);
  // Ort
  let place;
  if (a.lat != null && b.lat != null && !a.approx && !b.approx) place = dist(a, b) <= 150;
  else if ((a.venue || a.location) && (b.venue || b.location)) place = placeName(a.venue || a.location) === placeName(b.venue || b.location);
  else place = null;
  if (place === false) return false;
  if (place === null || (!a.start && !a.allDay)) return sim >= 0.85; // Ort oder Zeit fehlt: sehr hohe Titelähnlichkeit
  return sim >= 0.6;
}

/** Ergänzt die Stadttermine eines Tages um die übrigen Quellen; Treffer werden zusammengeführt, nicht gelöscht. */
export async function mergeExtra(day, city, geocode, { withBib = true } = {}) {
  const list = city.map((c) => ({ ...c, sources: [{ name: 'Stadt Stuttgart', url: c.url }] }));
  const extra = [];
  const [l] = await Promise.allSettled([liga()]);
  if (l.status === 'fulfilled') extra.push(...l.value.filter((e) => e.date === day));
  const bib = withBib ? bibDay(day, geocode) : [];
  if (bib) extra.push(...bib);
  extra.push(...marketingDay(day));
  for (const e of extra) {
    const hit = list.find((c) => same(c, e));
    if (!hit) { list.push(e); continue; }
    if (!hit.sources.some((s) => s.name === e.sources[0].name)) hit.sources.push(...e.sources);
    // Feldweise beste Quelle: Koordinaten, Preis, Status von Stuttgart-Marketing, Zielgruppe von der Bibliothek
    if (e.lat != null && (hit.lat == null || hit.approx)) Object.assign(hit, { lat: e.lat, lon: e.lon, approx: undefined, venue: hit.venue ?? e.venue });
    if (e.free != null && hit.free == null) hit.free = e.free;
    if (e.price != null && hit.price == null) hit.price = e.price;
    if (e.audience && !hit.audience) hit.audience = e.audience;
    if (e.status === 'abgesagt' || (e.status && !hit.status)) hit.status = e.status;
    if (e.endEstimated && !hit.end) { hit.end = e.end; hit.endEstimated = true; }
  }
  return { events: list, pending: bib === null ? 1 : 0, errors: [l].filter((r) => r.status === 'rejected').map((r) => String(r.reason?.message ?? r.reason)) };
}

/** Anzahl zusätzlicher Termine je Tag aus Quellen, die ohne Abruf bekannt sind (VfB, Stuttgart-Marketing). */
export async function extraCounts(days) {
  const l = await liga().catch(() => []);
  return Object.fromEntries(days.map((d) => [d, l.filter((e) => e.date === d).length + marketingDay(d).length]));
}
