// API-Proxy und Auslieferung der gebauten Oberfläche. Keine Abhängigkeiten außer Node ≥ 20.
import './env.mjs';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { departures, searchStops } from './sources/efa.mjs';
import { approaching, trip } from './sources/vehicles.mjs';
import { traffic } from './sources/traffic.mjs';
import { neueroeffnungen, news, orte, wasGeht, wasGehtIcs, wasGehtPruefliste } from './sources/wasgeht.mjs';
import { puenktlichkeitJetzt, puenktlichkeitTage, startGtfsrt } from './sources/gtfsrt.mjs';
import { bahnHbf, bahnHistorie } from './sources/db.mjs';
import { ankuenfteHbf, anschluss } from './sources/anschluss.mjs';
import { radar } from './sources/radar.mjs';
import { kaltluft, kessel } from './sources/kessel.mjs';
import { bikeAndRide, parkAndRide, parking, radzaehler } from './sources/parking.mjs';
import { sharing } from './sources/sharing.mjs';
import { roadworks, bikeRoutes } from './sources/roadworks.mjs';
import { air, warnungen, weather, water } from './sources/environment.mjs';
import { events, places, wikiSummary } from './sources/culture.mjs';
import { profil } from './sources/adresse.mjs';
import { hitze } from './sources/hitze.mjs';
import { flug } from './sources/flug.mjs';
import { unfaelle, unfallStatistik } from './sources/unfall.mjs';
import { wanderwege, wanderwegeGeoJson } from './sources/wanderwege.mjs';
import { umlandGeoJson, umlandMeta, umlandWetter, umlandZiel, umlandZiele } from './sources/umland.mjs';
import { bartour, bartourGpx, bartouren, bartourenGeoJson } from './sources/bartouren.mjs';
import { spielAbschluss, spielPruefen, spielRoute, spielRouten } from './sources/spiel.mjs';
import { stadtgedaechtnis, stadtgedaechtnisRss } from './sources/stadtgedaechtnis.mjs';
import { geocaches } from './sources/geocaching.mjs';
import { documentDetail, related, search, searchStats, suggest } from './sources/search.mjs';
import { kontaktDetail, kontakteStats, kontakteSuche } from './sources/kontakte.mjs';
import { beobachtungen, giessRadar, pollenKarte } from './sources/natur.mjs';
import { mensen } from './sources/mensa.mjs';
import { ortSuche, route } from './sources/routing.mjs';
import { aufzuege } from './sources/aufzuege.mjs';
import { bebauungsplaene, beteiligungen, wahlergebnisse } from './sources/beteiligung.mjs';
import { maengelUebergabe, partnerDaten, partnerStatus } from './sources/partner.mjs';
import { archivDatei, archivTage, startVerlauf } from './sources/verlauf.mjs';
import { abfall, adresse, baeder, buergerbueros, categories, facilities, freizeitRouten, gesundheit, gruenstrom, laden, schulbezirk } from './sources/nearby.mjs';
import { tankpreise } from './sources/tanken.mjs';
import { verwaltungGebaeude, verwaltungLeistung, verwaltungSuche, verwaltungWerkzeug, verwaltungWo } from './sources/verwaltung.mjs';
import { botCoverage, botReply, botStatus, botToolCatalog } from './sources/bot.mjs';
import { handleMcpHttp } from './mcp/index.mjs';
import { stadtpalais } from './sources/stadtpalais.mjs';
import {
  addressSearch, bibliothek, dcatKatalog, foodsharing, fragdenstaat, fragdenstaatRss, gbif,
  geocode, komunis, komunisDoc, osmNotes, stadtKatalog, wfsFeatures, wfsKatalog, wfsRss, wikidataGaps,
} from './sources/schnittstellen.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const routes = {
  '/api/departures': (q) => departures(q.get('stop'), q.get('at')),
  '/api/stops/search': (q) => searchStops(q.get('q')),
  '/api/vehicles': (q) => approaching(q.get('stop')),
  '/api/trip': (q) => trip({ line: q.get('line'), stop: q.get('stop'), tripCode: q.get('tripCode'), planned: q.get('planned') }),
  '/api/traffic': () => traffic(),
  '/api/wasgeht': (q) => wasGeht({ tag: q.get('date'), span: q.get('span'), szene: q.get('scene'), jung: q.get('jung'), free: q.get('free'), maxPrice: q.get('maxPrice') }),
  '/api/wasgeht/orte': async () => ({ orte: orte() }),
  '/api/wasgeht/pruefliste': async () => wasGehtPruefliste(),
  // Auswertung der OSM-Änderungssätze noch nicht im Dauerbetrieb geprüft; einschalten mit OS_OPENINGS=1
  '/api/openings': async (q) => (process.env.OS_OPENINGS === '1'
    ? neueroeffnungen({ days: q.get('days'), signal: q.get('signal') })
    : { items: [], updated: null, running: false, error: null, hinweis: 'Die Auswertung neu erfasster Orte aus OpenStreetMap ist in dieser Fassung abgeschaltet.', source: { attribution: '© OpenStreetMap-Mitwirkende (ODbL)' } }),
  '/api/search': (q) => search({ q: q.get('q'), type: q.get('type'), limit: q.get('limit'), offset: q.get('offset') }),
  '/api/search/suggest': (q) => suggest(q.get('q')),
  '/api/search/stats': () => searchStats(),
  '/api/kontakte': (q) => kontakteSuche({
    q: q.get('q'), kind: q.get('kind'), gruppe: q.get('gruppe'),
    limit: q.get('limit'), offset: q.get('offset'),
  }),
  '/api/kontakte/stats': () => kontakteStats(),
  '/api/news': (q) => news({ topic: q.get('topic'), district: q.get('district') }),
  '/api/stadtgedaechtnis': (q) => stadtgedaechtnis({ days: q.get('days'), district: q.get('district'), topic: q.get('topic'), limit: q.get('limit') }),
  '/api/puenktlichkeit': () => puenktlichkeitJetzt(),
  '/api/puenktlichkeit/tage': (q) => puenktlichkeitTage(Math.min(31, Math.max(1, Number(q.get('n')) || 7))),
  '/api/bahn/hbf': () => bahnHbf(),
  '/api/bahn/historie': () => bahnHistorie(),
  '/api/anschluss/ankuenfte': () => ankuenfteHbf(),
  '/api/anschluss': (q) => anschluss(q.get('ankunft'), q.get('linie'), q.get('ziel')),
  '/api/parking': () => parking(),
  '/api/bikeandride': (q) => bikeAndRide(q.get('stop'), q.get('lat'), q.get('lon'), { purpose: q.get('purpose'), radius: q.get('radius') }),
  '/api/parkandride': () => parkAndRide(),
  '/api/radzaehler': () => radzaehler(),
  '/api/sharing': () => sharing(),
  '/api/roadworks': () => roadworks(),
  '/api/bikeroutes': () => bikeRoutes(),
  '/api/air': () => air(),
  '/api/weather': () => weather(),
  '/api/water': () => water(),
  '/api/warnungen': () => warnungen(),
  '/api/events': (q) => events(q.get('date')),
  '/api/places': () => places(),
  '/api/wiki': (q) => wikiSummary(q.get('title')),
  '/api/radar': () => radar(),
  '/api/kessel': () => kessel(),
  '/api/nearby/categories': async () => categories(),
  '/api/nearby/facilities': (q) => facilities(q.get('cat'), { diet: q.get('diet') }),
  '/api/nearby/tanken': () => tankpreise(),
  '/api/freizeit/routen': () => freizeitRouten(),
  '/api/umland': () => umlandMeta(),
  '/api/umland/ziele': (q) => umlandZiele({ kategorie: q.get('kategorie'), kreis: q.get('kreis'), q: q.get('q'), lat: q.get('lat'), lon: q.get('lon'), r: q.get('r'), familie: q.get('familie'), limit: q.get('limit') }),
  '/api/umland/ziele.geojson': () => umlandGeoJson(),
  '/api/umland/wetter': (q) => umlandWetter(q.get('lat'), q.get('lon'), q.get('ort')),
  '/api/wanderwege': () => wanderwege(),
  '/api/wanderwege.geojson': () => wanderwegeGeoJson(),
  '/api/bartouren': () => bartouren(),
  '/api/bartouren.geojson': () => bartourenGeoJson(),
  '/api/spiel/routen': () => spielRouten(),
  '/api/nearby/buergerbueros': () => buergerbueros(),
  '/api/nearby/baeder': () => baeder(),
  '/api/nearby/abfall': (q) => abfall(q.get('street'), q.get('nr')),
  '/api/nearby/schulbezirk': (q) => schulbezirk(+q.get('lat'), +q.get('lon')),
  '/api/nearby/laden': (q) => laden(q.get('lat'), q.get('lon'), q.get('plz')),
  '/api/nearby/adresse': (q) => adresse(q.get('q')),
  '/api/adresse/profil': (q) => profil(+q.get('lat'), +q.get('lon'), q.get('street'), q.get('nr')),
  '/api/verwaltung/gebaeude': (q) => verwaltungGebaeude(q.get('id'), q.get('rubrik')),
  '/api/verwaltung/leistung': (q) => verwaltungLeistung(q.get('url') ?? q.get('id')),
  '/api/verwaltung/suche': (q) => verwaltungSuche(q.get('q')),
  '/api/verwaltung/wo': (q) => verwaltungWo(q.get('leistung') ?? q.get('url'), q.get('lat'), q.get('lon')),
  '/api/verwaltung/werkzeuge': (q) => verwaltungWerkzeug(q.get('tool'), { q: q.get('q'), url: q.get('url'), id: q.get('id'), leistung: q.get('leistung'), name: q.get('name'), lat: q.get('lat'), lon: q.get('lon') }),
  '/api/archiv': async () => ({ days: archivTage(), format: 'CSV: zeit (UTC, ISO 8601), art (bad = Besucherzahl, bb = Wartezeit-Stufe der Bürgerbüros), id, wert, maximum', lizenz: 'Abgeleitet aus Daten der Stuttgarter Bäder und der Landeshauptstadt Stuttgart; Weiterverwendung mit Quellenangabe' }),
  '/api/route': (q) => route({ von: q.get('von'), nach: q.get('nach'), modus: q.get('modus') ?? undefined, zeit: q.get('zeit'), ankunft: q.get('ankunft'), profil: q.get('profil') ?? undefined }),
  '/api/orte/suche': (q) => ortSuche(q.get('q')),
  '/api/aufzuege': () => aufzuege(),
  '/api/hitze': () => hitze(),
  '/api/beteiligung/bebauungsplaene': (q) => bebauungsplaene(q.get('lat'), q.get('lon'), q.get('r')),
  '/api/beteiligung/wahlen': (q) => wahlergebnisse(q.get('stadtbezirk')),
  '/api/beteiligung/verfahren': () => beteiligungen(),
  '/api/partner': async () => partnerStatus(),
  '/api/partner/daten': (q) => partnerDaten(q.get('id'), { q: q.get('q'), ars: q.get('ars') ?? undefined }),
  '/api/partner/maengel': async (q) => maengelUebergabe(q.get('lat'), q.get('lon'), q.get('art'), q.get('adresse')),
  '/api/gesundheit': (q) => gesundheit(q.get('plz')),
  '/api/gruenstrom': (q) => gruenstrom(q.get('plz')),
  '/api/flug': () => flug(),
  '/api/unfaelle': (q) => unfaelle({
    lat: q.get('lat'), lon: q.get('lon'), r: q.get('r'), bbox: q.get('bbox'),
    art: q.get('art') ?? 'alle', schwere: q.get('schwere') ?? 'alle', limit: q.get('limit'),
  }),
  '/api/unfaelle/statistik': () => unfallStatistik(),
  '/api/kaltluft': () => kaltluft(),
  '/api/giess': (q) => giessRadar(+q.get('lat'), +q.get('lon')),
  '/api/pollenkarte': () => pollenKarte(),
  '/api/natur': (q) => beobachtungen(+q.get('lat'), +q.get('lon'), q.get('r')),
  '/api/geocaches': (q) => geocaches({ lat: q.get('lat'), lon: q.get('lon'), r: q.get('r'), limit: q.get('limit') }),
  '/api/mensa': (q) => mensen(q.get('date')),
  '/api/health': async () => ({ ok: true, time: new Date().toISOString() }),
  '/api/bot/health': async () => botStatus(),
  '/api/bot/tools': async () => botToolCatalog(),
  '/api/bot/coverage': async () => botCoverage(),
  // Schnittstellen im weiten Sinn: Stadt-Layer, Geocoder, Statistik, Transparenz, Arten, Katalog
  '/api/stadt/wfs/katalog': () => wfsKatalog(),
  '/api/stadt/wfs': (q) => wfsFeatures({ layer: q.get('layer'), lat: q.get('lat'), lon: q.get('lon'), r: q.get('r'), limit: q.get('limit') }),
  '/api/stadt/geocode': (q) => geocode(q.get('q'), q.get('limit')),
  '/api/stadt/adresse': (q) => addressSearch(q.get('q')),
  '/api/stadt/komunis': (q) => komunis(q.get('start')),
  '/api/stadt/komunis/doc': (q) => komunisDoc(q.get('unid')),
  '/api/stadt/fragdenstaat': (q) => fragdenstaat(q.get('limit'), q.get('status')),
  '/api/stadt/foodsharing': () => foodsharing(),
  '/api/stadt/gbif': (q) => gbif(q.get('lat'), q.get('lon'), q.get('r')),
  '/api/stadt/osm-notes': (q) => osmNotes(q.get('lat'), q.get('lon'), q.get('r')),
  '/api/stadt/wikidata': () => wikidataGaps(),
  '/api/stadt/bibliothek': (q) => bibliothek(q.get('q')),
  '/api/stadt/katalog': () => dcatKatalog(),
  '/api/stadt/ckan': () => stadtKatalog(),
  '/api/stadt/stadtpalais': () => stadtpalais(),
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};

