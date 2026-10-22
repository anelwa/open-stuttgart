# Schnittstellen im weiten Sinn: Standards, Netze und Anschlusspunkte für Open Stuttgart

Stand: 22.10.2026 · Status: **Recherche — Vorschläge zur Auswahl, nichts davon ist umgesetzt**

Ergänzung zu [`api-recherche-2026-10-ergaenzungen.md`](api-recherche-2026-10-ergaenzungen.md)
und [`api-recherche-lifestyle.md`](api-recherche-lifestyle.md). Während dort klassische
REST-/WebSocket-Endpunkte im Mittelpunkt stehen, sammelt dieses Dokument **Schnittstellen im
anderen Sinn**: offene Normen statt proprietärer APIs, Protokolle statt Datenpunkte, physische
Anschlusspunkte im Stadtraum und Ausgabe-Schnittstellen, über die andere Open Stuttgart
*wiederverwenden* können. Leitfrage: Was macht aus einer Web-App ein **Datenprodukt** und aus
der Stadt eine **dokumentierte Umwelt**?

Bewertungskriterien wie in der API-Recherche (kostenlos, offene Lizenz, serverseitiger Proxy,
schonende Intervalle, Mehrwert gegenüber dem Bestand) — ergänzt um:

6. **Out of the box:** verbindet Bereiche, die bisher nichts miteinander zu tun haben
7. **High Value:** Nutzen für Menschen, die eine Karte allein nicht erreicht (Sprache,
   Straße, Verwaltung, andere Software)

Die geprüften Endpunkte sind mit **geprüft 22.10.2026** markiert. Alles andere ist ein
Vorschlag mit Klärungsbedarf und entsprechend gekennzeichnet.

---

## 1. Offene Standards statt eigener APIs

### 1.1 Open311 / GeoReport v2 — die Schnittstelle zur Gelben Karte ⭐⭐⭐

Die **Gelbe Karte** (`https://www.stuttgart.de/service/gelbe-karte/`, seit 1997) ist
Stuttgarters offizieller Kanal für Ideen und Beschwerden im öffentlichen Raum — inklusive
öffentlich einsehbarer Statistik. Sie hat **keine offene Schnittstelle**.

