// Protokoll-Dispatcher: beantwortet JSON-RPC-Anfragen für moderne und Legacy-Clients.
// Der Dispatcher kennt keine HTTP-Details; Transporte liefern Kontext und Empfänger.
import {
  CACHE, ERROR, INSTRUCTIONS, LEGACY_VERSIONS, MODERN_VERSION, SUPPORTED_VERSIONS,
  isModernVersion, isValidRequest, legacyCapabilities, modernCapabilities, modernResult,
  negotiateLegacyVersion, paginate, rpcError, rpcResult, serverInfo, serverMeta,
} from './protocol.mjs';
import { McpError, applyDefaults, assertArguments, buildToolError, withTimeout } from './util.mjs';
import { executeTool } from './tools/shared.mjs';
import { resourceResult } from './resources.mjs';

const LOG_LEVELS = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
const LOG_RANK = Object.fromEntries(LOG_LEVELS.map((l, i) => [l, i]));

const COMPLETIONS = {
  'route-planen': { modus: ['oepnv', 'rad', 'auto', 'fuss'] },
  'abendplan': { szene: ['konzert', 'party', 'comedy', 'buehne', 'kneipe', 'hochschule', 'flohmarkt', 'popup', 'jugend'], publikum: ['alle', 'jung'] },
  'wochenendplan': { stadtbezirk: ['Mitte', 'West', 'Nord', 'Ost', 'Süd', 'Bad Cannstatt', 'Degerloch', 'Vaihingen', 'Möhringen', 'Feuerbach'] },
  'stadt-check': {},
  'verwaltungsweg': {},
  'datenquellen': {},
};

function abortPromise(signal) {
  if (!signal) return null;
  return new Promise((_, reject) => {
    if (signal.aborted) reject(new McpError('Anfrage abgebrochen.', { code: ERROR.INTERNAL, status: 499 }));
    signal.addEventListener('abort', () => reject(new McpError('Anfrage abgebrochen.', { code: ERROR.INTERNAL, status: 499 })), { once: true });
  });
}

