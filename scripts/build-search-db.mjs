#!/usr/bin/env node
// Baut aus dem vorhandenen Verwaltungs-Crawl eine durchsuchbare Dokumenten- und Anliegen-Datenbank.
// Quelle: server/data/verwaltung.sqlite (Seiten, Leistungen, Einheiten, Online-Angebote, Links).
// Ziel: server/data/suche.sqlite mit FTS5, Dokumentenregister, Backlinks, Leistungsabläufen und Quellen.
// Die Datenbank ist abgeleitet und kann jederzeit mit `npm run data:search` neu erzeugt werden.
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'server/data/verwaltung.sqlite');
const DST = join(ROOT, 'server/data/suche.sqlite');
if (!existsSync(SRC)) {
  console.error(`Quelle fehlt: ${SRC}. Zuerst npm run data:verwaltung ausführen.`);
  process.exit(1);
}
for (const f of [DST, `${DST}-wal`, `${DST}-shm`]) {
  try { unlinkSync(f); } catch { /* egal */ }
}
mkdirSync(dirname(DST), { recursive: true });

const src = new DatabaseSync(SRC, { readOnly: true });
const db = new DatabaseSync(DST, { allowExtension: true });
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    canonical_url TEXT,
    title TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    summary TEXT,
    text TEXT,
    content_hash TEXT,
    fetched_at TEXT,
    modified_at TEXT,
    district TEXT,
    lat REAL,
    lon REAL,
    parent_url TEXT,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE INDEX idx_documents_type ON documents(doc_type);
  CREATE INDEX idx_documents_source ON documents(source);
  CREATE INDEX idx_documents_district ON documents(district);
  CREATE TABLE document_links (
    id INTEGER PRIMARY KEY,
    from_id INTEGER NOT NULL,
    to_id INTEGER,
    to_url TEXT NOT NULL,
    anchor TEXT,
    kind TEXT,
    FOREIGN KEY (from_id) REFERENCES documents(id)
  );
  CREATE INDEX idx_links_from ON document_links(from_id);
  CREATE INDEX idx_links_to ON document_links(to_id);
  CREATE INDEX idx_links_url ON document_links(to_url);
  CREATE TABLE services (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL,
    url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    leika TEXT,
    summary TEXT,
    legal_basis TEXT,
    fees TEXT,
    processing_time TEXT,
    digital INTEGER,
    responsible TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id)
  );
  CREATE INDEX idx_services_doc ON services(document_id);
  CREATE TABLE service_steps (
    id INTEGER PRIMARY KEY,
    service_id INTEGER NOT NULL,
    ord INTEGER NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    source_document_id INTEGER,
    FOREIGN KEY (service_id) REFERENCES services(id)
  );
  CREATE INDEX idx_steps_service ON service_steps(service_id);
  CREATE TABLE service_sources (
    id INTEGER PRIMARY KEY,
    service_id INTEGER NOT NULL,
    document_id INTEGER,
    role TEXT NOT NULL,
    label TEXT,
    FOREIGN KEY (service_id) REFERENCES services(id)
  );
  CREATE INDEX idx_sources_service ON service_sources(service_id);
  CREATE TABLE document_chunks (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL,
    ord INTEGER NOT NULL,
    text TEXT NOT NULL,
    token_estimate INTEGER,
    embedding BLOB,
    FOREIGN KEY (document_id) REFERENCES documents(id)
  );
  CREATE INDEX idx_chunks_doc ON document_chunks(document_id);
  CREATE VIRTUAL TABLE documents_fts USING fts5(
    title, summary, text,
    content='documents', content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid,title,summary,text) VALUES (new.id,new.title,new.summary,new.text);
  END;
  CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts,rowid,title,summary,text) VALUES ('delete',old.id,old.title,old.summary,old.text);
  END;
  CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts,rowid,title,summary,text) VALUES ('delete',old.id,old.title,old.summary,old.text);
    INSERT INTO documents_fts(rowid,title,summary,text) VALUES (new.id,new.title,new.summary,new.text);
  END;
