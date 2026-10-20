// Hitze und Gesundheit (7.1 Rang 6): amtliche Hitzewarnung des DWD für den Warnkreis Stadt Stuttgart,
// Hitzetrend der nächsten acht Tage, Biowetter (Zone I „Württemberg“), thermischer Gefahrenindex für
// Stuttgart und die Höchsttemperatur aus der MOSMIX-Vorhersage für Stuttgart-Echterdingen (10738).
// Quellen: DWD Opendata (opendata.dwd.de, CC BY 4.0) und die Warnungsdatei der WarnWetter-Seite (dwd.de).
// Alle Dateien werden höchstens alle 30 Minuten abgerufen; der DWD aktualisiert sie seltener.
import { inflateRawSync } from 'node:zlib';
import { cached, fetchJson, fetchText, USER_AGENT } from '../cache.mjs';

const TTL = 30 * 60_000;
const HEALTH = 'https://opendata.dwd.de/climate_environment/health';
const WARNCELL = '108111000'; // DWD-Warnkreis Stadt Stuttgart
const HW_KREIS = 'SXX'; // Kennung „Stadt Stuttgart“ im Hitzetrend
const BIO_ZONE = 'I'; // Württemberg, Franken ohne östl. Oberfranken
const MOSMIX_STATION = '10738'; // Stuttgart-Echterdingen

// Warnstufen laut Datensatzbeschreibung „Hitzetrend DWD-Warnkreise“ (DWD, 21.03.2025)
const TREND = {
  0: 'keine Warnung bzw. kein Hitzetrend',
  1: 'Warnung vor starker Wärmebelastung',
  2: 'Warnung vor extremer Wärmebelastung',
  3: 'Hitzetrend aktiv, Warnung möglich',
  4: 'Hitzetrend: Warnung Stufe 1 gering wahrscheinlich',
  5: 'Hitzetrend: Warnung Stufe 1 wahrscheinlich',
  6: 'Hitzetrend: Warnung Stufe 2 gering wahrscheinlich',
  7: 'Hitzetrend: Warnung Stufe 2 wahrscheinlich',
};

const ABSCHNITT = {
  today_morning: 'heute Vormittag', today_afternoon: 'heute Nachmittag',
  tomorrow_morning: 'morgen Vormittag', tomorrow_afternoon: 'morgen Nachmittag',
  dayafter_to_morning: 'übermorgen Vormittag', dayafter_to_afternoon: 'übermorgen Nachmittag',
};

const berlinDate = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- Amtliche Warnungen (alle Arten) für den Warnkreis Stuttgart ----------
async function warnungen() {
  const { value } = await cached('dwd-warnings', TTL, async () => {
    const txt = await fetchText('https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json');
    const j = JSON.parse(txt.replace(/^\s*warnWetter\.loadWarnings\(/, '').replace(/\);?\s*$/, ''));
    return { time: j.time, list: [...(j.warnings?.[WARNCELL] ?? []), ...(j.vorabInformation?.[WARNCELL] ?? [])] };
  });
  return value;
}

// ---------- Hitzetrend je Warnkreis (Datei des Tages, notfalls des Vortags) ----------
async function hitzetrend() {
  const { value } = await cached('dwd-hwtrend', TTL, async () => {
    const heute = berlinDate();
    for (const tag of [heute, plusDays(heute, -1)]) {
      try {
        const j = await fetchJson(`${HEALTH}/forecasts/heat/hwtrend_${tag.replaceAll('-', '')}.json`);
        const k = j[HW_KREIS];
        if (k) return { stand: tag, name: k.Name?.trim(), trend: k.Trend };
      } catch { /* Datei des Tages noch nicht vorhanden */ }
    }
    throw new Error('Hitzetrend des DWD nicht erreichbar');
  });
  return value;
}

// ---------- Biowetter ----------
async function biowetter() {
  const { value } = await cached('dwd-biowetter', TTL, () => fetchJson(`${HEALTH}/alerts/biowetter.json`));
  const z = value.zone?.find((x) => x.id === BIO_ZONE);
  if (!z) return { stand: value.last_update, abschnitte: [] };
  const abschnitte = Object.entries(ABSCHNITT).filter(([k]) => z[k]).map(([k, label]) => ({
    abschnitt: label,
    effekte: (z[k].effect ?? []).map((e) => ({
      name: e.name, wert: e.value,
      details: (e.subeffect ?? []).map((s) => ({ name: s.name, wert: s.value })),
    })),
  }));
  return { zone: z.name, stand: value.last_update, naechste: value.next_update, abschnitte };
}

// ---------- Thermischer Gefahrenindex (gefühlte Temperatur) für Stuttgart ----------
async function gefahrenindex() {
  const { value } = await cached('dwd-gt', TTL, () => fetchJson(`${HEALTH}/alerts/gt.json`));
  const c = value.content?.find((x) => x.city === 'Stuttgart');
  if (!c) return null;
  const reihen = [['today', 0], ['tomorrow', 1], ['dayafter_to', 2], ['after_threedays', 3]];
  const werte = [];
  for (const [p, d] of reihen) {
    for (const h of ['03', '09', '15', '21']) {
      const v = c.forecast[`${p}_${h}MEZ`];
      if (v != null) werte.push({ datum: plusDays(value.forecast_day, d), uhrzeit: `${h}:00 MEZ`, belastung: v });
    }
  }
  return { stand: value.last_update, werte };
}

