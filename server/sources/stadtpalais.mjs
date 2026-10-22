// StadtPalais – Museum für Stuttgart: WordPress-REST und der AJAX-Eventkalender.
//
// Zwei öffentlich erreichbare, aber nirgends dokumentierte Schnittstellen:
//  - /wp-json/wp/v2/ausstellungen      (Custom Post Type, ACF-Felder mit Laufzeit)
//  - /wp-admin/admin-ajax.php          (action=events, filtert Termine serverseitig nach Datum)
//
// Übernommen werden nur Fakten (Titel, Datum, Ort, Kategorie, Link). Beschreibungen und
// Bilder bleiben beim Museum. Die AJAX-Antwort ist HTML; sie wird hier defensiv geparst.
import { cached, fetchJson, fetchText } from '../cache.mjs';

const BASE = 'https://www.stadtpalais-stuttgart.de';
const WP = `${BASE}/wp-json/wp/v2`;
const AJAX = `${BASE}/wp-admin/admin-ajax.php`;
const HORIZON_DAYS = 21;

const htmlText = (s) => String(s ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/\s+/g, ' ').trim();

const ymd = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d).replace(/-/g, '');
const isoDay = (s) => {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s ?? ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Datum im Zeitfenster: Jahreszahl aus dem Abfragezeitraum ableiten (auch über den Jahreswechsel). */
function dayInRange(day, month, from, to) {
  const start = new Date(`${ymd(from).slice(0, 4)}-${ymd(from).slice(4, 6)}-${ymd(from).slice(6, 8)}T00:00:00Z`);
  const end = new Date(`${ymd(to).slice(0, 4)}-${ymd(to).slice(4, 6)}-${ymd(to).slice(6, 8)}T23:59:59Z`);
  const years = [start.getUTCFullYear(), start.getUTCFullYear() + 1, end.getUTCFullYear()];
  for (const y of [...new Set(years)]) {
    const d = new Date(Date.UTC(y, month - 1, day));
    if (d >= start && d <= end) return { y, m: month, d: day };
  }
  return { y: start.getUTCFullYear(), m: month, d: day };
}

/** Liest die Terminkarten aus der HTML-Antwort von admin-ajax.php?action=events. */
function parseCards(html, from, to) {
  const out = [];
  const blocks = [...String(html ?? '').matchAll(/<div class="row no-gutters event(?: event-children)?"[\s\S]*?(?=<div class="row no-gutters event(?: event-children)?"|<\/div>\s*<div class="button-container|$)/g)];
  for (const m of blocks) {
    const b = m[0];
    const title = /<h4 class="h4 event-headline">\s*<a[^>]*>([\s\S]*?)<\/a>/.exec(b)?.[1];
    if (!title) continue;
    const url = /<a href="([^"]+)"[^>]*class="btn btn-primary btn-sm"/.exec(b)?.[1]
      ?? /<h4 class="h4 event-headline">\s*<a href="([^"]+)"/.exec(b)?.[1]
      ?? /onclick="window\.location\.href='([^']+)'"/.exec(b)?.[1];
    const dateText = /<div class="event-date">([\s\S]*?)<\/div>/.exec(b)?.[1] ?? '';
    const dm = /(\d{1,2})\.(\d{1,2})\./.exec(dateText);
    if (!dm) continue;
    const { y, m: month, d: day } = dayInRange(+dm[1], +dm[2], from, to);
    const date = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tm = /(\d{1,2}):(\d{2})\s*bis\s*(\d{1,2}):(\d{2})/.exec(dateText);
    const time = tm ? `${tm[1].padStart(2, '0')}:${tm[2]}–${tm[3].padStart(2, '0')}:${tm[4]}` : null;
    const location = htmlText(/<p class="event-place">([\s\S]*?)<\/p>/.exec(b)?.[1] ?? '') || null;
    const categoryBlock = /<h4 class="h6 event-category">([\s\S]*?)<\/h4>/.exec(b)?.[1] ?? '';
    const categories = [...categoryBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)].map((x) => htmlText(x[1])).filter(Boolean);
    out.push({
      id: url ? url.split('/').filter(Boolean).pop() : `${date}-${htmlText(title)}`,
      title: htmlText(title), date, time, location,
      categories: [...new Set(categories)].slice(0, 4),
      url: url?.startsWith('http') ? url : `${BASE}${url ?? ''}`,
    });
  }
  // Doppelte Karten (verschachtelte Kinder) zusammenführen.
  return [...new Map(out.map((e) => [e.url, e])).values()];
}

async function terminkalender() {
  const from = new Date();
  const to = new Date(Date.now() + HORIZON_DAYS * 86400_000);
  const body = new URLSearchParams({
    action: 'events', time_span: 'datepicker',
    date_from: ymd(from), date_to: ymd(to),
    target_groups: '', categories: '', locations: '',
  });
  const html = await fetchText(AJAX, {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 25_000,
  });
  return parseCards(html, from, to)
    .filter((e) => e.date >= `${ymd(from).slice(0, 4)}-${ymd(from).slice(4, 6)}-${ymd(from).slice(6, 8)}`)
    .sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));
}

async function ausstellungen() {
  const fields = 'id,title,link,acf,exhibition-categories';
  const [cats, first] = await Promise.all([
    fetchJson(`${WP}/exhibition-categories?per_page=100&_fields=id,name,slug`, { timeout: 20_000 }).catch(() => []),
    fetchJson(`${WP}/ausstellungen?per_page=100&_fields=${fields}`, { timeout: 20_000 }),
  ]);
  const second = await fetchJson(`${WP}/ausstellungen?per_page=100&page=2&_fields=${fields}`, { timeout: 20_000 }).catch(() => []);
  const catName = new Map((Array.isArray(cats) ? cats : []).map((c) => [c.id, c.name]));
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  return [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]
    .map((x) => {
      const from = isoDay(x.acf?.['date-from']);
      const to = isoDay(x.acf?.['date-to']);
      return {
        id: x.id,
        title: htmlText(x.title?.rendered),
        from, to,
        location: x.acf?.LocationDE || x.acf?.LocationEN || 'StadtPalais',
        category: catName.get(x.acf?.category) ?? null,
        url: x.link,
      };
    })
    .filter((x) => x.from && (!x.to || x.to >= today))
    .sort((a, b) => a.from.localeCompare(b.from));
}

export async function stadtpalais() {
  const { value, fresh } = await cached('stadtpalais-schnittstellen', 6 * 3600_000, async () => {
    const [ev, ex] = await Promise.allSettled([terminkalender(), ausstellungen()]);
    return {
      events: ev.status === 'fulfilled' ? ev.value : [],
      exhibitions: ex.status === 'fulfilled' ? ex.value : [],
      errors: [ev, ex].filter((x) => x.status === 'rejected').map((x) => String(x.reason?.message ?? x.reason)),
    };
  });
  return {
    ...value,
    fresh,
    stand: new Date().toISOString(),
    source: 'StadtPalais – Museum für Stuttgart (WordPress REST und AJAX)',
    lizenz: 'Fakten und Links mit Quellenangabe; keine Übernahme von Beschreibungen, Bildern oder Layout.',
    hinweis: 'Öffentlich erreichbare, aber nicht dokumentierte Schnittstelle. Termine werden für die nächsten 21 Tage serverseitig gefiltert; Ausstellungen sind laufend oder künftig.',
  };
}
