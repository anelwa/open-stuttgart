// "Meine Adresse": was für einen Ort in Stuttgart gilt, aus den Geodaten der Stadt (CC BY 4.0).
// Wahlbezirk und Wahllokal, Stadtbezirk, Starkregengefahr und Hochwasser HQ100, Straßen- und Schienenlärm,
// kommunale Wärmeplanung inklusive Wärmeverbrauchsdichte, Solarkataster, Gründachkataster, Geothermie-Bohrtiefen,
// Abwasserwärme, Mietspiegel-Wohnlage und Milieuschutz, Baumschutz- und Denkmalrecht, Jodprophylaxe-Bezirke,
// Bewohnerparkgebiet und E-Scooter-Regelung, sichere Rad- und Gehschulwege, Klimaatlas (Klimatop, Kaltluftleitbahn)
// sowie das städtische Baumkataster im Umkreis (inkl. allergener Pollenbäume und Jungbäumen).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cached, fetchJson } from '../cache.mjs';
import { facilities, schulbezirk } from './nearby.mjs';
import { verwaltungEinheitenFuerAdresse } from './verwaltung.mjs';

const wfsUrl = (ws = 'GEOLINE_FLEX') =>
  `https://geoserver.stuttgart.de/geoserver/${ws}/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326`;

/** Merkmale einer Ebene in einem Quadrat von 2r Metern um den Punkt. */
async function box(layer, lat, lon, r, count = 200, ws = 'GEOLINE_FLEX', suffix = '_EPSG25832') {
  const dLat = r / 111_320; const dLon = r / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((x) => x.toFixed(6)).join(',');
  const typeName = `${ws}:${layer}${suffix}`;
  const j = await fetchJson(`${wfsUrl(ws)}&typeNames=${typeName}&count=${count}&bbox=${bbox},urn:ogc:def:crs:EPSG::4326`, { timeout: 20000 });
  return j.features ?? [];
}

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polys = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const contains = (f, pt) => polys(f.geometry).some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));

function geomCenter(g) {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const pts = g.type === 'LineString' ? g.coordinates
    : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates.flat()
      : g.type === 'MultiPolygon' ? g.coordinates.flat(2) : [];
  if (!pts.length) return null;
  const sx = pts.reduce((s, p) => s + p[0], 0);
  const sy = pts.reduce((s, p) => s + p[1], 0);
  return [sx / pts.length, sy / pts.length];
}

