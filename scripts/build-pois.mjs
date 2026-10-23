#!/usr/bin/env node
// Baut den OSM-POI-Bestand für „Einkaufen & Geld“, „Notfall“ und „Alltag“ aus dem BBBike-Extrakt Stuttgart.
//
// Quelle: https://download.bbbike.org/osm/bbbike/Stuttgart/Stuttgart.osm.geojson.xz
// (täglich/wöchentlich aktualisiert, ODbL 1.0, © OpenStreetMap-Mitwirkende).
// Der Extrakt ist ein Rechteck um Stuttgart; die Features werden mit der amtlichen
// Stadtgrenze (Nominatim/OSM-Relation 62375) verschnitten. Ergebnis:
// server/data/pois-stuttgart.json – nur Fakten, keine Namen aus geschlossenen Storefindern.
//
// Aufruf:
//   node scripts/build-pois.mjs                 # lädt/aktualisiert den Extrakt (7 Tage Cache)
//   node scripts/build-pois.mjs --file /pfad/Stuttgart.osm.geojson.xz
//   node scripts/build-pois.mjs --refresh       # erzwingt einen neuen Download
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { readFile, rename } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = join(ROOT, 'server/.cache');
const OUT = join(ROOT, 'server/data/pois-stuttgart.json');
const BOUNDARY = join(CACHE, 'stuttgart-boundary.geojson');
const EXTRACT = join(CACHE, 'Stuttgart.osm.geojson.xz');
const SOURCE = 'https://download.bbbike.org/osm/bbbike/Stuttgart/Stuttgart.osm.geojson.xz';
const UA = 'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt; POI-Build)';
const MAX_AGE = 7 * 86400_000;

const args = process.argv.slice(2);
const fileArg = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
const refresh = args.includes('--refresh');
mkdirSync(CACHE, { recursive: true });
mkdirSync(dirname(OUT), { recursive: true });

