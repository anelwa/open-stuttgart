// "In meiner Nähe": Einrichtungen aus dem Geoserver der Stadt (WFS, CC BY 4.0), dazu Live-Daten der Bäder
// und Bürgerbüros, Abfuhrtermine der AWS, Grundschulbezirke, Ladepunkte (MobiData BW OCPDB),
// Pollenflug und UV-Index (DWD) und der Netzzustand von StromGedacht (TransnetBW).
// Einrichtungsebenen ändern sich selten: einmal am Tag je Ebene, Live-Daten höchstens einmal pro Minute.
import { cached, fetchJson, fetchText } from '../cache.mjs';
import { bestToday, quote, since, usual } from './verlauf.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Gastronomie aus OpenStreetMap (Auszug für das Stadtgebiet, ODbL), siehe public/data/gastro.geojson
const GASTRO_FILE = fileURLToPath(new URL('../../public/data/gastro.geojson', import.meta.url));
const KUECHE = { italian: 'italienisch', regional: 'regional', pizza: 'Pizza', kebab: 'Kebab', german: 'deutsch', burger: 'Burger', asian: 'asiatisch',
  turkish: 'türkisch', greek: 'griechisch', vietnamese: 'vietnamesisch', indian: 'indisch', swabian: 'schwäbisch', chinese: 'chinesisch', japanese: 'japanisch',
  sushi: 'Sushi', thai: 'thailändisch', coffee_shop: 'Kaffee', cake: 'Kuchen', ice_cream: 'Eis', sandwich: 'Sandwiches', mexican: 'mexikanisch',
  spanish: 'spanisch', french: 'französisch', korean: 'koreanisch', lebanese: 'libanesisch', international: 'international', vegan: 'vegan',
  bakery: 'Backwaren', falafel: 'Falafel', steak_house: 'Steakhaus', seafood: 'Fisch', fish: 'Fisch', noodle: 'Nudeln', ramen: 'Ramen', croatian: 'kroatisch', balkan: 'Balkan' };
const ROLLSTUHL = { yes: 'stufenlos zugänglich', limited: 'eingeschränkt stufenlos', no: 'nicht stufenlos' };
const GASTRO_ART = { essen_restaurant: ['restaurant', 'food_court'], essen_cafe: ['cafe'], essen_imbiss: ['fast_food'], essen_kneipe: ['pub', 'bar'], essen_biergarten: ['biergarten'], essen_eis: ['ice_cream'] };
let gastroCache = null;
function gastro(cat) {
  gastroCache ??= JSON.parse(readFileSync(GASTRO_FILE, 'utf8'));
  const kinds = GASTRO_ART[cat];
  return gastroCache.features.filter((f) => kinds.includes(f.properties.amenity) && f.properties.name).map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const kueche = (p.cuisine ?? '').split(';').map((c) => KUECHE[c.trim()] ?? null).filter(Boolean);
    return {
      id: `${cat}-${f.id}`, cat, name: p.name, lat: +lat.toFixed(6), lon: +lon.toFixed(6),
      address: join([p['addr:street'], p['addr:housenumber']].filter(Boolean).join(' ') || null, p['addr:postcode'] ? `${p['addr:postcode']} Stuttgart` : null) || null,
      web: p.website ?? p['contact:website'] ?? null, phone: p.phone ?? p['contact:phone'] ?? null, hours: p.opening_hours ?? null,
      wheelchair: p.wheelchair ?? null, osm: f.id,
      info: [kueche.length ? `Küche: ${kueche.join(', ')}` : null, p.wheelchair ? ROLLSTUHL[p.wheelchair] ?? null : null,
        p['toilets:wheelchair'] === 'yes' ? 'rollstuhlgerechtes WC' : null, p.outdoor_seating === 'yes' ? 'Außenplätze' : null,
        p['diet:vegan'] === 'yes' || p['diet:vegan'] === 'only' ? 'vegane Gerichte' : p['diet:vegetarian'] === 'yes' || p['diet:vegetarian'] === 'only' ? 'vegetarische Gerichte' : null,
        p.takeaway === 'yes' ? 'zum Mitnehmen' : null, p['check_date:opening_hours'] ? `Öffnungszeiten geprüft am ${p['check_date:opening_hours'].split('-').reverse().join('.')}` : null].filter(Boolean),
    };
  });
}

