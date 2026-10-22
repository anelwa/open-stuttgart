// Venue-first-Quellen für „Was geht“: Termine werden dort gelesen, wo sie stattfinden
// (Hausseiten, offene Register, freigegebene Aggregatoren) und nicht von Plattformen,
// deren AGB einen automatischen Abruf untersagen.
//
// Enthalten:
// - EINTOPF/LAUTI: offener Stuttgarter Community-Kalender (Tageslisten, viele politische/kulturelle Termine)
// - KUlturBUnker: Hausseite mit vollständiger Terminliste (HTML)
// - Fridas Pier: Hausseite mit Terminliste (HTML)
// - Climax Institutes: Hausseite mit Terminliste (HTML)
// - Kowalski: WordPress-REST der Hausseite
// - evensos: offener JSON-LD-Feed für Stuttgart (Daten dürfen mit Quellenangabe und Link genutzt werden)
// - Rausgegangen: ausschließlich Partner-Export (OS_RAUSGEGANGEN_FILE oder OS_RAUSGEGANGEN_URL).
//   Die Plattform untersagt automatisierte Abrufe in ihren AGB; deshalb gibt es hier bewusst
//   keinen Standard-Endpunkt und keinen Scraper.
//
// Alle Quellen liefern nur Fakten (Titel, Zeit, Ort, Preis, Status) und den Link zur Quelle.
import { readFileSync } from 'node:fs';
import { fetchJson, fetchText } from '../../cache.mjs';
import { berlinLocal } from '../events-extra.mjs';
import {
  addDays, berlinDate, euro, minAgeOf, sceneDay, text, today, venueOf,
} from './common.mjs';

const H = 3600_000;
export const HORIZON_DAYS = 21; // so weit im Voraus werden Termine gelesen
const horizon = () => addDays(today(), HORIZON_DAYS);
const inWindow = (day) => day >= addDays(today(), -1) && day <= horizon();

// ---------- gemeinsame Helfer ----------
const RE_PARTY = /(?:party|fete|rave|clubnacht|kollektivnacht|afterwork|daydrinking|dj|djs|techno|house|electro|elektro|trance|dnb|drum ?(?:&|and|n) ?bass|hip ?hop|open ?decks)\b/i;
const RE_COMEDY = /(?:comedy|kabarett|stand-?up|poetry ?slam|impro(?:theater|visation)?|satire)\b/i;
const RE_BUEHNE = /(?:theater|tanz(?:theater)?|lesung|oper|musical|performance|vortrag|diskussion|führung|ausstellung)\b/i;
const RE_FLOH = /flohmarkt|trödel|kunstmarkt|kleidertausch/i;
const RE_KONZERT = /(?:konzert|live|band|gig|session|jazz|klassik|chor|orchester)\b/i;

function sceneOf(...parts) {
  const t = parts.filter(Boolean).join(' ');
  if (RE_COMEDY.test(t)) return ['comedy'];
  if (RE_FLOH.test(t)) return ['flohmarkt'];
  if (RE_PARTY.test(t)) return ['party'];
  if (RE_BUEHNE.test(t)) return ['buehne'];
  if (RE_KONZERT.test(t)) return ['konzert'];
  return ['sonstiges'];
}

/** schema.org-Eventtyp vor Schlagworten auswerten (evensos). */
function sceneOfType(type, ...parts) {
  const t = String(type ?? '').toLowerCase();
  if (t.includes('comedy')) return ['comedy'];
  if (t.includes('music') || t.includes('festival')) return ['konzert'];
  if (t.includes('theater') || t.includes('dance') || t.includes('screening') || t.includes('exhibition')) return ['buehne'];
  return sceneOf(...parts);
}

function statusOf(...parts) {
  const t = parts.filter(Boolean).join(' ');
  if (/\b(abgesagt|entfällt|entfaellt|cancelled|canceled)\b/i.test(t)) return 'abgesagt';
  if (/\b(verschoben|verlegt|postponed|rescheduled)\b/i.test(t)) return 'verschoben';
  return null;
}

const MONATE = { januar: 1, februar: 2, 'märz': 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };

