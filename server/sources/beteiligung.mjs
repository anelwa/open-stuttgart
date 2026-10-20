// Beteiligung und Politik am Ort (7.1/7.2 Rang 12): rechtskräftige Bebauungspläne am Ort aus dem Geoserver
// der Stadt (Ebene A61_BPLAN, CC BY 4.0), dazu die Seite „Aktuelle Planauslage“ und die amtlichen
// Bekanntmachungen auf stuttgart.de (Verfahren in Auslegung), Wahlergebnisse je Stadtbezirk aus den
// CSV-Dateien des Statistischen Amts und ein Hinweis zum Beteiligungsportal „Stuttgart – meine Stadt“.
// Ebenen und Ergebnisse ändern sich selten: Pläne einmal am Tag je Ort, Planauslage alle 6 Stunden,
// Wahlergebnisse einmal in der Woche.
import { cached, fetchJson, fetchText } from '../cache.mjs';

const WFS2 = 'https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326';
const PLANAUSLAGE = 'https://www.stuttgart.de/leben/stadtentwicklung/oeffentlichkeitsbeteiligung/planauslage/';
const BEKANNTMACHUNGEN = 'https://www.stuttgart.de/rathaus/amtliche-bekanntmachungen/';
const AEUSSERUNG = 'https://www.stuttgart.de/organigramm/leistungen/foermliche-beteiligung-der-oeffentlichkeit-im-bebauungsplanverfahren';

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const abs = (href) => (href.startsWith('http') ? href : `https://www.stuttgart.de${href}`);

// ---------- Geometrie (wie in adresse.mjs) ----------
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
/** Abstand Punkt zum nächsten Eckpunkt der Fläche (Meter, Näherung; 0, wenn der Punkt darin liegt). */
function nearDist(f, pt) {
  if (contains(f, pt)) return 0;
  const k = 111_320 * Math.cos((pt[1] * Math.PI) / 180);
  let best = Infinity;
  for (const p of polys(f.geometry)) for (const [x, y] of p[0]) best = Math.min(best, Math.hypot((x - pt[0]) * k, (y - pt[1]) * 111_320));
  return Math.round(best);
}