`);
try {
  const vec = require('sqlite-vec');
  db.loadExtension(vec.getLoadablePath());
  db.exec('CREATE VIRTUAL TABLE vec_chunks USING vec0(chunk_id INTEGER PRIMARY KEY, embedding float[384])');
  console.log('sqlite-vec geladen; vec_chunks angelegt (noch ohne Embeddings).');
} catch (e) {
  console.warn(`sqlite-vec nicht verfügbar (${e.message}); FTS5 funktioniert trotzdem.`);
}

const docMap = new Map();
const TYPE_PRIORITY = { leistung: 5, dienststelle: 4, online_angebot: 3, pressemitteilung: 2, seite: 1, dokument: 1 };
const normUrl = (u) => {
  const s = String(u ?? '').trim().split('#')[0];
  if (!s) return '';
  try {
    const url = new URL(s);
    url.hash = '';
    if (/^(www\.)?stuttgart\.de$/i.test(url.hostname)) url.hostname = 'www.stuttgart.de';
    // Tracking-/CMS-Parameter entfernen; sie erzeugen sonst doppelte Dokumente und leere Leistungen.
    for (const key of [...url.searchParams.keys()]) {
      if (/^(sp[:%]?out|utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
    return url.href;
  } catch { return s; }
};
const typeOf = (url) => {
  if (/\/organigramm\/leistungen\//.test(url)) return 'leistung';
  if (/\/organigramm\/(adresse|verwaltungseinheit)\//.test(url)) return 'dienststelle';
  if (/\/pressemitteilungen\//.test(url)) return 'pressemitteilung';
  if (/^https?:\/\/service\.stuttgart\.de\//.test(url)) return 'online_angebot';
  if (/\.pdf($|\?)/i.test(url)) return 'dokument';
  return 'seite';
};
const clean = (s) => String(s ?? '').replace(/\u0002/g, ' · ').replace(/\s+/g, ' ').trim();
const short = (s, n = 320) => {
  const t = clean(s);
  return t.length > n ? `${t.slice(0, n).replace(/\s\S*$/, '')} …` : t;
};
const hash = (s) => createHash('sha256').update(String(s ?? '')).digest('hex');
function addDoc(url, fields = {}) {
  const u = normUrl(url);
  if (!u) return null;
  const cur = docMap.get(u);
  const next = {
    source: 'Landeshauptstadt Stuttgart',
    canonical_url: u,
    title: clean(fields.title) || cur?.title || u,
    doc_type: fields.doc_type || typeOf(u),
    summary: clean(fields.summary) || cur?.summary || null,
    text: clean(fields.text) || cur?.text || null,
    fetched_at: fields.fetched_at ?? cur?.fetched_at ?? null,
    modified_at: fields.modified_at ?? cur?.modified_at ?? null,
    district: fields.district ?? cur?.district ?? null,
    lat: fields.lat ?? cur?.lat ?? null,
    lon: fields.lon ?? cur?.lon ?? null,
    parent_url: fields.parent_url ?? cur?.parent_url ?? null,
    status: fields.status ?? cur?.status ?? 'active',
  };
  if (cur && (TYPE_PRIORITY[next.doc_type] ?? 0) < (TYPE_PRIORITY[cur.doc_type] ?? 0)) next.doc_type = cur.doc_type;
  docMap.set(u, next);
  return u;
}

// 1. Seiten
console.log('Lese Seiten …');
for (const row of src.prepare('SELECT url, titel, beschreibung, geaendert, abgerufen, lat, lon FROM seiten').all()) {
  addDoc(row.url, {
    title: row.titel,
    doc_type: typeOf(row.url),
    summary: short(row.beschreibung),
    text: row.beschreibung,
    modified_at: row.geaendert,
    fetched_at: row.abgerufen,
    lat: row.lat,
    lon: row.lon,
  });
}

// 2. Leistungen + Abläufe
console.log('Lese Leistungen …');
const leistungen = src.prepare(`SELECT url,name,leika,zustaendig_dachzeile,digitaler_dienst,geaendert,
  voraussetzungen,unterlagen,ablauf,gebuehren,bearbeitungsdauer,rechtsgrundlage,weitere_informationen,termin_text,abschnitte_json
  FROM leistungen`).all();
const serviceRows = [];
for (const row of leistungen) {
  const text = [
    row.voraussetzungen && `Voraussetzungen: ${row.voraussetzungen}`,
    row.unterlagen && `Unterlagen: ${row.unterlagen}`,
    row.ablauf && `Ablauf: ${row.ablauf}`,
    row.gebuehren && `Gebühren: ${row.gebuehren}`,
    row.bearbeitungsdauer && `Bearbeitungsdauer: ${row.bearbeitungsdauer}`,
    row.rechtsgrundlage && `Rechtsgrundlage: ${row.rechtsgrundlage}`,
    row.weitere_informationen && `Weitere Informationen: ${row.weitere_informationen}`,
    row.termin_text && `Termin: ${row.termin_text}`,
  ].filter(Boolean).join('\n\n');
  addDoc(row.url, {
    title: row.name,
    doc_type: 'leistung',
    summary: short(row.zustaendig_dachzeile || row.ablauf || row.weitere_informationen),
    text,
    modified_at: row.geaendert,
  });
  serviceRows.push(row);
}

// 3. Einheiten / Dienststellen
console.log('Lese Dienststellen …');
const einheiten = src.prepare(`SELECT e.url,e.name,e.art,e.strasse,e.plz,e.ort,e.oeffnungszeiten_text,e.email,e.lat,e.lon,e.geaendert,g.stadtbezirk
  FROM einheiten e LEFT JOIN gebaeude g ON g.id = e.gebaeude_id`).all();
for (const row of einheiten) {
  const addr = [row.strasse, [row.plz, row.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  addDoc(row.url, {
    title: row.name,
    doc_type: 'dienststelle',
    summary: short([row.art, addr, row.oeffnungszeiten_text].filter(Boolean).join(' · ')),
    text: [row.name, row.art, addr, row.oeffnungszeiten_text, row.email].filter(Boolean).join('\n'),
    modified_at: row.geaendert,
    district: row.stadtbezirk,
    lat: row.lat,
    lon: row.lon,
  });
}

// 4. Online-Angebote
console.log('Lese Online-Angebote …');
for (const row of src.prepare('SELECT url,art,host,bezeichnung FROM online_angebote').all()) {
  addDoc(row.url, {
    title: row.bezeichnung || row.url,
    doc_type: 'online_angebot',
    summary: short([row.art, row.host, row.bezeichnung].filter(Boolean).join(' · ')),
    text: [row.bezeichnung, row.art, row.host].filter(Boolean).join('\n'),
  });
}

// 5. Dokumente schreiben
console.log(`Schreibe ${docMap.size} Dokumente …`);
const insDoc = db.prepare(`INSERT INTO documents
  (source,url,canonical_url,title,doc_type,summary,text,content_hash,fetched_at,modified_at,district,lat,lon,parent_url,status)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const idByUrl = new Map();
