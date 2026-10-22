// Stadtgedächtnis: Was hat sich in Stuttgart geändert – und welche Quelle sagt das?
// Kein Scraping von Personen, keine Volltexte. Nur öffentliche Fakten mit Quelle, Datum und Lizenz:
//   • Meldungen der Stadt, Feuerwehr, Polizei, des SWR und von Kessel.TV (RSS, nur Titel/Anreißer)
//   • Amtliche Bekanntmachungen der Landeshauptstadt (HTML-Seite, Titel, Zeitraum, PDF-Link)
//   • Neu erfasste Orte in OpenStreetMap (ODbL, Änderungssätze)
//   • Änderungen an den Verwaltungsseiten (Hash-Vergleich des städtischen Datensatzes)
// Das Archiv wächst mit jedem Lauf. Der erste Lauf setzt nur den Vergleichsstand.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cached, fetchText } from '../cache.mjs';
import { news } from './wasgeht/news.mjs';
import { neueroeffnungen } from './wasgeht/neueroeffnungen.mjs';

const MIN = 60_000;
const VERW = process.env.OS_VERWALTUNG ?? fileURLToPath(new URL('../data/verwaltung.json', import.meta.url));
const SNAP = fileURLToPath(new URL('../.cache/stadtgedaechtnis-verwaltung.json', import.meta.url));
const BEKANNTMACHUNGEN = 'https://www.stuttgart.de/rathaus/amtliche-bekanntmachungen/';
const BEKANNTMACHUNGEN_RSS = `${BEKANNTMACHUNGEN}?sp%3Aout=rss`;

