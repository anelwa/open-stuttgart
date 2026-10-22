# API-Recherche Oktober 2026: Erweiterungskandidaten für Open Stuttgart

Ziel: zusätzliche APIs, WebSockets und Datendienste, die Open Stuttgart sinnvoll erweitern —
inkl. bundesweiter/weltweiter Dienste, die wir im Server auf den Stuttgarter Ausschnitt
filtern (Bounding Box / Radius / Stadtgebiet).

Bewertungskriterien passend zum Projekt:

1. **Kostenlos & ohne Account** (Keys nur, wenn sie frei beantragbar und DSGVO-freundlich sind)
2. **Offene Lizenz** (CC0/ODbL/CC-BY/dl-de-by-2.0; Namensnennung im Quellenhinweis)
3. **Serverseitiger Proxy** über `server/cache.mjs` (`politeFetch`, TTL-Cache, Last-Good-Fallback) —
   keine Upstream-Aufrufe aus dem Browser außer bei Karten-/Terrain-Tiles
4. **Ruhige Intervalle** und robustes Verhalten, wenn ein Dienst ausfällt
5. **Mehrwert gegenüber dem Bestand** (nicht: zweite Quelle für dasselbe)

Alle Endpunkte wurden am 22.10.2026 geprüft. Details in den Abschnitten.

---

## 1. Echtzeit-Kanäle (WebSocket / SSE) — größte strukturelle Lücke

Das Projekt hat bisher **keine** WebSockets oder SSE-Streams; alles läuft über Polling
(`usePolling()`/`getJson()` in `src/lib/api.ts`). Zwei Quellen liefern echte Push-Ereignisse:

### 1.1 EMSC Erdbeben-WebSocket ⭐ (offiziell, dokumentiert, CC BY 4.0)

* `wss://www.seismicportal.eu/standing_order/websocket` (SockJS-Endpunkt:
  `https://www.seismicportal.eu/standing_order`)
* Jede JSON-Nachricht = neues/aktualisiertes Erdbebenereignis (`action: "create"|"update"`,
  Magnitude, Flinn-Region, Tiefe, `unid`, Zeit)
* Doku + Beispiele (JS/SockJS, Python/Tornado): <https://www.seismicportal.eu/realtime.html>,
  <https://github.com/EMSC-CSEM/webservices101>