// ---------- Verfahren in Auslegung: Seite „Aktuelle Planauslage“ ----------
// Die Seite nennt laufende Bebauungsplan-, Satzungs- und FNP-Änderungsverfahren oder den Hinweis, dass
// derzeit nichts ausliegt. Einträge stehen wie bei den Bekanntmachungen in aufklappbaren Abschnitten.
function abschnitte(html) {
  const parts = html.split(/<h2 class="SP-Collapsible__trigger__text[^"]*">/).slice(1);
  return parts.map((p) => {
    const titel = text(p.slice(0, p.indexOf('</h2>')));
    const end = p.search(/<h2 class="SP-Headline--section/);
    const body = end > 0 ? p.slice(0, end) : p;
    const dokumente = [...body.matchAll(/href="([^"]+\.(?:pdf|PDF|zip))"/g)].map((m) => abs(m[1]));
    return { titel, dokumente: [...new Set(dokumente)] };
  }).filter((x) => x.titel);
}

async function planauslage() {
  const { value } = await cached('planauslage', 6 * 3600_000, async () => {
    const html = await fetchText(PLANAUSLAGE);
    const keine = /Momentan liegen keine verfahrensrelevanten Unterlagen/i.test(html);
    return { keine, verfahren: keine ? [] : abschnitte(html) };
  });
  return value;
}

async function bekanntmachungen() {
  const { value } = await cached('bekanntmachungen-plan', 6 * 3600_000, async () => {
    const html = await fetchText(BEKANNTMACHUNGEN);
    return abschnitte(html).filter((x) => /Bebauungsplan|Flächennutzungsplan|Planfeststellung|Auslegung|Offenlage|Satzung|Veränderungssperre|Bauvorschrift/i.test(x.titel));
  });
  return value;
}

/** Bebauungspläne am Ort (Radius r in Metern, höchstens 1500) und Verfahren, die derzeit öffentlich ausliegen. */
export async function bebauungsplaene(lat, lon, r = 300) {
  lat = +lat; lon = +lon; r = Math.min(Math.max(+r || 300, 20), 1500);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 48.6 || lat > 48.9 || lon < 9.0 || lon > 9.35) throw new Error('Ort außerhalb von Stuttgart');
  const key = `bplan-${lat.toFixed(4)}-${lon.toFixed(4)}-${r}`;
  const { value: plaene } = await cached(key, 24 * 3600_000, async () => {
    const dLat = r / 111_320; const dLon = r / (111_320 * Math.cos((lat * Math.PI) / 180));
    const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((x) => x.toFixed(6)).join(',');
    const j = await fetchJson(`${WFS2}&typeName=GEOLINE_FLEX:A61_BPLAN_EPSG25832&count=300&bbox=${bbox},urn:ogc:def:crs:EPSG::4326`, { timeout: 30000 });
    const pt = [lon, lat];
    return (j.features ?? []).map((f) => {
      const p = f.properties ?? {};
      return {
        id: p.BPLAN_ID_BEZIRK ?? p.BPLAN_ID, nummer: p.BPLAN_ID, name: p.NAME, jahr: p.JAHR ?? null,
        amOrt: contains(f, pt), abstand: nearDist(f, pt),
        karte: p.URL_MASTERPORTAL ?? null,
        dokumente: Object.fromEntries([
          ['plan', p.AUSFERTIGUNG_URL], ['begruendung', p.BERUENDUNG_URL], ['textteil', p.TEXT_URL], ['legende', p.LEGENDE_URL],
          ['beiblatt', p.BEIBLATT_URL], ['hinweis', p.HINWEIS_URL], ['erklaerung', p.ERKLAERUNG_URL], ['vermerke', p.VERMERKE_URL],
        ].filter(([, v]) => v)),
      };
    }).filter((x) => x.abstand <= r)
      .sort((a, b) => (b.amOrt - a.amOrt) || ((b.jahr ?? 0) - (a.jahr ?? 0)) || (a.abstand - b.abstand));
  });
  const jahr = new Date().getFullYear();
  const [aus, bek] = await Promise.allSettled([planauslage(), bekanntmachungen()]);
  return {
    lat, lon, radius: r,
    plaene,
    amOrt: plaene.filter((p) => p.amOrt).map((p) => p.id),
    neuere: plaene.filter((p) => p.jahr && p.jahr >= jahr - 5).map((p) => p.id),
    auslegung: aus.status === 'fulfilled'
      ? { derzeitKeine: aus.value.keine, verfahren: aus.value.verfahren, seite: PLANAUSLAGE, aeusserung: AEUSSERUNG,
        hinweis: 'Verfahren in Auslegung sind in der Planauslage nicht mit Koordinaten verknüpft; die Zuordnung zum Ort ist daher nur über den Titel möglich.' }
      : { fehler: String(aus.reason?.message ?? aus.reason), seite: PLANAUSLAGE },
    bekanntmachungen: bek.status === 'fulfilled' ? bek.value : [],
    hinweis: 'Die Ebene A61_BPLAN enthält rechtsverbindliche Pläne. Pläne in Aufstellung sind darin nicht enthalten. Verbindlich ist allein der Plan in der Fassung der Ausfertigung.',
    source: 'Landeshauptstadt Stuttgart, Amt für Stadtplanung und Wohnen und Stadtmessungsamt: Geodaten (CC BY 4.0), Planauslage und amtliche Bekanntmachungen auf stuttgart.de',
  };
}

// ---------- Wahlergebnisse je Stadtbezirk ----------
// Neueste Wahl zuerst. Dateien je Stadtteil mit Spalten stadtteil_nr; stadtteil; wk; stb; stadtbezirk; A; ...; F; Parteien.
// A = Wahlberechtigte, B = Wählerinnen und Wähler, E = ungültige, F = gültige Stimmen.
const WAHLEN = [
  { id: 'ltw2026', titel: 'Landtagswahl 2026', datum: '2026-03-08', stimme: 'Zweitstimmen',
    url: 'https://statistik.stuttgart.de/wahlen/data/ltw/2026/Zweitstimmen_Endergebnis_Stuttgart_nach-Stadtteilen_LTW2026.csv' },
];
const META = new Set(['stadtteil_nr', 'stadtteil', 'wk', 'stb', 'stadtbezirk']);
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function parseCsv(txt) {
  const lines = txt.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const head = lines.shift().split(';').map((h) => h.trim());
  return lines.map((l) => Object.fromEntries(l.split(';').map((v, i) => [head[i], v.trim()])));
}

function summe(rows, parteien) {
  const n = (k) => rows.reduce((s, r) => s + (+r[k] || 0), 0);
  const gueltig = n('F');
  return {
    wahlberechtigte: n('A'), waehler: n('B'), ungueltig: n('E'), gueltig,
    wahlbeteiligung: n('A') ? Math.round((n('B') / n('A')) * 1000) / 10 : null,
    parteien: parteien.map((p) => ({ partei: p, stimmen: n(p), anteil: gueltig ? Math.round((n(p) / gueltig) * 1000) / 10 : null }))
      .filter((p) => p.stimmen > 0).sort((a, b) => b.stimmen - a.stimmen),
  };
}

