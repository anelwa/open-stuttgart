// MCP-Protokollkern: Versionen, JSON-RPC-Fehler, Header, Pagination und Ergebnisform.
// Unterstützt zwei Generationen des Protokolls:
//   - modern  ab 2026-07-28: zustandslos, Version und Client-Infos je Anfrage in `_meta`
//   - legacy  bis 2025-11-25: initialize-Handshake, Sitzung, GET-SSE
// Die Quelle der Wahrheit ist die Spezifikation; hier stehen nur die Teile, die der Server braucht.
import { createHash } from 'node:crypto';

export const SERVER_NAME = 'open-stuttgart';
export const SERVER_VERSION = '1.0.0';
export const SERVER_TITLE = 'Open Stuttgart';

/** Neueste Fassung, die dieser Server spricht. */
export const MODERN_VERSION = '2026-07-28';

/** Alle Fassungen, die der Server bedient – modern zuerst, dann absteigend die Legacy-Fassungen. */
export const SUPPORTED_VERSIONS = [
  MODERN_VERSION,
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
];

export const LEGACY_VERSIONS = SUPPORTED_VERSIONS.filter((v) => v !== MODERN_VERSION);

export const ERROR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  UNSUPPORTED_VERSION: -32022,
  HEADER_MISMATCH: -32020,
  RATE_LIMITED: -32000,
  TOO_LARGE: -32001,
};

/** ISO-Versionen sind lexikografisch sortierbar; das reicht für den Epochenvergleich. */
export const isModernVersion = (version) => String(version ?? '') >= MODERN_VERSION;
export const isSupportedVersion = (version) => SUPPORTED_VERSIONS.includes(String(version ?? ''));

export function negotiateLegacyVersion(requested) {
  return isSupportedVersion(requested) && requested !== MODERN_VERSION ? requested : '2025-11-25';
}

export function serverInfo() {
  return {
    name: SERVER_NAME,
    title: SERVER_TITLE,
    version: SERVER_VERSION,
    websiteUrl: 'https://open-stuttgart.de/',
  };
}

export function serverMeta() {
  return { 'io.modelcontextprotocol/serverInfo': serverInfo() };
}

export function legacyCapabilities() {
  return {
    tools: { listChanged: false },
    resources: { subscribe: false, listChanged: false },
    prompts: { listChanged: false },
    completions: {},
    logging: {},
  };
}

export function modernCapabilities() {
  return {
    tools: {},
    resources: {},
    prompts: {},
    completions: {},
  };
}

/** Instruktionen für das Modell. Kurz halten; die Details stehen in den Tool-Beschreibungen. */
export const INSTRUCTIONS = [
  'Open Stuttgart stellt offene Daten der Landeshauptstadt Stuttgart und der Region bereit – nur lesend.',
  'Jede Antwort enthält Quellen und, soweit verfügbar, einen Zeitstand. Zitiere die Quelle bei jeder Weitergabe.',
  'Erfinde keine Werte: Wenn ein Werkzeug keine Daten liefert, sage das und verweise auf die verlinkte Originalquelle.',
  'Termine, Preise und Öffnungszeiten sind Angaben ohne Gewähr; maßgeblich ist die verlinkte Quelle.',
  'Keine Buchungen, Anträge, Zahlungen oder Änderungen: Der Server kann ausschließlich lesen.',
  'Koordinaten nur verwenden, wenn der Aufrufer sie ausdrücklich übergibt. Keine Standortabfrage ohne Anlass.',
].join(' ');

// ---------------------------------------------------------------------------------------------
// JSON-RPC

export function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

export function rpcError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message: String(message ?? 'Fehler'), ...(data !== undefined ? { data } : {}) },
  };
}

export function isValidRequest(msg) {
  return Boolean(msg) && typeof msg === 'object' && !Array.isArray(msg)
    && msg.jsonrpc === '2.0' && typeof msg.method === 'string'
    && (msg.id === undefined || msg.id === null || typeof msg.id === 'string' || typeof msg.id === 'number');
}

export function isNotification(msg) {
  return isValidRequest(msg) && (msg.id === undefined || msg.id === null);
}

