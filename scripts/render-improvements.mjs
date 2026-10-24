// Erzeugt die lesbare Liste der 100 Verbesserungen aus dem Register.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IMPROVEMENTS, IMPROVEMENT_CATEGORIES } from '../server/extras/improvements.mjs';

const out = fileURLToPath(new URL('../docs/verbesserungen.md', import.meta.url));
const done = IMPROVEMENTS.filter((x) => x.status === 'done').length;
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = `# 100 Verbesserungen für StuggiAI, Bedienung und Design\n\n`;
md += `Stand: ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}. `;
md += `Diese Liste wird aus \`server/extras/improvements.mjs\` erzeugt.\n\n`;
md += `**Auftrag:** Zusätzlich zu 100 Schnittstellen und 100 Werkzeugen werden 100 Verbesserungen für StuggiAI, User Experience, Design, Barrierefreiheit, Leistung und Inhalt umgesetzt.\n\n`;
md += `## Stand\n\n| Bereich | Anzahl | umgesetzt | offen |\n|---|---:|---:|---:|\n`;
md += `| Verbesserungen | ${IMPROVEMENTS.length} | ${done} | ${IMPROVEMENTS.length - done} |\n\n`;
md += `| Kategorie | Anzahl | umgesetzt |\n|---|---:|---:|\n`;
for (const c of IMPROVEMENT_CATEGORIES) {
  const list = IMPROVEMENTS.filter((x) => x.category === c.id);
  md += `| ${esc(c.label)} | ${list.length} | ${list.filter((x) => x.status === 'done').length} |\n`;
}
md += `\n## Liste\n\n| # | ID | Verbesserung | Kategorie | Status |\n|---:|---|---|---|---|\n`;
const cat = Object.fromEntries(IMPROVEMENT_CATEGORIES.map((c) => [c.id, c.label]));
for (const x of IMPROVEMENTS) {
  md += `| ${x.number} | ${esc(x.id)} | ${esc(x.title)} – ${esc(x.summary)} | ${esc(cat[x.category] ?? x.category)} | ${x.status === 'done' ? 'umgesetzt' : 'offen'} |\n`;
}
md += `\n## Prüfung\n\n\`npm run check:extras\` prüft 101 Quellen, 100 Werkzeuge und 100 Verbesserungen auf Vollständigkeit und eindeutige IDs. `;
md += `Die Verbesserungen sind im Stadtlabor unter „Verbesserungen“ sichtbar; \`/api/labor/verbesserungen\` liefert den Stand maschinenlesbar.\n`;
writeFileSync(out, md);
console.log(`Dokumentation geschrieben: ${out}`);
console.log(`Verbesserungen ${done}/100 umgesetzt`);
