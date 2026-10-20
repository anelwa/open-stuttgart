// Filtert das deutschlandweite Statik-GTFS von gtfs.de auf den Raum Stuttgart und schreibt
// server/data/gtfsde-stuttgart.json. Die Datei ordnet die Nummern im GTFS-RT-Feed von gtfs.de
// (stop_id, trip_id, route_id) Haltnamen, Linien und Zielen zu (siehe server/sources/gtfsrt.mjs).
//
// Aufruf: node scripts/gtfsde-stuttgart.mjs [PFAD/latest.zip]
// Ohne Pfad wird https://download.gtfs.de/germany/free/latest.zip (rund 295 MB) in ein
// temporäres Verzeichnis geladen und danach gelöscht. Zum Entpacken wird `unzip` benötigt.
// stop_times.txt (rund 2,3 GB entpackt) wird nur als Strom gelesen, nie ganz entpackt.
//
// Quelle und Lizenz der erzeugten Datei: gtfs.de (Daten bereitgestellt von DELFI e. V.),
// CC BY-SA 4.0; Daten aus Baden-Württemberg: NVBW, Datenlizenz Deutschland – Namensnennung 2.0.
// Abgeleitete Datensätze sind unter gleicher Lizenz (CC BY-SA 4.0) weiterzugeben.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { USER_AGENT } from '../server/cache.mjs';

const URL_ZIP = 'https://download.gtfs.de/germany/free/latest.zip';
// Rechteck Raum Stuttgart (mit Nachbarorten wie Ludwigsburg, Waiblingen, Esslingen, Böblingen)
const BOX = { s: 48.64, n: 48.9, w: 8.95, o: 9.4 };
const ZIEL = fileURLToPath(new URL('../server/data/gtfsde-stuttgart.json', import.meta.url));

/** Eine CSV-Zeile zerlegen (Anführungszeichen nach RFC 4180). */
function csv(line) {
  if (!line.includes('"')) return line.split(',');
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Datei aus dem Zip zeilenweise lesen; `onRow` erhält die Felder und die Spaltenindizes. */
async function lies(zip, name, onRow) {
  const p = spawn('unzip', ['-p', zip, name], { stdio: ['ignore', 'pipe', 'inherit'] });
  const rl = createInterface({ input: p.stdout, crlfDelay: Infinity });
  let col = null; let n = 0;
  for await (const raw of rl) {
    const line = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    if (!col) { col = Object.fromEntries(csv(line).map((k, i) => [k.trim(), i])); continue; }
    if (line) { onRow(csv(line), col); n++; }
  }
  await new Promise((r) => p.on('close', r));
  return n;
}

async function main() {
  const t0 = Date.now();
  let zip = process.argv[2];
  let tmp = null;
  if (!zip) {
    tmp = mkdtempSync(join(tmpdir(), 'gtfsde-'));
    zip = join(tmp, 'latest.zip');
    console.log(`Lade ${URL_ZIP} …`);
    const res = await fetch(URL_ZIP, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`download.gtfs.de antwortet mit ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
  }
  try {
    // 1. Halte: Namen aller Halte (für das Fahrtziel), Koordinaten nur im Rechteck
    const namen = new Map();
    const halte = {};
    await lies(zip, 'stops.txt', (r, c) => {
      const id = r[c.stop_id]; const name = r[c.stop_name];
      namen.set(id, name);
      const la = +r[c.stop_lat]; const lo = +r[c.stop_lon];
      if (la > BOX.s && la < BOX.n && lo > BOX.w && lo < BOX.o) halte[id] = [name, +la.toFixed(5), +lo.toFixed(5)];
    });
    console.log(`Halte im Rechteck: ${Object.keys(halte).length}`);

    // 2. Routen und Fahrten vollständig einlesen, gefiltert wird nach stop_times
    const routen = new Map();
    await lies(zip, 'routes.txt', (r, c) => routen.set(r[c.route_id], [r[c.route_short_name] || r[c.route_long_name] || '', +r[c.route_type]]));
    const fahrtRoute = new Map();
    await lies(zip, 'trips.txt', (r, c) => fahrtRoute.set(r[c.trip_id], r[c.route_id]));

    // 3. stop_times als Strom: Fahrten mit Halt im Rechteck und letzter Halt je Fahrt (Ziel)
    const imRaum = new Set();
    const letzter = new Map(); // trip_id -> [stop_sequence, stop_id]
    const nSt = await lies(zip, 'stop_times.txt', (r, c) => {
      const trip = r[c.trip_id]; const stop = r[c.stop_id]; const seq = +r[c.stop_sequence];
      if (stop in halte) imRaum.add(trip);
      const l = letzter.get(trip);
      if (!l) letzter.set(trip, [seq, stop]); else if (seq > l[0]) { l[0] = seq; l[1] = stop; }
    });
    console.log(`stop_times: ${nSt} Zeilen, Fahrten im Raum: ${imRaum.size}`);

    // 4. Kompakte Ausgabe: Ziele und Routen als Tabellen, Fahrten als Spalten
    const ziele = []; const zielIdx = new Map();
    const routenOut = {};
    const fIds = []; const fRoute = []; const fZiel = [];
    for (const trip of imRaum) {
      const rid = fahrtRoute.get(trip);
      if (rid == null) continue;
      if (!routenOut[rid]) routenOut[rid] = routen.get(rid) ?? ['', -1];
      const ziel = namen.get(letzter.get(trip)?.[1]) ?? '';
      let zi = zielIdx.get(ziel);
      if (zi == null) { zi = ziele.length; ziele.push(ziel); zielIdx.set(ziel, zi); }
      fIds.push(trip); fRoute.push(rid); fZiel.push(zi);
    }
    const out = {
      quelle: 'gtfs.de, Statik-GTFS Deutschland (latest-free), Daten bereitgestellt von DELFI e. V.; Baden-Württemberg: NVBW',
      lizenz: 'CC BY-SA 4.0 (gtfs.de); BW-Daten NVBW, Datenlizenz Deutschland – Namensnennung 2.0',
      url: URL_ZIP,
      erzeugt: new Date().toISOString(),
      rechteck: BOX,
      hinweis: 'Gefiltert auf Fahrten mit mindestens einem Halt im Rechteck. halte: id -> [Name, Breite, Länge]; routen: id -> [Kurzname, route_type]; fahrten: Spalten id, route, ziel (Index in ziele). Erzeugt mit scripts/gtfsde-stuttgart.mjs.',
      halte,
      routen: routenOut,
      ziele,
      fahrten: { id: fIds.join(','), route: fRoute.join(','), ziel: fZiel.join(',') },
    };
    writeFileSync(ZIEL, JSON.stringify(out));
    console.log(`${ZIEL}: ${(statSync(ZIEL).size / 1e6).toFixed(1)} MB, ${fIds.length} Fahrten, ${Object.keys(routenOut).length} Routen, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
