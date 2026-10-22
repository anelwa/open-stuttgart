// Himmel über Stuttgart: Luftfahrzeuge im Umkreis in Echtzeit (adsb.lol, ODbL/Open Data, ohne API-Schlüssel)
// und Betriebsrichtung des Flughafens Stuttgart (EDDS) aus dem aktuellen METAR (NOAA/ADDS).
// Damit wird beantwortbar, warum es gerade über dem Kessel rauscht: Rettungshubschrauber, Polizei oder
// Anflugbetrieb über Ostfildern (Piste 25) bzw. über Vaihingen und Leinfelden (Piste 07).
import { cached, fetchJson } from '../cache.mjs';

const ADSB = 'https://api.adsb.lol/v2/point/48.74/9.18/20';
const METAR = 'https://aviationweather.gov/api/data/metar?ids=EDDS&format=json';
const SONDEHUB = 'https://api.v2.sondehub.org/sondes/telemetry?duration=3h&lat=48.78&lon=9.18&distance=300';
const ISS = 'https://api.wheretheiss.at/v1/satellites/25544';
const CENTER = [9.18, 48.779];

// Typschlüssel, die für Hubschrauber stehen (inkl. Rettungs- und Polizeiflugzeuge in der Region)
const HELI = /EC35|EC45|H145|H135|BK17|AS35|AS36|AS55|AW109|AW139|S76|S92|B412|B407|B212|UH1|OH6|DH.6|DHC6/i;

const R = 6371000;
const distM = (lat1, lon1, lat2, lon2) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** Betriebsrichtung EDDS: Westwind → Piste 25 (Anflug aus dem Osten über Ostfildern), Ostwind → Piste 07 */
function betriebsrichtung(wdir) {
  if (wdir == null || !Number.isFinite(wdir)) return null;
  const d = ((wdir % 360) + 360) % 360;
  return d >= 180 && d < 360 ? '25' : '07';
}

/** Mondphase und beleuchteter Anteil, rein rechnerisch (keine externe Quelle nötig). */
function mondphase(now = Date.now()) {
  const synodisch = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (now - knownNew) / 86400_000;
  const phase = ((days % synodisch) + synodisch) % synodisch / synodisch;
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
  const name = phase < 0.03 || phase > 0.97 ? 'Neumond'
    : phase < 0.22 ? 'zunehmende Sichel'
      : phase < 0.28 ? 'zunehmender Halbmond'
        : phase < 0.47 ? 'zunehmender Dreiviertelmond'
          : phase < 0.53 ? 'Vollmond'
            : phase < 0.72 ? 'abnehmender Dreiviertelmond'
              : phase < 0.78 ? 'abnehmender Halbmond' : 'abnehmende Sichel';
  return { phase: +phase.toFixed(3), illumination, name };
}

