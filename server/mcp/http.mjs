// Streamable-HTTP-Transport für MCP – dual-era:
//   modern  (2026-07-28): zustandslos, Pflichtheader, server/discover, keine Sitzung
//   legacy  (bis 2025-11-25): initialize, Mcp-Session-Id, GET-SSE, DELETE
// Der Transport prüft Origin, Größe, Header und Rate-Limit und delegiert an den Dispatcher.
import { SessionStore } from './sessions.mjs';
import { dispatchRpc } from './server.mjs';
import {
  ERROR, MODERN_VERSION, SUPPORTED_VERSIONS,
  eraOf, headerValue, isModernVersion, isSupportedVersion,
  protocolVersionOf, rpcError, validateModernHeaders,
} from './protocol.mjs';

const BODY_LIMIT = Math.max(1024, Number(process.env.OS_MCP_MAX_BODY ?? 262_144) || 262_144);

function parseOrigins(value) {
  const raw = String(value ?? '*').trim();
  if (!raw || raw === '*') return { all: true, list: [] };
  return { all: false, list: raw.split(',').map((s) => s.trim()).filter(Boolean) };
}

const ACCEPT_JSON = 'application/json';
const ACCEPT_SSE = 'text/event-stream';

function accepts(req, type) {
  return String(req.headers.accept ?? '').toLowerCase().includes(type);
}

function wantsSse(req) {
  return accepts(req, ACCEPT_SSE) && !accepts(req, ACCEPT_JSON);
}

function originAllowed(origins, origin) {
  if (!origin) return true;
  if (origins.all || origins.list.includes('*')) return true;
  try {
    const u = new URL(origin);
    return origins.list.includes(origin) || origins.list.includes(u.host) || origins.list.includes(u.hostname);
  } catch {
    return false;
  }
}

function rpcStatus(error) {
  if (!error) return 200;
  switch (error.code) {
    case ERROR.HEADER_MISMATCH:
    case ERROR.UNSUPPORTED_VERSION:
    case ERROR.PARSE:
    case ERROR.INVALID_REQUEST:
      return 400;
    case ERROR.METHOD_NOT_FOUND:
      return 404;
    case ERROR.RATE_LIMITED:
      return 429;
    case ERROR.TOO_LARGE:
      return 413;
    default:
      return 200;
  }
}

