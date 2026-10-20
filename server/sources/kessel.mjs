// Austauscharme Wetterlage im Talkessel („Kesseldeckel“): Modellwerte von Open-Meteo (Temperatur am Boden und in
// der Höhe, Grenzschichthöhe, Wind) und gemessenes Temperaturprofil aus den Bürgersensoren von Sensor.Community.
import { cached, fetchJson } from '../cache.mjs';

const OM = 'https://api.open-meteo.com/v1/forecast?latitude=48.7784&longitude=9.18&timezone=GMT&forecast_days=2&past_days=0' +
  '&hourly=temperature_2m,temperature_925hPa,temperature_850hPa,boundary_layer_height,wind_speed_10m';
const SC = 'https://data.sensor.community/airrohr/v1/filter/area=48.7784,9.18,6';

/** Stufe: 2 = geschlossen (Inversion, flache Grenzschicht, schwacher Wind), 1 = teilweise, 0 = offen */
function level(dT, bl, wind) {
  if (dT == null) return null;
  if (dT >= 0 && (bl ?? 9999) < 300 && (wind ?? 99) < 10) return 2;
  if (dT >= -1.5 || (bl ?? 9999) < 300) return 1;
  return 0;
}

async function model() {
  const { value, at } = await cached('kessel-model', 60 * 60_000, async () => {
    const d = await fetchJson(OM, { timeout: 15000 });
    const h = d.hourly;
    return {
      elevation: d.elevation ?? null,
      hours: h.time.map((t, i) => {
        const t2 = h.temperature_2m[i], t925 = h.temperature_925hPa[i];
        const dT = t2 != null && t925 != null ? +(t925 - t2).toFixed(1) : null;
        return {
          t: `${t}:00Z`, t2, t925, t850: h.temperature_850hPa[i], bl: h.boundary_layer_height[i], wind: h.wind_speed_10m[i],
          dT, level: level(dT, h.boundary_layer_height[i], h.wind_speed_10m[i]),
        };
      }),
    };
  });
  return { ...value, fetchedAt: new Date(at).toISOString() };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const BANDS = [[200, 260], [260, 320], [320, 400], [400, 600]];

async function profile() {
  const { value, at } = await cached('kessel-profile', 10 * 60_000, async () => {
    const d = await fetchJson(SC, { timeout: 20000 });
    const cutoff = Date.now() - 30 * 60_000;
    const pts = new Map();
    for (const x of d) {
      if (x.location?.indoor) continue;
      const alt = Number(x.location?.altitude);
      const tv = x.sensordatavalues?.find((v) => v.value_type === 'temperature');
      const ts = Date.parse(`${x.timestamp.replace(' ', 'T')}Z`);
      if (!tv || !Number.isFinite(alt) || alt <= 0 || ts < cutoff) continue;
      const temp = Number(tv.value);
      if (!Number.isFinite(temp) || temp < -30 || temp > 45) continue;
      pts.set(x.location.id, { alt, temp }); // je Standort ein Wert
    }
    let list = [...pts.values()];
    const bands = BANDS.map(([a, b]) => {
      const inBand = list.filter((p) => p.alt >= a && p.alt < b);
      if (!inBand.length) return { from: a, to: b, n: 0, median: null };
      const m = median(inBand.map((p) => p.temp));
      // Ausreißer (Sonne, Hauswand): mehr als 3 K vom Median des Bandes entfernt
      const ok = inBand.filter((p) => Math.abs(p.temp - m) <= 3);
      return { from: a, to: b, n: ok.length, median: +median(ok.map((p) => p.temp)).toFixed(1), keep: ok };
    });
    list = bands.flatMap((b) => b.keep ?? []);
    // Steigung der Temperatur mit der Höhe (K je 100 m), kleinste Quadrate
    let slope = null;
    if (list.length >= 8) {
      const mx = list.reduce((s, p) => s + p.alt, 0) / list.length;
      const my = list.reduce((s, p) => s + p.temp, 0) / list.length;
      const sxy = list.reduce((s, p) => s + (p.alt - mx) * (p.temp - my), 0);
      const sxx = list.reduce((s, p) => s + (p.alt - mx) ** 2, 0);
      slope = sxx ? +((sxy / sxx) * 100).toFixed(2) : null;
    }
    return { n: list.length, slope, bands: bands.map(({ keep, ...b }) => b) };
  });
  return { ...value, fetchedAt: new Date(at).toISOString() };
}

export async function kessel() {
  const [m, p] = await Promise.allSettled([model(), profile()]);
  return {
    model: m.status === 'fulfilled' ? m.value : null,
    modelError: m.status === 'rejected' ? m.reason.message : null,
    profile: p.status === 'fulfilled' ? p.value : null,
    profileError: p.status === 'rejected' ? p.reason.message : null,
    source: 'Modell: Open-Meteo (CC BY 4.0); Messung: Sensor.Community (ODbL)',
  };
}
