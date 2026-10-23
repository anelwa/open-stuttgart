#!/usr/bin/env node
// Baut aus dem vorhandenen Verwaltungs-Crawl eine durchsuchbare Dokumenten- und Anliegen-Datenbank.
// Quelle: server/data/verwaltung.sqlite (Seiten, Leistungen, Einheiten, Online-Angebote, Links).
// Ziel: server/data/suche.sqlite mit FTS5, Dokumentenregister, Backlinks, Leistungsabläufen und Quellen.
// Die Datenbank ist abgeleitet und kann jederzeit mit `npm run data:search` neu erzeugt werden.
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'server/data/verwaltung.sqlite');
const DST = join(ROOT, 'server/data/suche.sqlite');
const WICHTIGE_KONTAKTE = join(ROOT, 'src/data/kontakte-wichtig.json');
const KONTAKT_SYNONYME = join(ROOT, 'src/data/kontakte-synonyme.json');
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
  -- Kontaktregister: eine Zeile je anrufbarer Stelle. Die Dokumente bleiben die
  -- durchsuchbare Hülle; contacts liefert die strukturierten Felder für die Anzeige.
  CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    document_id INTEGER UNIQUE,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    organization TEXT,
    category TEXT,
    description TEXT,
    street TEXT,
    postal_code TEXT,
    city TEXT,
    district TEXT,
    lat REAL,
    lon REAL,
    building_id TEXT,
    phones_json TEXT,
    email TEXT,
    url TEXT,
    booking TEXT,
    hours_json TEXT,
    hours_text TEXT,
    availability TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    emergency INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    source_url TEXT,
    checked_at TEXT,
    confidence TEXT NOT NULL DEFAULT 'abgeleitet',
    FOREIGN KEY (document_id) REFERENCES documents(id)
  );
  CREATE INDEX idx_contacts_kind ON contacts(kind);
  CREATE INDEX idx_contacts_category ON contacts(category);
  CREATE INDEX idx_contacts_priority ON contacts(priority DESC);
  CREATE TABLE contact_services (
    contact_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    online INTEGER NOT NULL DEFAULT 0,
    document_id INTEGER,
    PRIMARY KEY (contact_id, url)
  );
  CREATE INDEX idx_contact_services_contact ON contact_services(contact_id, ord);
  CREATE VIRTUAL TABLE contacts_fts USING fts5(
    id UNINDEXED, name, organization, category, description, address, services, phones,
    tokenize='unicode61 remove_diacritics 2'
  );
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
/** Text für den Leser: Absatzmarken des Crawls bleiben als Zeilenumbrüche erhalten. */
const cleanText = (s) => String(s ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\u0002/g, '\n\n')
  .split('\n')
  .map((line) => line.replace(/[ \t]+/g, ' ').trim())
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
const short = (s, n = 320) => {
  const t = clean(s);
  return t.length > n ? `${t.slice(0, n).replace(/\s\S*$/, '')} …` : t;
};
const hash = (s) => createHash('sha256').update(String(s ?? '')).digest('hex');

