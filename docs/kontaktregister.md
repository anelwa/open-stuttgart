# Kontaktregister und strukturierte Dienststellen-Seiten

Stand: 22.10.2026

## 1. Ziel

Zwei Probleme werden zusammen gelöst:

1. **Lesbarkeit:** Eine Dienststelle wie das Fundbüro soll nicht als ein zu einer
   Textwüste zusammengezogener Crawl-Absatz erscheinen, sondern als kontaktfähige
   Seite: Anrufen, Mailen, Öffnungszeiten, Leistungen, Adresse, Quelle.
2. **Auffindbarkeit:** Alle wichtigen Anliegen und Stellen – Verwaltung, Notrufe,
   Notdienste, Beratung, technische Hilfe – sollen in Sekunden erreichbar sein,
   auch wenn die Datenquelle gerade nicht antwortet.

Das Register ist bewusst zweigeteilt:

| Ebene | Inhalt | Verfügbarkeit |
|---|---|---|
| **Sofort im App-Bundle** | alle 29 geprüften Notrufe/Notdienste, darunter 112, 110, 116117, Giftnotruf | ohne Netz, ohne API, ohne Wartezeit |
| **Lokales Register** | 5.400+ Dienststellen und gepflegte Notdienste | SQLite/FTS5 auf dem Server, Antwortzeiten im Millisekundenbereich |

## 2. Datenfluss

```
src/data/kontakte-wichtig.json  ──┐
                                  ├─► scripts/build-search-db.mjs ─► server/data/suche.sqlite
server/data/verwaltung.sqlite  ───┘                                   ├─ documents (FTS5)
                                                                       ├─ contacts
                                                                       ├─ contact_services
                                                                       └─ contacts_fts
```

- `scripts/build-search-db.mjs` liest den vorhandenen Crawl und die redaktionelle
  Datei. Es werden **keine** externen Anfragen gestellt.
- Die App liest über `server/sources/kontakte.mjs` und `server/sources/search.mjs`.
- Der Dokumentenleser bekommt den strukturierten Kontakt direkt mit
  `GET /api/documents/:id`; die Registeransicht nutzt `GET /api/kontakte`.

## 3. Datenmodell

### `contacts`

| Feld | Zweck |
|---|---|
| `id` | stabile Register-ID, z. B. `dst-…` oder `notruf-feuerwehr-rettungsdienst` |
| `document_id` | Verknüpfung zum durchsuchbaren Dokument |
| `kind` | `notruf`, `notdienst`, `beratung`, `technik`, `tier`, `behoerde`, `buergerbuero`, `bildung`, `dienststelle` |
| `name`, `organization`, `category` | Anzeige und Gruppierung |
| `street`, `postal_code`, `city`, `district`, `lat`, `lon`, `building_id` | Adresse und Karte |
| `phones_json` | mehrere funktionale Rufnummern mit Bezeichnung |
| `email` | nur funktionale Mailboxen |
| `url`, `booking` | Originalseite und Terminbuchung |
| `hours_json`, `hours_text`, `availability` | strukturierte Öffnungszeiten bzw. Erreichbarkeit |
| `priority`, `emergency` | Reihenfolge und Notfall-Kennzeichen |
| `source`, `source_url`, `checked_at`, `confidence` | Nachvollziehbarkeit jeder Zeile |

### `contact_services`

Verknüpft eine Dienststelle mit ihren Leistungen. Dadurch findet die Suche nach
„Reisepass“ oder „Fundsachen“ die richtige Stelle, nicht nur die Leistungsseite.

### `contacts_fts`

FTS5 über Name, Organisation, Kategorie, Beschreibung, Adresse, Leistungen und
Telefonnummern. Telefonnummern sind mitindexiert, damit `112`, `110` oder
`0711 216…` sofort treffen. `src/data/kontakte-synonyme.json` übersetzt
Alltagsbegriffe in die Amtssprache („Müll“ → Abfall, „Pass“ → Reisepass,
„Heirat“ → Eheschließung/Standesamt). Die Synonyme wirken beim Aufbau des
Index und bei der Suche, damit auch Leistungsnamen ohne den Alltagsbegriff
gefunden werden.

## 4. Formatierung

Der Dokumentenleser entscheidet nach `doc_type` bzw. vorhandenem `contact`:

- **Dienststelle / Kontakt:** `KontaktBody` mit Status, Aktionsknöpfen, Kontaktwegen,
  Öffnungszeiten-Gruppen, Leistungen, Adresse und Quellenzeile. Der flache
  „Inhalt“-Block entfällt.
