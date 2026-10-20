// „Was geht“, Termine: Szene-Quellen zusätzlich zum Kulturmodul (Spezifikation was-geht, Abschnitte 1, 6.3 bis 6.6).
// Nur offene Quellen der Stufe A und die Hochschulen der Stufe B ohne Vorbehalt:
// - Hausquellen: Theaterhaus (JSON hinter der Website), Im Wizemann (HTML), Bix (HTML), Wagenhallen (schema.org)
// - Ticketshops: ticket.io (schema.org MusicEvent je Shop), Love Your Artist (schema.org je Profil und Termin)
// - Hochschulen: Uni Stuttgart, Uni Hohenheim, HfT, HdM, ABK (je eine Listenseite), stuvus (iCal-Gesamtfeed)
// LKA Longhorn, Flohmarkt Karlsplatz, Stadtkalender, Stuttgart-Marketing usw. kommen aus dem Kulturmodul
// (sources/culture.mjs, sources/events-extra.mjs). Beide Module teilen den Bestand; hier wird nur ergänzt und abgeglichen.
// Übernommen werden Fakten (Titel, Zeit, Ort, Preis, Status) und der Link zur Quelle, keine Beschreibungstexte oder Bilder.
// Jede Quelle einzeln: eigener Zwischenspeicher (Speicher und Platte), Fehler betreffen nur diese Quelle,
// abschaltbar mit OS_SCENE_<NAME>=0 (z. B. OS_SCENE_THEATERHAUS=0, OS_SCENE_TICKETIO_LEHMANNCLUB=0).
import { diskStore, fetchJson, fetchText } from '../../cache.mjs';
import { events as kulturTermine, geocode, icsDate, parseIcs } from '../culture.mjs';
import { berlinLocal, dist, ldBlocks, same, titleSim } from '../events-extra.mjs';
import {
  LYA_PROFILES, TICKETIO_SHOPS, VENUES, addDays, berlinDate, berlinHM, bisZu, distToVenue, euro, letzterStand, minAgeOf,
  priceText, quelle, sceneDay, text, today, venueById, venueFields, venueOf,
} from './common.mjs';

const H = 3600_000;
const HORIZON_DAYS = 21; // so weit im Voraus werden Termine gelesen
export const SZENEN = ['konzert', 'party', 'comedy', 'hochschule', 'flohmarkt', 'popup', 'kneipe', 'buehne', 'sonstiges'];
/** Standardsicht „junges Publikum“ (6.6): keine Altersangabe, nur ein Zuschnitt nach Kategorien. */
export const JUNG = ['konzert', 'party', 'comedy', 'hochschule', 'flohmarkt', 'popup', 'kneipe'];

const horizon = () => addDays(today(), HORIZON_DAYS);
const inWindow = (day) => day >= addDays(today(), -1) && day <= horizon();

/** Einheitlicher Termin im Format des Kulturmoduls (CultureEvent) mit den Feldern aus 6.2. */
function termin(q, f) {
  const start = f.start ? new Date(f.start).toISOString() : null;
  const e = {
    id: `${q.id}-${f.key}`, title: text(f.title), teaser: f.teaser ? text(f.teaser) : '', url: f.url,
    start, end: f.end ? new Date(f.end).toISOString() : null, allDay: !start, noTime: !start || undefined,
    category: f.category ?? '', ...venueFields(f.venueId, f.room),
    ...(f.venueId ? {} : { venue: f.venue ?? null, location: f.location ?? '', ...(f.lat != null ? { lat: f.lat, lon: f.lon } : {}), district: f.district ?? null }),
    scene: f.scene?.length ? [...new Set(f.scene)] : ['sonstiges'], genre: f.genre ?? null, minAge: f.minAge ?? null,
    ticketUrl: f.ticketUrl ?? null, priceMin: f.priceMin ?? null, price: f.price ?? priceText(f.priceMin ?? null),
    free: f.free ?? (f.priceMin === 0 ? true : null), doors: f.doors ? new Date(f.doors).toISOString() : null,
    status: f.status ?? null, soldOut: f.soldOut || undefined, performer: f.performer ?? null, license: null,
    ready: true, group: q.group, srcId: q.id, sources: [{ name: q.name, url: f.url }],
  };
  e.date = f.date ?? sceneDay({ ...e, date: start ? berlinDate(new Date(start)) : null });
  return e;
}

// Zuordnung zu Szene-Kategorien per Tabelle und Schlagwort (6.6), nicht per KI
const RE_PARTY = /\b(party|fete|rave|clubnacht|dj|djs|techno|house|hip ?hop|semesterauftakt|ersti-?party|tanzt)\b/i;
const RE_COMEDY = /\b(comedy|kabarett|stand-?up|poetry ?slam|impro(?:theater|visation)?|satire)\b/i;
const RE_BUEHNE = /\b(theater|tanz(?:theater)?|lesung|oper|musical)\b/i;
const RE_FLOH = /flohmarkt|trödel|kleidertausch/i;
const RE_INFO = /studieninfo|studienorientierung|bewerbung|sprechstunde|info-?workshop|infoabend|inforunde|infoveranstaltung|informationsveranstaltung|studieninteressierte|campus-?tour|schnupper|sitzung|meeting|studienkommission|fachgruppensitzung|beratung|webinar|zoom|online-?veranstaltung|einführung für|erstsemester-?einführung|prüfung|frist|habilitation|promotion|antrittsvorlesung|mastertag|karriere(?:lobby|marktplatz)|alumni|\bonline\b|online-|erstsemester|lunchimpuls|blick ins studium|studienwahl|hochschulinformationstag/i;

function hochschulSzene(title) {
  return RE_PARTY.test(title) ? ['hochschule', 'party'] : RE_COMEDY.test(title) ? ['hochschule', 'comedy'] : ['hochschule'];
}

