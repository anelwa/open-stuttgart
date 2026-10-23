#!/usr/bin/env node
import '../env.mjs';
// stdio-Transport für MCP. Start: node server/mcp/stdio.mjs
// Auf stdout gehen ausschließlich JSON-RPC-Nachrichten (eine pro Zeile); Logs auf stderr.
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { CATALOG } from './catalog.mjs';
import { createMcpServer } from './server.mjs';
import { dispatchRpc } from './server.mjs';
import {
  ERROR, MODERN_VERSION, SUPPORTED_VERSIONS, eraOf, isModernVersion, isSupportedVersion,
  rpcError,
} from './protocol.mjs';

const LOG = process.env.OS_MCP_LOG === '1' || process.env.OS_MCP_LOG === 'true';

function stderr(...args) {
  if (LOG) process.stderr.write(`[open-stuttgart mcp] ${args.join(' ')}\n`);
}

export async function runStdio({ input = process.stdin, output = process.stdout, error = process.stderr } = {}) {
  const server = createMcpServer({ catalog: CATALOG, rateLimiter: null });
  const state = {
    protocolVersion: '2025-06-18',
    clientInfo: null,
    capabilities: null,
    logLevel: null,
    initialized: false,
  };

  const write = (message) => {
    if (!message) return;
    output.write(`${JSON.stringify(message)}\n`);
  };

  const emit = (message) => write(message);

  function contextFor(message, era) {
    const meta = message?.params?._meta ?? {};
    const modern = era === 'modern';
    return {
      era,
      protocolVersion: modern
        ? String(meta['io.modelcontextprotocol/protocolVersion'] ?? MODERN_VERSION)
        : state.protocolVersion,
      clientInfo: modern ? meta['io.modelcontextprotocol/clientInfo'] : state.clientInfo,
      capabilities: modern ? meta['io.modelcontextprotocol/clientCapabilities'] : state.capabilities,
      logLevel: modern ? meta['io.modelcontextprotocol/logLevel'] : state.logLevel,
      progressToken: meta.progressToken,
      ip: 'stdio',
      rateLimit: false,
      emit,
      cancel: () => {},
    };
  }

  async function handleOne(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      write(rpcError(null, ERROR.INVALID_REQUEST, 'JSON-RPC-Nachricht muss ein Objekt sein.'));
      return;
    }
    if ((message.id === undefined || message.id === null) && !String(message.method ?? '').startsWith('notifications/')) {
      write(rpcError(null, ERROR.INVALID_REQUEST, 'Anfragen ohne id sind nur als notifications/* erlaubt.'));
      return;
    }
    const era = eraOf(message, {});
    if (era === 'modern') {
      const version = message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'] ?? MODERN_VERSION;
      if (!isSupportedVersion(version) || !isModernVersion(version)) {
        write(rpcError(message.id ?? null, ERROR.UNSUPPORTED_VERSION, 'Nicht unterstützte Protokollversion.', {
          supported: SUPPORTED_VERSIONS,
          requested: version,
        }));
        return;
      }
    }
    const ctx = contextFor(message, era);
    const response = await dispatchRpc(server, message, ctx);
    if (message.method === 'initialize' && response?.result) {
      state.protocolVersion = response.result.protocolVersion;
      state.clientInfo = message.params?.clientInfo ?? null;
      state.capabilities = message.params?.capabilities ?? null;
      state.initialized = true;
    }
    if (message.method === 'logging/setLevel' && response?.result && message.params?.level) {
      state.logLevel = String(message.params.level);
    }
    if (message.id === undefined || message.id === null) return;
    write(response);
  }

  async function handleLine(line) {
    const text = line.trim();
    if (!text) return;
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      write(rpcError(null, ERROR.PARSE, 'Ungültiges JSON.'));
      return;
    }
    if (Array.isArray(body)) {
      if (!body.length) {
        write(rpcError(null, ERROR.INVALID_REQUEST, 'Leerer Batch.'));
        return;
      }
      const modern = body.some((m) => eraOf(m, {}) === 'modern');
      if (modern) {
        write(rpcError(null, ERROR.INVALID_REQUEST, 'JSON-RPC-Batching wird in dieser Protokollversion nicht unterstützt.'));
        return;
      }
      for (const message of body) await handleOne(message);
      return;
    }
    await handleOne(body);
  }

  const rl = createInterface({ input, crlfDelay: Infinity });
  let chain = Promise.resolve();
  rl.on('line', (line) => {
    chain = chain.then(() => handleLine(line)).catch((err) => {
      error.write(`[open-stuttgart mcp] ${err?.stack ?? err}\n`);
      write(rpcError(null, ERROR.INTERNAL, 'Interner Fehler.'));
    });
  });
  rl.on('close', () => {
    stderr('stdio geschlossen');
  });

  stderr(`bereit (${CATALOG.counts.tools} Werkzeuge, ${CATALOG.counts.resources} Ressourcen, ${CATALOG.counts.prompts} Prompts)`);
  return { server, state, close: () => rl.close() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (process.env.OS_MCP === '0') {
    process.stderr.write('Der MCP-Server ist abgeschaltet (OS_MCP=0).\n');
    process.exit(1);
  }
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`Open Stuttgart MCP (stdio)

Aufruf: node server/mcp/stdio.mjs
Umgebung:
  OS_MCP_LOG=1        Logs auf stderr
  OS_MCP=0            Server abschalten
  OS_SEARCH_DB=…      Pfad zur Suchdatenbank
  OS_GANCIO_URL=…     Offenes Veranstaltungsregister

Der Server ist read-only. Auf stdout gehen nur JSON-RPC-Nachrichten.
`);
    process.exit(0);
  }
  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write('open-stuttgart-mcp 1.0.0\n');
    process.exit(0);
  }
  runStdio().catch((err) => {
    process.stderr.write(`${err?.stack ?? err}\n`);
    process.exit(1);
  });
}
