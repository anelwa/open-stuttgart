// Umwelt: Luftqualität (Umweltbundesamt), Wetter und Warnungen (DWD über Bright Sky), Neckarpegel (WSV PEGELONLINE).
import { cached, fetchJson } from '../cache.mjs';

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