// ---------- Theaterhaus (JSON /de/api/bookings/, 16 Termine je Seite, nach Datum sortiert) ----------
const THEATERHAUS = { id: 'theaterhaus', name: 'Theaterhaus Stuttgart', group: 'haus', url: 'https://www.theaterhaus.com/', license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort, Preis und Link. Schnittstelle undokumentiert, Abstimmung mit dem Haus empfohlen.' };
const TH_GENRE = { Konzert: ['konzert'], Comedy: ['comedy'], Kabarett: ['comedy'], Kleinkunst: ['comedy'], Theater: ['buehne'], Tanz: ['buehne'], Show: ['buehne'] };

async function theaterhaus() {
  const out = [];
  const last = horizon();
  for (let page = 1; page <= 12; page += 1) {
    const d = await fetchJson(`https://www.theaterhaus.com/de/api/bookings/?page=${page}`, { timeout: 20000 });
    for (const r of d.results ?? []) {
      const p = r.production ?? {};
      if (!r.date || !p.title) continue;
      const day = berlinDate(new Date(r.date));
      if (!inWindow(day)) continue;
      const genre = p.genre?.name ?? null;
      const url = p.slug?.de ? `https://www.theaterhaus.com/de/produktion/${p.slug.de}` : THEATERHAUS.url;
      out.push(termin(THEATERHAUS, {
        key: r.id, title: p.title, teaser: p.performer && p.performer !== p.title ? p.performer : '', url,
        start: r.date, venueId: 'theaterhaus', room: p.venue || r.venue || null, genre, performer: p.performer || null,
        scene: TH_GENRE[genre] ?? (RE_COMEDY.test(genre ?? '') ? ['comedy'] : ['sonstiges']),
        category: `Theaterhaus ${genre ?? ''}`, priceMin: r.free_entry ? 0 : euro(p.price_from), free: r.free_entry ? true : null,
        ticketUrl: r.reservix_link || r.link_to_registration_extern || null,
        status: /abgesagt/i.test(r.event_status ?? '') ? 'abgesagt' : r.reschedule_date || /verschoben|verlegt/i.test(r.event_status ?? '') ? 'verschoben' : null,
      }));
    }
    const lastDay = d.results?.length ? berlinDate(new Date(d.results.at(-1).date)) : last;
    if (!d.next || lastDay > last) break;
  }
  return out;
}

// ---------- Im Wizemann (HTML mit schema.org-Mikrodaten, 50 je Seite, ?skip=N) ----------
const WIZEMANN = { id: 'wizemann', name: 'Im Wizemann', group: 'haus', url: 'https://www.imwizemann.de/veranstaltungen', license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort, Preis und Link.' };
const WIZ_KAT = { 1: ['konzert'], 6: ['comedy'], 2: ['sonstiges'], 3: ['sonstiges'], 5: ['sonstiges'] };
const wizTime = (s) => (s ? berlinLocal(s.replace(' ', 'T')).toISOString() : null);

function wizemannPage(html) {
  const out = [];
  for (const m of html.matchAll(/<article id="event-(\d+)"([^>]*)>([\s\S]*?)<\/article>/g)) {
    const [, id, attrs, body] = m;
    const kat = /data-kategorie="(\d+)"/.exec(attrs)?.[1];
    const href = /<a href="([^"]+)" class="event-link"/.exec(body)?.[1];
    const title = text(/<h2 class="p-name"[^>]*>([\s\S]*?)<\/h2>/.exec(body)?.[1]);
    const sub = text(/<h3 class="p-summary">([\s\S]*?)<\/h3>/.exec(body)?.[1]);
    const doors = /datetime="([^"]+)" title="Einlass"/.exec(body)?.[1];
    const begin = /datetime="([^"]+)" title="Beginn"/.exec(body)?.[1] ?? /class="dt-start" datetime="([^"]+)"/.exec(body)?.[1];
    const room = text(/<span class="raum">([^<]*)</.exec(body)?.[1]);
    const where = text(/class="wherewhen[\s\S]*$/.exec(body)?.[0]);
    const price = /itemprop="price" content="([\d.]+)"/.exec(body)?.[1];
    const ticket = /<a href="([^"]+)"[^>]*class="buy"/.exec(body)?.[1] ?? null;
    if (!title || !begin) continue;
    const all = `${title} ${sub}`;
    const scene = WIZ_KAT[kat] ?? ['sonstiges'];
    if (scene[0] === 'sonstiges') { if (RE_PARTY.test(all)) scene[0] = 'party'; else if (RE_FLOH.test(all)) scene[0] = 'flohmarkt'; else if (RE_COMEDY.test(all)) scene[0] = 'comedy'; }
    out.push(termin(WIZEMANN, {
      key: id, title, teaser: sub, url: href ? new URL(href, 'https://www.imwizemann.de/').href : WIZEMANN.url,
      start: wizTime(begin), doors: wizTime(doors), venueId: 'wizemann', room: room || null, scene,
      category: `Im Wizemann ${kat === '1' ? 'Konzert' : kat === '6' ? 'Comedy' : ''}`,
      priceMin: /Eintritt frei/i.test(where) ? 0 : price ? Number(price) : null,
      // Ticketlinks zu Eventim werden nicht übernommen (Eventim ist keine Quelle des Moduls)
      ticketUrl: ticket && !/eventim\./i.test(ticket) ? ticket : null,
      soldOut: /ausverkauft/i.test(where),
      status: /abgesagt|entfällt/i.test(where + sub) ? 'abgesagt' : /verschoben|verlegt/i.test(where + sub) ? 'verschoben' : null,
      minAge: minAgeOf(sub),
    }));
  }
  return out;
}

async function wizemann() {
  const out = [];
  for (let page = 1; page <= 3; page += 1) {
    const html = await fetchText(`https://www.imwizemann.de/veranstaltungen${page > 1 ? `?skip=${page}` : ''}`, { timeout: 30000 });
    const list = wizemannPage(html);
    out.push(...list.filter((e) => inWindow(e.date)));
    if (!list.length || list.at(-1).date > horizon()) break;
  }
  return out;
}

