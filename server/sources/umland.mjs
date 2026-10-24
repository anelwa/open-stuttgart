// Umland: Ausflugsziele in der Region Stuttgart.
//
// Die Ziele liegen als redaktioneller Datensatz in server/data/umland-ziele.json.
// Der Server ergänzt die nächsten Haltestellen aus dem VVS-/GTFS-Bestand, liefert
// die Punkte als GeoJSON für die Karte und holt für die Detailansicht den
// Wikipedia-Kurztext sowie eine Punktvorhersage von Open-Meteo. Beides wird
// zwischengespeichert; ohne erreichbare Quelle bleibt der übrige Datensatz nutzbar.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cached, fetchJson } from '../cache.mjs';
import { wikiSummary } from './culture.mjs';

const FILE = process.env.OS_UMLAND ?? fileURLToPath(new URL('../data/umland-ziele.json', import.meta.url));
// Im Entwicklungsbetrieb liegt die Datei unter public/, im Container nur im gebauten dist/.
const STOP_FILES = [
  fileURLToPath(new URL('../../public/data/stops.geojson', import.meta.url)),
  fileURLToPath(new URL('../../dist/data/stops.geojson', import.meta.url)),
];
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Kategorien, Farben und Symbolnamen für Liste und Karte. */
export const KATEGORIEN = {
  schloss: { label: 'Schlösser, Burgen und Gärten', kurz: 'Schloss', farbe: '#8A4B08', icon: 'monument' },
  kloster: { label: 'Klöster und Kirchen', kurz: 'Kloster', farbe: '#5D5C62', icon: 'church' },
  museum: { label: 'Museen', kurz: 'Museum', farbe: '#6D4AA8', icon: 'culture' },
  stadt: { label: 'Altstädte', kurz: 'Altstadt', farbe: '#B85C00', icon: 'home' },
  natur: { label: 'Natur und Aussicht', kurz: 'Natur', farbe: '#2F8F5B', icon: 'tree' },
  see: { label: 'Seen', kurz: 'See', farbe: '#1E6FD9', icon: 'water' },
  wein: { label: 'Wein und Genuss', kurz: 'Wein', farbe: '#8E2F4A', icon: 'leaf' },
  therme: { label: 'Thermen und Wellness', kurz: 'Therme', farbe: '#0E7C86', icon: 'drop' },
};

/** Kreise der Region Stuttgart, in denen Ziele liegen. */
export const KREISE = {
  'Böblingen': { label: 'Landkreis Böblingen', lat: 48.685, lon: 9.011 },
  'Esslingen': { label: 'Landkreis Esslingen', lat: 48.7406, lon: 9.3103 },
  'Göppingen': { label: 'Landkreis Göppingen', lat: 48.703, lon: 9.652 },
  'Ludwigsburg': { label: 'Landkreis Ludwigsburg', lat: 48.897, lon: 9.192 },
  'Rems-Murr-Kreis': { label: 'Rems-Murr-Kreis', lat: 48.83, lon: 9.32 },
};

const UMLAND_BBOX = { minLon: 8.3, maxLon: 10.0, minLat: 48.25, maxLat: 49.3 };

let raw = null;
let stopCache = null;

function readZiele() {
  if (raw) return raw;
  raw = JSON.parse(readFileSync(FILE, 'utf8'));
  if (!Array.isArray(raw.ziele)) raw.ziele = [];
  return raw;
}

function stops() {
  if (stopCache) return stopCache;
  for (const file of STOP_FILES) {
    try {
      const fc = JSON.parse(readFileSync(file, 'utf8'));
      stopCache = (fc.features ?? []).map((f) => ({
        id: f.properties.id,
        name: f.properties.name,
        kind: f.properties.kind,
        lines: f.properties.lines ?? [],
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      }));
      return stopCache;
    } catch { /* nächster Pfad */ }
  }
  stopCache = [];
  return stopCache;
}

function dist(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const walkMin = (m) => Math.max(1, Math.round((m * 1.3) / 75));

function nearestStops(lat, lon, n = 3, maxM = 3000) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const seen = new Set();
  return stops()
    .map((s) => ({ ...s, dist: Math.round(dist([lon, lat], [s.lon, s.lat])) }))
    .sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name, 'de'))
    .filter((s) => s.dist <= maxM && (seen.has(s.name) ? false : (seen.add(s.name), true)))
    .slice(0, n)
    .map((s) => ({ ...s, walkMin: walkMin(s.dist) }));
}

