// "In meiner Nähe": Einrichtungen aus dem Geoserver der Stadt (WFS, CC BY 4.0), dazu Live-Daten der Bäder
// und Bürgerbüros, Abfuhrtermine der AWS, Grundschulbezirke, Ladepunkte (MobiData BW OCPDB),
// Pollenflug und UV-Index (DWD) und der Netzzustand von StromGedacht (TransnetBW).
// Einrichtungsebenen ändern sich selten: einmal am Tag je Ebene, Live-Daten höchstens einmal pro Minute.
import { cached, fetchJson, fetchText } from '../cache.mjs';
import { bestToday, quote, since, usual } from './verlauf.mjs';
import { tankpreise } from './tanken.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Gastronomie aus OpenStreetMap (Auszug für das Stadtgebiet, ODbL), siehe public/data/gastro.geojson
const GASTRO_FILE = fileURLToPath(new URL('../../public/data/gastro.geojson', import.meta.url));
const POIS_FILE = fileURLToPath(new URL('../data/pois-stuttgart.json', import.meta.url));
const KUECHE = { italian: 'italienisch', regional: 'regional', pizza: 'Pizza', kebab: 'Kebab', german: 'deutsch', burger: 'Burger', asian: 'asiatisch',
  turkish: 'türkisch', greek: 'griechisch', vietnamese: 'vietnamesisch', indian: 'indisch', swabian: 'schwäbisch', chinese: 'chinesisch', japanese: 'japanisch',
  sushi: 'Sushi', thai: 'thailändisch', coffee_shop: 'Kaffee', cake: 'Kuchen', ice_cream: 'Eis', sandwich: 'Sandwiches', mexican: 'mexikanisch',
  spanish: 'spanisch', french: 'französisch', korean: 'koreanisch', lebanese: 'libanesisch', international: 'international', vegan: 'vegan',
  bakery: 'Backwaren', falafel: 'Falafel', steak_house: 'Steakhaus', seafood: 'Fisch', fish: 'Fisch', noodle: 'Nudeln', ramen: 'Ramen', croatian: 'kroatisch', balkan: 'Balkan' };
const ROLLSTUHL = { yes: 'stufenlos zugänglich', limited: 'eingeschränkt stufenlos', no: 'nicht stufenlos' };
const GASTRO_ART = { essen_restaurant: ['restaurant', 'food_court'], essen_cafe: ['cafe'], essen_imbiss: ['fast_food'], essen_kneipe: ['pub', 'bar'], essen_biergarten: ['biergarten'], essen_eis: ['ice_cream'] };
let gastroCache = null;
const DIET_LABEL = {
  'vegan-only': 'ausschließlich vegan',
  vegan: 'vegane Gerichte',
  'vegetarian-only': 'ausschließlich vegetarisch',
  vegetarian: 'vegetarische Gerichte',
};
/** OSM diet:vegan / diet:vegetarian in eine Stufe übersetzen. Vegan zählt immer auch als vegetarisch. */
function dietOf(p) {
  const v = String(p['diet:vegan'] ?? '').trim().toLowerCase();
  const g = String(p['diet:vegetarian'] ?? '').trim().toLowerCase();
  if (v === 'only') return 'vegan-only';
  if (v === 'yes') return 'vegan';
  if (g === 'only') return 'vegetarian-only';
  if (g === 'yes') return 'vegetarian';
  return null;
}
function dietMatch(diet, want) {
  if (!want) return true;
  if (want === 'vegan') return diet === 'vegan' || diet === 'vegan-only';
  if (want === 'vegan-only') return diet === 'vegan-only';
  if (want === 'vegetarian') return diet === 'vegan' || diet === 'vegan-only' || diet === 'vegetarian' || diet === 'vegetarian-only';
  if (want === 'vegetarian-only') return diet === 'vegan-only' || diet === 'vegetarian-only';
  return true;
}
let poisCache = null;
/** Lokaler OSM-POI-Bestand (Einkaufen, Banken, Automaten), gebaut von scripts/build-pois.mjs. */
function pois(cat, wantCat) {
  poisCache ??= JSON.parse(readFileSync(POIS_FILE, 'utf8'));
  return poisCache.items.filter((x) => x.cat === wantCat).map((x) => ({
    id: x.id, cat, name: x.name, lat: x.lat, lon: x.lon,
    address: x.address ?? null, phone: x.phone ?? null, web: x.website ?? null, hours: x.hours ?? null,
    wheelchair: x.wheelchair ?? null, osmUrl: x.osm ?? null,
    info: [...(x.info ?? []), x.operator ? `Betreiber: ${x.operator}` : null, x.brand && x.brand !== x.name ? `Marke: ${x.brand}` : null].filter(Boolean),
  }));
}
function poisStand() {
  const stand = poisCache?.stand;
  return stand ? `, Stand ${stand.split('-').reverse().join('.')}` : '';
}

