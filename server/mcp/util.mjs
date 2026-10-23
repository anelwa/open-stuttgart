// Gemeinsame Helfer für den MCP-Server: Argumentprüfung, Fristen, Ergebnisform,
// Entfernungen und ein kleiner Tarif-Limiter pro IP und Werkzeug.
import { ERROR } from './protocol.mjs';

export class McpError extends Error {
  constructor(message, { code = ERROR.INTERNAL, status = 500, data } = {}) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

/** Fehler, die dem Aufrufer als Werkzeugfehler (isError) statt als JSON-RPC-Fehler gezeigt werden. */
export const toolError = (message, extra = {}) => Object.assign(new Error(String(message)), { isToolError: true, ...extra });

// ---------------------------------------------------------------------------------------------
// JSON-Schema-Prüfung (bewusst klein: die Schemata des Servers nutzen nur einen Ausschnitt)

const TYPE_CHECKS = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
};

export function validateArguments(schema, value, path = 'arguments') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      if (!schema.type.some((t) => TYPE_CHECKS[t]?.(value))) {
        errors.push(`${path} muss vom Typ ${schema.type.join(' oder ')} sein`);
        return errors;
      }
    } else {
      const check = TYPE_CHECKS[schema.type];
      if (check && !check(value)) {
        errors.push(`${path} muss vom Typ ${schema.type} sein`);
        return errors;
      }
    }
  }
  if (schema.enum && !schema.enum.some((x) => Object.is(x, value))) {
    errors.push(`${path} muss einer dieser Werte sein: ${schema.enum.join(', ')}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path} ist zu kurz (min. ${schema.minLength})`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${path} ist zu lang (max. ${schema.maxLength})`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${path} muss mindestens ${schema.minimum} sein`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${path} darf höchstens ${schema.maximum} sein`);
  }
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (value[key] === undefined || value[key] === null || value[key] === '') errors.push(`Pflichtfeld ${path}.${key} fehlt`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (value[key] === undefined || value[key] === null) continue;
      errors.push(...validateArguments(sub, value[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!known.has(key) && !key.startsWith('_')) errors.push(`Unbekanntes Feld ${path}.${key}`);
      }
    }
  }
  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.slice(0, 20).forEach((item, i) => errors.push(...validateArguments(schema.items, item, `${path}[${i}]`)));
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path} darf höchstens ${schema.maxItems} Einträge haben`);
  }
  return errors;
}

export function assertArguments(schema, args) {
  const errors = validateArguments(schema, args);
  if (errors.length) throw new McpError(errors.slice(0, 3).join('; '), { code: ERROR.INVALID_PARAMS, status: 400 });
}

/**
 * Setzt die im JSON-Schema hinterlegten Standardwerte für fehlende Eigenschaften.
 * Die Handler bleiben dadurch kurz und verhalten sich wie in der Beschreibung.
 */
export function applyDefaults(schema, value) {
  if (!schema || schema.type !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = { ...value };
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    if (out[key] === undefined && sub && Object.prototype.hasOwnProperty.call(sub, 'default')) {
      out[key] = sub.default;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Fristen

export async function withTimeout(promise, ms, label = 'Abruf') {
  if (!ms || ms <= 0) return promise;
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(toolError(`${label} hat nach ${Math.round(ms / 1000)} s nicht geantwortet. Bitte später erneut versuchen oder enger filtern.`)), ms);
        timer.unref?.();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------------------------
// Ergebnisse

const MAX_TEXT = 120_000;
const MAX_STRUCTURED_BYTES = 600_000;

function byteLength(value) {
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); } catch { return Infinity; }
}

/**
 * Einheitliches Werkzeugergebnis: strukturierte Daten plus Quellen und Grenzen.
 * Der Text ist dieselbe Struktur in JSON, gekürzt, damit kein Kontextfenster überläuft.
 */
export function buildToolResult({ data, sources = [], limits = [], hint = null, text = null }) {
  const payload = {
    data,
    sources: dedupeSources(sources),
    limits: [...new Set(limits.filter(Boolean).map(String))],
    ...(hint ? { hint } : {}),
    fetchedAt: new Date().toISOString(),
  };
  if (byteLength(payload) > MAX_STRUCTURED_BYTES) {
    const small = {
      ...payload,
      data: {
        gekuerzt: true,
        grund: 'Die Antwort ist für eine einzelne Werkzeugantwort zu groß.',
        hinweis: 'Mit engerem Filter, kleinerem Radius oder niedrigerem limit erneut aufrufen.',
        groesseBytes: byteLength(payload),
      },
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(small, null, 2) }],
      structuredContent: small,
      isError: false,
    };
  }
  let body = text ?? JSON.stringify(payload, null, 2);
  if (body.length > MAX_TEXT) {
    body = `${body.slice(0, MAX_TEXT)}\n… (Text gekürzt; die strukturierte Antwort enthält den vollständigen Stand bis zur Größenobergrenze)`;
  }
  return {
    content: [{ type: 'text', text: body }],
    structuredContent: payload,
    isError: false,
  };
}