// ---------- Bix Jazzclub (HTML-Liste /programm/: „Di | 20.10.26 | 20:30“) ----------
const BIX = { id: 'bix', name: 'Bix Jazzclub', group: 'haus', url: 'https://www.bix-stuttgart.de/programm/', license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort und Link.' };
async function bix() {
  const html = await fetchText(BIX.url, { timeout: 30000 });
  const out = [];
  for (const m of html.matchAll(/<div class="event">([\s\S]*?)<a href="([^"]+)" class="overlay"><\/a>/g)) {
    const [, body, href] = m;
    const d = /<p class="date">\s*\w+\s*\|\s*(\d{2})\.(\d{2})\.(\d{2})\s*\|\s*(\d{1,2}):(\d{2})/.exec(body);
    const title = text(/<h2>([\s\S]*?)<\/h2>/.exec(body)?.[1]);
    if (!d || !title) continue;
    const day = `20${d[3]}-${d[2]}-${d[1]}`;
    if (!inWindow(day)) continue;
    const clean = title.replace(/\s*[•·|–-]\s*(ausverkauft|abgesagt|verschoben)\s*$/i, '').replace(/^Bix[- ]Tipp:?\s*/i, '');
    out.push(termin(BIX, {
      key: href.split('/').filter(Boolean).pop(), title: clean, url: new URL(href, 'https://www.bix-stuttgart.de/').href,
      start: berlinLocal(`${day}T${d[4].padStart(2, '0')}:${d[5]}:00`), venueId: 'bix', scene: ['konzert'], genre: 'Jazz',
      category: 'Bix Konzert', soldOut: /ausverkauft/i.test(title),
      status: /abgesagt/i.test(title) ? 'abgesagt' : /verschoben/i.test(title) ? 'verschoben' : null,
    }));
  }
  return out;
}

// ---------- Wagenhallen (schema.org Event auf /programm/, Uhrzeit nur im HTML) ----------
const WAGENHALLEN = { id: 'wagenhallen', name: 'Wagenhallen', group: 'haus', url: 'https://wagenhallen.de/programm/', license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort und Link.' };
async function wagenhallen() {
  const html = await fetchText(WAGENHALLEN.url, { timeout: 30000 });
  const times = new Map();
  for (const m of html.matchAll(/data-href="([^"]+)"[\s\S]{0,1500}?class="mec-event-time">(?:<i[^>]*><\/i>)?\s*(\d{1,2}:\d{2})/g)) if (!times.has(m[1])) times.set(m[1], m[2]);
  const out = [];
  for (const b of ldBlocks(html).filter((x) => x['@type'] === 'Event' && x.startDate)) {
    const day = b.startDate.slice(0, 10);
    if (!inWindow(day)) continue;
    const desc = text(b.description);
    const t = times.get(b.url);
    const doorsH = /Einlass(?: ab)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr/i.exec(desc);
    const beginH = /(?:Konzert|Show)?beginn(?: um)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr/i.exec(desc);
    const hm = (m) => (m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : null);
    const start = hm(beginH) ?? t ?? null;
    const doors = hm(doorsH) ?? (beginH && t && t !== hm(beginH) ? t : null);
    const title = text(b.name);
    const scene = RE_PARTY.test(title) ? ['party'] : /markt|kaufhaus|menü|messe|ausstellung/i.test(title) ? ['sonstiges'] : RE_FLOH.test(title) ? ['flohmarkt'] : ['konzert'];
    out.push(termin(WAGENHALLEN, {
      key: b.url.split('/').filter(Boolean).pop(), title, url: b.url,
      start: start ? berlinLocal(`${day}T${start}:00`) : null, doors: doors ? berlinLocal(`${day}T${doors}:00`) : null, date: day,
      venueId: 'wagenhallen', scene, category: 'Wagenhallen', soldOut: /ausverkauft/i.test(desc),
      status: /abgesagt/i.test(desc) ? 'abgesagt' : /verschoben|verlegt/i.test(desc) ? 'verschoben' : null, minAge: minAgeOf(desc),
    }));
  }
  return out;
}

// ---------- ticket.io (je Shop schema.org MusicEvent auf der Startseite) ----------
const TICKETIO = { id: 'ticketio', name: 'ticket.io', group: 'ticket', url: 'https://ticket.io/', license: 'Keine Datenlizenz; schema.org-Angaben der Shopseiten (zur Indexierung bestimmt). Übernommen werden Termin, Ort, Preis und Link.' };
const inCity = (loc) => /stuttgart/i.test(loc?.address?.addressLocality ?? '') || /^70[0-6]\d\d$/.test(String(loc?.address?.postalCode ?? ''));

async function ticketioShop(s) {
  const html = await fetchText(`https://${s.shop}.ticket.io/`, { timeout: 30000 });
  const out = [];
  for (const b of ldBlocks(html).filter((x) => /Event$/.test(x['@type'] ?? '') && x.startDate)) {
    const loc = b.location ?? {};
    if (!inCity(loc)) continue;
    const start = new Date(b.startDate);
    if (!inWindow(berlinDate(start))) continue;
    const vid = s.venueId ?? venueOf(loc.name) ?? null;
    const title = text(b.name);
    const hour = Number(berlinHM(start).slice(0, 2));
    const scene = RE_COMEDY.test(title) ? ['comedy'] : s.scene ? [s.scene] : hour >= 22 || hour < 6 ? ['party'] : ['konzert'];
    const offer = [].concat(b.offers ?? [])[0] ?? {};
    const a = loc.address ?? {};
    out.push(termin({ ...TICKETIO, id: `ticketio-${s.shop}` }, {
      key: b.url?.split('/').filter(Boolean).pop() ?? b.startDate, title, url: b.url ?? `https://${s.shop}.ticket.io/`,
      start: b.startDate, end: b.endDate ?? null, ...(vid ? { venueId: vid } : {
        venue: text(loc.name).replace(/\s*\(([^)]*)\)\s*$/, ', $1'), location: [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        lat: loc.geo?.latitude ?? null, lon: loc.geo?.longitude ?? null,
      }),
      room: vid ? /\(([^)]+)\)\s*$/.exec(loc.name ?? '')?.[1] ?? null : null,
      scene, category: 'ticket.io', performer: [].concat(b.performer ?? [])[0]?.name ?? null,
      priceMin: offer.price != null && offer.price !== '' && Number(offer.price) > 0 ? Number(offer.price) : null,
      ticketUrl: offer.url ?? b.url ?? null, soldOut: /SoldOut/i.test(offer.availability ?? ''),
      status: /Cancelled/.test(b.eventStatus ?? '') ? 'abgesagt' : /Postponed|Rescheduled/.test(b.eventStatus ?? '') ? 'verschoben' : null,
      minAge: minAgeOf(title),
    }));
  }
  return out;
}

// ---------- Love Your Artist (Profil: JSON-LD Organization.event[], Termin: MusicEvent mit Preisspanne) ----------
const LYA = { id: 'lya', name: 'Love Your Artist', group: 'ticket', url: 'https://loveyourartist.com/', license: 'Keine Datenlizenz; schema.org-Angaben der Profil- und Terminseiten. Übernommen werden Termin, Ort, Preis und Link.' };
const lyaDetails = diskStore('wasgeht-lya-termine');

