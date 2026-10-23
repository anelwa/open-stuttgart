// Schnittstellen im weiten Sinn: Stadt-Layer-Katalog, amtlicher Geocoder, KOMUNIS,
// FragDenStaat, Fairteiler, GBIF, Wikidata-Lücken, K10plus und der Open-Data-Katalog.
//
// Grundsatz: Technisch erreichbar ist nicht automatisch frei nutzbar. Der Katalog zeigt
// deshalb alle WFS-Layer, lädt aber nur die Layer, die im Projekt bereits verwendet werden
// oder einem Open-Data-Datensatz zugeordnet sind. Alles andere bleibt als Fundstelle sichtbar.
import { cached, diskStore, fetchJson, fetchText } from '../cache.mjs';
import { adresse as nominatimAdresse } from './nearby.mjs';

const WFS_BASE = 'https://geoserver.stuttgart.de/geoserver/ows';
const WFS_CAPS = `${WFS_BASE}?service=WFS&version=2.0.0&request=GetCapabilities`;
const GEOCORDER = 'https://gis6.stuttgart.de/locationfinderutm/Finder/Lookup';
const KOMUNIS = 'https://www.domino1.stuttgart.de/web/komunis/komunissde.nsf';
const FRAGDENSTAAT = 'https://fragdenstaat.de/api/v1/request/';
const FOODSHARING = 'https://foodsharing.de/api/regions/48/public';
const GBIF = 'https://api.gbif.org/v1/occurrence/search';
const WDQS = 'https://query.wikidata.org/sparql';
const K10PLUS = 'https://sru.k10plus.de/opac-de-627';
const GOVDATA = 'https://www.govdata.de/ckan/api/3/action/package_search';
const STADT_CKAN = 'https://opendata.stuttgart.de/api/3/action/package_search';
const STADT_BBOX = '9.03,48.68,9.32,48.87';

const unxml = (s) => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const tag = (xml, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? unxml(m[1]) : null;
};
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => unxml(m[1]));
const geomCenter = (g) => {
  if (!g) return null;
  const pts = g.type === 'Point' ? [g.coordinates]
    : g.type === 'LineString' || g.type === 'MultiPoint' ? g.coordinates
      : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates.flat(1)
        : g.type === 'MultiPolygon' ? g.coordinates.flat(2) : [];
  const valid = pts.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!valid.length) return null;
  const lon = valid.reduce((s, p) => s + p[0], 0) / valid.length;
  const lat = valid.reduce((s, p) => s + p[1], 0) / valid.length;
  return [+lon.toFixed(6), +lat.toFixed(6)];
};

