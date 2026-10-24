// Adapter für die neuen Quellen. Jeder Adapter holt Daten höflich über cache.mjs,
// normalisiert sie auf eine gemeinsame Form und nennt Quelle, Lizenz und Grenzen.
import { cached, fetchBuffer, fetchJson, fetchText } from '../cache.mjs';
import { bboxAround, bboxString, featurePoints, geometryCenter } from './util.mjs';
import { parseCsv } from './csv.mjs';

const CKAN = 'https://opendata.stuttgart.de/api/3/action';
const CKAN_CACHE = 12 * 3600_000;
const DATASET_CACHE = 24 * 3600_000;

/** UTF-8 mit Rückfall auf Windows-1252 (viele amtliche CSV-Dateien sind so kodiert). */
export function decodeText(buffer) {
  const buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try { return new TextDecoder('windows-1252').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
  }
}

export async function textSmart(url, init) {
  const buf = await fetchBuffer(url, init);
  return decodeText(buf);
}

/** CKAN-Datensatz mit allen Ressourcen (Metadaten, 24 h Cache). */
export async function ckanPackage(dataset) {
  const { value } = await cached(`extra-ckan-package-${dataset}`, DATASET_CACHE, async () => {
    const j = await fetchJson(`${CKAN}/package_show?id=${encodeURIComponent(dataset)}`, { timeout: 30_000 });
    if (!j?.result) throw new Error(`CKAN-Datensatz ${dataset} nicht gefunden`);
    return j.result;
  });
  return value;
}

export function chooseResource(pkg, config = {}) {
  const resources = (pkg.resources ?? []).filter((r) => r.url);
  let list = resources;
  if (config.resourceFormat) list = list.filter((r) => new RegExp(config.resourceFormat, 'i').test(String(r.format ?? '')) || new RegExp(config.resourceFormat, 'i').test(String(r.url)));
  if (config.resourceName) list = list.filter((r) => new RegExp(config.resourceName, 'i').test(`${r.name ?? ''} ${r.url ?? ''}`));
  if (!list.length) throw new Error(`Keine passende Ressource in ${pkg.name}`);
  return list[config.resourceIndex ?? 0] ?? list[0];
}

/** CKAN-CSV als Tabelle; optionale Filter und Zeilenbegrenzung. */
export async function ckanCsv(source, params = {}) {
  const config = source.config ?? {};
  const pkg = await ckanPackage(config.dataset);
  const resource = chooseResource(pkg, config);
  const key = `extra-ckan-csv-${config.dataset}-${resource.id}`;
  const { value } = await cached(key, CKAN_CACHE, async () => {
    const text = await textSmart(resource.url, { timeout: 45_000 });
    const parsed = parseCsv(text, { maxRows: 60_000 });
    if (!parsed.rows.length) throw new Error('Datensatz ohne Zeilen');
    return {
      ...parsed,
      resource: {
        id: resource.id, name: resource.name ?? null, format: resource.format ?? null,
        url: resource.url, lastModified: resource.last_modified ?? null,
      },
      dataset: {
        id: pkg.name, title: pkg.title, notes: pkg.notes ?? null,
        license: pkg.license_title ?? pkg.license_id ?? null,
        updated: pkg.metadata_modified ?? null,
        url: `https://opendata.stuttgart.de/dataset/${encodeURIComponent(pkg.name)}`,
      },
    };
  });

  const q = String(params.q ?? '').trim().toLowerCase();
  const year = String(params.year ?? '').trim();
  const rows = value.rows.filter((row) => {
    if (year && !Object.values(row).some((v) => String(v).includes(year))) return false;
    if (!q) return true;
    return Object.values(row).some((v) => String(v).toLowerCase().includes(q));
  });
  const limit = Math.min(Math.max(Number(params.limit) || 120, 1), 60_000);
  const shown = rows.slice(0, limit);
  return {
    kind: 'CKAN-Datensatz',
    title: pkg.title,
    subtitle: resource.name ?? null,
    columns: value.columns,
    rows: shown,
    rowCount: rows.length,
    totalRows: value.rows.length,
    truncated: rows.length > shown.length,
    dataset: value.dataset,
    resource: value.resource,
    notes: pkg.notes ? String(pkg.notes).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600) : null,
    limits: rows.length > shown.length ? [`${shown.length} von ${rows.length} Zeilen angezeigt.`] : [],
  };
}