async function lyaDetail(url) {
  const hit = lyaDetails.get(url, 7 * 24 * H);
  if (hit !== undefined) return hit;
  const html = await fetchText(url, { timeout: 30000 });
  const b = ldBlocks(html).find((x) => /Event$/.test(x['@type'] ?? ''));
  const r = b ? {
    end: b.endDate ?? null, low: b.offers?.lowPrice ?? b.offers?.price ?? null, lat: b.location?.geo?.latitude ?? null, lon: b.location?.geo?.longitude ?? null,
    street: b.location?.address?.streetAddress ?? null, performer: [].concat(b.performer ?? [])[0]?.name ?? null, type: b['@type'],
    status: /Cancelled/.test(b.eventStatus ?? '') ? 'abgesagt' : /Postponed|Rescheduled/.test(b.eventStatus ?? '') ? 'verschoben' : null,
  } : null;
  lyaDetails.set(url, r);
  return r;
}

async function lyaProfile(p) {
  const html = await fetchText(`https://loveyourartist.com/de/profiles/${p.profile}`, { timeout: 30000 });
  const seen = new Set();
  const out = [];
  for (const org of ldBlocks(html).filter((x) => x['@type'] === 'Organization')) {
    for (const ev of org.event ?? []) {
      if (!ev.startDate || !ev.url || seen.has(ev.url)) continue;
      seen.add(ev.url);
      const start = new Date(ev.startDate);
      if (!inWindow(berlinDate(start)) || !/stuttgart/i.test(ev.location?.address?.addressLocality ?? 'Stuttgart')) continue;
      const url = new URL(`/de${ev.url}`, 'https://loveyourartist.com').href;
      // Terminseite nur für die nächsten 14 Tage (Preis, Koordinaten), je Seite höchstens alle 7 Tage
      let d = null;
      if (berlinDate(start) <= addDays(today(), 14)) d = await lyaDetail(url).catch(() => null);
      const title = text(ev.name);
      const vid = venueOf(ev.location?.name) ?? venueOf(d?.street);
      const scene = RE_COMEDY.test(title) || d?.type === 'ComedyEvent' ? ['comedy'] : RE_PARTY.test(title) ? ['party']
        : RE_BUEHNE.test(title) || d?.type === 'TheaterEvent' || d?.type === 'DanceEvent' ? ['buehne'] : d?.type && d.type !== 'MusicEvent' && d.type !== 'Event' ? ['sonstiges'] : ['konzert'];
      out.push(termin({ ...LYA, id: `lya-${p.profile}` }, {
        key: ev.url.split('/').pop(), title, url, start: ev.startDate, end: d?.end ?? null,
        ...(vid ? { venueId: vid } : { venue: text(ev.location?.name) || null, location: d?.street ?? 'Stuttgart', lat: d?.lat ?? null, lon: d?.lon ?? null }),
        scene, category: `Love Your Artist ${p.name}`, performer: d?.performer ?? null,
        priceMin: d?.low != null && Number(d.low) > 0 ? Number(d.low) : null, ticketUrl: url, status: d?.status ?? null, minAge: minAgeOf(title),
      }));
    }
  }
  return out;
}

// ---------- Hochschulen ----------
const HS_LICENSE = 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort und Link. Interne Termine und Infoveranstaltungen werden ausgefiltert.';
const UNI = { id: 'uni-stuttgart', name: 'Universität Stuttgart', group: 'hochschule', url: 'https://www.uni-stuttgart.de/universitaet/aktuelles/veranstaltung/', license: HS_LICENSE };
async function uniStuttgart() {
  const html = await fetchText(UNI.url, { timeout: 30000 });
  const out = [];
  for (const m of html.matchAll(/<article class="newsstream"\s+data-typ="event_v3"[\s\S]*?<a href="([^"]+)"[^>]*>\s*<h5>([\s\S]*?)<\/h5>\s*<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<li>([^<]+)<\/li>/g)) {
    const [, href, h, sub, when] = m;
    const d = /(\d{2})\.(\d{2})\.(\d{2})(?:,\s*(\d{1,2}):(\d{2}))?/.exec(when);
    if (!d) continue;
    const day = `20${d[3]}-${d[2]}-${d[1]}`;
    const title = text(h);
    if (!inWindow(day) || RE_INFO.test(`${title} ${text(sub)}`)) continue;
    out.push(termin(UNI, {
      key: href.split('/').filter(Boolean).pop(), title, teaser: text(sub), url: href,
      start: d[4] ? berlinLocal(`${day}T${d[4].padStart(2, '0')}:${d[5]}:00`) : null, date: day,
      venue: 'Universität Stuttgart', location: 'Stuttgart', scene: hochschulSzene(title), category: 'Hochschule Universität Stuttgart',
    }));
  }
  return out;
}

const HOHENHEIM = { id: 'hohenheim', name: 'Universität Hohenheim', group: 'hochschule', url: 'https://www.uni-hohenheim.de/veranstaltungskalender', license: HS_LICENSE };
async function hohenheim() {
  const html = await fetchText(HOHENHEIM.url, { timeout: 30000 });
  const out = [];
  let day = null;
  for (const m of html.matchAll(/<th colspan="2">[^<]*?(\d{2})\.(\d{2})\.(\d{4})<\/th>|<td>(\d{1,2}:\d{2})?<\/td>\s*<td>\s*<a href="([^"]+)">([\s\S]*?)<\/a>/g)) {
    if (m[1]) { day = `${m[3]}-${m[2]}-${m[1]}`; continue; }
    const title = text(m[6]);
    if (!day || !inWindow(day) || RE_INFO.test(title)) continue;
    out.push(termin(HOHENHEIM, {
      key: m[5].split('-').pop(), title, url: new URL(m[5], 'https://www.uni-hohenheim.de/').href,
      start: m[4] ? berlinLocal(`${day}T${m[4].padStart(5, '0')}:00`) : null, date: day,
      venueId: 'hohenheim', scene: hochschulSzene(title), category: 'Hochschule Universität Hohenheim',
    }));
  }
  return out;
}

