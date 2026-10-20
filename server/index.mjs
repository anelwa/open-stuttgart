// API-Proxy und Auslieferung der gebauten Oberfläche. Keine Abhängigkeiten außer Node ≥ 20.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { departures, searchStops } from './sources/efa.mjs';
import { radar } from './sources/radar.mjs';
import { kessel } from './sources/kessel.mjs';
import { parking } from './sources/parking.mjs';
import { sharing } from './sources/sharing.mjs';
import { roadworks, bikeRoutes } from './sources/roadworks.mjs';
import { air, weather, water } from './sources/environment.mjs';
import { events, places, wikiSummary } from './sources/culture.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const routes = {
  '/api/departures': (q) => departures(q.get('stop'), q.get('at')),
  '/api/stops/search': (q) => searchStops(q.get('q')),
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
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"unbekannter Pfad"}');
    return;
  }
  serveStatic(res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Open Stuttgart läuft auf http://localhost:${PORT}`);
});
