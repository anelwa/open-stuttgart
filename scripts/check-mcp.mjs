// Rauchtest für den MCP-Server: Katalog, Legacy- und Modern-Protokoll, HTTP, SSE und stdio.
// Läuft ohne Netzwerkzugriff (nur lokale Werkzeuge) und ohne Schreibzugriffe auf Daten.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../server/mcp/catalog.mjs';
import { createMcpServer, dispatchRpc } from '../server/mcp/server.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODERN = '2026-07-28';
let pass = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    pass += 1;
    results.push(`  ✓ ${name}`);
  } catch (err) {
    results.push(`  ✗ ${name}\n    ${err?.stack ?? err}`);
    throw err;
  }
}

function modernHeaders(method, name) {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': MODERN,
    'mcp-method': method,
    ...(name ? { 'mcp-name': name } : {}),
  };
}

function modernParams(extra = {}) {
  return {
    ...extra,
    _meta: {
      'io.modelcontextprotocol/protocolVersion': MODERN,
      'io.modelcontextprotocol/clientCapabilities': {},
      'io.modelcontextprotocol/clientInfo': { name: 'check-mcp', version: '1.0.0' },
    },
  };
}

async function freePort() {
  const srv = net.createServer();
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const { port } = srv.address();
  await new Promise((resolve) => srv.close(resolve));
  return port;
}

