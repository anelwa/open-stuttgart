#!/usr/bin/env node
// Prüft das Kontaktregister auf Vollständigkeit und offensichtliche Datenfehler.
// Aufruf: npm run check:kontakte
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DB = `${ROOT}/server/data/suche.sqlite`;
const WICHTIG = `${ROOT}/src/data/kontakte-wichtig.json`;

if (!existsSync(DB)) {
  console.error(`Kontaktregister fehlt: ${DB}. Zuerst npm run data:search ausführen.`);
  process.exit(1);
}

const db = new DatabaseSync(DB, { readOnly: true });
try {
  db.prepare('SELECT count(*) FROM contacts').get();
} catch {
  console.error('Die Datenbank enthält noch kein Kontaktregister. Bitte npm run data:search ausführen.');
  process.exit(1);
}
const problems = [];
const warnings = [];

const total = db.prepare('SELECT count(*) AS n FROM contacts').get().n;
const fts = db.prepare('SELECT count(*) AS n FROM contacts_fts').get().n;
if (total !== fts) problems.push(`contacts (${total}) und contacts_fts (${fts}) sind nicht deckungsgleich.`);

const emptyName = db.prepare("SELECT count(*) AS n FROM contacts WHERE trim(name) = ''").get().n;
if (emptyName) problems.push(`${emptyName} Kontakte ohne Namen.`);

const noDoc = db.prepare('SELECT count(*) AS n FROM contacts WHERE document_id IS NULL').get().n;
if (noDoc) warnings.push(`${noDoc} Kontakte ohne verknüpftes Dokument (nur redaktionelle Einträge sollten das sein).`);

const unreachable = db.prepare(`SELECT count(*) AS n FROM contacts
  WHERE phones_json = '[]' AND (email IS NULL OR email = '') AND (url IS NULL OR url = '')`).get().n;
if (unreachable) warnings.push(`${unreachable} Kontakte ohne Telefon, E-Mail und URL.`);

let curated = [];
try {
  curated = JSON.parse(readFileSync(WICHTIG, 'utf8')).items ?? [];
} catch (e) {
  problems.push(`Wichtige Kontakte nicht lesbar: ${e.message}`);
}

const byId = db.prepare('SELECT id FROM contacts WHERE id = ?');
const seen = new Set();
for (const item of curated) {
  if (!item.id || !item.name) { problems.push('Redaktioneller Eintrag ohne id/name.'); continue; }
  if (seen.has(item.id)) problems.push(`${item.id}: doppelte ID in kontakte-wichtig.json.`);
  seen.add(item.id);
  if (!byId.get(item.id)) problems.push(`${item.id}: fehlt in der Datenbank (npm run data:search?).`);
  if (!item.sourceUrl) problems.push(`${item.id}: sourceUrl fehlt.`);
  if (!item.checked) problems.push(`${item.id}: Prüfdatum fehlt.`);
  if (!(item.phones ?? []).length && !item.url) problems.push(`${item.id}: weder Telefon noch URL.`);
  const ageDays = item.checked ? (Date.now() - Date.parse(item.checked)) / 86_400_000 : null;
  if (ageDays != null && ageDays > 365) warnings.push(`${item.id}: Prüfdatum ist älter als ein Jahr (${item.checked}).`);
}

const badPhones = db.prepare(`SELECT id, phones_json FROM contacts WHERE phones_json != '[]'`).all()
  .filter((row) => {
    try {
      const phones = JSON.parse(row.phones_json);
      return !Array.isArray(phones) || phones.some((p) => !p?.number || !/\d{3,}/.test(String(p.number)));
    } catch { return true; }
  });
if (badPhones.length) problems.push(`${badPhones.length} Kontakte mit ungültigem phones_json.`);

const coverage = db.prepare(`SELECT
  sum(CASE WHEN phones_json != '[]' THEN 1 ELSE 0 END) AS telefon,
  sum(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS email,
  sum(CASE WHEN hours_json != '[]' THEN 1 ELSE 0 END) AS zeiten
  FROM contacts`).get();
const byKind = db.prepare('SELECT kind, count(*) AS n FROM contacts GROUP BY kind ORDER BY n DESC').all();

console.log(`Kontakte: ${total}`);
console.log(`Abdeckung: ${coverage.telefon} mit Telefon, ${coverage.email} mit E-Mail, ${coverage.zeiten} mit Öffnungszeiten`);
console.log(`Arten: ${byKind.map((r) => `${r.kind} ${r.n}`).join(', ')}`);
console.log(`Redaktionell geprüft: ${curated.length}`);

if (warnings.length) {
  console.warn(`\nHinweise (${warnings.length}):`);
  for (const w of warnings) console.warn(`- ${w}`);
}
if (problems.length) {
  console.error(`\nFehler (${problems.length}):`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log('\nKontaktregister ist konsistent.');