// ---------- WFS-Katalog ----------
// Diese Layer sind im Projekt bereits im Einsatz oder in der Recherche als Open Data
// (CKAN, CC BY 4.0) ausgewiesen. Präfixe erlauben Familien wie die Ferienprogramm-Punkte.
const OPEN_PREFIXES = [
  'A62_BRU_BRUNNEN_Brunnen_in_Betr', 'A62_BRU_BRUNNEN_Trinkwasserbr_in_Betr', 'A62_BRU_BRUNNEN_Mineralbr_in_Betr',
  'A10_POI_NETTE_TOILETTE', 'IP_2_10_10_TOILETTENANLAGE', 'IP_2_10_04_ALTGLAS', 'IP_2_10_06_ALTKLEIDER',
  'IP_3_06_04_WERTSTOFFHOF', 'IP_2_10_24_UMWELTMOBIL', 'A62_SPF_SPIELPLAETZE', 'IP_2_03_38_GRILLPLATZ',
  'A62_ALG_KUEHLE_ORTE', 'A62_ALG_STUTTGARTER_STAEFFELE_P', 'A62_POI_AUSSICHTSPUNKTE_PUNKTE',
  'A62_POI_INNENSTADTRUNDWEG_PUNKTE', 'A62_WANDERN_WEINWANDERWEG', 'A61_BPLAN', 'A12_MSP_LAGEN',
  'A12_GBE_WAHLLOKALE', 'A12_GBE_WAHLBEZAREA', 'A61_RAD_REPSAEULEN', 'A61_RAD_HAUPTRADROUTEN',
  'A61_RAD_RADEMPFEHLUNGEN', 'A66_BAUM_BAUSTELLEN_DATE_im_Bau', 'A66_BAUM_BAUSTELLEN_DATE_geplant',
  'A32_ES_ABSTELLFLAECHEN', 'A66_GB_TEMPO30_GEBIETE', 'A67_GFM_BAUM_PLUS', 'A61_BAUM_BAUMSCHUTZAREA',
  'A61_ALG_GRUENDACHKATASTER', 'A36_SOLAR_GEB_GRUNDRISSE', 'A36_KLIMA_KLIMATOPE',
  'A36_LAERM2022_FASSADENPEGEL_STR', 'A36_LAERM2022_FASSADENPEGEL_BAHN',
  'A66_SRGS_UEBERFLUTUNGSAUSD_AUS', 'A66_SRGS_UEBERFLUTUNGSAUSD_EXT', 'A66_SRGS_UEBERFLUTUNGSAUSD_SEL',
  'A36_HWGK_GEN_HQ100_HAUPTWASSERK', 'IP_2_01_10_KITA', 'IP_2_01_11_KINDER_JUGENDTREFFS',
  'IP_2_01_01_SENIORENEINRICHTUNGEN', 'IP_2_07_01_KLINIKEN', 'IP_2_05_02_POLIZEI',
  'IP_2_04_01_GRUNDSCHULE', 'IP_2_04_04_REALSCHULE', 'IP_2_04_05_GYMNASIUM',
  'IP_2_04_07-16_FOERDERSCHULE', 'IP_2_04_20_BERUFSSCHULE', 'IP_2_04_25-27_UNI_HOCHSCHULE',
  'IP_2_04_31_VHS', 'IP_2_04_32u33_SONSTIGE_BILDUNG', 'IP_2_04_47_WERKREALSCHULE',
  'IP_2_04_49_GEMEINSCHAFTSSCHULE',
  'IP_MUSEEN', 'IP_THEATER', 'IP_2_12_01_TOURISTIKINFO', 'IP_2_03_24_ZOO', 'IP_3_05_05_FRIEDHOF',
  'FREMDDATEN_AWS_BEZIRKE', 'FREMDDATEN_AWS_BETRIEBSSTELLEN', 'FREMDDATEN_RECUP_STANDORTE',
  'FREMDDATEN_VVS_HALTESTELLEN', 'A37_NOTF_TREFFPUNKTE_Stufe1', 'A37_NOTF_TREFFPUNKTE_Stufe2',
  'A37_GBE_JODBEZIRKE_AUSSEN', 'A36_KWP_NETZGEBIETE', 'A36_KWP_HAUPTENERGIETRAEGER', 'A61_SAN_GEBIETE',
  'A32_RSP_RADSCHULWEGE', 'A51_ALG_FP_PUNKTE_', 'A62_POI_34_TRAUUNG_WUNSCH',
  'A10_EP_TOUR_ENGAGEMENT_ORTE', 'A62_MOFU_STANDORTE',
];
const OPEN_BASE = (name) => {
  const base = name.replace(/^[^:]+:/, '').replace(/_EPSG\d+(_TIFF)?$/i, '');
  return OPEN_PREFIXES.some((p) => base.startsWith(p));
};
const isBaseLayer = (name) => /^Base:(A62_GK_GEB_KOMMUNAL|A62_GK_FLURST_KOMMUNAL|A62_GKI_BRUECKEN|A62_GKI_UNTERFUELINIEN)(_|$)/.test(name);

async function wfsCatalogRaw() {
  const { value } = await cached('stadt-wfs-katalog', 24 * 3600_000, async () => {
    const xml = await fetchText(WFS_CAPS, { timeout: 45_000 });
    const layers = [];
    for (const m of xml.matchAll(/<FeatureType(?:\s[^>]*)?>([\s\S]*?)<\/FeatureType>/g)) {
      const b = m[1];
      const name = tag(b, 'Name');
      if (!name) continue;
      const lower = tag(b, 'ows:LowerCorner');
      const upper = tag(b, 'ows:UpperCorner');
      const bbox = lower && upper ? [...lower.split(/\s+/).map(Number), ...upper.split(/\s+/).map(Number)] : null;
      layers.push({
        name,
        title: tag(b, 'Title') ?? name,
        abstract: tag(b, 'Abstract') ?? '',
        workspace: name.split(':')[0],
        crs: tag(b, 'DefaultCRS') ?? null,
        bbox: bbox && bbox.every(Number.isFinite) ? bbox : null,
        frei: OPEN_BASE(name) || isBaseLayer(name),
      });
    }
    if (!layers.length) throw new Error('WFS-Katalog ohne Layer');
    return layers;
  });
  return value;
}