* Lizenz: CC BY 4.0 (<https://www.seismicportal.eu/terms.html>)
* **Filterung auf Stuttgart:** Server hält den Socket und filtert z. B. `distance ≤ 300 km`
  um 48.775/9.182 bzw. Mag ≥ 2.5 — damit ist die Kessel-Region (Oberrheingraben!) abgedeckt,
  wo spürbare Beben real vorkommen
* Passt in Modul **Umwelt** (neuer Layer `beben` + Push-Toast bei spürbaren Beben)
* Reaktiv ist auch das Pendant als REST: `GET https://www.seismicportal.eu/fdsnws/event/1/query`
  (FDSN-Standard, `format=json`, bbox/`minmagnitude`, max. 20.000 Events/Abfrage) —
  damit historische Auswertung analog zum Unfallatlas möglich

Ergänzung als reine REST-Alternative (kein Key): USGS-Feeds
`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&...` bzw. die
Real-Time-GeoJSON-Feeds — weltweit, für Europa aber EMSC vorziehen (bessere Abdeckung/Update).

### 1.2 Blitzortung / LightningMaps Gewitter-WebSocket (inoffiziell, aber etabliert)

* `wss://ws1.blitzortung.org` … `wss://ws7.blitzortung.org` (Fallback-Serverliste),
  Anmeldung mit `{"a": 111}`, danach binäre/LZW-kodierte Blitzeinschläge im Sekundentakt
* Viele quelloffene Clients dokumentieren das Protokoll (Rust-Crate `blitzortung`,
  diverse Python-Feeder); weltweite Abdeckung, Latenz < 1 s
* **Vorbehalte:** Protokoll ist nicht offiziell spezifiziert (die API-Doku auf
  docs.lightningmaps.org ist "work in progress"), Community-Betrieb — nur mit serverseitigem
  Client, Reconnect/Dedupe und Filter auf Radius ~150 km um Stuttgart betreiben, Last gering
  halten und im Impressum/Quellenhinweis als Community-Projekt ausweisen. Vor Produktivbetrieb
  Kontakt zum Projekt suchen.
* Alternative mit weniger Risiko: Polling der Blitzortung-Archivdaten oder ganz weglassen —
  DWD-Radar (Bright Sky) deckt Niederschlag bereits ab, Blitze sind die sinnvolle Ergänzung
* Feature-Idee: Layer `blitze` + „Gewitter nähert sich" im Modul **Umwelt**

### 1.3 Eigener SSE-Endpunkt `/api/stream` (Architektur-Empfehlung)

Unabhängig von Upstream-Sockets: Der Node-Server kann den Frontend-Clients per
**Server-Sent Events** Pushes schicken (Haltestellen-Update, Regenstart an der Haltestelle,
Wartezeit Bürgerbüro, Poolauslastung, Warnungen, Erdbeben). Vorteile:

* Frontend wird polling-frei bzw. mit viel längeren Intervallen
* Upstream-Requests bleiben zentral gebündelt (ein Poller statt N Browser)
* SSE ist im vorhandenen dependency-freien `server/index.mjs` mit ~30 Zeichen umsetzbar
  (kein WebSocket-Handshake nötig, funktioniert über HTTP/1.1)

### 1.4 Ehrlich gesagt: was *keinen* öffentlichen Socket hat

* **ADS-B:** `api.adsb.lol` (in `server/sources/flug.mjs` genutzt) ist REST; die
  readsb-/BEAST-Streams sind feeder-only. Dafür gibt es ein **Tagesarchiv** (Open Data,
  ODbL) unter <https://www.adsb.lol/docs/open-data/> — nützlich für „Fluglärm-Rückblick".
* **GTFS-RT/VehiclePositions** läuft als Polling (29-MB-Feed + Filter). Das bleibt so,
  sinnvollerweise ergänzt um Transitous `map/trips` (siehe 2.1).

---

## 2. Bundes-/weltweite APIs, im Server auf Stuttgart beschnitten

### 2.1 Transitous / MOTIS-API v6 ⭐⭐ (weltweit, kostenlos, kein Key, MIT-Lizenz)

* Basis: `https://api.transitous.org` (OpenAPI: motis-project/motis `openapi.yaml`)
* Endpunkte: `/api/v6/plan` (multimodal inkl. Fuß/Rad/Fahrradmitnahme/Direktverbindungen),
  `/api/v6/trip`, `/api/v6/stoptimes`, `/api/v6/geocode`, `/api/v6/one-to-many`,
  `/api/v6/map/stops`, **`/api/v6/map/trips`**
* **Warum richtig gut:**
  * `map/trips` liefert die im Ausschnitt **aktiven Fahrten inkl. Realtime** — der Ersatz für
    die heute nur *berechneten* Fahrzeugpositionen in `server/sources/vehicles.mjs` bzw.
    dessen Validierung (Transitous speist die GTFS-RT-Feeds von gtfs.de ein)
  * `plan` kann internationale/überregionale Verbindungen, die das EFA-BW-Portal nicht kennt
    (Fernverkehr, Nachbarländer), und ist ein **unabhängiger Zweitansatz** für den
    Anschluss-/Routen-Checker
  * `one-to-many` = Isochronen („Was ist in 15 Min. erreichbar?") — neues Feature für Modul **Weg**
* Aufwand: gering–mittel; ein `server/sources/transitous.mjs` mit bbox-Filter, Attribution
  „OpenStreetMap + GTFS-Quellen (Transitous/MOTIS)" im Quellenhinweis
* Beachten: Community-Service → enge Cache-TTLs (≥ 60 s), keine Bulk-Abrufe, Attribution

### 2.2 LGL BW Open GeoData (WMS/WFS) ⭐⭐ — Landesdaten, dünn genutzt

Basis: `https://owsproxy.lgl-bw.de/owsproxy/...` (OpenData-Bereich
<https://www.lgl-bw.de/Produkte/Open-Data/index.html>, Portal <https://opengeodata.lgl-bw.de/>),
Lizenz **dl-de/by-2.0** (Namensnennung „Datenquelle: LGL, www.lgl-bw.de, dl-de/by-2-0").

| Dienst | Inhalt | Nutzen für Open Stuttgart |
| --- | --- | --- |
| `WMS_LGL-BW_HIST_DOP_1950-1959` … `2020-2029` | historische Orthophotos je Jahrzehnt | **Zeitreise-Layer** — ergänzt die Luftbildjahre 2006–2025 der Stadt um 70 Jahre |
| `WMS_LGL-BW_ATKIS_DOP_20_C` | aktuelles DOP 20 cm | schärfere Luftbildoption (Stadt-Luftbild ist oft älter) |
| `WMS_LGL-BW_ATKIS_DGM_025_Schummerung` | Relief-Schummerung | schönere Basis-Karte/Hillshade ohne Terraintiles |
| WFS ATKIS Basis-DLM | Verwaltungsgrenzen, „Besondere Rechte", Natur-/Bodenschutzrechte | Umweltzonen, Schutzgebiete, Nutzungsrechte |
| WFS Landnutzung / Landbedeckung | Flächennutzung | Vergleich FNP/Flächennutzung, Klima-Modul |
| ALKIS Hausumringe / Gebäudepositionen (OpenGeoData-Portal, Kacheln) | ~5,9 Mio. Hausumringe | **3D-Gebäude** (fill-extrusion) für Stadtmodell & Schattenberechnung |
| 3D-Produkte (LOD2, DGM 5 m; Demo: `3dweb.lgl-bw.de/BW-3D`) | Gebäude-3D BW | Referenz/Download für Sonne-Modul mit echten Baukörpern |

Weiter: **LUBW-WFS** unter `https://rips-gdi.lubw.baden-wuerttemberg.de/arcgis/services/wfs/...`
(u. a. `Naturpark`, `Naturraum`, `Wasserschutzgebiet`, `Wildschutz/Wildruhegebiete`,
`Waldschutzgebiete`) — GetCapabilities prüfen; ergänzt die Stuttgarter WFS um Landesebenen.

### 2.3 OpenData@Stuttgart CKAN ⭐⭐ — der größte ungenutzte Schatz im eigenen Haus

`https://opendata.stuttgart.de/api/3/action/package_list` zeigt **~130 Datensätze**
(CC-BY-4.0, v. a. Stadtmessungsamt & Statistisches Amt). Bisher nutzen wir praktisch keinen.
Besonders lohnend:

| Datensatz | Format | Idee |
| --- | --- | --- |
| `historischer-stadtplan-stuttgart-1914` (ebenso 2008, 2021) | ZIP, ~12,7 MB | **„Stadtplan 1914" als Overlay-Layer** — Alleinstellungsmerkmal; Format im ZIP prüfen (georeferenzierter Raster-Scan) |
| `wahlbezirke` | GPKG | Wahlbezirks-Layer + Ergebnis-Auswertung (ergänzt `beteiligung.mjs`) |
| `bebauungsplaene` | vari. | B-Plan-Bezug zur Adresse (Adressprofil „Was gilt hier?") |
| `naturschutzflaechen`, `heilschutzgebiete` | vari. | Umwelt-Layer |
| `laermkartierung`, `immissionen`, `emissionen`, `kohlendioxid-co2-emissionen` | CSV/XLSX | Quartiers-Indikatoren im Adressprofil |
| `kinos-und-filmbesucher`, `museen`, `orchester`, `private-theater`, `sportanlagen`, `schwimmbaed` | CSV | Orts-/Kulturprofile, Querverweise |
| `einwohner-altersgruppen-stadtbezirke`, `wohnungen-*`, `mieten`-Verwandte, `straftaten`, `arbeitslos*` | CSV/XLSX | **Stadtbezirks-Profil** („Dein Kiez in Zahlen") |
| `energieverbrauch`, `trinkwasserverbrauch`, `abfallaufkommen-*`, `treibhausgasausstoss` | CSV | Klima-Modul, Benchmark Quartier ↔ Stadt |
| `historische Karten`, `luftbilder-2021`, `strassennetz-in-stuttgart`, `raddaten`, `ergebnisse-der-verkehrszaehlungen` | diverse | Karten-Layer & Radverkehr |

Umsetzung: ein `scripts/build-opendata-stuttgart.mjs` (CKAN-Import nach `server/data/`,
wie bei `build-unfaelle.mjs`) + dünne `/api/opendata/*`-Routen.

### 2.4 Ratsinformationssystem ALLRIS / OParl ⭐ (politisch, nicht technisch)

* Stuttgart nutzt **ALLRIS** (`https://allris.stuttgart.de/`); es gibt mit
  **`oparl-bridge`** (GitHub Aeroid/oparl-bridge) eine OParl-1.1-Schnittstelle, die genau für
  ALLRIS-Installationen (cc-eGov/Somacos) gebaut ist
* Ziel: **offizielle OParl-API der Stadt** (Sitzungen, Vorlagen, Anträge, Bezirksbeiräte) →
  Modul **Verwaltung/Beteiligungen**: „Was wird in meinem Bezirksbeirat beraten?"
* Wichtig laut eigener Doku (`docs/neue-module-2026-10.md`): **kein ALLRIS-Crawl ohne
  schriftliche Freigabe**. Deshalb: Anfrage an das Amt für Organisation/Statistik +
  ggf. Angebot, die OParl-Schnittstelle (Open-Source-Bridge) gemeinsam zu evaluieren.
  Alternativ kurzfristig: die bestehende `PLANAUSLAGE`-/Amtsblatt-Auswertung ausbauen.

### 2.5 PVGIS v6 (EU-Kommission/JRC) ⭐ — Solarertrag pro Punkt

* `https://photovoltaic-geographic-information-system.ec.europa.eu/api/v6/...`
  (OpenAPI unter `/api/v6/docs`), **kein Key, EUPL-1.2**, JSON/CSV
* Endpunkte u. a. `performance/broadband`, `power/photovoltaic`, `statistics/...`,
  Positions-/Horizontberechnung; global abgedeckt (Stuttgart liegt mitten drin)
* Nutzen: im Adressprofil dort, wo das **Solarkataster** keine Fläche liefert, einen
  Richtwert „kWh/a pro kWp bei 30°/Süd" berechnen — plus Monatsverlauf
* Kombinierbar mit dem bestehenden Sonne-Modul (Horizont/Schatten aus DEM)

### 2.6 NASA GIBS + FIRMS ⭐ — Satelliten & Feuer-Hotspots

* **GIBS** (WMTS/WMS, `gibs.earthdata.nasa.gov`): frei, **kein Key**, u. a. Echtzeit-Satelliten-
  und Themenebenen inkl. **Thermal-Anomalies** (MODIS/VIIRS-Feuerpunkte) sowie
  True-Color/Cloud-Layer. Als Karten-Layer im Modul **Umwelt** („Satellitenblick", Wald-/Flächenbrand)
* **FIRMS Area-API** (`https://firms.modaps.eosdis.nasa.gov/api/area/...`) mit kostenlosem
  `MAP_KEY`: Feuerpunkte als CSV für bbox (hier: Großraum Stuttgart), z. B. für
  „Brände/Heißluftereignisse im Umkreis"
* Nutzungshinweis: NASA-Quellenangabe, Tile-Last moderat halten

### 2.7 CelesTrak + lokale Berechnung ⭐ — Himmels-Features

* **CelesTrak** (`https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle`):
  TLE/OMM-Daten frei, kein Key
* Statt einer Pass-Vorhersage-API (z. B. NextPass, kommerziell/key) **lokal rechnen** —
  passt zum bestehenden Muster (`src/lib/sunWorker.ts`, Web-Worker): SGP4-Propagation +
  Sichtbarkeitsberechnung (Höhe > 10°, Sonnenstand vs. Himmel)
* Features im Modul **Sonne/Himmel**: „Wann sehe ich die ISS heute Abend?", Iridium-/Starlink-
  Sichtungen, „Was ist da oben?" (planetariumsartig, ohne externe API)

### 2.8 DIPUL (BMV) + DFS-Wetter-API ⭐ — Drohnen-Geozonen & Windprofil

* WFS/WMS: `https://uas-betrieb.de/geoservices/dipul/ows?service=WFS|WMS&...&request=GetCapabilities`
  (Layer u. a. `dipul:kontrollzonen`, `dipul:flugbeschraenkungsgebiete`, `dipul:windkraftanlagen`,
  `dipul:kraftwerke`, `dipul:justizvollzugsanstalten`, `dipul:nationalparks`), Lizenz **CC BY-ND 4.0**
* Statischer Download (GeoJSON/ED-318) über die **Mobilithek**, Aktualisierung alle 28 Tage (AIRAC)
* Zusätzlich: **DFS-Wetter-API** (OpenAPI `weather-service-public.2.0.0`) mit ICON-D2-Prognosen
  (Wind je Flughöhe, QNH, Niederschlag, Bewölkung, Luftfeuchte **bis 250 m über Grund**, 24 h)
  → nützlich für Drohnen *und* als „Wind in der Kessel-Lage" fürs Umwelt-/Kessel-Modul
* Nutzen: Layer `drohnenzonen` (Wer darf hier fliegen? — EDDS-Kontrollzone, Polizei,
  Krankenhäuser, Kraftwerke) — es gibt in Stuttgart praktisch keine andere einfache Quelle

### 2.9 Mobilität & Verkehr — Ergänzungen

| Dienst | Was | Hinweis |
| --- | --- | --- |
| **transport.rest** (`https://v6.db.transport.rest`) | DB-Fernverkehr/Regionalzüge, Verspätungen, `journeys` | kostenlos, kein Key; **Achtung:** HAFAS wurde von DB abgeschaltet, jetzt `db-vendo-client` mit niedrigeren Rate-Limits (100 req/min), `/radar` & `reachable-from` entfallen. Gut als Zweitquelle für Hbf/IRIS, nicht als Hauptquelle |
| **MobiData-BW / ParkAPI** | bereits integriert | Potenzial: weitere `park-api`-Attribute (Tarife, Öffnungszeiten) |
| **OpenChargeMap** (`api.openchargemap.io/v3/poi`) | weltweites Ladesäulen-Register, freier Key | ergänzt OCPDB um Betreiber/Kommentare/Check-ins; Attribution der Data-Provider nötig |
| **DIPUL-Windprofil** (s. 2.8) | Wind in 250 m | Drone-Modul + Kessel |

### 2.10 Kultur & Bildung

| Dienst | Was | Hinweis |
| --- | --- | --- |
| **DDB-API** (`api.deutsche-digitale-bibliothek.de/2`) | Kulturerbe: Stadtarchiv, Landesarchiv, Württembergische Landesbibliothek, Museen | freier Key nach Registrierung; Suche nach `place=Stuttgart` + Zeitraum → „Historische Fotos/Dokumente zu diesem Ort" im Modul **Kultur/Stadtgedächtnis** |
| **Europeana** (`api.europeana.eu`) | europäische Kultursammlungen | freier Key; gut für Bilder/Postkarten/Plakate zu Stuttgart (IIIF-Möglichkeiten) |
| **K10plus-SRU** (`https://sru.k10plus.de/gvk`) | Bibliothekskatalog (ohne Key) | „Gibt es in der Stadtbibliothek?" — Suche + Sigel-Filter, ggf. Link in den OPAC |
| **Wheelmap / accessibility.cloud** | Barrierefreiheit von Orten (Ampel-System) | Daten großteils OSM (`wheelchair=*`), API mit Key; sinnvoll als Erweiterung der Einrichtungs-Profile, statt eigener Ampel |
| **GBIF / eBird** | Artennachweise | GBIF frei (Suche), eBird mit Key; Ergänzung zu iNaturalist im Modul **Natur** |

---

## 3. Kleinere, aber feine Ideen

* **Freifunk-Knoten:** `api.freifunk.net` listet je Community eine `nodelist.json`
  (technisch: hopglass/nodelist). Als Layer „Freies WLAN in der Nähe" (Community Stuttgart
  im Verzeichnis prüfen) — echtes Open-Data-Nachbarschaftsfeature
* **Defibrillatoren:** OSM `emergency=defibrillator` (Overpass, wie bei den Wanderwegen)
  → Layer „AED in der Nähe" (lebensnah, oft gesucht)
* **Schleusen/Neckar:** Verkehrsmeldungen der Neckar-AG/WSV (ELWIS) — Schleusenbetrieb &
  Sperrungen als Info-Karte zum Pegel
* **Schadstoffmobil / Wertstoff-Termine:** Termine der mobilen Sammelstellen als
  „Was kommt demnächst in meine Straße?"-Kachel (Adressprofil)
* **Landesstatistik BW:** `statistik.bw.de` / Regionaldatenbank für Stadtbezirksreihen —
  als Ergänzung zu CKAN; *API-Zugriff vorher prüfen*
* **Bodenrichtwerte (BORIS BW):** ob ein WMS/WFS existiert, ist zu klären; dann
  „Grundstückspreise im Kiez"

---

## 4. Bewusst nicht empfohlen

* Ticketmaster/Google Places/Yelp/HappyCow/Foursquare (ToS, Quoten, kommerziell) — bleibt
  bei der bestehenden Doku-Entscheidung
* Resident-Advisor-GraphQL (inoffiziell) — bleibt tabu
* ALLRIS-Crawl ohne schriftliche Freigabe (siehe 2.4)
* Blitzortung-Feeds erst nach Klärung des Betreiberkontakts produktiv (siehe 1.2)
* Kommerzielle Pass-Vorhersagen (NextPass o. ä.) — lokal rechnen (2.7)

---

## 5. Priorisierte Roadmap

**Quick Wins (Tage, kein Key, hoher Nutzen)**

1. **Transitous** `map/trips` + `plan` → echte Fahrzeugpositionen & Zweit-Routing (2.1)
2. **Historischer Stadtplan 1914** aus dem eigenen CKAN als Overlay (2.3)
3. **EMSC-Erdbeben** (REST + optional WebSocket) im Umwelt-Modul (1.1)
4. **DIPUL-Geozonen** (WFS) als Layer (2.8)
5. **AED-/Freifunk-Layer** aus OSM/Community-JSON (3)

**Mittel (1–2 Wochen)**

6. LGL **historische Orthophotos** + **Relief-Schummerung** als Zeitreise-/Basiskarten (2.2)
7. **SSE-Endpunkt** `/api/stream` und Ablösen der Frontend-Polls (1.3)
8. **PVGIS** im Adressprofil/Sonne-Modul (2.5)
9. **Stadtbezirks-Statistik** aus CKAN („Kiez in Zahlen") (2.3)

**Große Brocken (mit Partnern/Klärung)**

10. **ALLRIS/OParl** der Stadt — Anfrage stellen, OParl-Bridge vorschlagen (2.4)
11. **LGL-ALKIS/LOD2-Gebäude** → 3D-Stadtmodell & Schatten mit echten Baukörpern (2.2)
12. **DDB/Europeana**-Ortssuche → „Historische Bilder zu diesem Ort" (2.10)

---

## 6. Umsetzungsmuster im Projekt

* Neue Quellen als `server/sources/<name>.mjs`, nur über `cache.mjs` (`politeFetch`,
  TTL, Last-Good, eigener User-Agent `open-stuttgart/…`)
* Schalter/Keys als `OS_*`-Env-Variablen (wie `OS_DB_API_KEY`, `OS_TICKETMASTER_KEY`),
  standardmäßig aus, wenn nicht befüllt
* Build-Zeit-Daten (CKAN, GeoJSON, GPKG) über `scripts/build-*.mjs` nach `server/data/`
  bzw. `public/data/`
* Karten-Layer in `src/map/overlays.ts` (`OVERLAY_LAYERS`) registrieren, Erklärtexte in
  `src/lib/erklaerungen.ts`, Quellenangabe mit Lizenz (CC-BY/dl-de-by/ODbL) im UI
* Echtzeit: Upstream-Sockets nur serverseitig halten, an Frontend per SSE weiterreichen
