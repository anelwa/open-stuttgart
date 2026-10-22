// Ferienprogramm der Landeshauptstadt Stuttgart (unser-ferienprogramm.de, Daten über den Geoserver, CC BY 4.0):
// amtliche Kinder- und Jugendangebote der Ferien mit Datum, Alter, Preis, Anmeldung und Barrierefreiheit.
// Amtliche Quelle: solche Termine finden tatsächlich statt. Übernommen werden nur Fakten (Titel, Zeit, Ort,
// Preis, Alter, Anmeldung) und der Link zur Veranstaltungsseite – keine Beschreibungstexte und keine Bilder.
// Die Punkte des Geoservers tragen die UTM-Koordinaten X/Y (EPSG:25832) als Attribut; wo sie fehlen,
// bleibt der Ort als Text stehen (Ortsname und Stadtbezirk werden aus dem Treffpunkt gelesen).
import { fetchJson } from '../../cache.mjs';
import { berlinLocal } from '../events-extra.mjs';
import { addDays, berlinDate, districtOf, euro, sceneDay, text, today, venueOf } from './common.mjs';

const H = 3600_000;
const LAYERS = [
  'A51_ALG_FP_PUNKTE_Ausfluege_Wissenswertes',
  'A51_ALG_FP_PUNKTE_Kreatives_Kultur',
  'A51_ALG_FP_PUNKTE_Natur_Tiere',
  'A51_ALG_FP_PUNKTE_Sport_Spiel_Action',
  'A51_ALG_FP_PUNKTE_Vermischtes',
];
const wfs = (layer) => 'https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0&request=GetFeature'
  + `&outputFormat=application/json&srsName=EPSG:4326&count=400&typeNames=GEOLINE_FLEX:${layer}_EPSG25832`;

const horizon = () => addDays(today(), 21);
const inWindow = (day) => day >= addDays(today(), -1) && day <= horizon();

/** „2026-10-26 14:00:00“ (Ortszeit) in einen Zeitpunkt umrechnen; ohne Uhrzeit ganztägig. */
function zeitpunkt(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(s ?? ''));
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  return m[4] ? berlinLocal(`${day}T${m[4]}:${m[5]}:00`) : { day, allDay: true };
}

// EPSG:25832 (ETRS89 / UTM 32N, Mittelmeridian 9° Ost) nach WGS84 – für die Attributkoordinaten X/Y des Ferienprogramms.
function utm32(x, y) {
  const a = 6378137;
  const f = 1 / 298.257222101; // GRS80
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const x0 = x - 500_000;
  const m = y / k0; // nördliche Halbkugel: ohne falsches Nord
  // Fußpunktbreite
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1), cos1 = Math.cos(phi1), tan1 = Math.tan(phi1);
  const N1 = a / Math.sqrt(1 - e2 * sin1 * sin1);
  const R1 = a * (1 - e2) / (1 - e2 * sin1 * sin1) ** 1.5;
  const T1 = tan1 * tan1;
  const C1 = ep2 * cos1 * cos1;
  const D = x0 / (N1 * k0);
  const lat = phi1 - (N1 * tan1 / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / cos1;
  return [9 + (lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

export const FERIENPROGRAMM = {
  id: 'ferienprogramm', name: 'Ferienprogramm der Landeshauptstadt', group: 'register',
  url: 'https://www.unser-ferienprogramm.de/stuttgart/',
  license: 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0); übernommen werden Fakten und Link zum Angebot.',
};

/** Quelle für das Modul „Was geht“; `makeTermin` ist der Formatierer aus termine.mjs. */
export function ferienprogrammSource(makeTermin) {
  return {
    ...FERIENPROGRAMM, ttl: 12 * H,
    load: async () => {
      const out = [];
      for (const layer of LAYERS) {
        let fs = [];
        try {
          fs = (await fetchJson(wfs(layer), { timeout: 25000 })).features ?? [];
        } catch { /* Ebene derzeit nicht erreichbar, die übrigen Quellen laufen weiter */ }
        for (const f of fs) {
          const p = f.properties ?? {};
          const name = text(p.NAME);
          if (!name) continue;
          const start = zeitpunkt(p.DATUM_VON);
          const endRoh = zeitpunkt(p.DATUM_BIS);
          const startIso = start && !start.allDay ? start.toISOString() : null;
          const day = start ? (start.allDay ? start.day : sceneDay({ start: startIso, date: berlinDate(start) })) : null;
          if (!day || !inWindow(day)) continue;

          const treffpunkt = text(p.TREFFPUNKT);
          const vid = venueOf(treffpunkt);
          const xy = Number(p.X) && Number(p.Y) ? utm32(Number(p.X), Number(p.Y)) : null;
          const kmahl = euro(p.GEBUEHR_TXT);
          const alterVon = Number(p.ALTER_VON);
          const facts = [p.KATEGORIE ? text(p.KATEGORIE) : null, p.ANMELDUNG ? text(p.ANMELDUNG) : null,
            /^(ja|j)$/i.test(String(p.BARRIEREFREI ?? '')) ? 'barrierefrei' : null,
            Number.isFinite(alterVon) && Number(p.ALTER_BIS) ? `für ${alterVon} bis ${Number(p.ALTER_BIS)} Jahre` : null].filter(Boolean);

          out.push(makeTermin(FERIENPROGRAMM, {
            key: String(p.NUMMER ?? `${day}-${name}`),
            title: name,
            url: p.WEBLINK ? String(p.WEBLINK) : FERIENPROGRAMM.url,
            start: startIso,
            end: endRoh && !endRoh.allDay ? endRoh.toISOString() : null,
            date: day,
            ...(vid ? { venueId: vid } : {
              venue: treffpunkt || null, location: treffpunkt || 'Stuttgart', district: districtOf(treffpunkt),
              ...(xy ? { lat: +xy[1].toFixed(6), lon: +xy[0].toFixed(6) } : {}),
            }),
            scene: ['jugend'],
            category: facts.join(' · ') || 'Ferienprogramm',
            priceMin: kmahl, free: kmahl === 0 ? true : null,
            minAge: alterVon >= 16 && alterVon <= 18 ? alterVon : null,
            status: null,
            verified: 'official', // amtlich angekündigt: der Termin findet statt
          }));
        }
      }
      return out;
    },
  };
}
