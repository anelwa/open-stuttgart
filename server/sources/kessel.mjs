// Austauscharme Wetterlage im Talkessel („Kesseldeckel“): Modellwerte von Open-Meteo (Temperatur am Boden und in
// der Höhe, Grenzschichthöhe, Wind) und gemessenes Temperaturprofil aus den Bürgersensoren von Sensor.Community
// sowie den Umweltmessboxen der openSenseMap (Universität Münster / ifgi).
import { cached, fetchJson } from '../cache.mjs';

const OM = 'https://api.open-meteo.com/v1/forecast?latitude=48.7784&longitude=9.18&timezone=GMT&forecast_days=2&past_days=0' +
  '&hourly=temperature_2m,temperature_925hPa,temperature_850hPa,boundary_layer_height,wind_speed_10m';
const SC = 'https://data.sensor.community/airrohr/v1/filter/area=48.7784,9.18,6';
const OSEM = 'https://api.opensensemap.org/boxes?bbox=9.03,48.68,9.32,48.87';

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
    const [scRes, osemRes] = await Promise.allSettled([
      fetchJson(SC, { timeout: 20000 }),
      fetchJson(OSEM, { timeout: 15000 }),
    ]);
    const d = scRes.status === 'fulfilled' && Array.isArray(scRes.value) ? scRes.value : [];
    const boxes = osemRes.status === 'fulfilled' && Array.isArray(osemRes.value) ? osemRes.value : [];
    if (!d.length && !boxes.length) throw new Error('Sensordaten nicht erreichbar');

    const cutoff = Date.now() - 30 * 60_000;
    const osemCutoff = Date.now() - 2 * 3600_000;
    const pts = new Map();
    let scCount = 0;
    for (const x of d) {
      if (x.location?.indoor) continue;
      const alt = Number(x.location?.altitude);
      const tv = x.sensordatavalues?.find((v) => v.value_type === 'temperature');
      const ts = Date.parse(`${String(x.timestamp ?? '').replace(' ', 'T')}Z`);
      if (!tv || !Number.isFinite(alt) || alt <= 0 || ts < cutoff) continue;
      const temp = Number(tv.value);
      if (!Number.isFinite(temp) || temp < -30 || temp > 45) continue;
      if (!pts.has(x.location.id)) scCount += 1;
      pts.set(x.location.id, { alt, temp });
    }

    let osemActive = 0;
    let osemInProfile = 0;
    const osemTemps = [];
    const osemPm10 = [];
    const osemItems = [];
    for (const b of boxes) {
      if (b.exposure === 'indoor') continue;
      const coords = b.currentLocation?.coordinates ?? b.loc?.[0]?.geometry?.coordinates ?? [];
      const lon = Number(coords[0]), lat = Number(coords[1]), alt = Number(coords[2]);
      let temp = null, pm10 = null, pm25 = null, latestTs = null;
      for (const s of b.sensors ?? []) {
        const m = s.lastMeasurement;
        if (!m || m.value == null) continue;
        const ts = Date.parse(m.createdAt);
        if (!Number.isFinite(ts) || ts < osemCutoff) continue;
        const val = Number(m.value);
        if (!Number.isFinite(val)) continue;
        const title = String(s.title ?? '').toLowerCase();
        if ((title.includes('temp') || s.unit === '°C') && val >= -30 && val <= 45) {
          temp = val;
          if (!latestTs || ts > latestTs) latestTs = ts;
        } else if (title.includes('pm10') && val >= 0 && val <= 500) {
          pm10 = val;
          if (!latestTs || ts > latestTs) latestTs = ts;
        } else if ((title.includes('pm2.5') || title.includes('pm25')) && val >= 0 && val <= 500) {
          pm25 = val;
          if (!latestTs || ts > latestTs) latestTs = ts;
        }
      }
      if (temp != null || pm10 != null || pm25 != null) {
        osemActive += 1;
        if (temp != null) osemTemps.push(temp);
        if (pm10 != null) osemPm10.push(pm10);
        osemItems.push({
          id: b._id,
          name: b.name,
          lat: Number.isFinite(lat) ? lat : null,
          lon: Number.isFinite(lon) ? lon : null,
          alt: Number.isFinite(alt) && alt > 0 ? Math.round(alt) : null,
          temp: temp != null ? +temp.toFixed(1) : null,
          pm10: pm10 != null ? +pm10.toFixed(1) : null,
          pm25: pm25 != null ? +pm25.toFixed(1) : null,
          measuredAt: latestTs ? new Date(latestTs).toISOString() : null,
        });
      }
      if (temp != null && Number.isFinite(alt) && alt > 150 && alt < 650) {
        pts.set(`osem-${b._id}`, { alt, temp });
        osemInProfile += 1;
      }
    }

    let list = [...pts.values()];
    const bands = BANDS.map(([a, b]) => {
      const inBand = list.filter((p) => p.alt >= a && p.alt < b);
      if (!inBand.length) return { from: a, to: b, n: 0, median: null };
      const m = median(inBand.map((p) => p.temp));
      // Ausreißer (Sonne, Hauswand): mehr als 3 K vom Median des Bandes entfernt
      const ok = inBand.filter((p) => Math.abs(p.temp - m) <= 3);
      return { from: a, to: b, n: ok.length, median: ok.length ? +median(ok.map((p) => p.temp)).toFixed(1) : null, keep: ok };
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
    return {
      n: list.length,
      scCount,
      osemInProfile,
      slope,
      bands: bands.map(({ keep, ...b }) => b),
      opensensemap: {
        totalBoxes: boxes.length,
        activeBoxes: osemActive,
        medianTemp: osemTemps.length ? +median(osemTemps).toFixed(1) : null,
        medianPm10: osemPm10.length ? +median(osemPm10).toFixed(1) : null,
        boxes: osemItems.slice(0, 8),
      },
    };
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
    source: 'Modell: Open-Meteo (CC BY 4.0); Messung: Sensor.Community (ODbL) und openSenseMap (CC BY 4.0)',
  };
}