/** JSON-Body mit harter Obergrenze; der Bot braucht nur wenige Kilobyte. */
async function readJsonBody(req, limit = 32_768) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Anfrage zu groß'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Ungültiges JSON'), { status: 400 });
  }
}

/** Hinter Dokploy/nginx steht die echte Adresse im Proxy-Header. */
function clientIp(req) {
  if (process.env.OS_TRUST_PROXY === '1') {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress ?? 'unbekannt';
}

async function serveStatic(res, pathname) {
  let file = normalize(join(DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST)) file = join(DIST, 'index.html');
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html');
  }
  try {
    const body = await readFile(file);
    const immutable = file.includes(`${DIST}assets`);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Noch nicht gebaut. Bitte "npm start" oder für Entwicklung "npm run dev" verwenden.');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // Fortschritt und Aktionen als Server-Sent Events. Der Client kann auch weiterhin
  // den kompakten JSON-Endpunkt nutzen; beide liefern denselben BotTurn.
  if (req.method === 'POST' && url.pathname === '/api/bot/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    const send = (event, data) => {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* Client weg */ }
    };
    try {
      const body = await readJsonBody(req);
      send('status', { text: 'Ich schaue nach …' });
      const data = await botReply({
        sessionId: body.sessionId,
        message: body.message,
        location: body.location,
        context: body.context,
        ip: clientIp(req),
      });
      for (const action of data.ui ?? []) send('action', action);
      for (const card of data.cards ?? []) send('card', card);
      const text = String(data.reply ?? '');
      for (let i = 0; i < text.length; i += 60) send('token', { text: text.slice(i, i + 60) });
      send('done', data);
    } catch (err) {
      send('error', { message: err.message ?? 'StuttBot nicht erreichbar' });
    }
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/bot') {
    const t0 = Date.now();
    try {
      const body = await readJsonBody(req);
      const data = await botReply({
        sessionId: body.sessionId,
        message: body.message,
        location: body.location,
        context: body.context,
        ip: clientIp(req),
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
      if (process.env.LOG) console.log(`/api/bot ${Date.now() - t0} ms`);
    } catch (err) {
      const status = err.status ?? 502;
      console.warn(`/api/bot: ${err.message}`);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'StuttBot nicht erreichbar' }));
    }
    return;
  }

  // ---------- MCP: Open Stuttgart als read-only Werkzeugquelle für andere Agenten ----------
  // Streamable HTTP unter /mcp, dual-era (2026-07-28 zustandslos, ältere Fassungen mit
  // initialize/Sitzung). Der Katalog, die Ressourcen und die Prompts liegen in server/mcp/.
  if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
    await handleMcpHttp(req, res, { ip: clientIp(req) });
    return;
  }

  // Stadtspiel: Antworten und Lösungswort werden serverseitig geprüft.
  if (req.method === 'POST' && (url.pathname === '/api/spiel/pruefen' || url.pathname === '/api/spiel/abschluss')) {
    try {
      const body = await readJsonBody(req, 16_384);
      const data = url.pathname.endsWith('/pruefen')
        ? spielPruefen({ routeId: String(body.routeId ?? ''), stationId: String(body.stationId ?? ''), answer: body.answer })
        : spielAbschluss({ routeId: String(body.routeId ?? ''), word: body.word });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    } catch (err) {
      const status = err.status ?? 400;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Antwort konnte nicht geprüft werden' }));
    }
    return;
  }

  const spielRouteMatch = /^\/api\/spiel\/routen\/([^/]+)$/.exec(url.pathname);
  if (spielRouteMatch) {
    try {
      const data = spielRoute(decodeURIComponent(spielRouteMatch[1]));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(err.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Spielroute nicht erreichbar' }));
    }
    return;
  }

  const umlandZielMatch = /^\/api\/umland\/ziele\/([^/]+)$/.exec(url.pathname);
  if (umlandZielMatch) {
    try {
      const data = await umlandZiel(decodeURIComponent(umlandZielMatch[1]), { lat: url.searchParams.get('lat'), lon: url.searchParams.get('lon') });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(err.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Ausflugsziel nicht erreichbar' }));
    }
    return;
  }

  const handler = routes[url.pathname];
  if (handler) {
    const t0 = Date.now();
    try {
      const data = await handler(url.searchParams);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
      if (process.env.LOG) console.log(`${url.pathname} ${Date.now() - t0} ms`);
    } catch (err) {
      const status = err.status ?? 502;
      console.warn(`${url.pathname}: ${err.message}`);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Quelle nicht erreichbar' }));
    }
    return;
  }
  const bartourGpxMatch = /^\/api\/bartouren\/([^/]+)\.gpx$/.exec(url.pathname);
  if (bartourGpxMatch) {
    const gpx = bartourGpx(decodeURIComponent(bartourGpxMatch[1]));
    if (!gpx) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Tour nicht gefunden' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/gpx+xml; charset=utf-8', 'Content-Disposition': `attachment; filename="open-stuttgart-${bartourGpxMatch[1]}.gpx"` });
      res.end(gpx);
    }
    return;
  }
  const bartourMatch = /^\/api\/bartouren\/([^/]+)$/.exec(url.pathname);
  if (bartourMatch) {
    const data = bartour(decodeURIComponent(bartourMatch[1]));
    if (!data) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Tour nicht gefunden' }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
      res.end(JSON.stringify(data));
    }
    return;
  }
  const docMatch = /^\/api\/documents\/(\d+)(\/related)?$/.exec(url.pathname);
  if (docMatch) {
    try {
      const data = docMatch[2] ? related(Number(docMatch[1])) : documentDetail(Number(docMatch[1]));
      if (!data) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Dokument nicht gefunden' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
        res.end(JSON.stringify(data));
      }
    } catch (err) {
      res.writeHead(err.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Suchdatenbank nicht erreichbar' }));
    }
    return;
  }
  const kontaktMatch = /^\/api\/kontakte\/([^/]+)$/.exec(url.pathname);
  if (kontaktMatch) {
    try {
      const data = kontaktDetail(decodeURIComponent(kontaktMatch[1]));
      if (!data) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Kontakt nicht gefunden' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
        res.end(JSON.stringify(data));
      }
    } catch (err) {
      res.writeHead(err.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Kontaktregister nicht erreichbar' }));
    }
    return;
  }
  if (url.pathname === '/api/stadt/wfs.rss') {
    const q = url.searchParams;
    try {
      const rss = await wfsRss({ layer: q.get('layer') });
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      res.end(rss);
    } catch (err) {
      res.writeHead(err.status ?? 502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Feed nicht verfügbar' }));
    }
    return;
  }
  if (url.pathname === '/api/stadt/fragdenstaat.rss') {
    try {
      const rss = await fragdenstaatRss();
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      res.end(rss);
    } catch (err) {
      res.writeHead(err.status ?? 502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message ?? 'Feed nicht verfügbar' }));
    }
    return;
  }
  if (url.pathname === '/api/stadtgedaechtnis.rss') {
    const q = url.searchParams;
    const rss = await stadtgedaechtnisRss({ days: q.get('days') });
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' });
    res.end(rss);
    return;
  }
  if (url.pathname === '/api/wasgeht.ics') {
    const q = url.searchParams;
    const ics = await wasGehtIcs({ tag: q.get('date'), span: q.get('span'), szene: q.get('scene'), jung: q.get('jung'), free: q.get('free'), maxPrice: q.get('maxPrice') });
    res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="was-geht-stuttgart.ics"' });
    res.end(ics);
    return;
  }
  const csv = /^\/api\/archiv\/(\d{4}-\d{2}-\d{2})\.csv$/.exec(url.pathname);
  if (csv && archivDatei(csv[1])) {
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="open-stuttgart-${csv[1]}.csv"` });
    res.end(await readFile(archivDatei(csv[1])));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"unbekannter Pfad"}');
    return;
  }
  serveStatic(res, url.pathname);
});

startGtfsrt();
startVerlauf({ baeder, buergerbueros });

server.listen(PORT, () => {
  console.log(`Open Stuttgart läuft auf http://localhost:${PORT}`);
});