function gastro(cat, wantDiet = null) {
  gastroCache ??= JSON.parse(readFileSync(GASTRO_FILE, 'utf8'));
  const kinds = GASTRO_ART[cat];
  return gastroCache.features.filter((f) => kinds.includes(f.properties.amenity) && f.properties.name).map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const kueche = (p.cuisine ?? '').split(';').map((c) => KUECHE[c.trim()] ?? null).filter(Boolean);
    const diet = dietOf(p);
    return {
      id: `${cat}-${f.id}`, cat, name: p.name, lat: +lat.toFixed(6), lon: +lon.toFixed(6),
      address: join([p['addr:street'], p['addr:housenumber']].filter(Boolean).join(' ') || null, p['addr:postcode'] ? `${p['addr:postcode']} Stuttgart` : null) || null,
      web: p.website ?? p['contact:website'] ?? null, phone: p.phone ?? p['contact:phone'] ?? null, hours: p.opening_hours ?? null,
      wheelchair: p.wheelchair ?? null, osm: f.id, diet,
      info: [kueche.length ? `Küche: ${kueche.join(', ')}` : null, p.wheelchair ? ROLLSTUHL[p.wheelchair] ?? null : null,
        p['toilets:wheelchair'] === 'yes' ? 'rollstuhlgerechtes WC' : null, p.outdoor_seating === 'yes' ? 'Außenplätze' : null,
        diet ? DIET_LABEL[diet] : null,
        p.takeaway === 'yes' ? 'zum Mitnehmen' : null, p['check_date:opening_hours'] ? `Öffnungszeiten geprüft am ${p['check_date:opening_hours'].split('-').reverse().join('.')}` : null].filter(Boolean),
    };
  }).filter((x) => dietMatch(x.diet, wantDiet));
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
  realschule: { label: 'Realschulen', group: 'familie', layers: ['IP_2_04_04_REALSCHULE'], map: infopool },
  werkrealschule: { label: 'Werkrealschulen', group: 'familie', layers: ['IP_2_04_47_WERKREALSCHULE'], map: infopool },
  gemeinschaftsschule: { label: 'Gemeinschaftsschulen', group: 'familie', layers: ['IP_2_04_49_GEMEINSCHAFTSSCHULE'], map: infopool },
  foerderschule: { label: 'Förderschulen', group: 'familie', layers: ['IP_2_04_07-16_FOERDERSCHULE'], map: infopool },
  berufsschule: { label: 'Berufsschulen', group: 'familie', layers: ['IP_2_04_20_BERUFSSCHULE'], map: infopool },
  hochschule: { label: 'Hochschulen', group: 'familie', layers: ['IP_2_04_25-27_UNI_HOCHSCHULE'], map: infopool },
  vhs: { label: 'Volkshochschulen', group: 'familie', layers: ['IP_2_04_31_VHS'], map: infopool },
  sonstige_bildung: { label: 'Sonstige Bildung', group: 'familie', layers: ['IP_2_04_32u33_SONSTIGE_BILDUNG'], map: infopool },
  spielplatz: {
    label: 'Spielplätze', group: 'familie', layers: ['A62_SPF_SPIELPLAETZE'],
    map: (p) => ({ name: `Spielplatz ${p.NAME}`, address: p.STADTTEIL_NAME, closed: yes(p.GESPERRT),
      info: [p.FLÄCHE ? `${Math.round(p.FLÄCHE).toLocaleString('de-DE')} m²` : null, yes(p.GESPERRT) ? 'derzeit gesperrt' : null, p.BESONDERHEIT].filter(Boolean) }),
  },
  bad: { label: 'Bäder', group: 'freizeit', layers: ['IP_2_03_36_HALLENBAD', 'IP_2_03_36_FREIBAD', 'IP_2_03_36_MINERALBAD'], map: infopool },
  minigolf: { label: 'Minigolf', group: 'freizeit', layers: ['IP_2_03_39_MINIGOLF'], map: infopool },
  kunst: { label: 'Kunst und Ateliers', group: 'freizeit', layers: ['IP_BILDENDE_KUNST'], map: infopool },
  musik: { label: 'Musikschulen und -orte', group: 'freizeit', layers: ['IP_MUSIK', 'IP_KULTURAMT_MUSIKSCHULE'], map: infopool },
  theater: { label: 'Theater und Bühnen', group: 'freizeit', layers: ['IP_THEATER'], map: infopool },
  kino: { label: 'Kinos', group: 'freizeit', layers: ['IP_FILM_MEDIEN'], map: infopool },
  digitale_teilhabe: {
    label: 'Digitale Teilhabe', group: 'familie', layers: ['A50_SOZ_DIGITALE_TEILHABE'],
    map: (p) => ({ ...infopool(p), name: p.NAME ?? p.TITEL ?? 'Kurs zur digitalen Teilhabe', info: [p.KURSART ?? p.ANGEBOT ?? null, p.WOCHENTAG && p.UHRZEIT ? `${p.WOCHENTAG} ${p.UHRZEIT}` : null, p.HYBRID ? 'hybrid' : 'Präsenz', p.BARRIEREFREI].filter(Boolean) }),
  },
  ferienprogramm: {
    label: 'Ferienprogramm', group: 'familie',
    layers: ['A51_ALG_FP_PUNKTE_Ausfluege_Wissenswertes', 'A51_ALG_FP_PUNKTE_Kreatives_Kultur', 'A51_ALG_FP_PUNKTE_Natur_Tiere', 'A51_ALG_FP_PUNKTE_Sport_Spiel_Action', 'A51_ALG_FP_PUNKTE_Vermischtes'],
    map: (p) => {
      const dt = (s) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s ?? ''));
        return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : null;
      };
      const von = dt(p.DATUM_VON);
      const bis = dt(p.DATUM_BIS);
      return {
        name: p.NAME ?? 'Ferienangebot',
        address: p.TREFFPUNKT ?? p.ORT ?? null,
        web: p.WEBLINK ?? null,
        info: [p.KATEGORIE, von ? `${von}${bis ? ` bis ${bis}` : ''}` : null,
          p.ALTER_VON ? `ab ${p.ALTER_VON}${p.ALTER_BIS ? ` bis ${p.ALTER_BIS}` : ''} Jahren` : null,
          p.GEBUEHR_TXT && !/^0([,.]0+)?$/.test(String(p.GEBUEHR_TXT).trim()) ? `${p.GEBUEHR_TXT} Euro` : 'kostenfrei',
          p.VERANSTALTER, p.ANMELDUNG, p.BARRIEREFREI === 'ja' ? 'barrierefrei' : null].filter(Boolean),
      };
    },
  },
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
  umweltmobil: {
    label: 'Schadstoffmobil', group: 'abfall', layers: ['IP_2_10_24_UMWELTMOBIL'],
    map: (p) => ({ ...infopool(p), name: p.NAME || `Haltestelle Schadstoffmobil ${p.STRASSE ?? ''}`.trim(), info: [p.BEMERKUNG, p.STANDORT, p.TERMIN].filter(Boolean) }),
  },
  gruengut: {
    label: 'Grüngutannahme', group: 'abfall', layers: ['IP_3_05_05_GRUENGUT'],
    map: (p) => ({ ...infopool(p), name: p.NAME || `Grüngutannahmestelle ${p.STRASSE ?? ''}`.trim() }),
  },
  recup: {
    label: 'Mehrweg-Becher (RECUP)', group: 'abfall', layers: ['FREMDDATEN_RECUP_STANDORTE'],
    map: (p) => ({ name: p.NAME ?? p.BETRIEB ?? 'RECUP-Ausgabestelle', address: join(p.STRASSE, [p.PLZ, p.ORT].filter(Boolean).join(' ')), web: p.URL ?? null, info: ['RECUP Mehrweg-Pfandsystem', p.KATEGORIE ?? p.TYP].filter(Boolean) }),
  },
  mineralbrunnen: {
    label: 'Mineral- und Heilquellen', group: 'unterwegs', layers: ['A62_BRU_BRUNNEN_Mineralbr_in_Betr'],
    map: (p) => ({ name: p.NAME || 'Mineralbrunnen', address: p.BEZEICHNUNG_STANDORT ?? p.STANDORT ?? null, info: ['Stuttgarter Mineralwasser', p.STATUS, p.BEMERKUNG].filter(Boolean) }),
  },
  hofladen: {
    label: 'Hofläden und Direktvermarkter', group: 'essen', layers: ['A62_INFOPOOL_DIREKTVERMARKTER'],
    map: (p) => ({ ...infopool(p), name: p.NAME ?? p.BETRIEB ?? 'Direktvermarkter', info: [p.ANGEBOT ?? p.PRODUKTE ?? p.BEMERKUNG ?? 'Erzeugnisse aus Stuttgarter Landwirtschaft'].filter(Boolean) }),
  },
  chillorte: {
    label: 'Jugend-Chillorte', group: 'freizeit',
    layers: ['A61_JGD_CHILLORTE_AUSSICHT', 'A61_JGD_CHILLORTE_BEWEGUNG', 'A61_JGD_CHILLORTE_KREATIV', 'A61_JGD_CHILLORTE_MITTENDRIN', 'A61_JGD_CHILLORTE_NATUR', 'A61_JGD_CHILLORTE_ZWECKENTFR'],
    map: (p, l) => {
      const kat = l?.endsWith('AUSSICHT') ? 'Aussicht' : l?.endsWith('BEWEGUNG') ? 'Bewegung' : l?.endsWith('KREATIV') ? 'Kreativ' : l?.endsWith('MITTENDRIN') ? 'Mittendrin' : l?.endsWith('NATUR') ? 'Natur' : l?.endsWith('ZWECKENTFR') ? 'Umgenutzter Ort' : null;
      return {
        name: p.NAME ?? p.TITEL ?? p.BEZEICHNUNG ?? p.WO ?? `Chillort ${kat ?? ''}`.trim(),
        address: join(p.STRASSE, p.STADTTEIL ?? p.STADTBEZIRK),
        web: p.URL ?? p.LINK ?? null,
        info: [kat ? `Kategorie: ${kat}` : null, p.WAS ?? p.BESCHREIBUNG ?? p.BEMERKUNG ?? p.AUSSTATTUNG, p.WEN ? `Empfohlen für: ${p.WEN}` : null, p.QUELLE ? `erfasst vom ${p.QUELLE}` : null].filter(Boolean),
      };
    },
  },
  gutefee: {
    label: 'Aktion Gute Fee', group: 'notfall',
    layers: ['A62_AKTION_GUTE_FEE'],
    map: (p) => ({
      name: p.NAME ?? 'Gute Fee',
      address: join(p.ADRESSE, [p.PLZ, 'Stuttgart'].filter(Boolean).join(' ')),
      phone: p.TELEFON ?? null,
      email: p.EMAIL ?? null,
      info: ['Sichere Anlaufstelle für Kinder', p.STADTTEIL ?? p.STADTBEZIRK].filter(Boolean),
    }),
  },
  obstgehoelze: {
    label: 'Essbare Stadt: Obst- und Nussbäume', group: 'freizeit',
    layers: ['A67_GFM_Obstgehoelze', 'A67_GFM_Nussbaum'],
    map: (p, l) => ({
      name: `${p.BAUMART ?? (l?.includes('Nussbaum') ? 'Nussbaum' : 'Obstgehölz')}${p.BAUMART_BOT ? ` (${p.BAUMART_BOT})` : ''}`,
      address: join(p.LAGEBEZEICHNUNG, p.STADTTEIL ?? p.STADTBEZIRK),
      info: [p.PFLANZJAHR && Number(p.PFLANZJAHR) > 1750 ? `gepflanzt ${p.PFLANZJAHR}` : null,
        p.NATURDENKMAL && !/^(0|nein)$/i.test(String(p.NATURDENKMAL)) ? 'Naturdenkmal' : null,
        p.BAUMWUCHS ?? null, 'städtischer Baum, Ernte nur für den Eigenbedarf'].filter(Boolean),
    }),
  },
  // Vereine und Engagement: bewusst nur öffentliche Anlaufstellen mit eigener Adresse.
  // Private Vorstandsadressen und reine Postanschriften werden nicht auf die Karte gelegt.
  verein_sport: {
    label: 'Sportvereine und Sportanlagen', group: 'vereine',
    layers: ['IP_2_03_02_SPORTHALLE', 'IP_2_03_03_SPORTPLATZ', 'IP_2_03_05_EISSPORT', 'IP_2_03_06_REITSPORT'],
    map: (p) => ({ ...infopool(p), name: p.NAME, info: [p.ADRESSTYP ?? 'Sportanlage', 'öffentliche Sportanlage, Vereinsbetrieb möglich'].filter(Boolean) }),
  },
  verein_kultur: {
    label: 'Kultur- und Musikvereine', group: 'vereine',
    layers: ['IP_STADTTEILKULTUR', 'IP_KULTURAMT_MUSIKSCHULE'],
    map: (p) => ({ ...infopool(p), name: p.NAME, info: [p.ADRESSTYP ?? 'Kultureinrichtung', 'öffentliche Kultureinrichtung'].filter(Boolean) }),
  },
  verein_stadtteil: {
    label: 'Stadtteil, Jugend und Engagement', group: 'vereine',
    layers: ['IP_2_06_09u13_SONSTIGE_VEREINIGUNGEN', 'IP_2_15_06_BUERGERHAUS', 'IP_2_01_11_KINDER_JUGENDTREFFS', 'IP_2_14_11_JUGENDGAESTEHAUS', 'IP_3_05_01_JUGENDBERATUNG', 'IP_3_05_11_JUGENDGESUNDHEIT'],
    map: (p) => ({ ...infopool(p), name: p.NAME, info: [p.ADRESSTYP ?? 'Anlaufstelle', 'offene Anlaufstelle im Stadtteil'].filter(Boolean) }),
  },
  verein_natur: {
    label: 'Natur, Wald und Kleingarten', group: 'vereine',
    layers: ['IP_2_01_14_WALDHEIM'],
    map: (p) => ({ ...infopool(p), name: p.NAME, info: [p.ADRESSTYP ?? 'Waldheim', 'öffentliche Anlage'].filter(Boolean) }),
  },
  fahrradgarage: {
    label: 'Fahrrad- und Lastenrad-Abstellanlagen', group: 'unterwegs',
    layers: ['A66_TIBIS_RADW_RADBUEGEL_Fahrradgarage', 'A66_TIBIS_RADW_RADBUEGEL_Lastenrad_Abstellanlage', 'A66_TIBIS_RADW_RADBUEGEL_Radabstellanlage_ueberdacht'],
    map: (p, l) => {
      const art = l?.includes('Fahrradgarage') ? 'Fahrradgarage' : l?.includes('Lastenrad') ? 'Lastenrad-Abstellanlage' : 'Überdachte Radabstellanlage';
      return {
        name: p.NAME ?? p.STANDORT ?? `${art} ${p.STRASSE ?? ''}`.trim(),
        address: join(p.STRASSE, p.STADTBEZIRK ?? p.STADTTEIL),
        info: [art, p.ANZAHL ? `${p.ANZAHL} Stellplätze` : null, p.BAUART ?? p.BEMERKUNG].filter(Boolean),
      };
    },
  },
  scooter_zone: {
    label: 'E-Scooter-Abstellzonen', group: 'unterwegs', layers: ['A32_ES_ABSTELLFLAECHEN'],
    map: (p) => ({
      name: p.STANDORT ?? p.NAME ?? p.BEZEICHNUNG ?? 'E-Scooter-Abstellfläche',
      address: join(p.STRASSE, p.STADTBEZIRK ?? p.STADTTEIL),
      info: ['Feste E-Scooter-Abstellfläche', p.KAPAZITAET ? `Kapazität: ${p.KAPAZITAET}` : null, p.BEMERKUNG].filter(Boolean),
    }),
  },
  behindertenparkplatz: {
    label: 'Behindertenparkplätze', group: 'unterwegs', layers: ['A66_TIBIS_PRM_STELLPLATZ_PUNKT_Behindertenstellplatz'],
    map: (p) => ({
      name: `Behindertenstellplatz ${p.STRASSE ?? p.STANDORT ?? ''}`.trim(),
      address: join(p.STRASSE, p.STADTBEZIRK ?? p.STADTTEIL),
      info: [p.ANZAHL ? `${p.ANZAHL} Stellplätze` : 'Behindertenstellplatz', p.ZEITBEGRENZUNG ?? p.BEMERKUNG ?? p.ZUSATZZEICHEN].filter(Boolean),
    }),
  },
  // Einkaufen und Geld: lokaler OSM-Bestand aus scripts/build-pois.mjs.
  supermarkt: { label: 'Supermärkte', group: 'einkaufen', local: 'pois', poiCat: 'supermarkt' },
  baeckerei: { label: 'Bäckereien', group: 'einkaufen', local: 'pois', poiCat: 'baeckerei' },
  kiosk: { label: 'Kioske und Convenience', group: 'einkaufen', local: 'pois', poiCat: 'kiosk' },
  metzgerei: { label: 'Metzgereien', group: 'einkaufen', local: 'pois', poiCat: 'metzgerei' },
  obst_gemuese: { label: 'Obst und Gemüse', group: 'einkaufen', local: 'pois', poiCat: 'obst_gemuese' },
  tabak: { label: 'Tabakläden', group: 'einkaufen', local: 'pois', poiCat: 'tabak' },
  hofladen_osm: { label: 'Hofläden (OSM)', group: 'einkaufen', local: 'pois', poiCat: 'hofladen_osm' },
  geschaeft: { label: 'Alle Geschäfte', group: 'einkaufen', local: 'pois', poiCat: 'geschaeft' },
  bank: { label: 'Banken', group: 'geld', local: 'pois', poiCat: 'bank' },
  geldautomat: { label: 'Geldautomaten', group: 'geld', local: 'pois', poiCat: 'geldautomat' },
  zigarettenautomat: { label: 'Zigarettenautomaten (unvollständig)', group: 'geld', local: 'pois', poiCat: 'zigarettenautomat' },
  // Notfall und Alltag: ergänzende OSM-Angaben aus derselben Datei.
  defibrillator: { label: 'Defibrillatoren (AED)', group: 'notfall', local: 'pois', poiCat: 'defibrillator' },
  paketstation: { label: 'Paketstationen', group: 'alltag', local: 'pois', poiCat: 'paketstation' },
  briefkasten: { label: 'Briefkästen', group: 'alltag', local: 'pois', poiCat: 'briefkasten' },
  buecherschrank: { label: 'Bücherschränke', group: 'alltag', local: 'pois', poiCat: 'buecherschrank' },
  waschsalon: { label: 'Waschsalons', group: 'alltag', local: 'pois', poiCat: 'waschsalon' },
  hundepark: { label: 'Hundeparks', group: 'alltag', local: 'pois', poiCat: 'hundepark' },
  wickeltisch: { label: 'Toiletten mit Wickeltisch', group: 'alltag', local: 'pois', poiCat: 'wickeltisch' },
  soziales: { label: 'Tafeln und Sozialkaufhäuser', group: 'alltag', local: 'pois', poiCat: 'soziales' },
  tanken: { label: 'Tankstellen', group: 'unterwegs', local: 'tanken' },
};

