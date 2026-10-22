// Kleiner .env-Loader ohne Abhängigkeiten. Vorhandene Umgebungsvariablen haben
// Vorrang (Docker/Dokploy), die Datei füllt nur fehlende Werte. Die Datei ist
// in .gitignore; der Key wird nie geloggt.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = process.env.OS_ENV_FILE ?? resolve(process.cwd(), '.env');

if (existsSync(file)) {
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
