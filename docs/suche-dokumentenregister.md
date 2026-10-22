# Everything Search und Dokumentenregister

Stand 21.10.2026. Die erste Ausbaustufe ist eingebaut: eine lokale SQLite-Datenbank mit
FTS5-Volltextsuche, Dokumentenregister, Leistungsabläufen, Bezugsquellen und Backlinks.
Vektoren sind mit `sqlite-vec` vorbereitet; die Embeddings folgen in der nächsten Stufe.

## Datenbasis

Quelle ist `server/data/verwaltung.sqlite` aus dem vorhandenen Crawl:

| Tabelle | Anzahl |
|---|---:|
| Seiten | 9.629 |
| Leistungen | 407 |
| Einheiten/Dienststellen | 5.375 |
| Gebäude | 2.845 |
| Links | 167.098 |
| Online-Angebote | 675 |

Daraus entstehen in `server/data/suche.sqlite`:

- **10.289 Dokumente** (Seiten, Leistungen, Dienststellen, Online-Dienste, Pressemitteilungen)
- **392 Leistungen** mit **2.075 Ablaufschritten**
- **4.195 Bezugsquellen** (zuständige Stellen, Online-Dienste)
- **167.098 Links**, davon **100.806** auf ein bekanntes Dokument aufgelöst
- **10.200 Textchunks** für die spätere Vektorisierung
- FTS5-Index mit `unicode61 remove_diacritics 2`

## Aufbau

```
scripts/build-search-db.mjs   → erzeugt server/data/suche.sqlite
server/sources/search.mjs     → Suche, Dokument, Related, Stats
server/index.mjs              → /api/search, /api/search/suggest, /api/search/stats, /api/documents/:id
src/components/EverythingSearch.tsx → Cmd/Ctrl+K-Palette und Dokumentenleser
```

### Tabellen

- `documents` – URL, Titel, Typ, Zusammenfassung, Text, Hash, Datum, Bezirk, Koordinaten
- `document_links` – Von/nach, Ankertext, Typ (intern, extern, PDF, Online-Dienst)
- `services` – Leistung, LEIKA, Rechtsgrundlage, Gebühren, Bearbeitungsdauer
- `service_steps` – geordnete Ablaufschritte (Voraussetzungen, Unterlagen, Ablauf …)
- `service_sources` – zuständige Stellen und Online-Dienste je Leistung
- `document_chunks` – Textchunks, Embedding-Spalte für Phase 2
- `vec_chunks` – `sqlite-vec`-Tabelle (`float[384]`), noch ohne Embeddings
- `documents_fts` – FTS5 über Titel, Zusammenfassung und Text

## API

| Endpunkt | Zweck |
|---|---|
| `GET /api/search?q=…&type=…&limit=20&offset=0` | Volltextsuche mit Facetten; leere Anfrage liefert zuletzt geänderte Dokumente |
| `GET /api/search/suggest?q=…` | max. 8 Titelvorschläge |
| `GET /api/search/stats` | Umfang, Typen, FTS-/Vektorstatus |
| `GET /api/documents/:id` | Dokument, Leistung, Ablauf, Quellen, Backlinks, Related, Chunks |
| `GET /api/documents/:id/related` | verwandte Dokumente über gemeinsame Links |

## UI

- **Cmd/Ctrl+K** oder „Alles durchsuchen“ unter der Haltestellensuche öffnet die Palette.
- Treffer gruppiert nach Typ, mit Quelle, Bezirk, Änderungsdatum und hervorgehobenem Snippet.
- Dokumentenleser mit:
  - Zusammenfassung und Inhalt
  - Ablauf und Zuständigkeit
  - Gebühren, Bearbeitungsdauer, Rechtsgrundlage
  - **Bezugsquellen**
  - **Verwandte Dokumente** (gemeinsame Links)
  - **Verweist hierher** (Backlinks)
  - Link zur Originalseite
- Mobil Vollbild, Desktop zentrierte Palette; bestehende Designsprache.

## Vektoren (Phase 2)

`sqlite-vec@0.1.9` ist installiert. Die Tabelle `vec_chunks` ist angelegt. Für die Befüllung
ist ein lokales Embedding-Modell vorgesehen (z. B. `multilingual-e5-small`, 384 Dimensionen),
damit keine Daten an Dritte gehen. Danach wird die Suche hybrid: FTS5/BM25 + Vektor-KNN,
fusioniert per Reciprocal Rank Fusion. Die bestehende FTS5-Suche bleibt Fallback.

## Prisma-Entscheidung

Für diese Stufe **kein Prisma**: Die Datenbank ist lokal, abgeleitet und überwiegend
read-only. FTS5 und `sqlite-vec` sind virtuelle Tabellen/Erweiterungen, die Prisma nicht
abbildet; die Kernabfragen wären ohnehin Raw SQL. Prisma wird erst interessant, wenn
Postgres + pgvector, Redaktionsworkflows und Mehrbenutzerbetrieb dazukommen.

## Grenzen

- Die Suche ist eine abgeleitete Datenbank, keine amtliche Auskunft.
- Maßgeblich sind die verlinkten Originalseiten.
- Presseartikel werden nicht als Volltext gespeichert.
- Keine Personenprofile, keine Nutzerdaten, keine externen Suchanfragen.
- Backlinks/Related sind Hinweise auf gemeinsame Bezüge, keine inhaltliche Bewertung.
- Die Datenbank muss nach einem neuen Crawl mit `npm run data:search` neu erzeugt werden.
