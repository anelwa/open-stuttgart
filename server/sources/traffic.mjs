// Amtliche Verkehrsmeldungen: Landesmeldestelle Baden-Württemberg (LMS BW) mit den Meldungen der
// Integrierten Verkehrsleitzentrale Stuttgart (IVLZ), DATEX II über MobiData BW, minütlich aktualisiert.
// Dazu Stau- und Verkehrslagemeldungen der Autobahn GmbH des Bundes (A8, A81, A831; Quelle der Geschwindigkeiten: INRIX).
// Lizenz: Datenlizenz Deutschland – Namensnennung 2.0. Eine Verkehrslage für Stadtstraßen gibt es offen nicht.
import { cached, fetchJson, fetchText } from '../cache.mjs';

const DATEX = 'https://api.mobidata-bw.de/datasets/traffic/incidents/incidents_lmsbw.datex2.xml';
const AUTOBAHN = (road, svc = 'warning') => `https://verkehr.autobahn.de/o/autobahn/${road}/services/${svc}`;

// Stadtgebiet mit Rand
const BOX = { minLat: 48.69, maxLat: 48.87, minLon: 9.03, maxLon: 9.32 };
const inBox = (lat, lon) => lat >= BOX.minLat && lat <= BOX.maxLat && lon >= BOX.minLon && lon <= BOX.maxLon;
const km = (lat, lon) => Math.hypot((lat - 48.7758) * 111.32, (lon - 9.1829) * 73.3);

// Art der Meldung nach dem ersten Eintrag (Ursache); weitere Einträge beschreiben meist Folgen wie Stau.
// Rangfolge für die Liste: Unfall vor Stau vor Sperrung vor Baustelle
const TYPEN = [
  [/Accident|VehicleObstruction/, 'Unfall', 0],
  [/AbnormalTraffic/, 'Stau', 1],
  [/RoadOrCarriagewayOrLaneManagement|NetworkManagement|ReroutingManagement/, 'Sperrung', 2],
  [/MaintenanceWorks|ConstructionWorks|RoadworksManagement/, 'Baustelle', 3],
  [/WeatherRelatedRoadConditions|PoorEnvironmentConditions|NonWeatherRelatedRoadConditions/, 'Straßenzustand', 4],
  [/PublicEvent/, 'Veranstaltung', 5],
];
function typ(types, text) {
  if (/Unfall/.test(text)) return { typ: 'Unfall', rang: 0 };
  if (/\d km Stau|stockender Verkehr|Stau,/.test(text)) return { typ: 'Stau', rang: 1 };
  if (/Baustelle/.test(text)) return { typ: 'Baustelle', rang: 3 };
  for (const [re, name, rank] of TYPEN) if (re.test(types[0] ?? '')) return { typ: name, rang: rank };
  return { typ: 'Sonstiges', rang: 9 };
}

const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const first = (s, re) => { const m = re.exec(s); return m ? m[1] : null; };

function parseDatex(xml) {
  const out = [];
  const re = /<situation id="([^"]+)"[^>]*>([\s\S]*?)<\/situation>/g;
  for (let m; (m = re.exec(xml)); ) {
    const [, id, body] = m;
    const lat = Number(first(body, /<locationForDisplay><latitude>([\d.]+)<\/latitude>/));
    const lon = Number(first(body, /<locationForDisplay><latitude>[\d.]+<\/latitude><longitude>([\d.]+)<\/longitude>/));
    const ivlz = /IVLZ Stuttgart/.test(id);
    if (!lat || !lon || !(ivlz || inBox(lat, lon))) continue;
    const types = [...body.matchAll(/<situationRecord [^>]*xsi:type="([^"]+)"/g)].map((x) => x[1]);
    const raw = first(body, /<generalPublicComment><comment><values><value[^>]*>([\s\S]*?)<\/value>/);
    const text = raw ? unxml(raw).replace(/\s*\n\s*/g, ', ').trim() : '';
    const linie = [...(first(body, /<linearByCoordinates>([\s\S]*?)<\/linearByCoordinates>/) ?? '')
      .matchAll(/<latitude>([\d.]+)<\/latitude><longitude>([\d.]+)<\/longitude>/g)].map((x) => [+x[2], +x[1]]);
    out.push({
      id,
      quelle: ivlz ? 'IVLZ Stuttgart' : 'LMS BW',
      ...typ(types, text),
      text,
      lat, lon,
      linie: linie.length > 1 ? linie : null,
      seit: first(body, /<overallStartTime>([^<]+)</) ?? first(body, /<situationVersionTime>([^<]+)</),
      bis: first(body, /<overallEndTime>([^<]+)</) ?? first(body, /<endOfPeriod>([^<]+)</),
    });
  }
  return out;
}

const IMPACT_SYMBOL = {
  ALL_LANES_OPEN: 'alle Fahrstreifen frei',
  ONE_LANE_REDUCED: '1 Fahrstreifen gesperrt',
  TWO_LANES_REDUCED: '2 Fahrstreifen gesperrt',
  THREE_LANES_REDUCED: '3 Fahrstreifen gesperrt',
  FULL_CLOSURE: 'Vollsperrung',
  CONDENSED_LANES: 'verengte Fahrstreifen',
};

