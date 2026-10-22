#!/usr/bin/env node
// Erzeugt den Verwaltungsdatensatz (server/data/verwaltung.json, server/data/verwaltung-demo.json,
// server/data/gebaeude.geojson) aus den Sitepark/citygov-Kopfdaten und Leistungsseiten von stuttgart.de.
// Höflicher Abruf mit Zwischenspeicher in server/.cache/crawl-verwaltung/ (Wiederaufnahme jederzeit möglich),
// maximal 2 parallele Stränge mit mindestens 1 Sekunde Abstand je Strang.
//
// Aufruf:
//   node scripts/crawl-verwaltung.mjs [--limit=200] [--only-vv]
//   npm run data:verwaltung

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE_DIR = join(ROOT, 'server', '.cache', 'crawl-verwaltung');
const DATA_DIR = join(ROOT, 'server', 'data');
mkdirSync(CACHE_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

const UA = 'OpenStuttgart-Crawler/0.1 (nicht kommerzielles Open-Source-Projekt; https://github.com/anelwa)';
const SITEMAP_INDEX = 'https://www.stuttgart.de/sitemap.xml';
const BB_STATUS_URL = 'https://wartezeiten.stuttgart.de/bb/status';

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const MAX_PAGES = limitArg ? Number(limitArg.split('=')[1]) : Infinity;
const ONLY_VV = !args.includes('--all');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheFileFor(url) {
  const h = createHash('sha1').update(url).digest('hex');
  return join(CACHE_DIR, `${h}.json`);
}

async function fetchCachedText(url, ttlMs = 7 * 86400_000) {
  const f = cacheFileFor(url);
  if (existsSync(f)) {
    try {
      const c = JSON.parse(readFileSync(f, 'utf8'));
      if (Date.now() - c.ts < ttlMs && c.body) return { body: c.body, fromCache: true };
    } catch { /* neu laden */ }
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  const body = await res.text();
  writeFileSync(f, JSON.stringify({ url, ts: Date.now(), body }));
  return { body, fromCache: false };
}

function extractLocs(xml) {
  const out = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

function stripTags(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Liest das Sitepark/citygov-JSON-Objekt im Seitenkopf von stuttgart.de aus. */
function parseCitygovMeta(html) {
  const m = html.match(/(?:sp_meta|dataLayer|citygov)\s*=\s*(\{[\s\S]*?\})\s*;/i)
    ?? html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  let meta = {};
  if (m) {
    try { meta = JSON.parse(m[1]); } catch { /* ignorieren */ }
  }
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = stripTags(titleMatch ? titleMatch[1] : '').replace(/\s*\|\s*Landeshauptstadt Stuttgart.*$/i, '').trim();
  const ibsMatch = html.match(/ibs\.dept\.(\d+)/i);
  const leikaMatch = html.match(/\b(99\d{12})\b/);
  const coordMatch = html.match(/"(?:lat|latitude)"\s*:\s*"?(\d{2}\.\d+)"?[\s\S]{1,120}?"(?:lon|lng|longitude)"\s*:\s*"?(\d{1,2}\.\d+)"?/i);

  return {
    title,
    type: meta.objectType ?? meta.type ?? null,
    ibs_id: ibsMatch ? `ibs.dept.${ibsMatch[1]}` : null,
    department: ibsMatch ? Number(ibsMatch[1]) : null,
    leika: meta.leika ?? (leikaMatch ? leikaMatch[1] : null),
    lat: coordMatch ? Number(coordMatch[1]) : (meta.lat ? Number(meta.lat) : null),
    lon: coordMatch ? Number(coordMatch[2]) : (meta.lon ? Number(meta.lon) : null),
  };
}

function classifyLinks(html, baseUrl) {
  const onlineAngebote = [];
  const serviceLinks = [];
  const unitLinks = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1].trim();
    const label = stripTags(m[2]);
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    try { href = new URL(href, baseUrl).href; } catch { continue; }
    if (seen.has(href)) continue;
    seen.add(href);

    if (/stuttgart\.konsentas\.de\/form\/\d+|service\.stuttgart\.de\/lhs-services\/traukalender/i.test(href)) {
      onlineAngebote.push({ art: 'termin', titel: label || 'Termin buchen', url: href });
    } else if (/service\.stuttgart\.de\/lhs-services\//i.test(href)) {
      onlineAngebote.push({ art: 'stadt', titel: label || 'Online-Dienst der Stadt', url: href });
    } else if (/service-bw\.de\/zufi\/(?:leistungen|lebenslagen)\//i.test(href) && /online|antrag|dienst/i.test(label)) {
      onlineAngebote.push({ art: 'land', titel: label || 'Online-Antrag (service-bw)', url: href });
    } else if (/\.(?:bund\.de|personalausweisportal\.de|fuehrungszeugnis\.bund\.de)/i.test(href)) {
      onlineAngebote.push({ art: 'bund', titel: label || 'Online-Dienst des Bundes', url: href });
    } else if (/\/vv\/leistungen\//i.test(href)) {
      serviceLinks.push({ name: label || href, url: href });
    } else if (/\/vv\/(?:verwaltungseinheit|adresse|einrichtung)\//i.test(href)) {
      unitLinks.push({ name: label || href, url: href });
    }
  }
  return { onlineAngebote, serviceLinks, unitLinks };
}

function parseSections(html) {
  const abschnitte = {};
  const headings = [
    ['Voraussetzungen', /voraussetzung/i],
    ['Benötigte Unterlagen', /unterlagen|dokumente|nachweise/i],
    ['Gebühren', /gebühr|kosten|entgelt/i],
    ['Bearbeitungsdauer', /bearbeitungsdauer|dauer|frist/i],
    ['Ablauf', /ablauf|vorgehen|verfahrensablauf/i],
    ['Rechtsgrundlage', /rechtsgrundlage|gesetz/i],
  ];
  const blockRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[23]\b|<footer|<aside|$)/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const h = stripTags(m[1]);
    const body = stripTags(m[2]);
    if (!body) continue;
    for (const [canon, rx] of headings) {
      if (rx.test(h) && !abschnitte[canon]) {
        abschnitte[canon] = body.slice(0, 2000);
        break;
      }
    }
  }
  return abschnitte;
}

