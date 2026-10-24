// Kleiner, abhängigkeitsfreier CSV-Leser für die offenen Datensätze der Stadt.
// Die Dateien sind semikolon- oder kommagetrennt, enthalten Anführungszeichen und
// gelegentlich ein UTF-8-BOM. Für die Anzeige reichen die ersten Zeilen; große
// Bestände werden bewusst nur ausschnittsweise ausgeliefert.

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/** Ermittelt das Trennzeichen aus der Kopfzeile. */
export function detectDelimiter(text) {
  const line = String(text ?? '').split(/\r?\n/, 1)[0] ?? '';
  const candidates = [';', ',', '\t', '|'];
  let best = ';';
  let score = -1;
  for (const d of candidates) {
    const n = line.split(d).length - 1;
    if (n > score) { best = d; score = n; }
  }
  return score > 0 ? best : ';';
}

/** Zerlegt eine CSV-Zeile unter Beachtung von Anführungszeichen. */
function parseLine(line, delimiter) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Liest CSV-Text in Spalten und Zeilenobjekte.
 * @returns {{columns: string[], rows: Record<string,string>[], delimiter: string}}
 */
export function parseCsv(input, { delimiter, maxRows = 5000 } = {}) {
  const text = stripBom(String(input ?? '')).replace(/\r\n?/g, '\n');
  const sep = delimiter || detectDelimiter(text);
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (!lines.length) return { columns: [], rows: [], delimiter: sep };
  const columns = parseLine(lines[0], sep).map((c, i) => c || `Spalte ${i + 1}`);
  const rows = [];
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    const values = parseLine(lines[i], sep);
    if (values.every((v) => v === '')) continue;
    const row = {};
    for (let j = 0; j < columns.length; j++) row[columns[j]] = values[j] ?? '';
    rows.push(row);
  }
  return { columns, rows, delimiter: sep };
}

/** Wandelt eine Zahl im deutschen oder englischen Format um; leer = null. */
export function num(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Erkennt Jahres-/Datumsangaben in einer Spalte. */
export function looksLikeYear(value) {
  return /^(19|20)\d{2}$/.test(String(value ?? '').trim());
}

/** Sortiert Spalten in eine gewünschte Reihenfolge, ohne andere zu verlieren. */
export function orderColumns(columns, first = []) {
  const set = new Set(columns);
  return [...first.filter((c) => set.has(c)), ...columns.filter((c) => !first.includes(c))];
}