export function buildToolError(message, { hint = null } = {}) {
  const text = [String(message), hint].filter(Boolean).join(' ');
  return { content: [{ type: 'text', text }], isError: true };
}

export function dedupeSources(sources) {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    if (!s) continue;
    const norm = typeof s === 'string' ? { name: s } : { ...s };
    const key = `${norm.name ?? ''}|${norm.url ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

/** Zieht eine Quellenangabe aus dem `source`-Feld eines Datenobjekts. */
export function sourcesFrom(data, staticSources = []) {
  const out = [...staticSources];
  if (Array.isArray(data?.sources)) out.push(...data.sources);
  if (typeof data?.source === 'string') out.push({ name: data.source });
  if (typeof data?.quelle === 'string') out.push({ name: data.quelle });
  return dedupeSources(out);
}

// ---------------------------------------------------------------------------------------------
// Geo

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export function isCoord(lat, lon) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
    && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
}

export function requireCoord(lat, lon) {
  if (!isCoord(lat, lon)) throw toolError('lat und lon müssen gültige Koordinaten sein.');
  return { lat: Number(lat), lon: Number(lon) };
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n)));
}

/** ISO-Zeit akzeptieren und in die Berliner Zeitzone normalisieren. */
export function isoDateTime(value) {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(+d)) throw toolError('zeit muss ein gültiges ISO-8601-Datum sein, z. B. 2026-10-24T19:30:00+02:00.');
  return d.toISOString();
}

export function todayBerlin(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);
}

// ---------------------------------------------------------------------------------------------
// Ratenbegrenzung

const WINDOW = 60_000;

/**
 * Gewichteter Limiter: normale Werkzeuge zählen 1, teure 3, sehr teure 6.
 * Zusätzlich je Werkzeug ein eigenes Budget, damit ein einzelnes teures Werkzeug
 * nicht das Gesamtbudget einer IP auffrisst.
 */
export class RateLimiter {
  constructor({ perMinute = 120, heavyPerMinute = 20 } = {}) {
    this.perMinute = Math.max(0, Number(perMinute) || 0);
    this.heavyPerMinute = Math.max(0, Number(heavyPerMinute) || 0);
    this.hits = new Map(); // ip -> { at, weight, tools: Map }
  }

  check(ip, tool, cost = 1) {
    if (!this.perMinute && !this.heavyPerMinute) return { ok: true };
    const now = Date.now();
    const key = String(ip ?? 'unbekannt');
    let entry = this.hits.get(key);
    if (!entry || now - entry.at >= WINDOW) {
      entry = { at: now, weight: 0, tools: new Map() };
      this.hits.set(key, entry);
    }
    const weight = Math.max(1, Number(cost) || 1);
    const heavy = weight >= 3;
    if (this.perMinute && entry.weight + weight > this.perMinute) {
      return { ok: false, retryAfter: Math.ceil((WINDOW - (now - entry.at)) / 1000), reason: 'IP-Limit' };
    }
    if (heavy && this.heavyPerMinute) {
      const t = entry.tools.get(tool) ?? { at: now, n: 0 };
      if (now - t.at >= WINDOW) { t.at = now; t.n = 0; }
      if (t.n + 1 > this.heavyPerMinute) {
        return { ok: false, retryAfter: Math.ceil((WINDOW - (now - t.at)) / 1000), reason: `Limit für ${tool}` };
      }
      t.n += 1;
      entry.tools.set(tool, t);
    }
    entry.weight += weight;
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (now - v.at >= WINDOW) this.hits.delete(k);
    }
    return { ok: true };
  }
}

export function statusOfError(err) {
  if (Number.isFinite(err?.status)) return err.status;
  if (Number.isFinite(err?.code) && err.code < 0) return 400;
  return 500;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function take(items, n) {
  return Array.isArray(items) ? items.slice(0, Math.max(0, n)) : [];
}