const log = (...a) => console.log(...a);
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// ---------- Stadtgrenze ----------
async function boundary() {
  if (existsSync(BOUNDARY) && Date.now() - statSync(BOUNDARY).mtimeMs < 30 * 86400_000) {
    return JSON.parse(await readFile(BOUNDARY, 'utf8'));
  }
  log('Lade Stadtgrenze Stuttgart (Nominatim) …');
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=Stuttgart%2C%20Baden-W%C3%BCrttemberg&polygon_geojson=1&limit=1';
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim antwortet mit ${res.status}`);
  const list = await res.json();
  const geo = list?.[0]?.geojson;
  if (!geo || !['Polygon', 'MultiPolygon'].includes(geo.type)) throw new Error('Stadtgrenze nicht gefunden');
  writeFileSync(BOUNDARY, JSON.stringify(geo));
  return geo;
}

const inRing = (pt, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPoly = (pt, geo) => {
  const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.type === 'MultiPolygon' ? geo.coordinates : [];
  return polys.some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
};

const center = (g) => {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const pts = g.type === 'Polygon' ? g.coordinates[0]
    : g.type === 'MultiPolygon' ? g.coordinates.flat(2)
      : g.type === 'LineString' ? g.coordinates
        : g.type === 'MultiLineString' ? g.coordinates.flat() : [];
  if (!pts.length) return null;
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lon, lat];
};

// ---------- Extrakt ----------
async function ensureExtract() {
  const file = fileArg ? fileArg : EXTRACT;
  if (!fileArg && !refresh && existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE) return file;
  if (!fileArg) {
    log(`Lade ${SOURCE} (rund 138 MB) …`);
    const res = await fetch(SOURCE, { headers: { 'User-Agent': UA, Accept: 'application/octet-stream' } });
    if (!res.ok) throw new Error(`BBBike antwortet mit ${res.status}`);
    const tmp = `${file}.part`;
    const chunks = [];
    for await (const chunk of res.body) chunks.push(chunk);
    writeFileSync(tmp, Buffer.concat(chunks));
    await rename(tmp, file);
  }
  if (!existsSync(file)) throw new Error(`Datei nicht gefunden: ${file}`);
  return file;
}

function openText(file) {
  if (file.endsWith('.xz')) {
    const p = spawn('xz', ['-dc', file], { stdio: ['ignore', 'pipe', 'inherit'] });
    return createInterface({ input: p.stdout, crlfDelay: Infinity });
  }
  return createInterface({ input: createReadStream(file), crlfDelay: Infinity });
}

// ---------- Klassifikation ----------
const SHOP_CATS = {
  supermarket: 'supermarkt', bakery: 'baeckerei', kiosk: 'kiosk', convenience: 'kiosk',
  butcher: 'metzgerei', greengrocer: 'obst_gemuese', tobacco: 'tabak', farm: 'hofladen_osm',
};
const CAT_LABEL = {
  supermarkt: 'Supermarkt', baeckerei: 'Bäckerei', kiosk: 'Kiosk / Convenience', metzgerei: 'Metzgerei',
  obst_gemuese: 'Obst und Gemüse', tabak: 'Tabakladen', hofladen_osm: 'Hofladen', geschaeft: 'Geschäft',
  bank: 'Bank', geldautomat: 'Geldautomat', zigarettenautomat: 'Zigarettenautomat',
  defibrillator: 'Defibrillator', paketstation: 'Paketstation', briefkasten: 'Briefkasten',
  buecherschrank: 'Bücherschrank', hundepark: 'Hundepark', waschsalon: 'Waschsalon',
  wickeltisch: 'Toilette mit Wickeltisch', soziales: 'Soziale Anlaufstelle',
};

/** Zusatzangaben je Kategorie, die nicht in den allgemeinen OSM-Feldern stecken. */
function specialInfo(cat, p) {
  if (cat === 'defibrillator') return [
    p['defibrillator:location'] ? `Standort: ${p['defibrillator:location']}` : null,
    p.access === 'yes' ? 'öffentlich zugänglich' : p.access === 'no' ? 'nicht öffentlich' : p.access ? `Zugang: ${p.access}` : null,
    p.indoor === 'yes' ? 'im Gebäude' : p.indoor === 'no' ? 'im Freien' : null,
    p.level ? `Ebene ${p.level}` : null,
  ];
  if (cat === 'paketstation') return [
    p.parcel_mail_in === 'yes' ? 'Pakete einwerfen' : null,
    p.parcel_pickup === 'yes' ? 'Pakete abholen' : null,
    p.ref ? `Nummer ${p.ref}` : null,
  ];
  if (cat === 'briefkasten') return [
    p.collection_times ? `Leerung: ${p.collection_times}` : null,
    p.ref ? `Nummer ${p.ref}` : null,
  ];
  if (cat === 'buecherschrank') return [
    p.capacity ? `Kapazität: ${p.capacity}` : null,
    p.access === 'yes' ? 'öffentlich zugänglich' : null,
  ];
  if (cat === 'hundepark') return [
    p.fenced === 'yes' ? 'eingezäunt' : p.fenced === 'no' ? 'nicht eingezäunt' : null,
    p.surface ? `Untergrund: ${p.surface}` : null,
  ];
  if (cat === 'waschsalon') return [
    p.self_service === 'yes' ? 'Selbstbedienung' : null,
  ];
  if (cat === 'wickeltisch') return [
    'Wickeltisch vorhanden',
    p.unisex === 'yes' ? 'Unisex' : null,
  ];
  if (cat === 'soziales') return [
    p.social_facility === 'food_bank' ? 'Lebensmittelausgabe' : null,
    p.shop === 'charity' ? 'Charity-Laden, Weltladen oder Abgabestation' : null,
    p.description ?? null,
  ];
  return [];
}

const address = (p) => {
  const street = [p['addr:street'], p['addr:housenumber']].filter(Boolean).join(' ');
  const city = [p['addr:postcode'], p['addr:city'] ?? (p['addr:postcode'] ? 'Stuttgart' : null)].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || null;
};

function makeItem(f, cat, pt, extra = {}) {
  const p = f.properties ?? {};
  const name = extra.name ?? p.name ?? p.brand ?? p.operator ?? CAT_LABEL[cat] ?? cat;
  const info = [
    CAT_LABEL[cat],
    ...specialInfo(cat, p),
    p.shop && p.shop !== cat ? `shop=${p.shop}` : null,
    p.amenity === 'bank' && p.atm === 'yes' ? 'Geldautomat vorhanden' : null,
    p.cash_in === 'yes' ? 'Bargeld-Einzahlung' : p.cash_in === 'no' ? 'keine Einzahlung' : null,
    p.fee === 'yes' ? 'gebührenpflichtig' : p.fee === 'no' ? 'gebührenfrei' : null,
    p.organic === 'yes' ? 'Bio' : null,
    p.wheelchair === 'yes' ? 'rollstuhlgerecht' : p.wheelchair === 'limited' ? 'eingeschränkt rollstuhlgerecht' : p.wheelchair === 'no' ? 'nicht rollstuhlgerecht' : null,
    p.check_date ? `geprüft ${p.check_date.split('-').reverse().join('.')}` : null,
    cat === 'zigarettenautomat' ? 'Standorte unvollständig, kein amtliches Register' : null,
  ].filter(Boolean);
  return {
    id: extra.id ?? `${cat}-${slug(name)}-${pt[0].toFixed(5)}-${pt[1].toFixed(5)}`,
    cat,
    name: String(name).trim(),
    lat: +pt[1].toFixed(6),
    lon: +pt[0].toFixed(6),
    address: address(p),
    phone: p.phone ?? p['contact:phone'] ?? null,
    website: p.website ?? p['contact:website'] ?? null,
    hours: p.opening_hours ?? null,
    operator: p.operator ?? null,
    brand: p.brand ?? null,
    wheelchair: p.wheelchair ?? null,
    cashIn: p.cash_in ?? null,
    fee: p.fee ?? null,
    organic: p.organic ?? null,
    vending: p.vending ?? null,
    osm: `https://www.openstreetmap.org/?mlat=${(+pt[1]).toFixed(6)}&mlon=${(+pt[0]).toFixed(6)}#map=19/${(+pt[1]).toFixed(5)}/${(+pt[0]).toFixed(5)}`,
    info,
    ...extra,
  };
}

