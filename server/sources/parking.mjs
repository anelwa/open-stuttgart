// Parkhäuser Stuttgart, Park+Ride (P+R) in der Region Stuttgart, Bike+Ride-Fahrradboxen sowie
// Eco-Counter-Fahrradzählstellen über MobiData BW (ParkAPI v3, WFS und Eco-Counter-Feeds).
import { cached, fetchJson } from '../cache.mjs';

const PARK_API = 'https://api.mobidata-bw.de/park-api/api/public/v3/parking-sites';
const URL_SITES = `${PARK_API}?source_uid=stuttgart_carparks&limit=200`;
const URL_RADIUS = `${PARK_API}?lat=48.7784&lon=9.1800&radius=12000&limit=200`;
const BIKE_SOURCES = ['kienzler_stuttgart', 'kienzler_vvs', 'kienzler_bike_and_ride', 'velobrix', 'bfrk_bw_bike'];
const BIKE_WFS = 'https://api.mobidata-bw.de/geoserver/MobiData-BW/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=MobiData-BW:park-api_bicycle&outputFormat=application/json&srsName=EPSG:4326';
const PR_SOURCES = ['vrs-p-r', 'vrs_vaihingen', 'vrs_kirchheim', 'vrs_neustadt', 'vrs_bondorf', 'bahn_v2', 'p_m_bw'];
const ECO_SITES = 'https://mobidata-bw.de/daten/eco-counter/eco_counter_fahrradzaehler.json';
const ECO_DAILY = 'https://mobidata-bw.de/daten/eco-counter/v2/fahrradzaehler_tageswerten.json';
const ECO_HOURLY = 'https://mobidata-bw.de/daten/eco-counter/v2/fahrradzaehler_stundenwerten.json';
const ECO_CKAN = 'https://www.mobidata-bw.de/ckan/api/3/action/datastore_search?resource_id=3efeb12d-b485-444a-a8a3-70e746baa334&q=Stuttgart&limit=300';

const R = 6371000;
const distM = (lat1, lon1, lat2, lon2) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

function mapSite(s, sourceFallback = '') {
  const purpose = s.purpose ?? (/schließfach|gepäck|helm|locker/i.test(`${s.name ?? ''} ${s.description ?? ''}`) ? 'ITEM' : 'BIKE');
  return {
    id: s.id,
    name: s.name,
    address: s.address ?? s.description ?? '',
    beschreibung: s.description ?? null,
    operator: s.operator_name ?? '',
    type: s.type ?? null,
    purpose,
    lat: Number(s.lat),
    lon: Number(s.lon),
    capacity: s.realtime_capacity ?? s.capacity ?? null,
    free: s.has_realtime_data ? (s.realtime_free_capacity ?? null) : null,
    live: Boolean(s.has_realtime_data),
    status: s.realtime_opening_status ?? null,
    updatedAt: s.realtime_data_updated_at ?? s.static_data_updated_at ?? null,
    fee: s.fee_description ?? (s.has_fee === false ? 'gebührenfrei' : null),
    maxHeight: s.max_height ?? null,
    covered: s.is_covered ?? null,
    prType: s.park_and_ride_type ?? [],
    openingHours: s.opening_hours ?? null,
    url: s.public_url ?? null,
    bookableUrl: s.bookable_url ?? s.public_url ?? null,
    photoUrl: s.photo_url ?? null,
    synthetisch: Boolean(s.has_Synthetische_Belegung),
    dhid: s.dhid ? String(s.dhid) : null,
    sourceUid: s.source_uid ?? sourceFallback,
    restrictions: (s.restrictions ?? []).map((r) => ({ type: r.type, capacity: r.capacity })),
  };
}

export async function parking() {
  const { value, at, fresh } = await cached('parking', 60_000, async () => {
    const d = await fetchJson(URL_SITES);
    return (d.items ?? []).map((s) => mapSite(s, 'stuttgart_carparks'));
  });
  return { sites: value, fetchedAt: new Date(at).toISOString(), fresh, source: 'Stadt Stuttgart / PBW über MobiData BW (ParkAPI)' };
}

/** Normalisiert Haltestellen-IDs (z. B. "de:08111:6112_Parent" oder "5006112" -> "6112") für den Abgleich mit dhid */
function normStopKey(id) {
  if (!id) return null;
  const s = String(id).trim();
  const mDhid = /^de:08111:(\d+)/i.exec(s);
  if (mDhid) return mDhid[1].replace(/^0+/, '');
  const mVvs = /^500(\d{4})$/.exec(s);
  if (mVvs) return mVvs[1].replace(/^0+/, '');
  return s.toLowerCase();
}