const WFS = (layer, ws = 'GEOLINE_FLEX') => `https://geoserver.stuttgart.de/geoserver/${ws}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${ws}:${layer}_EPSG25832&outputFormat=application/json&srsName=EPSG:4326`;
const yes = (v) => /^(ja|j)$/i.test(String(v ?? '').trim());
const join = (...p) => p.filter((x) => x != null && String(x).trim() !== '').join(', ');

// Gemeinsames Schema der Infopool-Ebenen
const infopool = (p) => ({
  name: p.NAME, address: join(p.STRASSE, [p.PLZ, p.ORT].filter(Boolean).join(' ')),
  phone: p.TEL ?? null, email: p.EMAIL ?? null, web: p.URL ?? null, booking: p.WEBADDR ?? null, ref: p.INFOPOOL_ID ?? null,
  info: [p.ADRESSTYP && !/Betriebsstelle/.test(p.ADRESSTYP) ? p.ADRESSTYP.trim() : null].filter(Boolean),
});

/** Kategorien der Nähe-Suche. group ordnet sie im Panel. */
export const CATEGORIES = {
  buergerbuero: { label: 'Bürgerbüros', group: 'verwaltung', layers: ['IP_3_05_08_BUERGERBUEROS'], map: infopool },
  bibliothek: { label: 'Stadtbibliotheken', group: 'verwaltung', layers: ['IP_3_05_04u05_STADTBIBLIOTHEK'], map: infopool },
  wertstoffhof: { label: 'Wertstoffhöfe', group: 'abfall', layers: ['IP_3_06_04_WERTSTOFFHOF'], map: infopool },
  altglas: { label: 'Altglas-Container', group: 'abfall', layers: ['IP_2_10_04_ALTGLAS'], map: (p) => ({ ...infopool(p), name: p.STRASSE ?? 'Altglas-Container', info: [] }) },
  altkleider: { label: 'Altkleider-Container', group: 'abfall', layers: ['IP_2_10_06_ALTKLEIDER'], map: (p) => ({ ...infopool(p), name: p.STRASSE ?? 'Altkleider-Container', info: [] }) },
  kita: { label: 'Kitas', group: 'familie', layers: ['IP_2_01_10_KITA'], map: infopool },
  grundschule: { label: 'Grundschulen', group: 'familie', layers: ['IP_2_04_01_GRUNDSCHULE'], map: infopool },
  gymnasium: { label: 'Gymnasien', group: 'familie', layers: ['IP_2_04_05_GYMNASIUM'], map: infopool },
  spielplatz: {
    label: 'Spielplätze', group: 'familie', layers: ['A62_SPF_SPIELPLAETZE'],
    map: (p) => ({ name: `Spielplatz ${p.NAME}`, address: p.STADTTEIL_NAME, closed: yes(p.GESPERRT),
      info: [p.FLÄCHE ? `${Math.round(p.FLÄCHE).toLocaleString('de-DE')} m²` : null, yes(p.GESPERRT) ? 'derzeit gesperrt' : null, p.BESONDERHEIT].filter(Boolean) }),
  },
  bad: { label: 'Bäder', group: 'freizeit', layers: ['IP_2_03_36_HALLENBAD', 'IP_2_03_36_FREIBAD', 'IP_2_03_36_MINERALBAD'], map: infopool },
  toilette: {
    label: 'Toiletten', group: 'unterwegs', layers: ['IP_2_10_10_TOILETTENANLAGE', 'A10_POI_NETTE_TOILETTE'],
    map: (p) => (p.BETRIEB
      ? { name: `${p.BETRIEB} (Nette Toilette)`, address: join(p.STRASSE, p.PLZ_ORT), hours: p.OEFFNUNGSZEITEN ?? null,
        info: [p.BESONDERE_AUSSTATTUNG?.replace(/[()]/g, '')].filter(Boolean) }
      : { ...infopool(p), name: p.NAME || `Öffentliche Toilette ${p.STRASSE ?? ''}`.trim(), info: [] }),
  },
  trinkbrunnen: {
    label: 'Trinkbrunnen', group: 'unterwegs', layers: ['A62_BRU_BRUNNEN_Trinkwasserbr_in_Betr'],
    map: (p) => ({ name: p.NAME || 'Trinkbrunnen', address: p.BEZEICHNUNG_STANDORT, info: [p.STATUS].filter(Boolean) }),
  },
  kuehl: {
    label: 'Kühle Orte', group: 'unterwegs', layers: ['A53_ALG_KUEHLE_ORTE'],
    map: (p) => ({ name: p.TITEL, address: join(join(p.STRASSE, p.HAUSNR).replace(', ', ' '), p.STADTTEIL), info: [p.ORT_TYP,
      yes(p.TRINKWASSERVERFUEGBARKEIT) ? 'Trinkwasser' : null, yes(p.KOSTENFREI) ? 'kostenfrei' : null,
      yes(p.BARRIEREFREI) ? 'barrierefrei' : null, yes(p.OHNE_KONSUMZWANG) ? 'ohne Konsumzwang' : null, p.WEGFINDUNGSTIPP].filter(Boolean) }),
  },
  reparatur: {
    label: 'Fahrrad-Reparatursäulen', group: 'unterwegs', layers: ['A61_RAD_REPSAEULEN'],
    map: (p) => ({ name: `Reparatursäule ${p.STANDORT}`, address: p.BEZIRK, info: [p.GROSSE_KLEINE_STATION ? `Station ${p.GROSSE_KLEINE_STATION}` : null].filter(Boolean) }),
  },
  staeffele: {
    label: 'Stäffele', group: 'freizeit', layers: ['A62_ALG_STUTTGARTER_STAEFFELE_P'],
    map: (p) => ({ name: p.BEZEICHNUNG, address: join(p.STADTTEIL, p.STADTBEZIRK), info: [p.HOEHE_DIFF ? `${p.HOEHE_DIFF} m Höhenunterschied (${p.HOEHE_MIN} bis ${p.HOEHE_MAX} m)` : null].filter(Boolean) }),
  },
  grillplatz: { label: 'Grillplätze', group: 'freizeit', layers: ['IP_2_03_38_GRILLPLATZ'], map: (p) => ({ ...infopool(p), info: [] }) },
  sport: {
    label: 'Sport im Park', group: 'freizeit', layers: ['A52_SIP_STANDORTE'],
    map: (p) => ({ name: p.TITEL, address: p.STANDORT, info: [p.WOCHENTAG && p.UHRZEIT ? `${p.WOCHENTAG} ${p.UHRZEIT} Uhr` : null, p.ANBIETER, p.BEMERKUNG, 'kostenlos, ohne Anmeldung'].filter(Boolean) }),
  },
  klinik: { label: 'Kliniken', group: 'notfall', layers: ['IP_2_07_01_KLINIKEN'], map: infopool },
  polizei: { label: 'Polizeireviere', group: 'notfall', layers: ['IP_2_05_02_POLIZEIREVIERE'], map: infopool },
  notfall: {
    label: 'Notfall-Treffpunkte', group: 'notfall', layers: ['A37_NOTF_TREFFPUNKTE_Stufe1', 'A37_NOTF_LEUCHTTUERME'],
    map: (p) => (p.GEBAEUDE
      ? { name: `${p.GEBAEUDE}${p.GEBAEUDETEIL ? `, ${p.GEBAEUDETEIL}` : ''}`, address: join(p.ADRESSE, [p.PLZ, p.ORT].filter(Boolean).join(' ')), info: ['Notfall-Treffpunkt', p.FF ? `zuständig: ${p.FF}` : null, p.HINWEIS].filter(Boolean) }
      : { name: p.NAME, address: join(p.STRASSE, [p.PLZ, p.ORT].filter(Boolean).join(' ')), info: ['Notfall-Leuchtturm', p.KATEGORIE].filter(Boolean) }),
  },
  essen_restaurant: { label: 'Restaurants', group: 'essen', local: true },
  essen_cafe: { label: 'Cafés', group: 'essen', local: true },
  essen_imbiss: { label: 'Imbisse', group: 'essen', local: true },
  essen_kneipe: { label: 'Kneipen und Bars', group: 'essen', local: true },
  essen_biergarten: { label: 'Biergärten', group: 'essen', local: true },
  essen_eis: { label: 'Eiscafés', group: 'essen', local: true },
  wahllokal: {
    label: 'Wahllokale', group: 'verwaltung', layers: ['A12_GBE_WAHLLOKALE'],
    map: (p) => ({ name: p.RAUM_WBEN1, address: join(p.RAUM_WBEN2, p.RAUM_WBEN3), info: [p.WBZ_AKTUEL ? `Wahlbezirk ${p.WBZ_AKTUEL}` : null, p.RAUM_ZUGAN, p.RAUM_LIFT, p.BARRIEREFR].filter(Boolean) }),
  },
};

