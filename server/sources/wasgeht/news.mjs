// „Was geht“, Meldungen: nur offene Feeds (Spezifikation was-geht, Abschnitt 3).
// Übernommen werden Titel, Link, Zeit und, wo zulässig, der Anreißer des Feeds (Stadt, Feuerwehr, SWR). Keine Volltexte.
// Polizei und Bundespolizei nur Titel und Stadtbezirk (keine Anreißer, damit keine Namen erscheinen).
// Kessel.TV nur Titel und Link. Stuttgarter Zeitung und Stuttgarter Nachrichten sind ausgeschlossen (Vorbehalt nach § 44b UrhG).
// Presseportal: nur die RSS-Endpunkte, keine HTML-Seiten (dort Bot-Schutz).
import { fetchText } from '../../cache.mjs';
import { districtOf, quelle, text } from './common.mjs';

const MIN = 60_000;
export const FEEDS = [
  { id: 'stadt', name: 'Stadt Stuttgart', url: 'https://www.stuttgart.de/pressemitteilungen/?sp%3Aout=rss', home: 'https://www.stuttgart.de/pressemitteilungen/',
    teaser: true, topic: 'verwaltung', ttl: 15 * MIN, license: 'Pressemitteilungen der Landeshauptstadt Stuttgart, Nutzung mit Erlaubnis der Stadt und Quellenangabe' },
  { id: 'feuerwehr', name: 'Feuerwehr Stuttgart', url: 'https://feuerwehr.stuttgart.de/oeffentlichkeitsarbeit/aktuelle-meldungen/?sp%3Aout=rss', home: 'https://feuerwehr.stuttgart.de/oeffentlichkeitsarbeit/aktuelle-meldungen/',
    teaser: true, topic: 'blaulicht', ttl: 15 * MIN, license: 'Meldungen der Branddirektion Stuttgart (Landeshauptstadt Stuttgart), Nutzung mit Erlaubnis der Stadt und Quellenangabe' },
  { id: 'swr', name: 'SWR', url: 'https://www.swr.de/~rss/swraktuell/baden-wuerttemberg/stuttgart/index.xml', home: 'https://www.swr.de/swraktuell/baden-wuerttemberg/stuttgart/',
    teaser: true, stuttgart: true, ttl: 15 * MIN, license: '© Südwestrundfunk. Anzeige von Titel und Anreißer mit Quellenangabe und Link; kein Training (Vorbehalt in robots.txt)' },
  { id: 'polizei', name: 'Polizei Stuttgart', url: 'https://www.presseportal.de/rss/dienststelle_110977.rss2', home: 'https://www.presseportal.de/blaulicht/nr/110977',
    teaser: false, topic: 'blaulicht', ttl: 15 * MIN, license: 'Pressemitteilungen des Polizeipräsidiums Stuttgart (amtliche Werke, § 5 UrhG), übermittelt durch news aktuell (Presseportal-RSS)' },
  { id: 'bundespolizei', name: 'Bundespolizei', url: 'https://www.presseportal.de/rss/dienststelle_116091.rss2', home: 'https://www.presseportal.de/blaulicht/nr/116091',
    teaser: false, topic: 'blaulicht', stuttgart: true, ttl: 15 * MIN, license: 'Pressemitteilungen der Bundespolizeiinspektion Stuttgart (amtliche Werke, § 5 UrhG), übermittelt durch news aktuell (Presseportal-RSS)' },
  { id: 'kessel', name: 'Kessel.TV', url: 'https://kessel.tv/feed/', home: 'https://kessel.tv/',
    teaser: false, ttl: 15 * MIN, license: 'Keine Lizenz; nur Titel und Link (Anreißer nur mit Erlaubnis der Redaktion)' },
];

const tag = (xml, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml); return m ? text(m[1]) : ''; };
const short = (s, n = 280) => (s.length > n ? `${s.slice(0, n).replace(/\s\S*$/, '')} …` : s);

/** RSS 2.0 in einfache Einträge. */
export function parseRss(xml) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map((m) => {
    const it = m[0];
    return {
      title: tag(it, 'title'), link: tag(it, 'link'), description: tag(it, 'description'), guid: tag(it, 'guid'),
      pubDate: tag(it, 'pubDate'), categories: [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/g)].map((c) => text(c[1])),
    };
  });
}