// ---------- Höchsttemperatur aus MOSMIX_L (KMZ = ZIP mit einer KML-Datei) ----------
function unzipFirst(buf) {
  // Zentrales Verzeichnis lesen, damit auch Einträge mit Datendeskriptor funktionieren
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('KMZ ohne Verzeichnis');
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10);
  const size = buf.readUInt32LE(cd + 20);
  const off = buf.readUInt32LE(cd + 42);
  const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
  const data = buf.subarray(start, start + size);
  return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
}

async function hoechsttemperatur() {
  const { value } = await cached('dwd-mosmix-tx', TTL, async () => {
    // Binärdatei: fetchText würde sie verfälschen; ein Abruf je 30 Minuten mit derselben Kennung
    const res = await fetch(`https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/${MOSMIX_STATION}/kml/MOSMIX_L_LATEST_${MOSMIX_STATION}.kmz`,
      { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`opendata.dwd.de antwortet mit ${res.status}`);
    const kml = unzipFirst(Buffer.from(await res.arrayBuffer()));
    const steps = [...kml.matchAll(/<dwd:TimeStep>([^<]+)<\/dwd:TimeStep>/g)].map((m) => m[1]);
    const tx = kml.match(/dwd:elementName="TX">\s*<dwd:value>([^<]+)<\/dwd:value>/)?.[1].trim().split(/\s+/) ?? [];
    const stand = kml.match(/<dwd:IssueTime>([^<]+)<\/dwd:IssueTime>/)?.[1] ?? null;
    // TX = Höchstwert der letzten 12 Stunden; der Wert um 18 UTC deckt 06 bis 18 UTC ab, also den Tag
    const tage = [];
    steps.forEach((t, i) => {
      if (!t.includes('T18:00') || tx[i] == null || tx[i] === '-') return;
      tage.push({ datum: t.slice(0, 10), grad: Math.round((+tx[i] - 273.15) * 10) / 10 });
    });
    return { station: `${MOSMIX_STATION} Stuttgart-Echterdingen`, stand, tage };
  });
  return value;
}

const datum = (ms) => (ms ? new Date(ms).toISOString() : null);

/** Hitzewarnung, Hitzetrend, Biowetter, Gefahrenindex und Höchsttemperatur für Stuttgart. */
export async function hitze() {
  const [w, t, b, g, tx] = await Promise.allSettled([warnungen(), hitzetrend(), biowetter(), gefahrenindex(), hoechsttemperatur()]);
  const out = { warnung: null, trend: null, biowetter: [], gefahrenindex: null, hoechsttemperatur: null, weitereWarnungen: [], fehler: [] };

  if (w.status === 'fulfilled') {
    const alle = w.value.list.map((x) => ({
      ereignis: x.event, stufe: x.level, titel: x.headline, text: x.description, hinweis: x.instruction || null,
      von: datum(x.start), bis: datum(x.end), region: x.regionName,
    }));
    const heat = alle.filter((x) => /HITZE|WÄRMEBELASTUNG/i.test(`${x.ereignis} ${x.titel}`));
    if (heat.length) {
      const h = heat.sort((a, b) => b.stufe - a.stufe)[0];
      out.warnung = { stufe: /EXTREM/i.test(`${h.ereignis} ${h.titel}`) ? 2 : 1, text: h.titel, beschreibung: h.text, hinweis: h.hinweis, von: h.von, bis: h.bis, quelle: 'DWD WarnWetter' };
    }
    out.weitereWarnungen = alle.filter((x) => !heat.includes(x));
  } else out.fehler.push(`Warnungen: ${w.reason?.message ?? w.reason}`);

  if (t.status === 'fulfilled') {
    out.trend = { kreis: t.value.name, stand: t.value.stand, tage: t.value.trend.map((code, i) => ({ datum: plusDays(t.value.stand, i), code, text: TREND[code] ?? `Code ${code}` })) };
    // Tag 1 und 2 beruhen laut DWD auf den amtlichen Hitzewarnungen
    const heute = out.trend.tage.find((d) => d.datum === berlinDate());
    if (!out.warnung && heute && (heute.code === 1 || heute.code === 2)) {
      out.warnung = { stufe: heute.code, text: `Amtliche Warnung vor ${heute.code === 2 ? 'extremer' : 'starker'} Wärmebelastung`, beschreibung: null, hinweis: null, von: heute.datum, bis: heute.datum, quelle: 'DWD Hitzetrend (Warnstatus des Tages)' };
    }
  } else out.fehler.push(`Hitzetrend: ${t.reason?.message ?? t.reason}`);

  if (b.status === 'fulfilled') { out.biowetter = b.value.abschnitte; out.biowetterZone = b.value.zone ?? null; out.biowetterStand = b.value.stand; }
  else out.fehler.push(`Biowetter: ${b.reason?.message ?? b.reason}`);
  if (g.status === 'fulfilled') out.gefahrenindex = g.value; else out.fehler.push(`Gefahrenindex: ${g.reason?.message ?? g.reason}`);
  if (tx.status === 'fulfilled') out.hoechsttemperatur = tx.value; else out.fehler.push(`MOSMIX: ${tx.reason?.message ?? tx.reason}`);

  if (!out.fehler.length) delete out.fehler;
  out.source = 'Deutscher Wetterdienst (DWD Opendata, CC BY 4.0): Warnungen, Hitzetrend, Biowetter, thermischer Gefahrenindex, MOSMIX';
  return out;
}