/** Datum aus „Mi. 21. Oktober 2026“, „21.10.2026“ oder „21.10.“ (Jahr wird ergänzt). */
function germanDay(s, fallbackYear = Number(today().slice(0, 4))) {
  const t = text(s);
  let m = /(\d{1,2})\.\s*(\p{L}+)\s*(\d{4})/u.exec(t);
  if (m && MONATE[m[2].toLowerCase()]) {
    return `${m[3]}-${String(MONATE[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\.(\d{1,2})\./.exec(t);
  if (!m) return null;
  let year = fallbackYear;
  const candidate = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // Jahreswechsel: ein Datum mehr als 30 Tage in der Vergangenheit gehört ins nächste Jahr.
  if (candidate < addDays(today(), -30)) year += 1;
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Uhrzeit aus „19.00“, „19:00“, „Ab 23 Uhr“, „23h“, „19.00 - 23.59“. */
function timeFrom(s) {
  const m = /(\d{1,2})(?:[.:](\d{2}))?\s*(?:uhr|h\b)/i.exec(text(s)) ?? /(\d{1,2})[.:](\d{2})/.exec(text(s));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

function endTimeFrom(s) {
  const m = /(\d{1,2})(?:[.:](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[.:](\d{2}))?/.exec(text(s));
  if (!m) return null;
  const h = Number(m[3]);
  const min = Number(m[4] ?? 0);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

const localIso = (day, hm) => (day && hm ? berlinLocal(`${day}T${hm}:00`).toISOString() : null);

// EINTOPF nennt bei vielen Terminen nur den Ortsnamen („UTOPIA Kiosk“, „Weissenburg“).
// Deshalb wird nur ausgeschlossen, was erkennbar außerhalb Stuttgarts liegt.
const OUT_OF_TOWN = /\b(?:Fellbach|Ludwigsburg|Esslingen|Kornwestheim|Leonberg|Böblingen|Sindelfingen|Waiblingen|Remseck|Korntal|Bietigheim|Backnang|Schorndorf|Göppingen|Tübingen|Reutlingen|Heilbronn|Pforzheim|Karlsruhe|Ulm|Aalen|Schwäbisch Gmünd|Nürtingen|Kirchheim|Denkendorf|Ostfildern|Leinfelden|Echterdingen|Filderstadt|Herrenberg|Calw|Nagold|Freudenstadt|Rottweil|Villingen|Offenburg|Baden-Baden)\b/i;

// ---------- EINTOPF / LAUTI (offener Community-Kalender, Tageslisten) ----------
// robots.txt von eintopf.info sperrt /ical und /rss; gelesen werden deshalb die öffentlichen
// Tageslisten /?date=YYYY-MM-DD mit schema.org-Mikrodaten je Termin.
const EINTOPF = {
  id: 'eintopf', name: 'EINTOPF Stuttgart (LAUTI)', group: 'register', url: 'https://eintopf.info/',
  license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort und Link. Quelle ist der offene Community-Kalender EINTOPF/LAUTI.',
};
async function eintopf(makeTermin) {
  const out = [];
  const seen = new Set();
  for (let i = -1; i <= HORIZON_DAYS; i += 1) {
    const day = addDays(today(), i);
    let html;
    try {
      html = await fetchText(`https://eintopf.info/?date=${day}`, { timeout: 30_000 });
    } catch {
      continue; // ein einzelner Tag darf nicht den ganzen Bestand verwerfen
    }
    for (const chunk of html.split('<div class="event h-event"').slice(1)) {
      const startRaw = text(/itemprop="startDate" content="([^"]+)"/.exec(chunk)?.[1]);
      const start = startRaw ? new Date(startRaw) : null;
      const href = /href="(\/event\/[^"]+)"/.exec(chunk)?.[1];
      const title = text(/<h3 class="title">([\s\S]*?)<\/h3>/.exec(chunk)?.[1]);
      if (!start || Number.isNaN(+start) || !href || !title || seen.has(href)) continue;
      const allDay = /T00:00:00/.test(startRaw);
      const eventDay = allDay ? berlinDate(start) : sceneDay({ start: start.toISOString(), date: berlinDate(start) });
      if (!eventDay || !inWindow(eventDay)) continue;
      const locBlock = /<div class="info info-location">([\s\S]*?)<\/div>/.exec(chunk)?.[1] ?? '';
      const locName = text(/itemprop="name">([\s\S]*?)<\/span>/.exec(locBlock)?.[1]);
      const locAddr = text(/itemprop="address">([\s\S]*?)<\/span>/.exec(locBlock)?.[1]);
      const loc = [locName, locAddr].filter(Boolean).join(', ');
      // EINTOPF deckt auch die Region ab; „Was geht“ zeigt Stuttgart und keine reinen Online-Termine.
      if (/\b(?:online|zoom|virtuell|livestream)\b/i.test(loc)) continue;
      const plz = /\b(\d{5})\b/.exec(loc)?.[1];
      if (plz && !/^70[0-6]/.test(plz)) continue;
      if (!plz && OUT_OF_TOWN.test(loc)) continue;
      const cats = [...chunk.matchAll(/itemprop="keywords"[^>]*>([\s\S]*?)<\/a>/g)].map((x) => text(x[1])).filter(Boolean);
      const vid = venueOf(loc);
      seen.add(href);
      out.push(makeTermin(EINTOPF, {
        key: href.split('/').filter(Boolean).pop(), title, url: `https://eintopf.info${href}`,
        start: allDay ? null : start.toISOString(), date: allDay ? eventDay : undefined,
        ...(vid ? { venueId: vid } : { venue: locName || 'Stuttgart', location: loc || 'Stuttgart' }),
        scene: sceneOf(title, cats.join(' ')), category: cats[0] || 'EINTOPF',
        status: statusOf(title, chunk), minAge: minAgeOf(title),
      }));
    }
  }
  return out;
}

