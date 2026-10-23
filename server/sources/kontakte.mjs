// Kontaktregister: strukturierte Anruf-, Mail- und Öffnungszeiten-Daten aus dem
// Verwaltungs-Crawl plus redaktionell geprüfte Notrufe und Notdienste.
// Die Datenbank wird mit `npm run data:search` aus src/data/kontakte-wichtig.json
// und server/data/verwaltung.sqlite erzeugt. Keine externen Anfragen.
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const FILE = process.env.OS_SEARCH_DB ?? fileURLToPath(new URL('../data/suche.sqlite', import.meta.url));
const SYNONYME_FILE = fileURLToPath(new URL('../../src/data/kontakte-synonyme.json', import.meta.url));
let SYNONYME = [];
try {
  SYNONYME = JSON.parse(readFileSync(SYNONYME_FILE, 'utf8'));
} catch { /* Suche bleibt wörtlich */ }
let db = null;
let initError = null;

function open() {
  if (db) return db;
  if (initError) throw initError;
  if (!existsSync(FILE)) {
    initError = Object.assign(new Error('Kontaktregister fehlt. Bitte „npm run data:search“ ausführen.'), { status: 503 });
    throw initError;
  }
  try {
    db = new DatabaseSync(FILE, { readOnly: true });
    db.prepare('SELECT count(*) FROM contacts').get();
    return db;
  } catch (e) {
    initError = Object.assign(new Error(`Kontaktregister nicht lesbar: ${e.message}`), { status: 503 });
    throw initError;
  }
}

export const KONTAKT_KIND_LABEL = {
  notruf: 'Notruf',
  notdienst: 'Notdienst',
  beratung: 'Beratung',
  technik: 'Technischer Dienst',
  tier: 'Tiernotdienst',
  behoerde: 'Behörde',
  buergerbuero: 'Bürgerbüro',
  bildung: 'Bildung',
  dienststelle: 'Dienststelle',
};

const GRUPPEN = {
  notfall: { label: 'Notfall & Gesundheit', kinds: ['notruf', 'notdienst'] },
  aemter: { label: 'Ämter & Behörden', kinds: ['behoerde', 'buergerbuero', 'dienststelle', 'bildung'] },
  beratung: { label: 'Beratung & Hilfe', kinds: ['beratung'] },
  alltag: { label: 'Technik & Tiere', kinds: ['technik', 'tier'] },
};