function parseContactAndAddress(html) {
  const phoneMatch = html.match(/(?:Telefon|Tel\.?)[^0-9+]{0,30}(\+49[\d\s/-]{6,20}|0711[\d\s/-]{5,18})/i);
  const mailMatch = html.match(/mailto:([a-z0-9._%+-]+@stuttgart\.de)/i);
  const addrMatch = html.match(/(\d{5})\s+Stuttgart/i);
  let street = null;
  if (addrMatch) {
    const before = stripTags(html.slice(Math.max(0, addrMatch.index - 180), addrMatch.index + 40));
    const lines = before.split('\n').map((l) => l.trim()).filter(Boolean);
    const plzIdx = lines.findIndex((l) => /\b\d{5}\s+Stuttgart/i.test(l));
    if (plzIdx > 0) street = `${lines[plzIdx - 1]}, ${lines[plzIdx]}`;
    else if (plzIdx === 0) street = lines[0];
  }
  return {
    phone: phoneMatch ? phoneMatch[1].trim() : null,
    email: mailMatch ? mailMatch[1].toLowerCase() : null,
    address: street,
  };
}

async function main() {
  console.log('Lade Sitemap-Index von stuttgart.de …');
  const { body: indexXml } = await fetchCachedText(SITEMAP_INDEX, 24 * 3600_000);
  const sitemaps = extractLocs(indexXml).filter((u) => !/\/(en|fr|es|it|tr|ar|ru|uk)\//i.test(u));
  console.log(`${sitemaps.length} deutschsprachige Sitemaps gefunden.`);

  const urls = new Set();
  for (const sm of sitemaps) {
    try {
      const { body: smXml, fromCache } = await fetchCachedText(sm, 24 * 3600_000);
      for (const u of extractLocs(smXml)) {
        if (ONLY_VV && !/\/vv\/|\/buergerbuero|\/rathaus\//i.test(u)) continue;
        urls.add(u);
      }
      if (!fromCache) await sleep(500);
    } catch (e) {
      console.warn(`Sitemap übersprungen (${sm}): ${e.message}`);
    }
  }

  const queue = [...urls].slice(0, MAX_PAGES);
  console.log(`Verarbeite ${queue.length} Seiten (Cache in ${CACHE_DIR}) …`);

  const einheiten = [];
  const leistungenByUrl = new Map();

  for (let i = 0; i < queue.length; i++) {
    const url = queue[i];
    try {
      const { body: html, fromCache } = await fetchCachedText(url);
      const meta = parseCitygovMeta(html);
      const { onlineAngebote, serviceLinks } = classifyLinks(html, url);
      const contact = parseContactAndAddress(html);

      if (/\/vv\/leistungen\//i.test(url)) {
        const abschnitte = parseSections(html);
        leistungenByUrl.set(url, {
          id: `lst-${leistungenByUrl.size + 1}`,
          name: meta.title || url,
          url,
          leika: meta.leika,
          booking: onlineAngebote.find((o) => o.art === 'termin')?.url ?? null,
          onlineAngebote,
          abschnitte,
        });
      } else if (meta.lat && meta.lon) {
        const isBb = /bürgerbüro|buergerbuero/i.test(meta.title);
        einheiten.push({
          id: `e-${einheiten.length + 1}`,
          name: meta.title || url,
          rubrik: isBb ? 'buergerbuero' : /bezirksamt/i.test(meta.title) ? 'bezirksamt' : 'amt',
          lat: meta.lat,
          lon: meta.lon,
          address: contact.address,
          phone: contact.phone,
          email: contact.email,
          web: url,
          booking: onlineAngebote.find((o) => o.art === 'termin')?.url ?? null,
          ibs_id: meta.ibs_id,
          department: meta.department,
          onlineAngebote,
          services: serviceLinks.map((s) => ({
            name: s.name,
            url: s.url,
            online: false,
            rolle: 'angeboten in',
          })),
        });
      }

      if ((i + 1) % 50 === 0 || i + 1 === queue.length) {
        console.log(`  [${i + 1}/${queue.length}] ${einheiten.length} Einheiten mit Koordinate, ${leistungenByUrl.size} Leistungen`);
      }
      if (!fromCache) await sleep(1000);
    } catch (e) {
      console.warn(`Fehler bei ${url}: ${e.message}`);
    }
  }

  for (const e of einheiten) {
    for (const s of e.services) {
      const l = leistungenByUrl.get(s.url);
      if (l) {
        s.online = l.onlineAngebote.some((o) => o.art !== 'termin');
        s.abschnitte = l.abschnitte;
        s.onlineAngebote = l.onlineAngebote;
        s.leika = l.leika;
      }
    }
  }

  if (einheiten.length > 0) {
    const outDock = join(DATA_DIR, 'verwaltung.json');
    writeFileSync(outDock, JSON.stringify({ stand: new Date().toLocaleDateString('de-DE'), items: einheiten }, null, 2));
    console.log(`Geschrieben: ${outDock} (${einheiten.length} Einheiten)`);
  } else {
    console.log('Keine Einheiten geschrieben (ggf. ohne --limit erneut ausführen).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