/** Einzelner WFS-Layer als GeoJSON. */
export async function wfsLayer(source, params = {}) {
  const config = source.config ?? {};
  const lat = Number(params.lat ?? config.lat ?? 48.7758);
  const lon = Number(params.lon ?? config.lon ?? 9.1829);
  const r = Math.min(Math.max(Number(params.r ?? config.radiusKm ?? 8), 0.2), 25);
  const count = Math.min(Math.max(Number(params.limit ?? config.count ?? 300), 1), 1000);
  const bbox = bboxAround(lat, lon, r * 1000);
  // WFS 2.0 mit EPSG:4326 erwartet die Achsenfolge lat,lon (offizielle Achsenordnung).
  const wfsBbox = [bbox[1], bbox[0], bbox[3], bbox[2]].map((x) => x.toFixed(6)).join(',');
  const key = `extra-wfs-${source.id}-${bboxString(bbox)}-${count}`;
  const { value } = await cached(key, 6 * 3600_000, async () => {
    const url = `${config.baseUrl}?service=WFS&version=${config.version ?? '2.0.0'}&request=GetFeature`
      + `&typeNames=${encodeURIComponent(config.layer)}&count=${count}`
      + `&outputFormat=application/json&srsName=EPSG:4326`
      + `&bbox=${wfsBbox},urn:ogc:def:crs:EPSG::4326`;
    const j = await fetchJson(url, { timeout: 45_000 });
    if (!j?.features) throw new Error(`WFS-Layer ${config.layer} lieferte kein GeoJSON`);
    return j;
  });
  return {
    kind: 'WFS-Layer',
    title: config.title ?? config.layer,
    subtitle: config.layer,
    features: value.features,
    points: featurePoints(value).slice(0, count),
    bbox,
    limits: [`Ausschnitt ±${r} km um ${lat.toFixed(4)}, ${lon.toFixed(4)}; höchstens ${count} Objekte.`],
  };
}

/** LGL-BW-WFS (NOrA-BW) mit GeoJSON-Ausgabe. */
export async function lglWfs(source, params = {}) {
  const config = source.config ?? {};
  const lat = Number(params.lat ?? 48.7758);
  const lon = Number(params.lon ?? 9.1829);
  const r = Math.min(Math.max(Number(params.r ?? config.radiusKm ?? 6), 0.5), 20);
  const count = Math.min(Math.max(Number(params.limit ?? 400), 1), 1000);
  const bbox = bboxAround(lat, lon, r * 1000);
  const wfsBbox = [bbox[1], bbox[0], bbox[3], bbox[2]].map((x) => x.toFixed(6)).join(',');
  const key = `extra-lgl-${source.id}-${bboxString(bbox)}-${count}`;
  const { value } = await cached(key, 12 * 3600_000, async () => {
    const url = `https://owsproxy.lgl-bw.de/owsproxy/wfs/WFS_LGL-BW_ATKIS_Basis-DLM?service=WFS&version=2.0.0`
      + `&request=GetFeature&typeNames=${encodeURIComponent(config.layer)}&count=${count}`
      + `&outputFormat=application/json&srsName=EPSG:4326`
      + `&bbox=${wfsBbox},urn:ogc:def:crs:EPSG::4326`;
    const j = await fetchJson(url, { timeout: 60_000 });
    if (!j?.features) throw new Error('LGL-WFS lieferte kein GeoJSON');
    return j;
  });
  return {
    kind: 'LGL-BW WFS',
    title: config.title ?? config.layer,
    subtitle: config.layer,
    features: value.features,
    points: featurePoints(value).slice(0, count),
    bbox,
    limits: [`Ausschnitt ±${r} km; höchstens ${count} Objekte.`],
  };
}

/** LUBW/ArcGIS-REST als GeoJSON. */
export async function arcgisGeoJson(source, params = {}) {
  const config = source.config ?? {};
  const lat = Number(params.lat ?? 48.7758);
  const lon = Number(params.lon ?? 9.1829);
  const r = Math.min(Math.max(Number(params.r ?? config.radiusKm ?? 8), 0.5), 30);
  const count = Math.min(Math.max(Number(params.limit ?? 500), 1), 2000);
  const bbox = bboxAround(lat, lon, r * 1000);
  const key = `extra-lubw-${source.id}-${bboxString(bbox)}-${count}`;
  const { value } = await cached(key, 12 * 3600_000, async () => {
    const url = `https://rips-gdi.lubw.baden-wuerttemberg.de/arcgis/rest/services/wfs/${config.service}/MapServer/0/query`
      + `?where=${encodeURIComponent(config.where ?? '1=1')}&outFields=*&returnGeometry=true&f=geojson`
      + `&resultRecordCount=${count}&geometry=${encodeURIComponent(bbox.join(','))}`
      + '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects';
    const j = await fetchJson(url, { timeout: 60_000 });
    if (!j?.features) throw new Error(`LUBW-Dienst ${config.service} lieferte kein GeoJSON`);
    return j;
  });
  return {
    kind: 'LUBW WFS',
    title: config.title ?? config.service,
    subtitle: config.service,
    features: value.features,
    points: featurePoints(value).slice(0, count),
    bbox,
    limits: [`Ausschnitt ±${r} km; höchstens ${count} Objekte.`],
  };
}