export function createMcpServer({ catalog, rateLimiter = null, logger = console } = {}) {
  const emit = (ctx, notification) => {
    try { ctx?.emit?.(notification); } catch { /* Transport weg */ }
  };

  const log = (ctx, level, message, data) => {
    const want = ctx?.logLevel;
    if (!want || (LOG_RANK[level] ?? 9) < (LOG_RANK[want] ?? 9)) return;
    emit(ctx, {
      jsonrpc: '2.0',
      method: 'notifications/message',
      params: { level, logger: 'open-stuttgart', data: data === undefined ? message : { message, ...data } },
    });
  };

  const progress = (ctx) => (value, total, message) => {
    if (!ctx?.progressToken) return;
    emit(ctx, {
      jsonrpc: '2.0',
      method: 'notifications/progress',
      params: {
        progressToken: ctx.progressToken,
        progress: value,
        ...(Number.isFinite(total) ? { total } : {}),
        ...(message ? { message } : {}),
      },
    });
  };

  async function callTool(msg, ctx) {
    const name = String(msg?.params?.name ?? '');
    const tool = catalog.toolByName.get(name);
    if (!tool) throw new McpError(`Unbekanntes Werkzeug: ${name}`, { code: ERROR.INVALID_PARAMS, status: 404 });
    let args = msg?.params?.arguments ?? {};
    if (args === null || typeof args !== 'object' || Array.isArray(args)) {
      throw new McpError('arguments muss ein Objekt sein.', { code: ERROR.INVALID_PARAMS, status: 400 });
    }
    args = applyDefaults(tool.inputSchema, args);
    if (rateLimiter && ctx?.rateLimit !== false) {
      const r = rateLimiter.check(ctx.ip ?? 'unbekannt', tool.name, tool.cost ?? 1);
      if (!r.ok) {
        throw new McpError(`Zu viele Anfragen (${r.reason}). Bitte in ${r.retryAfter} s erneut versuchen.`, {
          code: ERROR.RATE_LIMITED,
          status: 429,
          data: { retryAfter: r.retryAfter },
        });
      }
    }
    assertArguments(tool.inputSchema, args);

    const toolCtx = {
      ...ctx,
      progress: progress(ctx),
      log: (level, message, data) => log(ctx, level, message, data),
    };
    log(ctx, 'info', `Werkzeug ${tool.name} gestartet`);
    const t0 = Date.now();
    let result;
    try {
      const run = Promise.resolve().then(() => executeTool(tool, args, toolCtx));
      const aborted = abortPromise(ctx?.signal);
      if (aborted) aborted.catch(() => {});
      result = await withTimeout(aborted ? Promise.race([run, aborted]) : run, tool.timeoutMs, tool.title);
      log(ctx, 'info', `Werkzeug ${tool.name} beendet (${Date.now() - t0} ms)`);
      return isModernVersion(ctx?.protocolVersion) ? modernResult(result) : result;
    } catch (err) {
      if (err instanceof McpError) throw err;
      const message = err?.isToolError ? err.message : `Werkzeug ${tool.name} fehlgeschlagen: ${err?.message ?? 'unbekannter Fehler'}`;
      log(ctx, 'error', message);
      return buildToolError(message);
    }
  }

  async function complete(msg, ctx) {
    const ref = msg?.params?.ref ?? {};
    const argument = msg?.params?.argument ?? {};
    const value = String(argument.value ?? '');
    let values = [];
    if (ref.type === 'ref/prompt') {
      values = COMPLETIONS[ref.name]?.[argument.name] ?? [];
    } else if (ref.type === 'ref/resource') {
      if (String(ref.uri ?? '').includes('layer')) {
        try {
          const { wfsKatalog } = await import('../sources/schnittstellen.mjs');
          const r = await wfsKatalog();
          values = r.layers.filter((l) => l.frei).map((l) => l.name);
        } catch { values = []; }
      }
    }
    if (value) values = values.filter((v) => v.toLowerCase().startsWith(value.toLowerCase()));
    values = [...new Set(values)].slice(0, 100);
    const result = { completion: { values, ...(values.length >= 100 ? { total: values.length, hasMore: true } : {}) } };
    return isModernVersion(ctx?.protocolVersion) ? modernResult(result) : result;
  }

  async function handle(msg, ctx = {}) {
    if (!isValidRequest(msg)) {
      throw new McpError('Ungültige JSON-RPC-Anfrage.', { code: ERROR.INVALID_REQUEST, status: 400 });
    }
    if ((msg.id === undefined || msg.id === null) && !String(msg.method).startsWith('notifications/')) {
      throw new McpError('Anfragen ohne id sind nur als notifications/* erlaubt.', { code: ERROR.INVALID_REQUEST, status: 400 });
    }
    const modern = isModernVersion(ctx.protocolVersion);
    const params = msg.params ?? {};
    switch (msg.method) {
      case 'initialize': {
        if (modern) throw new McpError('initialize ist in dieser Protokollversion nicht vorgesehen; nutze server/discover.', { code: ERROR.METHOD_NOT_FOUND, status: 404 });
        const requested = params.protocolVersion;
        const version = negotiateLegacyVersion(requested);
        return {
          protocolVersion: version,
          capabilities: legacyCapabilities(),
          serverInfo: serverInfo(),
          instructions: INSTRUCTIONS,
          ...(requested !== version ? { hinweis: `Angefragt war ${requested}; dieser Server spricht ${version}.` } : {}),
        };
      }
      case 'server/discover': {
        return modernResult({
          supportedVersions: SUPPORTED_VERSIONS,
          capabilities: modernCapabilities(),
          instructions: INSTRUCTIONS,
          ...(catalog.counts ? { counts: catalog.counts } : {}),
        }, { cacheTtlMs: CACHE.list, cacheScope: 'public' });
      }
      case 'ping':
        return {};
      case 'tools/list': {
        const { page, nextCursor } = paginate(catalog.tools, params.cursor, 100);
        const result = {
          tools: page.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: t.annotations,
          })),
          ...(nextCursor ? { nextCursor } : {}),
        };
        return modern ? modernResult(result, { cacheTtlMs: CACHE.list, cacheScope: 'public' }) : result;
      }
      case 'tools/call':
        return callTool(msg, ctx);
      case 'resources/list': {
        const { page, nextCursor } = paginate(catalog.resources, params.cursor, 100);
        const result = { resources: page, ...(nextCursor ? { nextCursor } : {}) };
        return modern ? modernResult(result, { cacheTtlMs: CACHE.list, cacheScope: 'public' }) : result;
      }
      case 'resources/templates/list': {
        const { page, nextCursor } = paginate(catalog.resourceTemplates, params.cursor, 100);
        const result = { resourceTemplates: page, ...(nextCursor ? { nextCursor } : {}) };
        return modern ? modernResult(result, { cacheTtlMs: CACHE.list, cacheScope: 'public' }) : result;
      }
      case 'resources/read': {
        const uri = String(params.uri ?? '');
        if (!uri) throw new McpError('uri fehlt.', { code: ERROR.INVALID_PARAMS, status: 400 });
        const out = await catalog.readResource(uri);
        return modern ? resourceResult(true, out) : resourceResult(false, out);
      }
      case 'resources/subscribe':
      case 'resources/unsubscribe':
        throw new McpError('Ressourcen-Abonnements werden nicht unterstützt; Ressourcen sind zwischengespeichert.', { code: ERROR.METHOD_NOT_FOUND, status: 404 });
      case 'prompts/list': {
        const { page, nextCursor } = paginate(catalog.prompts, params.cursor, 100);
        const result = {
          prompts: page.map((p) => ({
            name: p.name,
            title: p.title,
            description: p.description,
            arguments: p.arguments,
          })),
          ...(nextCursor ? { nextCursor } : {}),
        };
        return modern ? modernResult(result, { cacheTtlMs: CACHE.prompt, cacheScope: 'public' }) : result;
      }
      case 'prompts/get': {
        const name = String(params.name ?? '');
        const { getPrompt } = await import('./prompts.mjs');
        const out = getPrompt(name, params.arguments ?? {});
        if (!out) throw new McpError(`Unbekannter Prompt: ${name}`, { code: ERROR.INVALID_PARAMS, status: 404 });
        if (out.error) throw new McpError(out.error, { code: ERROR.INVALID_PARAMS, status: 400 });
        return modern ? modernResult(out) : out;
      }
      case 'completion/complete':
        return complete(msg, ctx);
      case 'logging/setLevel': {
        const level = String(params.level ?? '');
        if (!LOG_LEVELS.includes(level)) throw new McpError(`Unbekanntes Log-Level: ${level}`, { code: ERROR.INVALID_PARAMS, status: 400 });
        if (ctx.session) ctx.session.logLevel = level;
        return {};
      }
      case 'notifications/initialized':
      case 'notifications/roots/list_changed':
      case 'notifications/cancelled':
        if (msg.method === 'notifications/cancelled') ctx.cancel?.(params.requestId);
        return null;
      default:
        throw new McpError(`Methode nicht unterstützt: ${msg.method}`, { code: ERROR.METHOD_NOT_FOUND, status: 404 });
    }
  }

  return {
    handle,
    catalog,
    serverInfo,
    serverMeta,
    legacyVersions: LEGACY_VERSIONS,
    modernVersion: MODERN_VERSION,
  };
}

/** Für Transporte: eine Nachricht verarbeiten und in eine JSON-RPC-Antwort gießen. */
export async function dispatchRpc(server, msg, ctx = {}) {
  const id = msg?.id;
  const notification = id === undefined || id === null;
  try {
    const result = await server.handle(msg, ctx);
    if (notification || result === null) return null;
    return rpcResult(id, result);
  } catch (err) {
    if (notification) {
      if (process.env.OS_MCP_LOG === '1') console.error('MCP-Notification:', err?.message ?? err);
      return null;
    }
    const code = err instanceof McpError ? err.code : (Number.isFinite(err?.code) ? err.code : ERROR.INTERNAL);
    const message = err?.message ?? 'Interner Fehler';
    if (code === ERROR.INTERNAL) console.error('MCP:', err);
    return rpcError(id, code, message, err?.data);
  }
}