const clean = (s) => String(s ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const deDate = (s) => {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s ?? ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// ---------- Amtliche Bekanntmachungen (HTML, statisch gerendert) ----------
async function bekanntmachungen() {
  const { value } = await cached('stadtgedaechtnis-bekanntmachungen', 30 * MIN, async () => {
    const html = await fetchText(BEKANNTMACHUNGEN, { timeout: 30000 });
    const blocks = html.split('<li class="SP-PublicNotices__item">').slice(1);
    const items = [];
    for (const block of blocks) {
      const part = block.split('</li>')[0];
      const range = /SP-Kicker__date">([^<]+)</.exec(part)?.[1] ?? null;
      const art = clean(/SP-Kicker__text">([\s\S]*?)<\/span>/.exec(part)?.[1] ?? '');
      const title = clean(/SP-Collapsible__trigger__text[^>]*>([\s\S]*?)<\/h2>/.exec(part)?.[1] ?? '');
      if (!title) continue;
      const pdf = /href="([^"]+\.pdf)"[^>]*download="[^"]*"[^>]*>[\s\S]*?<span class="SP-Link__title">([\s\S]*?)<\/span>/.exec(part);
      const notice = clean(/SP-PublicNotice__notice">([\s\S]*?)<\/div>/.exec(part)?.[1] ?? '');
      const [start, end] = String(range ?? '').split(/\s*[-–]\s*/).map((x) => deDate(x));
      items.push({
        id: `bekanntmachung:${start ?? ''}:${title.slice(0, 80)}`,
        date: start ?? new Date().toISOString().slice(0, 10),
        end,
        title,
        summary: [art, range ? `Veröffentlichung ${range}` : null, notice].filter(Boolean).join(' · '),
        url: pdf ? new URL(pdf[1], BEKANNTMACHUNGEN).href : BEKANNTMACHUNGEN,
        linkText: pdf ? clean(pdf[2]) : null,
        source: 'Landeshauptstadt Stuttgart, Amtliche Bekanntmachungen',
        license: 'Amtliches Werk (§ 5 UrhG), Quellenangabe; PDFs werden verlinkt, nicht übernommen',
        topic: 'verwaltung',
        district: null,
        lat: null,
        lon: null,
        confidence: 'hoch',
      });
    }
    return items;
  });
  return value;
}

// ---------- Änderungen an den Verwaltungsseiten ----------
const COMPACT = (x) => ({
  name: x.name ?? null,
  address: x.address ?? null,
  hours: x.hours ?? null,
  booking: x.booking ?? null,
  web: x.web ?? null,
  rubrik: x.rubrik ?? null,
  amt: x.amt ?? null,
  services: (x.services ?? []).map((s) => s.name).filter(Boolean).sort(),
});
function snapshotItems() {
  if (!existsSync(VERW)) return null;
  try {
    const raw = JSON.parse(readFileSync(VERW, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.items ?? [];
    return Object.fromEntries(list.filter((x) => x && x.id).map((x) => [x.id, COMPACT(x)]));
  } catch { return null; }
}
function diffVerwaltung() {
  const current = snapshotItems();
  if (!current) return [];
  let old = null;
  try { old = JSON.parse(readFileSync(SNAP, 'utf8')).items; } catch { /* erster Lauf */ }
  const diffs = [];
  const now = new Date().toISOString().slice(0, 10);
  if (old) {
    for (const [id, cur] of Object.entries(current)) {
      const prev = old[id];
      if (!prev) {
        diffs.push({ id: `verwaltung:neu:${id}`, date: now, title: `Neu im Verwaltungsverzeichnis: ${cur.name ?? id}`, summary: 'Die Stadt hat eine neue Dienststelle oder Einrichtung in ihren strukturierten Daten veröffentlicht.', url: id, topic: 'verwaltung', lat: null, lon: null });
        continue;
      }
      const fields = [];
      for (const f of ['name', 'address', 'hours', 'booking', 'web', 'rubrik', 'amt']) {
        if (JSON.stringify(prev[f]) !== JSON.stringify(cur[f])) fields.push({ f, alt: prev[f], neu: cur[f] });
      }
      if (JSON.stringify(prev.services) !== JSON.stringify(cur.services)) {
        fields.push({ f: 'services', alt: prev.services?.join(', '), neu: cur.services?.join(', ') });
      }
      if (fields.length) {
        const label = { name: 'Name', address: 'Adresse', hours: 'Öffnungszeiten', booking: 'Terminbuchung', web: 'Webseite', rubrik: 'Rubrik', amt: 'Amt', services: 'Leistungen' };
        diffs.push({
          id: `verwaltung:${id}:${now}`,
          date: now,
          title: `Verwaltungsseite geändert: ${cur.name ?? id}`,
          summary: fields.map((x) => `${label[x.f] ?? x.f}: ${x.alt ?? '–'} → ${x.neu ?? '–'}`).join(' · '),
          url: id,
          topic: 'verwaltung',
          lat: null,
          lon: null,
        });
      }
    }
    for (const id of Object.keys(old)) {
      if (!current[id]) diffs.push({ id: `verwaltung:weg:${id}`, date: now, title: `Aus dem Verwaltungsverzeichnis entfernt: ${old[id].name ?? id}`, summary: 'Die Seite war im vorherigen Vergleichsstand vorhanden und ist jetzt nicht mehr enthalten.', url: id, topic: 'verwaltung', lat: null, lon: null });
    }
  }
  // Vergleichsstand fortschreiben (kompakt, damit die Datei klein bleibt)
  try {
    writeFileSync(SNAP, `${JSON.stringify({ stand: new Date().toISOString(), quelle: 'Landeshauptstadt Stuttgart, stuttgart.de', items: current })}\n`);
  } catch { /* Leserechte */ }
  return diffs.map((x) => ({ ...x, source: 'Landeshauptstadt Stuttgart, Verwaltungsseiten', license: 'Angaben der Landeshauptstadt Stuttgart (stuttgart.de)', confidence: 'hoch' }));
}

// ---------- Zusammenführen ----------
const TOPIC_LABEL = { verkehr: 'Verkehr', blaulicht: 'Blaulicht', verwaltung: 'Verwaltung', kultur: 'Kultur', sonstiges: 'Sonstiges', stadtleben: 'Stadtleben' };

export async function stadtgedaechtnis({ days = 30, district = null, topic = null, limit = 120 } = {}) {
  const n = Math.min(365, Math.max(1, Number(days) || 30));
  const since = Date.now() - n * 86400_000;
  const [newsRes, openRes, bekRes, verwRes] = await Promise.allSettled([
    news({ limit: 200, days: n }),
    process.env.OS_OPENINGS === '1' ? neueroeffnungen({ days: Math.min(90, n) }) : Promise.resolve({ items: [] }),
    bekanntmachungen(),
    cached('stadtgedaechtnis-verwaltung-diff', 6 * 3600_000, async () => diffVerwaltung()).then((r) => r.value),
  ]);
  const items = [];
  const sources = [];

  if (newsRes.status === 'fulfilled') {
    for (const x of newsRes.value.items ?? []) {
      items.push({
        id: `news:${x.id}`, date: String(x.published ?? '').slice(0, 10), title: x.title, summary: x.teaser ?? null,
        url: x.url, source: x.source, license: 'Quelle und Link; kein Volltext', topic: x.topic ?? 'sonstiges',
        district: x.district ?? null, lat: null, lon: null, confidence: x.sourceId === 'stadt' || x.sourceId === 'feuerwehr' ? 'hoch' : 'mittel',
      });
    }
    sources.push({ id: 'news', name: 'Stadt, Feuerwehr, Polizei, SWR, Kessel.TV', count: newsRes.value.items?.length ?? 0, ok: true, hinweis: 'RSS, nur Titel und Anreißer' });
  } else sources.push({ id: 'news', name: 'Meldungen', count: 0, ok: false, hinweis: String(newsRes.reason?.message ?? newsRes.reason) });

  if (openRes.status === 'fulfilled') {
    for (const x of openRes.value.items ?? []) {
      items.push({
        id: `osm:${x.id}`, date: x.sinceDate ?? String(x.since ?? '').slice(0, 10), title: `${x.name} – ${x.kindLabel ?? 'neu in OpenStreetMap'}`,
        summary: x.previous ? `Vorher: ${[x.previous.name, x.previous.kind].filter(Boolean).join(', ')}` : 'Neu erfasst oder als neuer Betrieb eingetragen.',
        url: x.source?.url ?? 'https://www.openstreetmap.org/', source: 'OpenStreetMap', license: 'ODbL, © OpenStreetMap-Mitwirkende',
        topic: 'stadtleben', district: x.district ?? null, lat: x.lat ?? null, lon: x.lon ?? null, confidence: 'mittel',
      });
    }
    sources.push({ id: 'osm', name: 'OpenStreetMap-Änderungssätze', count: openRes.value.items?.length ?? 0, ok: true, hinweis: 'Neu erfasste Gastro- und Ladenorte, keine Neueröffnungsgarantie' });
  } else sources.push({ id: 'osm', name: 'OpenStreetMap-Änderungssätze', count: 0, ok: false, hinweis: String(openRes.reason?.message ?? openRes.reason) });

  if (bekRes.status === 'fulfilled') {
    for (const x of bekRes.value) items.push({ ...x, sourceId: 'bekanntmachungen' });
    sources.push({ id: 'bekanntmachungen', name: 'Amtliche Bekanntmachungen', count: bekRes.value.length, ok: true, hinweis: 'Titel, Zeitraum und PDF-Link; keine Volltexte' });
  } else sources.push({ id: 'bekanntmachungen', name: 'Amtliche Bekanntmachungen', count: 0, ok: false, hinweis: String(bekRes.reason?.message ?? bekRes.reason) });

  if (verwRes.status === 'fulfilled') {
    for (const x of verwRes.value) items.push({ ...x, sourceId: 'verwaltung' });
    sources.push({ id: 'verwaltung', name: 'Verwaltungsseiten (Vergleich)', count: verwRes.value.length, ok: true, hinweis: 'Täglicher Vergleich; der erste Lauf setzt den Stand' });
  } else sources.push({ id: 'verwaltung', name: 'Verwaltungsseiten (Vergleich)', count: 0, ok: false, hinweis: String(verwRes.reason?.message ?? verwRes.reason) });

  const base = items
    .filter((x) => x.date && Date.parse(`${x.date}T12:00:00`) >= since)
    .filter((x) => !district || x.district === district)
    .filter((x) => !topic || x.topic === topic)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.title).localeCompare(String(b.title), 'de'));
  const filtered = base.slice(0, Math.min(500, Number(limit) || 120));
  const byTopic = Object.fromEntries(Object.keys(TOPIC_LABEL).map((t) => [t, base.filter((x) => x.topic === t).length]));
  return {
    items: filtered,
    total: base.length,
    days: n,
    since: new Date(since).toISOString().slice(0, 10),
    districts: [...new Set(base.map((x) => x.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')),
    topics: TOPIC_LABEL,
    byTopic,
    sources,
    updated: new Date().toISOString(),
    hinweis: 'Ein Eintrag ist ein Hinweis auf eine Änderung, keine amtliche Feststellung. Maßgeblich ist immer die verlinkte Quelle. Das Archiv wächst mit jedem Lauf; der erste Lauf des Verwaltungsvergleichs setzt nur den Vergleichsstand.',
  };
}

export async function stadtgedaechtnisRss({ days = 30 } = {}) {
  const d = await stadtgedaechtnis({ days });
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0">', '<channel>',
    '<title>Open Stuttgart – Stadtgedächtnis</title>', '<link>https://open-stuttgart.de</link>',
    '<description>Was sich in Stuttgart geändert hat, mit Quelle und Datum.</description>', '<language>de-DE</language>',
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`];
  for (const x of d.items) {
    lines.push('<item>', `<title>${esc(x.title)}</title>`, `<link>${esc(x.url)}</link>`,
      `<guid isPermaLink="false">${esc(x.id)}</guid>`, `<pubDate>${new Date(`${x.date}T12:00:00Z`).toUTCString()}</pubDate>`,
      `<description>${esc([x.summary, `Quelle: ${x.source}`, x.license].filter(Boolean).join(' · '))}</description>`,
      `<category>${esc(x.topic)}</category>`, '</item>');
  }
  lines.push('</channel>', '</rss>');
  return lines.join('\n');
}