const R = 6371000;
const dist = (a, b) => {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180; const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
/** Kürzester Abstand vom Punkt zu einer Linie (Meter, ebene Näherung). */
function lineDist(pt, g) {
  const k = 111_320 * Math.cos((pt[1] * Math.PI) / 180);
  const xy = ([x, y]) => [(x - pt[0]) * k, (y - pt[1]) * 111_320];
  const lines = g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : [];
  let best = Infinity;
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const [ax, ay] = xy(l[i - 1]); const [bx, by] = xy(l[i]);
      const dx = bx - ax; const dy = by - ay; const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}
const nearest = (items, pt, n, filter = () => true) => items.filter(filter)
  .map((f) => ({ ...f, dist: Math.round(dist(pt, [f.lon, f.lat])) })).sort((a, b) => a.dist - b.dist).slice(0, n);

// ---------- Wahlbezirk und Wahllokal ----------
async function wahl(lat, lon) {
  const pt = [lon, lat];
  const area = (await box('A12_GBE_WAHLBEZAREA', lat, lon, 30, 20)).find((f) => contains(f, pt));
  if (!area) return null;
  const p = area.properties;
  const { value: lokale } = await cached('wfs-wahllokale-raw', 24 * 3600_000, async () =>
    (await fetchJson(`${wfsUrl()}&typeNames=GEOLINE_FLEX:A12_GBE_WAHLLOKALE_EPSG25832`, { timeout: 30000 })).features ?? []);
  const l = lokale.find((f) => f.properties.WBZ_AKTUEL === p.AWBEZ_T);
  const lp = l?.properties;
  return {
    bezirk: p.AWBEZ_T, briefwahlbezirk: p.BWBEZ_T, stadtbezirk: p.STBNAM_T,
    landtagswahlkreis: p.LWKNAM_T ? `${p.LWKNUM_T} ${p.LWKNAM_T}` : null,
    bundestagswahlkreis: p.BWKNAM_T ? `${p.BWKNUM_T} ${p.BWKNAM_T}` : null,
    stand: p.STAND,
    lokal: lp ? {
      name: lp.RAUM_WBEN1, address: [lp.RAUM_WBEN2, lp.RAUM_WBEN3].filter(Boolean).join(', '),
      lat: l.geometry?.coordinates?.[1] ?? null, lon: l.geometry?.coordinates?.[0] ?? null,
      lage: lp.RAUM_LAGE, zugang: lp.RAUM_ZUGAN, tuer: lp.RAUM_TÜRB, lift: lp.RAUM_LIFT, barrierefrei: lp.BARRIEREFR, stand: lp.STAND,
    } : null,
  };
}

// ---------- Starkregen & Hochwasser HQ100 ----------
const SZENARIEN = [
  ['A66_SRGS_UEBERFLUTUNGSAUSD_SEL', 'seltenem Starkregen'],
  ['A66_SRGS_UEBERFLUTUNGSAUSD_AUS', 'außergewöhnlichem Starkregen'],
  ['A66_SRGS_UEBERFLUTUNGSAUSD_EXT', 'extremem Starkregen'],
];
async function starkregen(lat, lon) {
  const pt = [lon, lat];
  const flaechen = [];
  for (const [layer, label] of SZENARIEN) {
    const fs = await box(layer, lat, lon, 25, 50);
    flaechen.push({ szenario: label, betroffen: fs.some((f) => contains(f, pt)), nahe: fs.length > 0 });
  }
  const [wege, hq100] = await Promise.all([
    box('A66_SRGS_UEBERFLUTUNGSGEFAHR', lat, lon, 100, 100).catch(() => []),
    box('A36_HWGK_GEN_HQ100_HAUPTWASSERK', lat, lon, 100, 30).catch(() => []),
  ]);
  const naechster = wege.length ? Math.round(Math.min(...wege.map((f) => lineDist(pt, f.geometry)))) : null;
  const hqBetroffen = hq100.some((f) => contains(f, pt));
  const hqNahe = hq100.length > 0;
  return {
    flaechen,
    fliessweg: naechster != null && naechster <= 100 ? naechster : null,
    hq100: { betroffen: hqBetroffen, imUmkreis100m: hqNahe },
  };
}

// ---------- Lärm: Fassadenpegel der Lärmkartierung 2022 ----------
const normStreet = (s) => (s ?? '').toLowerCase().replace(/\(.*?\)/g, '').replace(/stra(ß|ss)e|str\./g, 'str').replace(/[^a-zäöü0-9]/g, '');
async function laerm(lat, lon, street, nr) {
  const out = {};
  for (const [key, layer] of [['strasse', 'A36_LAERM2022_FASSADENPEGEL_STR'], ['schiene', 'A36_LAERM2022_FASSADENPEGEL_BAHN']]) {
    const fs = (await box(layer, lat, lon, 35, 300)).filter((f) => f.properties.LDEN != null);
    if (!fs.length) { out[key] = null; continue; }
    const own = street && nr ? fs.filter((f) => normStreet(f.properties.STRNAME) === normStreet(street) && String(f.properties.HAUSNR ?? '').trim() === String(nr).trim()) : [];
    const pick = own.length ? own : fs;
    const top = pick.reduce((a, b) => (b.properties.LDEN > a.properties.LDEN ? b : a));
    out[key] = {
      lden: Math.round(top.properties.LDEN * 10) / 10, ln: top.properties.LN != null ? Math.round(top.properties.LN * 10) / 10 : null,
      gebaeude: own.length ? 'dieses Gebäude, lauteste Fassade' : 'lauteste Fassade im Umkreis von etwa 35 m',
      adresse: top.properties.STRNAME ? `${top.properties.STRNAME.trim()} ${top.properties.HAUSNR ?? ''}`.trim() : null,
    };
  }
  return out;
}

/** Gebäude-Ebene: passendes Grundstück suchen – erst Adresse, dann Punkt im Polygon, dann nächstgelegenes */
function gebaeude(fs, pt, street, nr) {
  if (!fs.length) return null;
  if (street && nr) {
    const ziel = `${normStreet(street)}${String(nr).trim().toLowerCase()}`;
    const addrHit = fs.find((f) => {
      const p = f.properties ?? {};
      const haus = String(p.HAUSNUMMER ?? '').trim().toLowerCase();
      return normStreet(p.ADDRESS ?? p.STRASSE).includes(ziel)
        && (!p.HAUSNUMMER || haus === String(nr).trim().toLowerCase());
    });
    if (addrHit) return addrHit;
  }
  const inHit = fs.find((f) => contains(f, pt));
  if (inHit) return inHit;
  const nah = fs.map((f) => ({ f, c: geomCenter(f.geometry) })).filter((x) => x.c)
    .map((x) => ({ f: x.f, d: dist(pt, x.c) })).sort((a, b) => a.d - b.d)[0];
  return nah && nah.d <= 60 ? nah.f : null;
}

// ---------- Kommunale Wärmeplanung, Solarkataster, Gründachkataster, Geothermie und Abwasserwärme ----------
async function energieDach(lat, lon, street, nr) {
  const pt = [lon, lat];
  const [kwpNetz, kwpTrg, kwpDichte, grd, solarRes, geoTiefe, geoRand, awnStandort, awnHaltung] = await Promise.allSettled([
    box('A36_KWP_NETZGEBIETE', lat, lon, 40, 20),
    box('A36_KWP_HAUPTENERGIETRAEGER', lat, lon, 40, 20),
    box('A36_KWP_WAERMEVERBRAUCHSDICHTE', lat, lon, 60, 10),
    box('A61_ALG_GRUENDACHKATASTER', lat, lon, 35, 40),
    box('A36_SOLAR_GEB_GRUNDRISSE', lat, lon, 35, 60),
    box('A36_BOISS_GEOT_BOHRTIEFEN', lat, lon, 40, 20),
    box('A36_BOISS_GEOT_BOHRUNGEN_RANDBED', lat, lon, 40, 20),
    box('A66_AWN_GEEIGNETE_STANDORTE', lat, lon, 60, 10),
    box('A66_AWN_RELEVANTE_HALTUNGEN', lat, lon, 150, 15),
  ]);

  let waermeplanung = null;
  const netzFs = kwpNetz.status === 'fulfilled' ? kwpNetz.value : [];
  const trgFs = kwpTrg.status === 'fulfilled' ? kwpTrg.value : [];
  const dichteFs = kwpDichte.status === 'fulfilled' ? kwpDichte.value : [];
  const netzHit = netzFs.find((f) => contains(f, pt)) ?? netzFs[0];
  const trgHit = trgFs.find((f) => contains(f, pt)) ?? trgFs[0];
  const dichteHit = dichteFs.find((f) => contains(f, pt)) ?? dichteFs[0];
  if (netzHit || trgHit || dichteHit) {
    const np = netzHit?.properties ?? {};
    const tp = trgHit?.properties ?? {};
    const dp = dichteHit?.properties ?? {};
    waermeplanung = {
      quartier: np.QUARTIER ?? tp.QUARTIER ?? null,
      gebietsbezeichnung: np.GEBIETSBEZ ?? np.KATEGORIE ?? np.EIG_NETZ ?? null,
      potenziale: np.IDENTIFIZIERTE_POTENZIALE ?? null,
      beginnLeitungsbau: np.ANGESTR_BEGINN_LEITUNGSBAU ?? null,
      leitungslaengeKm: np.GEPLANTE_LEITUNGSLAENGE ?? null,
      wohnungen: np.ANZAHL_WOHNEINHEITEN ?? null,
      verbrauchsdichte: dp.WAERMEVERBRAUCHSDICHTE ?? null,
      hauptenergietraeger: tp.HAUPTENERGIETRAEGER ?? tp.ENERGIETRAEGER ?? tp.BESTAND ?? null,
      steckbrief: np.STECKBRIEF ?? tp.STECKBRIEF ?? null,
      // Die einzelnen Quartierssteckbriefe sind im Bericht zur kommunalen Wärmeplanung der Stadt gebündelt
      steckbriefUrl: /^(https?|\/)/i.test(String(np.STECKBRIEF ?? tp.STECKBRIEF ?? '')) ? (np.STECKBRIEF ?? tp.STECKBRIEF)
        : (np.STECKBRIEF ?? tp.STECKBRIEF) ? 'https://www.stuttgart.de/medien/ibs/bericht_kommunale_waermeplanung_stuttgart_inkl_quartierssteckbriefe.pdf' : null,
    };
  }

  let gruendach = null;
  const grdFs = grd.status === 'fulfilled' ? grd.value : [];
  const grdMatch = gebaeude(grdFs, pt, street, nr);
  if (grdMatch) {
    const p = grdMatch.properties ?? {};
    gruendach = {
      adresse: p.ADDRESS ?? null,
      dachtyp: p.ROOFTYPE ?? null,
      flaecheM2: p.AREA3D != null ? Math.round(Number(p.AREA3D)) : null,
      bestandGruendachM2: p.BEST_GRD != null ? Math.round(Number(p.BEST_GRD)) : null,
      eignung: p.EIGNUNG_TXT ?? null,
      url: p.URL ?? null,
    };
  }

  let solar = null;
  const solarFs = solarRes.status === 'fulfilled' ? solarRes.value : [];
  const solarMatch = gebaeude(solarFs, pt, street, nr);
  if (solarMatch) {
    const p = solarMatch.properties ?? {};
    solar = {
      adresse: [p.STRASSE, p.HAUSNUMMER].filter(Boolean).join(' ').trim() || null,
      flaecheM2: p.SOLFLAECHE != null ? Math.round(Number(p.SOLFLAECHE)) : null,
      pvKwp: p.PVLEISTUNG != null ? +Number(p.PVLEISTUNG).toFixed(1) : null,
      stromKwhA: p.ERTR_EL != null ? Math.round(Number(p.ERTR_EL)) : null,
      solarthermieKwhA: p.ERTR_THERM != null ? Math.round(Number(p.ERTR_THERM)) : null,
      co2Tonnen: p.PVCO2 != null ? +Number(p.PVCO2).toFixed(1) : null,
      hauptgebaeude: p.IS_MAIN === 1,
    };
  }

  let geothermie = null;
  const tiefeFs = geoTiefe.status === 'fulfilled' ? geoTiefe.value : [];
  const randFs = geoRand.status === 'fulfilled' ? geoRand.value : [];
  const tiefeHit = tiefeFs.find((f) => contains(f, pt)) ?? tiefeFs[0];
  const randHit = randFs.find((f) => contains(f, pt)) ?? randFs[0];
  if (tiefeHit || randHit) {
    const tp = tiefeHit?.properties ?? {};
    const rp = randHit?.properties ?? {};
    geothermie = {
      elevMin: tp.ELEV_MIN ?? null,
      elevMax: tp.ELEV_MAX ?? null,
      tiefeText: tp.TIEFE_TXT ?? tp.BESCHREIBUNG ?? (tp.ELEV_MIN != null || tp.ELEV_MAX != null ? `${tp.ELEV_MIN ?? '–'} bis ${tp.ELEV_MAX ?? '–'} m` : null),
      randbedingung: rp.RANDBEDINGUNG ?? rp.HINWEIS ?? rp.TEXT ?? rp.BESCHREIBUNG ?? null,
    };
  }

  // Abwasserwärme: geeignete Standorte für Wärmeentzug aus Kanälen sowie die entsprechenden Haltungen
  const awnFlaechen = awnStandort.status === 'fulfilled' ? awnStandort.value : [];
  const awnLeitungen = awnHaltung.status === 'fulfilled' ? awnHaltung.value : [];
  const awnInFlaeche = awnFlaechen.some((f) => contains(f, pt));
  const awnNahe = awnLeitungen.length
    ? Math.round(Math.min(...awnLeitungen.map((f) => lineDist(pt, f.geometry))))
    : null;
  const awnEignung = awnLeitungen[0]?.properties?.EIGNUNG ?? null;
  const awnLeistung = awnLeitungen[0]?.properties?.['WÄRMEENTZUGSLEISTUNG'] ?? awnLeitungen[0]?.properties?.WAERMEENTZUGSLEISTUNG ?? null;
  const abwasserwaerme = (awnInFlaeche || awnNahe != null) ? {
    geeignetesGebiet: awnInFlaeche,
    naechsteHaltungM: awnNahe != null && awnNahe <= 300 ? awnNahe : null,
    eignung: awnEignung,
    waermeentzugsleistungKw: awnLeistung,
  } : null;

  return { waermeplanung, gruendach, solar, geothermie, abwasserwaerme };
}

// ---------- Mietspiegel-Wohnlage, Milieuschutz, Bewohnerparken und E-Scooter-Regelung ----------
const PRM_LAYERS = [
  'A66_PRM_ZONE_AUSKUNFT_City', 'A66_PRM_ZONE_AUSKUNFT_Mitte', 'A66_PRM_ZONE_AUSKUNFT_West',
  'A66_PRM_ZONE_AUSKUNFT_Sued', 'A66_PRM_ZONE_AUSKUNFT_Ost', 'A66_PRM_ZONE_AUSKUNFT_Nord',
  'A66_PRM_ZONE_AUSKUNFT_Bad_Cannstatt', 'A66_PRM_ZONE_AUSKUNFT_Vaihingen',
  'A66_PRM_ZONE_AUSKUNFT_Degerloch', 'A66_PRM_ZONE_AUSKUNFT_Zuffenhausen', 'A66_PRM_ZONE_AUSKUNFT_Untertuerkheim',
];

async function wohnlageParken(lat, lon) {
  const pt = [lon, lat];
  const [msp, milieu, esVerbot, esAbstell] = await Promise.allSettled([
    box('A12_MSP_LAGEN', lat, lon, 30, 15),
    box('A61_DENKAS_GESAMT_Erhaltungssatz_Wohnbevoelk', lat, lon, 30, 10),
    box('A32_ES_ABSTELLVERBOTSZONEN', lat, lon, 30, 10),
    box('A32_ES_ABSTELLFLAECHEN', lat, lon, 300, 30),
  ]);

  const mspHit = (msp.status === 'fulfilled' ? msp.value : []).find((f) => contains(f, pt)) ?? (msp.status === 'fulfilled' ? msp.value[0] : null);
  const milieuHit = (milieu.status === 'fulfilled' ? milieu.value : []).find((f) => contains(f, pt));
  const verbotHit = (esVerbot.status === 'fulfilled' ? esVerbot.value : []).some((f) => contains(f, pt));
  const abstellList = (esAbstell.status === 'fulfilled' ? esAbstell.value : [])
    .map((f) => {
      const c = geomCenter(f.geometry);
      return c ? { name: f.properties?.STANDORT ?? f.properties?.BEZEICHNUNG ?? 'E-Scooter-Abstellfläche', dist: Math.round(dist(pt, c)) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dist - b.dist);

  // Bewohnerparkzone: nur relevante Bezirks-Layer anhand Koordinaten abfragen
  const candidatePrm = [];
  if (lat > 48.76 && lat < 48.80 && lon > 9.14 && lon < 9.21) candidatePrm.push('A66_PRM_ZONE_AUSKUNFT_City', 'A66_PRM_ZONE_AUSKUNFT_Mitte', 'A66_PRM_ZONE_AUSKUNFT_West', 'A66_PRM_ZONE_AUSKUNFT_Sued', 'A66_PRM_ZONE_AUSKUNFT_Ost', 'A66_PRM_ZONE_AUSKUNFT_Nord');
  if (lat >= 48.79 && lon >= 9.20) candidatePrm.push('A66_PRM_ZONE_AUSKUNFT_Bad_Cannstatt');
  if (lat <= 48.75 && lon <= 9.14) candidatePrm.push('A66_PRM_ZONE_AUSKUNFT_Vaihingen');
  if (lat <= 48.76 && lon > 9.15 && lon < 9.20) candidatePrm.push('A66_PRM_ZONE_AUSKUNFT_Degerloch');
  if (lat >= 48.81) candidatePrm.push('A66_PRM_ZONE_AUSKUNFT_Zuffenhausen');
  if (lon >= 9.23) candidatePrm.push('A66_PRM_ZONE_AUSKUNFT_Untertuerkheim');

  let bewohnerparkZone = null;
  if (candidatePrm.length) {
    const prmRes = await Promise.allSettled(candidatePrm.map((l) => box(l, lat, lon, 25, 10)));
    for (const r of prmRes) {
      if (r.status !== 'fulfilled') continue;
      const hit = r.value.find((f) => contains(f, pt));
      if (hit) {
        const p = hit.properties ?? {};
        bewohnerparkZone = p.ZONE ?? p.BEZEICHNUNG ?? p.NAME ?? p.GEBIET ?? 'Bewohnerparkgebiet';
        break;
      }
    }
  }

  return {
    wohnlage: mspHit ? { lage: mspHit.properties?.LAGE ?? null, stand: mspHit.properties?.STAND ?? null } : null,
    milieuschutz: milieuHit ? { aktiv: true, name: milieuHit.properties?.NAME ?? milieuHit.properties?.BEZEICHNUNG ?? 'Soziale Erhaltungssatzung' } : { aktiv: false, name: null },
    bewohnerparken: bewohnerparkZone,
    escooter: {
      abstellverbotszone: verbotHit,
      naechsteAbstellflaeche: abstellList[0] ?? null,
    },
  };
}

// ---------- Satzungen und Rechtsgebiete: Baumschutz, Denkmal-Gesamtanlage, Sanierungsgebiet ----------
async function satzungen(lat, lon) {
  const pt = [lon, lat];
  const [baum, denkmal, sanierung] = await Promise.allSettled([
    box('A61_BAUM_BAUMSCHUTZAREA', lat, lon, 40, 10),
    box('A61_DENKAS_GESAMT_Erhaltungssatz_Gesamtanl', lat, lon, 40, 10),
    // Der Geoserver veröffentlicht (Stand 10/2026) keinen Sanierungsgebiets-Layer; die Abfrage bleibt
    // bewusst bestehen, damit ein später veröffentlichter Datensatz automatisch erscheint.
    box('A61_SAN_GEBIETE', lat, lon, 40, 10),
  ]);
  const hit = (res) => (res.status === 'fulfilled' ? res.value.find((f) => contains(f, pt)) ?? null : null);
  const baumHit = hit(baum);
  const denkmalHit = hit(denkmal);
  const sanHit = hit(sanierung);
  return {
    baumschutz: baumHit ? { aktiv: true, zone: baumHit.properties?.ZONE ?? 'Baumschutzgebiet' } : { aktiv: false, zone: null },
    denkmalschutz: denkmalHit
      ? { aktiv: true, name: denkmalHit.properties?.NAME ?? denkmalHit.properties?.BEZEICHNUNG ?? 'Erhaltungssatzung Gesamtanlage' }
      : { aktiv: false, name: null },
    sanierungsgebiet: sanHit
      ? { aktiv: true, name: sanHit.properties?.NAME ?? sanHit.properties?.BEZEICHNUNG ?? 'Sanierungsgebiet' }
      : { aktiv: false, name: null },
  };
}

// ---------- Jodprophylaxe: Jodausgabebezirke und nächstgelegene Ausgabestelle ----------
async function jod(lat, lon) {
  const pt = [lon, lat];
  const fs = await box('A37_GBE_JODBEZIRKE_AUSSEN', lat, lon, 2500, 60).catch(() => []);
  const treffer = fs.map((f) => {
    const c = geomCenter(f.geometry);
    const p = f.properties ?? {};
    return {
      name: [p.GEBAEUDE, p.GEBAEUDETEIL].filter(Boolean).join(', ') || 'Jodausgabestelle',
      address: [p.ADRESSE, [p.PLZ, 'Stuttgart'].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      dist: c ? Math.round(dist(pt, c)) : null,
      imBezirk: contains(f, pt),
    };
  }).filter((x) => x.dist != null).sort((a, b) => Number(b.imBezirk) - Number(a.imBezirk) || a.dist - b.dist);
  if (!treffer.length) return null;
  return {
    imBezirk: treffer.some((t) => t.imBezirk),
    ausgabestelle: treffer.find((t) => t.imBezirk) ?? treffer[0],
    hinweis: 'Im Ernstfall (Kerntechnischer Unfall) werden Jodtabletten in den Ausgabestellen des Stadtbezirks ausgegeben; maßgeblich ist die Anordnung der Behörden.',
  };
}

// ---------- Sichere Rad- und Gehschulwege ----------
async function schulwege(lat, lon) {
  const pt = [lon, lat];
  const [radWege, achtung, gehKatalog, sb] = await Promise.allSettled([
    box('A32_RSP_RADSCHULWEGE', lat, lon, 300, 40),
    box('A32_RSP_ACHTUNGSSTELLEN', lat, lon, 350, 30),
    box('SWP_GEHSCHULWEG_KATALOG_JOIN', lat, lon, 500, 20, 'Daten', ''),
    schulbezirk(lat, lon),
  ]);

  const radFs = radWege.status === 'fulfilled' ? radWege.value : [];
  const radDist = radFs.length ? Math.round(Math.min(...radFs.map((f) => lineDist(pt, f.geometry)))) : null;
  const achtFs = (achtung.status === 'fulfilled' ? achtung.value : []).map((f) => {
    const c = geomCenter(f.geometry);
    const p = f.properties ?? {};
    return c ? {
      dist: Math.round(dist(pt, c)),
      hinweis: p.BEMERKUNG ?? p.BESCHREIBUNG ?? p.HINWEIS ?? p.TEXT ?? p.ART ?? 'Achtungsstelle am Radschulweg',
    } : null;
  }).filter(Boolean).sort((a, b) => a.dist - b.dist).slice(0, 3);

  const gehFs = gehKatalog.status === 'fulfilled' ? gehKatalog.value : [];
  const schoolName = sb.status === 'fulfilled' ? sb.value?.school : null;
  const gehMatch = gehFs.find((f) => schoolName && String(f.properties?.SCHULNAME ?? f.properties?.NAME ?? '').toLowerCase().includes(schoolName.toLowerCase().replace(/schule$/, ''))) ?? gehFs[0];
  const gp = gehMatch?.properties ?? null;

  return {
    radschulwegDistM: radDist != null && radDist <= 300 ? radDist : null,
    achtungsstellen: achtFs,
    gehschulweg: gp ? {
      schule: gp.SCHULNAME ?? gp.NAME ?? schoolName ?? null,
      beschreibung: gp.EMPFEHLUNG ?? gp.BESCHREIBUNG ?? gp.HINWEIS ?? gp.TEXT ?? null,
      url: gp.URL ?? gp.LINK ?? null,
    } : null,
  };
}

// ---------- Stuttgarter Klimaatlas & Städtisches Baumkataster (inkl. Pollen-Kreuzcheck) ----------
const POLLEN_BOT = [
  [/\bbetula\b|birke/i, 'Birke'],
  [/\bfraxinus\b|esche/i, 'Esche'],
  [/\balnus\b|erle/i, 'Erle'],
  [/\bcorylus\b|hasel/i, 'Hasel'],
];

async function klimaUndBaeume(lat, lon) {
  const pt = [lon, lat];
  const [klimatope, kaltluft, bahnBel, bahnUnbel, baeumeRes] = await Promise.allSettled([
    box('A36_KLIMA_KLIMATOPE_STGT', lat, lon, 40, 15),
    box('A36_KLIMA_KALTLUFTWIND_U1_STGT', lat, lon, 100, 15),
    box('A36_KLIMA_LUFTBAHN_BELASTET_STGT', lat, lon, 180, 15),
    box('A36_KLIMA_LUFTBAHN_UNBELASTET_STGT', lat, lon, 180, 15),
    box('A67_GFM_BAUM_PLUS', lat, lon, 150, 250, 'Base', '_EPSG25832'),
  ]);

  const klHit = (klimatope.status === 'fulfilled' ? klimatope.value : []).find((f) => contains(f, pt)) ?? (klimatope.status === 'fulfilled' ? klimatope.value[0] : null);
  const kp = klHit?.properties ?? {};
  const kwFs = kaltluft.status === 'fulfilled' ? kaltluft.value : [];
  const lbBel = (bahnBel.status === 'fulfilled' ? bahnBel.value : []).length > 0;
  const lbUnbel = (bahnUnbel.status === 'fulfilled' ? bahnUnbel.value : []).length > 0;

  const klima = (klHit || kwFs.length || lbBel || lbUnbel) ? {
    klimatop: kp.KLIMATOP ?? kp.BEZEICHNUNG ?? kp.TYP ?? kp.NAME ?? null,
    beschreibung: kp.BESCHREIBUNG ?? kp.HINWEIS ?? null,
    kaltluftwind: kwFs.length > 0,
    luftleitbahn: lbUnbel ? 'unbelastete Kaltluft-/Belüftungsleitbahn im Umkreis' : lbBel ? 'belastete Belüftungsleitbahn im Umkreis' : null,
  } : null;

  const treeFs = baeumeRes.status === 'fulfilled' ? baeumeRes.value : [];
  let baeume = null;
  if (treeFs.length) {
    const speciesCount = new Map();
    const pollenCount = { Birke: 0, Esche: 0, Erle: 0, Hasel: 0 };
    const jahresGrenze = new Date().getFullYear() - 6;
    let oldestYear = null;
    let oldestSpecies = null;
    let junge = 0;
    let naturdenkmaeler = 0;
    for (const f of treeFs) {
      const p = f.properties ?? {};
      const art = String(p.BAUMART ?? p.GATTUNG_ART ?? '').trim() || 'Unbekannte Art';
      const bot = String(p.BAUMART_BOT ?? '').trim();
      speciesCount.set(art, (speciesCount.get(art) ?? 0) + 1);
      const yr = Number(p.PFLANZJAHR);
      if (Number.isFinite(yr) && yr >= 1750 && yr <= new Date().getFullYear() && (oldestYear == null || yr < oldestYear)) {
        oldestYear = yr;
        oldestSpecies = art;
      }
      if (Number.isFinite(yr) && yr >= Math.max(2020, jahresGrenze)) junge += 1;
      if (p.NATURDENKMAL && !/^(0|nein|ne)$/i.test(String(p.NATURDENKMAL).trim())) naturdenkmaeler += 1;
      const combined = `${art} ${bot}`;
      for (const [re, label] of POLLEN_BOT) {
        if (re.test(combined)) pollenCount[label] += 1;
      }
    }
    const topArten = [...speciesCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([art, anzahl]) => ({ art, anzahl }));
    baeume = {
      anzahl150m: treeFs.length,
      topArten,
      aeltesterBaum: oldestYear ? { pflanzjahr: oldestYear, art: oldestSpecies } : null,
      pollenBaeume: pollenCount,
      jungeBaeume150m: junge,
      naturdenkmaeler,
    };
  }

  return { klima, baeume };
}

// ---------- Verwaltungsgebäude und Leistungen (Datensatz aus dem Stadtseiten-Crawl) ----------
const VERW_FILE = process.env.OS_VERWALTUNG ?? fileURLToPath(new URL('../data/verwaltung.json', import.meta.url));
let verwCache = { mtime: 0, items: [] };
export function verwaltungItems() {
  if (!existsSync(VERW_FILE)) return [];
  const m = statSync(VERW_FILE).mtimeMs;
  if (m !== verwCache.mtime) {
    try {
      const raw = JSON.parse(readFileSync(VERW_FILE, 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.items ?? raw.features?.map((f) => ({ ...f.properties, lon: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1] })) ?? [];
      verwCache = { mtime: m, items: list.filter((x) => Number.isFinite(+x.lat) && Number.isFinite(+x.lon)).map((x) => ({ ...x, lat: +x.lat, lon: +x.lon })) };
    } catch (e) {
      console.warn(`Verwaltungsdatensatz nicht lesbar: ${e.message}`);
    }
  }
  return verwCache.items;
}

export async function profil(lat, lon, street, nr) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw Object.assign(new Error('lat und lon angeben'), { status: 400 });
  if (lat < 48.68 || lat > 48.87 || lon < 9.03 || lon > 9.32) throw Object.assign(new Error('Ort liegt außerhalb Stuttgarts'), { status: 400 });
  const la = lat.toFixed(4); const lo = lon.toFixed(4);
  const pt = [lon, lat];
  const { value } = await cached(`profil-v3-${la}-${lo}-${street ?? ''}-${nr ?? ''}`, 30 * 86400_000, async () => {
    const [w, s, l, ed, wp, sw, kb, sz, jd] = await Promise.allSettled([
      wahl(lat, lon),
      starkregen(lat, lon),
      laerm(lat, lon, street, nr),
      energieDach(lat, lon, street, nr),
      wohnlageParken(lat, lon),
      schulwege(lat, lon),
      klimaUndBaeume(lat, lon),
      satzungen(lat, lon),
      jod(lat, lon),
    ]);
    const edVal = ed.status === 'fulfilled' ? ed.value : {};
    const wpVal = wp.status === 'fulfilled' ? wp.value : {};
    const kbVal = kb.status === 'fulfilled' ? kb.value : {};
    return {
      wahl: w.status === 'fulfilled' ? w.value : { error: 'Wahlbezirke derzeit nicht abrufbar' },
      starkregen: s.status === 'fulfilled' ? s.value : { error: 'Starkregenkarte derzeit nicht abrufbar' },
      laerm: l.status === 'fulfilled' ? l.value : { error: 'Lärmkarte derzeit nicht abrufbar' },
      waermeplanung: edVal.waermeplanung ?? null,
      gruendach: edVal.gruendach ?? null,
      solar: edVal.solar ?? null,
      geothermie: edVal.geothermie ?? null,
      abwasserwaerme: edVal.abwasserwaerme ?? null,
      wohnlage: wpVal.wohnlage ?? null,
      milieuschutz: wpVal.milieuschutz ?? null,
      satzungen: sz.status === 'fulfilled' ? sz.value : null,
      jod: jd.status === 'fulfilled' ? jd.value : null,
      bewohnerparken: wpVal.bewohnerparken ?? null,
      escooter: wpVal.escooter ?? null,
      schulwege: sw.status === 'fulfilled' ? sw.value : null,
      klima: kbVal.klima ?? null,
      baeume: kbVal.baeume ?? null,
    };
  });
  const [notfall, kuehl, brunnen, toilette] = await Promise.all(['notfall', 'kuehl', 'trinkbrunnen', 'toilette'].map((c) => facilities(c).then((r) => r.items).catch(() => [])));
  const rawVerw = verwaltungItems();
  const verw = rawVerw.length ? rawVerw : await verwaltungEinheitenFuerAdresse().catch(() => []);
  return {
    ...value,
    notfall: nearest(notfall, pt, 1, (f) => f.info?.includes('Notfall-Treffpunkt'))[0] ?? null,
    leuchtturm: nearest(notfall, pt, 1, (f) => f.info?.includes('Notfall-Leuchtturm'))[0] ?? null,
    kuehl: nearest(kuehl, pt, 3),
    trinkbrunnen: nearest(brunnen, pt, 1)[0] ?? null,
    toilette: nearest(toilette, pt, 1)[0] ?? null,
    verwaltung: verw.length ? nearest(verw, pt, 5) : null,
    source: 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0): Wahlbezirke, Starkregen- und Hochwassergefahrenkarte, Lärmkartierung 2022, Kommunale Wärmeplanung, Gründachkataster, Geothermie, Mietspiegel-Wohnlagen, Erhaltungssatzungen, Radschulwegplan, Klimaatlas, Baumkataster',
  };
}