async function layer(name) {
  const { value } = await cached(`wfs-${name}`, 24 * 3600_000, async () => {
    const j = await fetchJson(WFS(name), { timeout: 30000 });
    return j.features ?? [];
  });
  return value;
}

export async function facilities(cat) {
  const c = CATEGORIES[cat];
  if (!c) throw new Error('Unbekannte Kategorie');
  if (c.local) return { cat, label: c.label, items: gastro(cat), source: '© OpenStreetMap-Mitwirkende (ODbL), Auszug Stand 17.10.2026' };
  const { value } = await cached(`fac-${cat}`, 24 * 3600_000, async () => {
    const out = [];
    for (const l of c.layers) {
      const fs = await layer(l);
      fs.forEach((f, i) => {
        if (f.geometry?.type !== 'Point') return;
        const [lon, lat] = f.geometry.coordinates;
        const m = c.map(f.properties ?? {});
        if (!m.name) return;
        out.push({ id: `${cat}-${l}-${f.id ?? i}`, cat, lat: +lat.toFixed(6), lon: +lon.toFixed(6), ...m });
      });
    }
    return out;
  });
  return { cat, label: c.label, items: value, source: 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0)' };
}

export function categories() {
  return Object.entries(CATEGORIES).map(([id, c]) => ({ id, label: c.label, group: c.group }));
}