/** Ein Ziel mit Kategorie-Farbe, nächsten Haltestellen und optionaler Entfernung. */
function enrich(z, origin = null) {
  const k = KATEGORIEN[z.kategorie] ?? KATEGORIEN.stadt;
  const kreis = KREISE[z.kreis] ?? { label: z.kreis };
  const nearest = nearestStops(z.lat, z.lon);
  const out = {
    ...z,
    kategorieLabel: k.label,
    kategorieKurz: k.kurz,
    farbe: k.farbe,
    icon: k.icon,
    kreisLabel: kreis.label,
    naechsteHaltestellen: nearest,
    naechsteHaltestelle: nearest[0] ?? null,
  };
  if (origin) {
    out.entfernungM = Math.round(dist(origin, [z.lon, z.lat]));
  }
  return out;
}

function kategorien(ziele) {
  return Object.entries(KATEGORIEN).map(([id, k]) => ({
    id,
    ...k,
    anzahl: ziele.filter((z) => z.kategorie === id).length,
  })).filter((k) => k.anzahl > 0);
}

function kreise(ziele) {
  return Object.entries(KREISE).map(([id, k]) => ({
    id,
    ...k,
    anzahl: ziele.filter((z) => z.kreis === id).length,
  })).filter((k) => k.anzahl > 0);
}

const INT = (v, min, max, fallback) => {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

/** Liste mit Filtern: Kategorie, Kreis, Suche, Nähe zu einem Punkt. */
export function umlandZiele({ kategorie, kreis, q, lat, lon, r, familie, limit } = {}) {
  const data = readZiele();
  const kat = String(kategorie ?? 'alle').trim();
  const kr = String(kreis ?? 'alle').trim();
  const text = String(q ?? '').trim().toLowerCase();
  const latN = lat == null || lat === '' ? NaN : Number(lat);
  const lonN = lon == null || lon === '' ? NaN : Number(lon);
  const hasOrigin = Number.isFinite(latN) && Number.isFinite(lonN);
  const origin = hasOrigin ? [lonN, latN] : null;
  const maxM = INT(r, 1000, 120000, 120000);
  let items = data.ziele.map((z) => enrich(z, origin));
  if (kat && kat !== 'alle') items = items.filter((z) => z.kategorie === kat);
  if (kr && kr !== 'alle') items = items.filter((z) => z.kreis === kr);
  if (familie === true || familie === 'true' || familie === '1') items = items.filter((z) => z.familie);
  if (text) {
    items = items.filter((z) => `${z.name} ${z.kurz} ${z.beschreibung} ${z.gemeinde} ${z.kreis}`.toLowerCase().includes(text));
  }
  if (origin) {
    items = items.filter((z) => z.entfernungM <= maxM)
      .sort((a, b) => a.entfernungM - b.entfernungM || a.name.localeCompare(b.name, 'de'));
  } else {
    const order = Object.keys(KATEGORIEN);
    items.sort((a, b) => order.indexOf(a.kategorie) - order.indexOf(b.kategorie) || a.name.localeCompare(b.name, 'de'));
  }
  const total = items.length;
  const n = INT(limit, 1, 100, 60);
  return {
    items: items.slice(0, n),
    total,
    kategorien: kategorien(data.ziele),
    kreise: kreise(data.ziele),
    stand: data.stand ?? null,
    source: data.quelle ?? 'Kuratierte Auswahl; Haltestellen aus dem VVS-Fahrplan; Wetter von Open-Meteo',
    lizenz: data.lizenz ?? null,
    hinweis: data.hinweis ?? null,
  };
}

export function umlandMeta() {
  const data = readZiele();
  const alle = data.ziele.map((z) => enrich(z));
  return {
    titel: data.titel ?? 'Ausflugsziele im Umland',
    anzahl: alle.length,
    kategorien: kategorien(data.ziele),
    kreise: kreise(data.ziele),
    stand: data.stand ?? null,
    source: data.quelle ?? null,
    lizenz: data.lizenz ?? null,
    hinweis: data.hinweis ?? null,
    bbox: (() => {
      const lons = alle.map((z) => z.lon);
      const lats = alle.map((z) => z.lat);
      return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
    })(),
  };
}

export function umlandGeoJson() {
  const data = readZiele();
  return {
    type: 'FeatureCollection',
    features: data.ziele.map((z) => {
      const k = KATEGORIEN[z.kategorie] ?? KATEGORIEN.stadt;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [z.lon, z.lat] },
        properties: {
          id: z.id,
          name: z.name,
          kategorie: z.kategorie,
          kategorieLabel: k.label,
          farbe: k.farbe,
          icon: k.icon,
          kreis: z.kreis,
          gemeinde: z.gemeinde,
          kurz: z.kurz,
          image: z.image ?? null,
          familie: !!z.familie,
        },
      };
    }),
    stand: data.stand ?? null,
    source: data.quelle ?? null,
    lizenz: data.lizenz ?? null,
  };
}