async function waitFor(url, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* noch nicht bereit */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${url} wurde nicht erreichbar`);
}

async function main() {
  console.log('MCP-Rauchtest\n');

  await test('Katalog: 34 Werkzeuge, eindeutige Namen, read-only', () => {
    assert.equal(CATALOG.tools.length, 34);
    assert.equal(new Set(CATALOG.tools.map((t) => t.name)).size, CATALOG.tools.length);
    for (const t of CATALOG.tools) {
      assert.equal(t.annotations.readOnlyHint, true, `${t.name}: readOnlyHint`);
      assert.equal(t.inputSchema.type, 'object', `${t.name}: inputSchema`);
      assert.ok(t.description.length > 40, `${t.name}: Beschreibung zu kurz`);
    }
    assert.ok(CATALOG.resources.length >= 4);
    assert.ok(CATALOG.resourceTemplates.length >= 6);
    assert.equal(CATALOG.prompts.length, 6);
  });

  const server = createMcpServer({ catalog: CATALOG });
  const legacyCtx = { protocolVersion: '2025-06-18', era: 'legacy', ip: 'test', emit: () => {} };

  await test('Legacy: initialize, tools/list, about, search', async () => {
    const init = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    }, legacyCtx);
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'open-stuttgart');

    const list = await dispatchRpc(server, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, legacyCtx);
    assert.equal(list.result.tools.length, 34);

    const about = await dispatchRpc(server, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'about', arguments: {} } }, legacyCtx);
    assert.equal(about.result.isError, false);
    assert.equal(about.result.structuredContent.data.counts.tools, 34);

    const search = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'search_stuttgart', arguments: { q: 'Personalausweis', limit: 2 } },
    }, legacyCtx);
    assert.equal(search.result.isError, false);
    assert.ok(search.result.structuredContent.data.items.length <= 2);
  });

  await test('Legacy: Ressourcen, Prompts, Completion', async () => {
    const coverage = await dispatchRpc(server, { jsonrpc: '2.0', id: 5, method: 'resources/read', params: { uri: 'stuttgart://coverage' } }, legacyCtx);
    assert.ok(coverage.result.contents[0].text.includes('mobility'));
    const licenses = await dispatchRpc(server, { jsonrpc: '2.0', id: 6, method: 'resources/read', params: { uri: 'stuttgart://licenses' } }, legacyCtx);
    assert.ok(licenses.result.contents[0].text.includes('CC BY 4.0'));
    const prompts = await dispatchRpc(server, { jsonrpc: '2.0', id: 7, method: 'prompts/list', params: {} }, legacyCtx);
    assert.equal(prompts.result.prompts.length, 6);
    const prompt = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 8, method: 'prompts/get',
      params: { name: 'route-planen', arguments: { von: 'Marienplatz', nach: 'Hauptbahnhof' } },
    }, legacyCtx);
    assert.ok(prompt.result.messages[0].content.text.includes('plan_route'));
    const completion = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 9, method: 'completion/complete',
      params: { ref: { type: 'ref/prompt', name: 'route-planen' }, argument: { name: 'modus', value: 'r' } },
    }, legacyCtx);
    assert.deepEqual(completion.result.completion.values, ['rad']);
  });

  await test('Fehler: unbekanntes Werkzeug und ungültige Argumente', async () => {
    const unknown = await dispatchRpc(server, { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'gibts_nicht', arguments: {} } }, legacyCtx);
    assert.equal(unknown.error.code, -32602);
    const invalid = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 11, method: 'tools/call',
      params: { name: 'search_stuttgart', arguments: { limit: 999 } },
    }, legacyCtx);
    assert.equal(invalid.error.code, -32602);
    const toolError = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 12, method: 'tools/call',
      params: { name: 'get_document', arguments: { id: 99999999 } },
    }, legacyCtx);
    assert.equal(toolError.result.isError, true);
  });

  await test('Modern: discover, tools/list, call, Cache-Felder', async () => {
    const ctx = { protocolVersion: MODERN, era: 'modern', ip: 'test', emit: () => {} };
    const discover = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 20, method: 'server/discover',
      params: modernParams(),
    }, ctx);
    assert.equal(discover.result.resultType, 'complete');
    assert.ok(discover.result.supportedVersions.includes(MODERN));
    assert.equal(discover.result.cacheScope, 'public');

    const list = await dispatchRpc(server, { jsonrpc: '2.0', id: 21, method: 'tools/list', params: modernParams() }, ctx);
    assert.equal(list.result.resultType, 'complete');
    assert.equal(list.result.ttlMs, 300000);

    const call = await dispatchRpc(server, {
      jsonrpc: '2.0', id: 22, method: 'tools/call',
      params: modernParams({ name: 'about', arguments: {} }),
    }, ctx);
    assert.equal(call.result.resultType, 'complete');
    assert.ok(call.result._meta['io.modelcontextprotocol/serverInfo'].name);
  });

  const port = await freePort();
  const child = spawn(process.execPath, ['server/mcp/standalone.mjs'], {
    cwd: ROOT,
    env: { ...process.env, OS_MCP_PORT: String(port), OS_MCP_HOST: '127.0.0.1', OS_MCP_BACKGROUND: '0', OS_MCP_LOG: '0', OS_MCP_ORIGINS: '*' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childErr = '';
  child.stderr.on('data', (d) => { childErr += d; });
  const base = `http://127.0.0.1:${port}`;

  try {
    await waitFor(`${base}/healthz`);

    await test('HTTP: CORS-Preflight', async () => {
      const r = await fetch(`${base}/mcp`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://example.org', 'Access-Control-Request-Method': 'POST' },
      });
      assert.equal(r.status, 204);
      assert.equal(r.headers.get('access-control-allow-origin'), '*');
    });

    let session = null;
    await test('HTTP Legacy: initialize, Session, tools/call', async () => {
      const r = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 30, method: 'initialize',
          params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'http-test', version: '1' } },
        }),
      });
      assert.equal(r.status, 200);
      session = r.headers.get('mcp-session-id');
      assert.ok(session, 'Mcp-Session-Id fehlt');
      const body = await r.json();
      assert.equal(body.result.protocolVersion, '2025-06-18');

      const call = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-session-id': session },
        body: JSON.stringify({ jsonrpc: '2.0', id: 31, method: 'tools/call', params: { name: 'about', arguments: {} } }),
      });
      assert.equal(call.status, 200);
      const callBody = await call.json();
      assert.equal(callBody.result.isError, false);
    });

    await test('HTTP Legacy: GET-SSE und DELETE', async () => {
      const ac = new AbortController();
      const r = await fetch(`${base}/mcp`, {
        headers: { accept: 'text/event-stream', 'mcp-session-id': session },
        signal: ac.signal,
      });
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type') ?? '', /text\/event-stream/);
      const reader = r.body.getReader();
      const first = await reader.read();
      assert.match(new TextDecoder().decode(first.value), /open-stuttgart mcp/);
      ac.abort();

      const del = await fetch(`${base}/mcp`, { method: 'DELETE', headers: { 'mcp-session-id': session } });
      assert.equal(del.status, 204);
      const again = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-session-id': session },
        body: JSON.stringify({ jsonrpc: '2.0', id: 32, method: 'tools/list', params: {} }),
      });
      assert.equal(again.status, 404);
    });

    await test('HTTP Modern: discover, call, Header-Pflicht', async () => {
      const discover = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: modernHeaders('server/discover'),
        body: JSON.stringify({ jsonrpc: '2.0', id: 40, method: 'server/discover', params: modernParams() }),
      });
      assert.equal(discover.status, 200);
      const d = await discover.json();
      assert.equal(d.result.resultType, 'complete');

      const call = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: modernHeaders('tools/call', 'about'),
        body: JSON.stringify({ jsonrpc: '2.0', id: 41, method: 'tools/call', params: modernParams({ name: 'about', arguments: {} }) }),
      });
      assert.equal(call.status, 200);
      const c = await call.json();
      assert.equal(c.result.isError, false);

      const missing = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': MODERN, 'mcp-method': 'tools/call' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'tools/call', params: modernParams({ name: 'about', arguments: {} }) }),
      });
      assert.equal(missing.status, 400);
      const m = await missing.json();
      assert.equal(m.error.code, -32020);
    });

    await test('HTTP Modern: falsche Version', async () => {
      const r = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { ...modernHeaders('server/discover'), 'mcp-protocol-version': '1900-01-01' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 43, method: 'server/discover',
          params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01', 'io.modelcontextprotocol/clientCapabilities': {} } },
        }),
      });
      assert.equal(r.status, 400);
      const body = await r.json();
      assert.equal(body.error.code, -32022);
      assert.ok(body.error.data.supported.includes(MODERN));
    });
  } finally {
    child.kill('SIGTERM');
  }

  await test('stdio: initialize, tools/list, keine Fremdausgaben auf stdout', async () => {
    const proc = spawn(process.execPath, ['server/mcp/stdio.mjs'], {
      cwd: ROOT,
      env: { ...process.env, OS_MCP_LOG: '0' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = [];
    const rl = createInterface({ input: proc.stdout });
    rl.on('line', (line) => lines.push(line));
    const err = [];
    proc.stderr.on('data', (d) => err.push(d.toString()));
    proc.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0', id: 50, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'stdio-test', version: '1' } },
    })}\n`);
    proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 51, method: 'tools/list', params: {} })}\n`);
    proc.stdin.end();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('stdio-Test hängt')), 10_000);
      proc.on('exit', () => { clearTimeout(timer); resolve(); });
    });
    assert.ok(lines.length >= 2, `zu wenige Antworten: ${lines.length}; stderr: ${err.join('')}`);
    for (const line of lines) JSON.parse(line);
    const responses = lines.map((l) => JSON.parse(l));
    assert.equal(responses[0].result.serverInfo.name, 'open-stuttgart');
    assert.equal(responses[1].result.tools.length, 34);
    assert.equal(err.filter((e) => /error/i.test(e)).length, 0);
    if (childErr) process.stderr.write(childErr);
  });

  console.log(`${results.join('\n')}\n`);
  console.log(`${pass} Tests erfolgreich.`);
}

main().catch((err) => {
  console.error(results.join('\n'));
  console.error(err?.stack ?? err);
  process.exit(1);
});
