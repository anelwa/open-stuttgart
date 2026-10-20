// API-Proxy und Auslieferung der gebauten Oberfläche. Keine Abhängigkeiten außer Node ≥ 20.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { departures, searchStops } from './sources/efa.mjs';
import { approaching, trip } from './sources/vehicles.mjs';
import { traffic } from './sources/traffic.mjs';
import { neueroeffnungen, news, orte, wasGeht, wasGehtPruefliste } from './sources/wasgeht.mjs';
import { puenktlichkeitJetzt, puenktlichkeitTage, startGtfsrt } from './sources/gtfsrt.mjs';
import { bahnHbf, bahnHistorie } from './sources/db.mjs';
import { ankuenfteHbf, anschluss } from './sources/anschluss.mjs';
import { radar } from './sources/radar.mjs';
import { kessel } from './sources/kessel.mjs';
import { parking } from './sources/parking.mjs';
import { sharing } from './sources/sharing.mjs';
import { roadworks, bikeRoutes } from './sources/roadworks.mjs';
import { air, weather, water } from './sources/environment.mjs';
import { events, places, wikiSummary } from './sources/culture.mjs';
import { profil } from './sources/adresse.mjs';
import { hitze } from './sources/hitze.mjs';
import { ortSuche, route } from './sources/routing.mjs';
import { aufzuege } from './sources/aufzuege.mjs';
import { bebauungsplaene, beteiligungen, wahlergebnisse } from './sources/beteiligung.mjs';
import { maengelUebergabe, partnerDaten, partnerStatus } from './sources/partner.mjs';
import { archivDatei, archivTage, startVerlauf } from './sources/verlauf.mjs';
import { abfall, adresse, baeder, buergerbueros, categories, facilities, gesundheit, laden, schulbezirk } from './sources/nearby.mjs';

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
  '/api/news': (q) => news({ topic: q.get('topic'), district: q.get('district') }),
  '/api/puenktlichkeit': () => puenktlichkeitJetzt(),
  '/api/puenktlichkeit/tage': (q) => puenktlichkeitTage(Math.min(31, Math.max(1, Number(q.get('n')) || 7))),
  '/api/bahn/hbf': () => bahnHbf(),
  '/api/bahn/historie': () => bahnHistorie(),
  '/api/anschluss/ankuenfte': () => ankuenfteHbf(),
  '/api/anschluss': (q) => anschluss(q.get('ankunft'), q.get('linie'), q.get('ziel')),
  '/api/parking': () => parking(),
  '/api/sharing': () => sharing(),
  '/api/roadworks': () => roadworks(),
  '/api/bikeroutes': () => bikeRoutes(),
  '/api/air': () => air(),
  '/api/weather': () => weather(),
  '/api/water': () => water(),
  '/api/events': (q) => events(q.get('date')),
  '/api/places': () => places(),
  '/api/wiki': (q) => wikiSummary(q.get('title')),
  '/api/radar': () => radar(),
  '/api/kessel': () => kessel(),
  '/api/nearby/categories': async () => categories(),
  '/api/nearby/facilities': (q) => facilities(q.get('cat')),
  '/api/nearby/buergerbueros': () => buergerbueros(),
  '/api/nearby/baeder': () => baeder(),
  '/api/nearby/abfall': (q) => abfall(q.get('street'), q.get('nr')),
  '/api/nearby/schulbezirk': (q) => schulbezirk(+q.get('lat'), +q.get('lon')),
  '/api/nearby/laden': (q) => laden(q.get('lat'), q.get('lon')),
  '/api/nearby/adresse': (q) => adresse(q.get('q')),
  '/api/adresse/profil': (q) => profil(+q.get('lat'), +q.get('lon'), q.get('street'), q.get('nr')),
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
  '/api/gesundheit': () => gesundheit(),
  '/api/health': async () => ({ ok: true, time: new Date().toISOString() }),
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};

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
