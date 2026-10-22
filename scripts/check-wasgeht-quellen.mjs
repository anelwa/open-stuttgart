// Prüft alle Quellen des Moduls „Was geht“ und zeigt je Quelle Anzahl, Alter und Fehler.
// Aufruf: npm run check:wasgeht
// Sinnvoll nach dem Anlegen neuer Hausseiten-Parser und als täglicher Betriebscheck.
import { szeneQuellen } from '../server/sources/wasgeht/termine.mjs';

const rows = await szeneQuellen(120_000);
let problems = 0;
for (const { q, items, at, ok, error, off } of rows) {
  const age = at ? `${Math.round((Date.now() - at) / 60_000)} min` : '–';
  const state = off ? 'aus' : ok ? 'ok' : 'FEHLER';
  if (!off && !ok) problems += 1;
  console.log(`${state.padEnd(7)} ${String(items.length).padStart(4)}  ${age.padStart(8)}  ${q.name} (${q.id})${error ? ` – ${error}` : ''}`);
}
const total = rows.reduce((n, r) => n + r.items.length, 0);
console.log(`\n${total} Termine aus ${rows.length} Quellen, ${problems} Quelle(n) mit Fehler.`);
// Ohne --strict bleiben einzelne, oft temporäre Quellenfehler sichtbar, brechen aber keinen Lauf ab.
process.exitCode = process.argv.includes('--strict') && problems ? 1 : 0;