const WEEKDAYS = new Set(['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag']);
const isWeekday = (line) => WEEKDAYS.has(String(line).toLowerCase().replace(/[.:]$/, ''));
const isTime = (line) => /\d{1,2}[:.]\d{2}/.test(line) || /^\d{1,2}(?:[–-]\d{1,2})?\s*uhr$/i.test(line);
const rubrikLabel = (rubrik, art) => {
  switch (rubrik) {
    case 'buergerbuero': return 'Bürgerbüro';
    case 'bezirksamt': return 'Bezirksamt';
    case 'schule_bildung': return 'Schule und Bildung';
    case 'beratung_soziales': return 'Beratung und Soziales';
    case 'amt': return 'Amt und Dienststelle';
    case 'sonstige': return 'Sonstige Adresse';
    default: return art === 'verwaltungseinheit' ? 'Dienststelle' : (art || 'Dienststelle');
  }
};
const kindOfRubrik = (rubrik) => {
  switch (rubrik) {
    case 'buergerbuero': return 'buergerbuero';
    case 'beratung_soziales': return 'beratung';
    case 'schule_bildung': return 'bildung';
    case 'bezirksamt':
    case 'amt': return 'behoerde';
    default: return 'dienststelle';
  }
};
/** Rubrik wie in der Verwaltungsebene, hier ohne den externen Store. */
function rubrikOf(unit) {
  const raw = String(unit.rubrik ?? '').toLowerCase();
  if (raw === 'amt_dienststelle' || raw === 'beteiligungsunternehmen' || raw === 'nichtstaedtische_behoerde') return 'amt';
  if (['buergerbuero', 'bezirksamt', 'schule_bildung', 'beratung_soziales', 'amt', 'sonstige'].includes(raw)) return raw;
  const text = `${unit.name ?? ''} ${unit.uebergeordnet ?? ''}`.toLowerCase();
  if (/bürgerbüro|buergerbuero/.test(text) || unit.wartezeit_tafel_id != null) return 'buergerbuero';
  if (/bezirksamt|bezirksrathaus|bezirksvorsteher/.test(text)) return 'bezirksamt';
  if (/schule|gymnasium|realschule|grundschule|berufsschule|gemeinschaftsschule|waldorfschule|kita|kindertages|bibliothek|volkshochschule|musikschule|bildung/.test(text)) return 'schule_bildung';
  if (/beratung|sozial|jugendamt|flüchtling|pflege|senioren|teilhabe|jobcenter|wohngeld|elterngeld|gesundheitsberatung|bürgerhaus|stadtteilhaus|begegnungsstätte/.test(text)) return 'beratung_soziales';
  if (unit.art === 'verwaltungseinheit' || unit.art === 'beteiligungsunternehmen' || unit.art === 'nichtstaedtische_behoerde') return 'amt';
  if (/amt|dienststelle|abteilung|referat|standesamt|zulassungsstelle|führerscheinstelle|ausländerbehörde|stadtkämmerei|steueramt|baurechtsamt|tiefbauamt|garten-|forst|friedhof|branddirektion|ordnungsamt|wahl|statistik|rathaus|eigenbetrieb|aws|stadtentwässerung/.test(text)) return 'amt';
  return 'sonstige';
}

/**
 * Öffnungszeiten aus dem Crawl-Text. Die Stadt liefert Gruppen ohne eigene
 * Struktur (z. B. „Telefonische Erreichbarkeit“); die Überschrift wird zur Gruppe.
 * Fällt der Text aus, bleiben die JSON-Zeilen als eine Gruppe erhalten.
 */
function parseHoursGroups(text, jsonText) {
  const lines = String(text ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const groups = [];
  let current = null;
  const ensure = (label) => {
    if (!current || current.label !== label) {
      current = { label, rows: [] };
      groups.push(current);
    }
    return current;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isWeekday(line)) {
      const next = lines[i + 1];
      if (next && isTime(next)) {
        ensure(groups.length ? groups[groups.length - 1].label : 'Öffnungszeiten').rows.push({ day: line, times: next });
        i += 1;
      } else {
        ensure('Hinweis').rows.push({ day: line, times: '' });
      }
      continue;
    }
    if (isTime(line)) {
      const last = groups[groups.length - 1]?.rows.at(-1);
      if (last && !last.times) last.times = line;
      else ensure('Öffnungszeiten').rows.push({ day: 'Zeit', times: line });
      continue;
    }
    ensure(line.replace(/\s+/g, ' '));
  }
  const usable = groups.filter((g) => g.rows.length);
  if (usable.length) return usable;
  if (jsonText) {
    try {
      const rows = JSON.parse(jsonText);
      if (Array.isArray(rows) && rows.length) {
        return [{ label: 'Öffnungszeiten', rows: rows.map((r) => ({ day: r.day, times: r.times, note: r.note ?? null })) }];
      }
    } catch { /* kein JSON */ }
  }
  return [];
}

/** Personennamen aus Funktionsnummern entfernen; reine Namenszeilen ohne Nummer fallen weg. */
function parsePhones(jsonText) {
  if (!jsonText) return [];
  let rows = [];
  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) rows = parsed;
  } catch { return []; }
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const number = String(row?.number ?? '').trim();
    if (!number || !/\d{3,}/.test(number) || /[a-zäöüß]/i.test(number)) continue;
    const digits = number.replace(/\D/g, '');
    if (seen.has(digits)) continue;
    seen.add(digits);
    let label = String(row?.label ?? 'Telefon').trim();
    label = label.replace(/\b(?:Frau|Herr)\s+[A-ZÄÖÜ][\wÄÖÜäöüß.-]*(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß.-]*)?/g, '').replace(/[,\s]+$/, '').trim();
    if (!label || /^(leitung|stellvertretung|ansprechpartner(?:in)?)$/i.test(label)) label = 'Telefon';
    out.push({ label, number });
  }
  return out;
}