function geomPoint(g) {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const pts = g.type === 'LineString' || g.type === 'MultiPoint' ? g.coordinates
    : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates.flat()
      : g.type === 'MultiPolygon' ? g.coordinates.flat(2) : [];
  if (!pts.length) return null;
  const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lon, lat];
}

async function layer(name) {
  const { value } = await cached(`wfs-${name}`, 24 * 3600_000, async () => {
    const j = await fetchJson(WFS(name), { timeout: 30000 });
    return j.features ?? [];
  });
  return value;
}

export async function facilities(cat, { diet = null } = {}) {
  const c = CATEGORIES[cat];
  if (!c) throw new Error('Unbekannte Kategorie');
  if (c.local === 'pois') {
    const items = pois(cat, c.poiCat);
    return { cat, label: c.label, items, source: `© OpenStreetMap-Mitwirkende (ODbL)${poisStand()}` };
  }
  if (c.local === 'tanken') {
    const t = await tankpreise();
    const eur = (v) => (v == null ? null : `${v.toFixed(3).replace('.', ',')} €/l`);
    const line = (s) => [['E5', s.e5], ['E10', s.e10], ['Diesel', s.diesel]]
      .filter(([, v]) => v != null).map(([l, v]) => `${l} ${eur(v)}`).join(' · ') || 'keine Preise gemeldet';
    const standDate = new Date(t.stand);
    const stand = `${standDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${standDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    const items = t.stations.map((s) => ({
      id: `tanken-${s.id}`, cat, name: s.name, lat: s.lat, lon: s.lon,
      address: s.address, live: `${line(s)} · ${s.isOpen ? 'geöffnet' : 'geschlossen'}`,
      info: [s.brand && s.brand !== s.name ? `Marke: ${s.brand}` : null, `Preisstand: ${stand}`, 'Preise ohne Gewähr; maßgeblich ist die Zapfsäule.'].filter(Boolean),
      source: `${t.source}. Abgerufen ${stand} Uhr.`,
    }));
    return { cat, label: c.label, items, source: t.source };
  }
  if (c.local) return { cat, label: c.label, items: gastro(cat, diet), source: '© OpenStreetMap-Mitwirkende (ODbL), Auszug Stand 17.10.2026' };
  const { value } = await cached(`fac-${cat}`, 24 * 3600_000, async () => {
    const out = [];
    for (const l of c.layers) {
      const fs = await layer(l).catch(() => []);
      fs.forEach((f, i) => {
        const pt = geomPoint(f.geometry);
        if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return;
        const [lon, lat] = pt;
        const m = c.map(f.properties ?? {}, l);
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

// ---------- Freizeit-Routen: Weinwanderwege, Innenstadtrundweg & MTB-Downhill „Woodcracker“ (mit Zacke-Verknüpfung) ----------
export async function freizeitRouten() {
  const { value, at, fresh } = await cached('freizeit-routen', 24 * 3600_000, async () => {
    const [wein, innen, downhill] = await Promise.allSettled([
      layer('A62_WANDERN_WEINWANDERWEG'),
      layer('A62_POI_INNENSTADTRUNDWEG_LINIE'),
      layer('A62_RAD_DOWNHILL_LINIE_Strecke'),
    ]);

    const items = [];
    const mapRoute = (fs, art, fallbackTitle) => {
      for (const f of fs) {
        const p = f.properties ?? {};
        const pt = geomPoint(f.geometry);
        if (!pt) continue;
        const name = p.NAME ?? p.BEZEICHNUNG ?? p.TITEL ?? fallbackTitle;
        items.push({
          id: `${art}-${f.id ?? items.length}`,
          art,
          name,
          beschreibung: p.BESCHREIBUNG ?? p.BEMERKUNG ?? p.STRECKE ?? null,
          laengeKm: p.LAENGE_KM ? Number(p.LAENGE_KM) : (p.LAENGE ? +(Number(p.LAENGE) / 1000).toFixed(1) : null),
          url: p.URL ?? p.LINK ?? null,
          lat: +pt[1].toFixed(6),
          lon: +pt[0].toFixed(6),
        });
      }
    };

    if (wein.status === 'fulfilled') mapRoute(wein.value, 'weinwanderweg', 'Stuttgarter Weinwanderweg');
    if (innen.status === 'fulfilled') mapRoute(innen.value, 'innenstadtrundweg', 'Stuttgarter Innenstadtrundweg');
    if (downhill.status === 'fulfilled' && downhill.value.length) {
      const pt = geomPoint(downhill.value[0].geometry) ?? [9.1688, 48.7586];
      const p = downhill.value[0].properties ?? {};
      items.push({
        id: 'downhill-woodcracker',
        art: 'downhill',
        name: p.NAME ?? p.BEZEICHNUNG ?? 'MTB-Downhill-Strecke „Woodcracker“ (Degerloch – Marienplatz)',
        beschreibung: p.BESCHREIBUNG ?? 'Offizielle Downhill-Strecke der Stadt vom Dornhaldenwald in Degerloch hinab Richtung Marienplatz/Heslach.',
        laengeKm: p.LAENGE ? +(Number(p.LAENGE) / 1000).toFixed(1) : 1.4,
        url: p.URL ?? 'https://www.stuttgart.de/leben/sport/sportstaetten/downhill-strecke-degerloch.php',
        lat: +pt[1].toFixed(6),
        lon: +pt[0].toFixed(6),
        zacke: {
          line: '10',
          talStopId: 'de:08111:6056',
          talStopName: 'Marienplatz',
          talCoords: [9.1714, 48.7640],
          bergStopId: 'de:08111:2507',
          bergStopName: 'Degerloch',
          bergCoords: [9.1719, 48.7495],
          hinweis: 'Bergfahrt mit der Zahnradbahn („Zacke“, Linie 10) ab Marienplatz bis Degerloch; Fahrradmitnahme auf dem Vorstellwagen.',
        },
      });
    } else {
      items.push({
        id: 'downhill-woodcracker',
        art: 'downhill',
        name: 'MTB-Downhill-Strecke „Woodcracker“ (Degerloch – Marienplatz)',
        beschreibung: 'Offizielle Downhill-Strecke der Stadt vom Dornhaldenwald in Degerloch hinab Richtung Marienplatz.',
        laengeKm: 1.4,
        url: 'https://www.stuttgart.de/leben/sport/sportstaetten/downhill-strecke-degerloch.php',
        lat: 48.7586,
        lon: 9.1688,
        zacke: {
          line: '10',
          talStopId: 'de:08111:6056',
          talStopName: 'Marienplatz',
          talCoords: [9.1714, 48.7640],
          bergStopId: 'de:08111:2507',
          bergStopName: 'Degerloch',
          bergCoords: [9.1719, 48.7495],
          hinweis: 'Bergfahrt mit der Zahnradbahn („Zacke“, Linie 10) ab Marienplatz bis Degerloch; Fahrradmitnahme auf dem Vorstellwagen.',
        },
      });
    }
    return items;
  });
  return {
    items: value,
    fetchedAt: new Date(at).toISOString(),
    fresh,
    source: 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0): Weinwanderwege, Innenstadtrundweg, Downhill-Strecke Degerloch',
  };
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

// ---------- Bäder: Besucherzahl und Verzeichnis der Stuttgarter Bäder ----------
const BAEDER_VERZEICHNIS = 'https://www.stuttgarterbaeder.de/fileadmin/jsonData/baeder.json';
const normBad = (s) => (s ?? '').toLowerCase().replace(/[^a-zäöüß]/g, '');

/** Heutige Öffnungszeit aus dem Bäderverzeichnis; Feiertage und Sonderzeiten sind nicht enthalten. */
function heuteImBad(bh) {
  if (!bh) return { text: null, open: null };
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(new Date()).slice(0, 3).toLowerCase();
  const key = { mon: 'mo', tue: 'di', wed: 'mi', thu: 'do', fri: 'fr', sat: 'sa', sun: 'so' }[weekday];
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  const list = (bh.usually_bhpool ?? []).filter((x) => (!x.validity?.from || x.validity.from <= today) && (!x.validity?.to || today <= x.validity.to));
  const cur = list[list.length - 1];
  if (!cur) return { text: null, open: null };
  if (!key) return { text: null, open: null };
  const ranges = [cur[key], cur[`${key}1`], cur[`${key}2`]].filter((x) => x?.from && x?.to);
  if (!ranges.length) return { text: 'heute geschlossen', open: false };
  const text = `heute ${ranges.map((x) => `${x.from}–${x.to}`).join(' und ')}`;
  const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return { text, open: ranges.some((x) => now >= x.from && now < x.to) };
}

async function baederVerzeichnis() {
  const { value } = await cached('baeder-verzeichnis', 24 * 3600_000, async () => {
    const list = await fetchJson(BAEDER_VERZEICHNIS, { timeout: 20_000 });
    return list.map((b) => {
      const hours = heuteImBad(b.businesshours);
      const addr = [b.building?.street, [b.building?.zip_code, b.building?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      return {
        id: b.id,
        name: b.name,
        subtitle: b.subtitle ?? null,
        type: b.lookups?.type?.value ?? null,
        features: (b.lookups?.characteristic ?? []).map((x) => x.value).filter(Boolean),
        targetGroups: (b.lookups?.targetgroup ?? []).map((x) => x.value).filter(Boolean),
        phone: (b.communications ?? []).find((x) => x.type === 't')?.address ?? null,
        website: (b.communications ?? []).find((x) => x.type === 'i')?.address ?? null,
        address: addr || null,
        district: b.building?.district ?? null,
        hoursToday: hours.text,
        openNow: hours.open,
      };
    });
  });
  return value;
}

export async function baeder() {
  const { value, fresh } = await cached('baeder', 60_000, () => fetchJson('https://www.stuttgarterbaeder.de/fileadmin/jsonData/visitor_count.json'));
  const fac = (await facilities('bad')).items;
  let details = [];
  try { details = await baederVerzeichnis(); } catch { /* Verzeichnis ist optional */ }
  return {
    items: (value.data ?? []).map((b) => {
      const n = normBad(b.location_name).replace(/^das/, '');
      const f = fac.find((x) => normBad(x.name).includes(n) || n.includes(normBad(x.name).replace(/^(hallenbad|freibad|mineralbad)/, '')));
      const d = details.find((x) => {
        const dn = normBad(x.name).replace(/^das/, '');
        return dn === n || dn.includes(n) || n.includes(dn);
      });
      return {
        id: b.location_id, name: b.location_name, count: b.customer_amount, max: b.customer_amount_max, usual: usual('bad', b.location_id), best: bestToday('bad', b.location_id, 21),
        areas: (b.area_list ?? []).map((a) => ({ name: a.area_name, count: a.customer_amount, max: a.customer_amount_max })),
        ...(f ? { lat: f.lat, lon: f.lon } : {}),
        address: f?.address ?? d?.address ?? undefined,
        ...(d ? { type: d.type, features: d.features, targetGroups: d.targetGroups, phone: d.phone, website: d.website, district: d.district, hoursToday: d.hoursToday, openNow: d.openNow } : {}),
      };
    }),
    totalPools: details.length,
    all: details,
    fetchedAt: new Date().toISOString(), fresh,
    since: since('bad'), quote: quote('bad'),
    source: 'Stuttgarter Bäder, Besucherzahlen und Bäderverzeichnis',
    hinweis: 'Besucherzahlen melden nur geöffnete Bäder. Öffnungszeiten und Merkmale stammen aus dem Bäderverzeichnis; Feiertage, Sonderzeiten und nicht gepflegte Saisonen können abweichen.',
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
export async function laden(lat, lon, plz = '70173') {
  const la = (+lat).toFixed(3); const lo = (+lon).toFixed(3);
  const [ocpRes, gruen] = await Promise.allSettled([
    cached(`ocpdb-${la}-${lo}`, 2 * 60_000, () =>
      fetchJson(`https://api.mobidata-bw.de/ocpdb/api/public/v1/locations?lat=${la}&lon=${lo}&radius=1000&limit=40`)),
    gruenstrom(plz),
  ]);
  const value = ocpRes.status === 'fulfilled' ? ocpRes.value.value : { items: [] };
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
  return {
    items,
    gruenstrom: gruen.status === 'fulfilled' ? gruen.value : null,
    source: 'MobiData BW, OCPDB (Ladesäulenregister der Bundesnetzagentur und Betreiberdaten); Grünstrom: Fraunhofer ISE, Energy-Charts (CC BY 4.0)',
  };
}