* **Standard:** Open311 GeoReport v2 (Spezifikation geprüft 22.10.2026:
  <https://wiki.open311.org/GeoReport_v2/>) mit `GET /services.json` (Kategorien),
  `GET /requests.json` (Meldungen, filterbar nach bbox/status), `GET /requests/{id}.json`,
  `POST /requests` (neue Meldung, inkl. Foto)
* **Warum das die wichtigste Schnittstelle des Projekts wäre:** Es ist die einzige
  Stelle, an der die Schnittstelle **in beide Richtungen** geht — nicht nur „Was die Stadt
  weiß", sondern „Was die Bürger der Stadt sagen". Das Projekt hat heute keine einzige
  Schreib-Schnittstelle.
* **Realistischer Weg:** Kein Crawl. Der Markt ist nicht leer: Verwaltungssoftware-Hersteller
  implementieren Open311 bereits (SUE V2, geprüft 22.10.2026) — die Frage an die Stadt ist
  also nur, ob die Gelbe-Karte-Installation freigeschaltet wird. Anfrage analog zu
  [`anfrage-allris-oparl.md`](anfrage-allris-oparl.md) formulieren, Angebot:
  Open Stuttgart übernimmt Client und Kartenansicht.
* **Zwischenlösung ohne Freigabe:** Die öffentliche **Statistik-Seite der Gelben Karte**
  auswerten (Kategorien, Anzahl, Bezirk) und als Zahlen-Ebene zeigen — reine Auswertung
  öffentlicher Zahlen, keine Meldungsdaten.
* Aufwand: Anfrage = Tage; eigener Open311-Client (`server/sources/open311.mjs`) = 2–3 Tage,
  sobald ein Endpoint existiert
* Lizenz/Recht: Meldungen sind Verwaltungsakte; bei Freigabe explizit Lizenz und
  Anonymisierung (Namen, Adressen) klären

### 1.2 DCAT-AP / GovData- und mCLOUD-Katalog als „Change Feed" ⭐⭐⭐

* **Endpunkte (geprüft 22.10.2026):** `https://www.govdata.de/ckan/api/3/action/package_search`
  und `https://www.mcloud.de/` (ebenfalls CKAN-API), beide für `fq`-Abfragen filterbar
  nach Herausgeber „Landeshauptstadt Stuttgart"
* **Die Schnittstelle ist hier der Katalog selbst:** DCAT-AP ist die Norm, in der
  deutsche Open-Data-Portale ihre Datensätze beschreiben. Ein eigener kleiner
  `scripts/check-neue-datensaetze.mjs` (analog zu `check-wasgeht-quellen.mjs`) diffed den
  Katalog gegen den letzten Stand und trägt Neuzugänge ins **Stadtgedächtnis** ein.
* **Warum High Value:** Das Projekt altert damit nie. Jeder neue Datensatz der Stadt
  erscheint automatisch als Vorschlag, statt dass jemand manuell stöbert —
  „Was die Stadt weiß" wächst mit, ohne Entwicklungsaufwand.
* Aufwand: gering (1–2 Tage, reines Diffing + RSS-Ausgabe)
* Lizenz: Katalog-Metadaten CC0

### 1.3 CAP (Common Alerting Protocol) für Warnmeldungen ⭐

* Die Warnkette MoWaS/KATWARN/DWD liefert Warnungen offiziell als **CAP-XML** — das ist der
  internationale Standard (auch von FEMA/IPAWS genutzt), nicht unser JSON-Parsing.
* Nutzen: strukturierte `severity`/`area`/`certainty`-Felder ersetzen heuristisches
  Auslesen; Warn-Polygone sind direkt als Polygon nutzbar (siehe `server/sources/hitze.mjs`)
* Vorhandenes teilweise nutzen; Umstellung nur, wenn ohnehin angefasst

### 1.4 SensorThings API (OGC) / NGSI-LD — der Smart-City-Standard ⭐

* **SensorThings API** (<https://www.ogc.org/standards/sensorthings>, FROST-Server als
  quelloffene Referenzimplementierung) ist der offene Standard für Sensor-Observationen
  (Things → Locations → Datastreams → Observations). **NGSI-LD** (FIWARE) ist das
  Pendant für Kontextdaten (Lampen, Schranken, Parkplätze).
* Heute kommt das Projekt mit eigenen Formaten aus (`Sensor.Community`, `openSenseMap`,
  ParkAPI). Der Punkt ist strategisch: **falls die Stadt jemals eigene Sensorik
  ausschreibt**, ist die Wahrscheinlichkeit hoch, dass SensorThings/NGSI-LD im Lastenheft
  steht. Dann ist Open Stuttgart ohne Umbau anschließbar.
* Aufwand: jetzt keiner — nur im Kopf behalten, keine eigenen proprietären Sensorformate
  erfinden

---

## 2. Physische Schnittstellen in den Stadtraum

### 2.1 QR-/NFC-Tags als Brücke Straße ↔ Bildschirm ⭐⭐⭐

* **Die Idee:** Jedes Objekt, das das Projekt schon kennt (Baumkataster-ID, Denkmal,
  Haltestelle, Brunnen, Notfall-Treffpunkt), bekommt einen QR-Code mit Deep Link
  `https://open-stuttgart.de/o/<typ>/<id>` — die App wird zum **Erklärer der realen Welt**.
  Kein Login, kein App-Store, kein nfc-spezifisches Backend: die vorhandenen
  `/api/*`-Routen und das vorhandene Routing reichen.
* **Warum out of the box:** Die Schnittstelle ist physisch. Sie erreicht Menschen, die nie
  nach „Open Data" suchen würden, an dem Ort, an dem die Frage entsteht („Was ist das für
  ein Baum?", „Wann kommt die Bahn?").
* **Konkreter erster Schritt:** Statt Schilder zu drucken — ein **Ausdruck-Modul**
  „Schild für diesen Baum/diesen Brunnen erzeugen" (DIN-A6-PDF mit QR, Objektname,
  Kurzinfo, Quelle). Damit kann der Verein, die Schule, die Hausverwaltung selbst drucken;
  die Stadt kann später offiziell nachziehen.
* Aufwand: gering (Deep Links existieren implizit, 2–3 Tage für Stable-IDs + Druck-PDF);
  Schilder selbst sind kein Software-Aufwand

### 2.2 Kiosk-/Public-Display-Modus ⭐⭐