// ---------- Bürgerbüros: Wartezeit-Anzeige der Stadt ----------
export async function buergerbueros() {
  const { value, fresh } = await cached('bb-status', 60_000, async () => {
    const list = await fetchJson(`https://wartezeiten.stuttgart.de/bb/status?r=${Date.now() % 1e6}`);
    // status: 0 = außerhalb der Öffnungszeiten, 11 = alle Wartemarken vergeben, sonst Wartezeit ca. status x 15 Minuten (10 = Skalenende)
    return list.map((b) => ({
      id: b.id, label: b.label, department: b.department, url: b.url, notes: b.features ?? [], status: b.status,
      waitMin: b.status > 0 && b.status < 11 ? b.status * 15 : null,
      text: b.status === 0 ? 'außerhalb der Öffnungszeiten' : b.status === 11 ? 'alle Wartemarken vergeben' : b.status >= 10 ? 'Wartezeit 150 Minuten oder mehr' : `Wartezeit ca. ${b.status * 15} Minuten`,
    }));
  });
  const fac = (await facilities('buergerbuero')).items;
  return {
    items: value.map((b) => ({ ...b, ...(fac.find((f) => f.ref === b.department) ?? {}), label: b.label, usual: usual('bb', b.id), best: bestToday('bb', b.id) })),
    fetchedAt: new Date().toISOString(), fresh, since: since('bb'), quote: quote('bb'),
    source: 'Landeshauptstadt Stuttgart, Wartezeitanzeige der Bürgerbüros',
  };
}