/** Alle 458 WFS-Layer als Katalog. Nur `frei`-Layer dürfen über den Proxy geladen werden. */
export async function wfsKatalog() {
  const layers = await wfsCatalogRaw();
  const workspaces = [...new Map(layers.map((l) => [l.workspace, { id: l.workspace, count: 0 }])).values()];
  for (const l of layers) workspaces.find((w) => w.id === l.workspace).count++;
  return {
    count: layers.length,
    frei: layers.filter((l) => l.frei).length,
    workspaces,
    layers,
    stand: 'GetCapabilities des GeoServers, 24 h zwischengespeichert',
    hinweis: 'Layer außerhalb der Open-Data-/Projektliste werden nur im Katalog geführt; für eine Veröffentlichung ist die Freigabe des Stadtmessungsamts nötig.',
    source: 'Landeshauptstadt Stuttgart, Stadtmessungsamt, Geoserver (WFS 2.0.0)',
  };
}

async function catalogEntry(name) {
  if (!/^[A-Za-z0-9_]+:[A-Za-z0-9_.-]+$/.test(name)) throw Object.assign(new Error('Ungültiger Layer-Name'), { status: 400 });
  const layer = (await wfsCatalogRaw()).find((l) => l.name === name);
  if (!layer) throw Object.assign(new Error('Layer nicht im Katalog'), { status: 404 });
  if (!layer.frei) throw Object.assign(new Error('Für diesen Layer fehlt die Freigabe als Open Data'), { status: 403 });
  return layer;
}

/** Einzelner WFS-Layer als GeoJSON, auf einen Radius um lat/lon begrenzt. */
export async function wfsFeatures({ layer, lat, lon, r = 2, limit = 300 } = {}) {
  const entry = await catalogEntry(layer);
  lat = Number(lat); lon = Number(lon); r = Math.min(Math.max(Number(r) || 2, 0.1), 10);
  limit = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 47 || lat > 50 || lon < 8 || lon > 10) {
    throw Object.assign(new Error('Kartenmitte außerhalb der Region'), { status: 400 });
  }
  const dLat = r / 111.32; const dLon = r / (111.32 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((x) => x.toFixed(6)).join(',');
  const key = `wfs-live-${layer}-${bbox}-${limit}`;
  const { value } = await cached(key, 6 * 3600_000, async () => {
    const url = `${WFS_BASE}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(layer)}`
      + `&count=${limit}&outputFormat=application/json&srsName=EPSG:4326&bbox=${bbox},urn:ogc:def:crs:EPSG::4326`;
    const j = await fetchJson(url, { timeout: 30_000 });
    const features = (j.features ?? []).slice(0, limit).map((f, i) => {
      const p = f.properties ?? {};
      const name = p.NAME ?? p.Name ?? p.name ?? p.TITEL ?? p.Titel ?? p.BEZEICHNUNG ?? p.STRASSE ?? entry.title;
      return {
        ...f,
        id: f.id ?? `${layer}-${i}`,
        properties: { ...p, _layer: layer, _layerTitle: entry.title, _name: String(name), _props: JSON.stringify(p) },
      };
    });
    return { type: 'FeatureCollection', features };
  });
  return {
    ...value,
    meta: {
      layer: entry.name, title: entry.title, count: value.features.length,
      source: 'Landeshauptstadt Stuttgart, Stadtmessungsamt, Geoserver (CC BY 4.0)',
      license: entry.frei ? 'CC BY 4.0 / Open Data' : 'Nutzungsbedingungen – Freigabe nötig',
      bbox,
    },
  };
}