/** Template-URL mit {lat}, {lon}, {bbox}, {q}, {date} füllen. */
export function fillUrl(template, params = {}, extras = {}) {
  const lat = Number(params.lat ?? 48.7758);
  const lon = Number(params.lon ?? 9.1829);
  const r = Number(params.r ?? 5000);
  const bbox = bboxAround(lat, lon, r);
  return String(template)
    .replaceAll('{lat}', String(lat))
    .replaceAll('{lon}', String(lon))
    .replaceAll('{bbox}', bbox.join(','))
    .replaceAll('{bboxPolygon}', `POLYGON((${bbox[0]} ${bbox[1]},${bbox[2]} ${bbox[1]},${bbox[2]} ${bbox[3]},${bbox[0]} ${bbox[3]},${bbox[0]} ${bbox[1]}))`)
    .replaceAll('{q}', encodeURIComponent(String(params.q ?? extras.q ?? 'Stuttgart')))
    .replaceAll('{date}', String(params.date ?? new Date().toISOString().slice(0, 10)))
    .replaceAll('{dateTomorrow}', new Date(new Date(params.date ?? Date.now()).getTime() + 86_400_000).toISOString().slice(0, 10))
    .replaceAll('{year}', String(params.year ?? new Date().getFullYear()))
    .replaceAll('{yearStart}', `${params.year ?? new Date().getFullYear()}0101`)
    .replaceAll('{yearEnd}', `${params.year ?? new Date().getFullYear()}1231`)
    .replaceAll('{limit}', String(params.limit ?? extras.limit ?? 20))
    .replaceAll('{key}', String(process.env.OS_EUROPEANA_KEY ?? params.key ?? ''));
}

/** Beliebige JSON-API; Normalisierung erfolgt im Adapter oder im Quellen-Register. */
export async function jsonApi(source, params = {}) {
  const config = source.config ?? {};
  const url = fillUrl(config.url, params, config);
  const key = `extra-json-${source.id}-${url}`;
  const { value } = await cached(key, config.ttlMs ?? 15 * 60_000, async () => {
    const j = await fetchJson(url, { timeout: config.timeoutMs ?? 30_000, headers: config.headers ?? undefined });
    if (config.normalizer) {
      const { NORMALIZERS } = await import('./normalizers.mjs');
      const fn = NORMALIZERS[config.normalizer];
      if (!fn) throw new Error(`Normalisierer ${config.normalizer} fehlt`);
      return fn(j, { source, params, url });
    }
    return { json: j };
  });
  return { kind: 'REST-API', title: source.title, subtitle: config.label ?? null, ...value, url, limits: config.limits ? [config.limits] : [] };
}

/** Text-/XML-API mit optionalem RSS-/XML-Normalisierer. */
export async function textApi(source, params = {}) {
  const config = source.config ?? {};
  const url = fillUrl(config.url, params, config);
  const key = `extra-text-${source.id}-${url}`;
  const { value } = await cached(key, config.ttlMs ?? 15 * 60_000, async () => {
    const text = await fetchText(url, { timeout: config.timeoutMs ?? 30_000, headers: config.headers ?? undefined });
    if (config.normalizer) {
      const { NORMALIZERS } = await import('./normalizers.mjs');
      const fn = NORMALIZERS[config.normalizer];
      if (!fn) throw new Error(`Normalisierer ${config.normalizer} fehlt`);
      return fn(text, { source, params, url });
    }
    return { text: text.slice(0, 200_000) };
  });
  return { kind: 'Text-API', title: source.title, subtitle: config.label ?? null, ...value, url, limits: config.limits ? [config.limits] : [] };
}

/** Overpass-Abfrage (POST, damit lange Query-Strings nicht in der URL landen). */
export async function overpass(source, params = {}) {
  const config = source.config ?? {};
  const lat = Number(params.lat ?? 48.7758);
  const lon = Number(params.lon ?? 9.1829);
  const r = Math.min(Math.max(Number(params.r ?? 1500), 100), 10_000);
  const query = String(config.query ?? '').replaceAll('{lat}', String(lat)).replaceAll('{lon}', String(lon)).replaceAll('{r}', String(r));
  const key = `extra-overpass-${source.id}-${lat.toFixed(4)}-${lon.toFixed(4)}-${r}`;
  const { value } = await cached(key, config.ttlMs ?? 30 * 60_000, async () => {
    const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt)',
            Accept: 'application/json',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!res.ok) throw new Error(`Overpass antwortet mit ${res.status}`);
        return res.json();
      } catch (err) { lastError = err; }
    }
    throw lastError ?? new Error('Overpass nicht erreichbar');
  });
  const points = (value.elements ?? []).map((el) => {
    const lat2 = el.lat ?? el.center?.lat;
    const lon2 = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat2) || !Number.isFinite(lon2)) return null;
    return {
      id: `${el.type}/${el.id}`, name: el.tags?.name ?? el.tags?.amenity ?? el.tags?.shop ?? `OSM ${el.type}`,
      lat: lat2, lon: lon2, props: el.tags ?? {},
    };
  }).filter(Boolean);
  return {
    kind: 'Overpass/OSM',
    title: config.title ?? source.title,
    subtitle: config.label ?? null,
    points,
    count: value.elements?.length ?? 0,
    url: `https://www.openstreetmap.org/#map=16/${lat}/${lon}`,
    limits: ['OpenStreetMap-Auszug; Vollständigkeit und Aktualität hängen von der Community ab.'],
  };
}