/** Bike+Ride-Anlagen, verschließbare Fahrradboxen sowie Gepäck-/Helmschließfächer in Stuttgart und im VVS-Gebiet.
 *  Mit `purpose` ('BIKE' oder 'ITEM') und `radius` (Meter) lässt sich gezielt nach Boxen oder Schließfächern fragen. */
export async function bikeAndRide(stopId, lat, lon, { purpose = null, radius = 350 } = {}) {
  const { value, at, fresh } = await cached('bike-and-ride-v2', 2 * 60_000, async () => {
    const [apiRes, radiusRes, wfsRes] = await Promise.all([
      Promise.allSettled(BIKE_SOURCES.map((src) => fetchJson(`${PARK_API}?source_uid=${src}&limit=250`, { timeout: 15000 }).then((d) => ({ src, items: d.items ?? [] })))),
      fetchJson(URL_RADIUS, { timeout: 15000 }).catch(() => ({ items: [] })),
      fetchJson(BIKE_WFS, { timeout: 15000 }).catch(() => ({ features: [] })),
    ]);
    const byKey = new Map();
    const ingestItem = (s, srcFallback) => {
      const la = Number(s.lat), lo = Number(s.lon);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || la < 48.5 || la > 49.05 || lo < 8.8 || lo > 9.6) return;
      const mapped = mapSite(s, srcFallback);
      const key = `${la.toFixed(4)},${lo.toFixed(4)},${(s.name ?? '').toLowerCase()},${mapped.purpose}`;
      const prev = byKey.get(key);
      if (!prev || (mapped.live && !prev.live)) byKey.set(key, mapped);
    };

    for (const r of apiRes) {
      if (r.status !== 'fulfilled') continue;
      for (const s of r.value.items) ingestItem(s, r.value.src);
    }
    for (const s of radiusRes.items ?? []) {
      if (s.purpose === 'BIKE' || s.purpose === 'ITEM' || s.type === 'LOCKERS' || /kienzler|velobrix|bfrk|bike/i.test(String(s.source_uid ?? ''))) {
        ingestItem(s, s.source_uid ?? 'mobidata_radius');
      }
    }
    for (const f of wfsRes.features ?? []) {
      const p = f.properties ?? {};
      const coords = f.geometry?.coordinates;
      const lo = Number(coords?.[0] ?? p.lon), la = Number(coords?.[1] ?? p.lat);
      if (!Number.isFinite(la) || !Number.isFinite(lo) || la < 48.5 || la > 49.05 || lo < 8.8 || lo > 9.6) continue;
      const purpose = p.purpose ?? (/schließfach|gepäck|helm|locker/i.test(`${p.name ?? ''} ${p.description ?? ''}`) ? 'ITEM' : 'BIKE');
      const key = `${la.toFixed(4)},${lo.toFixed(4)},${(p.name ?? '').toLowerCase()},${purpose}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.dhid && p.dhid) existing.dhid = String(p.dhid);
        if (!existing.bookableUrl && p.bookable_url) existing.bookableUrl = p.bookable_url;
        if (!existing.photoUrl && p.photo_url) existing.photoUrl = p.photo_url;
      } else {
        const free = p.realtime_free_capacity != null ? Number(p.realtime_free_capacity) : null;
        const cap = p.realtime_capacity != null ? Number(p.realtime_capacity) : (p.capacity != null ? Number(p.capacity) : null);
        byKey.set(key, {
          id: p.id ?? f.id ?? key,
          name: p.name ?? 'Bike+Ride-Anlage',
          address: p.address ?? p.description ?? '',
          operator: p.operator_name ?? 'Bike+Ride',
          type: p.type ?? 'LOCKERS',
          purpose,
          lat: la,
          lon: lo,
          capacity: Number.isFinite(cap) ? cap : null,
          free: Number.isFinite(free) ? free : null,
          live: Boolean(p.has_realtime_data || free != null),
          status: p.realtime_opening_status ?? null,
          updatedAt: p.realtime_data_updated_at ?? p.static_data_updated_at ?? null,
          fee: p.fee_description ?? null,
          maxHeight: null,
          openingHours: p.opening_hours ?? null,
          url: p.public_url ?? p.bookable_url ?? null,
          bookableUrl: p.bookable_url ?? p.public_url ?? null,
          photoUrl: p.photo_url ?? null,
          synthetisch: Boolean(p.has_Synthetische_Belegung),
          dhid: p.dhid ? String(p.dhid) : null,
          sourceUid: p.source_uid ?? 'park-api_bicycle',
          restrictions: [],
        });
      }
    }
    return [...byKey.values()];
  });

  let sites = value;
  const targetKey = normStopKey(stopId);
  const la = Number(lat), lo = Number(lon);
  const hasCoord = Number.isFinite(la) && Number.isFinite(lo);
  const umkreis = Math.min(3000, Math.max(100, Number(radius) || 350));
  if (targetKey || hasCoord) {
    sites = value
      .map((s) => {
        const dhidMatch = Boolean(targetKey && s.dhid && normStopKey(s.dhid) === targetKey);
        const d = hasCoord ? Math.round(distM(la, lo, s.lat, s.lon)) : null;
        return { ...s, dhidMatch, dist: d };
      })
      .filter((s) => s.dhidMatch || (s.dist != null && s.dist <= umkreis))
      .sort((a, b) => Number(b.dhidMatch) - Number(a.dhidMatch) || (a.dist ?? 9999) - (b.dist ?? 9999));
  }
  if (purpose === 'BIKE' || purpose === 'ITEM') sites = sites.filter((s) => s.purpose === purpose);
  const bikeSites = sites.filter((s) => s.purpose !== 'ITEM');
  const lockerSites = sites.filter((s) => s.purpose === 'ITEM');
  const sumCap = (arr) => arr.reduce((acc, s) => acc + (s.capacity ?? 0), 0);
  const sumFree = (arr) => {
    const withLive = arr.filter((s) => s.free != null);
    return withLive.length ? withLive.reduce((acc, s) => acc + (s.free ?? 0), 0) : null;
  };
  return {
    sites,
    bikeSites,
    lockerSites,
    summary: {
      bikeCount: bikeSites.length,
      bikeCapacity: sumCap(bikeSites),
      bikeFree: sumFree(bikeSites),
      lockerCount: lockerSites.length,
      lockerCapacity: sumCap(lockerSites),
      lockerFree: sumFree(lockerSites),
    },
    totalSites: value.length,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'MobiData BW, ParkAPI v3 und WFS Bike+Ride & Schließfächer (Kienzler, VVS, Velobrix, BFRK BW, dl-de/by-2-0)',
  };
}

/** Park+Ride-Plätze (P+R) in Stuttgart und der Region Stuttgart (VRS/VVS) */
export async function parkAndRide() {
  const { value, at, fresh } = await cached('park-and-ride', 2 * 60_000, async () => {
    const res = await Promise.allSettled(
      PR_SOURCES.map((src) => fetchJson(`${PARK_API}?source_uid=${src}&limit=250`, { timeout: 15000 }).then((d) => ({ src, items: d.items ?? [] }))),
    );
    const byId = new Map();
    for (const r of res) {
      if (r.status !== 'fulfilled') continue;
      for (const s of r.value.items) {
        const la = Number(s.lat), lo = Number(s.lon);
        if (!Number.isFinite(la) || !Number.isFinite(lo) || la < 48.55 || la > 48.98 || lo < 8.85 || lo > 9.55) continue;
        if (r.value.src === 'p_m_bw' && !/stuttgart|vaihingen|leonberg|sindelfingen|böblingen|ludwigsburg|esslingen|waiblingen|fellbach|kornwestheim|leinfelden|echterdingen|filderstadt/i.test(`${s.name ?? ''} ${s.address ?? ''}`)) continue;
        const mapped = mapSite(s, r.value.src);
        const key = `${la.toFixed(4)},${lo.toFixed(4)}`;
        const prev = byId.get(key);
        if (!prev || (mapped.live && !prev.live)) byId.set(key, mapped);
      }
    }
    return [...byId.values()].sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0) || (b.free ?? b.capacity ?? 0) - (a.free ?? a.capacity ?? 0));
  });
  return {
    sites: value,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'Verband Region Stuttgart (VRS), VVS, DB BahnPark und Land BW über MobiData BW (ParkAPI)',
  };
}

/** Eco-Counter Fahrradzählstellen in Stuttgart (Tages- und Stundenwerte mit Wetterkontext) */
export async function radzaehler() {
  const { value, at, fresh } = await cached('radzaehler-stuttgart', 30 * 60_000, async () => {
    const [dailyRes, hourlyRes, ckanRes] = await Promise.allSettled([
      fetchJson(ECO_DAILY, { timeout: 20000 }),
      fetchJson(ECO_HOURLY, { timeout: 20000 }),
      fetchJson(ECO_CKAN, { timeout: 15000 }),
    ]);

    const isStgt = (r) => {
      const dom = String(r.domain_name ?? r.stadt ?? r.kommune ?? '').toLowerCase();
      if (dom.includes('stuttgart')) return true;
      const la = Number(r.latitude ?? r.lat ?? r.geo_point_2d?.lat ?? r.standort?.lat);
      const lo = Number(r.longitude ?? r.lon ?? r.geo_point_2d?.lon ?? r.standort?.lon);
      return Number.isFinite(la) && Number.isFinite(lo) && la >= 48.68 && la <= 48.87 && lo >= 9.03 && lo <= 9.32;
    };

    const dailyRows = (dailyRes.status === 'fulfilled' && Array.isArray(dailyRes.value) ? dailyRes.value : []).filter(isStgt);
    const hourlyRows = (hourlyRes.status === 'fulfilled' && Array.isArray(hourlyRes.value) ? hourlyRes.value : []).filter(isStgt);
    const ckanRows = (ckanRes.status === 'fulfilled' ? ckanRes.value?.result?.records ?? [] : []).filter(isStgt);

    const stations = new Map();
    const normRow = (r, sourceKind) => {
      const id = String(r.counter_site_id ?? r.site_id ?? r.channel_id ?? r.counter_site ?? r.zaehlstelle ?? '').trim();
      const name = String(r.counter_site ?? r.site_name ?? r.name ?? r.zaehlstelle ?? id).trim();
      if (!name) return;
      const key = id || name.toLowerCase();
      const la = Number(r.latitude ?? r.lat ?? r.geo_point_2d?.lat);
      const lo = Number(r.longitude ?? r.lon ?? r.geo_point_2d?.lon);
      const count = Number(r.zaehlstand ?? r.count ?? r.counts ?? r.anzahl ?? 0);
      const ts = String(r.iso_timestamp ?? r.timestamp ?? r.datum ?? r.date ?? '');
      const day = ts.slice(0, 10);
      const temp = r.temperatur != null && r.temperatur !== '' ? Number(r.temperatur) : null;
      const wetter = r.wetter ? String(r.wetter).trim() : null;

      let st = stations.get(key);
      if (!st) {
        st = {
          id: key,
          name,
          lat: Number.isFinite(la) ? la : null,
          lon: Number.isFinite(lo) ? lo : null,
          days: new Map(),
          latestHour: null,
          latestHourCount: null,
          temperatur: null,
          wetter: null,
        };
        stations.set(key, st);
      }
      if (st.lat == null && Number.isFinite(la)) { st.lat = la; st.lon = lo; }
      if (temp != null && Number.isFinite(temp)) st.temperatur = temp;
      if (wetter) st.wetter = wetter;

      if (sourceKind === 'daily') {
        if (day && Number.isFinite(count)) {
          st.days.set(day, (st.days.get(day) ?? 0) + count);
        }
      } else if (sourceKind === 'hourly') {
        if (ts && Number.isFinite(count)) {
          if (!st.latestHour || ts > st.latestHour) {
            st.latestHour = ts;
            st.latestHourCount = count;
          } else if (ts === st.latestHour) {
            st.latestHourCount = (st.latestHourCount ?? 0) + count;
          }
          if (day && !dailyRows.length) {
            st.days.set(day, (st.days.get(day) ?? 0) + count);
          }
        }
      }
    };

    for (const r of dailyRows) normRow(r, 'daily');
    for (const r of hourlyRows) normRow(r, 'hourly');
    if (!stations.size) {
      for (const r of ckanRows) normRow(r, 'hourly');
    }

    const list = [...stations.values()].map((s) => {
      const series = [...s.days.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7).map(([date, count]) => ({ date, count }));
      const latestDay = series.at(-1) ?? null;
      const total7d = series.reduce((sum, x) => sum + x.count, 0);
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        latestDate: latestDay?.date ?? (s.latestHour ? s.latestHour.slice(0, 10) : null),
        latestDayCount: latestDay?.count ?? null,
        latestHour: s.latestHour,
        latestHourCount: s.latestHourCount,
        total7d,
        temperatur: s.temperatur,
        wetter: s.wetter,
        series,
      };
    }).sort((a, b) => (b.latestDayCount ?? b.total7d ?? 0) - (a.latestDayCount ?? a.total7d ?? 0));

    const latestDate = list.reduce((m, s) => (s.latestDate && (!m || s.latestDate > m) ? s.latestDate : m), null);
    const totalLatestDay = list.filter((s) => s.latestDate === latestDate).reduce((sum, s) => sum + (s.latestDayCount ?? 0), 0);
    return {
      stations: list,
      latestDate,
      totalLatestDay,
    };
  });
  return {
    ...value,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'Landeshauptstadt Stuttgart über MobiData BW (Eco-Counter Fahrradzählstellen, CC BY 4.0)',
  };
}