// ---------- Regionaler Grünstrom-Index (Fraunhofer ISE, Energy-Charts, CC BY 4.0) ----------
const SIGNAL_TXT = { 0: 'grüne Phase: Verbrauch möglichst jetzt', 1: 'normale Phase', 2: 'Phase mit wenig erneuerbarem Strom: Verbrauch möglichst verschieben' };

export async function gruenstrom(plz = '70173') {
  const zip = /^\d{5}$/.test(String(plz ?? '')) ? String(plz) : '70173';
  const { value, at } = await cached(`gruenstrom-${zip}`, 15 * 60_000, async () => {
    const d = await fetchJson(`https://api.energy-charts.info/signal?country=de&postal_code=${zip}`, { timeout: 12000 });
    const now = Date.now();
    const punkte = (d.unix_seconds ?? []).map((t, i) => ({ t: t * 1000, share: d.share?.[i] ?? null, signal: d.signal?.[i] ?? null }));
    const aktuell = punkte.find((p) => p.t >= now) ?? punkte.at(-1) ?? null;
    const fenster = punkte.filter((p) => p.t >= now && p.t <= now + 24 * 3600_000 && p.share != null);
    // Bestes Zeitfenster der nächsten 24 Stunden: höchster Anteil erneuerbarer Energien über vier Viertelstunden
    let best = null;
    for (let i = 0; i + 3 < fenster.length; i += 1) {
      const vier = fenster.slice(i, i + 4);
      const schnitt = vier.reduce((s, p) => s + p.share, 0) / 4;
      if (!best || schnitt > best.share) best = { von: vier[0].t, bis: vier.at(-1).t + 900_000, share: +schnitt.toFixed(1) };
    }
    return {
      plz: zip,
      aktuell: aktuell ? { t: aktuell.t, share: aktuell.share, signal: aktuell.signal, text: SIGNAL_TXT[aktuell.signal] ?? null } : null,
      bestesFenster: best,
      min: fenster.length ? +Math.min(...fenster.map((p) => p.share)).toFixed(1) : null,
      max: fenster.length ? +Math.max(...fenster.map((p) => p.share)).toFixed(1) : null,
      reihe: fenster.filter((_, i) => i % 4 === 0).map((p) => ({ t: p.t, share: p.share })),
    };
  });
  return { ...value, fetchedAt: new Date(at).toISOString(), source: 'Fraunhofer ISE, Energy-Charts (CC BY 4.0)' };
}