- **Leistung:** Ablauf, Zuständigkeit, Gebühren, Schritte und Orte (unverändert).
- **Seite / Pressemitteilung:** Absätze bleiben erhalten, weil `cleanText()` die
  Absatzmarke `U+0002` aus dem Crawl in Zeilenumbrüche übersetzt. Vorher wurde
  daraus ein ` · ` mitten im Satz.
- **Verwandte Dokumente:** gemeinsame Links werden nach Seltenheit gewichtet.
  Globale Navigationsziele (Kontakt, Impressum, Startseite) fallen heraus; für
  Kontaktseiten wird der Block ausgeblendet, weil die Leistungsliste präziser ist.

### Öffnungszeiten

Die Stadt liefert die Zeilen als Text und JSON, aber ohne Gruppen. Der Parser
erkennt Wochentage und Zeitangaben und macht jede Überschrift („Bürgersprechstunde“,
„Telefonische Erreichbarkeit“, „Termine nach Vereinbarung“) zu einer eigenen Gruppe.
Nicht lesbare Angaben bleiben als Text stehen; es wird nichts geraten.

## 5. Zuverlässigkeit

- **Quelle an jedem Eintrag:** `source`, `source_url`, `checked_at`.
- **Vertrauensstufe:** `amtlich` für Crawl- und Behördenangaben,
  `redaktionell geprüft` für die gepflegten Notdienste.
- **Keine Personenprofile:** Telefonlabels werden von „Frau/Herr …“ befreit;
  persönliche Mailadressen und Freemail-Adressen ohne Funktionsbezug werden
  nicht ins Register übernommen.
- **Keine erfundenen Nummern:** Was nicht belegt ist, wird verlinkt statt geschätzt.
  Apotheken-Notdienst und 116117 bleiben Deep Links auf die offiziellen
  Live-Suchen, weil es keine offene API gibt.
- **Notfall-Hinweis:** Im Notfall gilt immer die 112; die Registerangaben sind
  ohne Gewähr und ersetzen keine amtliche Auskunft.

## 6. Vollständigkeit

Das Register enthält derzeit:

- alle Einheiten aus dem Verwaltungs-Crawl (5.375),
- 29 redaktionell geprüfte Notrufe, Notdienste und Beratungsstellen,
- Verknüpfung zu den Leistungen der Einheiten.

Sinnvolle nächste Quellen:

1. **Kliniken und Notaufnahmen** aus dem städtischen Notdiensteverzeichnis
   (bereits als kuratierte Einträge angelegt).
2. **Apotheken** aus dem WFS-/OSM-Bestand; der Notdienst bleibt Deep Link.
3. **Soziale Einrichtungen** aus den WFS-Layern (Jugendtreffs, Beratungsstellen),
   sofern Kontakt und Träger sauber getrennt sind.
4. **Bürgertelefon / Servicecenter** der Stadt, sobald eine belastbare
   Schnittstelle oder redaktionelle Freigabe vorliegt.
5. **Monitoring:** ein kleiner Check, der tote Telefonnummern nicht erkennt,
   aber fehlende Quellen, doppelte Nummern und veraltete `checked_at`-Werte meldet.

## 7. Pflege

1. Eintrag in `src/data/kontakte-wichtig.json` ändern oder ergänzen.
2. `npm run data:search` ausführen.
3. `npm run check:kontakte` ausführen (Vollständigkeit, Quellen, Telefonformate).
4. `npm run build` und die Registeransicht prüfen.
5. Änderung mit Quelle und Prüfdatum committen.

Für Nummern gilt: **erst auf der offiziellen Seite verifizieren, dann eintragen.**
Die Datei ist absichtlich klein und lesbar; sie ist kein Crawl-Ersatz, sondern die
redaktionelle Ebene über dem Crawl.

## 8. API

| Endpunkt | Zweck |
|---|---|
| `GET /api/kontakte?q=…&gruppe=…&kind=…&limit=…` | Registersuche, ohne `q` die wichtigsten Einträge |
| `GET /api/kontakte/:id` | ein Kontakt inklusive Leistungen |
| `GET /api/kontakte/stats` | Anzahl, Abdeckung, Gruppen, Stand |
| `GET /api/documents/:id` | Dokument inklusive `contact` (für den Leser) |
| `GET /api/search?q=…` | gemeinsame Suche; Kontakte erscheinen als Typ „Kontakt“ |

## 9. Grenzen

- Keine Live-Notdienstbelegung (Apotheken, Bereitschaftspraxen) ohne offizielle API.
- Keine Garantie auf Aktualität; `checked_at` und Quellenlink sind Pflicht.
- Keine personenbezogenen Kontakte.
- Die Registeransicht ist keine amtliche Auskunft.
