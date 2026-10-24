// Führt eine Quelle aus dem Register aus und vereinheitlicht die Antwort.
import { SOURCES, SOURCE_BY_ID } from './sources.mjs';
import { arcgisGeoJson, ckanCsv, jsonApi, lglWfs, overpass, textApi, wfsLayer } from './adapters.mjs';
import { clean } from './util.mjs';

const ADAPTERS = { ckanCsv, wfsLayer, lglWfs, arcgisGeoJson, jsonApi, textApi, overpass };

export function publicSource(source) {
  return {
    id: source.id,
    title: source.title,
    category: source.category,
    group: source.group,
    kind: source.kind,
    license: source.license,
    attribution: source.attribution,
    url: source.url,
    summary: source.summary,
    status: source.status,
    ttl: source.ttl,
    note: source.note ?? null,
    adapter: source.adapter,
  };
}

export function sourceCatalog() {
  const groups = [...new Map(SOURCES.map((s) => [s.group, { id: s.group, count: 0 }])).values()];
  for (const s of SOURCES) groups.find((g) => g.id === s.group).count++;
  return {
    count: SOURCES.length,
    live: SOURCES.filter((s) => s.status === 'live').length,
    planned: SOURCES.filter((s) => s.status === 'geplant').length,
    key: SOURCES.filter((s) => s.status === 'key').length,
    groups,
    sources: SOURCES.map(publicSource),
    leitsatz: 'Jede Quelle nennt Lizenz und Quellenangabe. Wo eine Freigabe fehlt, wird sie nicht stillschweigend genutzt.',
  };
}

export async function runSource(id, params = {}) {
  const source = SOURCE_BY_ID.get(String(id ?? ''));
  if (!source) throw Object.assign(new Error('Unbekannte Quelle'), { status: 404 });
  if (source.status !== 'live') {
    throw Object.assign(new Error(source.status === 'key' ? 'Für diese Quelle ist ein eigener Schlüssel nötig.' : 'Diese Quelle ist noch in Vorbereitung.'), { status: 501 });
  }
  const adapter = ADAPTERS[source.adapter];
  if (!adapter) throw Object.assign(new Error(`Adapter ${source.adapter} fehlt`), { status: 501 });
  const result = await adapter(source, params);
  const updated = new Date().toISOString();
  const base = {
    id: source.id,
    title: result.title ?? source.title,
    subtitle: result.subtitle ?? null,
    kind: source.kind,
    category: source.category,
    group: source.group,
    summary: source.summary,
    license: source.license,
    attribution: source.attribution,
    sourceUrl: source.url,
    note: clean(source.note, 500) || null,
    fetchedAt: updated,
    limits: [...(result.limits ?? []), ...(source.note ? [] : [])],
  };
  if (result.rows) {
    return { ...base, type: 'table', columns: result.columns ?? [], rows: result.rows, rowCount: result.rowCount ?? result.rows.length, totalRows: result.totalRows ?? result.rows.length, truncated: result.truncated ?? false, dataset: result.dataset ?? null, resource: result.resource ?? null, json: result.json ?? null, notes: result.notes ?? null };
  }
  if (result.features) {
    return { ...base, type: 'geojson', features: result.features, points: result.points ?? [], bbox: result.bbox ?? null, json: result.json ?? null };
  }
  if (result.points) {
    return { ...base, type: 'points', points: result.points, count: result.count ?? result.points.length, json: result.json ?? null };
  }
  return { ...base, type: 'json', json: result.json ?? null, items: result.items ?? [], rows: result.rows ?? null, columns: result.columns ?? null, text: result.text ?? null };
}