// ---------- KUlturBUnker (WPBakery/VSEL-Eventliste, HTML) ----------
const KUBU = {
  id: 'kubu', name: 'KUlturBUnker unter dem Diakonissenplatz', group: 'haus', url: 'https://ku-bu.de/veranstaltungen/',
  license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort, Preis und Link zur Hausseite.',
};
async function kubu(makeTermin) {
  const html = await fetchText(KUBU.url, { timeout: 30_000 });
  const out = [];
  for (const m of html.matchAll(/<div id="event-(\d+)"([\s\S]*?)(?=<div id="event-\d+"|<\/body>)/g)) {
    const id = m[1];
    const chunk = m[2];
    const dateRaw = /<div class="vsel-meta-date[^"]*"><span>([^<]+)<\/span>/.exec(chunk)?.[1];
    const timeRaw = /<div class="vsel-meta-time"><span>([^<]+)<\/span>/.exec(chunk)?.[1];
    const cat = text(/<div class="vsel-meta-cats"><span>([^<]+)<\/span>/.exec(chunk)?.[1]);
    const title = text(/<h4[^>]*>([\s\S]*?)<\/h4>/.exec(chunk)?.[1]) || text(/<strong>([^<]{4,160})<\/strong>/.exec(chunk)?.[1]);
    const day = germanDay(dateRaw);
    if (!day || !title || !inWindow(day)) continue;
    const startHM = timeFrom(timeRaw);
    const endHM = endTimeFrom(timeRaw);
    const endDay = startHM && endHM && endHM < startHM ? addDays(day, 1) : day; // 22:00–00:15
    const body = text(chunk);
    const priceRaw = /Eintritt:\s*([^\n<]{0,80})/i.exec(body)?.[1] ?? '';
    const free = /eintritt:\s*(?:frei|kostenlos)/i.test(body);
    const status = statusOf(title, body);
    const scene = sceneOf(cat, title);
    out.push(makeTermin(KUBU, {
      key: id, title, url: `https://ku-bu.de/veranstaltungen/#event-${id}`,
      start: localIso(day, startHM), end: localIso(endDay, endHM), date: startHM ? undefined : day,
      venueId: 'kubu', scene: scene[0] === 'sonstiges' ? ['konzert'] : scene, category: cat ? `Kultur Bunker ${cat}` : 'Kultur Bunker',
      priceMin: free ? 0 : euro(priceRaw), free: free ? true : null,
      soldOut: /ausverkauft/i.test(body), status, minAge: minAgeOf(title, body),
    }));
  }
  return out;
}