db.exec('BEGIN');
for (const [url, d] of docMap) {
  const r = insDoc.run(d.source, url, d.canonical_url, d.title, d.doc_type, d.summary, d.text, hash(`${d.title}\n${d.text ?? ''}`),
    d.fetched_at, d.modified_at, d.district, d.lat, d.lon, d.parent_url, d.status);
  idByUrl.set(url, Number(r.lastInsertRowid));
}
db.exec('COMMIT');

// 6. Leistungen + Schritte + Quellen
console.log('Schreibe Leistungen und Abläufe …');
const insService = db.prepare(`INSERT INTO services (document_id,url,name,leika,summary,legal_basis,fees,processing_time,digital,responsible)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);
const insStep = db.prepare('INSERT INTO service_steps (service_id,ord,title,text,source_document_id) VALUES (?,?,?,?,?)');
const insSource = db.prepare('INSERT INTO service_sources (service_id,document_id,role,label) VALUES (?,?,?,?)');
const serviceIdByUrl = new Map();
const serviceIdByDoc = new Map();
db.exec('BEGIN');
// Bei doppelten Leistungs-URLs (z. B. ?sp:out=easy) die inhaltlich reichste Variante zuerst.
serviceRows.sort((a, b) => {
  const score = (r) => ['voraussetzungen', 'unterlagen', 'ablauf', 'gebuehren', 'bearbeitungsdauer', 'rechtsgrundlage'].filter((k) => clean(r[k])).length;
  return score(b) - score(a);
});
for (const row of serviceRows) {
  const docId = idByUrl.get(normUrl(row.url));
  if (!docId) continue;
  if (serviceIdByDoc.has(docId)) { serviceIdByUrl.set(normUrl(row.url), serviceIdByDoc.get(docId)); continue; }
  const r = insService.run(docId, normUrl(row.url), row.name, row.leika, short(row.zustaendig_dachzeile || row.ablauf),
    row.rechtsgrundlage, row.gebuehren, row.bearbeitungsdauer, row.digitaler_dienst ? 1 : 0, row.zustaendig_dachzeile);
  const sid = Number(r.lastInsertRowid);
  serviceIdByDoc.set(docId, sid);
  serviceIdByUrl.set(normUrl(row.url), sid);
  const steps = [
    ['Voraussetzungen', row.voraussetzungen],
    ['Unterlagen', row.unterlagen],
    ['Ablauf', row.ablauf],
    ['Gebühren', row.gebuehren],
    ['Bearbeitungsdauer', row.bearbeitungsdauer],
    ['Rechtsgrundlage', row.rechtsgrundlage],
    ['Weitere Informationen', row.weitere_informationen],
    ['Termin', row.termin_text],
  ];
  let ord = 0;
  for (const [title, text] of steps) {
    if (!clean(text)) continue;
    insStep.run(sid, ord++, title, clean(text), docId);
  }
  if (row.abschnitte_json) {
    const ALIAS = {
      requirements: 'Voraussetzungen', documents: 'Unterlagen', processflow: 'Ablauf', rates: 'Gebühren',
      editingtime: 'Bearbeitungsdauer', justicebasics: 'Rechtsgrundlage', furtherinformations: 'Weitere Informationen',
      appointment: 'Termin', forms: 'Formulare',
    };
    try {
      const sections = JSON.parse(row.abschnitte_json);
      for (const [key, value] of Object.entries(sections)) {
        const title = ALIAS[key.toLowerCase()] ?? key;
        if (!clean(value) || steps.some(([t]) => t.toLowerCase() === title.toLowerCase())) continue;
        insStep.run(sid, ord++, title, clean(value), docId);
        steps.push([title, value]);
      }
    } catch { /* kein JSON */ }
  }
}
db.exec('COMMIT');

// 7. Zuständige Stellen und Online-Dienste
console.log('Verknüpfe zuständige Stellen und Online-Dienste …');
db.exec('BEGIN');
for (const row of src.prepare('SELECT leistung_url,einheit_url,rolle FROM leistung_einheit').all()) {
  const sid = serviceIdByUrl.get(normUrl(row.leistung_url));
  if (!sid) continue;
  const did = idByUrl.get(normUrl(row.einheit_url));
  insSource.run(sid, did ?? null, row.rolle || 'zuständig', null);
}
for (const row of src.prepare('SELECT quelle_url,angebot_url FROM online_verweise').all()) {
  const sid = serviceIdByUrl.get(normUrl(row.quelle_url));
  if (!sid) continue;
  const did = idByUrl.get(normUrl(row.angebot_url));
  insSource.run(sid, did ?? null, 'online', null);
}
db.exec('COMMIT');

// 8. Links / Backlinks
console.log('Lese Links …');
const insLink = db.prepare('INSERT INTO document_links (from_id,to_id,to_url,anchor,kind) VALUES (?,?,?,?,?)');
let links = 0, skipped = 0;
db.exec('BEGIN');
for (const row of src.prepare('SELECT quelle_url,ziel_url,text,intern FROM links').all()) {
  const from = idByUrl.get(normUrl(row.quelle_url));
  if (!from || !row.ziel_url) { skipped += 1; continue; }
  const to = idByUrl.get(normUrl(row.ziel_url)) ?? null;
  const kind = /\.pdf($|\?)/i.test(row.ziel_url) ? 'pdf'
    : /^https?:\/\/service\.stuttgart\.de\//.test(row.ziel_url) ? 'online'
      : row.intern ? 'intern' : 'extern';
  insLink.run(from, to, row.ziel_url, clean(row.text) || null, kind);
  links += 1;
}
db.exec('COMMIT');
console.log(`Links: ${links}, ohne Ausgangsseite übersprungen: ${skipped}`);

// 9. Chunks (ohne Embeddings; Phase 2 ergänzt Vektoren)
console.log('Erzeuge Textchunks …');
const insChunk = db.prepare('INSERT INTO document_chunks (document_id,ord,text,token_estimate,embedding) VALUES (?,?,?,?,NULL)');
let chunks = 0;
db.exec('BEGIN');
for (const [url, d] of docMap) {
  const text = clean([d.title, d.summary, d.text].filter(Boolean).join('\n\n'));
  if (text.length < 40) continue;
  const id = idByUrl.get(url);
  const size = 900, overlap = 120;
  let ord = 0;
  for (let i = 0; i < text.length; i += size - overlap) {
    const part = text.slice(i, i + size).trim();
    if (part.length < 40) break;
    insChunk.run(id, ord++, part, Math.ceil(part.length / 4));
    chunks += 1;
    if (i + size >= text.length) break;
  }
}
db.exec('COMMIT');

// 10. FTS neu aufbauen und Metadaten schreiben
console.log('Baue FTS5-Index …');
db.exec("INSERT INTO documents_fts(documents_fts) VALUES('rebuild')");
const meta = db.prepare('INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)');
meta.run('built_at', new Date().toISOString());
meta.run('source', 'server/data/verwaltung.sqlite');
meta.run('documents', String(docMap.size));
meta.run('links', String(links));
meta.run('services', String(serviceIdByUrl.size));
meta.run('chunks', String(chunks));
meta.run('fts', 'FTS5, unicode61 remove_diacritics 2');
meta.run('vectors', existsSync(join(ROOT, 'node_modules/sqlite-vec')) ? 'vec0 angelegt, Embeddings ausstehend' : 'sqlite-vec nicht installiert');
db.exec('PRAGMA optimize');
db.close();
src.close();
console.log(`Fertig: ${DST}`);
console.log({ documents: docMap.size, services: serviceIdByUrl.size, links, chunks });