const HFT = { id: 'hft', name: 'Hochschule für Technik Stuttgart', group: 'hochschule', url: 'https://www.hft-stuttgart.de/veranstaltungen', license: HS_LICENSE };
async function hft() {
  const html = await fetchText(HFT.url, { timeout: 30000 });
  const out = [];
  for (const m of html.matchAll(/<li class="container ce--events events">([\s\S]*?)<\/li>/g)) {
    const b = m[1];
    const times = [...b.matchAll(/<time datetime="([^"]+)">/g)].map((x) => x[1]);
    const title = text(/<h2 class="events__content__title">([\s\S]*?)<\/h2>/.exec(b)?.[1]);
    const href = /<a class="link" href="([^"]+)">Details/.exec(b)?.[1];
    if (!times[0] || !title || !href) continue;
    const day = times[0].slice(0, 10);
    // Mehrtägige Einträge (Ausstellungen) nur am ersten Tag; interne Termine über die Titelregeln ausgefiltert
    if (!inWindow(day) || RE_INFO.test(title)) continue;
    const hasTime = !/ 00:00$/.test(times[0]);
    out.push(termin(HFT, {
      key: href.split('/').filter(Boolean).pop(), title, url: new URL(href, 'https://www.hft-stuttgart.de/').href,
      start: hasTime ? berlinLocal(times[0].replace(' ', 'T')) : null, end: times[1] && times[1].slice(0, 10) === day ? berlinLocal(times[1].replace(' ', 'T')) : null, date: day,
      venueId: 'hft', scene: hochschulSzene(title), category: 'Hochschule HfT',
    }));
  }
  return out;
}

const HDM = { id: 'hdm', name: 'Hochschule der Medien', group: 'hochschule', url: 'https://hdm-stuttgart.de/hochschule/aktuelles/terminkalender/', license: HS_LICENSE };
const MONATE = { januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
async function hdm() {
  const html = await fetchText(HDM.url, { timeout: 30000 });
  const out = [];
  for (const part of html.split('class="calendar-preview-list-entry"').slice(1)) {
    const href = /href="(\/termin\/[^"]+)"/.exec(part)?.[1];
    const title = text(/<h2>([\s\S]*?)<\/h2>/.exec(part)?.[1]);
    const t = text(part.split('mehr erfahren')[0]);
    const d = /(\d{1,2})\. (\p{L}+) (\d{4})/u.exec(t);
    if (!href || !title || !d || !MONATE[d[2].toLowerCase()]) continue;
    const day = `${d[3]}-${String(MONATE[d[2].toLowerCase()]).padStart(2, '0')}-${d[1].padStart(2, '0')}`;
    const tm = /(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?\s*Uhr/.exec(t);
    const place = t.split(/Uhr\s+/).pop();
    if (!inWindow(day) || RE_INFO.test(`${title} ${place}`) || /online|via zoom|virtuell/i.test(place)) continue;
    const ext = !/Nobelstr|Hochschule der Medien|HdM|Meiden/i.test(place) && /\b70\d{3}\b/.test(place);
    out.push(termin(HDM, {
      key: href.split('/').filter(Boolean).pop().slice(-14), title, url: new URL(href, 'https://hdm-stuttgart.de/').href,
      start: tm ? berlinLocal(`${day}T${tm[1].padStart(2, '0')}:${tm[2]}:00`) : null,
      end: tm?.[3] ? berlinLocal(`${day}T${tm[3].padStart(2, '0')}:${tm[4]}:00`) : null, date: day,
      ...(ext ? { venue: place.split(',')[0], location: place } : { venueId: 'hdm' }), scene: hochschulSzene(title), category: 'Hochschule HdM',
    }));
  }
  return out;
}

// ABK: robots.txt verlangt 10 s Abstand (HOST_GAP); eine Listenseite je Abruf
const ABK = { id: 'abk', name: 'Akademie der Bildenden Künste Stuttgart', group: 'hochschule', url: 'https://www.abk-stuttgart.de/kalender/', license: HS_LICENSE };
async function abk() {
  const html = await fetchText(ABK.url, { timeout: 30000 });
  const out = [];
  for (const m of html.matchAll(/<a href="(https:\/\/www\.abk-stuttgart\.de\/kalender\/[^"]+)"\s+class="block block-teaser[^"]*event[^"]*"[\s\S]*?<\/a>/g)) {
    const b = m[0];
    const dates = [...b.matchAll(/data-content="(\d{2})\.(\d{2})\.(\d{4})"/g)].map((x) => `${x[3]}-${x[2]}-${x[1]}`);
    const title = text(/<div class="title">([\s\S]*?)<\/div>/.exec(b)?.[1]);
    const place = text(/<div class="description">([\s\S]*?)<\/div>/.exec(b)?.[1]);
    const tag = text(/<span class="label tag">([\s\S]*?)<\/span>/.exec(b)?.[1]);
    if (!dates[0] || !title || !inWindow(dates[0]) || RE_INFO.test(title)) continue;
    // Nur Orte in Stuttgart (Postleitzahl 70xxx oder ohne Ortsangabe an der Akademie)
    const plz = /\b(\d{5})\b/.exec(place)?.[1];
    if (plz && !/^70[0-6]/.test(plz)) continue;
    const atAbk = !place || /Weißenhof|Akademie|ABK/i.test(place);
    const e = termin(ABK, {
      key: m[1].split('/').filter(Boolean).pop(), title, url: m[1], date: dates[0],
      ...(atAbk ? { venueId: 'abk' } : { venue: place.split(',')[0], location: place }),
      scene: hochschulSzene(title), category: `Hochschule ABK ${tag}`, genre: tag || null,
    });
    if (dates[1] && dates[1] !== dates[0]) e.until = dates[1];
    if (!atAbk) {
      const g = await geocode(place).catch(() => null);
      if (g) Object.assign(e, { lat: g.lat, lon: g.lon, approx: g.approx || undefined });
    }
    out.push(e);
  }
  return out;
}

