// Prüft das Erweiterungsprogramm: 100 Quellen, 100 Werkzeuge, vollständige
// Metadaten, eindeutige IDs und – mit --live – die tatsächliche Erreichbarkeit.
import { SOURCES } from '../server/extras/sources.mjs';
import { FEATURES, FEATURE_CATEGORIES } from '../server/extras/features/registry.mjs';
import { runSource } from '../server/extras/run-source.mjs';
import { runFeature } from '../server/extras/features/index.mjs';
import { FEATURE_CATEGORIES as CATS } from '../server/extras/features/registry.mjs';
import { IMPROVEMENTS, IMPROVEMENT_CATEGORIES } from '../server/extras/improvements.mjs';

const args = new Set(process.argv.slice(2));
const live = args.has('--live');
const liveFeatures = args.has('--live-features');
const problems = [];

const need = (cond, msg) => { if (!cond) problems.push(msg); };
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

need(SOURCES.length >= 100, `Quellen: ${SOURCES.length} statt mindestens 100`);
need(FEATURES.length === 100, `Werkzeuge: ${FEATURES.length} statt 100`);
need(IMPROVEMENTS.length === 100, `Verbesserungen: ${IMPROVEMENTS.length} statt 100`);
need(new Set(SOURCES.map((s) => s.id)).size === SOURCES.length, 'Doppelte Quellen-IDs');
need(new Set(FEATURES.map((f) => f.id)).size === FEATURES.length, 'Doppelte Werkzeug-IDs');
need(new Set(IMPROVEMENTS.map((x) => x.id)).size === IMPROVEMENTS.length, 'Doppelte Verbesserungs-IDs');

for (const s of SOURCES) {
  need(nonEmpty(s.id) && /^[a-z0-9-]+$/.test(s.id), `Quelle ohne gültige ID: ${s.id}`);
  need(nonEmpty(s.title), `Quelle ohne Titel: ${s.id}`);
  need(nonEmpty(s.summary), `Quelle ohne Kurzbeschreibung: ${s.id}`);
  need(nonEmpty(s.license), `Quelle ohne Lizenz: ${s.id}`);
  need(nonEmpty(s.attribution), `Quelle ohne Quellenangabe: ${s.id}`);
  need(nonEmpty(s.category) && nonEmpty(s.group), `Quelle ohne Kategorie/Gruppe: ${s.id}`);
  need(['live', 'geplant', 'key'].includes(s.status), `Quelle mit unbekanntem Status: ${s.id}`);
  if (s.status === 'live') need(nonEmpty(s.adapter), `Live-Quelle ohne Adapter: ${s.id}`);
  need(!/TODO|FIXME|Platzhalter/.test(`${s.title} ${s.summary}`), `Quelle mit Platzhalter: ${s.id}`);
}

for (const x of IMPROVEMENTS) {
  need(nonEmpty(x.id) && /^[a-z0-9-]+$/.test(x.id), `Verbesserung ohne gültige ID: ${x.id}`);
  need(nonEmpty(x.title) && nonEmpty(x.summary), `Verbesserung ohne Titel/Beschreibung: ${x.id}`);
  need(IMPROVEMENT_CATEGORIES.some((c) => c.id === x.category), `Verbesserung mit unbekannter Kategorie: ${x.id}`);
  need(['done', 'offen'].includes(x.status), `Verbesserung mit unbekanntem Status: ${x.id}`);
}

for (const f of FEATURES) {
  need(nonEmpty(f.id) && /^[a-z0-9-]+$/.test(f.id), `Werkzeug ohne gültige ID: ${f.id}`);
  need(nonEmpty(f.title), `Werkzeug ohne Titel: ${f.id}`);
  need(nonEmpty(f.summary), `Werkzeug ohne Kurzbeschreibung: ${f.id}`);
  need(CATS.some(([id]) => id === f.category), `Werkzeug mit unbekannter Kategorie: ${f.id}`);
  need(Array.isArray(f.inputs), `Werkzeug ohne Eingabedefinition: ${f.id}`);
  if (f.status === 'live') need(typeof f.run === 'function', `Live-Werkzeug ohne Handler: ${f.id}`);
  need(!/TODO|FIXME|Platzhalter/.test(`${f.title} ${f.summary}`), `Werkzeug mit Platzhalter: ${f.id}`);
}