/** Wetterballons/Radiosonden im Umkreis (SondeHub, offene Community-Empfänge). */
async function sonden() {
  const d = await fetchJson(SONDEHUB, { timeout: 12000 });
  const out = [];
  for (const [id, frames] of Object.entries(d ?? {})) {
    if (!frames || typeof frames !== 'object') continue;
    const keys = Object.keys(frames).sort();
    const last = frames[keys.at(-1)];
    if (!last) continue;
    const la = Number(last.lat), lo = Number(last.lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const distance = Math.round(distM(CENTER[1], CENTER[0], la, lo));
    if (distance > 300_000) continue;
    const seen = last.datetime ?? keys.at(-1);
    if (seen && Date.now() - Date.parse(seen) > 3 * 3600_000) continue;
    out.push({
      id, type: last.subtype ?? last.type ?? null, serial: last.serial ?? id,
      lat: +la.toFixed(5), lon: +lo.toFixed(5), altM: last.alt != null ? Math.round(Number(last.alt)) : null,
      tempC: last.temp != null ? +Number(last.temp).toFixed(1) : null, velV: last.vel_v != null ? +Number(last.vel_v).toFixed(1) : null,
      heading: last.heading != null ? Math.round(Number(last.heading)) : null, distance, seen,
    });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, 12);
}

export async function flug() {
  const [acRes, metarRes, sondeRes, issRes] = await Promise.allSettled([
    cached('adsb-stuttgart', 45_000, () => fetchJson(ADSB, { timeout: 12000 })),
    cached('metar-edds', 5 * 60_000, () => fetchJson(METAR, { timeout: 12000 })),
    cached('sondehub-stuttgart', 5 * 60_000, () => sonden()),
    cached('iss-position', 60_000, () => fetchJson(ISS, { timeout: 10000 })),
  ]);
  const raw = acRes.status === 'fulfilled' ? acRes.value.value?.ac ?? [] : [];
  const metar = metarRes.status === 'fulfilled' ? metarRes.value.value?.[0] ?? null : null;
  const sondeList = sondeRes.status === 'fulfilled' ? sondeRes.value.value ?? [] : [];
  const issRaw = issRes.status === 'fulfilled' ? issRes.value.value : null;
  const iss = issRaw && Number.isFinite(Number(issRaw.latitude)) ? {
    lat: +Number(issRaw.latitude).toFixed(4), lon: +Number(issRaw.longitude).toFixed(4),
    altKm: issRaw.altitude != null ? +Number(issRaw.altitude).toFixed(1) : null,
    velocityKmh: issRaw.velocity != null ? Math.round(Number(issRaw.velocity)) : null,
    visibility: issRaw.visibility ?? null, footprintKm: issRaw.footprint != null ? Math.round(Number(issRaw.footprint)) : null,
    distance: Math.round(distM(CENTER[1], CENTER[0], Number(issRaw.latitude), Number(issRaw.longitude)) / 1000),
    seen: issRaw.timestamp ? new Date(Number(issRaw.timestamp) * 1000).toISOString() : null,
  } : null;

  const items = [];
  for (const a of raw) {
    const la = Number(a.lat), lo = Number(a.lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const d = distM(CENTER[1], CENTER[0], la, lo);
    if (d > 30_000) continue;
    const typ = String(a.t ?? '').trim();
    const callsign = String(a.flight ?? '').trim();
    const alt = a.alt_baro === 'ground' ? 0 : Number(a.alt_baro);
    items.push({
      hex: String(a.hex ?? ''),
      callsign: callsign || null,
      reg: String(a.r ?? '').trim() || null,
      type: typ || null,
      lat: +la.toFixed(5),
      lon: +lo.toFixed(5),
      dist: Math.round(d),
      altFt: Number.isFinite(alt) ? alt : null,
      gsKt: Number.isFinite(Number(a.gs)) ? +Number(a.gs).toFixed(0) : null,
      track: Number.isFinite(Number(a.track)) ? +Number(a.track).toFixed(0) : null,
      rate: Number.isFinite(Number(a.baro_rate)) ? +Number(a.baro_rate).toFixed(0) : null,
      heli: HELI.test(typ) || a.category === 'A7',
      niedrig: Number.isFinite(alt) && alt > 0 && alt < 3000,
      gesehenVor: Number.isFinite(Number(a.seen)) ? +Number(a.seen).toFixed(0) : null,
    });
  }
  items.sort((a, b) => (a.altFt ?? 99999) - (b.altFt ?? 99999));

  const wdir = metar?.wdir != null ? Number(metar.wdir) : null;
  const wspeed = metar?.wspd != null ? Number(metar.wspd) : null;
  const br = betriebsrichtung(wdir);
  const hubschrauber = items.filter((i) => i.heli);
  const anflug = items.filter((i) => i.altFt != null && i.altFt <= 5000 && i.gsKt != null && i.gsKt > 100);

  return {
    aircraft: items,
    hubschrauber,
    anflug,
    edds: {
      metar: metar?.rawOb ?? null,
      gemessen: metar?.reportTime ?? metar?.obsTime ?? null,
      windDir: wdir,
      windKt: wspeed,
      betriebsrichtung: br,
      hinweis: br === '25'
        ? 'Betriebsrichtung 25: Anflug und Start über die Fildern, Landungen aus östlicher Richtung über Ostfildern und Degerloch.'
        : br === '07' ? 'Betriebsrichtung 07: Anflug aus westlicher Richtung über Vaihingen und Leinfelden, Landung Richtung Innenstadt.' : 'Betriebsrichtung derzeit nicht bestimmbar.',
    },
    count: items.length,
    sonden: sondeList,
    iss,
    mond: mondphase(),
    fetchedAt: new Date().toISOString(),
    source: 'adsb.lol (OpenSky-kompatibel, ODbL); METAR: NOAA Aviation Weather (ADDS); Wetterballons: SondeHub (offene Community-Empfänge); ISS: wheretheiss.at (Open Data); Mondphase berechnet. Positionen aus dem zivilen ADS-B-Empfang, nicht alle Flugzeuge werden erfasst.',
  };
}
