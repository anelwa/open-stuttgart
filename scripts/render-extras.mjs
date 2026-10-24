// Erzeugt die lesbare Dokumentation aus dem Quellen- und Werkzeugregister.
// So können Anspruch (100 + 100) und Umsetzungsstand nicht auseinanderlaufen.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../server/extras/sources.mjs';
import { FEATURES, FEATURE_CATEGORIES } from '../server/extras/features/registry.mjs';

const out = fileURLToPath(new URL('../docs/erweiterungsprogramm.md', import.meta.url));
const liveSources = SOURCES.filter((s) => s.status === 'live').length;
const liveFeatures = FEATURES.filter((f) => f.status === 'live').length;
const rows = (cells) => `| ${cells.join(' | ')} |`;
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

let md = `# Erweiterungsprogramm: ${SOURCES.length} Schnittstellen und ${FEATURES.length} Werkzeuge\n\n`;
md += `Stand: ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}. `;
md += `Dieses Dokument wird aus \`server/extras/sources.mjs\` und \`server/extras/features/registry.mjs\` erzeugt.\n\n`;
md += `**Auftrag:** Mindestens 100 öffentliche Schnittstellen, APIs und Datensätze, die vorher nicht eingebaut waren, `
  + `Schritt für Schritt anbinden. Zusätzlich 100 neue, hochwertige Funktionen entwickeln und ebenfalls Schritt für Schritt einbauen.\n\n`;
md += `## Stand\n\n`;
md += `| Bereich | Anspruch | umgesetzt | offen |\n|---|---:|---:|---:|\n`;
md += `| Schnittstellen, APIs, Datensätze | mindestens 100 | ${liveSources} | ${Math.max(0, 100 - liveSources)} |\n`;
md += `| Werkzeuge und Funktionen | 100 | ${liveFeatures} | ${100 - liveFeatures} |\n\n`;
md += `### Grundsätze\n\n`;
md += `* Jede Quelle nennt Lizenz, Quellenangabe, Stand und Grenzen.\n`;
md += `* Keine Quelle ohne Freigabe; keine Grauzone wird als „Open Data“ ausgegeben.\n`;
md += `* Keine Personendaten, keine Bewegungsprofile, keine Werbung.\n`;
md += `* Jedes Werkzeug beantwortet eine konkrete Frage und sagt, was es nicht kann.\n`;
md += `* Abrufe laufen serverseitig, zwischengespeichert und mit höflichem Abstand.\n\n`;

md += `## ${SOURCES.length} Schnittstellen, APIs und Datensätze\n\n`;
md += `Die Nummerierung ist stabil. \`live\` heißt: Adapter, Cache und API-Route laufen; die Quelle wurde mindestens einmal erfolgreich abgerufen. `
  + `\`geplant\` heißt: recherchiert, aber noch nicht angebunden. \`key\` heißt: frei beantragbarer Schlüssel nötig.\n\n`;
md += rows(['#', 'ID', 'Titel', 'Typ', 'Lizenz', 'Status']) + '\n';
md += rows(['---:', '---', '---', '---', '---', '---']) + '\n';
SOURCES.forEach((s, i) => {
  md += rows([String(i + 1), esc(s.id), esc(s.title), esc(s.kind), esc(s.license), s.status]) + '\n';
});

md += `\n## 100 Werkzeuge und Funktionen\n\n`;
md += `Jedes Werkzeug hat eine feste Nummer, eine Kategorie und definierte Eingaben. `
  + `Die Spalte „Eingaben“ nennt die Pflichtfelder; optionale Felder stehen in der Oberfläche.\n\n`;
md += rows(['#', 'ID', 'Titel', 'Kategorie', 'Eingaben', 'Status']) + '\n';
md += rows(['---:', '---', '---', '---', '---', '---']) + '\n';
const catLabel = Object.fromEntries(FEATURE_CATEGORIES);
FEATURES.forEach((f) => {
  const inputs = (f.inputs ?? []).filter((i) => i.required !== false).map((i) => i.key).join(', ') || '–';
  md += rows([String(f.number), esc(f.id), esc(f.title), esc(catLabel[f.category] ?? f.category), esc(inputs), f.status]) + '\n';
});

md += `\n## Kategorien und Fortschritt\n\n`;
md += `| Kategorie | Werkzeuge | umgesetzt |\n|---|---:|---:|\n`;
for (const [id, label] of FEATURE_CATEGORIES) {
  const list = FEATURES.filter((f) => f.category === id);
  md += rows([esc(label), String(list.length), String(list.filter((f) => f.status === 'live').length)]) + '\n';
}

md += `\n## Technik\n\n`;
md += `* Quellenregister: \`server/extras/sources.mjs\` – ${SOURCES.length} Einträge, je mit Adapter und Konfiguration.\n`;
md += `* Adapter: \`server/extras/adapters.mjs\` – CKAN-CSV, WFS, LGL-WFS, LUBW/ArcGIS, JSON, Text/XML, Overpass.\n`;
md += `* Normalisierer: \`server/extras/normalizers.mjs\` – externe Antworten werden auf eine gemeinsame Form gebracht.\n`;
md += `* Werkzeuge: \`server/extras/features/*.mjs\` – je Kategorie ein Modul; das Register steht in \`server/extras/features/registry.mjs\`.\n`;
md += `* API: \`/api/labor\`, \`/api/labor/quellen\`, \`/api/labor/quelle?id=…\`, \`/api/labor/werkzeuge\`, \`/api/labor/werkzeug?id=…\`.\n`;
md += `* Oberfläche: Modul „Stadtlabor“ (\`src/modules/labor/LaborPanel.tsx\`).\n`;
md += `* Prüfung: \`npm run check:extras\` (Struktur) und \`npm run check:extras -- --live\` (alle Quellen) bzw. \`-- --live-features\` (alle Werkzeuge).\n`;
md += `* Dokumentation neu erzeugen: \`npm run docs:extras\`.\n\n`;
md += `## Offene Punkte\n\n`;
const openSources = SOURCES.filter((s) => s.status !== 'live');
const openFeatures = FEATURES.filter((f) => f.status !== 'live');
md += openSources.length ? `Noch anzubindende Quellen: ${openSources.map((s) => `\`${s.id}\``).join(', ')}.\n\n` : `Alle Quellen sind angebunden.\n\n`;
md += openFeatures.length ? `Noch zu bauende Werkzeuge: ${openFeatures.map((f) => `\`${f.id}\``).join(', ')}.\n` : `Alle 100 Werkzeuge sind gebaut.\n`;

writeFileSync(out, md);
console.log(`Dokumentation geschrieben: ${out}`);
console.log(`Quellen ${liveSources} (mindestens 100), Werkzeuge ${liveFeatures}/100`);