* Dasselbe Frontend, anderes Profil: `?display=kiosk` mit großer Schrift, auto-rotierenden
  Panels (Abfahrten, Wartezeit Bürgerbüro, Was geht, Regen) und ohne Bedienelemente.
* Zielorte: Bürgerbüros (Wartezeit!), Hochschulen, Rathaus, Jugendhäuser, Stadtteilbibliotheken.
* Technisch: ein CSS-/Zustandsprofil, kein neuer Datenkanal. Browser-Kiosk-Modus auf
  vorhandener Hardware; `localStorage`-Persistenz der gewählten Haltestelle.
* Aufwand: mittel (3–5 Tage Design + Umsetzung), hohe Sichtbarkeit

---

## 3. Zugänglichkeits-Schnittstellen

### 3.1 Sprachschnittstelle: Telefon-IVR / Sprachassistent / TTS ⭐⭐

* **Die Idee:** Dieselben JSON-Ausgaben als Sprachdienst: „Was geht heute in Stuttgart?",
  „Wann fährt die U6?", „Ist das Bürgerbüro voll?" — per Sprachassistent-Skill,
  Telefonansage (IVR) oder TTS-Ausgabe im Browser (Web Speech API, kein Server nötig).
* **Warum High Value:** Erreicht eine Zielgruppe, die eine Karte strukturell nicht nutzt
  (ältere Menschen, Sehbehinderte, Menschen ohne Smartphone). Für eine Kommune ist das ein
  starkes Argument in Förderanträgen und Presse.