export function createHttpTransport({
  server,
  rateLimiter = null,
  sessions = new SessionStore(),
  origins = parseOrigins(process.env.OS_MCP_ORIGINS ?? '*'),
  legacySse = process.env.OS_MCP_LEGACY_SSE !== '0',
} = {}) {
  const enabled = process.env.OS_MCP !== '0';

  function corsHeaders(req) {
    const origin = req.headers.origin;
    const allowOrigin = origins.all ? '*' : (origin && originAllowed(origins, origin) ? origin : null);
    return {
      ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {}),
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Last-Event-ID',
      'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version',
    };
  }

  function send(res, req, status, payload, extra = {}) {
    const headers = { ...corsHeaders(req), 'Cache-Control': 'no-store', ...extra };
    if (payload !== undefined) {
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Content-Length'] = Buffer.byteLength(body);
      res.writeHead(status, headers);
      res.end(body);
    } else {
      res.writeHead(status, headers);
      res.end();
    }
  }

  function sendRpcError(res, req, status, id, code, message, data) {
    send(res, req, status, rpcError(id, code, message, data));
  }

  async function readBody(req) {
    const len = Number(req.headers['content-length']);
    if (Number.isFinite(len) && len > BODY_LIMIT) {
      throw Object.assign(new Error('Anfrage zu groß'), { status: 413, code: ERROR.TOO_LARGE });
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > BODY_LIMIT) throw Object.assign(new Error('Anfrage zu groß'), { status: 413, code: ERROR.TOO_LARGE });
      chunks.push(chunk);
    }
    if (!chunks.length) return null;
    return Buffer.concat(chunks).toString('utf8');
  }

  function openSse(res, req, extra = {}) {
    res.writeHead(200, {
      ...corsHeaders(req),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...extra,
    });
    res.write(': open-stuttgart mcp\n\n');
    const write = (message) => {
      if (res.writableEnded) return;
      res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
    };
    return write;
  }

  function contextFor(message, req, ip, { session = null, era = 'legacy', sse = null, controller = null } = {}) {
    const meta = message?.params?._meta ?? {};
    const modern = era === 'modern';
    return {
      era,
      protocolVersion: modern
        ? String(meta['io.modelcontextprotocol/protocolVersion'] ?? MODERN_VERSION)
        : (session?.protocolVersion ?? protocolVersionOf(message, req.headers, 'legacy')),
      clientInfo: modern ? meta['io.modelcontextprotocol/clientInfo'] : session?.clientInfo,
      capabilities: modern ? meta['io.modelcontextprotocol/clientCapabilities'] : session?.capabilities,
      logLevel: modern ? meta['io.modelcontextprotocol/logLevel'] : session?.logLevel,
      progressToken: meta.progressToken,
      ip,
      session,
      signal: controller?.signal,
      rateLimit: true,
      emit: (notification) => {
        if (sse) sse(notification);
        else if (session) sessions.broadcast(session, notification);
      },
      cancel: (id) => { /* Abbruch erfolgt über den geschlossenen SSE-Strom. */ },
    };
  }

  function validateModern(message, headers) {
    const mismatch = validateModernHeaders(message, headers);
    if (mismatch) {
      return { status: 400, id: message?.id ?? null, code: ERROR.HEADER_MISMATCH, message: mismatch };
    }
    const version = protocolVersionOf(message, headers, 'modern');
    if (!isSupportedVersion(version)) {
      return {
        status: 400,
        id: message?.id ?? null,
        code: ERROR.UNSUPPORTED_VERSION,
        message: 'Nicht unterstützte Protokollversion.',
        data: { supported: SUPPORTED_VERSIONS, requested: version },
      };
    }
    if (!isModernVersion(version)) {
      return { status: 400, id: message?.id ?? null, code: ERROR.HEADER_MISMATCH, message: 'MCP-Protocol-Version ist keine moderne Fassung.' };
    }
    return null;
  }

  async function handleModern(message, req, res, ip) {
    const isNotification = message.id === undefined || message.id === null;
    if (isNotification) {
      await dispatchRpc(server, message, contextFor(message, req, ip, { era: 'modern' }));
      return send(res, req, 202);
    }
    const invalid = validateModern(message, req.headers);
    if (invalid) {
      return sendRpcError(res, req, invalid.status, invalid.id, invalid.code, invalid.message, invalid.data);
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());

    if (message.method === 'subscriptions/listen') {
      return handleListen(message, req, res, controller);
    }

    const id = message.id;
    const meta = message.params?._meta ?? {};
    const progressToken = meta.progressToken;
    const sseWanted = progressToken !== undefined && accepts(req, ACCEPT_SSE);
    let sse = null;
    if (sseWanted) sse = openSse(res, req, { 'MCP-Protocol-Version': MODERN_VERSION });
    const ctx = contextFor(message, req, ip, { era: 'modern', controller, sse });
    const response = await dispatchRpc(server, message, ctx);
    if (sse) {
      if (response) sse(response);
      res.end();
      return;
    }
    const status = response?.error ? rpcStatus(response.error) : 200;
    const headers = {
      'MCP-Protocol-Version': MODERN_VERSION,
      ...(status === 429 && response?.error?.data?.retryAfter ? { 'Retry-After': String(response.error.data.retryAfter) } : {}),
    };
    return send(res, req, status, response, headers);
  }

  function handleListen(message, req, res, controller) {
    const filter = message?.params?.notifications ?? {};
    const subscriptionId = message?.id ?? 'subscription';
    const sse = openSse(res, req, { 'MCP-Protocol-Version': MODERN_VERSION });
    const supported = {
      toolsListChanged: false,
      promptsListChanged: false,
      resourcesListChanged: false,
      resourceSubscriptions: [],
    };
    sse({
      jsonrpc: '2.0',
      method: 'notifications/subscriptions/acknowledged',
      params: {
        _meta: { 'io.modelcontextprotocol/subscriptionId': subscriptionId },
        notifications: {
          ...supported,
          ...(filter?.toolsListChanged === true ? { toolsListChanged: false } : {}),
        },
      },
    });
    const timer = setInterval(() => {
      if (res.writableEnded) return;
      res.write(': keepalive\n\n');
    }, 25_000);
    timer.unref?.();
    const close = () => {
      clearInterval(timer);
      controller.abort();
      if (!res.writableEnded) res.end();
    };
    req.on('close', close);
    res.on('close', () => clearInterval(timer));
    return undefined;
  }

  async function handleLegacy(message, req, res, ip) {
    const headerSession = headerValue(req.headers, 'mcp-session-id');
    let session = headerSession ? sessions.get(headerSession) : null;
    if (headerSession && !session) {
      return sendRpcError(res, req, 404, message?.id ?? null, ERROR.INVALID_REQUEST, 'Unbekannte oder abgelaufene Sitzung. Bitte neu initialisieren.');
    }

    const controller = new AbortController();
    req.on('close', () => controller.abort());
    const sseWanted = wantsSse(req) && session;
    let sse = null;
    if (sseWanted) sse = openSse(res, req, { 'MCP-Protocol-Version': MODERN_VERSION });
    const ctx = contextFor(message, req, ip, { era: 'legacy', session, controller, sse });
    const response = await dispatchRpc(server, message, ctx);

    if (message.method === 'initialize' && response?.result) {
      if (!session) session = sessions.create({
        protocolVersion: response.result.protocolVersion,
        clientInfo: message.params?.clientInfo ?? null,
        capabilities: message.params?.capabilities ?? null,
      });
      else {
        session.protocolVersion = response.result.protocolVersion;
        session.clientInfo = message.params?.clientInfo ?? session.clientInfo;
        session.capabilities = message.params?.capabilities ?? session.capabilities;
        session.lastSeen = Date.now();
      }
    }

    const isNotification = message.id === undefined || message.id === null;
    if (isNotification) return send(res, req, 202);

    const headers = {
      'MCP-Protocol-Version': session?.protocolVersion ?? protocolVersionOf(message, req.headers, 'legacy'),
      ...(session && message.method === 'initialize' ? { 'Mcp-Session-Id': session.id } : {}),
    };
    if (sse) {
      if (response) sse(response);
      res.end();
      return;
    }
    const status = response?.error ? rpcStatus(response.error) : 200;
    return send(res, req, status, response, {
      ...headers,
      ...(status === 429 && response?.error?.data?.retryAfter ? { 'Retry-After': String(response.error.data.retryAfter) } : {}),
    });
  }

  async function handleBatch(messages, req, res, ip) {
    const modern = messages.some((m) => eraOf(m, req.headers) === 'modern');
    if (modern) {
      return sendRpcError(res, req, 400, null, ERROR.INVALID_REQUEST, 'JSON-RPC-Batching wird in dieser Protokollversion nicht unterstützt.');
    }
    const headerSession = headerValue(req.headers, 'mcp-session-id');
    const session = headerSession ? sessions.get(headerSession) : null;
    if (headerSession && !session) {
      return sendRpcError(res, req, 404, null, ERROR.INVALID_REQUEST, 'Unbekannte oder abgelaufene Sitzung.');
    }
    const controller = new AbortController();
    req.on('close', () => controller.abort());
    const ctx = contextFor({}, req, ip, { era: 'legacy', session, controller });
    const out = [];
    for (const message of messages) {
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        out.push(rpcError(null, ERROR.INVALID_REQUEST, 'Ungültige Nachricht im Batch.'));
        continue;
      }
      if ((message.id === undefined || message.id === null) && !String(message.method ?? '').startsWith('notifications/')) {
        out.push(rpcError(null, ERROR.INVALID_REQUEST, 'Anfragen ohne id sind nur als notifications/* erlaubt.'));
        continue;
      }
      const response = await dispatchRpc(server, message, ctx);
      if (response) out.push(response);
    }
    if (!out.length) return send(res, req, 202);
    return send(res, req, 200, out, {
      'MCP-Protocol-Version': session?.protocolVersion ?? protocolVersionOf({}, req.headers, 'legacy'),
    });
  }

  async function handleInner(req, res, { ip = req.socket.remoteAddress ?? 'unbekannt' } = {}) {
    if (!enabled) {
      return send(res, req, 503, { error: 'Der MCP-Server ist in dieser Instanz abgeschaltet (OS_MCP=0).' });
    }
    if (!originAllowed(origins, req.headers.origin)) {
      return sendRpcError(res, req, 403, null, ERROR.INVALID_REQUEST, 'Origin nicht erlaubt.');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req));
      return res.end();
    }

    if (req.method === 'POST') {
      const type = String(req.headers['content-type'] ?? '').toLowerCase();
      if (type && !type.includes('application/json')) {
        return sendRpcError(res, req, 415, null, ERROR.INVALID_REQUEST, 'Content-Type muss application/json sein.');
      }
      let raw;
      try {
        raw = await readBody(req);
      } catch (err) {
        return sendRpcError(res, req, err.status ?? 400, null, err.code ?? ERROR.INVALID_REQUEST, err.message);
      }
      if (raw === null || !raw.trim()) {
        return sendRpcError(res, req, 400, null, ERROR.PARSE, 'Leerer Request-Body.');
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return sendRpcError(res, req, 400, null, ERROR.PARSE, 'Ungültiges JSON.');
      }
      if (rateLimiter) {
        const r = rateLimiter.check(ip, 'mcp-request', 1);
        if (!r.ok) {
          return send(res, req, 429, rpcError(body?.id ?? null, ERROR.RATE_LIMITED, `Zu viele Anfragen. Bitte in ${r.retryAfter} s erneut versuchen.`, { retryAfter: r.retryAfter }), { 'Retry-After': String(r.retryAfter) });
        }
      }
      if (Array.isArray(body)) {
        if (!body.length) return sendRpcError(res, req, 400, null, ERROR.INVALID_REQUEST, 'Leerer Batch.');
        return handleBatch(body, req, res, ip);
      }
      if (!body || typeof body !== 'object') {
        return sendRpcError(res, req, 400, null, ERROR.INVALID_REQUEST, 'JSON-RPC-Nachricht muss ein Objekt sein.');
      }
      if ((body.id === undefined || body.id === null) && !String(body.method ?? '').startsWith('notifications/')) {
        return sendRpcError(res, req, 400, body.id ?? null, ERROR.INVALID_REQUEST, 'Anfragen ohne id sind nur als notifications/* erlaubt.');
      }
      const era = eraOf(body, req.headers);
      if (era === 'modern') return handleModern(body, req, res, ip);
      return handleLegacy(body, req, res, ip);
    }

    if (req.method === 'GET') {
      if (isModernVersion(headerValue(req.headers, 'mcp-protocol-version'))) {
        return send(res, req, 405, rpcError(null, ERROR.METHOD_NOT_FOUND, 'GET ist in der modernen Protokollversion nicht vorgesehen.'), { Allow: 'POST, OPTIONS' });
      }
      if (!legacySse) return send(res, req, 405, rpcError(null, ERROR.METHOD_NOT_FOUND, 'GET wird in dieser Protokollversion nicht unterstützt.'), { Allow: 'POST, DELETE, OPTIONS' });
      if (!accepts(req, ACCEPT_SSE)) return sendRpcError(res, req, 406, null, ERROR.INVALID_REQUEST, 'GET benötigt Accept: text/event-stream.');
      const id = headerValue(req.headers, 'mcp-session-id');
      const session = sessions.get(id);
      if (!session) return sendRpcError(res, req, 400, null, ERROR.INVALID_REQUEST, 'GET benötigt eine gültige Mcp-Session-Id aus initialize.');
      const sse = openSse(res, req, { 'Mcp-Session-Id': session.id, 'MCP-Protocol-Version': session.protocolVersion });
      session.streams.add(res);
      sessions.replay(session, headerValue(req.headers, 'last-event-id'), res);
      const timer = setInterval(() => {
        if (res.writableEnded) return;
        res.write(': keepalive\n\n');
      }, 25_000);
      timer.unref?.();
      const cleanup = () => {
        clearInterval(timer);
        session.streams.delete(res);
        if (!res.writableEnded) res.end();
      };
      req.on('close', cleanup);
      res.on('close', cleanup);
      return undefined;
    }

    if (req.method === 'DELETE') {
      if (isModernVersion(headerValue(req.headers, 'mcp-protocol-version'))) {
        return send(res, req, 405, rpcError(null, ERROR.METHOD_NOT_FOUND, 'DELETE ist in der modernen Protokollversion nicht vorgesehen.'), { Allow: 'POST, OPTIONS' });
      }
      const id = headerValue(req.headers, 'mcp-session-id');
      if (!id) return sendRpcError(res, req, 400, null, ERROR.INVALID_REQUEST, 'Mcp-Session-Id fehlt.');
      const ok = sessions.delete(id);
      if (!ok) return sendRpcError(res, req, 404, null, ERROR.INVALID_REQUEST, 'Sitzung nicht gefunden.');
      return send(res, req, 204);
    }

    return send(res, req, 405, rpcError(null, ERROR.METHOD_NOT_FOUND, 'Methode nicht erlaubt.'), { Allow: 'POST, GET, DELETE, OPTIONS' });
  }

  async function handle(req, res, options = {}) {
    try {
      return await handleInner(req, res, options);
    } catch (err) {
      console.error('MCP-HTTP:', err);
      if (!res.headersSent) {
        return sendRpcError(res, req, err?.status ?? 500, null, err?.code ?? ERROR.INTERNAL, err?.message ?? 'Interner Fehler');
      }
      try { res.end(); } catch { /* egal */ }
    }
  }

  return { handle, sessions, origins, legacySse, close: () => sessions.close() };
}
