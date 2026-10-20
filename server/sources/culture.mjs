// Kultur: Veranstaltungskalender der Stadt Stuttgart (RSS + iCal je Termin), Sehenswürdigkeiten aus Wikidata,
// Kurzbeschreibungen aus der Wikipedia. Adressen der Termine werden über Nominatim (OSM) verortet.
// Alle Zusatzabrufe laufen nacheinander mit Pause (stuttgart.de 1/s, Nominatim 1/s) und landen im Plattenspeicher.
import { cached, diskStore, fetchJson, fetchText } from '../cache.mjs';
import { extraCounts, marketingStatus, mergeExtra } from './events-extra.mjs';

const RSS = 'https://www.stuttgart.de/service/veranstaltungen?sp%3Aout=rss&sp%3Acmp=eventSearch-1-0-searchResult&action=submit';
const icalStore = diskStore('events-ical-v2');
const BEZIRKE = new Set(['Mitte', 'Nord', 'Ost', 'Süd', 'West', 'Bad Cannstatt', 'Birkach', 'Botnang', 'Degerloch', 'Feuerbach', 'Hedelfingen',
  'Möhringen', 'Mühlhausen', 'Münster', 'Obertürkheim', 'Plieningen', 'Sillenbuch', 'Stammheim', 'Untertürkheim', 'Vaihingen', 'Wangen', 'Weilimdorf', 'Zuffenhausen']);
const geoStore = diskStore('geocode');

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .trim();
const tag = (xml, name) => { const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml); return m ? decode(m[1]) : ''; };
const berlinDate = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);

async function feed() {
  const { value } = await cached('events-rss', 30 * 60_000, async () => {
    const xml = await fetchText(RSS, { timeout: 30000 });
    const items = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const it = m[1];
      const link = tag(it, 'link');
      const base = link.split('?')[0];
      const id = /-(\d+)$/.exec(base)?.[1] ?? base;
      items.push({
        id,
        title: tag(it, 'title'),
        teaser: tag(it, 'description').replace(/\s*\.\.\.$/, ' …'),
        url: base,
        date: berlinDate(new Date(tag(it, 'pubDate'))),
      });
    }
    return items;
  });
  return value;
}

function parseIcs(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  return [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map((m) => {
    const ev = {};
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0];
      ev[key] = line.slice(i + 1).replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\;/g, ';');
    }
    return ev;
  });
}

const icsDate = (s) => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(s ?? '');
  if (!m) return null;
  if (!m[4]) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? 'Z' : ''}`);
};

async function nominatim(q) {
  const hit = geoStore.get(q, 90 * 86400_000);
  if (hit !== undefined) return hit;
  try {
    const d = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&addressdetails=0&viewbox=9.03,48.87,9.32,48.68&q=${encodeURIComponent(q)}`);
    const r = d[0] ? { lat: +(+d[0].lat).toFixed(6), lon: +(+d[0].lon).toFixed(6), name: d[0].name || null } : null;
    geoStore.set(q, r);
    return r;
  } catch {
    return undefined; // nicht speichern, später erneut versuchen
  }
}

/** Verortet eine Freitext-Adresse; bei unsauberen Angaben schrittweise vereinfacht, zuletzt nur die Postleitzahl. */
async function geocode(address) {
  if (!address) return null;
  const clean = address.split(/\s\/\s|\s+–\s+/)[0].trim();
  const plz = /\b(70\d{3})\b/.exec(address)?.[1];
  const street = /([A-ZÄÖÜ][\wäöüß.\- ]*?(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|steige|staffel|ufer|tor|markt|hof)\s*\d+\s?\w?)/i.exec(clean)?.[1];
  const candidates = [clean, street && `${street}, ${plz ?? ''} Stuttgart`, plz && `${plz} Stuttgart`].filter(Boolean);
  for (const [i, q] of [...new Set(candidates)].entries()) {
    const r = await nominatim(q);
    if (r) return { ...r, approx: i === candidates.length - 1 && q === `${plz} Stuttgart`, name: q.startsWith(plz ?? '#') ? null : r.name };
  }
  return null;
}

/** Holt iCal und Koordinaten für einen Termin; Ergebnis bleibt 12 Stunden im Plattenspeicher. */
async function enrich(item) {
  let details = icalStore.get(item.id, 12 * 3600_000);
  if (details === undefined) {
    try {
      const ics = await fetchText(`${item.url}?sp%3Aout=iCal`);
      const evs = parseIcs(ics);
      const ev = evs.find((e) => icsDate(e.DTSTART) && berlinDate(icsDate(e.DTSTART)) === item.date) ?? evs[0] ?? {};
      const start = icsDate(ev.DTSTART);
      const end = icsDate(ev.DTEND);
      const localTime = start && new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(start);
      const allDay = !start || (localTime === '00:00' && (!end || end - start >= 23 * 3600_000));
      const cats = (ev.CATEGORIES ?? '').split(',').map((c) => c.trim()).filter(Boolean);
      const district = cats.find((c) => BEZIRKE.has(c)) ?? null;
      // Ende 23:59 Uhr ist im Kalender ein Platzhalter für "offen"
      const endLocal = end && new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(end);
      details = {
        start: start?.toISOString() ?? null,
        end: end && endLocal !== '23:59' ? end.toISOString() : null,
        allDay,
        location: ev.LOCATION ?? '',
        category: cats[0] ?? 'Veranstaltung',
        district,
        tags: cats.slice(1).filter((c) => c !== district && !/^(Ja|Nein)$/.test(c)),
      };
    } catch {
      return null;
    }
    icalStore.set(item.id, details);
  }
  const geo = await geocode(details.location);
  return { ...details, ...(geo ? { lat: geo.lat, lon: geo.lon, venue: geo.name, approx: geo.approx || undefined } : {}) };
}

