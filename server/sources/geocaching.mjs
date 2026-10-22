// Geocaching über Opencaching.de (CC BY-NC-ND 3.0 DE). Kein Geocaching.com-Scraping.
// Angezeigt werden nur Startkoordinaten, Cache-Art, D/T-Wertung, Größe und der Link zum Listing.
// Keine Final-Koordinaten, keine Beschreibungstexte, keine Spoiler. Abruf höchstens alle 12 Stunden.
// Die offene Quelle war bei der Einrichtung nicht erreichbar (HTTP 503). Deshalb gibt es zusätzlich
// einen lokalen Bestand (server/data/geocaches.json) und die Möglichkeit eines JSON-Exports.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cached, fetchJson, fetchText } from '../cache.mjs';

const FILE = process.env.OS_OPENCACHING_FILE ?? fileURLToPath(new URL('../data/geocaches.json', import.meta.url));
const SEARCH = 'https://www.opencaching.de/search.php?searchto=searchbyname&showresult=1&waypointname=Stuttgart';
const R = 6371000;
const dist = (a, b) => {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const decode = (s) => String(s ?? '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function local() {
  if (!existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'));
    return (raw.items ?? []).filter((x) => Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lon))).map((x) => ({
      id: String(x.id ?? x.code ?? ''), code: x.code ?? null, name: x.name ?? 'Geocache', art: x.art ?? x.type ?? null,
      groesse: x.groesse ?? x.size ?? null, schwierigkeit: num(x.schwierigkeit ?? x.difficulty), gelaende: num(x.gelaende ?? x.terrain),
      lat: Number(x.lat), lon: Number(x.lon), url: x.url ?? null, kinderwagen: x.kinderwagen ?? null, rollstuhl: x.rollstuhl ?? null,
      quelle: x.quelle ?? 'Opencaching.de',
    }));
  } catch { return []; }
}

/** Sehr defensiver Parser für die öffentliche Suchseite; liefert nur eindeutig erkennbare Listings. */
function parseSearch(html) {
  const items = [];
  const blocks = html.split(/<tr[\s>]/i).slice(1);
  for (const b of blocks) {
    const code = /OC[0-9A-Z]{4,}/.exec(b)?.[0] ?? null;
    const href = /href="([^"]*viewcache\.php\?[^"]+)"/i.exec(b)?.[1] ?? null;
    const name = decode(/<a[^>]*viewcache[^>]*>([\s\S]*?)<\/a>/i.exec(b)?.[1] ?? '');
    if (!code || !href || !name) continue;
    const lat = num(/latitude["'\s:=]+(-?\d+[.,]\d+)/i.exec(b)?.[1]);
    const lon = num(/longitude["'\s:=]+(-?\d+[.,]\d+)/i.exec(b)?.[1]);
    if (lat == null || lon == null) continue;
    items.push({ id: code, code, name, art: null, groesse: null, schwierigkeit: null, gelaende: null, lat, lon, url: new URL(href, 'https://www.opencaching.de').href, quelle: 'Opencaching.de' });
  }
  return items;
}

export async function geocaches({ lat, lon, r = 5000, limit = 100 } = {}) {
  const { value, at, fresh } = await cached('geocaches-stuttgart-v1', 12 * 3600_000, async () => {
    let items = local();
    let error = null;
    let source = items.length ? 'Lokaler Bestand (Opencaching.de)' : 'Opencaching.de';
    const jsonUrl = (process.env.OS_OPENCACHING_JSON ?? '').trim();
    if (jsonUrl) {
      try {
        const d = await fetchJson(jsonUrl, { timeout: 15000 });
        const list = Array.isArray(d) ? d : d.items ?? d.caches ?? [];
        items = list.filter((x) => Number.isFinite(Number(x.lat ?? x.latitude)) && Number.isFinite(Number(x.lon ?? x.longitude))).map((x) => ({
          id: String(x.id ?? x.code ?? x.oc_code), code: x.code ?? x.oc_code ?? null, name: x.name ?? 'Geocache', art: x.type ?? x.art ?? null,
          groesse: x.size ?? x.groesse ?? null, schwierigkeit: num(x.difficulty ?? x.schwierigkeit), gelaende: num(x.terrain ?? x.gelaende),
          lat: Number(x.lat ?? x.latitude), lon: Number(x.lon ?? x.longitude), url: x.url ?? null, quelle: 'Opencaching.de (Export)',
        }));
        source = 'Opencaching.de (Export)';
      } catch (e) { error = `Export nicht erreichbar: ${e.message}`; }
    }
    if (!items.length && process.env.OS_OPENCACHING !== '0') {
      try {
        const html = await fetchText(SEARCH, { timeout: 8000, headers: { Accept: 'text/html' } });
        items = parseSearch(html);
        source = 'Opencaching.de';
        if (!items.length) error = 'Opencaching.de antwortet, aber die Suchseite enthielt keine auswertbaren Listings.';
      } catch (e) {
        error = `Opencaching.de derzeit nicht erreichbar (${e.message}). Die Karte zeigt deshalb keine Geocaches.`;
      }
    }
    // Nur Startkoordinaten; keine Final-Koordinaten, keine Beschreibungstexte.
    return { items, error, source, lizenz: 'CC BY-NC-ND 3.0 DE (Opencaching.de), nur Fakten und Link zum Listing', hinweis: 'Angezeigt werden nur Startkoordinaten und öffentliche Listing-Fakten. Final-Koordinaten und Beschreibungen werden nicht übernommen.' };
  });
  const hasPoint = lat != null && String(lat).trim() !== '' && lon != null && String(lon).trim() !== '';
  const la = hasPoint ? Number(lat) : NaN;
  const lo = hasPoint ? Number(lon) : NaN;
  let list = value.items;
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    const radius = Math.min(20000, Math.max(500, Number(r) || 5000));
    list = list.map((x) => ({ ...x, dist: Math.round(dist([lo, la], [x.lon, x.lat])) })).filter((x) => x.dist <= radius).sort((a, b) => a.dist - b.dist);
  }
  return {
    items: list.slice(0, Math.min(300, Number(limit) || 100)),
    total: list.length,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    error: value.error,
    source: value.source,
    lizenz: value.lizenz,
    hinweis: value.hinweis,
    suchlink: SEARCH,
  };
}