// ---------- Fridas Pier (Hausseite, HTML-Liste /event/) ----------
const FRIDA = {
  id: 'fridaspier', name: 'Fridas Pier', group: 'haus', url: 'https://www.fridaspier.de/event/',
  license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Ort und Link zur Hausseite.',
};
async function fridasPier(makeTermin) {
  const html = await fetchText(FRIDA.url, { timeout: 30_000 });
  const out = [];
  for (const m of html.matchAll(/<article id="[^"]*" class="article--event">([\s\S]*?)<\/article>/g)) {
    const b = m[1];
    const href = /<a href="([^"]+)">/.exec(b)?.[1];
    const dateRaw = /article--event-date_date[^>]*>\s*([\s\S]*?)\s*<\/div>/.exec(b)?.[1];
    const day = germanDay(dateRaw);
    const title = text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(b)?.[1]);
    if (!href || !day || !title || !inWindow(day)) continue;
    const cat = text(/article--event-category[^>]*>([\s\S]*?)<\/div>/.exec(b)?.[1]);
    const lineup = text(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(b)?.[1]);
    const hm = timeFrom(cat);
    const status = statusOf(title, lineup, cat);
    const scene = sceneOf(title, cat);
    out.push(makeTermin(FRIDA, {
      key: href.split('/').filter(Boolean).pop(), title, teaser: lineup, url: href,
      start: localIso(day, hm), date: hm ? undefined : day, venueId: 'fridaspier',
      scene: scene[0] === 'sonstiges' ? ['party'] : scene, category: 'Fridas Pier', performer: lineup || null,
      status, soldOut: /ausverkauft/i.test(`${title} ${cat}`), minAge: minAgeOf(title, cat),
    }));
  }
  return out;
}

// ---------- Climax Institutes (Hausseite, HTML-Liste /events/) ----------
const CLIMAX = {
  id: 'climax', name: 'Climax Institutes', group: 'haus', url: 'https://climax-institutes.de/events/',
  license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Genre und Link zur Hausseite.',
};
async function climax(makeTermin) {
  const html = await fetchText(CLIMAX.url, { timeout: 30_000 });
  const out = [];
  for (const m of html.matchAll(/<article><a class="boxeventitem" href="([^"]+)">([\s\S]*?)<\/article>/g)) {
    const [, href, b] = m;
    const d = /(\d{2})\/(\d{2})<br \/>(\d{4})/.exec(b);
    const titleRaw = text(/boxeventtitle dont-break-out">([\s\S]*?)<br \/>/.exec(b)?.[1]);
    if (!d || !titleRaw) continue;
    const day = `${d[3]}-${d[2]}-${d[1]}`;
    if (!inWindow(day)) continue;
    const parts = titleRaw.split(/\s*\/\/\s*/);
    const title = parts[0]?.trim();
    const hm = timeFrom(parts[1] ?? '') ?? timeFrom(b);
    const genre = parts.slice(2).join(', ') || null;
    const desc = text(/boxeventdescription[^>]*>([\s\S]*?)<\/div>/.exec(b)?.[1]);
    if (!title) continue;
    const scene = sceneOf(genre, title);
    out.push(makeTermin(CLIMAX, {
      key: href.split('/').filter(Boolean).pop(), title, url: href,
      start: localIso(day, hm), date: hm ? undefined : day, venueId: 'climax',
      scene: scene[0] === 'sonstiges' ? ['party'] : scene, genre, category: 'Climax Institutes',
      status: statusOf(title, desc), soldOut: /ausverkauft/i.test(`${title} ${desc}`), minAge: minAgeOf(title, desc),
    }));
  }
  return out;
}

