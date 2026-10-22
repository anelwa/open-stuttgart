#!/usr/bin/env node
// Baut aus dem Unfallatlas des Bundes (dl-de/by-2-0) den Stuttgarter Auszug für die Karte.
// Quelle: https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/
// Die CSV enthält punktgenaue Unfälle mit Personenschaden, keine Sachschäden.
// Aufruf: node scripts/build-unfaelle.mjs [--jahr 2025] [--csv pfad]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'server/data');
const CACHE = join(ROOT, 'server/.cache/unfallatlas');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const jahr = Number(arg('--jahr', '2025'));
const csvArg = arg('--csv', null);
mkdirSync(DATA, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const zip = join(CACHE, `Unfallorte${jahr}_EPSG25832_CSV.zip`);
const url = `https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/Unfallorte${jahr}_EPSG25832_CSV.zip`;

async function download() {
  if (existsSync(zip) && readFileSync(zip).length > 1_000_000) return zip;
  console.log(`Lade ${url} …`);
  const res = await fetch(url, { headers: { 'User-Agent': 'open-stuttgart/0.2 (Open-Data-Projekt)' } });
  if (!res.ok) throw new Error(`Unfallatlas antwortet mit ${res.status}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  return zip;
}

function entpacke(zipFile) {
  const dir = join(CACHE, `csv-${jahr}`);
  mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', zipFile, '-d', dir]);
  const found = execFileSync('find', [dir, '-name', '*.csv'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  if (!found.length) throw new Error('Keine CSV im Archiv gefunden');
  return found[0];
}

const KATEGORIE = { 1: 'getötet', 2: 'schwer verletzt', 3: 'leicht verletzt' };
const ART = {
  1: 'Fahrunfall', 2: 'Abbiegeunfall', 3: 'Einbiegen/Kreuzen', 4: 'Überschreiten', 5: 'Längsverkehr', 6: 'sonstiger Unfall',
};
const LICHT = { 0: 'Tageslicht', 1: 'Dämmerung', 2: 'Dunkelheit' };
const WOCHENTAG = { 1: 'Sonntag', 2: 'Montag', 3: 'Dienstag', 4: 'Mittwoch', 5: 'Donnerstag', 6: 'Freitag', 7: 'Samstag' };
const zahl = (v, fallback = null) => {
  if (v == null || v === '') return fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};
const flag = (v) => String(v).trim() === '1';

const file = csvArg ?? entpacke(await download());
console.log(`Lese ${file} …`);
const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/).filter(Boolean);
const header = lines.shift().split(';');
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const items = [];
for (const line of lines) {
  const c = line.split(';');
  // Baden-Württemberg (08), Regierungsbezirk Stuttgart (1), Stadtkreis Stuttgart (11)
  if (c[idx.ULAND] !== '08' || c[idx.UREGBEZ] !== '1' || c[idx.UKREIS] !== '11') continue;
  const lon = zahl(c[idx.XGCSWGS84]);
  const lat = zahl(c[idx.YGCSWGS84]);
  if (lon == null || lat == null || lon < 9.0 || lon > 9.35 || lat < 48.65 || lat > 48.9) continue;
  const monat = zahl(c[idx.UMONAT]);
  const stunde = zahl(c[idx.USTUNDE]);
  const wochentag = zahl(c[idx.UWOCHENTAG]);
  const kategorie = zahl(c[idx.UKATEGORIE]);
  const art = zahl(c[idx.UART]);
  items.push({
    id: c[idx.UIDENTSTLAE],
    lat: +lat.toFixed(6),
    lon: +lon.toFixed(6),
    jahr: zahl(c[idx.UJAHR], jahr),
    monat,
    stunde,
    wochentag,
    kategorie,
    art,
    typ: zahl(c[idx.UTYP1]),
    licht: zahl(c[idx.ULICHTVERH]),
    rad: flag(c[idx.IstRad]),
    fuss: flag(c[idx.IstFuss]),
    pkw: flag(c[idx.IstPKW]),
    krad: flag(c[idx.IstKrad]),
    gkfz: flag(c[idx.IstGkfz]),
    sonstige: flag(c[idx.IstSonstige]),
    plst: zahl(c[idx.PLST]),
  });
}
items.sort((a, b) => a.id.localeCompare(b.id));
const out = {
  stand: String(jahr),
  quelle: `Unfallatlas ${jahr}, Statistische Ämter des Bundes und der Länder`,
  url: 'https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/',
  lizenz: 'Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0)',
  hinweis: 'Nur Unfälle mit Personenschaden, keine Sachschäden. Punktgenaue Koordinaten, keine Adressen. Die Unfallaufnahme kann sich nach dem Stand der Datenlieferung noch ändern.',
  kodierung: { kategorie: KATEGORIE, art: ART, licht: LICHT, wochentag: WOCHENTAG },
  items,
};
const target = join(DATA, 'unfaelle-stuttgart.json');
writeFileSync(target, `${JSON.stringify(out)}\n`);
const stat = {
  gesamt: items.length,
  tote: items.filter((x) => x.kategorie === 1).length,
  schwer: items.filter((x) => x.kategorie === 2).length,
  leicht: items.filter((x) => x.kategorie === 3).length,
  rad: items.filter((x) => x.rad).length,
  fuss: items.filter((x) => x.fuss).length,
  pkw: items.filter((x) => x.pkw).length,
};
console.log(`Geschrieben: ${target}`);
console.log(stat);
