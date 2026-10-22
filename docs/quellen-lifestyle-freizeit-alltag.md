# Quellenrecherche: „Was geht", „Junge Leute", Restaurants (vegan/vegetarisch), Lifestyle, Freizeit, Alltag

Stand: 21.10.2026 · Status: Recherche, keine Anbindung umgesetzt · geprüft gegen die laufenden Endpunkte

Die Recherche bewertet öffentliche Schnittstellen für Open Stuttgart (EUPL-1.2, ohne Konto, ohne Werbung). Geprüft wurde
jeweils: Art der Schnittstelle, konkreter Endpunkt, Lizenz, Format, Inhalt, Praxistauglichkeit. Wo es **keine** offene
Schnittstelle gibt, steht das hier ausdrücklich.

---

## 0. Kurzfazit

Der mit Abstand wichtigste Fund ist **kein neuer Anbieter**, sondern ein bisher nicht ausgeschöpftes Angebot der Stadt
selbst: der **Infopool des städtischen Geoservers** (`GEOLINE_FLEX`). Er liefert maschinenlesbar genau die Orts- und
Termindaten, die in den vier gewünschten Feldern fehlen — Kinder- und Jugendtreffs, Ferienprogramm, Sport im Park,
Digitale Teilhabe, Stadtteilkultur, Musikschulen, Theater, Museen, Kinos, Kletteranlagen, Minigolf, Grillplätze,
Waldheime, Engagement-Orte. Alles über eine einzige, bereits in Open Stuttgart verwendete WFS-Schnittstelle, unter
offenen Creative-Commons-Lizenzen.

Zweitwichtigstes Ergebnis: Für **Restaurants** ist OSM der einzige Weg, der zur Lizenz des Projekts passt. Die App
macht das schon (`public/data/gastro.geojson`, `diet:vegan`/`diet:vegetarian` in `server/sources/nearby.mjs`). Alles
Kommerzielle (Google, Foursquare, Yelp, TripAdvisor, HappyCow) ist entweder kostenpflichtig oder vertraglich für genau
diesen Anwendungsfall gesperrt.

Drittens: Für **Clubszene und Jugendhäuser** bleibt die Lücke aus `docs/gancio-register-und-ansprachen.md` bestehen —
aber der Infopool liefert jetzt die vollständige Adressliste, um die fehlenden Orte gezielt für das offene
Veranstaltungsregister anzusprechen.

---

## 1. Der städtische Infopool (WFS `GEOLINE_FLEX`) — Hauptquelle für Freizeit, Alltag und Jugend

**Schnittstelle:** WFS 2.0, kein Schlüssel, keine Anmeldung, `outputFormat=application/json`, `srsName=EPSG:4326`,
`count=N`, `bbox=` möglich.

```
https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows
  ?service=WFS&version=2.0.0&request=GetFeature
  &typeName=GEOLINE_FLEX:<LAYER>_EPSG25832
  &outputFormat=application/json&srsName=EPSG:4326&count=50
```