// stuvus: iCal-Gesamtfeed (Modern Events Calendar), Serien werden aufgelöst
const STUVUS = { id: 'stuvus', name: 'stuvus (Studierendenvertretung Universität Stuttgart)', group: 'hochschule', url: 'https://stuvus.uni-stuttgart.de/', license: HS_LICENSE };
function expand(ev, from, to) {
  const s = icsDate(ev.DTSTART);
  if (!s) return [];
  const e = icsDate(ev.DTEND);
  const len = e ? e - s : 0;
  const rule = Object.fromEntries((ev.RRULE ?? '').split(';').filter(Boolean).map((x) => x.split('=')));
  const out = [];
  const until = rule.UNTIL ? icsDate(rule.UNTIL) : null;
  const count = rule.COUNT ? Number(rule.COUNT) : rule.FREQ ? 500 : 1;
  const step = Math.max(1, Number(rule.INTERVAL ?? 1));
  let t = new Date(s);
  for (let i = 0; i < count && t <= to && (!until || t <= until); i += 1) {
    if (t >= from) out.push([new Date(t), len ? new Date(+t + len) : null]);
    if (!rule.FREQ) break;
    if (rule.FREQ === 'DAILY') t = new Date(+t + step * 86400_000);
    else if (rule.FREQ === 'WEEKLY') t = new Date(+t + step * 7 * 86400_000);
    else if (rule.FREQ === 'MONTHLY') { t = new Date(t); t.setUTCMonth(t.getUTCMonth() + step); }
    else break;
  }
  return out;
}
async function stuvus() {
  const ics = await fetchText('https://stuvus.uni-stuttgart.de/?mec-ical-feed=1', { timeout: 60000 });
  const from = new Date(`${addDays(today(), -1)}T00:00:00Z`);
  const to = new Date(`${horizon()}T23:59:59Z`);
  const out = [];
  for (const ev of parseIcs(ics)) {
    if (ev.CLASS && ev.CLASS !== 'PUBLIC') continue;
    const title = text(ev.SUMMARY);
    if (!title || RE_INFO.test(title)) continue;
    for (const [s, e] of expand(ev, from, to)) {
      const allDay = !/T/.test(ev.DTSTART ?? '');
      out.push(termin(STUVUS, {
        key: `${(ev.UID ?? title).replace(/@.*$/, '').slice(-12)}-${berlinDate(s)}`, title, url: ev.URL || STUVUS.url,
        start: allDay ? null : s, end: allDay ? null : e, date: allDay ? (ev.DTSTART ?? '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3') : undefined,
        venue: ev.LOCATION ? `Universität Stuttgart, ${text(ev.LOCATION)}` : 'Universität Stuttgart', location: 'Stuttgart',
        scene: hochschulSzene(title), category: 'Hochschule stuvus',
      }));
    }
  }
  return out;
}

// ---------- Quellenliste in Einspeisereihenfolge (6.5.1: Hausquellen, dann Ticketshops, dann Hochschulen) ----------
const Q = [
  { ...THEATERHAUS, ttl: 6 * H, load: theaterhaus },
  { ...WIZEMANN, ttl: 6 * H, load: wizemann },
  { ...BIX, ttl: 6 * H, load: bix },
  { ...WAGENHALLEN, ttl: 6 * H, load: wagenhallen },
  ...TICKETIO_SHOPS.map((s) => ({ ...TICKETIO, id: `ticketio-${s.shop}`, name: 'ticket.io', shop: `${s.shop}.ticket.io`, url: `https://${s.shop}.ticket.io/`, ttl: 3 * H, load: () => ticketioShop(s) })),
  ...LYA_PROFILES.map((p) => ({ ...LYA, id: `lya-${p.profile}`, name: 'Love Your Artist', shop: p.name, url: `https://loveyourartist.com/de/profiles/${p.profile}`, ttl: 6 * H, load: () => lyaProfile(p) })),
  { ...UNI, ttl: 6 * H, load: uniStuttgart },
  { ...HOHENHEIM, ttl: 6 * H, load: hohenheim },
  { ...HFT, ttl: 6 * H, load: hft },
  { ...HDM, ttl: 6 * H, load: hdm },
  { ...ABK, ttl: 6 * H, load: abk },
  { ...STUVUS, ttl: 6 * H, load: stuvus },
];

/** Alle Szene-Quellen laden; wartet höchstens waitMs, danach gilt der letzte gespeicherte Stand. */
export async function szeneQuellen(waitMs = 8000) {
  const deadline = Date.now() + waitMs;
  const runs = Q.map((q) => ({ q, p: quelle(q.id, q.ttl, q.load) }));
  const out = [];
  for (const { q, p } of runs) {
    const r = await bisZu(p, Math.max(0, deadline - Date.now()), letzterStand(q.id));
    out.push({ q, ...r });
  }
  return out;
}

// ---------- Abgleich (6.5) ----------
const STRIP = /\b(?:live(?: in stuttgart)?|tour \d{4}|\d{4} tour|ausverkauft|sold out|zusatzshow|zusatzkonzert|neuer termin|verlegt|stuttgart)\b|(?:pr[aä]sentiert von|presented by|pres\.)\s.*$|\+\s*support.*$|\(.*?\)/gi;
/** Vergleichstitel: der Titel, der Titel ohne Zusätze und der Teil nach „|“ oder „–“ als zweiter Titel (6.5.3). */
function titleVariants(t) {
  const base = text(t);
  const second = base.split(/\s+[|–—]\s+|\s*\|\s*/).slice(1);
  return [...new Set([base, ...second].flatMap((s) => [s, s.replace(STRIP, ' ').replace(/\s+/g, ' ').trim()]))].filter((s) => s.length >= 3);
}
function bestSim(a, b) {
  let best = 0;
  for (const x of titleVariants(a.title)) for (const y of titleVariants(b.title)) best = Math.max(best, titleSim(x, y));
  return best;
}
const mainPerformer = (p) => text(p).toLowerCase().split(/\s*(?:,|&|\+| und | feat\.? | w\/ )\s*/)[0];
function performerMatch(a, b) {
  if (!a.performer || !b.performer) return false;
  const x = mainPerformer(a.performer); const y = mainPerformer(b.performer);
  return x.length >= 3 && y.length >= 3 && (x === y || x.includes(y) || y.includes(x));
}
/** Vergleichsbeginn: Beginn, sonst Einlass + 60 min, sonst null (6.5.4). */
function cmpStart(e) {
  if (e.start && !e.allDay && !e.noTime) return Date.parse(e.start);
  return e.doors ? Date.parse(e.doors) + H : null;
}
/** Ort gleich? true/false, null = nicht entscheidbar, 'alt' = ohne Ortsliste wie im Kulturmodul. */
function samePlace(a, b) {
  if (a.venueId && b.venueId) {
    if (a.venueId === b.venueId) return true;
    return a.lat != null && b.lat != null && !a.approx && !b.approx && dist(a, b) <= 150;
  }
  if (a.venueId || b.venueId) {
    const [v, o] = a.venueId ? [a.venueId, b] : [b.venueId, a];
    const d = distToVenue(o, v);
    if (d != null) return d <= 150;
    const n = venueOf(o.venue) ?? venueOf(o.location);
    return n ? n === v : null;
  }
  return 'alt';
}