const items = [];
const seen = new Set();
const seenIds = new Set();

async function main() {
  const geo = await boundary();
  const file = await ensureExtract();
  log(`Lese ${file} …`);
  let n = 0;
  for await (const line of openText(file)) {
    const raw = line.trim().replace(/,$/, '');
    if (!raw || raw === '{"type":"FeatureCollection","features":[' || raw === ']}' || raw === ']') continue;
    let f;
    try { f = JSON.parse(raw); } catch { continue; }
    if (f?.type !== 'Feature') continue;
    n++;
    const p = f.properties ?? {};
    const pt = center(f.geometry);
    if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
    if (!inPoly(pt, geo)) continue;
    const shop = p.shop;
    const amenity = p.amenity;
    const base = { name: p.name ?? p.brand ?? p.operator ?? null };

    const add = (cat, extra = {}) => {
      const item = makeItem(f, cat, pt, extra);
      if (!item.name) return;
      const allowGeneric = ['geldautomat', 'zigarettenautomat', 'defibrillator', 'paketstation', 'briefkasten', 'buecherschrank', 'hundepark', 'waschsalon', 'wickeltisch', 'soziales'];
      if (item.name === CAT_LABEL[cat] && !allowGeneric.includes(cat)) return;
      const key = `${cat}|${item.name}|${item.lat.toFixed(5)}|${item.lon.toFixed(5)}`;
      if (seen.has(key) || seenIds.has(item.id)) return;
      seen.add(key); seenIds.add(item.id); items.push(item);
    };

    if (shop) {
      add('geschaeft');
      const cat = SHOP_CATS[shop];
      if (cat) add(cat);
      if (shop === 'laundry') add('waschsalon', { name: p.name ?? p.operator ?? 'Waschsalon' });
    }
    if (amenity === 'bank') {
      add('bank');
      if (p.atm === 'yes') add('geldautomat', { id: `geldautomat-bank-${slug(base.name)}-${pt[0].toFixed(5)}-${pt[1].toFixed(5)}`, name: `Geldautomat ${base.name ?? 'Bank'}` });
    }
    if (amenity === 'atm') add('geldautomat');
    if (amenity === 'vending_machine' && /cigarette/i.test(String(p.vending ?? ''))) add('zigarettenautomat');
    if (p.emergency === 'defibrillator' || amenity === 'defibrillator') {
      const loc = String(p['defibrillator:location'] ?? '').trim();
      add('defibrillator', { name: p.name ?? (loc ? `Defibrillator · ${loc}`.slice(0, 100) : p.operator ? `Defibrillator (${p.operator})` : 'Defibrillator') });
    }
    if (amenity === 'parcel_locker') {
      const brand = p.operator ?? p.brand;
      const raw = String(p.name ?? '').trim();
      const name = raw || (brand ? `Paketstation ${brand}` : 'Paketstation');
      add('paketstation', { name: /^amazon locker$/i.test(name) && p.ref ? `Amazon Locker ${p.ref}` : name });
    }
    if (amenity === 'post_box') add('briefkasten', { name: p.name ?? p.operator ?? 'Briefkasten' });
    if (amenity === 'public_bookcase') add('buecherschrank', { name: p.name ?? 'Bücherschrank' });
    if (p.leisure === 'dog_park') add('hundepark', { name: p.name ?? 'Hundepark' });
    if (amenity === 'toilets' && p.changing_table === 'yes') add('wickeltisch', { name: p.name ?? 'Toilette mit Wickeltisch' });
    if (p.social_facility === 'food_bank' || p.shop === 'charity') {
      add('soziales', { name: p.name ?? (p.social_facility === 'food_bank' ? 'Tafel' : 'Sozialkaufhaus') });
    }
  }

  items.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name, 'de') || a.lat - b.lat);
  const counts = {};
  for (const x of items) counts[x.cat] = (counts[x.cat] ?? 0) + 1;
  const out = {
    stand: new Date().toISOString().slice(0, 10),
    quelle: 'OpenStreetMap, BBBike-Extrakt Stuttgart (Stadtgrenze zugeschnitten)',
    url: 'https://download.bbbike.org/osm/bbbike/Stuttgart/',
    lizenz: 'ODbL 1.0, © OpenStreetMap-Mitwirkende',
    hinweis: 'OSM ist für Supermärkte, Bäckereien und Banken gut gepflegt, für Geldautomaten brauchbar und für Zigarettenautomaten unvollständig. Defibrillatoren, Paketstationen, Briefkästen, Bücherschränke, Hundeparks, Waschsalons, Toiletten mit Wickeltisch sowie Tafeln und Sozialkaufhäuser sind ergänzende OSM-Angaben, keine amtlichen Register; im Notfall gilt 112. Öffnungszeiten und Betreiber nur, wenn in OSM vorhanden. Keine Live-Öffnung, keine Aussage über Vollständigkeit.',
    counts,
    total: items.length,
    items,
  };
  writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  log(`Geschrieben: ${OUT}`);
  log(`  ${n.toLocaleString('de-DE')} Features gelesen, ${items.length.toLocaleString('de-DE')} POIs in Stuttgart`);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) log(`  ${String(v).padStart(5)}  ${k}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
