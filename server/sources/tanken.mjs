// Tankpreise für Stuttgart.
//
// Primärquelle: Markttransparenzstelle für Kraftstoffe (MTS-K) über die freie
// Tankerkönig-API (CC BY 4.0). Die freie API erlaubt höchstens einen Request pro
// Minute und nur Abrufe, die durch eine Nutzeraktion ausgelöst werden. Deshalb
// wird das Ergebnis serverseitig 60 Sekunden für alle Nutzer geteilt.
//
// Ohne OS_TANKERKOENIG_KEY (oder mit OS_TANKEN_PROVIDER=infranode) wird der
// keylose Dienst InfraNode verwendet. Er liefert dieselben MTS-K-Daten für den
// 5-km-Radius um die Stuttgarter Stadtmitte. Mit Key wird stadtweit abgefragt.
//
// Der Key wird nie im Code veröffentlicht: OS_TANKERKOENIG_KEY in .env setzen.
import { cached, fetchJson } from '../cache.mjs';

const TK_URL = 'https://creativecommons.tankerkoenig.de/json/list.php';
const INFRANODE_URL = 'https://infranode.dev/api/v1/cities/stuttgart/fuel-prices';
const CENTER = { lat: 48.7758, lon: 9.1829 };
const RADIUS = Math.max(1, Math.min(25, Number(process.env.OS_TANKEN_RADIUS ?? 15) || 15));
const CACHE_MS = 60_000;

const key = () => String(process.env.OS_TANKERKOENIG_KEY ?? '').trim();
const provider = () => String(process.env.OS_TANKEN_PROVIDER ?? 'auto').trim().toLowerCase();
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const txt = (v) => String(v ?? '').trim() || null;
const addr = (street, houseNumber, postCode, place) => {
  const line1 = [street, houseNumber].filter(Boolean).join(' ').trim();
  const line2 = [postCode, place].filter(Boolean).join(' ').trim();
  return [line1, line2].filter(Boolean).join(', ') || null;
};

function normalizeTankerkoenig(list) {
  return (list ?? []).map((s) => ({
    id: String(s.id ?? ''),
    name: txt(s.name) ?? txt(s.brand) ?? 'Tankstelle',
    brand: txt(s.brand),
    address: addr(txt(s.street), txt(s.houseNumber), txt(s.postCode), txt(s.place)),
    street: txt(s.street),
    postCode: txt(s.postCode),
    place: txt(s.place),
    lat: +s.lat,
    lon: +s.lng,
    distKm: Number.isFinite(s.dist) ? +s.dist : null,
    e5: num(s.e5),
    e10: num(s.e10),
    diesel: num(s.diesel),
    isOpen: s.isOpen === true,
  })).filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

function normalizeInfraNode(json) {
  const payload = json?.data?.payload ?? {};
  return (payload.stations ?? []).map((s) => ({
    id: String(s.station_id ?? ''),
    name: txt(s.name) ?? txt(s.brand) ?? 'Tankstelle',
    brand: txt(s.brand),
    address: addr(txt(s.street), txt(s.house_number), txt(s.post_code), txt(s.place)),
    street: txt(s.street),
    postCode: txt(s.post_code),
    place: txt(s.place),
    lat: +s.lat,
    lon: +s.lon,
    distKm: Number.isFinite(s.distance_km) ? +s.distance_km : null,
    e5: num(s.e5),
    e10: num(s.e10),
    diesel: num(s.diesel),
    isOpen: s.is_open === true,
  })).filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

async function viaTankerkoenig() {
  const url = new URL(TK_URL);
  url.searchParams.set('lat', String(CENTER.lat));
  url.searchParams.set('lng', String(CENTER.lon));
  url.searchParams.set('rad', String(RADIUS));
  url.searchParams.set('type', 'all');
  url.searchParams.set('apikey', key());
  const j = await fetchJson(url.toString(), { timeout: 15_000 });
  if (j?.ok !== true) throw new Error(j?.message ?? 'Tankerkönig antwortet mit einem Fehler');
  return {
    provider: 'tankerkoenig',
    source: 'Tankerkönig / MTS-K (CC BY 4.0)',
    stand: new Date().toISOString(),
    radiusKm: RADIUS,
    stations: normalizeTankerkoenig(j.stations),
    fallback: null,
  };
}

async function viaInfraNode(reason = null) {
  const j = await fetchJson(INFRANODE_URL, { timeout: 15_000 });
  const payload = j?.data?.payload ?? {};
  return {
    provider: 'infranode',
    source: 'InfraNode, Daten von Tankerkönig / MTS-K (CC BY 4.0)',
    stand: txt(j?.data?.retrieved_at) ?? new Date().toISOString(),
    radiusKm: Number.isFinite(payload.radius_km) ? +payload.radius_km : 5,
    stations: normalizeInfraNode(j),
    fallback: reason,
  };
}

async function load() {
  const p = provider();
  const hasKey = Boolean(key());
  if (p === 'infranode' || (!hasKey && p !== 'tankerkoenig')) return viaInfraNode(!hasKey ? 'kein Tankerkönig-Key gesetzt' : null);
  if (p === 'tankerkoenig' && !hasKey) throw new Error('OS_TANKERKOENIG_KEY fehlt');
  try {
    return await viaTankerkoenig();
  } catch (err) {
    // Der keylose Dienst ist ein bewusster Fallback; mit Key bleibt die
    // Ursache in der Antwort sichtbar, damit der Betrieb sie beheben kann.
    return viaInfraNode(String(err?.message ?? err));
  }
}

/** Aktuelle Tankpreise, nach Entfernung sortiert. Der Client filtert/sortiert nach Sorte. */
export async function tankpreise() {
  const { value, at, fresh, error } = await cached('tanken-stuttgart', CACHE_MS, load);
  return {
    ...value,
    stale: !fresh,
    error: error ?? null,
    cachedAt: new Date(at).toISOString(),
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.tankerkoenig.de/',
    stations: [...value.stations].sort((a, b) => (a.distKm ?? 1e9) - (b.distKm ?? 1e9)),
  };
}
