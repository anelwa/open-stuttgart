// Everything Search über den aufbereiteten Stuttgarter Verwaltungs- und Seitenbestand.
// Die Datenbank (server/data/suche.sqlite) wird mit scripts/build-search-db.mjs aus
// server/data/verwaltung.sqlite erzeugt: Dokumentenregister, FTS5, Backlinks, Leistungsabläufe
// und Bezugsquellen. Keine externen Anfragen, keine Personenprofile.
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const FILE = process.env.OS_SEARCH_DB ?? fileURLToPath(new URL('../data/suche.sqlite', import.meta.url));
let db = null;
let initError = null;

function open() {
  if (db) return db;
  if (initError) throw initError;
  if (!existsSync(FILE)) {
    initError = Object.assign(new Error('Suchdatenbank fehlt. Bitte „npm run data:search“ ausführen.'), { status: 503 });
    throw initError;
  }
  try {
    db = new DatabaseSync(FILE, { readOnly: true });
    db.prepare('SELECT count(*) FROM documents').get();
    return db;
  } catch (e) {
    initError = Object.assign(new Error(`Suchdatenbank nicht lesbar: ${e.message}`), { status: 503 });
    throw initError;
  }
}

const MAX_LIMIT = 50;
const norm = (s) => String(s ?? '').trim();
const safeType = (t) => (/^[a-z_]{2,40}$/.test(String(t ?? '')) ? String(t) : null);