/**
 * Nur funktionale Mailadressen ins Register. Persönliche Adressen (Vorname.Nachname)
 * und Freemail-Adressen ohne Funktionsbezug werden nicht veröffentlicht.
 */
function functionalEmail(value) {
  const email = String(value ?? '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  const [local, domain] = email.toLowerCase().split('@');
  if (/^(frau|herr)[._-]/.test(local)) return null;
  const functional = /^(info|kontakt|contact|service|poststelle|post|mail|office|buerger|buergerbueros?|fundsachen|presse|pressestelle|amt|verwaltung|anfrage|geschaeftsstelle|geschaeft|sekretariat|team|beratung|hilfe|zentrale|personal|bewerbung|kita|schule|sport|kultur|musik|bibliothek|museum|theater|jugend|familie|gesundheit|umwelt|ordnung|verkehr|tiefbau|hochbau|baurecht|statistik|wahlen|standesamt|auslaender|migration|integration|sozial|pflege|wohnen|quartier|sanierung|feuerwehr|polizei|rettung|notruf|datenschutz|gleichstellung|frauen|maedchen|kinder|senioren|behindert|inklusion)([._-]|$)/.test(local);
  if (functional) return email;
  if (domain.endsWith('stuttgart.de') && !local.includes('.')) return email;
  if (/(^|\.)(gmail|googlemail|gmx|web|t-online|me|icloud|online|freenet|arcor)\.(de|com|net)$/.test(domain) && !functional) return null;
  if (/^[a-zäöüß]+[._-][a-zäöüß]+$/.test(local)) return null;
  return email;
}

function contactIdFromUrl(url) {
  return `dst-${hash(url).slice(0, 12)}`;
}

/** Synonyme für die Kontaktsuche: „Müll“ soll auch „Abfall“ finden. */
let kontaktSynonyme = [];
try {
  kontaktSynonyme = JSON.parse(readFileSync(KONTAKT_SYNONYME, 'utf8'));
} catch (e) {
  console.warn(`Kontakt-Synonyme nicht lesbar (${e.message}); Suche bleibt wörtlich.`);
}
function expandContactTerms(text) {
  const lower = String(text ?? '').toLowerCase();
  const hasWord = (w) => {
    const escaped = String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(lower);
  };
  const extra = [];
  for (const rule of kontaktSynonyme) {
    if ((rule.begriffe ?? []).some(hasWord)) {
      extra.push(...(rule.treffer ?? []));
    }
  }
  return extra.length ? `${text} ${[...new Set(extra)].join(' ')}` : text;
}
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
    text: cleanText(fields.text) || cur?.text || null,
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
const einheiten = src.prepare(`SELECT e.url,e.name,e.art,e.strasse,e.plz,e.ort,e.telefon_json,e.email,
    e.oeffnungszeiten_json,e.oeffnungszeiten_text,e.wartezeit_tafel_id,e.uebergeordnet,e.gebaeude_id,
    e.lat,e.lon,e.geaendert,g.stadtbezirk
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

// 4b. Redaktionell gepflegte Notrufe und Notdienste. Sie liegen bewusst als
// eigene Datei vor, damit Nummern, Quellen und Prüfdatum nachvollziehbar bleiben.
console.log('Lese wichtige Kontakte …');
let wichtigeKontakte = { stand: null, items: [] };
try {
  wichtigeKontakte = JSON.parse(readFileSync(WICHTIGE_KONTAKTE, 'utf8'));
} catch (e) {
  console.warn(`Wichtige Kontakte nicht lesbar (${e.message}); Register wird ohne sie gebaut.`);
}
const curatedProblems = [];
const seenCuratedIds = new Set();
for (const item of wichtigeKontakte.items ?? []) {
  if (!item?.id || !item?.name) { curatedProblems.push('Eintrag ohne id/name'); continue; }
  if (seenCuratedIds.has(item.id)) curatedProblems.push(`${item.id}: doppelte ID`);
  seenCuratedIds.add(item.id);
  if (!item.sourceUrl) curatedProblems.push(`${item.id}: sourceUrl fehlt`);
  if (!item.checked) curatedProblems.push(`${item.id}: Prüfdatum fehlt`);
  if (!(item.phones ?? []).length && !item.url) curatedProblems.push(`${item.id}: weder Telefon noch URL`);
}
if (curatedProblems.length) console.warn(`Hinweise zu wichtigen Kontakten:\n- ${curatedProblems.join('\n- ')}`);

const curatedUrlById = new Map();
for (const item of wichtigeKontakte.items ?? []) {
  if (!item?.id || !item?.name) continue;
  const url = `${item.sourceUrl || item.url || 'https://www.stuttgart.de/service/notdienste/'}#kontakt-${item.id}`;
  curatedUrlById.set(item.id, url);
  const phones = (item.phones ?? []).map((p) => `${p.label ?? 'Telefon'}: ${p.number}`).join(' · ');
  const text = [
    item.name,
    item.organization,
    item.description,
    item.street,
    [item.postalCode, item.city].filter(Boolean).join(' '),
    item.availability,
    phones,
  ].filter(Boolean).join('\n');
  docMap.set(url, {
    source: item.source || 'Open Stuttgart – Kontaktregister',
    canonical_url: item.sourceUrl || item.url || url,
    title: item.name,
    doc_type: 'kontakt',
    summary: short(item.description || item.organization || item.name),
    text: cleanText(text),
    fetched_at: item.checked ?? wichtigeKontakte.stand ?? null,
    modified_at: item.checked ?? wichtigeKontakte.stand ?? null,
    district: null,
    lat: item.lat ?? null,
    lon: item.lon ?? null,
    parent_url: null,
    status: 'active',
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

// 7b. Kontaktregister aus Dienststellen + redaktionellen Einträgen
console.log('Baue Kontaktregister …');
const insContact = db.prepare(`INSERT OR REPLACE INTO contacts
  (id,document_id,kind,name,organization,category,description,street,postal_code,city,district,lat,lon,building_id,
   phones_json,email,url,booking,hours_json,hours_text,availability,priority,emergency,source,source_url,checked_at,confidence)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insContactService = db.prepare(`INSERT OR REPLACE INTO contact_services
  (contact_id,ord,name,url,online,document_id) VALUES (?,?,?,?,?,?)`);

// Leistungen je Einheit einmal einlesen, damit die Suche nach Anliegen
// („Reisepass“, „Fundsachen“) auch die richtige Dienststelle findet.
const servicesByUnit = new Map();
for (const row of src.prepare(`SELECT le.einheit_url, l.name, l.url, l.digitaler_dienst
  FROM leistung_einheit le JOIN leistungen l ON l.url = le.leistung_url
  ORDER BY le.einheit_url, l.name`).all()) {
  let list = servicesByUnit.get(row.einheit_url);
  if (!list) { list = []; servicesByUnit.set(row.einheit_url, list); }
  if (!list.some((x) => x.url === row.url)) list.push({ name: row.name, url: row.url, online: !!row.digitaler_dienst });
}

const servicesTextByContact = new Map();
let contactCount = 0;
db.exec('BEGIN');
for (const row of einheiten) {
  const url = normUrl(row.url);
  const docId = idByUrl.get(url);
  if (!docId) continue;
  const contactId = contactIdFromUrl(url);
  const phones = parsePhones(row.telefon_json);
  const hours = parseHoursGroups(row.oeffnungszeiten_text, row.oeffnungszeiten_json);
  const dienste = (servicesByUnit.get(row.url) ?? []).slice(0, 60);
  const rubrik = rubrikOf({ ...row, wartezeit_tafel_id: row.wartezeit_tafel_id });
  const servicesText = expandContactTerms(`${row.name} ${rubrikLabel(rubrik, row.art)} ${dienste.map((s) => s.name).join(' ')}`);
  servicesTextByContact.set(contactId, servicesText);
  insContact.run(
    contactId, docId,
    kindOfRubrik(rubrik),
    row.name,
    null,
    rubrikLabel(rubrik, row.art),
    null,
    row.strasse,
    row.plz,
    row.ort,
    row.stadtbezirk ?? null,
    row.lat != null ? Number(row.lat) : null,
    row.lon != null ? Number(row.lon) : null,
    row.gebaeude_id ?? null,
    JSON.stringify(phones),
    functionalEmail(row.email),
    url,
    null,
    JSON.stringify(hours),
    clean(row.oeffnungszeiten_text) || null,
    null,
    0,
    0,
    'Landeshauptstadt Stuttgart, stuttgart.de (Organigramm)',
    url,
    row.geaendert ?? null,
    'amtlich',
  );
  dienste.forEach((s, ord) => {
    insContactService.run(contactId, ord, s.name, s.url, s.online ? 1 : 0, idByUrl.get(normUrl(s.url)) ?? null);
  });
  contactCount += 1;
}

const curatedStand = wichtigeKontakte.stand ?? null;
for (const item of wichtigeKontakte.items ?? []) {
  if (!item?.id || !item?.name) continue;
  const docId = idByUrl.get(curatedUrlById.get(item.id)) ?? null;
  const phones = (item.phones ?? []).map((p) => ({ label: p.label ?? 'Telefon', number: String(p.number ?? '').trim() })).filter((p) => p.number);
  servicesTextByContact.set(item.id, expandContactTerms(`${item.name} ${item.organization ?? ''} ${item.category ?? ''} ${item.description ?? ''}`));
  insContact.run(
    item.id,
    docId,
    item.kind || 'behoerde',
    item.name,
    item.organization ?? null,
    item.category ?? 'Behörde',
    item.description ?? null,
    item.street ?? null,
    item.postalCode ?? null,
    item.city ?? null,
    null,
    item.lat ?? null,
    item.lon ?? null,
    null,
    JSON.stringify(phones),
    functionalEmail(item.email),
    item.url ?? item.sourceUrl ?? null,
    null,
    '[]',
    null,
    item.availability ?? null,
    Number(item.priority) || 0,
    item.emergency ? 1 : 0,
    item.source || 'Open Stuttgart – Kontaktregister',
    item.sourceUrl || item.url || null,
    item.checked ?? curatedStand,
    item.confidence || 'redaktionell geprüft',
  );
  contactCount += 1;
}
db.exec('COMMIT');
const coverage = db.prepare(`SELECT
  sum(CASE WHEN phones_json != '[]' THEN 1 ELSE 0 END) AS mit_telefon,
  sum(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS mit_email,
  sum(CASE WHEN hours_json != '[]' THEN 1 ELSE 0 END) AS mit_zeiten
  FROM contacts`).get();
console.log(`Kontakte: ${contactCount} (${coverage.mit_telefon} mit Telefon, ${coverage.mit_email} mit E-Mail, ${coverage.mit_zeiten} mit Öffnungszeiten)`);

// FTS für Kontakte (Telefonnummern sind mitindexiert, damit „112“ sofort trifft).
db.exec('BEGIN');
const insContactFts = db.prepare('INSERT INTO contacts_fts (id,name,organization,category,description,address,services,phones) VALUES (?,?,?,?,?,?,?,?)');
for (const c of db.prepare('SELECT id,name,organization,category,description,street,postal_code,city,phones_json FROM contacts').all()) {
  const address = [c.street, [c.postal_code, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  let phones = '';
  try { phones = (JSON.parse(c.phones_json ?? '[]')).map((p) => `${p.label} ${p.number}`).join(' '); } catch { /* egal */ }
  insContactFts.run(c.id, c.name, c.organization ?? '', c.category ?? '', c.description ?? '', address, servicesTextByContact.get(c.id) ?? '', phones);
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
meta.run('contacts', String(contactCount));
meta.run('contact_stand', wichtigeKontakte.stand ?? '');
meta.run('fts', 'FTS5, unicode61 remove_diacritics 2');
meta.run('vectors', existsSync(join(ROOT, 'node_modules/sqlite-vec')) ? 'vec0 angelegt, Embeddings ausstehend' : 'sqlite-vec nicht installiert');
db.exec('PRAGMA optimize');
db.close();
src.close();
console.log(`Fertig: ${DST}`);
console.log({ documents: docMap.size, services: serviceIdByUrl.size, contacts: contactCount, links, chunks });
