// Prüft die wichtigsten StuttBot-Gespräche ohne Gemini-Key (deterministischer Pfad).
// Aufruf: node scripts/bot-eval.mjs
// Die Fälle brauchen Netz für Wartezeit und Route; ohne Netz greift die Schätzung.

import { botReply, runBotTool } from '../server/sources/bot.mjs';

const ort = (lat, lon, label) => ({ lat, lon, label });

const CASES = [
  {
    name: 'Personalausweis, abgelaufen, 34, Möhringen',
    steps: [
      { message: 'Ich will einen Personalausweis beantragen' },
      { message: 'abgelaufen' },
      { message: '34' },
      { location: ort(48.7261, 9.1451, 'Möhringen') },
    ],
    expect: ['Personalausweis', 'Bürgerbüro', 'Termin'],
  },
  {
    name: 'Wohnsitz anmelden, neu in Stuttgart, Leonhardstraße',
    steps: [
      { message: 'Ich möchte meinen Wohnsitz anmelden' },
      { message: 'Ich bin neu in Stuttgart' },
      { message: 'Leonhardstraße 10' },
    ],
    expect: ['Wohnsitz', 'Bürgerbüro'],
  },
  {
    name: 'Führungszeugnis',
    steps: [{ message: 'Ich brauche ein Führungszeugnis' }],
    expect: ['Führungszeugnis', 'Online'],
  },
  {
    name: 'Kita-Platz',
    steps: [{ message: 'Kita-Platz für mein Kind' }],
    expect: ['Kindertageseinrichtung'],
  },
  {
    name: 'Unbekanntes Anliegen wird nicht falsch beantwortet',
    steps: [{ message: 'Wie hoch ist die Hundesteuer?' }],
    expect: ['nicht sicher zuordnen'],
  },
  {
    name: 'Termin ohne Anliegen',
    steps: [{ message: 'Ich brauche einen Termin' }],
    expect: ['worum es geht'],
  },
];

let failed = 0;
for (const [i, c] of CASES.entries()) {
  const sessionId = `eval-bot-${i}-${Date.now()}`;
  let last = null;
  const t0 = Date.now();
  for (const step of c.steps) {
    last = await botReply({
      sessionId,
      message: step.message ?? '',
      location: step.location ?? null,
      ip: '127.0.0.1',
    });
  }
  const haystack = `${last?.reply ?? ''} ${last?.office?.name ?? ''}`;
  const ok = c.expect.every((needle) => haystack.toLowerCase().includes(needle.toLowerCase()));
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.name} (${Date.now() - t0} ms)`);
  if (!ok) {
    console.log(`      erwartet: ${c.expect.join(', ')}`);
    console.log(`      bekommen: ${last?.reply ?? '—'}`);
  }
}

// Werkzeug-Regressionen: Diese Fehler waren in der Oberfläche sichtbar und
// sollen nicht wieder unbemerkt zurückkommen.
const checks = [];
{
  const cafe = await runBotTool('naehe', { kategorie: 'Cafe' });
  checks.push({
    name: 'Café-Suche bleibt bei Cafés (nicht Restaurants)',
    ok: cafe.facts?.kategorie === 'Cafés' && (cafe.facts?.anzahl ?? 0) > 0,
    got: `${cafe.facts?.kategorie ?? '—'} (${cafe.facts?.anzahl ?? 0})`,
  });
}
{
  const migration = await runBotTool('suche_leistung', { query: 'Aufschiebung der Abschiebung' });
  const names = [
    ...(migration.facts?.treffer ?? []).map((x) => x.name),
    ...(migration.facts?.stellen ?? []).map((x) => x.name),
  ].join(' ');
  checks.push({
    name: 'Aufenthaltsrecht liefert Duldung/Ausländerbehörde statt Füllwort-Treffer',
    ok: /Chancen-Aufenthaltsrecht|Aufenthaltstitel|Ausländerrecht/i.test(names),
    got: names.slice(0, 120) || 'keine Treffer',
  });
}
for (const c of checks) {
  if (!c.ok) failed += 1;
  console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}`);
  if (!c.ok) console.log(`      bekommen: ${c.got}`);
}

console.log(`\n${CASES.length + checks.length - failed}/${CASES.length + checks.length} Fälle bestanden.`);
process.exitCode = failed ? 1 : 0;