// Hintergrund-Warteschlange: reichert Termine nacheinander an, die angefragten Tage zuerst
const enriched = new Map();
const queue = [];
let running = false;
async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const item = queue.shift();
    if (enriched.has(item.id)) continue;
    const d = await enrich(item);
    enriched.set(item.id, d);
  }
  running = false;
}

export async function events(day) {
  const items = await feed();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(day ?? '') ? day : berlinDate(new Date());
  const today = items.filter((i) => i.date === date);
  for (const it of today) {
    if (enriched.has(it.id) || queue.some((q) => q.id === it.id)) continue;
    // Bereits gespeicherte Details sofort übernehmen, nur fehlende in die Warteschlange
    queue.unshift(it);
  }
  pump();
  const dayList = [...new Set(items.map((i) => i.date))].sort().slice(0, 14);
  const more = await extraCounts(dayList);
  // Zählung je Tag ohne Abgleich, daher Obergrenze
  const days = dayList.map((d) => ({ date: d, count: items.filter((i) => i.date === d).length + (more[d] ?? 0) }));
  const city = today.map((i) => {
    const d = enriched.get(i.id);
    return { ...i, ...(d ?? {}), ready: enriched.has(i.id) };
  });
  const merged = await mergeExtra(date, city, geocode);
  return {
    date,
    days,
    events: merged.events,
    pending: city.filter((e) => !e.ready).length + merged.pending,
    marketing: marketingStatus(),
    source: 'Landeshauptstadt Stuttgart, Veranstaltungskalender; Stadtbibliothek Stuttgart; Stuttgart-Marketing GmbH; OpenLigaDB; Verortung © OpenStreetMap (Nominatim)',
  };
}

// ---------- Sehenswürdigkeiten (Wikidata) ----------
const TYPES = {
  museum: ['Q33506', 'Q207694', 'Q1007870', 'Q17431399', 'Q2772772'],
  buehne: ['Q24354', 'Q153562', 'Q1060829', 'Q11166728'],
  aussicht: ['Q1440300', 'Q6017969', 'Q2087181'],
  gruen: ['Q22698', 'Q43501', 'Q1107656', 'Q167346'],
  kirche: ['Q16970', 'Q108325', 'Q2977'],
  denkmal: ['Q23413', 'Q16560', 'Q4989906', 'Q483453', 'Q174782', 'Q12280', 'Q839954', 'Q57821', 'Q575759'],
};
const typeOf = Object.fromEntries(Object.entries(TYPES).flatMap(([k, ids]) => ids.map((id) => [id, k])));
const PRIORITY = ['aussicht', 'museum', 'buehne', 'gruen', 'denkmal', 'kirche'];

export async function places() {
  const { value, at, fresh } = await cached('places', 24 * 3600_000, async () => {
    const values = Object.values(TYPES).flat().map((q) => `wd:${q}`).join(' ');
    const q = `SELECT ?item ?itemLabel ?itemDescription ?type ?coord ?image ?article ?sitelinks WHERE {
      ?item wdt:P131+ wd:Q1022; wdt:P625 ?coord; wdt:P31 ?type. VALUES ?type { ${values} }
      FILTER NOT EXISTS { ?item wdt:P576 ?abolished }
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?item wikibase:sitelinks ?sitelinks }
      OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://de.wikipedia.org/> }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". } }`;
    const d = await fetchJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, {
      timeout: 60000, headers: { Accept: 'application/sparql-results+json' },
    });
    const byId = new Map();
    for (const b of d.results.bindings) {
      const id = b.item.value.split('/').pop();
      const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value);
      if (!m) continue;
      const kind = typeOf[b.type.value.split('/').pop()];
      const prev = byId.get(id);
      if (prev) {
        if (PRIORITY.indexOf(kind) < PRIORITY.indexOf(prev.kind)) prev.kind = kind;
        continue;
      }
      const name = b.itemLabel.value;
      if (/^Q\d+$/.test(name)) continue;
      const file = b.image?.value.split('/').pop();
      byId.set(id, {
        id,
        name,
        description: b.itemDescription?.value ?? null,
        kind,
        lon: +(+m[1]).toFixed(6),
        lat: +(+m[2]).toFixed(6),
        image: file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=640` : null,
        imagePage: file ? `https://commons.wikimedia.org/wiki/File:${file}` : null,
        wiki: b.article ? decodeURIComponent(b.article.value.split('/wiki/')[1]) : null,
        rank: Number(b.sitelinks?.value ?? 0),
      });
    }
    return [...byId.values()].sort((a, b) => b.rank - a.rank);
  });
  return { places: value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Wikidata (CC0), Bilder Wikimedia Commons' };
}

export async function wikiSummary(title) {
  const t = String(title ?? '').slice(0, 200);
  if (!t) throw Object.assign(new Error('Titel fehlt'), { status: 400 });
  const { value } = await cached(`wiki:${t}`, 7 * 86400_000, async () => {
    const d = await fetchJson(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`);
    return { title: d.title, extract: d.extract, url: d.content_urls?.desktop?.page ?? null, thumbnail: d.thumbnail?.source ?? null };
  });
  return { ...value, source: 'Wikipedia, CC BY-SA 4.0' };
}