// ---------- Kowalski (WordPress-REST der Hausseite) ----------
const KOWALSKI = {
  id: 'kowalski', name: 'Kowalski', group: 'haus', url: 'https://kowalskistuttgart.de/',
  license: 'Keine Datenlizenz angegeben; übernommen werden Termin, Preis und Link zur Hausseite.',
};
async function kowalski(makeTermin) {
  const posts = await fetchJson('https://kowalskistuttgart.de/wp-json/wp/v2/posts?per_page=100&categories=8&_fields=id,date,link,title,content', { timeout: 30_000 });
  const out = [];
  for (const p of Array.isArray(posts) ? posts : []) {
    const rawTitle = text(p.title?.rendered);
    const m = /^(?:Mo|Di|Mi|Do|Fr|Sa|So)\s+(\d{2})\/(\d{2})\s*[*•]\s*(?:ab\s*)?(\d{1,2})\s*h\s*(?:[-–—]\s*)?(.*)$/i.exec(rawTitle);
    if (!m) continue; // Monatsübersichten und andere Beiträge überspringen
    const postYear = Number(String(p.date ?? '').slice(0, 4)) || Number(today().slice(0, 4));
    const postMonth = Number(String(p.date ?? '').slice(5, 7)) || 1;
    let year = postYear;
    if (Number(m[2]) < postMonth - 6) year += 1;
    const day = `${year}-${m[2]}-${m[1]}`;
    if (!inWindow(day)) continue;
    const body = text(p.content?.rendered);
    const title = m[4].replace(/^[-–—\s]+/, '').trim();
    if (!title) continue;
    const hm = `${String(Number(m[3])).padStart(2, '0')}:00`;
    const price = /(?:early bird|regular|ticket)[^\d]{0,20}(\d+(?:[.,]\d{1,2})?)\s*€/i.exec(body);
    out.push(makeTermin(KOWALSKI, {
      key: p.id, title, url: p.link, start: localIso(day, hm), venueId: 'kowalski',
      scene: ['party'], category: 'Kowalski', priceMin: price ? euro(price[1]) : null,
      status: statusOf(title, body), soldOut: /ausverkauft/i.test(`${title} ${body}`), minAge: 18,
    }));
  }
  return out;
}

