// Auswertung der OpenStreetMap-Öffnungszeiten für die häufigen Formen:
// "Mo-Fr 11:30-14:00,17:30-23:00; Sa 17:00-24:00; Su off", "24/7", Zeiträume über Mitternacht.
// Feiertage (PH), Monatsangaben und Sonderregeln werden nicht ausgewertet; dann gilt "unbekannt".

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
type Span = [number, number]; // Minuten ab Wochenbeginn (Montag 0:00)

function parse(oh: string): Span[] | null {
  const s = oh.trim();
  if (s === '24/7') return [[0, 7 * 1440]];
  if (/PH|SH|[A-Z][a-z]{2} \d|week|sunrise|sunset|\[|"|easter|\d{4}/.test(s.replace(/PH off|SH off/g, ''))) return null;
  const spans: Span[] = [];
  for (const rule of s.split(';').map((r) => r.trim()).filter(Boolean)) {
    const r = rule.replace(/,\s*PH off|PH off|SH off/g, '').trim();
    if (!r) continue;
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?\s*)+)?\s*(.*)$/.exec(r);
    if (!m) return null;
    const days = new Set<number>();
    if (m[1]) {
      for (const part of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        const [a, b] = part.split('-').map((d) => DAYS.indexOf(d));
        if (a < 0) return null;
        if (b == null || Number.isNaN(b)) days.add(a);
        else for (let i = a; ; i = (i + 1) % 7) { days.add(i); if (i === b) break; }
      }
    } else for (let i = 0; i < 7; i++) days.add(i);
    const times = m[2].trim();
    // spätere Regeln überschreiben frühere für dieselben Tage
    for (let i = spans.length - 1; i >= 0; i--) if (days.has(Math.floor(spans[i][0] / 1440))) spans.splice(i, 1);
    if (!times || /^(off|closed)$/.test(times)) continue;
    for (const t of times.split(',').map((x) => x.trim())) {
      const tm = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/.exec(t);
      if (!tm) return null;
      const from = +tm[1] * 60 + +tm[2];
      let to = +tm[3] * 60 + +tm[4];
      if (to <= from) to += 1440;
      for (const d of days) spans.push([d * 1440 + from, d * 1440 + to]);
    }
  }
  return spans;
}

const weekMinute = (d: Date) => ((d.getDay() + 6) % 7) * 1440 + d.getHours() * 60 + d.getMinutes();
const hm = (min: number) => { const m = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** Zustand jetzt: offen bis …, öffnet um …, oder null wenn nicht auswertbar. */
export function openState(oh: string | null | undefined, now = new Date()): { open: boolean; text: string } | null {
  if (!oh) return null;
  const spans = parse(oh);
  if (!spans) return null;
  const w = weekMinute(now);
  const all = spans.flatMap(([a, b]) => [[a, b], [a - 7 * 1440, b - 7 * 1440], [a + 7 * 1440, b + 7 * 1440]] as Span[]);
  const cur = all.find(([a, b]) => w >= a && w < b);
  if (cur) return { open: true, text: cur[1] - cur[0] >= 7 * 1440 ? 'durchgehend geöffnet' : `geöffnet bis ${cur[1] % 1440 === 0 ? '24:00' : hm(((cur[1] % 1440) + 1440) % 1440)} Uhr` };
  const next = all.filter(([a]) => a > w).sort((x, y) => x[0] - y[0])[0];
  if (!next) return { open: false, text: 'geschlossen' };
  const day = Math.floor(((next[0] % (7 * 1440)) + 7 * 1440) % (7 * 1440) / 1440);
  const today = Math.floor(w / 1440);
  const when = day === today && next[0] - w < 1440 ? '' : day === (today + 1) % 7 ? 'morgen ' : `${DE[day]} `;
  return { open: false, text: `geschlossen, öffnet ${when}um ${hm(next[0])} Uhr` };
}

/** OSM-Öffnungszeiten lesbar: eine Zeile je Regel, Wochentage deutsch. */
export function ohLines(oh: string): [string, string][] {
  if (oh.trim() === '24/7') return [['täglich', 'durchgehend']];
  return oh.split(';').map((r) => r.trim()).filter(Boolean).map((r) => {
    const m = /^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?\s*)+)\s*(.*)$/.exec(r);
    const de = (d: string) => d.replace(/Mo|Tu|We|Th|Fr|Sa|Su|PH/g, (x) => (x === 'PH' ? 'Feiertag' : DE[DAYS.indexOf(x)])).replace(/-/g, ' bis ').replace(/,\s*/g, ', ');
    const t = (x: string) => x.replace(/\b(off|closed)\b/, 'geschlossen').replace(/,/g, ', ').replace(/(\d)-(\d)/g, '$1 bis $2');
    return m ? [de(m[1].trim()), t(m[2].trim()) || 'geöffnet'] : ['', t(r)];
  });
}
