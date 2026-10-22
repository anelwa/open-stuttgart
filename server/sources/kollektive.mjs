// Kollektive und freie Reihen: kuratierte Stammliste plus Erkennung in Terminen.
// Keine Personen, keine Instagram-Profile, keine automatische Übernahme von Biografien.
// Ein Kollektiv ist ein Veranstalter, kein Ort: Es kann in wechselnden Clubs und Off-Spaces auftreten.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = process.env.OS_KOLLEKTIVE ?? fileURLToPath(new URL('../data/kollektive.json', import.meta.url));
let cache = null;

export function kollektive() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'));
    cache = (raw.items ?? []).filter((x) => x && x.id && x.name).map((x) => ({
      id: x.id,
      name: x.name,
      aliases: [...new Set([x.name, ...(x.aliases ?? [])].filter(Boolean))],
      szene: x.szene ?? null,
      genre: x.genre ?? null,
      url: x.url ?? null,
      festerOrtVenueId: x.festerOrtVenueId ?? null,
    }));
  } catch {
    cache = [];
  }
  return cache;
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Kuratierter Treffer im Text (Titel, Untertitel, Veranstalter). */
export function matchCollective(...texts) {
  const hay = ` ${norm(texts.filter(Boolean).join(' '))} `;
  for (const k of kollektive()) {
    for (const alias of k.aliases) {
      const n = norm(alias);
      if (n.length >= 3 && hay.includes(` ${n} `)) return { id: k.id, name: k.name, url: k.url, szene: k.szene };
    }
  }
  return null;
}

const STOP = new Set(['der', 'die', 'das', 'den', 'dem', 'des', 'und', 'mit', 'von', 'fur', 'für', 'the', 'and', 'presents', 'presented', 'hosted', 'by', 'stuttgart', 'club', 'party', 'konzert', 'live', 'abend', 'nacht']);
/** Freie Reihe aus Formulierungen wie „präsentiert von …“, „hosted by …“ oder „A × B“. */
export function extractCollective(title, teaser, performer) {
  const text = [title, teaser, performer].filter(Boolean).join(' · ');
  const m = /(?:präsentiert\s+von|presented\s+by|hosted\s+by|curated\s+by|×|präsentiert:)\s*([A-ZÄÖÜ][\p{L}\d&'’.\-]*(?:\s+[A-ZÄÖÜ][\p{L}\d&'’.\-]*){0,3})/u.exec(text);
  if (!m) return null;
  const name = m[1].trim().replace(/[.,;:]+$/, '');
  if (name.length < 3 || STOP.has(norm(name))) return null;
  const id = slug(name);
  if (!id || id.length < 3) return null;
  return { id, name, url: null, szene: 'frei' };
}

/** Alle Kollektive, die in einer Terminliste vorkommen (für Filter und Anzeige). */
export function collectivesFromEvents(events = []) {
  const map = new Map(kollektive().map((k) => [k.id, { id: k.id, name: k.name, url: k.url, szene: k.szene, anzahl: 0 }]));
  for (const e of events) {
    for (const c of [e.collective, ...(e.collectiveTags ?? [])].filter(Boolean)) {
      if (!c.id) continue;
      const cur = map.get(c.id) ?? { id: c.id, name: c.name, url: c.url ?? null, szene: c.szene ?? 'frei', anzahl: 0 };
      cur.anzahl += 1;
      map.set(c.id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de'));
}

/** Gancio-Schlagworte der Form kollektiv:<slug>. */
export function collectiveTags(tags = []) {
  return tags.filter((t) => /^kollektiv:/i.test(String(t))).map((t) => {
    const raw = String(t).slice('kollektiv:'.length).trim();
    const known = kollektive().find((k) => k.id === raw || k.aliases.some((a) => norm(a) === norm(raw)));
    return known
      ? { id: known.id, name: known.name, url: known.url, szene: known.szene }
      : { id: slug(raw), name: raw.replace(/-/g, ' '), url: null, szene: 'frei' };
  }).filter((x) => x.id);
}
