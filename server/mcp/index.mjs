import '../env.mjs';
// Einstiegspunkt für den MCP-Server: ein Katalog, zwei Transporte.
// Der HTTP-Transport hängt am bestehenden Node-Server unter /mcp; stdio startet
// über `node server/mcp/stdio.mjs` oder `npx open-stuttgart-mcp`.
import { CATALOG } from './catalog.mjs';
import { createMcpServer } from './server.mjs';
import { createHttpTransport } from './http.mjs';
import { RateLimiter } from './util.mjs';

let runtime = null;

export function getRuntime() {
  if (runtime) return runtime;
  const perMinute = Number(process.env.OS_MCP_RATE ?? 120);
  const heavyPerMinute = Number(process.env.OS_MCP_HEAVY_RATE ?? 20);
  const rateLimiter = new RateLimiter({ perMinute, heavyPerMinute });
  const server = createMcpServer({ catalog: CATALOG, rateLimiter });
  const http = createHttpTransport({ server, rateLimiter });
  runtime = { server, http, catalog: CATALOG, rateLimiter };
  return runtime;
}

export async function handleMcpHttp(req, res, options = {}) {
  return getRuntime().http.handle(req, res, options);
}

export function closeMcp() {
  runtime?.http?.close?.();
  runtime = null;
}

export { CATALOG } from './catalog.mjs';
export { createMcpServer } from './server.mjs';