const TOPICS = [
  ['blaulicht', /\b(polizei|feuerwehr|unfall|brand|festgenommen|tatverdächtig|einbruch|zeugen gesucht|rettungsdienst|vermisst)/i],
  ['verkehr', /\b(verkehr|sperrung|gesperrt|baustelle|umleitung|stadtbahn|s-bahn|ssb|vvs|stau|fahrbahn|radweg|park(?:en|platz|plätze|haus)|tunnel|haltestelle|e-scooter)/i],
  ['kultur', /\b(kultur|ausstellung|konzert|theater|museum|festival|kino|lesung|oper|ballett|weihnachtsmarkt|wasen|volksfest)/i],
  ['verwaltung', /\b(gemeinderat|bürgermeister|oberbürgermeister|stadtverwaltung|amt\b|bürgerbüro|haushalt|satzung|ausschuss)/i],
];

function item(f, r) {
  const published = r.pubDate ? new Date(r.pubDate) : null;
  if (!published || Number.isNaN(+published) || !r.title || !r.link) return null;
  const title = r.title.replace(/^(POL-S|BPOLI S|BPOL-S|BPOLI-S)\s*:\s*/, '');
  const all = `${title} ${r.description}`;
  // Polizei und Feuerwehr immer Blaulicht; sonst Schlagwörter, bei der Stadt ersatzweise Verwaltung
  const topic = f.topic === 'blaulicht' ? 'blaulicht' : TOPICS.find(([, re]) => re.test(all))?.[0] ?? f.topic ?? 'sonstiges';
  // Bezirk nur aus Ortsangabe am Anfang der Meldung („Stuttgart-Degerloch (ots)“) bzw. aus Titel und Anreißer
  const district = districtOf(f.id === 'polizei' || f.id === 'bundespolizei' ? /^([^(]{0,60})\(ots\)/.exec(r.description)?.[1] ?? title : all);
  return {
    id: `${f.id}:${(r.guid || r.link).replace(/^https?:\/\//, '').slice(-80)}`,
    title, teaser: f.teaser && r.description ? short(r.description) : null,
    url: r.link, published: published.toISOString(), source: f.name, sourceId: f.id, district, topic,
  };
}

async function load(f, days = 14) {
  const xml = await fetchText(f.url, { timeout: 30000, headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
  const seen = new Set();
  const since = Date.now() - Math.max(1, Math.min(90, days)) * 86400_000;
  return parseRss(xml)
    .filter((r) => !f.stuttgart || /stuttgart/i.test(`${r.title} ${r.description} ${r.categories.join(' ')}`))
    .map((r) => item(f, r)).filter(Boolean)
    .filter((x) => Date.parse(x.published) >= since)
    // SWR liefert die Studioseite mit Dubletten
    .filter((x) => { const k = x.url.split('?')[0]; if (seen.has(k) || seen.has(x.title)) return false; seen.add(k); seen.add(x.title); return true; })
    .slice(0, 60);
}

/** Meldungen aus Stuttgart, neueste zuerst; Filter nach Thema und Stadtbezirk. */
export async function news({ topic, district, limit = 60, days = 14 } = {}) {
  const res = [];
  for (const f of FEEDS) res.push({ f, r: await quelle(`news-${f.id}-${days}`, f.ttl, () => load(f, days)) });
  const all = res.flatMap(({ r }) => r.items).sort((a, b) => b.published.localeCompare(a.published));
  const items = all.filter((x) => (!topic || x.topic === topic) && (!district || x.district === district)).slice(0, Math.min(200, Number(limit) || 60));
  return {
    items,
    updated: new Date(Math.max(0, ...res.map(({ r }) => r.at ?? 0)) || Date.now()).toISOString(),
    sources: res.map(({ f, r }) => ({ id: f.id, name: f.name, url: f.home, license: f.license, count: r.items.length, ok: r.ok, updated: r.at ? new Date(r.at).toISOString() : null, error: r.error ?? null })),
    hinweis: 'Nur Titel, Zeit und Link, bei Stadt, Feuerwehr und SWR mit Anreißer des Feeds. Den vollständigen Text bitte bei der Quelle lesen.',
  };
}

/** Kessel.TV-Suchfeed „Neueröffnung“ (nur Titel und Link), für die Gegenprüfung bei den Neueröffnungen. */
export async function kesselNeueroeffnungen() {
  const f = { id: 'kessel-neu', name: 'Kessel.TV', url: 'https://kessel.tv/?s=neuer%C3%B6ffnung&feed=rss2', teaser: false, ttl: 6 * 3600_000 };
  const r = await quelle('news-kessel-neu', f.ttl, async () => {
    const xml = await fetchText(f.url, { timeout: 30000 });
    return parseRss(xml).map((x) => ({ title: x.title, url: x.link, published: x.pubDate ? new Date(x.pubDate).toISOString() : null })).filter((x) => x.published);
  });
  return r.items;
}