/** Moderne Ergebnisse tragen `resultType` und die Server-Identität in `_meta`. */
export function modernResult(result, { cacheTtlMs = null, cacheScope = null } = {}) {
  const out = { ...result, resultType: 'complete', _meta: { ...(result?._meta ?? {}), ...serverMeta() } };
  if (cacheTtlMs != null) out.ttlMs = cacheTtlMs;
  if (cacheScope != null) out.cacheScope = cacheScope;
  return out;
}

export function legacyResult(result) {
  return result;
}

// ---------------------------------------------------------------------------------------------
// Header

/** `=?base64?...?=`-Sentinel für Nicht-ASCII-Werte (MCP 2026-07-28, Value Encoding). */
export function decodeHeaderValue(value) {
  const s = String(value ?? '').trim();
  const m = /^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/.exec(s);
  if (!m) return s;
  try { return Buffer.from(m[1], 'base64').toString('utf8'); } catch { return s; }
}

export function headerValue(headers, name) {
  const v = headers?.[String(name).toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

/** Ermittelt die Epoche einer Anfrage. `server/discover` ist immer modern. */
export function eraOf(message, headers = {}) {
  if (message?.method === 'server/discover') return 'modern';
  if (message?.method === 'initialize') return 'legacy';
  const metaVersion = message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  const headerVersion = headerValue(headers, 'mcp-protocol-version');
  if (isModernVersion(metaVersion) || isModernVersion(headerVersion)) return 'modern';
  return 'legacy';
}

export function protocolVersionOf(message, headers = {}, era = 'legacy') {
  const metaVersion = message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  if (metaVersion) return String(metaVersion);
  const headerVersion = headerValue(headers, 'mcp-protocol-version');
  if (headerVersion) return String(headerVersion);
  return era === 'modern' ? MODERN_VERSION : '2025-06-18';
}

/**
 * Prüft die 2026-07-28-Pflichtheader. Gibt null zurück, wenn alles passt, sonst eine
 * HeaderMismatch-Meldung. Für Legacy-Anfragen wird die Funktion nicht aufgerufen.
 */
export function validateModernHeaders(message, headers = {}) {
  const bodyVersion = message?.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  const headerVersion = headerValue(headers, 'mcp-protocol-version');
  if (!headerVersion) {
    return 'Pflichtheader MCP-Protocol-Version fehlt.';
  }
  if (!bodyVersion) {
    return 'Pflichtfeld params._meta["io.modelcontextprotocol/protocolVersion"] fehlt.';
  }
  if (String(headerVersion) !== String(bodyVersion)) {
    return `HeaderMismatch: MCP-Protocol-Version „${headerVersion}“ passt nicht zu _meta „${bodyVersion}“.`;
  }
  const methodHeader = decodeHeaderValue(headerValue(headers, 'mcp-method'));
  if (!methodHeader) return 'Pflichtheader Mcp-Method fehlt.';
  if (methodHeader !== message.method) {
    return `HeaderMismatch: Mcp-Method „${methodHeader}“ passt nicht zur Methode „${message.method}“.`;
  }
  const nameRequired = ['tools/call', 'resources/read', 'prompts/get'].includes(message.method);
  if (nameRequired) {
    const expected = message.method === 'resources/read' ? message?.params?.uri : message?.params?.name;
    const nameHeader = decodeHeaderValue(headerValue(headers, 'mcp-name'));
    if (!nameHeader) return `Pflichtheader Mcp-Name für ${message.method} fehlt.`;
    if (nameHeader !== String(expected ?? '')) {
      return `HeaderMismatch: Mcp-Name „${nameHeader}“ passt nicht zu „${expected}“.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Pagination

export function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ o: Math.max(0, Number(offset) || 0) }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const d = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    const n = Number(d?.o);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    throw Object.assign(new Error('Ungültiger Cursor'), { code: ERROR.INVALID_PARAMS });
  }
}

export function paginate(items, cursor, pageSize = 100) {
  const offset = decodeCursor(cursor);
  const page = items.slice(offset, offset + pageSize);
  const next = offset + page.length < items.length ? encodeCursor(offset + page.length) : undefined;
  return { page, nextCursor: next };
}

// ---------------------------------------------------------------------------------------------
// Kleine Helfer

export function etagOf(value) {
  return `"${createHash('sha1').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16)}"`;
}

export const CACHE = {
  list: 300_000,
  staticResource: 3_600_000,
  liveResource: 30_000,
  prompt: 3_600_000,
};
