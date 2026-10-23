#!/usr/bin/env node
import '../env.mjs';
// Eigenständiger MCP-HTTP-Server (Streamable HTTP) auf Port 8788.
// Für die Einbettung in die bestehende App genügt /mcp in server/index.mjs;
// dieser Prozess ist für Clients gedacht, die nur den MCP-Endpunkt brauchen.
import http from 'node:http';
import { handleMcpHttp, closeMcp } from './index.mjs';
import { CATALOG } from './catalog.mjs';
import { MODERN_VERSION, SUPPORTED_VERSIONS } from './protocol.mjs';
import { startGtfsrt } from '../sources/gtfsrt.mjs';
import { startVerlauf } from '../sources/verlauf.mjs';
import { baeder, buergerbueros } from '../sources/nearby.mjs';

const PORT = Number(process.env.OS_MCP_PORT ?? 8788);
const HOST = process.env.OS_MCP_HOST ?? '127.0.0.1';
const LOG = process.env.OS_MCP_LOG === '1' || process.env.LOG === '1';

function clientIp(req) {
  if (process.env.OS_TRUST_PROXY === '1') {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress ?? 'unbekannt';
}

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      await handleMcpHttp(req, res, { ip: clientIp(req) });
    } else if (url.pathname === '/healthz' || url.pathname === '/health') {
      const body = JSON.stringify({
        ok: true,
        service: 'open-stuttgart-mcp',
        protocol: { modern: MODERN_VERSION, supported: SUPPORTED_VERSIONS },
        counts: CATALOG.counts,
        time: new Date().toISOString(),
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
    } else if (url.pathname === '/' || url.pathname === '') {
      const body = JSON.stringify({
        name: 'Open Stuttgart MCP',
        version: '1.0.0',
        endpoint: '/mcp',
        transports: ['Streamable HTTP'],
        health: '/healthz',
        tools: CATALOG.counts.tools,
        resources: CATALOG.counts.resources,
        prompts: CATALOG.counts.prompts,
        note: 'Read-only. Quelle und Lizenz an jeder Antwort. Dokumentation: docs/mcp.md.',
      }, null, 2);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unbekannter Pfad. Der MCP-Endpunkt ist /mcp.' }));
    }
  } catch (err) {
    console.error('MCP-HTTP:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Interner Fehler' } }));
    } else {
      try { res.end(); } catch { /* egal */ }
    }
  } finally {
    if (LOG) console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - t0} ms`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Open Stuttgart MCP läuft auf http://${HOST}:${PORT}/mcp`);
  console.log(`Werkzeuge: ${CATALOG.counts.tools}, Ressourcen: ${CATALOG.counts.resources}, Prompts: ${CATALOG.counts.prompts}`);
  if (process.env.OS_MCP !== '0' && process.env.OS_MCP_BACKGROUND !== '0') {
    startGtfsrt();
    startVerlauf({ baeder, buergerbueros });
  }
});

function shutdown(signal) {
  console.log(`\n${signal}: MCP-Server wird beendet …`);
  closeMcp();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