async function wahldaten() {
  const { value } = await cached('wahl-stadtteile', 7 * 24 * 3600_000, async () => {
    const fehler = [];
    for (const w of WAHLEN) {
      try {
        const rows = parseCsv(await fetchText(w.url, { timeout: 20000 }));
        if (!rows.length || !('stadtbezirk' in rows[0])) throw new Error('unerwartetes Format');
        const keys = Object.keys(rows[0]);
        const parteien = keys.slice(keys.indexOf('F_Brief') + 1).filter((k) => k && !META.has(k));
        return { wahl: w, rows, parteien };
      } catch (e) { fehler.push(`${w.url}: ${e.message}`); }
    }
    throw new Error(fehler.join('; '));
  });
  return value;
}

/** Ergebnis der jüngsten Wahl mit offener Datei je Stadtbezirk; ohne Angabe alle Stadtbezirke im Überblick. */
export async function wahlergebnisse(stadtbezirk) {
  let d;
  try { d = await wahldaten(); } catch (e) {
    return { available: false, hinweis: `Die Wahlergebnisse des Statistischen Amts sind derzeit nicht abrufbar (${e.message}). Ergebnisse: https://www.stuttgart.de/service/wahlen/wahlergebnisse` };
  }
  const { wahl, rows, parteien } = d;
  const bezirke = [...new Set(rows.map((r) => r.stadtbezirk))].sort((a, b) => a.localeCompare(b, 'de'));
  const base = { available: true, wahl: { titel: wahl.titel, datum: wahl.datum, stimme: wahl.stimme, datei: wahl.url },
    hinweis: 'Summe der Stadtteile einschließlich Briefwahl, wie vom Statistischen Amt je Stadtteil ausgewiesen. Amtlich ist das Endergebnis des Wahlausschusses.',
    source: 'Landeshauptstadt Stuttgart, Statistisches Amt (Wahlergebnisse, Open Data)' };
  if (!stadtbezirk) {
    return { ...base, stadt: summe(rows, parteien),
      stadtbezirke: bezirke.map((b) => { const s = summe(rows.filter((r) => r.stadtbezirk === b), parteien); return { stadtbezirk: b, wahlbeteiligung: s.wahlbeteiligung, staerkste: s.parteien[0] ?? null }; }) };
  }
  const name = bezirke.find((b) => norm(b) === norm(stadtbezirk));
  if (!name) return { ...base, available: false, hinweis: `Stadtbezirk „${stadtbezirk}“ nicht gefunden. Bekannt: ${bezirke.join(', ')}` };
  const sel = rows.filter((r) => r.stadtbezirk === name);
  return { ...base, stadtbezirk: name, ergebnis: summe(sel, parteien), stadt: summe(rows, parteien),
    stadtteile: sel.map((r) => { const s = summe([r], parteien); return { nr: r.stadtteil_nr, stadtteil: r.stadtteil, wahlkreis: r.wk, wahlbeteiligung: s.wahlbeteiligung, staerkste: s.parteien[0] ?? null }; }) };
}

// ---------- Beteiligungsverfahren ----------
// Das Beteiligungsportal der Stadt (stuttgart-meine-stadt.de) bietet keinen offenen Feed; die
// Schnittstelle unter /api/ ist laut robots.txt ausgeschlossen. Daher nur Verweise, kein Abruf.
export async function beteiligungen() {
  return {
    available: false,
    hinweis: 'Für Beteiligungsverfahren der Stadt gibt es derzeit keinen offenen Datenfeed. Das Beteiligungsportal „Stuttgart – meine Stadt“ schließt seine Schnittstelle für automatische Abrufe aus. Eine Anbindung ist nur nach Absprache mit der Stadt vorgesehen.',
    links: [
      { titel: 'Beteiligungsportal „Stuttgart – meine Stadt“', url: 'https://stuttgart-meine-stadt.de/participation' },
      { titel: 'Aktuelle Planauslage (Bauleitplanung)', url: PLANAUSLAGE },
      { titel: 'Amtliche Bekanntmachungen', url: BEKANNTMACHUNGEN },
      { titel: 'Beteiligungsportal Baden-Württemberg', url: 'https://beteiligungsportal.baden-wuerttemberg.de/de/mitmachen/' },
    ],
    source: 'Landeshauptstadt Stuttgart',
  };
}