// ---------- Gesundheit und Energie ----------
export async function gesundheit(plz = '70173') {
  const [pollen, uv, strom, gruen] = await Promise.allSettled([
    cached('dwd-pollen', 3 * 3600_000, () => fetchJson('https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json')),
    cached('dwd-uv', 3 * 3600_000, () => fetchJson('https://opendata.dwd.de/climate_environment/health/alerts/uvi.json')),
    cached('stromgedacht', 15 * 60_000, () => fetchJson('https://api.stromgedacht.de/v1/statesRelative?zip=70173&hoursInFuture=24')),
    gruenstrom(plz),
  ]);
  const out = { source: 'DWD (Pollenflug, UV-Index), TransnetBW StromGedacht, Fraunhofer ISE Energy-Charts' };
  if (pollen.status === 'fulfilled') {
    const c = pollen.value.value.content.find((x) => x.partregion_id === 112) ?? null;
    if (c) out.pollen = { region: c.partregion_name, next: pollen.value.value.next_update, items: Object.entries(c.Pollen).map(([k, v]) => ({ name: k, today: v.today, tomorrow: v.tomorrow })) };
  }
  if (uv.status === 'fulfilled') {
    const c = uv.value.value.content.find((x) => x.city === 'Stuttgart');
    if (c) out.uv = c.forecast;
  }
  if (strom.status === 'fulfilled') out.strom = strom.value.value.states ?? strom.value.value;
  if (gruen.status === 'fulfilled') out.gruenstrom = gruen.value;
  return out;
}