Layerliste über `request=GetCapabilities` (392 Layer, Titel dort maschinenlesbar).
**Lizenz:** offene Creative-Commons-Lizenzen der Landeshauptstadt Stuttgart
(<https://www.stuttgart.de/leben/bauen/geoportal/open-data-und-testdaten>). Die Seite regelt ausdrücklich, dass eine
Nennung der LHS bei Weiterverarbeitung genügt; der Verweis auf OSM-Beiträge ist davon unberührt.
**Felder der `IP_*`-Layer:** `NAME`, `ADRESSTYP`, `STRASSE`, `PLZ`, `ORT`, `TEL`, `MOBIL`, `EMAIL`, `URL`, `WEBADDR`,
`INFOPOOL_ID` + Änderungsdatum. `URL`/`WEBADDR` zeigen stabil auf `https://www.stuttgart.de/?sp:id=ibs.dept.<ID>`.

### 1.1 Für „Junge Leute"

| Layer | Titel (lt. GetCapabilities) | Objekte | Inhalt |
|---|---|---|---|
| `IP_2_01_11_KINDER_JUGENDTREFFS` | Kinder- und Jugendtreffs | 57 | Jugendtreffs, Jugendzentren, Mädchen-/Frauenprojekte mit Kontakt |
| `A32_ALG_CV_Kinder_Jung` | CV Kinder Jungendeinrichtung | 686 | davon 44 Kinder-/Jugendhäuser, 14 Kinder-/Jugendtreffpunkte, 14 Kita-Träger |
| `IP_2_01_06_GENERATIONENHAUS` | Generationenhäuser | 7 | Mehrgenerationenhäuser |
| `IP_2_01_14_WALDHEIM` | Waldheime | 33 | Stadtranderholung, Waldheimferien |
| `IP_2_14_11_JUGENDGAESTEHAUS` | Jugendgästehaus | 4 | Jugendherbergen |
| `IP_3_05_01_JUGENDBERATUNG` | Jugendberatung | 12 | Beratungsstellen |
| `IP_3_05_11_JUGENDGESUNDHEIT` | Jugendgesundheit | 9 | Jugendgesundheitsdienste |
| `A51_GBE_JUGENDBEREICHE` | Jugendbereiche | 12 | Jugendbereichsarbeit mit Stadtbezirken und Kontakt |
| `A50_SOZ_DIGITALE_TEILHABE` | Angebote Digitale Teilhabe | 50 | **regelmäßige Termine**: Angebot, Wochentag, Uhrzeit, Präsenz/hybrid, Anmeldung, Raum, Barrierefreiheit, Kontakt |
| `A52_SIP_STANDORTE` | Sport im Park | 97 | **regelmäßige Termine**: Titel, Wochentag, Uhrzeit, Standort, Anbieter (kostenlose Bewegungsangebote in Parks) |

### 1.2 Für „Was geht" (Termine)

| Layer | Titel | Objekte | Inhalt |
|---|---|---|---|
| `A51_ALG_FP_PUNKTE_Sport_Spiel_Action` | Ferienprogramm – Sport, Spiel und Action | 13 | **Terminliste** mit `DATUM_VON`, `DATUM_BIS`, `ALTER_VON`, `ALTER_BIS`, `GEBUEHR_TXT`, `PLAETZE`, `ANMELDUNG`, `BARRIEREFREI`, `TREFFPUNKT`, `WEBLINK` |
| `A51_ALG_FP_PUNKTE_Kreatives_Kultur` | Ferienprogramm – Kreatives, Kultur | 4 | idem |
| `A51_ALG_FP_PUNKTE_Natur_Tiere` | Ferienprogramm – Natur, Tiere | 5 | idem |
| `A51_ALG_FP_PUNKTE_Ausfluege_Wissenswertes` | Ferienprogramm – Ausflüge | 1 | idem |
| `A51_ALG_FP_PUNKTE_Vermischtes` | Ferienprogramm – Vermischtes | 0 | idem (leer außerhalb der Ferienzeiten) |

Die Ferienprogramm-Layer sind der maschinenlesbare Auszug des städtischen Ferienprogramms
„Ferien in Stuttgart" (<https://www.unser-ferienprogramm.de/stuttgart/>). Die Web-Anwendung selbst hat keine offene
API — der WFS ist der saubere Weg.

### 1.3 Für „Lifestyle, Freizeit, Alltag"

| Layer | Titel | Objekte | Inhalt |
|---|---|---|---|
| `IP_MUSIK` | Musik | 176 | Chöre, Orchester, Bands, Musikvereine |
| `IP_BILDENDE_KUNST` | Bildende Kunst | 282 | Galerien, Ateliers, Kunstvereine |
| `IP_THEATER` | Theater | 46 | Theaterhäuser, Bühnen |
| `IP_MUSEEN` | Museen | 32 | Museen mit Kontakt |
| `IP_FILM_MEDIEN` | Film/Medien | 24 | **Kinos** (CinemaxX, Corso, Delphi, Gloria …) |
| `IP_LITERATUR_PHILOSOPHIE` | Literatur/Philosophie | 33 | Literaturhäuser, Verlage, Buchhandlungen |
| `IP_STADTTEILKULTUR` | Stadtteilkultur | 44 | Bürgerhäuser, Bürgerzentren, Kulturvereine |
| `IP_KULTURAMT_MUSIKSCHULE` / `IP_3_05_05_MUSIKSCHULE_STAEDTISCH` | Musikschulen | 15 / 14 | Musikschulen |
| `IP_KULTURAMT_STADTBIBLIOTHEK` | Stadtbibliothek | 19 | alle 19 Bibliotheksstandorte |
| `IP_KULTURAMT_PLANETARIUM` | Planetarium | 1 | Carl-Zeiss-Planetarium |
| `IP_2_03_02_SPORTHALLE` | Sporthallen | 243 | |
| `IP_2_03_03_SPORTPLATZ` | Sportplätze | 102 | |
| `IP_2_03_04_TENNISPLATZ` | Tennisplätze | 84 | |
| `IP_2_03_36_FREIBAD` / `HALLENBAD` / `MINERALBAD` | Bäder | 8 / 10 / 3 | ergänzt die Live-Besucherzahlen der Stuttgarter Bäder |
| `IP_2_03_62_KLETTERANLAGE` | Kletteranlagen | 5 | |
| `IP_2_03_39_MINIGOLF` | Minigolf | 9 | |
| `IP_2_03_38_GRILLPLATZ` | Grillplätze | 24 | |
| `IP_2_03_24_ZOO` | Zoo | 2 | Wilhelma, Feuerbacher Tierpark |
| `IP_2_03_10_PARKANLAGEN` / `A67_PARK_GRUENANLAGE_PUNKTE` | Parkanlagen | 23 / 28 | |
| `A32_ALG_CV_Spielplatz` / `A62_SPF_SPIELPLAETZE` | Spielplätze | 693 / 563 | |
| `A53_ALG_KUEHLE_ORTE` | Kühle Orte | – | Hitzeschutz |
| `A10_POI_NETTE_TOILETTE` | Nette Toilette | 61 | **mit `OEFFNUNGSZEITEN`** |
| `IP_2_10_10_TOILETTENANLAGE` | Toilettenanlagen | 48 | |
| `A62_INFOPOOL_DIREKTVERMARKTER` | Direktvermarkter | 58 | Hofläden, Wochenmarktstände |
| `A61_RAD_REPSAEULEN` | Reparatur-Säulen | 10 | kostenlose Fahrrad-Reparaturpunkte |
| `IP_2_11_32_FAHRRADSERVICE` | Fahrradservice | 4 | |
| `A10_EP_TOUR_ENGAGEMENT_ORTE` | Tour der guten Engagement-Orte | 27 | Ehrenamts-/Begegnungsorte |
| `A51_ALG_FRUEHE_HILFEN_PUB` | Frühe Hilfen | 66 | Familienangebote |
| `IP_2_06_09u13_SONSTIGE_VEREINIGUNGEN` | Vereinigungen | 15 | |
| `IP_2_04_31_VHS` | Volkshochschule | 2 | Standorte (Kurse s. u.) |
| `IP_2_04_32u33_SONSTIGE_BILDUNG` | Sonstige Bildung | 140 | Bildungshäuser, Familienbildung, Volkshochschulen |

**Einschränkung:** Die `IP_*`-Layer sind **Ortsverzeichnisse**, keine Termin- oder Öffnungszeitendatenbank. Nur
`A10_POI_NETTE_TOILETTE` führt Öffnungszeiten als Feld; die Termin-Layer (`A51_ALG_FP_PUNKTE_*`, `A50_*`, `A52_*`)
haben Wochentag/Uhrzeit bzw. Datumsbereiche.

**Konkreter Nutzen für den Gancio-Piloten:** `IP_2_01_11_KINDER_JUGENDTREFFS` (57) + `IP_STADTTEILKULTUR` (44) +
`IP_2_15_06_BUERGERHAUS` (33) sind genau die Adressbasis, um in `docs/gancio-register-und-ansprachen.md` Punkt 4 die
„Jugendhäuser, Kollektive, Kulturvereine und Zwischennutzungen" gezielt anzuschreiben — inklusive E-Mail-Adresse im
Datensatz.

---

## 2. Was geht (Veranstaltungen)

### Bereits angebunden
Theaterhaus (undokumentierte JSON-Route `/de/api/bookings/`), Im Wizemann, Bix, Wagenhallen, ticket.io, Love Your
Artist, Hochschulen (Uni Stuttgart, Hohenheim, HFT, HdM, ABK), stuvus, LKA Longhorn, Stadtpalais (WP-REST),
Stadtbibliothek (`veranstaltungen-stadtbibliothek-stuttgart.de`, schema.org), stuttgart-tourist.de (schema.org),
Stadt-Stadtkalender (RSS + iCal je Termin), OpenLigaDB, Märkte/Feste (`server/data/feste-maerkte.json`),
Spielstätten-Katalog (`server/data/venues.json`, 28 Orte), Gancio-Register (`OS_GANCIO_URL`, vorbereitet).

**Gegengeprüft:** Die schema.org-Anbindung von stuttgart-tourist.de ist korrekt — aber sie sitzt **nicht** auf der
Kalender-Übersicht, sondern auf den Termin-Detailseiten `https://www.stuttgart-tourist.de/e-<slug>` (aus
`/data/sitemap/stuttgart_de.xml`). Dort liegt ein JSON-LD-Block `@type: WebPage` mit `mainEntity: Event[]` — live
gemessen 8 Termine auf einer Seite, mit `name`, `startDate`, `endDate`, `eventStatus`, `isAccessibleForFree`,
`organizer`, `location` (`Place` + `PostalAddress`), `image`, `identifier`. Genau das liest
`server/sources/events-extra.mjs` (`marketingPage`). Die Übersichtsseite `/veranstaltungskalender-stuttgart/<n>`
enthält dagegen nur Microdata für Navigation/Breadcrumbs — wer nur dort prüft, findet zu Recht „kein schema.org".

### Neu / ergänzend empfohlen

| Quelle | Schnittstelle | Lizenz | Bewertung |
|---|---|---|---|
| **Infopool `A51_ALG_FP_PUNKTE_*`** (Ferienprogramm) | WFS, s. o. | CC der LHS | **sofort nutzbar**, schließt die Lücke Kinder/Jugend |
| **Infopool `A52_SIP_STANDORTE`** (Sport im Park) | WFS | CC der LHS | **sofort nutzbar**, Mai–Sept. dichtes Programm |
| **Infopool `A50_SOZ_DIGITALE_TEILHABE`** | WFS | CC der LHS | **sofort nutzbar**, regelmäßige Kurse |
| **Infopool `IP_*`** als Ortsschicht | WFS | CC der LHS | **sofort nutzbar**, verortet bisher unbekannte Termine |
| Stadt-Stadtkalender `?sp:out=rss` | RSS 2.0 + iCal je Termin | © LHS, **keine offene Lizenz** | technisch nutzbar (wird bereits genutzt); Sammel-iCal einer Trefferliste liefert leeres `VCALENDAR` — also nur RSS + Einzel-iCal |
| Stadtbibliothek-Portal | RSS + schema.org, Filter „Für wen?" (Jugend, Kinder), Altersstufen 0–5/6–8/9–12/13–18 | städtisch | **sehr gut für den Filter „junges Publikum"**, bereits teilweise genutzt |
| **LIFT-Veranstaltungskalender** (`lift-online.de/veranstaltungen`) | **keine** — kein RSS, kein iCal, kein schema.org/JSON-LD, keine API (geprüft) | kommerzielles Magazin | **nicht automatisierbar**; nur als Link/Inspiration. Rubriken (Partys, Flohmärkte, Genuss, Workshops, Touren) sind als Taxonomie-Vorbild interessant |
| Ticketmaster Discovery API | REST, API-Key | proprietär, Attribution + Ticketmaster-Link | technisch gut, rechtlich unpassend für eine Open-Data-App |
| Bandsintown | API nur für Künstler-Websites / Partnerprogramm | proprietär | **nicht geeignet** |
| Eventbrite | v3 nur noch eigene Organisationen, OAuth | proprietär | **nicht geeignet** |
| Resident Advisor, rausgegangen.de, Shotgun, Eventim | keine offene Schnittstelle | AGB sperren automatisierten Abruf | **nicht scrapen** (bereits in `docs/gancio-register-und-ansprachen.md` dokumentiert) |
| Kinoprogramm | **keine offene Schnittstelle für Stuttgart** | – | Lücke. `IP_FILM_MEDIEN` liefert 24 Kinostandorte, aber keine Spielzeiten |
| CinemaShowtimes-JSON (`d-cine.net`) | offener Standard 1.1, JSON-Schema, MIT | MIT | **Standard zum Ansprechen der Kinobetreiber**, noch keine Stuttgarter Beteiligten; als Weg für künftige Spielzeiten |

---

## 3. Junge Leute

### Amtliche Bezeichnungen (korrigiert)
* Dachverband ist der **Stadtjugendring Stuttgart e.V. (SJR)**, <https://www.sjr-stuttgart.de> — nicht „Kinder- und
  Jugendring".
* Jugendamt = **Dienststelle Kinderförderung und Jugendschutz**, Hauptstätter Straße 68, 70178 Stuttgart,
  0711 216-57711.
* Es gibt kein „Amt für Kultur und Freizeit" in Stuttgart; zuständig sind **Kulturamt** und **Jugendamt**.
* „Junge Szene" ist ein Bundesterminus (Berliner Festspiele), kein Stuttgarter Portal.

### Empfohlen

| Quelle | Schnittstelle | Lizenz | Bewertung |
|---|---|---|---|
| **Infopool-Jugendlayer** (`IP_2_01_11_KINDER_JUGENDTREFFS`, `A32_ALG_CV_Kinder_Jung`, `A51_GBE_JUGENDBEREICHE`, `IP_3_05_01_JUGENDBERATUNG`, `IP_3_05_11_JUGENDGESUNDHEIT`) | WFS | CC der LHS | **Top-Ergebnis** — 57 Treffs + 686 Einrichtungen mit Kontakt |
| **OpenMensa v2** | REST, kein Key | Community-DB, Quelle Studierendenwerk | **bereits angebunden** (`server/sources/mensa.mjs`, 6 Mensen mit vegan/vegetarisch-Kennzeichnung) |
| VVS-GTFS / MobiData BW | GTFS + TRIAS/EFA | CC BY 4.0 | **bereits angebunden** |
| **SJR Stuttgart** | WordPress-RSS `/feed/`, `/termine/`, `/mitgliedsverbaende/` | Verein, keine OD-Lizenz | mittel; kleines Volumen, dafür zielgruppengenau. Harvesting vorher abstimmen |
| Stadtbibliothek-Filter „Für wen? Jugend" + Altersstufen | RSS/schema.org | städtisch | **sehr gut**, bereits teilweise genutzt |
| RüMSB „Übergang Schule-Beruf" (`service.stuttgart.de/lhs-services/ruemsb/`) | strukturierte HTML-DB, **keine API** | städtisch | **Inhalt top** (Jugendmigrationsdienste, Jugendberufshilfe mit Alter, Zielgruppe, Stadtbezirk, Träger) — aber nur mit Freigabe/Export. **Anfrage lohnt sich: das Schema existiert, ein JSON/CSV-Export wäre klein** |
| JedeSchule / Datenschule | API + CSV/JSON | **CC0** | nützlich, aber BW-Schulverzeichnis ist käuflich → Daten lückenhaft/veraltet |
| Schulfinder `bewo.kultus-bw.de` | nur HTML | Land BW | keine offene API, nur Deep-Links |
| Kita-Portal Stuttgart | keine offene Schnittstelle | – | Anfrage ans Jugendamt |
| Freiwillig-BW / BFD / FSJ-Portale | eingebettetes Drittanbieter-Jobportal (BITE) | proprietär | **nicht scrapen**, nur verlinken |
| European Youth Portal (ESC) | nur HTML-Profilseiten | EU-Reuse | nur verlinken |

### Ohne Schnittstelle (ehrliche Negativliste)
Jugendfreizeitstätten als **Terminkalender**, offene Jugendarbeit, Jugendsozialarbeit, Sportvereinsdatenbank (LSV BW /
WLSB-Vereinssuche nur HTML), Kriminalprävention (Stabsstelle Kommunale Kriminalprävention), Jugendschutz- und
Suchtberatungsstellen. → hier bleibt **redaktionelle Pflege** bzw. die WFS-Ortsdaten plus eigene Termine.

### Sinnvolle handgepflegte Kerninhalte (Fakten, keine urheberrechtlich geschützten Werke)
Notrufe und Beratung: Nummer gegen Kummer 116 111, Telefonseelsorge 0800 111 0 111, Krisendienst BW 0800 655 3000,
Krisen- und Notfalldienst EVA 0711 6465120, release e.V. u21. Quelle jeweils angeben.

---

## 4. Restaurants, vegan / vegetarisch

### Bereits angebunden und richtig
`server/sources/nearby.mjs` wertet `public/data/gastro.geojson` (OSM-Auszug Stadtgebiet, Stand 17.10.2026, ODbL) aus:
`amenity` = restaurant/cafe/fast_food/pub/bar/ice_cream/food_court, `cuisine` (übersetzt), **`diet:vegan`** und
**`diet:vegetarian`** (`yes`/`only` → „vegane/vegetarische Gerichte"). Dazu `server/sources/wasgeht/neueroeffnungen.mjs`
für Neueröffnungen über die OSM-API 0.6. Das ist der richtige Kern.

### Empfohlene Ergänzungen (Lizenz kompatibel zu EUPL + ODbL)

| Quelle | Schnittstelle | Lizenz | Bewertung |
|---|---|---|---|
| **OSM / Overpass-API** (`https://overpass-api.de/api/interpreter`) | Query-Sprache, kein Key | **ODbL** | **erste Wahl.** Tags: `diet:vegan`, `diet:vegetarian`, `diet:halal`, `diet:kosher`, `diet:gluten_free`, `cuisine`, `opening_hours`, `check_date:*`, `outdoor_seating`, `takeaway`, `delivery`, `wheelchair`. Hinweis: eigene User-Agent setzen, Community-Rate-Limits achten, ggf. eigenen Overpass-Endpunkt betreiben |
| **Veggiekarte** (`veggiekarte.de`) | keine API, aber **GPL-Quellcode** (Python/JS) | GPL (Code), ODbL (Daten) | beste **Referenzimplementierung** für genau dieses Filterproblem (Kategorien + `vegan-only` + Öffnungszeiten-Status + eigener Datenqualitäts-Check). **Achtung:** GPL-Code 1:1 in eine EUPL-App kopieren macht das Ergebnis GPL — besser Query-Syntax und Datenmodell nachbauen, nicht den Code |
| **Foursquare Open Source Places** | statisches Dataset (Hugging Face, Source Cooperative GeoParquet, PMTiles), **keine API** | **Apache 2.0** | **neu und interessant:** 100 Mio. POIs weltweit, `date_closed`/`date_refreshed` für „noch geöffnet?". Aber: **keine Veggie-Attribute, keine Öffnungszeiten**, Datenqualität laut OSM-Community ungefiltert, und eine „Non-Commercial Categories Table" einschränkender Kategorien. Nur als Adress-/Kontakt-Anreicherung, nicht als Veggie-Quelle |
| **OpenTripMap** (`dev.opentripmap.org`) | REST, API-Key, Freemium | **ODbL** (OSM + Wikidata + Wikipedia) | gut für Anreicherung: Beschreibungen, Bilder, Kategorien, Wikidata-IDs. Keine `diet`-Details |
| **Geoapify Places API** | REST, API-Key, Freemium | ODbL (OSM-abgeleitet) | hat explizite Bedingungen `catering.restaurant` + **`vegan.only`** sowie `internet_access`, `no_fee` etc. Praktisch für komfortable Filter. **Doppelte Attribution** (OSM + Geoapify), ODbL-Share-Alike |
| Wikidata / SPARQL | `query.wikidata.org` | CC0 | für Restaurants **viel zu dünn** (live geprüft: **2** Restaurants in Stuttgart), aber nützlich für Museen/Kulturorte |
| Open Food Facts | REST + Nachtly-Dumps (JSONL/Parquet/CSV) | **ODbL + DbCL** | Produkte statt Lokale — als „vegan-Check für Produkte" ergänzend sinnvoll, nicht für Restaurants |
| `A62_INFOPOOL_DIREKTVERMARKTER` | WFS | CC der LHS | 58 Direktvermarkter/Hofläden — ergänzt „Essen & Trinken" um Regionalität |

### Datenqualität OSM in Stuttgart (live geprüft)

| Metrik | Wert |
|---|---|
| Gastro-Objekte gesamt (`amenity` restaurant/cafe/fast_food/pub/bar/ice_cream/food_court) | ~2.576 |
| davon mit irgendeinem Veggie-Attribut | ~460 (≈ 18 %) |
| `diet:vegan` = yes/only/designated (nur `nodes`) | 152 |
| `opening_hours` vorhanden | ~90 % |
| `wheelchair` vorhanden | ~75 % |
| `cuisine` vorhanden | ~73 % |

→ **Fazit:** OSM ist für Veggie die einzige Quelle mit echten `diet:*`-Tags, aber nur ~18 % Abdeckung. Genau deshalb
lohnt sich ein „Datendefekt melden"-Feature (Vorbild Veggiekartes `datacheck`) — es verbessert zugleich die Quelle.

**Kanonische Tag-Werte** (Veggiekarte/Taginfo): `diet:vegan ~ yes|only|limited`, `diet:vegetarian ~ yes|only`.
Ausschließen: `=no`, `=on_demand`. Dazu `check_date:diet:*` als Veralterungsmarker.
**Praxis-Hinweise:** eigenen Overpass-Endpunkt oder eigenen Snapshot statt öffentlichem Dienst (502 beobachtet);
`overpass.osm.ch` ist Schweiz-only; räumlich auf `admin_level=6` Stuttgart zuschneiden, nicht auf eine Bbox
(die enthält Nachbargemeinden).

### Nicht geeignet / vertraglich gesperrt

| Quelle | Grund |
|---|---|
| **Google Places API** | pay-as-you-go, keine dauerhafte Speicherung, Darstellung an Google gebunden |
| **Foursquare Places API (Pro/Premium)** | seit 01.06.2026 nur 500 kostenlose Aufrufe/Monat, danach ca. 15 $/1.000; EULA verbietet Speichern, Zusammenführen, Weitergeben; „Powered by Foursquare" Pflicht. *(Zu unterscheiden von „Foursquare Open Source Places" — das ist der Apache-2.0-Datensatz ohne Veggie-Felder.)* |
| **Yelp Fusion / Yelp Places** | Free-Tier **eingestellt**; Test-Calls ausdrücklich nicht für Produktivbetrieb |
| **TripAdvisor Content API** | nur nicht-kommerziell nach Antrag, kein Caching, strenge Attribution |
| **TomTom POI / HERE Places** | proprietär, Caching- und Weitergabeverbot; TomTom-POI „Automotive only" |
| **HappyCow** | **keine offizielle API**; ToU verbietet Scraping **und** den Aufbau einer Datenbank ausdrücklich (Datenbankwerk § 87a ff. UrhG) |
| **Vanilla Bean, Veganz, Gault&Millau, Michelin, Falstaff, Der Feinschmecker** | keine offenen Schnittstellen; Michelin nur interne IDs (Wikidata-Property), Rezensionen urheberrechtlich geschützt |
| **Speisekarten-Dienste** (Omniboard, menumant, Karmalizer, fooddatascrape) | kommerzielle Scraper, keine offenen Schnittstellen. `menu`/`hasMenu` (schema.org) wird von Stuttgarter Restaurants praktisch nicht befüllt |
| **OpenTable / TheFork** | nur als geprüfter Integrationspartner, „access is not self-serve" → Reservierung für eine nicht-kommerzielle App nicht umsetzbar |
| **Too Good To Go, ResQ Club, Sirplus, Tafel Stuttgart** | keine offiziellen APIs |
| **Utopia.de, PETA, Veggie-Check** | redaktionelle Listen ohne strukturierte Daten |
| **Stuttgarter Zeitung, Prinz, Mixery, RAUS, Mit Vergnügen, LIFT** | redaktionelle Artikel, keine strukturierten Restaurantdaten; Stuttgarter Zeitung hat **kein öffentliches RSS** (geprüft: `/rss`, `/inhalt.rss` → 404) |
| **OpenData@Stuttgart (CKAN)** | 139 Datensätze, **0** zu Gastronomie/Märkten (geprüft) |

### Zwei Sonderfälle

**Foodsharing** (<https://foodsharing.de/api/doc>, OpenAPI-3.0-Spec, ~730 KB, Doku unter `devdocs.foodsharing.de`):
tatsächlich eine dokumentierte REST-API für Fairteiler — aber **Authentifizierung über ein Community-Konto** ist Pflicht
und die Daten sind teils personenbezogen. Widerspricht dem Grundsatz „ohne Konto", ist aber für einen serverseitigen
Adapter denkbar. → **nur mit ausdrücklicher Freigabe des foodsharing e.V.**

**Mundraub** (mundraub.org): ~50.000 Fundorte essbarer Pflanzen, thematisch schön („essbare Stadt"), aber **keine API
und kein offener Dump** — die Datenbank wird redaktionell freigegeben. → Anfrage lohnt sich, Scraping nicht.

### Wochenmärkte und Hofläden

`server/data/feste-maerkte.json` ist derzeit eine gepflegte Tabelle ohne Schnittstelle. Besserer Weg:
1. Die **30 Wochenmärkte** inkl. Wochentag, Uhrzeit und Koordinaten stehen strukturiert (eingebettetes JSON mit
   Lat/Lon) auf `stuttgarter-wochenmaerkte.de/maerkte-staende/uebersicht` — einmalig übernehmen.
2. Danach **in OSM ergänzen** (`amenity=marketplace`: 22 Objekte in Stuttgart vorhanden, `shop=farm`: 61) — damit
   wird die Liste wartbar und fließt automatisch in die OSM-Auswertung ein, statt als Sonderdatei zu altern.

---

## 5. Lifestyle, Freizeit, Alltag

### Bereits angebunden
Bäder-Livezahlen (`stuttgarterbaeder.de/.../visitor_count.json`), Bürgerbüro-Wartezeiten (`wartezeiten.stuttgart.de`),
DWD-Pollenflug und DWD-UV (`opendata.dwd.de/climate_environment/health/alerts/s31fg.json`, `uvi.json`),
Stromgedacht, energy-charts (Grünstrom), OCPDB-Ladepunkte, GBFS-Sharing, ParkAPI, Eco-Counter, Wald-/Freizeitrouten,
Kühle Orte, Spielplätze, Toiletten, Trinkbrunnen, Notfall-Treffpunkte, Baumkataster mit Pollenbäumen.

### Ergänzend empfohlen

| Thema | Quelle | Schnittstelle | Lizenz | Bewertung |
|---|---|---|---|---|
| Orte für Freizeit/Kultur/Sport | **Infopool-Layer** (s. Abschnitt 1.3) | WFS | CC der LHS | **sofort nutzbar**, größter Hebel |
| Regelmäßige Bewegungsangebote | `A52_SIP_STANDORTE` (Sport im Park) | WFS | CC der LHS | **sofort nutzbar** |
| Kurse/Weiterbildung | vhs-stuttgart.de / vhs-Kursfinder (DVV) | **keine offene API**; Kursfinder ist ein kostenpflichtiges Angebot für Volkshochschulen | – | Lücke. Berlin liefert VHS-Kurse als offenen Datensatz (JSON) — **Vorbild für eine Anfrage an die vhs stuttgart**. Standorte liegen als `IP_2_04_31_VHS` vor |
| Naturbäder / Gewässerqualität | **Badegewässerkarte des Landes BW** (`badegewaesserkarte.landbw.de`) | Web-Karte, LUBW; Metadaten über `rips-metadaten.lubw.de` | Land BW, teils Open Data | ergänzt die 21 Bäder um Katzenbachsee, Bärensee, Neuen See, Rotwildpark. **Dienst ist langsam/zeitweise nicht erreichbar** — Metadatensuche (RIPS) prüfen |
| Apothekennotdienst | LAK BW Schnell-/Umkreissuche | **keine offene API**; die „XML-Schnittstelle" ist ein **Service für Kammermitglieder** (Login) | – | Lücke. Nur Deep-Link auf `lak-bw.de`; Notdienstdaten sind Fakten, redaktionelle Pflege ist vertretbar |
| Ärzte / 116117 | `116117.de` | keine offene API | – | nur verlinken |
| Ehrenamt | `A10_EP_TOUR_ENGAGEMENT_ORTE` (27 Orte) + neues Portal „Engagiert für Stuttgart" | WFS bzw. Web | CC der LHS | WFS sofort nutzbar; vostel.de nur verlinken |
| Kinoprogramm | s. Abschnitt 2 | – | – | Lücke |
| Wetter/Alltag | Bright Sky, Open-Meteo, PEGELONLINE | REST | offen | **bereits angebunden** |

---

## 6. Rechtliche Grundlagen (gilt für alle Aufnahmen)

1. **Vorrang haben:** CC0 / CC BY / ODbL / „offene Creative Commons" — also Infopool-WFS, OpenData@Stuttgart (CKAN,
   CC BY 4.0), OSM/Overpass (ODbL), DWD Open Data, GTFS/CC BY 4.0, OpenMensa, OpenTripMap/ODbL, Geoapify/ODbL.
2. **OSM/ODbL** verlangt Namensnennung („© OpenStreetMap-Mitwirkende") und Share-Alike der **Datenbank**; die
   EUPL-1.2 des Codes ist damit vereinbar, die Attribution gehört sichtbar ins „Über"-Menü. Die LHS-Nennung genügt
   laut Geoportal-Seite bei OSM-Weiterverarbeitung indirekt.
3. **Ohne offene Lizenz, aber technisch nutzbar:** städtische RSS-/schema.org-Feeds und Haus-Websites. Übernommen
   werden nur **Fakten** (Termin, Ort, Preis, Link) und der Quellenverweis — keine Beschreibungstexte, keine Bilder.
   Für systematisches Harvesting im Zweifel beim Kulturamt/Jugendamt um Freigabe bitten.
4. **Nicht scrapen:** Resident Advisor, rausgegangen.de, Eventim, LIFT, HappyCow, Foursquare, Google, Yelp,
   TripAdvisor, freiwillig-bw/BITE, vhs-Kursfinder. Verstoß gegen AGB, Datenbankwerkrecht (§ 87a ff. UrhG),
   ggf. UWG; bei personenbezogenen Kontaktdaten zusätzlich DSGVO.
5. **Eigene Infrastruktur:** Für Overpass und größere Abrufe eigenen Endpunkt oder eigene Auszüge betreiben; die
   öffentlichen Endpunkte sind für automatisierte Last nicht gedacht (502-Meldungen beobachtet).

---

## 7. Konkrete nächste Schritte (priorisiert)

1. **Infopool-Adapter** in `server/sources/nearby.mjs` bzw. ein neues Modul: die `IP_*`- und `A5*`-Layer über die
   vorhandene WFS-Hilfsfunktion laden (das Muster existiert in `nearby.mjs`/`natur.mjs` schon) und als „In der Nähe"
   ergänzen. Sofortiger Nutzen ohne neue Lizenzfrage.
2. **Ferienprogramm + Sport im Park + Digitale Teilhabe als Termine** ins Modul „Was geht" einspeisen
   (`A51_ALG_FP_PUNKTE_*`, `A52_SIP_STANDORTE`, `A50_SOZ_DIGITALE_TEILHABE`) — mit `ALTER_VON`/`ALTER_BIS` als
   Filter „junges Publikum" und `BARRIEREFREI` als Merkmal.
3. **Gancio-Ansprache vorantreiben** mit der Adressliste aus `IP_2_01_11_KINDER_JUGENDTREFFS` (57) +
   `IP_STADTTEILKULTUR` (44) + `IP_2_15_06_BUERGERHAUS` (33) — E-Mail-Adressen liegen im Datensatz.
4. **Veggie-Filter schärfen:** `diet:halal`, `diet:kosher`, `diet:gluten_free`, `check_date:diet:*` (Veralterung
   erkennen), `opening_hours` live auswerten (vorbildhaft `opening_hours.js`, LGPL, clientseitig); `wheelchair` als
   Filter mit aufnehmen (75 % Abdeckung). Vorbild Veggiekarte (GPL — nur die Idee, nicht den Code).
5. **Wochenmärkte:** die 30 Märkte aus dem strukturierten Angebot von `stuttgarter-wochenmaerkte.de` einmalig
   übernehmen und in OSM als `amenity=marketplace` ergänzen, statt `server/data/feste-maerkte.json` dauerhaft von
   Hand zu pflegen.
6. **Anfragen schreiben:**
   * vhs stuttgart: Kursdaten als JSON/CSV (Vorbild: Berliner VHS-Open-Data)
   * Jugendamt/DO.IT: RüMSB-Daten als JSON/CSV-Export
   * Kulturamt: Freigabe/Nutzungsvereinbarung für den Stadtkalender-Feed
   * Kinobetreiber: Veröffentlichung nach CinemaShowtimes-JSON
   * foodsharing e.V.: Freigabe für die Fairteiler-API (falls gewünscht)
7. **Bewusst nicht verfolgen:** Ticketmaster, Bandsintown, Eventbrite, Foursquare-Places-API, Google Places, Yelp,
   HappyCow, TripAdvisor, LIFT, Resident Advisor.

---

## Anhang: geprüfte Endpunkte (Auszug)

```
# Infopool-WFS (Beispiel: Kinder- und Jugendtreffs)
https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0
  &request=GetFeature&typeName=GEOLINE_FLEX:IP_2_01_11_KINDER_JUGENDTREFFS_EPSG25832
  &outputFormat=application/json&srsName=EPSG:4326&count=50

# Layerverzeichnis
https://geoserver.stuttgart.de/geoserver/GEOLINE_FLEX/ows?service=WFS&version=2.0.0&request=GetCapabilities

# OpenData@Stuttgart (CKAN)
https://opendata.stuttgart.de/api/3/action/package_list
https://opendata.stuttgart.de/api/3/action/package_search?q=Veranstaltung&rows=30

# DWD Pollenflug / UV (bereits genutzt)
https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json
https://opendata.dwd.de/climate_environment/health/alerts/uvi.json

# OpenMensa (bereits genutzt)
https://openmensa.org/api/v2/canteens?near[lat]=48.7758&near[lng]=9.1829&near[dist]=12

# Overpass (User-Agent setzen!)
https://overpass-api.de/api/interpreter

# Stadt-Stadtkalender
https://www.stuttgart.de/service/veranstaltungen?sp:out=rss&sp:cmp=eventSearch-1-0-searchResult&action=submit
https://www.stuttgart.de/veranstaltungskalender/veranstaltungen/<slug>-<id>?sp:out=iCal

# Ferienprogramm (Web, ohne API — der WFS-Ersatz steht in Abschnitt 1.2)
https://www.unser-ferienprogramm.de/stuttgart/index.php

# Wochenmärkte (strukturierte Angaben in der Seite, Stand 21.10.2026)
https://www.stuttgarter-wochenmaerkte.de/maerkte-staende/uebersicht

# Foursquare Open Source Places (Apache 2.0, statisches Dataset)
https://huggingface.co/datasets/foursquare/fsq-os-places
https://source.coop/fused/fsq-os-places

# Foodsharing API (OpenAPI-Spec, Auth-Pflicht)
https://foodsharing.de/api/doc.json
```

---

## Anhang: Methodik und Gegenprüfung

**Live geprüft** (Endpunkt angesprochen, Antwort ausgewertet): Infopool-WFS (GetCapabilities mit 392 Layern, dazu die
einzelnen Layer mit `totalFeatures` und Feldnamen), OpenData@Stuttgart CKAN (`package_list`, `package_search`),
DWD-Pollenflug `s31fg.json`, OpenMensa `canteens`, Overpass-Abfrage zu `diet:vegan` in Stuttgart, Geoportal-Seite
„Open Geodata und Testdaten" (Lizenzwortlaut), LAK-BW-Seiten zum Apothekennotdienst, LIFT-Veranstaltungskalender
(Feed-/schema.org-Prüfung), stuttgart-tourist.de (Sitemap + drei `/e-`-Detailseiten), `nearby.mjs`/`mensa.mjs`/
`events-extra.mjs` im Repo.

**Korrigiert gegenüber einer ersten Recherche:**
* *„stuttgart-tourist.de hat kein schema.org"* — **falsch**. Die Event-JSON-LD sitzt auf `/e-<slug>`, nicht auf der
  Kalender-Übersicht (s. Abschnitt 2).
* *„Für Jugendfreizeitstätten gibt es keine maschinenlesbare Liste"* — **falsch**. `IP_2_01_11_KINDER_JUGENDTREFFS`
  (57) und `A32_ALG_CV_Kinder_Jung` (686) liefern genau das (s. Abschnitt 1).
* *„Das Ferienprogramm ist nur HTML/PDF"* — **teilweise falsch**. Die Web-Anwendung hat keine API, aber der
  städtische WFS bildet sie als `A51_ALG_FP_PUNKTE_*` ab.
* *„Kinder- und Jugendring Stuttgart"* → korrekt **Stadtjugendring Stuttgart (SJR)**.
* *„Amt für Kultur und Freizeit"* → gibt es in Stuttgart nicht; zuständig sind Kulturamt und Jugendamt
  (Dienststelle Kinderförderung und Jugendschutz).

**Nicht live verifiziert, vor einer Entscheidung gegenprüfen:** Angaben zu Utopia/PETA/Veggie-Check/Veganz,
Speisekarten-Diensten, ResQ/Sirplus, Michelin/Falstaff, Tripadvisor-Content-API-Detail, Vanilla Bean. Die Suche war
gegen Ende der Recherche authentifizierungsgestört (HTTP 401).