// ---------- Bäder: Besucherzahl der Stuttgarter Bäder ----------
export async function baeder() {
  const { value, fresh } = await cached('baeder', 60_000, () => fetchJson('https://www.stuttgarterbaeder.de/fileadmin/jsonData/visitor_count.json'));
  const fac = (await facilities('bad')).items;
  const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-zäöüß]/g, '');
  return {
    items: (value.data ?? []).map((b) => {
      const n = norm(b.location_name).replace(/^das/, '');
      const f = fac.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name).replace(/^(hallenbad|freibad|mineralbad)/, '')));
      return {
        id: b.location_id, name: b.location_name, count: b.customer_amount, max: b.customer_amount_max, usual: usual('bad', b.location_id), best: bestToday('bad', b.location_id, 21),
        areas: (b.area_list ?? []).map((a) => ({ name: a.area_name, count: a.customer_amount, max: a.customer_amount_max })),
        ...(f ? { lat: f.lat, lon: f.lon, address: f.address } : {}),
      };
    }),
    fetchedAt: new Date().toISOString(), fresh,
    since: since('bad'), quote: quote('bad'),
    source: 'Stuttgarter Bäder, Besucherzahlen',
  };
}

// ---------- Abfuhrtermine der AWS ----------
/** Die AWS erwartet ihre eigene Schreibweise: "straße" als "str." */
const awsStreet = (s) => s.trim().replace(/stra(ß|ss)e\b/gi, 'str.').replace(/Stra(ß|ss)e\b/g, 'Str.').replace(/\s+/g, ' ');
const de = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
const WASTE = { restmuell: 'Restabfall', biomuell: 'Bioabfall', altpapier: 'Altpapier', gelbersack: 'Gelber Sack' };

