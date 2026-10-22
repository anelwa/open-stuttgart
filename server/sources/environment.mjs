// Umwelt: Luftqualität (Umweltbundesamt), Wetter und Warnungen (DWD über Bright Sky), Neckarpegel (WSV PEGELONLINE)
// sowie amtliche Bevölkerungsschutz-Warnungen (BBK NINA / MoWaS) mit Warngebiets-Polygonen.
import { cached, fetchJson } from '../cache.mjs';
import { facilities } from './nearby.mjs';

const UBA = 'https://luftdaten.umweltbundesamt.de/api/air-data/v4';
// Aktive Stuttgarter Messstationen (UBA-ID). Am Neckartor liefert seit August 2026 keine Werte.
const STATIONS = [
  { id: '224', code: 'DEBW013', name: 'Bad Cannstatt', type: 'Hintergrund', lat: 48.8088, lon: 9.2297 },
  { id: '317', code: 'DEBW116', name: 'Hohenheimer Straße', type: 'Verkehr', lat: 48.7687, lon: 9.1845 },
  { id: '319', code: 'DEBW118', name: 'Am Neckartor', type: 'Verkehr', lat: 48.7881, lon: 9.191 },
  { id: '10470', code: 'DEBW249', name: 'Hauptstätter Straße', type: 'Verkehr', lat: 48.7662, lon: 9.1709 },
];
const COMPONENTS = { 1: 'PM10', 3: 'O₃', 5: 'NO₂', 9: 'PM2,5' };
const INDEX = ['sehr gut', 'gut', 'mäßig', 'schlecht', 'sehr schlecht'];

const berlinDate = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d);