export async function wfsRss({ layer } = {}) {
  const entry = await catalogEntry(layer);
  const fc = await wfsFeatures({ layer, lat: 48.7758, lon: 9.1829, r: 8, limit: 80 });
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = fc.features.map((f) => {
    const p = f.properties ?? {};
    const title = p.NAME ?? p.name ?? p.TITEL ?? p.BEZEICHNUNG ?? p.STRASSE ?? p._layerTitle;
    const c = geomCenter(f.geometry);
    const link = c ? `https://open-stuttgart.de/o/wissen/${encodeURIComponent(entry.name)}/${encodeURIComponent(f.id)}` : `https://open-stuttgart.de/?layer=${encodeURIComponent(entry.name)}`;
    return `<item><title>${esc(title)}</title><link>${link}</link><guid>${link}</guid><description>${esc(p.BESCHREIBUNG ?? p.BEMERKUNG ?? '')}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Open Stuttgart · ${esc(entry.title)}</title>`
    + `<link>https://open-stuttgart.de/</link><description>${esc(entry.title)} aus dem Geoserver der Stadt Stuttgart</description>${items}</channel></rss>`;
}

// ---------- Amtlicher Geocoder ----------
/** gis6.stuttgart.de: Adressen, Straßen, Haltestellen, Stadtteile und Flurstücke. */
export async function geocode(q, limit = 8) {
  const t = String(q ?? '').trim();
  if (t.length < 2) return { items: [], source: 'Landeshauptstadt Stuttgart, gis6' };
  const { value } = await cached(`geocode-gis6-${t.toLowerCase()}-${limit}`, 24 * 3600_000, async () => {
    const j = await fetchJson(`${GEOCORDER}?query=${encodeURIComponent(t)}&sref=4326&limit=${Math.min(Math.max(+limit || 8, 1), 20)}`, { timeout: 15_000 });
    if (!j?.ok) throw new Error(j?.info ?? 'Geocoder ohne Ergebnis');
    return (j.locs ?? []).map((l) => ({
      id: String(l.id ?? `${l.cx},${l.cy}`),
      label: l.name,
      type: l.type ?? null,
      lat: +Number(l.cy).toFixed(6),
      lon: +Number(l.cx).toFixed(6),
      bbox: [l.xmin, l.ymin, l.xmax, l.ymax].every((x) => Number.isFinite(+x)) ? [l.xmin, l.ymin, l.xmax, l.ymax].map(Number) : null,
    }));
  });
  return { items: value, source: 'Landeshauptstadt Stuttgart, gis6 Location Finder' };
}

// ---------- KOMUNIS ----------
const komunisTitle = (e) => e?.entrydata?.find((d) => d?.text?.['0'])?.text['0'] ?? '';
const komunisEntry = (e) => {
  const data = e?.entrydata ?? [];
  const leaf = data.length >= 3;
  return {
    position: e['@position'],
    title: leaf ? (data[1]?.text?.['0'] ?? komunisTitle(e)) : komunisTitle(e),
    date: leaf ? (data[0]?.text?.['0'] ?? null) : null,
    typ: leaf ? (data[2]?.text?.['0'] ?? null) : null,
    unid: e['@unid'] ?? null,
    children: Number(e['@children'] ?? 0),
    leaf,
    url: e['@unid'] ? `${KOMUNIS}/0/${e['@unid']}?OpenDocument` : null,
  };
};

/** Navigiert durch die KOMUNIS-Views. `start` ist eine Positionsangabe wie 3.1. */
export async function komunis(start = '') {
  const s = String(start ?? '').replace(/[^0-9.]/g, '').slice(0, 40);
  const { value } = await cached(`komunis-view-${s}`, 12 * 3600_000, async () => {
    // Domino liefert ab Start die Geschwister, nicht die Kinder. Die Kinder einer
    // Kategorie beginnen eine Ebene tiefer, also bei <position>.1.
    const viewStart = s ? `${s}.1` : '';
    const j = await fetchJson(`${KOMUNIS}/annathe20?ReadViewEntries&OutputFormat=JSON&Count=100${viewStart ? `&Start=${encodeURIComponent(viewStart)}` : ''}`, { timeout: 30_000 });
    const prefix = s ? `${s}.` : '';
    const depth = s ? s.split('.').length + 1 : 1;
    const entries = (j.viewentry ?? []).map(komunisEntry)
      .filter((e) => e.title && e.position?.startsWith(prefix) && String(e.position).split('.').length === depth);
    return { entries, timestamp: j['@timestamp'] ?? null };
  });
  return {
    start: s, ...value,
    source: 'Landeshauptstadt Stuttgart, Statistisches Amt (KOMUNIS)',
    hinweis: 'Die XLSX-Anhänge enthalten die amtlichen Zeitreihen. Die KOMUNIS-Schnittstelle ist nicht dokumentiert; Angaben ohne Gewähr.',
  };
}

/** Dokumentseite eines KOMUNIS-Eintrags; liefert die direkten XLSX-Anhänge. */
export async function komunisDoc(unid) {
  const id = String(unid ?? '');
  if (!/^[A-Fa-f0-9]{8,40}$/.test(id)) throw Object.assign(new Error('Ungültige Dokument-ID'), { status: 400 });
  const { value } = await cached(`komunis-doc-${id}`, 24 * 3600_000, async () => {
    const html = await fetchText(`${KOMUNIS}/0/${id}?OpenDocument`, { timeout: 20_000 });
    const xlsx = [...html.matchAll(/href="([^"]+\$FILE\/[^"]+\.xlsx)"/gi)].map((m) => {
      const href = m[1].replace(/&amp;/g, '&');
      return href.startsWith('http') ? href : `https://www.domino1.stuttgart.de${href}`;
    });
    return { url: `${KOMUNIS}/0/${id}?OpenDocument`, xlsx: [...new Set(xlsx)] };
  });
  return { ...value, source: 'Landeshauptstadt Stuttgart, Statistisches Amt (KOMUNIS)' };
}

// ---------- FragDenStaat ----------
const FDS_STATUS = {
  awaiting_classification: 'muss klassifiziert werden', awaiting_response: 'wartet auf Antwort',
  response_received: 'Antwort erhalten', resolved: 'erledigt', refused: 'abgelehnt',
  withdrawn: 'zurückgezogen', partially_successful: 'teilweise erfolgreich', successful: 'erfolgreich',
  not_held: 'Information nicht vorhanden', user_withdrew: 'zurückgezogen',
};
/** IFG-Anfragen an die Landeshauptstadt Stuttgart (Behörden-ID 9384). */
export async function fragdenstaat(limit = 20, status = '') {
  const n = Math.min(Math.max(+limit || 20, 1), 50);
  const { value } = await cached(`fds-${n}-${status}`, 6 * 3600_000, async () => {
    const j = await fetchJson(`${FRAGDENSTAAT}?public_body=9384&format=json&limit=50&offset=0`, { timeout: 20_000 });
    const all = (j.objects ?? []).map((o) => ({
      id: o.id, title: o.title, status: o.status, statusLabel: FDS_STATUS[o.status] ?? o.readable_status ?? o.status,
      created: o.created_at, lastMessage: o.last_message, url: o.url?.startsWith('http') ? o.url : `https://fragdenstaat.de${o.url}`,
      publicBody: o.public_body?.name ?? 'Landeshauptstadt Stuttgart',
    }));
    const filtered = status ? all.filter((x) => x.status === status) : all;
    return { total: j.meta?.total_count ?? filtered.length, items: filtered.slice(0, n), allCount: all.length };
  });
  return {
    ...value, limit: n, status,
    source: 'FragDenStaat (Open Knowledge Foundation), IFG-Anfragen an die Landeshauptstadt Stuttgart',
    portal: 'https://fragdenstaat.de/behoerde/9384/stadt-stuttgart/',
    hinweis: 'Lesende Darstellung der öffentlichen Anfragen; keine Rechtsberatung. Status und Antworten können sich ändern.',
  };
}

export async function fragdenstaatRss() {
  const d = await fragdenstaat(30);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = d.items.map((x) => `<item><title>${esc(x.title)}</title><link>${esc(x.url)}</link>`
    + `<guid>${esc(x.url)}</guid><pubDate>${new Date(x.lastMessage ?? x.created).toUTCString()}</pubDate>`
    + `<description>${esc(x.statusLabel)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>FragDenStaat · Landeshauptstadt Stuttgart</title>`
    + `<link>${esc(d.portal)}</link><description>Öffentliche IFG-Anfragen an die Stadt Stuttgart</description>${items}</channel></rss>`;
}

// ---------- OSM Notes ----------
/** Offene Hinweise der OpenStreetMap-Community im Umkreis. Schreiben braucht ein OSM-Konto. */
export async function osmNotes(lat = 48.7758, lon = 9.1829, r = 1500) {
  lat = +lat; lon = +lon; r = Math.min(Math.max(+r || 1500, 100), 10_000);
  const dLat = r / 111_320;
  const dLon = r / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((x) => x.toFixed(6)).join(',');
  const { value } = await cached(`osm-notes-${bbox}`, 15 * 60_000, async () => {
    const j = await fetchJson(`https://api.openstreetmap.org/api/0.6/notes.json?bbox=${bbox}&limit=100&closed=0`, { timeout: 20_000 });
    return (j.features ?? []).filter((f) => f.properties?.status === 'open').map((f) => {
      const p = f.properties ?? {};
      const text = String(p.comments?.[0]?.text ?? '').replace(/\s+/g, ' ').trim();
      return {
        id: p.id,
        text: text.length > 220 ? `${text.slice(0, 217)}…` : text,
        date: p.date_created ?? null,
        comments: (p.comments ?? []).length,
        lat: +Number(f.geometry.coordinates[1]).toFixed(6),
        lon: +Number(f.geometry.coordinates[0]).toFixed(6),
        url: p.id ? `https://www.openstreetmap.org/note/${p.id}` : null,
      };
    });
  });
  return {
    items: value, lat, lon, radius: r,
    source: 'OpenStreetMap-Mitwirkende, OSM Notes API (ODbL)',
    hinweis: 'Offene Hinweise aus der OSM-Community. Keine amtliche Meldung; die Bearbeitung erfolgt auf openstreetmap.org.',
    newNote: `https://www.openstreetmap.org/note/new#map=18/${lat.toFixed(5)}/${lon.toFixed(5)}`,
  };
}

// ---------- Foodsharing ----------
export async function foodsharing() {
  const { value } = await cached('foodsharing-stuttgart', 12 * 3600_000, async () => {
    const j = await fetchJson(FOODSHARING, { timeout: 20_000 });
    return {
      region: { id: j.id, name: j.name, description: j.description ?? null, lat: j.location?.lat, lon: j.location?.lon },
      stats: j.statistics ?? null,
      points: (j.foodSharePoints ?? []).map((p) => ({
        id: p.id, name: p.name, lat: +Number(p.lat).toFixed(6), lon: +Number(p.lon).toFixed(6),
        url: `https://foodsharing.de/?page=fairteiler&bid=${p.id}`,
      })),
      events: (j.events ?? []).slice(0, 8),
    };
  });
  return {
    ...value,
    source: 'foodsharing.de, Region Stuttgart (öffentlicher Regions-Endpunkt)',
    license: 'Fairteiler-Standorte: foodsharing.de; Plattform AGPLv3. Keine Körbe/Statusdaten ohne Login.',
    hinweis: 'Nur die öffentlich freigegebenen Fairteiler-Standorte. Live-Status und Essenskörbe sind nicht öffentlich.',
  };
}

// ---------- GBIF ----------
/** Artenfunde im Umkreis; GBIF-Occurrence-Daten sind CC0. */
export async function gbif(lat = 48.7758, lon = 9.1829, r = 2000) {
  lat = +lat; lon = +lon; r = Math.min(Math.max(+r || 2000, 200), 10_000);
  const key = `gbif-${lat.toFixed(3)}-${lon.toFixed(3)}-${r}`;
  const { value } = await cached(key, 12 * 3600_000, async () => {
    const dLat = r / 111_320;
    const dLon = r / (111_320 * Math.cos((lat * Math.PI) / 180));
    const poly = `POLYGON((${lon - dLon} ${lat - dLat},${lon + dLon} ${lat - dLat},${lon + dLon} ${lat + dLat},${lon - dLon} ${lat + dLat},${lon - dLon} ${lat - dLat}))`;
    const url = `${GBIF}?geometry=${encodeURIComponent(poly)}&hasCoordinate=true&hasGeospatialIssue=false`
      + '&occurrenceStatus=PRESENT&taxonRank=SPECIES&limit=40';
    const j = await fetchJson(url, { timeout: 20_000 });
    const items = (j.results ?? []).filter((x) => x.decimalLatitude != null && x.decimalLongitude != null).map((x) => ({
      id: x.key,
      name: x.vernacularName || x.species || x.scientificName || 'Art',
      scientific: x.scientificName ?? null,
      date: x.eventDate ?? null,
      place: x.locality ?? x.stateProvince ?? null,
      lat: +Number(x.decimalLatitude).toFixed(6),
      lon: +Number(x.decimalLongitude).toFixed(6),
      url: x.key ? `https://www.gbif.org/occurrence/${x.key}` : null,
      dataset: x.datasetKey ?? null,
      license: x.license ?? null,
    }));
    return { items, total: j.count ?? items.length };
  });
  return {
    ...value, lat, lon, radius: r,
    source: 'GBIF.org (Global Biodiversity Information Facility), Occurrence-Daten',
    license: 'CC0 1.0 (Occurrence-Daten); Rechte je Dataset möglich',
    hinweis: 'Historische und aktuelle Funde, keine Aussage über die aktuelle Verbreitung.',
  };
}

// ---------- Wikidata-Lücken ----------
const GAP_QUERY = `SELECT ?item ?itemLabel ?coord WHERE {
  ?item wdt:P131 wd:Q1022; wdt:P625 ?coord.
  FILTER NOT EXISTS { ?article schema:about ?item. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
} LIMIT 100`;
/** Orte in Stuttgart mit Koordinate, aber ohne Wikipedia-Artikel. */
export async function wikidataGaps() {
  const { value } = await cached('wikidata-gaps-stuttgart', 24 * 3600_000, async () => {
    const url = `${WDQS}?format=json&query=${encodeURIComponent(GAP_QUERY)}`;
    const j = await fetchJson(url, { timeout: 45_000, headers: { Accept: 'application/sparql-results+json' } });
    const items = (j.results?.bindings ?? []).map((b) => {
      const qid = b.item?.value?.split('/').pop();
      const m = /Point\(([-0-9.]+) ([-0-9.]+)\)/.exec(b.coord?.value ?? '');
      return {
        id: qid, name: b.itemLabel?.value ?? qid, lat: m ? +m[2] : null, lon: m ? +m[1] : null,
        url: b.item?.value ?? null,
      };
    }).filter((x) => x.id && Number.isFinite(x.lat) && Number.isFinite(x.lon));
    return { items, total: items.length, query: GAP_QUERY };
  });
  return {
    ...value,
    source: 'Wikidata Query Service (CC0)',
    hinweis: 'Objekte mit Bezug zu Stuttgart (P131 = Q1022) und Koordinate, für die kein Wikipedia-Artikel verlinkt ist. Die Abfrage ist eine Momentaufnahme und kein amtlicher Datenbestand.',
  };
}

// ---------- K10plus / SRU ----------
const marcSub = (record, field, code) => {
  const f = new RegExp(`<datafield tag="${field}"[\\s\\S]*?</datafield>`).exec(record)?.[0] ?? '';
  const esc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return unxml(new RegExp(`<subfield code="${esc}">([\\s\\S]*?)</subfield>`).exec(f)?.[1] ?? '');
};
/** Bibliothekskatalog K10plus über SRU (maschinenlesbar, ohne Key). */
export async function bibliothek(q) {
  const t = String(q ?? '').trim();
  if (t.length < 2) return { items: [], total: 0 };
  const { value } = await cached(`k10plus-${t.toLowerCase()}`, 3600_000, async () => {
    const url = `${K10PLUS}?version=1.1&operation=searchRetrieve&query=${encodeURIComponent(`pica.all=${t}`)}&maximumRecords=12`;
    const xml = await fetchText(url, { timeout: 30_000 });
    const total = Number(/<zs:numberOfRecords>(\d+)/.exec(xml)?.[1] ?? 0);
    const items = [...xml.matchAll(/<zs:record>([\s\S]*?)<\/zs:record>/g)].map((m) => {
      const r = m[1];
      const ppn = unxml(/<controlfield tag="001">([\s\S]*?)<\/controlfield>/.exec(r)?.[1] ?? '');
      const title = [marcSub(r, '245', 'a'), marcSub(r, '245', 'b')].filter(Boolean).join(' : ');
      return {
        ppn, title: title || 'Titel unbekannt',
        author: marcSub(r, '100', 'a') || marcSub(r, '700', 'a') || null,
        year: marcSub(r, '264', 'c') || marcSub(r, '260', 'c') || null,
        url: ppn ? `https://kxp.k10plus.de/DB=2.1/PPNSET?PPN=${encodeURIComponent(ppn)}` : 'https://kxp.k10plus.de/',
      };
    }).filter((x) => x.ppn);
    return { items, total };
  });
  return { ...value, query: t, source: 'K10plus / Südwestdeutscher Bibliotheksverbund (SRU)' };
}

// ---------- GovData / DCAT-AP ----------
const seen = diskStore('govdata-stuttgart-seen');
/** Datensätze zu Stuttgart aus GovData (DCAT-AP) und die seit dem letzten Lauf neuen. */
export async function dcatKatalog() {
  const { value } = await cached('govdata-stuttgart', 12 * 3600_000, async () => {
    const j = await fetchJson(`${GOVDATA}?q=Stuttgart&rows=100`, { timeout: 30_000 });
    const results = j.result?.results ?? [];
    return results.map((r) => ({
      id: r.name, title: r.title, notes: r.notes ?? null,
      modified: r.metadata_modified ?? null,
      license: r.license_title ?? r.license_id ?? null,
      organization: r.organization?.title ?? null,
      url: r.name ? `https://www.govdata.de/daten/-/details/${encodeURIComponent(r.name)}` : 'https://www.govdata.de/',
    }));
  });
  const before = new Set(seen.get('names', Infinity) ?? []);
  const fresh = value.filter((x) => !before.has(x.id));
  if (fresh.length) seen.set('names', value.map((x) => x.id).slice(0, 1000));
  return {
    total: value.length, items: value.slice(0, 40), neu: fresh.length ? fresh.slice(0, 20) : [],
    source: 'GovData.de, CKAN-/DCAT-AP-Katalog (Metadaten CC0)',
    hinweis: 'Beim ersten Lauf gilt der gesamte Bestand als Ausgangsstand; danach erscheinen neue Datensätze als Änderungsfeed.',
  };
}

// ---------- OpenData@Stuttgart (CKAN) ----------
const seenStadt = diskStore('stadt-ckan-seen');
/** Datensätze aus dem städtischen CKAN-Portal mit Download-Links. */
export async function stadtKatalog() {
  const { value } = await cached('stadt-ckan', 12 * 3600_000, async () => {
    const j = await fetchJson(`${STADT_CKAN}?rows=200&facet=off`, { timeout: 30_000 });
    const results = j.result?.results ?? [];
    return results.map((r) => ({
      id: r.name,
      title: r.title,
      notes: r.notes ?? null,
      modified: r.metadata_modified ?? null,
      license: r.license_title ?? r.license_id ?? null,
      organization: r.organization?.title ?? null,
      url: `https://opendata.stuttgart.de/dataset/${encodeURIComponent(r.name)}`,
      resources: (r.resources ?? [])
        .filter((x) => x.url)
        .slice(0, 4)
        .map((x) => ({ name: x.name ?? x.format ?? 'Download', format: x.format ?? null, url: x.url })),
    })).sort((a, b) => String(b.modified ?? '').localeCompare(String(a.modified ?? '')));
  });
  const stored = seenStadt.get('names', Infinity);
  const firstRun = stored === undefined;
  const before = new Set(stored ?? []);
  const fresh = firstRun ? [] : value.filter((x) => !before.has(x.id));
  if (firstRun || fresh.length) seenStadt.set('names', value.map((x) => x.id).slice(0, 1000));
  return {
    total: value.length,
    items: value,
    neu: fresh.length ? fresh.slice(0, 20) : [],
    firstRun,
    source: 'Landeshauptstadt Stuttgart, OpenData@Stuttgart (CKAN)',
    hinweis: 'Metadaten und Download-Links des städtischen Portals. Lizenz je Datensatz prüfen; viele Datensätze stehen unter CC BY 4.0.',
    stand: 'CKAN package_search, 12 h zwischengespeichert',
  };
}

// ---------- Kleine Helfer für die Oberfläche ----------
/** Sucht zuerst beim amtlichen Geocoder, fällt bei Ausfall auf Nominatim zurück. */
export async function addressSearch(q) {
  try {
    const r = await geocode(q, 8);
    if (r.items.length) return { items: r.items, source: r.source };
  } catch { /* Fallback */ }
  const r = await nominatimAdresse(q);
  return { items: (r.items ?? []).map((x) => ({ ...x, type: 'Adresse' })), source: r.source };
}

export { STADT_BBOX };
