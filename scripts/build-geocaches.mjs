#!/usr/bin/env node
// Holt den Geocache-Bestand für das Stadtgebiet von Opencaching.de (CC BY-NC-ND 3.0 DE) und
// schreibt ihn nach server/data/geocaches.json. Übernommen werden ausschließlich öffentliche
// Listing-Fakten: Code, Name, Art, Größe, D/T-Wertung, Startkoordinaten und Link zum Listing.
// Keine Final-Koordinaten, keine Beschreibungstexte, keine Spoiler, keine Logs.
//
// Voraussetzung: ein OKAPI-Consumer-Key von https://www.opencaching.de/okapi/ (Eintrag „Apps“),
// gesetzt als OS_OPENCACHING_KEY. Ohne Key wird nur die öffentliche Suchseite gelesen, falls sie
// auswertbare Listings liefert. Abruf höflich: eine Anfrage, Ergebnis wird lokal gespeichert.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../server/data/geocaches.json', import.meta.url));
const CENTER = { lat: 48.779, lon: 9.18 };
const RADIUS_KM = 20;
const KEY = (process.env.OS_OPENCACHING_KEY ?? '').trim();
const UA = 'open-stuttgart/0.2 (nicht kommerzielles Open-Source-Projekt fuer die Stadt Stuttgart)';

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

async function okapi() {
  const fields = 'code|name|type|size|difficulty|terrain|location|url';
  const u = new URL('https://www.opencaching.de/okapi/services/caches/search/nearest');
  u.searchParams.set('center', `${CENTER.lat},${CENTER.lon}`);
  u.searchParams.set('radius', String(RADIUS_KM));
  u.searchParams.set('limit', '1000');
  u.searchParams.set('fields', fields);
  u.searchParams.set('consumer_key', KEY);
  const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`OKAPI antwortet mit ${res.status}`);
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : raw.caches ?? raw.items ?? [];
  return list.map((c) => {
    const [lat, lon] = String(c.location ?? '').split(',').map(Number);
    return {
      id: String(c.code ?? c.waypoint ?? ''),
      code: c.code ?? c.waypoint ?? null,
      name: c.name ?? 'Geocache',
      art: c.type ?? null,
      groesse: c.size ?? null,
      schwierigkeit: num(c.difficulty),
      gelaende: num(c.terrain),
      lat: num(lat),
      lon: num(lon),
      url: c.url ?? (c.code ? `https://www.opencaching.de/viewcache.php?cacheid=${encodeURIComponent(c.code)}` : null),
      kinderwagen: c.kinderwagen ?? null,
      rollstuhl: c.rollstuhl ?? null,
      quelle: 'Opencaching.de',
    };
  }).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
}

const main = async () => {
  if (!KEY) {
    console.error('OS_OPENCACHING_KEY ist nicht gesetzt. OKAPI braucht einen Consumer-Key');
    console.error('(https://www.opencaching.de/okapi/, Abschnitt „Apps“). Ohne Key wird nichts geschrieben.');
    process.exit(1);
  }
  const items = await okapi();
  writeFileSync(OUT, `${JSON.stringify({
    stand: new Date().toISOString().slice(0, 10),
    quelle: 'Opencaching.de (OKAPI)',
    lizenz: 'CC BY-NC-ND 3.0 DE (Opencaching.de); übernommen werden ausschließlich öffentliche Listing-Fakten und der Link zum Listing',
    items,
  }, null, 1)}\n`);
  console.log(`${items.length} Geocaches nach ${OUT} geschrieben (nur Startkoordinaten und Listing-Fakten).`);
};

main().catch((e) => { console.error(e.message); process.exit(1); });