* Realistischster Einstieg: **TTS-Button** im Abfahrts- und Termin-Panel („Vorlesen"),
  danach ein einfacher Telefon-/IVR-Prototyp auf Basis der vorhandenen API.
* Aufwand: TTS im Frontend 1–2 Tage; IVR/Skill = eigene Geschichte (Später)

### 3.2 Leichte Sprache & Ausgabe-Profil für Assistenztechnik ⭐

* Dasselbe Datenmodell, anderes Ausgabeprofil: kurze Sätze, eindeutige Wörter, feste
  Reihenfolge (BITV 2.0 / EN 301 549). Rein strukturell: eine
  `/api/leicht/*`-Ebene, die vorhandene Antworten in vereinfachte Sätze übersetzt.
* Schnittstellen-Charakter: Die API-Antworten sind ohnehin maschinenlesbar — damit kann
  **jede** Assistenztechnik (Screenreader, Braillezeile, Vereins-Newsletter) darauf
  aufbauen. Dokumentieren, nicht nur bedienen.

---

## 4. Transparenz-Schnittstellen (Verwaltung → Öffentlichkeit)

### 4.1 FragDenStaat (IFG-Anfragen an die Stadt) ⭐⭐⭐

* **Endpunkt (geprüft 22.10.2026):** `https://fragdenstaat.de/api/v1/` —
  OpenAPI-Schema unter `https://fragdenstaat.de/api/v1/schema/`, browsbare Swagger-UI.
  Relevante Ressourcen: `GET /api/v1/request/` (Anfragen) und
  `GET /api/v1/publicbody/` (Behörden, `?q=…&format=json`).
  Beispiel: `GET /api/v1/publicbody/?q=Landeshauptstadt%20Stuttgart&format=json`
  liefert die Stadtkörperschaft **ID 9384** (Stand 22.10.2026: **306 Anfragen**) sowie
  Unterbehörden (u. a. Amt für öffentliche Ordnung, Gesundheitsamt, Ausländerbehörde,
  Stadtvermessungsamt).
  Die Anfragen dazu: `GET /api/v1/request/?public_body=9384&format=json`
  (Stand 22.10.2026: **285**, Filter heißen `public_body` mit Unterstrich, der
  Behörden-Endpunkt dagegen `publicbody`).
* Die API ist laut Doku für maschinenlesbaren Zugriff gedacht; Schreibzugriff (Anfrage
  stellen) läuft über OAuth. Für den Layer genügt Lesen ohne Account.
* **Die Idee:** Laufende Auskunftsbegehren als **Transparenz-Layer**: „Was wurde das
  Rathaus in den letzten 12 Monaten gefragt?" — mit Status (offen/beantwortet), Thema,
  Link zur vollständigen Antwort. Ergänzt das Stadtgedächtnis um die Sicht von außen.
* Warum out of the box: Es ist die einzige Quelle, die zeigt, **was die Stadt nicht von
  sich aus veröffentlicht** — genau die Lücke, die „Was die Stadt weiß" ehrlich macht.
* Aufwand: mittel (2–3 Tage, nur Lesen); Lizenzen/ToS vorher klären

### 4.2 Offener Haushalt / Transparenzportal BW ⭐

* `https://offenerhaushalt.de/` (Open Knowledge Foundation) und
  `https://transparenz-bw.de/` (Landesrechnungshof) — jeweils als Darstellungs- und
  Download-Schnittstellen für Haushaltsdaten.
* Idee: **„Wofür wird in meinem Bezirk Geld ausgegeben?"** als Karten-/Adressprofil-Ebene
  (Einnahmen/Ausgaben je Planstelle, Kultur, Verkehr, Grünflächen).
* Status: **zu prüfen**, ob Stuttgart kommunale Haushaltsdaten maschinenlesbar liefert
  (sonst PDF-Weg, siehe CKAN-Datensätze der API-Recherche 2.3). Politisch heikler als
  andere Layer — sachlich bleiben, Quelle immer zeigen.
* Aufwand: hoch (Datenbeschaffung!), Nutzen hoch

### 4.3 OParl / ALLRIS — siehe eigene Vorbereitung

Ausgearbeitet in [`anfrage-allris-oparl.md`](anfrage-allris-oparl.md). Hier nur der
Verweis: OParl ist der Standard-Schnittstellenfall „Verwaltung nach außen" und gehört
thematisch in diesen Baukasten.

---

## 5. Wissens-Graphen (Linked Data statt Scraping)

### 5.1 Wikidata SPARQL — nicht nur abrufen, sondern fragen ⭐⭐

* **Endpunkt (geprüft 22.10.2026):** `https://query.wikidata.org/sparql`
  (`GET` mit `format=json`), Daten **CC0**
* Das Projekt nutzt Wikidata schon für Sehenswürdigkeiten (Kurztext, Bild). Der
  Sprung ist **SPARQL statt Einzelabfrage** — damit werden *Lücken* sichtbar:
  * „Denkmäler in Stuttgart ohne Wikipedia-Artikel" → Wissenslücken-Karte
  * „Alle Vereine/Stadtteile mit fehlendem Gründungsdatum"
  * Abgleich der eigenen POIs gegen den Wissensgraph („Dieses Museum hat kein Bild")
* Ergibt ein eigenes Feature **„Was fehlt im Netz?"** — das Projekt wird zum
  Qualitätssicherungs-Werkzeug für die Wissensbasis der Stadt.
* Aufwand: mittel (2–3 Tage für die drei Abfragen + UI), kein Key

### 5.2 GND über SRU — normierte Identitäten ⭐

* **Endpunkt:** SRU der Deutschen Nationalbibliothek,
  `https://services.dnb.de/sru/gnd` (Standard-SRU, `version=1.1&operation=searchRetrieve`;
  geprüft 22.10.2026, liefert Treffer für `WOE=Stuttgart`)
* GND liefert **normierte IDs für Personen, Körperschaften, Orte und Straßen**. Ein
  Veranstalter/„Verein" bekommt damit eine stabile Identität über Quellen hinweg
  (Stadtkalender ↔ Gancio ↔ Vereinsregister ↔ Wikidata).
* Praktischer Nutzen: Deduplizierung bei der Termin-Zusammenführung (siehe „Termine"
  im README) und Querverweise „Dieser Verein hat auch eine Wikipedia-Seite".
* Aufwand: gering für gezielte Aufrufe; Lizenz GND: CC BY 4.0 (Namensnennung!)

### 5.3 Deutsche Digitale Bibliothek & Europeana — historische Bestände ⭐⭐

* **DDB-API** `https://api.deutsche-digitale-bibliothek.de/` (kostenloser Key,
  Registrierung nötig), **Europeana-API** `https://api.europeana.eu/` (ebenfalls Key,
  free tier). Beide Roots waren am 22.10.2026 erreichbar; die eigentlichen
  Such-Endpunkte verlangen den Key (ohne Key kein Datenzugriff).
* Idee: „Historische Bilder zu diesem Ort" — Ortssuche über die Karte, Ergebnis aus
  Stadtarchiv/Landesarchiv-Beständen, ergänzt die vorhandenen Luftbilder (2006–2025)
  um **Fotos, Karten und Dokumente**.
* Passt direkt in das Modul **Stadtgedächtnis**; die DDB ist ohnehin der Aggregator,
  über den Stadtarchiv-Digitalisate laufen.
* Aufwand: mittel (Keys + bbox-Suche + UI); Lizenz je Objekt beachten (i. d. R. Rechteangabe im Datensatz)

---

## 6. Archiv- und Bild-Schnittstellen

### 6.1 IIIF — der Standard für Digitalisate ⭐⭐

* **IIIF Presentation & Image API** (<https://iiif.io/api/>, geprüft 22.10.2026;
  Referenz: Bayrische Staatsbibliothek `digitale-sammlungen.de`, DDB unterstützt IIIF)
* Statt eigener Bildpfade/Zoom-Logik: **IIIF-Manifeste einbetten**. Ein Viewer
  (OpenSeadragon/Universal Viewer, beide frei) rendert hochauflösende Digitalisate,
  Deep-Links, Ausschnitte (`/full/!800,800/0/default.jpg`).
* Konkreter Nutzen für Open Stuttgart:
  * historische Luftbilder/Stadtpläne (CKAN-Datensätze der API-Recherche 2.3) als
    **zoombare, zitierfähige Objekte** statt statischer PNGs
  * „Zeitungsartikel zur Baustelle in meiner Straße" — Ausschnitts-Links statt PDF
* Der Schnittstellen-Gedanke: Wer IIIF kann, kann jedes Archiv der Welt einbetten —
  Landesarchiv BW, Stadtbibliothek, Museen. Die Investition ist einmalig, das
  Ökosystem wächst weiter.
* Aufwand: mittel (Viewer-Einbindung 2–3 Tage; eigene IIIF-Auslieferung nur, wenn
  eigene Scans dazukommen)

### 6.2 SRU / OAI-PMH — Bibliotheks- und Archivkataloge ⭐

* **SRU** (`https://sru.k10plus.de/opac-de-627`, K10plus/Südwestdeutscher
  Bibliotheksverbund; geprüft 22.10.2026, `searchRetrieve` mit `pica.all=Stuttgart`
  liefert Treffer) ist der maschinenlesbare Standard für **Bibliothekskataloge**;
  **OAI-PMH** der Standard für Archiv-Metadaten (`verb=ListRecords`).
* Idee: „Bücher zur Stuttgarter Stadtgeschichte — in welcher Bibliothek, mit Ausleihstatus?"
  als Kultur-/Bildungs-Ergänzung; OAI-PMH für Findmittel des Stadtarchivs.
* Aufwand: gering–mittel; **zu prüfen**, welche Stadtbibliothek-Schnittstelle exakt
  existiert (OPAC-Systemabhängig)

---

## 7. Bürger-Wissenschaft & Spenden-Schnittstellen

### 7.1 OSM Notes API — die Schreib-Schnittstelle der offenen Karte ⭐⭐

* **Endpunkt:** `https://api.openstreetmap.org/api/0.6/notes` (Lesen offen;
  Schreiben erfordert OSM-Login, was für Nutzer:innen des Projekts keine Hürde ist —
  OSM-Konto ist gratis)
* Das Projekt liest OSM-Änderungen schon im Stadtgedächtnis. Die **Notes API** ist die
  Rückrichtung: „Hier fehlt ein Trinkbrunnen" erzeugt eine OSM-Note am richtigen Ort —
  sichtbar für die weltweite OSM-Community, nicht in einer lokalen Silo.
* Warum High Value: Jede Meldung verbessert **alle** Karten der Welt, nicht nur unsere.
  Und: Das Projekt muss keine eigene Fehler-DB pflegen.
* Aufwand: gering (2 Tage für „Problem melden"-Button mit bbox + Notiztext)

### 7.2 Foodsharing / Fairteiler ⭐⭐

* **API-Doku:** `https://foodsharing.de/api/doc` (geprüft 22.10.2026, OpenAPI 3.0,
  226 Pfade); Plattform ist **AGPLv3** quelloffen (GitLab foodsharing-dev)
* **Geprüft 22.10.2026 — der öffentliche Einstieg existiert:**
  `GET https://foodsharing.de/api/regions/48/public` liefert **ohne Login** die Region
  Stuttgart (ID 48) inklusive `foodSharePoints`: **12 Fairteiler** mit Name, Koordinaten
  und ID (Degerloch, HobbyHimmel, Sillenbuch, Raupe Immersatt, AWO Dürrlewang …).
  Ebenfalls offen: `GET /api/map/markers/regions` (557 Regionen) — gut zum Verorten.
* **Nicht offen (401 „Not logged in"):** `GET /api/baskets/nearby` (Essenskörbe) und
  `GET /api/regions/48/food-share-points` — diese Details bleiben eingeloggten
  foodsharing-Mitgliedern vorbehalten. Also **keine** Live-Status-/Korb-Daten ohne
  Vereinbarung, aber die Fairteiler-Standorte selbst sind nutzbar.
* Idee: Fairteiler als Layer in „Essen und Trinken" (Name, Koordinaten, Link auf
  foodsharing), ohne Status-Behauptung. Ein „gerade voll/leer"-Crowd-Status (wie das
  Aachener fairteiler-Projekt) wäre ein späteres Community-Feature — nicht Teil des
  offenen Endpoints.

### 7.3 GBIF — Arten als Forschungsdaten ⭐

* **Endpunkt (geprüft 22.10.2026):** `https://api.gbif.org/v1/occurrence/search`
  (kostenlos, kein Key, **CC0** für Occurrence-Daten)
* Ergänzt iNaturalist um **historische Funde und Herbarbelege** — „Wann wurde hier
  zuletzt eine Fledermaus dokumentiert?" im Stadt-Natur-Modul. Auch für Schulprojekte
  (Biodiversitäts-Schulhof) ein echter Bildungs-Anschluss.
* Aufwand: gering (bbox/Radius + Taxon-Filter, 1–2 Tage)

---

## 8. Ausgabe-Schnittstellen — aus der App wird ein Datenprodukt

### 8.1 Personalisierte Feeds: „Jede Ansicht als Abo" ⭐⭐⭐

* **Die Idee:** Jede Kartenansicht/Filterkombination erzeugt einen **stabilen Feed**:
  * RSS/Atom: „Unfälle im 300-m-Umfeld meiner Adresse", „Neue Baustellen in meinem Bezirk"
  * iCal/ICS: „Was geht" bereits vorhanden (`/api/wasgeht.ics`) — verallgemeinern auf
    Abfuhrtermine, Bürgerbüro-Termine, Laufzeiten von Ausstellungen
  * GeoJSON-Feed für Entwickler:innen (`?format=geojson`)
* Technisch: nur `server/index.mjs` + generierte Tokens/Hashes für die
  Filterkombination; jeder Feed bekommt eine **permanente URL**.
* **Warum High Value:** Aus einer Karte wird ein **Datenprodukt**, das andere einbetten
  (Vereins-Newsletter, Stadtteil-Website, Hausverwaltung, Schule). Genau das ist der
  „Open Data"-Anspruch des Projekts — jetzt als Feature sichtbar.
* Aufwand: mittel (3–5 Tage für generische Feed-Erzeugung + Token-Handling)

### 8.2 Permanente URLs und Zitierfähigkeit ⭐⭐

* **PURL-Prinzip:** Jedes Objekt (Baum, Unfall, Termin, Dokument) bekommt eine
  unveränderliche URL (`/o/<typ>/<id>`) — wie bei 2.1 bereits als Deep Link gedacht,
  aber auch **wissenschaftlich zitierfähig**: Änderungen am Datensatz mit Versionsstempel
  (`?v=2026-10-22`), Quelle und Lizenz immer sichtbar.
* Nutzen: Presse, Wissenschaft, Vereine können **genau verlinken**, statt „siehe Karte".
  Kleinster Aufwand, größter Reputationshebel für ein Open-Data-Projekt.

### 8.3 Web Push (VAPID) / ntfy — Benachrichtigungen ohne App ⭐⭐

* **Web Push** ist ein offener Standard (VAPID, kein Drittanbieter nötig);
  **ntfy.sh** (Open Source, selbst hostbar) als Alternative mit Topic-URLs, die man
  einfach abonnieren kann (`https://ntfy.sh/stuttgart-regen-<hash>`)
* Idee: „Regen startet an deiner Haltestelle", „Warnung in deinem Bezirk", „Bürgerbüro
  wieder leer" — als **Benachrichtigungs-Schnittstelle**, die auch andere Apps/Scripte
  abonnieren können.
* Abgrenzung zu API-Recherche 1.3 (SSE): SSE ist die Kanäle-Infrastruktur im Projekt,
  Web Push/ntfy die **nach außen gerichtete** Schnittstelle.
* Aufwand: mittel; Einwilligung/Abmeldung sauber lösen (DSGVO)

### 8.4 ActivityPub/Fediverse — die soziale Schnittstelle ⭐

* Ausgabe-Schnittstelle in den sozialen Sinn: Ein **Bot-Konto** (Mastodon etc.), das
  Neuigkeiten des Stadtgedächtnisses postet („Neue amtliche Bekanntmachung", „Neue
  Baustelle", „Unfallschwerpunkt"). Mastodon hat eine offene API, die Fediverse-Protokolle
  sind dezentral — keine Plattform-Abhängigkeit.
* Vorteil: Reichweite bei genau der Community, die offene Daten nutzt; jedes Posting
  verlinkt die permanente URL (8.2).
* Aufwand: gering (Bestehendes RSS-Postingsystem an Mastodon-API anbinden)

---

## 9. Bewusst nicht empfohlen

* **Scraping hinter Logins/ToS** (nebenan.de, Too Good To Go, Immobilienportale,
  Kinoketten-Websites) — kommerziell, rechtlich unsauber, gegen die Grundsätze des Projekts
* **Foodsharing-Live-Status/-Körbe ohne Login abrufen** (7.2) — die öffentlichen
  Fairteiler-Standorte sind okay, Körbe und Status nicht
* **Proprietäre Sprachassistenten-Walled-Gardens** (Skills mit Zwangs-Cloud-Anbindung)
  — TTS im offenen Web zuerst (3.1)
* **Eigene, neue Sensor-Formate erfinden** — stattdessen SensorThings/NGSI-LD im Kopf
  behalten (1.4)
* **Benachrichtigungen über Drittanbieter-Push-Dienste** (Firebase o. ä.) — Web Push/ntfy
  bleiben proprietätsfrei (8.3)

---

## 10. Priorisierte Roadmap

**Quick Wins (Tage, kein Key, hoher Nutzen)**

1. **Permanente URLs + Versionsstempel** für alle Objekte (8.2) — Grundlage für alles
   andere in diesem Dokument
2. **Katalog-Diffing** GovData/mCLOUD → Stadtgedächtnis (1.2)
3. **„Schild erzeugen"-PDF** mit QR-Deep-Links (2.1)
4. **TTS-Vorlesen** in Abfahrten/Terminen (3.1)
5. **GBIF-Arten** im Stadt-Natur-Modul (7.3)
6. **Fairteiler-Layer** aus dem öffentlichen Region-Endpoint (7.2) — 12 Standorte,
   kein Login, nur Quellenhinweis nötig

**Mittel (1–2 Wochen)**

7. **Generische Feeds** (RSS/iCal/GeoJSON) pro Filteransicht (8.1)
8. **OSM-Notes**-„Problem melden"-Button (7.1)
9. **Wikidata-Lücken**-Abfragen („Was fehlt im Netz?") (5.1)
10. **Kiosk-Modus** für Bürgerbüros/Hochschulen (2.2)
11. **IIIF-Viewer** für historische Luftbilder/Stadtpläne (6.1)
12. **FragDenStaat-Layer** — Read-API v1 ist geprüft, nur ToS/Lizenz klären (4.1)

**Große Brocken (mit Partnern/Klärung)**

13. **Open311 für die Gelbe Karte** — Anfrage an die Stadt, ggf. mit
    [`anfrage-allris-oparl.md`](anfrage-allris-oparl.md) bündeln (1.1)
14. **Haushaltsdaten** je Stadtbezirk (4.2)
15. **Web Push/ntfy-Benachrichtigungen** (8.3)
16. **DDB/Europeana** historische Bilder pro Ort (5.3)

---

## 11. Umsetzungsmuster im Projekt

* Neue Quellen als `server/sources/<name>.mjs` über `cache.mjs` (`politeFetch`, TTL,
  Last-Good, User-Agent `open-stuttgart/…`) — siehe API-Recherche, Abschnitt 6
* **Schreib-Schnittstellen** (OSM Notes, Open311) nie stumm: immer bestätigen, Quelle
  zeigen, Zurückziehen ermöglichen; kein Blindflug in fremde Systeme
* **Standards vor Formaten:** Wenn es einen offenen Standard gibt (CAP, IIIF, SRU, DCAT,
  GND), dessen Formular verwenden, nicht das eigene
* **Permanente URLs** (`/o/<typ>/<id>`) als Quelle in *allen* Ausgaben (Feed, Schild,
  Bildschirm, API) — einmal implementiert, überall zitierfähig
* Schalter/Keys als `OS_*`-Env-Variablen, standardmäßig aus; Feeds und Deep Links
  brauchen keine Keys und laufen immer
* Quellenangabe mit Lizenz (CC0/CC-BY/ODbL/dl-de-by) wie überall im UI

---

## 12. Prüfliste vor jeder Übernahme

1. Ist die Schnittstelle **offen dokumentiert** und in einer Norm (Standard vor Hack)?
2. Ist die Lizenz kompatibel (CC0/CC-BY/ODbL/dl-de-by) und im UI ausgewiesen?
3. Funktioniert sie **ohne Account** für Nutzer:innen (Schreib-Schnittstellen: OSM-Konto
   akzeptabel, alles andere nur mit Klarstellung)?
4. Bleibt das Projekt **ohne Drittanbieter-Abhängigkeit** betreibbar (self-hostbar)?
5. Macht sie das Projekt **offener** (Richtung nach außen) statt nur voller?

---

## 13. Prüfprotokoll 22.10.2026

Alle folgenden Endpunkte wurden mit `curl` (GET, ohne Key, ohne Login) geprüft.
HTTP-Status bezieht sich auf den tatsächlich genutzten Aufruf.

| Endpunkt | Status | Befund |
| --- | --- | --- |
| `govdata.de/ckan/api/3/action/package_search?q=stuttgart` | 200 | CKAN liefert Datensätze, u. a. Stadtmessungsamt Stuttgart |
| `mcloud.de/ckan/api/3/action/package_search?q=stuttgart` | 200 | CKAN-API erreichbar |
| `fragdenstaat.de/api/v1/publicbody/?q=Landeshauptstadt Stuttgart` | 200 | Stadtkörper ID 9384, 306 Anfragen; Unterbehörden gelistet |
| `fragdenstaat.de/api/v1/request/?public_body=9384` | 200 | 285 Anfragen an die Stadtkörperschaft |
| `services.dnb.de/sru/gnd?...query=WOE=Stuttgart` | 200 | SRU-Treffer vorhanden |
| `sru.k10plus.de/opac-de-627?...query=pica.all=Stuttgart` | 200 | Katalogtreffer vorhanden |
| `api.gbif.org/v1/occurrence/search?lat=48.7758&lon=9.1829` | 200 | Occurrence-Daten im Radius |
| `query.wikidata.org/sparql?...format=json` | 200 | SPARQL-Endpunkt antwortet |
| `foodsharing.de/api/regions/48/public` | 200 | 12 Fairteiler in Stuttgart mit Koordinaten |
| `foodsharing.de/api/map/markers/regions` | 200 | 557 Regionen, Stuttgart = ID 48 |
| `foodsharing.de/api/regions/48/food-share-points` | 401 | Login erforderlich — nicht nutzen |
| `foodsharing.de/api/baskets/nearby?...` | 401 | Login erforderlich — nicht nutzen |
| `foodsharing.de/api/doc` | 200 | OpenAPI 3.0, 226 Pfade |
| `api.deutsche-digitale-bibliothek.de/` | 200 | Root erreichbar; Suche verlangt Key |
| `api.europeana.eu/` | 200 | Root erreichbar; Suche verlangt Key |

**Nicht per HTTP prüfbar, daher als Vorschlag markiert:** Open311 (setzt einen
Stadt-Endpunkt voraus), CAP (Format der Warnkette), IIIF (kommt auf die Digitalisat-
Quelle an), SensorThings/NGSI-LD (noch kein Stuttgarter Endpunkt bekannt), DDB/Europeana
(Key nötig für die Suche). Lizenzhinweis: GND-Daten stehen unter CC BY 4.0.