function ftsQuery(q) {
  const tokens = (String(q ?? '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).slice(0, 10);
  if (!tokens.length) return null;
  const expanded = new Set();
  for (const token of tokens) {
    const rules = SYNONYME.filter((rule) => (rule.begriffe ?? []).includes(token));
    if (rules.length) {
      // Der Alltagsbegriff ersetzt die wörtliche Suche: „Müll“ soll Abfall finden,
      // nicht jede Statue mit dem Namen „Müller“.
      for (const rule of rules) for (const treffer of rule.treffer ?? []) expanded.add(treffer);
    } else {
      expanded.add(token);
    }
  }
  return [...expanded].slice(0, 24).map((t) => `"${t.replace(/"/g, '')}"*`).join(' OR ');
}

function parsePhones(json) {
  try {
    const rows = JSON.parse(json ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows
      .map((p) => ({
        label: String(p?.label ?? 'Telefon'),
        number: String(p?.number ?? '').trim(),
        tel: String(p?.number ?? '').replace(/[^\d+]/g, ''),
      }))
      .filter((p) => p.number);
  } catch { return []; }
}

function parseHours(json) {
  try {
    const rows = JSON.parse(json ?? '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

function addressOf(row) {
  return [row.street, [row.postal_code, row.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function mapContact(row, services = []) {
  const address = addressOf(row);
  return {
    id: row.id,
    documentId: row.document_id != null ? Number(row.document_id) : null,
    kind: row.kind,
    kindLabel: KONTAKT_KIND_LABEL[row.kind] ?? row.kind,
    name: row.name,
    organization: row.organization ?? null,
    category: row.category ?? null,
    description: row.description ?? null,
    street: row.street ?? null,
    postalCode: row.postal_code ?? null,
    city: row.city ?? null,
    district: row.district ?? null,
    address: address || null,
    lat: row.lat != null ? Number(row.lat) : null,
    lon: row.lon != null ? Number(row.lon) : null,
    buildingId: row.building_id ?? null,
    phones: parsePhones(row.phones_json),
    email: row.email ?? null,
    url: row.url ?? null,
    booking: row.booking ?? null,
    hours: parseHours(row.hours_json),
    hoursText: row.hours_text ?? null,
    availability: row.availability ?? null,
    priority: Number(row.priority) || 0,
    emergency: !!row.emergency,
    source: row.source,
    sourceUrl: row.source_url ?? null,
    checkedAt: row.checked_at ?? null,
    confidence: row.confidence ?? 'abgeleitet',
    services,
  };
}

function servicesFor(d, ids) {
  if (!ids.length) return new Map();
  const rows = d.prepare(`SELECT contact_id,name,url,online,document_id
    FROM contact_services WHERE contact_id IN (${ids.map(() => '?').join(',')})
    ORDER BY contact_id, ord`).all(...ids);
  const map = new Map();
  for (const r of rows) {
    let list = map.get(r.contact_id);
    if (!list) { list = []; map.set(r.contact_id, list); }
    list.push({ name: r.name, url: r.url, online: !!r.online, documentId: r.document_id != null ? Number(r.document_id) : null });
  }
  return map;
}

function gruppeOfKind(kind) {
  for (const [id, g] of Object.entries(GRUPPEN)) {
    if (g.kinds.includes(kind)) return id;
  }
  return 'aemter';
}

/** Suche im Kontaktregister; ohne Anfrage die wichtigsten Einträge zuerst. */
export function kontakteSuche({ q = '', kind = null, gruppe = null, limit = 30, offset = 0 } = {}) {
  const d = open();
  const query = String(q ?? '').trim();
  const lim = Math.min(100, Math.max(1, Number(limit) || 30));
  const off = Math.max(0, Math.min(5000, Number(offset) || 0));
  const kindFilter = /^[a-z_]{2,30}$/.test(String(kind ?? '')) ? String(kind) : null;
  const groupFilter = gruppe && GRUPPEN[gruppe] ? GRUPPEN[gruppe] : null;
  const kinds = kindFilter ? [kindFilter] : groupFilter?.kinds ?? null;
  const kindSql = kinds ? `AND c.kind IN (${kinds.map(() => '?').join(',')})` : '';
  const match = ftsQuery(query);

  if (!match) {
    const rows = d.prepare(`SELECT c.* FROM contacts c
      WHERE 1=1 ${kindSql}
      ORDER BY c.emergency DESC, c.priority DESC, c.kind, c.name
      LIMIT ? OFFSET ?`).all(...(kinds ?? []), lim + 1, off);
    const total = d.prepare(`SELECT count(*) AS n FROM contacts c WHERE 1=1 ${kindSql}`).get(...(kinds ?? [])).n;
    return {
      q: '',
      total: Number(total),
      limit: lim,
      offset: off,
      items: rows.slice(0, lim).map((r) => mapContact(r)),
      gruppen: gruppen(d),
      source: 'Landeshauptstadt Stuttgart, stuttgart.de; redaktionell geprüfte Notdienste',
      hinweis: 'Ohne Suchbegriff stehen Notrufe und die wichtigsten Dienste oben.',
    };
  }

  const rows = d.prepare(`SELECT c.*, bm25(contacts_fts,10,6,4,3,1,1,4,4) AS fts_rank
    FROM contacts_fts JOIN contacts c ON c.id = contacts_fts.id
    WHERE contacts_fts MATCH ? ${kindSql}
    ORDER BY (fts_rank
      - CASE WHEN lower(c.name) = lower(?) THEN 6.0
             WHEN lower(c.name) LIKE lower(?) || '%' THEN 2.0
             ELSE 0 END
      - CASE c.kind WHEN 'notruf' THEN 3.0 WHEN 'notdienst' THEN 1.2 ELSE 0 END
      - (c.priority / 200.0)), length(c.name), c.name
    LIMIT ? OFFSET ?`).all(
    ...(kindSql ? [match, query, query, ...kinds, lim + 1, off] : [match, query, query, lim + 1, off]),
  );
  const total = d.prepare(`SELECT count(*) AS n FROM contacts_fts JOIN contacts c ON c.id=contacts_fts.id
    WHERE contacts_fts MATCH ? ${kindSql}`).get(...(kindSql ? [match, ...kinds] : [match])).n;

  return {
    q: query,
    total: Number(total),
    limit: lim,
    offset: off,
    items: rows.slice(0, lim).map((r) => mapContact(r)),
    gruppen: gruppen(d),
    source: 'Landeshauptstadt Stuttgart, stuttgart.de; redaktionell geprüfte Notdienste',
    hinweis: 'Treffer aus dem lokalen Kontaktregister. Im Notfall gilt immer die 112.',
  };
}

function gruppen(d) {
  const counts = new Map(d.prepare('SELECT kind, count(*) AS n FROM contacts GROUP BY kind').all().map((r) => [r.kind, Number(r.n)]));
  return Object.entries(GRUPPEN).map(([id, g]) => ({
    id,
    label: g.label,
    count: g.kinds.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0),
  }));
}

/** Ein Kontakt über Register-ID oder Dokument-ID. */
export function kontaktDetail(idOrDocId) {
  const d = open();
  const raw = String(idOrDocId ?? '');
  const numeric = /^\d+$/.test(raw) ? Number(raw) : null;
  const row = d.prepare('SELECT * FROM contacts WHERE id = ? OR document_id = ?').get(raw, numeric);
  if (!row) return null;
  const services = servicesFor(d, [row.id]).get(row.id) ?? [];
  return {
    ...mapContact(row, services),
    gruppe: gruppeOfKind(row.kind),
  };
}

/** Kennzahlen für den Einstieg und die Quellenangabe. */
export function kontakteStats() {
  const d = open();
  const meta = Object.fromEntries(d.prepare('SELECT key,value FROM meta').all().map((r) => [r.key, r.value]));
  const counts = d.prepare(`SELECT
    (SELECT count(*) FROM contacts) AS contacts,
    (SELECT count(*) FROM contacts WHERE phones_json != '[]') AS with_phone,
    (SELECT count(*) FROM contacts WHERE email IS NOT NULL) AS with_email,
    (SELECT count(*) FROM contacts WHERE hours_json != '[]') AS with_hours,
    (SELECT count(*) FROM contact_services) AS services`).get();
  return {
    ...counts,
    stand: meta.contact_stand ?? null,
    builtAt: meta.built_at ?? null,
    gruppen: gruppen(d),
    source: 'Landeshauptstadt Stuttgart, stuttgart.de; redaktionell geprüfte Notdienste',
    hinweis: 'Angaben ohne Gewähr. Im Notfall 112. Maßgeblich sind die verlinkten Originalseiten.',
  };
}

export const KONTAKT_GRUPPEN = GRUPPEN;