// ---------- Adresssuche: amtlicher gis6-Geocoder, Fallback Nominatim ----------
// gis6 liefert Adressen, Straßen, Haltestellen und Stadtteile präziser für Stuttgart.
// Nominatim bleibt der Rückfall, wenn der inoffizielle Dienst nicht antwortet.
export async function adresse(q) {
  const t = (q ?? '').trim();
  if (t.length < 3) return { items: [], source: 'Landeshauptstadt Stuttgart, gis6' };
  const { value } = await cached(`addr-${t.toLowerCase()}`, 30 * 86400_000, async () => {
    try {
      const j = await fetchJson(`https://gis6.stuttgart.de/locationfinderutm/Finder/Lookup?query=${encodeURIComponent(t)}&sref=4326&limit=8`, { timeout: 12000 });
      if (j?.ok) {
        const items = (j.locs ?? []).map((l) => {
          const name = String(l.name ?? '').trim();
          const nr = /^(.*?)\s+(\d+[a-zA-Z]?)$/.exec(name);
          return {
            label: name,
            street: l.type === 'Adresse' && nr ? nr[1] : (l.type === 'Straßenname' ? name : null),
            nr: l.type === 'Adresse' && nr ? nr[2] : null,
            lat: +Number(l.cy).toFixed(6),
            lon: +Number(l.cx).toFixed(6),
            typ: l.type ?? null,
          };
        }).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
        if (items.length) return { items: items.slice(0, 6), source: 'Landeshauptstadt Stuttgart, gis6 Location Finder' };
      }
    } catch { /* Fallback unten */ }
    const d = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=de&addressdetails=1&viewbox=9.03,48.87,9.32,48.68&bounded=1&q=${encodeURIComponent(t)}`);
    // Nominatim liefert für dieselbe Adresse oft mehrere Gebäudeumrisse. Für die Auswahl
    // zählt der Ort, nicht die Geometrievariante – deshalb nach Adresse und Stadtteil filtern.
    const seen = new Set();
    const items = [];
    for (const r of d) {
      const street = r.address?.road ?? null;
      const nr = r.address?.house_number ?? null;
      const label = [join([street, nr].filter(Boolean).join(' ') || r.name, r.address?.suburb || r.address?.city_district)].join('');
      const key = `${label}|${street ?? ''}|${nr ?? ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ label, street, nr, lat: +(+r.lat).toFixed(6), lon: +(+r.lon).toFixed(6), typ: 'Adresse' });
      if (items.length >= 5) break;
    }
    return { items, source: '© OpenStreetMap-Mitwirkende (Nominatim)' };
  });
  return value;
}