const liveSources = SOURCES.filter((s) => s.status === 'live').length;
const liveFeat = FEATURES.filter((f) => f.status === 'live').length;
console.log(`Quellen: ${SOURCES.length} (${liveSources} live)`);
console.log(`Werkzeuge: ${FEATURES.length} (${liveFeat} live)`);
console.log(`Verbesserungen: ${IMPROVEMENTS.length} (${IMPROVEMENTS.filter((x) => x.status === 'done').length} umgesetzt)`);
console.log(`Kategorien: ${CATS.length} Werkzeug-Kategorien, ${IMPROVEMENT_CATEGORIES.length} Verbesserungs-Kategorien`);
if (problems.length) {
  console.error(`\n${problems.length} Problem(e):`);
  for (const p of problems) console.error(` ✗ ${p}`);
  process.exit(1);
}
console.log('Register strukturell in Ordnung.');

if (live) {
  console.log('\nLive-Prüfung der Quellen (Ausschnitt, höflich nacheinander) …');
  let ok = 0;
  const failures = [];
  for (const s of SOURCES.filter((x) => x.status === 'live')) {
    const t = Date.now();
    try {
      const r = await runSource(s.id, { limit: 2 });
      const n = r.rows?.length ?? r.features?.length ?? r.items?.length ?? r.points?.length ?? 0;
      console.log(` ✓ ${s.id} (${r.type}, ${n} Einträge, ${Date.now() - t} ms)`);
      ok++;
    } catch (e) {
      failures.push([s.id, e.message]);
      console.error(` ✗ ${s.id}: ${e.message}`);
    }
  }
  console.log(`\nQuellen erreichbar: ${ok}/${liveSources}`);
  if (failures.length) process.exitCode = 1;
}