export async function abfall(street, nr) {
  if (!street || !nr) throw new Error('Straße und Hausnummer angeben');
  const s = awsStreet(street); const n = String(nr).trim();
  const month = new Date().toISOString().slice(0, 7);
  const { value } = await cached(`aws-${s}-${n}-${month}`, 12 * 3600_000, async () => {
    const from = new Date(); const to = new Date(Date.now() + 62 * 86400_000);
    const body = new URLSearchParams({ 'calendar[street]': s, 'calendar[streetnr]': n, 'calendar[datefrom]': de(from), 'calendar[dateto]': de(to), 'calendar[submit]': '' });
    for (const k of Object.keys(WASTE)) body.append('calendar[wastetype][]', k);
    const res = await fetch('https://service.stuttgart.de/lhs-services/aws/abfuhrtermine', {
      method: 'POST', body, headers: { 'User-Agent': 'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt fuer die Stadt Stuttgart)', 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(20000),
    });
    const html = await res.text();
    if (res.status === 422 || /konnte nicht gefunden werden/i.test(html)) return { error: 'Adresse bei der AWS nicht gefunden. Schreibweise wie auf dem Abfallkalender verwenden, z. B. „Eberhardstr.“.' };
    if (!res.ok) throw new Error(`AWS antwortet mit ${res.status}`);
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
    const dates = [];
    let current = null;
    for (const r of rows) {
      const txt = r.join(' ');
      const type = Object.values(WASTE).find((w) => txt.startsWith(w)) ?? (/Gelbe?r? Sack|Wertstoff/i.test(txt) ? 'Gelber Sack' : null);
      if (type) current = type;
      const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(txt);
      const rhythm = /(\d{2}-wöchentl\.)/.exec(txt)?.[1] ?? null;
      if (m && current) dates.push({ type: current, date: `${m[3]}-${m[2]}-${m[1]}`, rhythm });
    }
    dates.sort((a, b) => a.date.localeCompare(b.date));
    return { street: s, nr: n, dates };
  });
  return { ...value, source: 'Abfallwirtschaft Stuttgart (AWS), Abfuhrtermine' };
}

// ---------- Grundschulbezirk ----------
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (pt, poly) => inRing(pt, poly[0]) && !poly.slice(1).some((h) => inRing(pt, h));

export async function schulbezirk(lat, lon) {
  const fs = await layer('A12_GBE_GSCHULBEZAREA');
  const pt = [lon, lat];
  const f = fs.find((x) => {
    const g = x.geometry;
    if (!g) return false;
    return (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((p) => inPoly(pt, p));
  });
  if (!f) return { school: null };
  const schools = (await facilities('grundschule')).items;
  const n = f.properties.GSCHNAME;
  const s = schools.find((x) => x.name?.toLowerCase().includes(n.toLowerCase().replace(/schule$/, ''))) ?? null;
  return { school: n, stand: f.properties.STAND, facility: s, source: 'Landeshauptstadt Stuttgart, Grundschulbezirke' };
}

// ---------- Ladepunkte (OCPDB über MobiData BW) ----------
export async function laden(lat, lon) {
  const la = (+lat).toFixed(3); const lo = (+lon).toFixed(3);
  const { value } = await cached(`ocpdb-${la}-${lo}`, 2 * 60_000, () =>
    fetchJson(`https://api.mobidata-bw.de/ocpdb/api/public/v1/locations?lat=${la}&lon=${lo}&radius=1000&limit=40`));
  const items = (value.items ?? value ?? []).map((l) => {
    const evses = l.evses ?? [];
    const known = evses.filter((e) => e.status && e.status !== 'STATIC' && e.status !== 'UNKNOWN');
    return {
      id: l.id ?? l.uid, name: l.name ?? l.address, address: join(l.address, l.city), lat: +(l.coordinates?.lat ?? l.lat), lon: +(l.coordinates?.lon ?? l.lon),
      operator: l.operator?.name ?? null, total: evses.length,
      available: known.length ? known.filter((e) => e.status === 'AVAILABLE').length : null,
      maxKw: Math.max(0, ...evses.flatMap((e) => (e.connectors ?? []).map((c) => (c.max_electric_power ?? 0) / 1000))) || null,
    };
  }).filter((x) => Number.isFinite(x.lat));
  return { items, source: 'MobiData BW, OCPDB (Ladesäulenregister der Bundesnetzagentur und Betreiberdaten)' };
}

// ---------- Gesundheit und Energie ----------
export async function gesundheit() {
  const [pollen, uv, strom] = await Promise.allSettled([
    cached('dwd-pollen', 3 * 3600_000, () => fetchJson('https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json')),
    cached('dwd-uv', 3 * 3600_000, () => fetchJson('https://opendata.dwd.de/climate_environment/health/alerts/uvi.json')),
    cached('stromgedacht', 15 * 60_000, () => fetchJson('https://api.stromgedacht.de/v1/statesRelative?zip=70173&hoursInFuture=24')),
  ]);
  const out = { source: 'DWD (Pollenflug, UV-Index), TransnetBW StromGedacht' };
  if (pollen.status === 'fulfilled') {
    const c = pollen.value.value.content.find((x) => x.partregion_id === 112) ?? null;
    if (c) out.pollen = { region: c.partregion_name, next: pollen.value.value.next_update, items: Object.entries(c.Pollen).map(([k, v]) => ({ name: k, today: v.today, tomorrow: v.tomorrow })) };
  }
  if (uv.status === 'fulfilled') {
    const c = uv.value.value.content.find((x) => x.city === 'Stuttgart');
    if (c) out.uv = c.forecast;
  }
  if (strom.status === 'fulfilled') out.strom = strom.value.value.states ?? strom.value.value;
  return out;
}

// ---------- Adresssuche (Nominatim, höchstens 1 Anfrage pro Sekunde, Ergebnis 30 Tage) ----------
export async function adresse(q) {
  const t = (q ?? '').trim();
  if (t.length < 3) return { items: [] };
  const { value } = await cached(`addr-${t.toLowerCase()}`, 30 * 86400_000, async () => {
    const d = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=de&addressdetails=1&viewbox=9.03,48.87,9.32,48.68&bounded=1&q=${encodeURIComponent(t)}`);
    return d.map((r) => ({
      label: [join([r.address?.road, r.address?.house_number].filter(Boolean).join(' ') || r.name, r.address?.suburb || r.address?.city_district)].join(''),
      street: r.address?.road ?? null, nr: r.address?.house_number ?? null,
      lat: +(+r.lat).toFixed(6), lon: +(+r.lon).toFixed(6),
    }));
  });
  return { items: value, source: '© OpenStreetMap-Mitwirkende (Nominatim)' };
}
