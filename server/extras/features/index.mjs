// Katalog und Ausführung der 100 Werkzeuge.
import { FEATURES, FEATURE_BY_ID, FEATURE_CATEGORIES } from './registry.mjs';

export function publicFeature(f) {
  return {
    number: f.number,
    key: f.key,
    id: f.id,
    title: f.title,
    category: f.category,
    summary: f.summary,
    inputs: f.inputs ?? [],
    status: f.status,
  };
}

export function featureCatalog() {
  return {
    count: FEATURES.length,
    live: FEATURES.filter((f) => f.status === 'live').length,
    planned: FEATURES.filter((f) => f.status === 'geplant').length,
    categories: FEATURE_CATEGORIES.map(([id, label]) => ({ id, label, count: FEATURES.filter((f) => f.category === id).length, live: FEATURES.filter((f) => f.category === id && f.status === 'live').length })),
    features: FEATURES.map(publicFeature),
    leitsatz: 'Jedes Werkzeug beantwortet eine konkrete Frage, nennt seine Quellen und sagt, was es nicht kann.',
  };
}

function coerce(feature, params) {
  const out = {};
  for (const input of feature.inputs ?? []) {
    const raw = params[input.key];
    if (raw == null || raw === '') {
      if (input.required) throw Object.assign(new Error(`Bitte „${input.label}“ angeben.`), { status: 400 });
      continue;
    }
    out[input.key] = input.type === 'number' ? Number(raw) : String(raw);
  }
  // Ortsparameter, die nicht im Formular stehen, dennoch durchreichen.
  for (const key of ['lat', 'lon', 'ort', 'q', 'limit', 'r']) {
    if (out[key] == null && params[key] != null && params[key] !== '') out[key] = params[key];
  }
  return out;
}

export async function runFeature(id, params = {}) {
  const feature = FEATURE_BY_ID.get(String(id ?? ''));
  if (!feature) throw Object.assign(new Error('Unbekanntes Werkzeug'), { status: 404 });
  if (feature.status !== 'live' || typeof feature.run !== 'function') {
    throw Object.assign(new Error('Dieses Werkzeug ist noch in Vorbereitung.'), { status: 501 });
  }
  const args = coerce(feature, params);
  const started = Date.now();
  const result = await feature.run(args);
  return {
    id: feature.id,
    number: feature.number,
    category: feature.category,
    title: result.title ?? feature.title,
    subtitle: result.subtitle ?? null,
    summary: result.summary ?? feature.summary,
    facts: result.facts ?? [],
    blocks: result.blocks ?? [],
    points: result.points ?? [],
    geojson: result.geojson ?? null,
    sources: result.sources ?? [],
    actions: result.actions ?? [],
    limits: result.limits ?? [],
    updated: result.updated ?? new Date().toISOString(),
    speech: result.speech ?? null,
    durationMs: Date.now() - started,
    params: args,
    status: 'ok',
  };
}