const WMO = {
  0: ['klar', 'sun'], 1: ['überwiegend klar', 'sun'], 2: ['teilweise bewölkt', 'cloud'], 3: ['bedeckt', 'cloud'],
  45: ['nebelig', 'cloud'], 48: ['nebelig mit Reif', 'cloud'],
  51: ['leichter Nieselregen', 'rain'], 53: ['Nieselregen', 'rain'], 55: ['starker Nieselregen', 'rain'],
  56: ['gefrierender Nieselregen', 'rain'], 57: ['starker gefrierender Nieselregen', 'rain'],
  61: ['leichter Regen', 'rain'], 63: ['Regen', 'rain'], 65: ['starker Regen', 'rain'],
  66: ['gefrierender Regen', 'rain'], 67: ['starker gefrierender Regen', 'rain'],
  71: ['leichter Schneefall', 'cloud'], 73: ['Schneefall', 'cloud'], 75: ['starker Schneefall', 'cloud'], 77: ['Schneegriesel', 'cloud'],
  80: ['leichte Regenschauer', 'rain'], 81: ['Regenschauer', 'rain'], 82: ['starke Regenschauer', 'rain'],
  85: ['leichte Schneeschauer', 'cloud'], 86: ['starke Schneeschauer', 'cloud'],
  95: ['Gewitter', 'rain'], 96: ['Gewitter mit Hagel', 'rain'], 99: ['starkes Gewitter mit Hagel', 'rain'],
};
const wmo = (code) => {
  const [text, icon] = WMO[Number(code)] ?? ['wechselhaft', 'cloud'];
  return { text, icon };
};

/** Punktvorhersage für ein Ziel (Open-Meteo, CC BY 4.0). */
export async function umlandWetter(lat, lon, ort = null) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)
    || la < UMLAND_BBOX.minLat || la > UMLAND_BBOX.maxLat
    || lo < UMLAND_BBOX.minLon || lo > UMLAND_BBOX.maxLon) {
    throw Object.assign(new Error('Koordinaten liegen außerhalb der Region'), { status: 400 });
  }
  const key = `umland-wetter:${la.toFixed(3)}:${lo.toFixed(3)}`;
  const { value, at, fresh, error } = await cached(key, 30 * 60_000, async () => {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${la.toFixed(4)}&longitude=${lo.toFixed(4)}`
      + '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
      + '&timezone=Europe%2FBerlin&forecast_days=3';
    const d = await fetchJson(url, { timeout: 15000 });
    const c = d.current ?? {};
    const daily = d.daily ?? {};
    const cur = wmo(c.weather_code);
    return {
      aktuell: {
        t: c.time ? `${c.time}:00` : null,
        temperature: c.temperature_2m ?? null,
        apparent: c.apparent_temperature ?? null,
        precipitation: c.precipitation ?? null,
        wind: c.wind_speed_10m ?? null,
        code: c.weather_code ?? null,
        ...cur,
      },
      tage: (daily.time ?? []).map((date, i) => {
        const w = wmo(daily.weather_code?.[i]);
        return {
          date,
          code: daily.weather_code?.[i] ?? null,
          min: daily.temperature_2m_min?.[i] ?? null,
          max: daily.temperature_2m_max?.[i] ?? null,
          regen: daily.precipitation_probability_max?.[i] ?? null,
          ...w,
        };
      }),
      elevation: d.elevation ?? null,
    };
  });
  return {
    ort: ort ?? null,
    ...value,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    ...(error ? { error } : {}),
    source: 'Open-Meteo (CC BY 4.0), Modelldaten; keine amtliche Warnung',
  };
}

/** Detail: Ziel, nächste Haltestellen, Wikipedia-Kurztext und Wetter. */
export async function umlandZiel(id, { lat, lon } = {}) {
  const data = readZiele();
  const found = data.ziele.find((z) => z.id === id);
  if (!found) throw Object.assign(new Error('Ausflugsziel nicht gefunden'), { status: 404 });
  const latN = lat == null || lat === '' ? NaN : Number(lat);
  const lonN = lon == null || lon === '' ? NaN : Number(lon);
  const origin = Number.isFinite(latN) && Number.isFinite(lonN) ? [lonN, latN] : null;
  const ziel = enrich(found, origin);
  const [wiki, wetter] = await Promise.allSettled([
    found.wikipedia ? wikiSummary(found.wikipedia) : Promise.resolve(null),
    umlandWetter(found.lat, found.lon, found.name),
  ]);
  return {
    ...ziel,
    wiki: wiki.status === 'fulfilled' ? wiki.value : null,
    wetter: wetter.status === 'fulfilled' ? wetter.value : null,
    wetterFehler: wetter.status === 'rejected' ? String(wetter.reason?.message ?? wetter.reason) : null,
    stand: found.stand ?? data.stand ?? null,
    source: data.quelle ?? null,
    lizenz: data.lizenz ?? null,
    hinweis: data.hinweis ?? null,
  };
}