// ---------- evensos (offener JSON-LD-Feed, ausdrücklich zur Weiterverwendung freigegeben) ----------
const EVENSOS = {
  id: 'evensos', name: 'evensos', group: 'aggregator', url: 'https://www.evensos.de/events/stuttgart',
  license: 'evensos; Daten dürfen für Recherche, Weiterverarbeitung und Antwortsysteme mit Quellenangabe und Link auf die Detailseite genutzt werden.',
};
async function evensos(makeTermin) {
  const d = await fetchJson('https://www.evensos.de/events/stuttgart.json', { timeout: 30_000 });
  const out = [];
  for (const el of Array.isArray(d.dataFeedElement) ? d.dataFeedElement : []) {
    const b = el.item ?? el;
    if (!b?.startDate || !b?.name) continue;
    const start = new Date(b.startDate);
    if (Number.isNaN(+start)) continue;
    const day = sceneDay({ start: start.toISOString(), date: berlinDate(start) });
    if (!inWindow(day)) continue;
    const loc = b.location ?? {};
    const a = loc.address ?? {};
    const vid = venueOf(loc.name) ?? venueOf(a.streetAddress);
    const offers = [].concat(b.offers ?? [])[0] ?? {};
    const price = offers.price ?? offers.lowPrice ?? null;
    const type = String(b['@type'] ?? '');
    out.push(makeTermin(EVENSOS, {
      key: String(b.url ?? b['@id'] ?? `${b.name}-${b.startDate}`).split('/').filter(Boolean).pop(), title: text(b.name), url: b.url ?? EVENSOS.url,
      start: start.toISOString(), end: b.endDate ? new Date(b.endDate).toISOString() : null,
      ...(vid ? { venueId: vid } : {
        venue: text(loc.name) || null,
        location: [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Stuttgart',
        ...(loc.geo?.latitude != null ? { lat: Number(loc.geo.latitude), lon: Number(loc.geo.longitude) } : {}),
      }),
      scene: sceneOfType(type, text(b.name)), category: `evensos ${type}`,
      priceMin: b.isAccessibleForFree === true ? 0 : price != null && Number(price) > 0 ? Number(price) : null,
      free: b.isAccessibleForFree === true ? true : null, ticketUrl: offers.url ?? b.url ?? null,
      status: /Cancelled/i.test(b.eventStatus ?? '') ? 'abgesagt' : /Postponed|Rescheduled/i.test(b.eventStatus ?? '') ? 'verschoben' : null,
      minAge: minAgeOf(text(b.name)),
    }));
  }
  return out;
}

// ---------- Rausgegangen: ausschließlich mit Partner-Export ----------
// Die AGB von Rausgegangen untersagen automatisierte Abrufe ausdrücklich. Dieser Adapter
// verarbeitet deshalb nur eine Datei oder URL, die Rausgegangen ausdrücklich bereitstellt.
const RG_LICENSE = 'Nutzung nur mit schriftlicher Freigabe von Rausgegangen; keine automatischen Abrufe der Plattform. Übernommen werden Termin, Ort, Preis, Status und Link.';
function rausgegangenPartner(makeTermin) {
  const file = (process.env.OS_RAUSGEGANGEN_FILE ?? '').trim();
  const url = (process.env.OS_RAUSGEGANGEN_URL ?? '').trim();
  if (!file && !url) return null;
  const q = { id: 'rausgegangen', name: 'Rausgegangen (Partner-Export)', group: 'aggregator', url: 'https://rausgegangen.de/', license: RG_LICENSE };
  return {
    ...q, ttl: 6 * H,
    load: async () => {
      const raw = file ? JSON.parse(readFileSync(file, 'utf8')) : await fetchJson(url, { timeout: 30_000 });
      const list = Array.isArray(raw) ? raw : Array.isArray(raw.subevents) ? raw.subevents : Array.isArray(raw.events) ? raw.events : [];
      const out = [];
      for (const r of list) {
        if (!r?.start_datetime && !r?.start_date && !r?.startDate) continue;
        const start = r.start_datetime ? new Date(Number(r.start_datetime) * 1000) : new Date(r.start_date ?? r.startDate);
        if (Number.isNaN(+start)) continue;
        const day = sceneDay({ start: start.toISOString(), date: berlinDate(start) });
        if (!inWindow(day)) continue;
        const endRaw = r.end_datetime ? new Date(Number(r.end_datetime) * 1000) : r.end_date ?? r.endDate;
        const end = endRaw && !Number.isNaN(+new Date(endRaw)) ? new Date(endRaw) : null;
        const loc = r.place ?? r.location ?? {};
        const locName = text(r.location_title ?? loc.name ?? loc.title);
        const vid = venueOf(locName) ?? venueOf(loc.address);
        const status = r.state === 'canceled' || r.state === 'cancelled' ? 'abgesagt'
          : r.state === 'postponed' ? 'verschoben'
            : statusOf(r.title, r.state);
        const title = text(r.title ?? r.name);
        if (!title) continue;
        out.push(makeTermin(q, {
          key: r.id ?? r.slug ?? `${day}-${title}`, title,
          url: r.slug ? `https://rausgegangen.de/events/${r.slug}/` : (r.url ?? q.url),
          start: start.toISOString(), end: end?.toISOString() ?? null,
          ...(vid ? { venueId: vid } : {
            venue: locName || null, location: text(loc.address ?? loc.address_street) || 'Stuttgart',
            ...(r.lat != null && r.lng != null ? { lat: Number(r.lat), lon: Number(r.lng) } : {}),
          }),
          scene: sceneOf(title, locName), category: 'Rausgegangen',
          priceMin: euro(r.price_human ?? r.price ?? null), ticketUrl: r.ticket_url ?? null,
          soldOut: r.state === 'sold_out' || undefined, status, minAge: minAgeOf(title),
        }));
      }
      return out;
    },
  };
}

/** Quellenliste für das Modul „Was geht“; `makeTermin` ist der Formatierer aus termine.mjs. */
export function venueSources(makeTermin) {
  const list = [
    { ...EINTOPF, ttl: 12 * H, load: () => eintopf(makeTermin) },
    { ...KUBU, ttl: 6 * H, load: () => kubu(makeTermin) },
    { ...FRIDA, ttl: 6 * H, load: () => fridasPier(makeTermin) },
    { ...CLIMAX, ttl: 6 * H, load: () => climax(makeTermin) },
    { ...KOWALSKI, ttl: 6 * H, load: () => kowalski(makeTermin) },
    { ...EVENSOS, ttl: 6 * H, load: () => evensos(makeTermin) },
  ];
  const partner = rausgegangenPartner(makeTermin);
  return partner ? [partner, ...list] : list;
}