function matchScene(a, b, grenz) {
  if (a.date !== b.date) return false;
  if (a.srcId && a.srcId === b.srcId) return false; // innerhalb einer Quelle sind gleichzeitige Einträge verschiedene Termine
  const place = samePlace(a, b);
  if (place === 'alt') return same(a, b);
  if (place === false) return false;
  if (place === true && performerMatch(a, b)) return true;
  const ta = cmpStart(a); const tb = cmpStart(b);
  if (ta != null && tb != null && Math.abs(ta - tb) > 30 * 60_000) return false;
  const sim = bestSim(a, b);
  if (place === null) return sim >= 0.85;
  if (sim >= 0.6) return true;
  if (sim >= 0.4) grenz.push({ date: a.date, a: { title: a.title, source: a.sources?.[0]?.name }, b: { title: b.title, source: b.sources?.[0]?.name }, sim: +sim.toFixed(2) });
  return false;
}

/** Ergänzt einen vorhandenen Termin feldweise um einen Treffer aus einer Szene-Quelle (6.5.5 und 6.5.6). */
function mergeInto(hit, e) {
  for (const s of e.sources) if (!hit.sources.some((x) => x.name === s.name)) hit.sources.push(s);
  hit.scene = [...new Set([...(hit.scene ?? []).filter((s) => s !== 'sonstiges'), ...e.scene.filter((s) => s !== 'sonstiges')])];
  if (!hit.scene.length) hit.scene = ['sonstiges'];
  if (e.group === 'ticket') {
    if (!hit.ticketUrl) hit.ticketUrl = e.ticketUrl ?? e.url;
    if (e.priceMin != null) { hit.priceMin = e.priceMin; hit.price = e.price; }
  } else if (e.priceMin != null && hit.priceMin == null) { hit.priceMin = e.priceMin; hit.price = hit.price ?? e.price; }
  if (e.group === 'haus') { hit.genre = hit.genre ?? e.genre; if (e.venue && e.venueId === hit.venueId && e.venue.length > (hit.venue ?? '').length) hit.venue = e.venue; }
  if (!hit.genre && e.genre) hit.genre = e.genre;
  if (!hit.venueId && e.venueId) Object.assign(hit, { venueId: e.venueId, district: hit.district ?? e.district });
  if (e.lat != null && !e.approx && (hit.lat == null || hit.approx)) Object.assign(hit, { lat: e.lat, lon: e.lon, approx: undefined });
  if ((!hit.start || hit.allDay || hit.noTime) && e.start) Object.assign(hit, { start: e.start, end: hit.end ?? e.end, allDay: false, noTime: undefined });
  if (!hit.doors && e.doors) hit.doors = e.doors;
  if (hit.minAge == null && e.minAge != null) hit.minAge = e.minAge;
  if (hit.free == null && e.free != null) hit.free = e.free;
  if (e.soldOut) hit.soldOut = true;
  if (!hit.performer && e.performer) hit.performer = e.performer;
  if (e.status === 'abgesagt' || (e.status && !hit.status)) hit.status = e.status;
}

/** Termine des Kulturmoduls um Ort aus der Ortsliste und Szene-Kategorie ergänzen (Kopie, keine Änderung am Bestand). */
function kulturTermin(c) {
  const e = { ...c, sources: [...(c.sources ?? [{ name: 'Stadt Stuttgart', url: c.url }])] };
  let vid = venueOf(c.venue) ?? null;
  if (!vid && c.lat != null && !c.approx) vid = VENUES.find((v) => !v.approx && dist(c, v) <= 80)?.id ?? null;
  if (vid) Object.assign(e, { venueId: vid, district: e.district ?? venueById[vid].district });
  const names = e.sources.map((s) => s.name).join(' ');
  const all = `${c.title} ${c.category ?? ''}`;
  e.scene = /LKA Longhorn/.test(names) ? ['konzert'] : RE_FLOH.test(all) ? ['flohmarkt'] : vid && venueById[vid] && ['wizemann', 'bix', 'lehmann', 'proton', 'clubcann', 'clubzentral'].includes(vid) ? ['konzert'] : ['sonstiges'];
  e.group = 'kultur';
  return e;
}

/** Ein Tag: Kulturbestand plus Szene-Quellen, abgeglichen. */
async function tagesliste(day, quellen, waitMs) {
  const k = await bisZu(kulturTermine(day).catch((err) => ({ error: String(err.message ?? err) })), waitMs, null);
  const list = (k?.events ?? []).map(kulturTermin);
  const grenz = [];
  const paare = [];
  let merged = 0;
  for (const r of quellen) {
    for (const src of r.items.filter((e) => e.date === day)) {
      const e = { ...src, srcId: r.q.id, sources: [...src.sources], scene: [...src.scene] };
      const hit = list.find((c) => c !== e && matchScene(c, e, grenz));
      if (hit) {
        paare.push({ quelle: e.sources[0].name, mit: hit.sources[0].name, titel: e.title, mitTitel: hit.title });
        mergeInto(hit, e); merged += 1;
      } else list.push(e);
    }
  }
  return { list, merged, grenz, paare, kultur: k ? { ok: !k.error, count: k.events?.length ?? 0, pending: k.pending ?? 0, error: k.error ?? null } : { ok: false, count: 0, pending: 1, error: 'Kulturmodul antwortet noch nicht' } };
}

const pruef = diskStore('wasgeht-pruefliste');
const weekend = (d) => {
  const wd = new Date(`${d}T12:00:00Z`).getUTCDay(); // 0 So … 6 Sa
  const fri = wd === 0 ? addDays(d, -2) : wd === 6 ? addDays(d, -1) : addDays(d, 5 - wd);
  return [fri, addDays(fri, 1), addDays(fri, 2)].filter((x) => x >= today());
};
const isEvening = (e) => {
  if (!e.start || e.allDay) return false;
  const h = Number(berlinHM(new Date(e.start)).slice(0, 2));
  return h >= 17 || h < 6;
};