async function autobahn() {
  const roads = ['A8', 'A81', 'A831'];
  const all = [];
  for (const road of roads) {
    try {
      const [warnRes, rwRes, clRes] = await Promise.allSettled([
        cached(`autobahn:${road}:warning`, 2 * 60_000, () => fetchJson(AUTOBAHN(road, 'warning'))),
        cached(`autobahn:${road}:roadworks`, 10 * 60_000, () => fetchJson(AUTOBAHN(road, 'roadworks'))),
        cached(`autobahn:${road}:closure`, 5 * 60_000, () => fetchJson(AUTOBAHN(road, 'closure'))),
      ]);
      const warnings = warnRes.status === 'fulfilled' ? warnRes.value.value.warning ?? [] : [];
      for (const w of warnings) {
        const lat = Number(w.coordinate?.lat), lon = Number(w.coordinate?.long);
        if (!lat || !lon || km(lat, lon) > 25) continue;
        const speed = w.averageSpeed ? Number(w.averageSpeed) : null;
        const delay = w.delayTimeValue ? Number(w.delayTimeValue) : null;
        const art = { SLOW_TRAFFIC: 'stockender Verkehr', QUEUING_TRAFFIC: 'Stau', STATIONARY_TRAFFIC: 'stehender Verkehr' }[w.abnormalTrafficType] ?? 'Verkehrsbehinderung';
        const coords = w.geometry?.type === 'LineString' ? w.geometry.coordinates : null;
        all.push({
          id: w.identifier,
          quelle: 'Autobahn GmbH',
          typ: 'Stau',
          rang: 1,
          text: [`${w.title?.trim()}${w.subtitle ? `, Richtung ${w.subtitle.split('->').pop().trim()}` : ''}: ${art}`,
            speed ? `${speed} km/h` : null, delay ? `${delay} Minuten Zeitverlust` : null].filter(Boolean).join(', '),
          lat, lon,
          linie: coords && coords.length > 1 ? coords : null,
          geschwindigkeit: speed,
          zeitverlust: delay,
          seit: w.startTimestamp ?? null,
          bis: null,
        });
      }
      const closures = clRes.status === 'fulfilled' ? clRes.value.value.closure ?? [] : [];
      for (const c of closures) {
        const lat = Number(c.coordinate?.lat), lon = Number(c.coordinate?.long);
        if (!lat || !lon || km(lat, lon) > 25 || c.isBlocked === 'false') continue;
        const coords = c.geometry?.type === 'LineString' ? c.geometry.coordinates : null;
        const desc = (c.description ?? []).filter((x) => x && !/^A\d+/.test(x.trim())).slice(0, 2).join('; ');
        all.push({
          id: c.identifier ?? `cl-${road}-${lat}-${lon}`,
          quelle: 'Autobahn GmbH',
          typ: 'Sperrung',
          rang: 2,
          text: [`${c.title?.trim() ?? road}${c.subtitle ? ` (${c.subtitle.trim()})` : ''}`, desc || 'Sperrung'].filter(Boolean).join(': '),
          lat, lon,
          linie: coords && coords.length > 1 ? coords : null,
          seit: c.startTimestamp ?? null,
          bis: c.endTimestamp ?? null,
        });
      }
      const roadworks = rwRes.status === 'fulfilled' ? rwRes.value.value.roadworks ?? [] : [];
      for (const rw of roadworks) {
        const lat = Number(rw.coordinate?.lat), lon = Number(rw.coordinate?.long);
        if (!lat || !lon || km(lat, lon) > 25) continue;
        const coords = rw.geometry?.type === 'LineString' ? rw.geometry.coordinates : null;
        const descLines = (rw.description ?? []).map((x) => String(x).trim()).filter(Boolean);
        const maxWidth = descLines.find((x) => /Maximale Durchfahrtsbreite|Durchfahrtsbreite/i.test(x)) ?? null;
        const symbols = (rw.impact?.symbols ?? []).map((s) => IMPACT_SYMBOL[s] ?? null).filter(Boolean);
        const workDesc = descLines.find((x) => /Bauarbeiten|Fahrbahnerneuerung|Brückenarbeiten|Markierungsarbeiten|Instandsetzung|Sperrung/i.test(x)) ?? descLines[1] ?? 'Baustelle';
        all.push({
          id: rw.identifier ?? `rw-${road}-${lat}-${lon}`,
          quelle: 'Autobahn GmbH',
          typ: 'Baustelle',
          rang: 3,
          text: [`${rw.title?.trim() ?? road}${rw.subtitle ? `, Richtung ${rw.subtitle.split('->').pop().trim()}` : ''}: ${workDesc}`,
            ...symbols, maxWidth].filter(Boolean).join(', '),
          lat, lon,
          linie: coords && coords.length > 1 ? coords : null,
          maxBreite: maxWidth,
          fahrstreifen: symbols.length ? symbols.join(', ') : null,
          seit: rw.startTimestamp ?? null,
          bis: rw.endTimestamp ?? null,
        });
      }
    } catch { /* eine Autobahn ohne Antwort verhindert die übrigen Meldungen nicht */ }
  }
  return all;
}

export async function traffic() {
  const [lms, ab] = await Promise.all([
    cached('datex:lmsbw', 60_000, async () => {
      const xml = await fetchText(DATEX, { timeout: 30000 });
      return { items: parseDatex(xml), publiziert: first(xml, /<publicationTime>([^<]+)</) };
    }).then((r) => r.value).catch(() => ({ items: [], publiziert: null, fehler: true })),
    autobahn(),
  ]);
  const items = [...lms.items, ...ab].sort((a, b) => a.rang - b.rang || String(b.seit).localeCompare(String(a.seit)));
  return {
    items,
    publiziert: lms.publiziert,
    lmsVerfuegbar: !lms.fehler,
    quelle: 'Verkehrsmeldungen: Landesmeldestelle Baden-Württemberg und Integrierte Verkehrsleitzentrale Stuttgart über MobiData BW (Datenlizenz Deutschland – Namensnennung 2.0); Autobahn GmbH des Bundes',
  };
}