/** FTS5-Verträglichkeit: Wörter extrahieren, als Präfix-ODER verknüpfen. */
function ftsQuery(q) {
  const tokens = (String(q ?? '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).slice(0, 12);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '')}"*`).join(' OR ');
}

const TYPE_LABEL = {
  leistung: 'Leistung',
  dienststelle: 'Dienststelle',
  seite: 'Seite',
  pressemitteilung: 'Pressemitteilung',
  online_angebot: 'Online-Dienst',
  dokument: 'Dokument',
};

function mapResult(r) {
  return {
    id: Number(r.id),
    title: r.title,
    url: r.url,
    type: r.doc_type,
    typeLabel: TYPE_LABEL[r.doc_type] ?? r.doc_type,
    source: r.source,
    district: r.district ?? null,
    modified: r.modified_at ?? null,
    snippet: r.snippet ?? r.summary ?? null,
    rank: r.rank != null ? Number(r.rank) : null,
  };
}

/**
 * Volltextsuche mit optionalem Typfilter.
 * Leere Anfrage liefert die zuletzt geänderten Dokumente als Einstieg.
 */
export function search({ q = '', type = null, limit = 20, offset = 0 } = {}) {
  const d = open();
  const query = norm(q);
  const typ = safeType(type);
  const lim = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || 20));
  const off = Math.max(0, Math.min(2000, Number(offset) || 0));
  const match = ftsQuery(query);

  if (!match) {
    const rows = d.prepare(`SELECT id,title,url,doc_type,source,district,modified_at,summary AS snippet,NULL AS rank
      FROM documents ${typ ? 'WHERE doc_type = ?' : ''}
      ORDER BY COALESCE(modified_at, fetched_at, '') DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...(typ ? [typ, lim + 1, off] : [lim + 1, off]));
    const total = d.prepare(`SELECT count(*) AS n FROM documents ${typ ? 'WHERE doc_type = ?' : ''}`).get(...(typ ? [typ] : [])).n;
    return {
      q: '', type: typ, total: Number(total), limit: lim, offset: off,
      items: rows.slice(0, lim).map(mapResult),
      facets: facets(d, null, typ), source: 'Stuttgart.de, Verwaltungs- und Seitenbestand',
      hinweis: 'Leere Suche: zuletzt geänderte Dokumente. Tippen für die Volltextsuche.',
    };
  }

  const rows = d.prepare(`SELECT d.id,d.title,d.url,d.doc_type,d.source,d.district,d.modified_at,
      bm25(documents_fts,10,5,1) AS rank,
      snippet(documents_fts,-1,'[[',']]',' … ',22) AS snippet
    FROM documents_fts JOIN documents d ON d.id = documents_fts.rowid
    WHERE documents_fts MATCH ? ${typ ? 'AND d.doc_type = ?' : ''}
    ORDER BY (rank
      - CASE d.doc_type WHEN 'leistung' THEN 3.0 WHEN 'dienststelle' THEN 1.5 WHEN 'seite' THEN 0.3 ELSE 0 END
      + CASE d.doc_type WHEN 'dokument' THEN 2.0 WHEN 'online_angebot' THEN 0.8 ELSE 0 END), d.title
    LIMIT ? OFFSET ?`)
    .all(...(typ ? [match, typ, lim + 1, off] : [match, lim + 1, off]));
  const total = d.prepare(`SELECT count(*) AS n FROM documents_fts JOIN documents d ON d.id = documents_fts.rowid
    WHERE documents_fts MATCH ? ${typ ? 'AND d.doc_type = ?' : ''}`)
    .get(...(typ ? [match, typ] : [match])).n;
  return {
    q: query, type: typ, total: Number(total), limit: lim, offset: off,
    items: rows.slice(0, lim).map(mapResult),
    facets: facets(d, match, typ),
    source: 'Stuttgart.de, Verwaltungs- und Seitenbestand',
    hinweis: 'Volltextsuche über Seiten, Leistungen, Dienststellen und Online-Dienste. Quelle und Link stehen an jedem Treffer.',
  };
}

function facets(d, match, typ) {
  const rows = match
    ? d.prepare(`SELECT d.doc_type AS type, count(*) AS n FROM documents_fts JOIN documents d ON d.id=documents_fts.rowid
        WHERE documents_fts MATCH ? ${typ ? 'AND d.doc_type = ?' : ''} GROUP BY d.doc_type ORDER BY n DESC`)
      .all(...(typ ? [match, typ] : [match]))
    : d.prepare(`SELECT doc_type AS type, count(*) AS n FROM documents ${typ ? 'WHERE doc_type = ?' : ''} GROUP BY doc_type ORDER BY n DESC`)
      .all(...(typ ? [typ] : []));
  return rows.map((r) => ({ type: r.type, label: TYPE_LABEL[r.type] ?? r.type, count: Number(r.n) }));
}

export function suggest(q = '') {
  const query = norm(q);
  const match = ftsQuery(query);
  if (!match) return { items: [] };
  const d = open();
  const rows = d.prepare(`SELECT d.id,d.title,d.doc_type,d.url
    FROM documents_fts JOIN documents d ON d.id=documents_fts.rowid
    WHERE documents_fts MATCH ?
    ORDER BY (bm25(documents_fts,10,5,1)
      - CASE d.doc_type WHEN 'leistung' THEN 3.0 WHEN 'dienststelle' THEN 1.5 ELSE 0 END
      + CASE d.doc_type WHEN 'dokument' THEN 2.0 WHEN 'online_angebot' THEN 0.8 ELSE 0 END), d.title LIMIT 8`).all(match);
  return { items: rows.map((r) => ({ id: Number(r.id), title: r.title, type: r.doc_type, typeLabel: TYPE_LABEL[r.doc_type] ?? r.doc_type, url: r.url })) };
}

/** Dokument, Leistung, Ablauf, Quellen, Backlinks und verwandte Dokumente. */
export function documentDetail(id) {
  const d = open();
  const doc = d.prepare(`SELECT id,source,url,canonical_url,title,doc_type,summary,text,content_hash,fetched_at,modified_at,district,lat,lon,parent_url,status
    FROM documents WHERE id = ?`).get(Number(id));
  if (!doc) return null;
  const service = d.prepare(`SELECT id,document_id,url,name,leika,summary,legal_basis,fees,processing_time,digital,responsible
    FROM services WHERE document_id = ?`).get(Number(id)) ?? null;
  const steps = service ? d.prepare('SELECT ord,title,text FROM service_steps WHERE service_id = ? ORDER BY ord').all(service.id) : [];
  const sources = service ? d.prepare(`SELECT s.role,s.label,d.id,d.title,d.url,d.doc_type
    FROM service_sources s LEFT JOIN documents d ON d.id=s.document_id
    WHERE s.service_id=? ORDER BY s.role, d.title`).all(service.id) : [];
  const backlinks = d.prepare(`SELECT d.id,d.title,d.url,d.doc_type,l.anchor
    FROM document_links l JOIN documents d ON d.id=l.from_id
    WHERE l.to_id=? ORDER BY d.title LIMIT 30`).all(Number(id));
  const outlinks = d.prepare(`SELECT d.id,d.title,d.url,d.doc_type,l.to_url,l.anchor,l.kind
    FROM document_links l LEFT JOIN documents d ON d.id=l.to_id
    WHERE l.from_id=? ORDER BY l.kind, d.title LIMIT 60`).all(Number(id));
  const related = d.prepare(`SELECT d.id,d.title,d.url,d.doc_type,count(*) AS shared
    FROM document_links a
    JOIN document_links b ON b.to_url=a.to_url AND b.from_id != a.from_id
    JOIN documents d ON d.id=b.from_id
    WHERE a.from_id=? AND d.id != ?
    GROUP BY d.id ORDER BY shared DESC, d.title LIMIT 8`).all(Number(id), Number(id));
  const chunks = d.prepare('SELECT ord,text FROM document_chunks WHERE document_id=? ORDER BY ord LIMIT 12').all(Number(id));
  return {
    ...doc,
    typeLabel: TYPE_LABEL[doc.doc_type] ?? doc.doc_type,
    service,
    steps,
    sources: sources.map((s) => ({ ...s, role: s.role ?? 'quelle' })),
    backlinks: backlinks.map((b) => ({ ...b, id: Number(b.id) })),
    outlinks: outlinks.map((o) => ({ ...o, id: o.id != null ? Number(o.id) : null })),
    related: related.map((r) => ({ ...r, id: Number(r.id), shared: Number(r.shared) })),
    chunks,
    source: 'Landeshauptstadt Stuttgart, stuttgart.de (Struktur- und Seitendaten); abgeleitete Suche',
    lizenz: 'Angaben der Landeshauptstadt Stuttgart; Quellen und Links an jedem Dokument. Keine Volltexte von Presseartikeln.',
  };
}

export function related(id) {
  const d = open();
  const rows = d.prepare(`SELECT d.id,d.title,d.url,d.doc_type,count(*) AS shared
    FROM document_links a
    JOIN document_links b ON b.to_url=a.to_url AND b.from_id != a.from_id
    JOIN documents d ON d.id=b.from_id
    WHERE a.from_id=? AND d.id != ?
    GROUP BY d.id ORDER BY shared DESC, d.title LIMIT 12`).all(Number(id), Number(id));
  return { items: rows.map((r) => ({ ...r, id: Number(r.id), shared: Number(r.shared), typeLabel: TYPE_LABEL[r.doc_type] ?? r.doc_type })) };
}

export function searchStats() {
  const d = open();
  const meta = Object.fromEntries(d.prepare('SELECT key,value FROM meta').all().map((r) => [r.key, r.value]));
  const types = d.prepare('SELECT doc_type AS type, count(*) AS n FROM documents GROUP BY doc_type ORDER BY n DESC').all()
    .map((r) => ({ type: r.type, label: TYPE_LABEL[r.type] ?? r.type, count: Number(r.n) }));
  const counts = d.prepare(`SELECT
    (SELECT count(*) FROM documents) AS documents,
    (SELECT count(*) FROM documents WHERE text IS NOT NULL AND length(text)>0) AS with_text,
    (SELECT count(*) FROM services) AS services,
    (SELECT count(*) FROM service_steps) AS steps,
    (SELECT count(*) FROM service_sources) AS service_sources,
    (SELECT count(*) FROM document_links) AS links,
    (SELECT count(*) FROM document_links WHERE to_id IS NOT NULL) AS resolved_links,
    (SELECT count(*) FROM document_chunks) AS chunks`).get();
  return {
    ...counts,
    types,
    meta,
    fts: 'FTS5, unicode61 remove_diacritics 2',
    vectors: meta.vectors ?? 'vec0 angelegt, Embeddings ausstehend',
    source: 'server/data/verwaltung.sqlite → server/data/suche.sqlite',
    hinweis: 'Die Suche ist eine abgeleitete, lokal erzeugte Datenbank. Maßgeblich sind die verlinkten Originalseiten.',
  };
}

export const SEARCH_TYPES = TYPE_LABEL;
