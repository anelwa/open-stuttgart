// Eigener Verlauf der Live-Werte städtischer Einrichtungen (Bäder, Bürgerbüros).
// Alle 5 Minuten wird der aktuelle Wert gelesen und
//  1. je Wochentag und Viertelstunde gemittelt ("üblich um diese Zeit"),
//  2. als Tagesdatei server/.cache/archiv/JJJJ-MM-TT.csv abgelegt (offenes Archiv, frei weiterverwendbar).
// Abschalten mit OS_VERLAUF=0. Es werden keine personenbezogenen Daten erhoben.
import { appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { diskStore } from '../cache.mjs';

const ARCHIV = fileURLToPath(new URL('../.cache/archiv/', import.meta.url));
mkdirSync(ARCHIV, { recursive: true });
const store = diskStore('verlauf-v1');
const INTERVAL = 5 * 60_000;

const berlin = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, wd: p.weekday.replace('.', ''), hh: p.hour, mm: p.minute };
};
const slotOf = (b) => `${b.wd}-${b.hh}:${String(Math.floor(+b.mm / 15) * 15).padStart(2, '0')}`;

/** Wert einer Messreihe in die Mittelwerte und das Tagesarchiv übernehmen. */
/** Trifft "üblich um diese Zeit" zu? Bürgerbüro: höchstens eine Stufe daneben; Bad: höchstens 10 % der Höchstzahl daneben. */
const hit = (kind, predicted, actual, max) => (kind === 'bb' ? Math.abs(predicted - actual) <= 1 : Math.abs(predicted - actual) <= 0.1 * (max || 1));

function record(kind, id, value, max) {
  if (value == null || !Number.isFinite(value)) return;
  const b = berlin();
  const key = `${kind}:${id}:${slotOf(b)}`;
  // sum/n/d: Messungen früherer Tage (d = Anzahl Tage); tSum/tN: Messungen des Tages "day", die erst am Folgetag einfließen
  let e = store.get(key) ?? { sum: 0, n: 0, d: 0, day: b.day, tSum: 0, tN: 0 };
  if (e.day !== b.day) e = { sum: e.sum + (e.tSum ?? 0), n: e.n + (e.tN ?? 0), d: (e.d ?? 0) + ((e.tN ?? 0) > 0 ? 1 : 0), day: b.day, tSum: 0, tN: 0 };
  // Trefferquote: Mittel der früheren Tage gegen den neuen Messwert prüfen
  if (e.d >= 2) {
    const q = store.get(`quote:${kind}:${b.day}`) ?? { n: 0, hits: 0 };
    store.set(`quote:${kind}:${b.day}`, { n: q.n + 1, hits: q.hits + (hit(kind, e.sum / e.n, value, max) ? 1 : 0) });
  }
  store.set(key, { ...e, tSum: e.tSum + value, tN: e.tN + 1 });
  if (!store.get(`since:${kind}`)) store.set(`since:${kind}`, b.day);
  const file = `${ARCHIV}${b.day}.csv`;
  if (!existsSync(file)) appendFileSync(file, 'zeit,art,id,wert,maximum\n');
  appendFileSync(file, `${new Date().toISOString()},${kind},${id},${value},${max ?? ''}\n`);
}

/** Mittel früherer Tage für die aktuelle Viertelstunde und den Wochentag, sofern Messungen von mindestens zwei Tagen vorliegen. */
const mean = (e, today) => {
  if (!e) return null;
  const sum = e.sum + (e.day !== today ? e.tSum ?? 0 : 0); const n = e.n + (e.day !== today ? e.tN ?? 0 : 0);
  const d = (e.d ?? 0) + (e.day !== today && (e.tN ?? 0) > 0 ? 1 : 0);
  return d >= 2 && n ? { value: Math.round((sum / n) * 10) / 10, n, tage: d } : null;
};
export function usual(kind, id) {
  const b = berlin();
  return mean(store.get(`${kind}:${id}:${slotOf(b)}`), b.day);
}
export const since = (kind) => store.get(`since:${kind}`) ?? null;

/** Trefferquote der letzten 28 Tage für "üblich um diese Zeit". */
export function quote(kind) {
  const cutoff = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
  let n = 0; let hits = 0;
  for (const [k, v] of store.entries()) {
    if (!k.startsWith(`quote:${kind}:`) || k.slice(-10) < cutoff) continue;
    n += v.n; hits += v.hits;
  }
  return n >= 20 ? { anteil: Math.round((hits / n) * 100), n } : null;
}

/** Beste Viertelstunde für den Rest des heutigen Tages (niedrigster Mittelwert), bis "bis" Uhr. */
export function bestToday(kind, id, bis = 18) {
  const b = berlin();
  let best = null;
  for (let h = +b.hh; h < bis; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === +b.hh && m <= +b.mm) continue; // nur kommende Viertelstunden
      const slot = `${b.wd}-${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const mu = mean(store.get(`${kind}:${id}:${slot}`), b.day);
      if (!mu) continue;
      const v = mu.value;
      if (!best || v < best.value) best = { zeit: slot.slice(-5), value: Math.round(v * 10) / 10 };
    }
  }
  return best;
}
export const archivTage = () => readdirSync(ARCHIV).filter((f) => /^\d{4}-\d{2}-\d{2}\.csv$/.test(f)).map((f) => f.slice(0, 10)).sort();
export const archivDatei = (day) => (/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') && existsSync(`${ARCHIV}${day}.csv`) ? `${ARCHIV}${day}.csv` : null);

export function startVerlauf({ baeder, buergerbueros }) {
  if (process.env.OS_VERLAUF === '0') return;
  const tick = async () => {
    try {
      const b = await baeder();
      for (const x of b.items) record('bad', x.id, x.count, x.max);
    } catch { /* nächster Versuch in 5 Minuten */ }
    try {
      const w = await buergerbueros();
      // Status 0 heißt geschlossen: kein Messwert für den Mittelwert
      for (const x of w.items) if (x.status > 0) record('bb', x.id, x.status, 11);
    } catch { /* nächster Versuch in 5 Minuten */ }
  };
  setTimeout(tick, 20_000).unref();
  setInterval(tick, INTERVAL).unref();
}
