// Rauchtest für den Umland-Datensatz und die API-Aufbereitung.
// Prüft Struktur, Koordinaten, Kategorien, Kreise und die abgeleiteten Antworten,
// ohne Netzwerkzugriffe. Mit --urls werden zusätzlich Bild-URLs geprüft.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KATEGORIEN, KREISE, umlandGeoJson, umlandMeta, umlandZiele } from '../server/sources/umland.mjs';

const FILE = fileURLToPath(new URL('../server/data/umland-ziele.json', import.meta.url));
const data = JSON.parse(readFileSync(FILE, 'utf8'));
const checkUrls = process.argv.includes('--urls');
let pass = 0;
const ok = (name, fn) => {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
};

console.log('Umland-Rauchtest');

ok('Datensatz: Titel, Stand und Ziele vorhanden', () => {
  assert.equal(typeof data.titel, 'string');
  assert.match(data.stand, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(data.ziele));
  assert.ok(data.ziele.length >= 20, `nur ${data.ziele.length} Ziele`);
});

ok('Ziele: Pflichtfelder, eindeutige IDs, gültige Kategorien und Kreise', () => {
  const ids = new Set();
  const pflicht = ['id', 'name', 'kategorie', 'kreis', 'gemeinde', 'lat', 'lon', 'kurz', 'beschreibung', 'highlights', 'dauerMin', 'preis', 'saison', 'familie', 'stand', 'quelle'];
  for (const z of data.ziele) {
    for (const f of pflicht) assert.ok(z[f] != null && z[f] !== '', `${z.id}: ${f} fehlt`);
    assert.ok(!ids.has(z.id), `doppelte ID: ${z.id}`);
    ids.add(z.id);
    assert.ok(KATEGORIEN[z.kategorie], `${z.id}: unbekannte Kategorie ${z.kategorie}`);
    assert.ok(KREISE[z.kreis], `${z.id}: unbekannter Kreis ${z.kreis}`);
    assert.ok(Number.isFinite(z.lat) && z.lat > 48.2 && z.lat < 49.3, `${z.id}: lat`);
    assert.ok(Number.isFinite(z.lon) && z.lon > 8.3 && z.lon < 10.0, `${z.id}: lon`);
    assert.ok(Array.isArray(z.highlights) && z.highlights.length > 0, `${z.id}: highlights`);
    assert.ok(Number.isInteger(z.dauerMin) && z.dauerMin >= 30 && z.dauerMin <= 600, `${z.id}: dauerMin`);
    if (z.website) assert.match(z.website, /^https:\/\//, `${z.id}: website`);
    if (z.image) assert.match(z.image, /^https:\/\/commons\.wikimedia\.org\//, `${z.id}: image`);
    if (z.imagePage) assert.match(z.imagePage, /^https:\/\/commons\.wikimedia\.org\//, `${z.id}: imagePage`);
  }
});

ok('Alle Kategorien und Kreise sind belegt', () => {
  const kat = new Set(data.ziele.map((z) => z.kategorie));
  const kreis = new Set(data.ziele.map((z) => z.kreis));
  for (const k of Object.keys(KATEGORIEN)) assert.ok(kat.has(k), `Kategorie ohne Ziel: ${k}`);
  for (const k of Object.keys(KREISE)) assert.ok(kreis.has(k), `Kreis ohne Ziel: ${k}`);
});

ok('Meta: Anzahl, Kategorien und Kreise stimmen', () => {
  const m = umlandMeta();
  assert.equal(m.anzahl, data.ziele.length);
  assert.equal(m.kategorien.reduce((n, k) => n + k.anzahl, 0), data.ziele.length);
  assert.equal(m.kreise.reduce((n, k) => n + k.anzahl, 0), data.ziele.length);
  assert.equal(m.kategorien.length, Object.keys(KATEGORIEN).length);
  assert.equal(m.kreise.length, Object.keys(KREISE).length);
});

ok('Liste: Filter und Haltestellen', () => {
  const alle = umlandZiele({});
  assert.equal(alle.total, data.ziele.length);
  assert.equal(alle.items.length, Math.min(60, data.ziele.length));
  const seen = umlandZiele({ kategorie: 'see' });
  assert.ok(seen.total >= 1);
  assert.ok(seen.items.every((z) => z.kategorie === 'see'));
  const nah = umlandZiele({ lat: 48.78, lon: 9.18, r: 30000, limit: 5 });
  assert.ok(nah.total >= 1 && nah.items.length <= 5);
  for (const z of alle.items) {
    assert.ok(Array.isArray(z.naechsteHaltestellen));
    assert.ok(z.naechsteHaltestellen.every((s) => s.dist <= 3000), `${z.id}: Haltestelle zu weit`);
    assert.ok(z.farbe && z.icon && z.kategorieLabel);
  }
});

ok('GeoJSON: eine Punkt-Feature je Ziel', () => {
  const fc = umlandGeoJson();
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc.features.length, data.ziele.length);
  assert.ok(fc.features.every((f) => f.geometry.type === 'Point' && f.geometry.coordinates.length === 2));
  assert.ok(fc.features.every((f) => f.properties.farbe && f.properties.kategorie));
});

if (checkUrls) {
  console.log('  … prüfe Bild-URLs (Netzwerk)');
  for (const z of data.ziele.filter((x) => x.image)) {
    const res = await fetch(z.image, { method: 'HEAD', headers: { 'User-Agent': 'open-stuttgart/0.2 (Datenprüfung)' } });
    if (!res.ok) { console.error(`  ✗ ${z.id}: Bild ${res.status}`); process.exitCode = 1; } else pass += 1;
  }
}

if (process.exitCode) {
  console.error(`\n${pass} Prüfungen bestanden, Fehler gefunden.`);
} else {
  console.log(`\n${pass} Prüfungen bestanden.`);
}