/**
 * Sicht „Was geht“ (6.7): Termine eines Tages (span=tag), des Abends (span=abend) oder des Wochenendes
 * (span=wochenende, Freitag bis Sonntag ab dem Tag), gefiltert nach Szene, junges Publikum, kostenlos und Höchstpreis.
 */
export async function wasGeht({ tag, span, szene, jung, free, maxPrice, details } = {}) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(tag ?? '') ? tag : today();
  const mode = ['abend', 'wochenende', 'tag'].includes(span) ? span : 'tag';
  const days = mode === 'wochenende' ? weekend(date) : [date];
  const quellen = await szeneQuellen();
  let all = [];
  let merged = 0;
  const grenz = [];
  const paare = [];
  const kultur = [];
  for (const d of days) {
    const r = await tagesliste(d, quellen, 10000);
    all.push(...r.list); merged += r.merged; grenz.push(...r.grenz); paare.push(...r.paare); kultur.push(r.kultur);
  }
  if (grenz.length) pruef.set(date, grenz.slice(0, 50));
  if (mode === 'abend') all = all.filter(isEvening);
  const counts = Object.fromEntries(SZENEN.map((s) => [s, all.filter((e) => e.scene?.includes(s)).length]));
  const want = new Set(String(szene ?? '').split(',').map((s) => s.trim()).filter((s) => SZENEN.includes(s)));
  const jungOn = jung === true || jung === '1' || jung === 1 || jung === 'true';
  const max = maxPrice != null && maxPrice !== '' && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null;
  const freeOn = free === true || free === '1' || free === 1 || free === 'true';
  const shown = all.filter((e) => (!want.size || e.scene?.some((s) => want.has(s)))
    && (!jungOn || e.scene?.some((s) => JUNG.includes(s)))
    && (!freeOn || e.free === true || e.priceMin === 0)
    && (max == null || e.free === true || (e.priceMin != null && e.priceMin <= max)))
    .sort((a, b) => (a.date.localeCompare(b.date)) || ((cmpStart(a) ?? 9e15) - (cmpStart(b) ?? 9e15)) || a.title.localeCompare(b.title, 'de'));
  const byGroup = new Map();
  for (const r of quellen) {
    const key = r.q.id.startsWith('ticketio-') ? 'ticketio' : r.q.id.startsWith('lya-') ? 'lya' : r.q.id;
    const g = byGroup.get(key) ?? { id: key, name: r.q.name, group: r.q.group, url: key === 'ticketio' ? TICKETIO.url : key === 'lya' ? LYA.url : r.q.url, license: r.q.license, count: 0, total: 0, ok: true, updated: null, errors: [], parts: [] };
    g.count += r.items.filter((e) => days.includes(e.date)).length;
    g.total += r.items.length;
    g.ok = g.ok && r.ok;
    if (r.at && (!g.updated || r.at > Date.parse(g.updated))) g.updated = new Date(r.at).toISOString();
    if (r.error) g.errors.push(r.q.shop ? `${r.q.shop}: ${r.error}` : r.error);
    if (r.pending) g.errors.push(r.q.shop ? `${r.q.shop}: Abruf läuft` : 'Abruf läuft');
    if (r.q.shop) g.parts.push({ name: r.q.shop, url: r.q.url, count: r.items.length, ok: r.ok });
    byGroup.set(key, g);
  }
  const sources = [
    { id: 'kultur', name: 'Kulturmodul (Stadt Stuttgart, Stuttgart-Marketing, StadtPalais, Stadtbibliothek, LKA Longhorn, Märkte, OpenLigaDB)', group: 'kultur', url: null,
      license: 'siehe Kulturmodul', count: kultur.reduce((s, k) => s + k.count, 0), ok: kultur.every((k) => k.ok), updated: null, errors: kultur.map((k) => k.error).filter(Boolean) },
    ...[...byGroup.values()].map(({ errors, parts, ...g }) => ({ ...g, error: errors.join('; ') || null, ...(parts.length ? { parts } : {}) })),
  ];
  return {
    date, days, span: mode,
    events: shown, total: all.length, counts, merged,
    // Kennzahlen des Abgleichs (6.5.7): zusammengeführte Paare je Quelle
    abgleich: Object.entries(paare.reduce((m, p) => { const k = `${p.quelle} → ${p.mit}`; m[k] = (m[k] ?? 0) + 1; return m; }, {})).map(([paar, anzahl]) => ({ paar, anzahl })),
    pending: kultur.reduce((s, k) => s + k.pending, 0),
    pruefliste: grenz.length, sources,
    ...(details ? { abgleichListe: paare, grenzfaelle: grenz } : {}),
    errors: sources.filter((s) => s.error).map((s) => `${s.name}: ${s.error}`),
    hinweis: 'Angaben ohne Gewähr, maßgeblich ist der Veranstalter.',
  };
}

/** Grenzfälle des Abgleichs (Titelähnlichkeit 0,4 bis 0,6 am selben Ort und Tag) zum Nachjustieren der Schwellen. */
export function wasGehtPruefliste() {
  return { items: pruef.entries().flatMap(([d, list]) => list.map((x) => ({ ...x, run: d }))) };
}

/** Ortsliste mit Koordinaten (6.4). */
export { venueList as orte } from './common.mjs';

const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsUtc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** iCal der gefilterten Sicht (6.7: GET /api/wasgeht.ics), offen zurückgegeben; Inhalt text/calendar. */
export async function wasGehtIcs(params = {}) {
  const r = await wasGeht(params);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Open Stuttgart//Was geht//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Was geht in Stuttgart'];
  for (const e of r.events) {
    lines.push('BEGIN:VEVENT', `UID:${icsText(e.id)}@open-stuttgart`, `DTSTAMP:${icsUtc(Date.now())}`);
    if (e.start && !e.allDay) lines.push(`DTSTART:${icsUtc(e.start)}`, ...(e.end ? [`DTEND:${icsUtc(e.end)}`] : []));
    else lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`);
    lines.push(`SUMMARY:${icsText(e.status ? `${e.status === 'abgesagt' ? 'Abgesagt' : 'Verschoben'}: ${e.title}` : e.title)}`,
      `LOCATION:${icsText([e.venue, e.location].filter(Boolean).join(', '))}`, `URL:${e.url}`,
      `DESCRIPTION:${icsText(`Quelle: ${(e.sources ?? []).map((s) => s.name).join(', ')}. ${r.hinweis}`)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