if (liveFeatures) {
  console.log('\nLive-Prüfung der Werkzeuge (Standard-Eingaben) …');
  const defaults = {
    'kiez-steckbrief': { bezirk: 'Mitte' }, 'kiez-zeitreise': { bezirk: 'Mitte', indikator: 'einwohner' },
    'kiez-vergleich': { bezirk: 'Mitte', bezirk2: 'Nord' }, 'kiez-ranking': { indikator: 'einwohner' },
    'stadtteil-erklaert': { bezirk: 'Mitte' }, 'quellen-check': { quelle: 'ckan-einwohner-altersgruppen' },
    'datensatz-explorer': { quelle: 'ckan-einwohner-altersgruppen' }, 'lizenz-finder': { q: 'CC' },
    'open-data-export': { q: 'Wahl' }, 'bibliothek-suche': { q: 'Stuttgart' },
    'stadtarchiv-quellen': { q: 'Königstraße' }, 'strassen-geschichte': { q: 'Olgastraße' },
    'baum-arten': { ort: 'Charlottenplatz' }, 'familien-check': { ort: 'Charlottenplatz' },
    'auto-check': { ort: 'Charlottenplatz' }, 'barriere-check': { ort: 'Charlottenplatz' },
    'senioren-check': { ort: 'Charlottenplatz' }, 'wohnlage-check': { ort: 'Charlottenplatz' },
    'adress-zeugnis': { ort: 'Charlottenplatz' }, 'historische-bilder': { ort: 'Charlottenplatz' },
    'denkmal-erklaerer': { ort: 'Charlottenplatz' }, 'wissens-luecken': { ort: 'Charlottenplatz' },
    'luft-verlauf': { ort: 'Charlottenplatz' }, 'pollen-risiko': { ort: 'Charlottenplatz' },
    'warnlage': { ort: 'Charlottenplatz' }, 'trinkwasser-check': { ort: 'Charlottenplatz' },
    'naturschutz-check': { ort: 'Charlottenplatz' }, 'hitze-check': { ort: 'Charlottenplatz' },
    'defi-check': { ort: 'Charlottenplatz' }, 'notfall-karte': { ort: 'Charlottenplatz' },
    'aussicht-finder': { ort: 'Charlottenplatz' }, 'regen-ankunft': { ort: 'Charlottenplatz' },
    'spielplatz-finder': { ort: 'Charlottenplatz' }, 'picknick-finder': { ort: 'Charlottenplatz' },
    'sport-im-park': { ort: 'Charlottenplatz' }, 'grillplatz-check': { ort: 'Charlottenplatz' },
    'museum-regen': { ort: 'Charlottenplatz' }, 'abend-planer': { ort: 'Charlottenplatz' },
    'giess-pate': { ort: 'Charlottenplatz' }, 'stadt-quiz': { bezirk: 'Mitte' },
    'mein-stuttgart': { bezirk: 'Mitte' }, 'termin-optimierer': { ort: 'Charlottenplatz' },
    'amt-finder': { q: 'Personalausweis' }, 'abfall-kalender': { strasse: 'Marienstraße', nr: '1' },
    'letzte-verbindung': { ort: 'Charlottenplatz' }, 'anschluss-risiko': { ankunft: '10:10', linie: 'U6' },
    'baustellen-route': { von: 'Stuttgart Hauptbahnhof', nach: 'Charlottenplatz' },
    'unfall-route': { von: 'Stuttgart Hauptbahnhof', nach: 'Charlottenplatz' },
    'steigungs-profil': { ort: 'Charlottenplatz', nach: 'Karlshöhe' },
    'tank-optimierer': { ort: 'Charlottenplatz' }, 'flug-analyse': {},
    'fristen-rechner': { start: '2026-10-24', art: 'widerspruch' },
    'ummelde-helfer': { ort: 'Charlottenplatz' }, 'sperrmuell-check': { ort: 'Charlottenplatz' },
    'stromausfall-check': {}, 'gas-notfall': {}, 'erste-hilfe': {},
    'feuerwehr-check': { ort: 'Charlottenplatz' }, 'polizei-check': { ort: 'Charlottenplatz' },
    'wochenend-planer': { ort: 'Charlottenplatz' }, 'vorlesen': { text: 'abend-planer', ort: 'Charlottenplatz' },
    'leichte-sprache': { text: 'abend-planer', ort: 'Charlottenplatz' },
    'qr-schild': { ort: 'Charlottenplatz' }, 'kiosk-builder': { ort: 'Charlottenplatz' },
    'embed-widget': { url: 'https://openstuttgart.de/' }, 'rss-builder': { q: 'Termin' },
    'ical-builder': { q: 'Termin' }, 'webhook-builder': { q: 'Regen' },
    'social-post': { q: 'Wahl' }, 'nachbarschafts-tipp': { ort: 'Charlottenplatz' },
    'kessel-wetter': {}, 'geheimnisorte': { ort: 'Charlottenplatz' },
    'foto-rallye': { ort: 'Charlottenplatz' }, 'zeitkapsel': { ort: 'Charlottenplatz' },
    'schnitzeljagd-builder': { ort: 'Charlottenplatz' }, 'dokumenten-checkliste': { q: 'Personalausweis' },
    'hochwasser-route': { von: 'Stuttgart Hauptbahnhof', nach: 'Charlottenplatz' },
    'barrierefreie-route': { von: 'Stuttgart Hauptbahnhof', nach: 'Charlottenplatz' },
    'isochron-15': { ort: 'Charlottenplatz', modus: 'fuss' },
    'parkdruck': { ort: 'Charlottenplatz' }, 'lade-optimierer': { ort: 'Charlottenplatz' },
    'gewitter-radar': { ort: 'Charlottenplatz' }, 'waldbrand-check': { ort: 'Charlottenplatz' },
    'wander-rundweg': { ort: 'Charlottenplatz' },
    'radtour-planer': { ort: 'Charlottenplatz', nach: 'Ludwigsburg' },
    'sternenhimmel': { ort: 'Charlottenplatz' }, 'gebuehren-rechner': { leistung: 'personalausweis' },
    'foerder-finder': { ort: 'Charlottenplatz' }, 'schulweg-check': { ort: 'Charlottenplatz' },
    'apotheken-notdienst': { ort: 'Charlottenplatz' }, 'satelliten-ueberflug': { ort: 'Charlottenplatz' },
    'haushalt-transparenz': {}, 'datenqualitaet': { ort: 'Charlottenplatz' }, 'strassen-ranking': {},
  };
  let ok = 0;
  const liveList = FEATURES.filter((f) => f.status === 'live');
  for (const f of liveList) {
    try {
      const r = await runFeature(f.id, defaults[f.id] ?? {});
      console.log(` ✓ ${f.id} (${r.blocks.length} Blöcke, ${r.durationMs} ms)`);
      ok++;
    } catch (e) {
      console.error(` ✗ ${f.id}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`\nWerkzeuge lauffähig: ${ok}/${liveList.length}`);
}