export async function air() {
  const { value, at, fresh } = await cached('air', 15 * 60_000, async () => {
    const today = berlinDate(new Date());
    const yesterday = berlinDate(new Date(Date.now() - 86400_000));
    const stations = await Promise.all(STATIONS.map(async (s) => {
      try {
        const d = await fetchJson(`${UBA}/airquality/json?date_from=${yesterday}&time_from=1&date_to=${today}&time_to=24&station=${s.id}&lang=de`);
        const series = d.data?.[s.id] ?? {};
        const keys = Object.keys(series).sort();
        const lastKey = keys.at(-1);
        if (!lastKey) return { ...s, index: null, measuredAt: null, components: [] };
        const row = series[lastKey];
        const history = keys.slice(-24).map((k) => ({ t: k, index: series[k][1] }));
        return {
          ...s,
          index: row[1],
          label: INDEX[row[1]] ?? null,
          measuredAt: row[0], // Ende der Messstunde, MEZ/MESZ
          components: row.slice(3).map(([c, v, i]) => ({ id: c, name: COMPONENTS[c] ?? String(c), value: v, index: i })),
          history,
        };
      } catch (e) {
        return { ...s, index: null, measuredAt: null, components: [], error: String(e.message ?? e) };
      }
    }));
    return stations;
  });
  return { stations: value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Umweltbundesamt mit Daten der LUBW (dl-de/by-2-0)' };
}

export async function weather() {
  const { value, at, fresh } = await cached('weather', 10 * 60_000, async () => {
    const hour = (ms) => new Date(ms).toISOString().slice(0, 13) + ':00';
    const [cur, alerts, fc] = await Promise.allSettled([
      fetchJson('https://api.brightsky.dev/current_weather?lat=48.7784&lon=9.1800', { timeout: 10000 }),
      fetchJson('https://api.brightsky.dev/alerts?lat=48.7784&lon=9.1800', { timeout: 10000 }),
      fetchJson(`https://api.brightsky.dev/weather?lat=48.7784&lon=9.18&date=${hour(Date.now() - 3 * 3600_000)}&last_date=${hour(Date.now() + 24 * 3600_000)}`, { timeout: 10000 }),
    ]);
    const hours = fc.status === 'fulfilled' ? fc.value.weather ?? [] : [];
    let w = cur.status === 'fulfilled' ? cur.value.weather : null;
    let station = cur.status === 'fulfilled' ? cur.value.sources?.[0]?.station_name : null;
    if (!w) {
      // Ausweichen auf den Stundenwert, der am nächsten an jetzt liegt (Bright Sky liefert gelegentlich 502)
      const now = Date.now();
      w = hours.reduce((best, h) => (!best || Math.abs(Date.parse(h.timestamp) - now) < Math.abs(Date.parse(best.timestamp) - now) ? h : best), null);
      if (w) w = { ...w, wind_speed_10: w.wind_speed, wind_direction_10: w.wind_direction, wind_gust_speed_10: w.wind_gust_speed, precipitation_60: w.precipitation };
      station = fc.status === 'fulfilled' ? fc.value.sources?.find((s) => s.observation_type !== 'forecast')?.station_name ?? fc.value.sources?.[0]?.station_name : null;
    }
    if (!w) throw new Error('Bright Sky nicht erreichbar');
    const upcoming = hours.filter((h) => Date.parse(h.timestamp) >= Date.now() - 3600_000);
    return {
      temperature: w.temperature,
      condition: w.condition,
      icon: w.icon,
      humidity: w.relative_humidity,
      wind: w.wind_speed_10 ?? w.wind_speed_30,
      windDirection: w.wind_direction_10,
      gust: w.wind_gust_speed_10,
      precipitation: w.precipitation_60,
      cloud: w.cloud_cover,
      pressure: w.pressure_msl,
      visibility: w.visibility ?? null,
      measuredAt: w.timestamp,
      station: station ?? 'Stuttgart-Schnarrenberg',
      forecast: upcoming.filter((_, i) => i % 3 === 0).slice(0, 8).map((h) => ({
        t: h.timestamp, temperature: h.temperature, icon: h.icon, precipitation: h.precipitation,
      })),
      hourly: upcoming.slice(0, 30).map((h) => ({ t: h.timestamp, temperature: h.temperature, icon: h.icon, precipitation: h.precipitation, visibility: h.visibility ?? null, cloud: h.cloud_cover ?? null })),
      alerts: (alerts.status === 'fulfilled' ? alerts.value.alerts ?? [] : []).map((a) => ({
        headline: a.headline_de ?? a.event_de, severity: a.severity, onset: a.onset, expires: a.expires, description: a.description_de,
      })),
    };
  });
  return { ...value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Deutscher Wetterdienst über Bright Sky' };
}

export async function water() {
  const { value, at, fresh } = await cached('water', 15 * 60_000, async () => {
    const base = 'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/CANNSTATT%20SCHLEUSE%20UP';
    const [cur, series] = await Promise.all([
      fetchJson(`${base}/W/currentmeasurement.json`),
      fetchJson(`${base}/W/measurements.json?start=P1D`).catch(() => []),
    ]);
    return {
      station: 'Neckar, Pegel Cannstatt',
      value: cur.value,
      unit: 'cm',
      measuredAt: cur.timestamp,
      state: cur.stateNswHsw,
      series: series.filter((_, i) => i % 4 === 0).map((m) => ({ t: m.timestamp, v: m.value })),
      lat: 48.7999, lon: 9.2178,
    };
  });
  return { ...value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Wasserstraßen- und Schifffahrtsverwaltung des Bundes (PEGELONLINE)' };
}

// ---------- Amtliche Bevölkerungsschutz-Warnungen (BBK NINA / MoWaS, ARS Stuttgart 081110000000) ----------
const NINA_DASHBOARD = 'https://warnung.bund.de/api31/dashboard/081110000000.json';
const ninaDetailUrl = (id) => {
  const s = String(id ?? '');
  const prefix = /^mow/i.test(s) ? 'mowas' : /^kat/i.test(s) ? 'katwarn' : /^biw/i.test(s) ? 'biwapp' : /^dwd/i.test(s) ? 'dwd' : /^lhp/i.test(s) ? 'lhp' : 'mowas';
  return `https://warnung.bund.de/api31/${prefix}/${encodeURIComponent(s)}.json`;
};

/** CAP-Polygon (WKT „lat lon lat lon …“) in GeoJSON-Koordinaten [lon, lat] wandeln */
function capPolygon(wkt) {
  const txt = String(wkt ?? '').replace(/POLYGON\s*\(\(/i, '').replace(/\)+\s*$/, '').trim();
  if (!txt) return null;
  const pts = txt.split(/[\s,]+/).map(Number).filter(Number.isFinite);
  const ring = [];
  for (let i = 0; i + 1 < pts.length; i += 2) ring.push([pts[i + 1], pts[i]]);
  return ring.length >= 3 ? ring : null;
}

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const ringCenter = (ring) => {
  const n = ring.length;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
};

const R = 6371000;
const distM = (a, b) => {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180; const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Notfall-Treffpunkt und Leuchtturm außerhalb des Warngebiets, nächstgelegen zum Gebietsmittelpunkt */
async function notfallAusserhalb(polygon) {
  if (!polygon) return null;
  let items = [];
  try { items = (await facilities('notfall')).items; } catch { return null; }
  const mitte = ringCenter(polygon);
  const draussen = (f) => !inRing([f.lon, f.lat], polygon);
  const sortiert = items.filter(draussen).map((f) => ({ ...f, dist: Math.round(distM(mitte, [f.lon, f.lat])) })).sort((a, b) => a.dist - b.dist);
  return {
    treffpunkt: sortiert.find((f) => f.info?.includes('Notfall-Treffpunkt')) ?? null,
    leuchtturm: sortiert.find((f) => f.info?.includes('Notfall-Leuchtturm')) ?? null,
  };
}

export async function warnungen() {
  const { value, at, fresh } = await cached('bbk-nina-081110000000', 2 * 60_000, async () => {
    const list = await fetchJson(NINA_DASHBOARD, { timeout: 12000 });
    const raw = Array.isArray(list) ? list : [];
    const items = await Promise.all(raw.slice(0, 10).map(async (w) => {
      const id = w.id ?? w.payload?.id;
      let detail = null;
      if (id) {
        detail = await fetchJson(ninaDetailUrl(id), { timeout: 8000 }).catch(() => null);
      }
      const info = detail?.info?.[0] ?? {};
      const data = w.payload?.data ?? {};
      const areas = info.area ?? [];
      const withPoly = areas.map((a) => ({ desc: a.areaDesc ?? null, polygon: capPolygon(a.polygon) })).filter((a) => a.polygon);
      const polygon = withPoly[0]?.polygon ?? null;
      const notfall = polygon ? await notfallAusserhalb(polygon).catch(() => null) : null;
      return {
        id: String(id ?? ''),
        title: w.i18nTitle?.de ?? info.headline ?? data.headline ?? 'Amtliche Warnmeldung',
        severity: info.severity ?? data.severity ?? w.severity ?? 'Minor',
        msgType: w.payload?.type ?? detail?.msgType ?? 'Alert',
        provider: data.provider ?? info.senderName ?? 'BBK / MoWaS',
        sent: w.sent ?? detail?.sent ?? null,
        onset: info.onset ?? w.onset ?? null,
        expires: info.expires ?? w.expires ?? null,
        description: info.description ? String(info.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
        instruction: info.instruction ? String(info.instruction).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
        area: info.area?.[0]?.areaDesc ?? data.area?.description ?? 'Landeshauptstadt Stuttgart',
        polygon: polygon ? polygon.map(([lon, lat]) => [+lon.toFixed(5), +lat.toFixed(5)]) : null,
        notfall,
      };
    }));
    return items;
  });
  return {
    ars: '081110000000',
    items: value,
    activeCount: value.length,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'Bundesamt für Bevölkerungsschutz und Katastrophenhilfe (BBK), Warn-App NINA / MoWaS (dl-de/by-2-0); Notfall-Treffpunkte: Landeshauptstadt Stuttgart (CC BY 4.0)',
  };
}

