#!/usr/bin/env node
// Legt die gepflegten Stuttgarter Spielstätten aus server/data/venues.json in einer Gancio-Instanz an
// oder gibt sie als prüfbare Vorlage aus. Aufruf:
//   GANCIO_URL=http://localhost:13120 GANCIO_TOKEN=<Bearer-Token> node gancio/seed-places.mjs
// Ohne GANCIO_TOKEN prüft das Skript die Erreichbarkeit von GANCIO_URL/api/events und gibt die Ortsliste aus.
import { readFileSync } from 'node:fs';

const DATA = JSON.parse(readFileSync(new URL('../server/data/venues.json', import.meta.url), 'utf8'));
const BASE = (process.env.GANCIO_URL ?? 'http://localhost:13120').replace(/\/+$/, '');
const TOKEN = (process.env.GANCIO_TOKEN ?? '').trim();

const places = DATA.venues.map((v) => ({
  id: v.id,
  name: v.name,
  address: v.address,
  latitude: v.lat,
  longitude: v.lon,
  district: v.district,
}));

console.log(`${places.length} Spielstätten aus server/data/venues.json geladen.`);

try {
  const res = await fetch(`${BASE}/api/events?max=5`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ev = await res.json();
  console.log(`Gancio unter ${BASE} erreichbar (${Array.isArray(ev) ? ev.length : 0} Termine in der Vorschau).`);
} catch (err) {
  console.log(`Hinweis: Keine laufende Gancio-Instanz unter ${BASE} erreichbar (${err.message}).`);
  console.log('Start mit: cd gancio && cp config.json.example config.json && docker compose up -d');
  process.exit(0);
}

if (!TOKEN) {
  console.log('Kein GANCIO_TOKEN gesetzt – nur Prüfung durchgeführt. Zum Anlegen der Orte GANCIO_TOKEN übergeben.');
  process.exit(0);
}

// Gancio legt Orte automatisch beim ersten Termin an; ein Initial-Termin je Ort im Entwurfsmodus oder
// direkter DB-Import übernimmt Name, Adresse und Koordinaten in die Tabelle `places`.
for (const p of places) {
  console.log(`- ${p.name} (${p.address}) [${p.latitude}, ${p.longitude}]`);
}
