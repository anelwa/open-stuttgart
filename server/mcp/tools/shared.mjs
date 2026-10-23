// Bausteine für die Werkzeugdefinitionen: Schemata, Auflösung von Orten und Haltestellen,
// einheitliche Ergebnisse. Jedes Werkzeug ist read-only und liefert Quellen mit.
import { geocode } from '../../sources/schnittstellen.mjs';
import { searchStops } from '../../sources/efa.mjs';
import { buildToolError, buildToolResult, sourcesFrom, toolError } from '../util.mjs';

export const str = (description, options = {}) => ({ type: 'string', description, ...options });
export const num = (description, options = {}) => ({ type: 'number', description, ...options });
export const int = (description, options = {}) => ({ type: 'integer', description, ...options });
export const bool = (description, options = {}) => ({ type: 'boolean', description, ...options });
export const enumStr = (description, values, options = {}) => ({ type: 'string', description, enum: values, ...options });
export const obj = (properties = {}, required = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});

export const LIMIT = (def = 20, max = 100) => int(`Maximale Anzahl Treffer (Standard ${def}, höchstens ${max}).`, { minimum: 1, maximum: max, default: def });
export const COORD = {
  lat: num('Breitengrad (WGS84), z. B. 48.7758.'),
  lon: num('Längengrad (WGS84), z. B. 9.1829.'),
};

/**
 * Werkzeugdefinition mit sinnvollen Vorgaben. `execute` bekommt geprüfte Argumente und
 * einen Kontext mit `signal`, `progress`, `log` und `client`.
 */
export function defineTool(def) {
  if (!/^[a-z][a-z0-9_]{2,60}$/.test(def.name)) throw new Error(`Ungültiger Werkzeugname: ${def.name}`);
  return {
    cost: 1,
    timeoutMs: 30_000,
    sources: [],
    annotations: {},
    ...def,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      ...def.annotations,
    },
  };
}

/** Führt ein Werkzeug aus und verpackt das Ergebnis. */
export async function executeTool(tool, args, ctx) {
  let raw;
  try {
    raw = await tool.execute(args ?? {}, ctx);
  } catch (err) {
    if (err?.isToolError) return buildToolError(err.message, { hint: err.hint ?? null });
    return buildToolError(
      `Die Quelle antwortet gerade nicht (${err?.message ?? 'unbekannter Fehler'}). Bitte später erneut versuchen.`,
    );
  }
  if (raw?.content) return raw;
  if (raw == null) return buildToolResult({ data: null, sources: tool.sources, limits: ['Keine Daten geliefert.'] });
  return buildToolResult({
    data: raw.data ?? raw,
    sources: sourcesFrom(raw.data ?? raw, [...tool.sources, ...(raw.sources ?? [])]),
    limits: raw.limits ?? [],
    hint: raw.hint ?? null,
    text: raw.text ?? null,
  });
}

/** „48.7758,9.1829“ oder eine Adresse/ein Ort. */
export async function resolvePlace(query, { label = 'Ort' } = {}) {
  const q = String(query ?? '').trim();
  if (!q) throw toolError(`${label} fehlt.`);
  const coord = /^(-?\d{1,2}(?:[.,]\d+)?)\s*,\s*(-?\d{1,3}(?:[.,]\d+)?)$/.exec(q);
  if (coord) {
    const lat = Number(coord[1].replace(',', '.'));
    const lon = Number(coord[2].replace(',', '.'));
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon, label: q, type: 'Koordinate' };
  }
  const r = await geocode(q, 8);
  const hit = r?.items?.[0];
  if (!hit) throw toolError(`„${q}“ konnte nicht verortet werden. Bitte Adresse, Haltestelle oder „lat,lon“ angeben.`);
  return { ...hit, label: hit.label ?? q, type: hit.type ?? 'Ort' };
}

/** Haltestellenname oder EFA-Kennung. */
export async function resolveStop(value) {
  const q = String(value ?? '').trim();
  if (!q) throw toolError('Haltestelle fehlt.');
  if (/^de:\d{5}:\d+$/.test(q)) return { id: q, name: q };
  const r = await searchStops(q);
  const hit = r?.results?.[0];
  if (!hit) throw toolError(`Haltestelle „${q}“ nicht gefunden. Bitte Namen wie „Charlottenplatz“ angeben.`);
  return { ...hit, id: hit.id, name: hit.name };
}

/** Optionales Zentrum: entweder Koordinaten oder ein aufzulösender Ort. */
export async function optionalCenter({ lat, lon, near, label = 'Ort' } = {}) {
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
    return { lat: Number(lat), lon: Number(lon), label: 'übergebene Koordinaten' };
  }
  if (near) return resolvePlace(near, { label });
  return null;
}

/** Begrenzt eine Liste und notiert die Kürzung als Grenze. */
export function takeWithNote(items, limit, label = 'Treffer') {
  const list = Array.isArray(items) ? items : [];
  const shown = list.slice(0, Math.max(0, Number(limit) || 20));
  return {
    shown,
    limits: list.length > shown.length ? [`${label}: ${shown.length} von ${list.length} angezeigt.`] : [],
  };
}