// ---------- Kaltluftabfluss im Talkessel (Klimaatlas der Stadt, A36_KLIMA_KALTLUFTWIND_U1_STGT) ----------
// Vektorfeld der nächtlichen Kaltluftströme: Richtung (WINDRI, Grad, gegenläufige Richtungen möglich),
// Geschwindigkeit (WINDGE, m/s) und Volumenstrom (WINDVO) je Messrasterpunkt.
const WFS_KLIMA = 'https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=GEOLINE_FLEX:A36_KLIMA_KALTLUFTWIND_U1_STGT_EPSG25832&count=2000';

export async function kaltluft() {
  const { value, at, fresh } = await cached('kaltluft-stuttgart', 24 * 3600_000, async () => {
    const j = await fetchJson(WFS_KLIMA, { timeout: 30000 });
    const punkte = (j.features ?? []).map((f) => {
      const c = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
      const p = f.properties ?? {};
      if (!c) return null;
      const ri = Number(p.WINDRI1);
      const ge = Number(p.WINDGE1);
      const vo = Number(p.WINDVO1);
      return {
        lon: +c[0].toFixed(5), lat: +c[1].toFixed(5),
        ri: Number.isFinite(ri) ? +(((ri % 360) + 360) % 360).toFixed(0) : null,
        ge: Number.isFinite(ge) ? +ge.toFixed(2) : null,
        vo: Number.isFinite(vo) ? +vo.toFixed(2) : null,
      };
    }).filter((p) => p && p.ri != null && (p.ge ?? 0) > 0.05);
    // Für die Karte ausdünnen: höchstens 220 Pfeile, gleichmäßig verteilt
    const step = Math.max(1, Math.ceil(punkte.length / 220));
    return { punkte: punkte.filter((_, i) => i % step === 0), anzahl: punkte.length };
  });
  return {
    ...value,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'Landeshauptstadt Stuttgart, Klimaatlas (CC BY 4.0): Kaltluftwind und -abfluss (Modellraster)',
  };
}

