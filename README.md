# Open Stuttgart

Offene Daten der Stadt Stuttgart und der Region auf einer Karte. Die Anwendung ergänzt Navigations-Apps: Sie zeigt, was
die Stadt weiß, ohne Konto, ohne Werbung und mit Quelle an jeder Angabe. Enthalten sind unter anderem: Angaben zur eigenen
Adresse (Wahllokal, Grundschulbezirk, Abfuhrtermine, Starkregen, Lärm, Notfall-Treffpunkt), Wartezeiten der Bürgerbüros,
Besucherzahlen der Bäder, Verbindungssuche mit stufenlosem Profil, Echtzeit-Abfahrten, Parkhäuser mit freien Plätzen,
Sharing-Angebote, Baustellen, Radrouten, Luftqualität, Niederschlagsradar, Luftaustausch im Talkessel, Wetter,
Neckarpegel, Veranstaltungen, Sehenswürdigkeiten und historische Luftbilder. Nicht kommerzielles Open-Source-Projekt
für die Landeshauptstadt Stuttgart, Lizenz EUPL-1.2.

## Starten

Voraussetzung: Node.js 20 oder neuer (getestet mit Node 22) und Internetzugang.

```bash
npm install
npm start
```

Danach im Browser **http://localhost:8787** öffnen. `npm start` baut die Oberfläche und startet einen kleinen
Node-Server, der die Seite ausliefert und die Datenquellen abfragt.

Zum Weiterentwickeln mit Live-Reload:

```bash
npm run dev      # Oberfläche auf http://localhost:5173, API-Proxy auf Port 8787
```

Der Port lässt sich mit `PORT=9000 npm start` ändern. `LOG=1` schreibt die Antwortzeiten der Quellen ins Terminal.
`OS_MARKETING=0` schaltet den Hintergrundabruf der Termine von Stuttgart-Marketing ab (siehe unten).

## Live auf Dokploy

Das [`Dockerfile`](Dockerfile) baut die Oberfläche und packt den Server in ein schlankes Image (Port 8787,
`/api/health` als Health-Check). Die großen Datenbestände (`server/data/`) stehen nicht im Git und werden per
rsync auf ein Volume gespielt. Schritt für Schritt — inklusive Domain, HTTPS, Volumes, Umgebungsvariablen und
optionaler Gancio-Anbindung — steht in [`docs/deploy-dokploy.md`](docs/deploy-dokploy.md).

## Was die Demo kann

| Bereich | Inhalt | Quelle (live) |
|---|---|---|
| Karte | Eigener Kartenstil in der Stuttgarter CI, Relief des Talkessels, 3D-Gelände und 3D-Gebäude, hell und dunkel | OpenFreeMap (OpenStreetMap), Mapzen Terrain Tiles |
| Stadtbahn und S-Bahn | Liniennetz in Linienfarben, 724 Haltestellen | VVS-Soll-Fahrplan (GTFS), vorab aufbereitet |
| Abfahrten | Haltestelle antippen oder suchen: nächste Abfahrten mit Verspätung, Gleis/Steig, Ausfällen, Filter nach Verkehrsmittel; Hinweis, wenn die Auskunft keine Echtzeit liefert | EFA-BW (NVBW) |
| Fahrzeuge (berechnet) | Fahrzeuge, die eine Haltestelle in den nächsten 30 Minuten anfahren, als berechnete Position auf dem Linienverlauf; keine GPS-Daten | EFA-BW (Fahrtverlauf mit Soll- und Ist-Zeiten) |
| Pünktlichkeit | Anteil pünktlicher Halte der letzten Stunde je Verkehrsmittel, Linien mit der höchsten Verspätung, eigenes Tagesarchiv; Ersatz für Abfahrten, wenn EFA-BW keine Ist-Zeiten liefert | gtfs.de GTFS-RT (NVBW-Echtzeit, CC BY-SA 4.0), gefiltert mit `scripts/gtfsde-stuttgart.mjs` |
| Bahn am Hauptbahnhof | Abfahrten und Ankünfte mit Verspätungsgrund, Gleiswechsel, Ausfall; Pünktlichkeit je Monat seit 07/2024 | DB IRIS übergangsweise, DB-Timetables-API mit `OS_DB_CLIENT_ID`/`OS_DB_API_KEY`; piebro/deutsche-bahn-data (CC BY 4.0) |
| Anschluss am Hauptbahnhof | Ob ein Umstieg mit der aktuellen Verspätung erreichbar ist, als Ampel und Satz | EFA-BW, DB, eigene Fußwegtabelle |
| Was geht | Szene-Termine (Clubs, Bühnen, Hochschulen, offenes Register) abgeglichen mit dem Kulturkalender, Filter „junges Publikum“, Filter „Kollektive & freie Szene“ mit Erkennung von `kollektiv:<slug>` und Veranstalter-Nennungen, Rückgabe als iCal (`/api/wasgeht.ics`), Meldungen aus offenen Feeds (nur Titel und Link), Stadtgedächtnis-Timeline | Offenes Veranstaltungsregister Stuttgart (Gancio mit `OS_GANCIO_URL`, CC0 1.0), kuratierte Kollektivliste, EINTOPF/LAUTI, KUlturBUnker/Nische, Fridas Pier, Climax Institutes, Kowalski, evensos, Theaterhaus, Im Wizemann, Bix, Wagenhallen, ticket.io, Love Your Artist, Hochschulen, stuvus, Ferienprogramm der Stadt (WFS, CC BY 4.0); optional Jugendagentur (`OS_SCENE_JUGENDAGENTUR=1`) und Ticketmaster (`OS_TICKETMASTER_KEY`); Stadt, Feuerwehr, SWR, Polizei, Bundespolizei, Kessel.TV |
| Verkehrsmeldungen | Unfälle, Staus, Sperrungen und Baustellen im Stadtgebiet; Autobahnstau, Baustellen-Linien (`LineString`, Durchfahrtsbreite, Fahrstreifenreduktion) und Vollsperrungen im Umkreis von 25 km | Landesmeldestelle BW und Verkehrsleitzentrale Stuttgart (DATEX II über MobiData BW), Autobahn GmbH (`warning`, `roadworks`, `closure`) |
| Parken, P+R & Bike+Ride | 42 Parkhäuser der Stadt mit freien Plätzen in Echtzeit; 182 Park+Ride-Plätze (VRS/VVS) verknüpft mit der nächsten S-/U-Bahn-Haltestelle; verschließbare Bike+Ride-Fahrradboxen und Gepäck-/Helmschließfächer mit Live-Belegung, Tarif, Foto und Buchungslink, direkt im Abfahrtsmonitor („noch 9 von 20 Boxen frei · 8 Schließfächer frei“) | ParkAPI v3 und WFS `park-api_bicycle` von MobiData BW (`stuttgart_carparks`, `kienzler_*`, `velobrix`, `bfrk_bw_bike`) |
| Radverkehr | Hauptradrouten sowie Stunden- und Tageswerte der Stuttgarter Eco-Counter-Fahrradzählstellen im Wetterkontext | WFS geoserver.stuttgart.de, Eco-Counter-Feeds und CKAN-Datastore über MobiData BW (CC BY 4.0) |
| Sharing | stadtmobil, Flinkster, RegioRad, Call a Bike, Dott, Bolt, Lime im Stadtgebiet | GBFS 2.3 über MobiData BW |
| Baustellen | laufende und geplante Baustellen des Tiefbauamts mit Zeitraum und Auswirkung | WFS geoserver.stuttgart.de |
| Luft | vier Messstationen mit UBA-Luftqualitätsindex, Schadstoffen und 24-Stunden-Verlauf | Umweltbundesamt (Daten der LUBW) |
| Wetter & Bevölkerungsschutz | aktuelle Messung, Vorhersage 24 h, amtliche Unwetterwarnungen sowie Gefahrenmeldungen aus MoWaS/KATWARN/BIWAPP als Warngebiets-Polygon auf der Karte, verknüpft mit dem nächsten Notfall-Treffpunkt und Leuchtturm außerhalb des Gefahrenbereichs | DWD über Bright Sky, BBK Warn-App NINA (`081110000000`) |
| Himmel über Stuttgart | Luftfahrzeuge im Umkreis von 30 km in Echtzeit (Höhe, Geschwindigkeit, Kurs), Hubschrauber hervorgehoben, Betriebsrichtung des Flughafens EDDS (Piste 07 oder 25) aus METAR und Wind abgeleitet; als Kartenebene. Dazu Wetterballons/Radiosonden im Umkreis von 300 km, die Position der ISS und die berechnete Mondphase | adsb.lol (ODbL), METAR über NOAA Aviation Weather, SondeHub, wheretheiss.at; Mondphase berechnet |
| Stadt-Natur | zuletzt in der Nähe fotografierte Arten (verifizierte Beobachtungen mit freien Fotos), Pollen-Hotspots aus DWD-Tageswerten und Baumstandorten, Obst- und Nussbäume der „Essbaren Stadt“ | iNaturalist (CC BY 4.0), DWD, Baumkataster der Stadt |
| Mensen | Tagesgerichte der sechs Stuttgarter Mensen mit Studierenden- und Gästepreis sowie vegan/vegetarisch, auch als Abendtipp in „Was geht“ | OpenMensa (CC BY-SA 4.0) |
| Neckar | Wasserstand Pegel Cannstatt mit Verlauf | PEGELONLINE (WSV) |
| Termine | Veranstaltungskalender der Stadt für 14 Tage, ergänzt um Stadtbibliothek, Stuttgart-Marketing und VfB-Heimspiele; doppelte Einträge werden nach Zeit, Ort und Titel zusammengeführt, alle Quellen bleiben verlinkt; gefiltert nach Tag und Art (Bühne, Musik, Ausstellung, Kinder …), „läuft gerade“ und „beginnt noch“, Orte auf der Karte | stuttgart.de (RSS und iCal je Termin), veranstaltungen-stadtbibliothek-stuttgart.de und stuttgart-tourist.de (schema.org), OpenLigaDB, Verortung über Nominatim |
| Sehenswürdigkeiten | rund 260 Museen, Bühnen, Aussichtspunkte, Parks, Denkmäler und Kirchen mit Bild und Wikipedia-Kurztext | Wikidata, Wikimedia Commons, Wikipedia |
| Niederschlag | Radarbild der letzten Stunde und Vorhersage für die nächsten 50 Minuten als Kartenebene zum Abspielen; an jeder Haltestelle Beginn und Ende des Niederschlags im Vergleich zur nächsten Abfahrt | DWD-Radar (RV-Produkt) über Bright Sky |
| Luftaustausch | Einschätzung, ob eine Inversion über dem Talkessel den Luftaustausch behindert: Modellwerte (Temperatur in 2 m und 925 hPa, Grenzschichthöhe, Wind) für 48 Stunden und gemessenes Höhenprofil aus Bürgersensoren; bei Wärme oder Inversion Kaltluftströmungspfeile des Klimaatlas als „Abendspaziergang in der kühlen Brise“ | Open-Meteo (Modelle des DWD), Sensor.Community, openSenseMap (`boxes`), Klimaatlas der Stadt |
| Luftbilder | Senkrechtluftbilder der Stadt 2006 bis 2025 als Kartenebene mit Jahreswahl und Deckkraft | WMS geoserver.stuttgart.de, Stadtmessungsamt |
| Meine Adresse | Adresse eingeben oder Standort freigeben: Stadtbezirk, Grundschulbezirk (inkl. Radschulweg, Achtungsstellen und Gehschulweg-Empfehlung), Wahlbezirk und Wahllokal mit Barrierefreiheit, nächstes Bürgerbüro mit Wartezeit, Abfuhrtermine, Starkregengefahr und Hochwasser HQ100, Lärm an der Fassade, kommunale Wärmeplanung (Quartiers-Steckbrief, Wärmeverbrauchsdichte), Solarkataster (Dachfläche, kWp, Ertrag, CO₂), Gründachkataster, Geothermie-Bohrtiefen und Abwasserwärme, Mietspiegel-Wohnlage, Soziale Erhaltungssatzung, Baumschutzsatzung und Denkmal-Gesamtanlage, Jodprophylaxe-Bezirk, Bewohnerparkgebiet und E-Scooter-Regelung, Klimaatlas (Klimatop, Kaltluftleitbahn), städtisches Baumkataster im 150-m-Umkreis (Pollenbäume, Jungbäume, Naturdenkmäler) mit Gieß-Radar (Regenbilanz 7 Tage, nächster Wasserbrunnen), Unfallschwerpunkte im 300-m-Umkreis, Bebauungspläne, Planauslage, Wahlergebnis im Stadtbezirk, Übergabe an die Gelbe Karte | Geoserver der Stadt (`GEOLINE_FLEX`, `Base`, `Daten`), AWS, Statistisches Amt, DWD über Bright Sky, Unfallatlas (dl-de/by-2-0) |
| Verwaltung | Verwaltungsleistungen (Voraussetzungen, Unterlagen, Gebühren, Bearbeitungsdauer, Ablauf, Rechtsgrundlage), Online-Dienste, Terminbuchung und Gebäude mit Dienststellen, Öffnungszeiten („jetzt geöffnet“) und Live-Wartezeit der Bürgerbüros (`/api/verwaltung/*`) | stuttgart.de (Sitepark/citygov-Kopfdaten und Leistungsseiten), Wartezeitanzeige der Bürgerbüros |
| StuttBot | Bürgeranliegen-Assistent: versteht Freitext, fragt fehlende Angaben ab, findet die Leistung, empfiehlt das schnellste Bürgerbüro aus Wartezeit plus Anfahrt und verlinkt Termin/Online-Dienst. Mit Maskottchen (Fernsehtürmli) und deterministischem Fallback ohne API-Key (`POST /api/bot`) | Gemini Flash-Lite (nur Sprachschicht), stuttgart.de-Verwaltungsdatensatz, Live-Wartezeiten, EFA-BW/Valhalla |
| In der Nähe | Kitas, Schulen, Spielplätze, Ferienprogramm, digitale Teilhabe, Toiletten, Trinkbrunnen, Mineral- und Heilquellen, Hofläden/Direktvermarkter, kühle Orte, Jugend-Chillorte (inkl. umgenutzter Orte), Fahrrad- und Lastenrad-Abstellanlagen, E-Scooter-Abstellzonen, Behindertenparkplätze, Wertstoffhöfe, Schadstoffmobil, Grüngutannahme, RECUP-Mehrweg-Standorte, Notfall-Treffpunkte und Leuchttürme, Aktion Gute Fee, Obst- und Nussbäume, Minigolf, Kunst, Musik, Theater und Kinos; Vereine und Engagement (öffentliche Sportanlagen, Bürgerhäuser, Jugendtreffs, Kulturorte); Weinwanderwege, Innenstadtrundweg und MTB-Downhill „Woodcracker“ (verknüpft mit der Zahnradbahn „Zacke“); Geocaching über Opencaching.de; Ladepunkte mit Grünstrom-Anteil; Essen und Trinken mit Filter „vegan“/„vegetarisch“ (nur oder auch), dazu Mensen | Geoserver der Stadt (CC BY 4.0), OCPDB über MobiData BW, OpenStreetMap (Auszug 17.10.2026, ODbL), OpenMensa, Fraunhofer ISE Energy-Charts, Opencaching.de |
| Unfallatlas | 1.635 Unfälle mit Personenschaden in Stuttgart (2025), davon 8 tödliche, 500 mit Rad, 241 mit Fuß; Kartenebene nach Schwere, Schwerpunkte, Unfälle im 30-Meter-Korridor einer Route und im 300-Meter-Umkreis einer Adresse | Unfallatlas der Statistischen Ämter des Bundes und der Länder (dl-de/by-2-0) |
| Stadtgedächtnis | Archiv der öffentlichen Veränderungen: Meldungen, amtliche Bekanntmachungen, neu erfasste OpenStreetMap-Orte und Änderungen an Verwaltungsseiten, mit Datum, Quelle, Lizenz und Bezirksfilter; als RSS abonnierbar | Stadt, Feuerwehr, Polizei, SWR, Kessel.TV, Amtliche Bekanntmachungen, OpenStreetMap (ODbL), Verwaltungsseiten |
| Alles durchsuchen | Cmd/Ctrl+K-Palette über 10.289 Seiten, Leistungen, Dienststellen, Online-Dienste und Dokumente; FTS5-Volltextsuche, Facetten, Dokumentenleser mit Ablauf, Bezugsquellen, Backlinks und verwandten Dokumenten | Lokale SQLite-/FTS5-Datenbank aus stuttgart.de (Verwaltungs- und Seitendaten); `sqlite-vec` für Vektoren vorbereitet |
| Stadtwissen | Fünf Reiter: Karte mit allen 458 WFS-Layern (77 freigegeben und direkt ladbar), amtlicher gis6-Geocoder, KOMUNIS-Statistik mit XLSX-Anhängen, FragDenStaat-Transparenz, Fairteiler, GBIF-Arten, OSM-Hinweise, Wikidata-Lücken, K10plus-Bibliothek, GovData-Änderungsfeed; Ausgabe als GeoJSON/RSS/iCal/CSV, permanenter Link, QR-Schild, Kiosk und Vorlesen | Geoserver der Stadt (WFS 2.0.0, CC BY 4.0 bzw. Nutzungsbedingungen), gis6, KOMUNIS, FragDenStaat, foodsharing, GBIF, OSM Notes, Wikidata, K10plus, GovData |
| Live-Zustände | Wartezeit der Bürgerbüros und Besucherzahl der Bäder als Kartenebene, mit „üblich um diese Zeit“, bester Zeit und Trefferquote aus eigener Aufzeichnung | Wartezeitanzeige der Stadt, Stuttgarter Bäder |
| Weg | Bus und Bahn von Tür zu Tür mit Echtzeit, Profile „stufenlos“ und „mit Kinderwagen“, Aufzugsstatus der DB-Stationen; Fahrrad mit Steigung, Pedelec, zu Fuß mit Höhenprofil, Auto mit freien Parkhäusern am Ziel; ausgeschilderte Wander-, Weinwander- und Downhillwege (Blaustrümpflerweg, Rößleweg, 4-Burgen-Weg, Georg-Fahrbach-Weg, HW 5, Stuttgarter Weinwanderwege) mit Länge, Auf-/Abstieg, Start/Ziel, Haltestellen und Unfällen im 30-Meter-Korridor; Übergabe an Google Maps, Apple Karten, OpenStreetMap | EFA-BW, BFRK (NVBW), DB SIRI-FM, Valhalla und OSRM (FOSSGIS), BRouter, Geoserver der Stadt (CC BY 4.0), OpenStreetMap-Routenrelationen (ODbL), Unfallatlas (dl-de/by-2-0) |
| Gesundheit | Pollenflug, UV-Index, amtliche Hitzewarnung und Hitzetrend, Biowetter, Höchsttemperatur, Zustand des Stromnetzes, Grünstrom-Anteil im regionalen Netz (15-Minuten-Takt, postleitzahlgenau) mit bestem Zeitfenster | DWD Opendata, TransnetBW StromGedacht, Fraunhofer ISE (Energy-Charts) |
| Sonne | Abendsonne-Finder: wann das Gelände an welchem Ort die Sonne verdeckt, als Schattenkarte zum Abspielen und als Liste der Aussichtspunkte | eigene Rechnung aus dem Höhenmodell (Mapzen Terrain Tiles), Wolken vom DWD |

### Stadtwissen und Schnittstellen

- **Stadt-Layer:** `/api/stadt/wfs/katalog` liest die WFS-Capabilities und führt alle 458 Layer mit Workspace, BBox und Freigabestatus. 77 Layer sind im Projekt freigegeben und lassen sich als GeoJSON auf die Karte legen; die übrigen bleiben sichtbar, aber gesperrt, bis das Stadtmessungsamt sie freigibt. Der Proxy `/api/stadt/wfs` liefert nur freigegebene Layer, auf einen Radius begrenzt und sechs Stunden zwischengespeichert.
- **Amtlicher Geocoder:** Die Adresssuche fragt zuerst `gis6.stuttgart.de` und fällt nur bei Ausfall auf Nominatim zurück. Damit kommen Adressen, Straßen, Haltestellen und Stadtteile präziser und mit Bounding Box.
- **Kiez in Zahlen:** `/api/stadt/komunis` navigiert durch die KOMUNIS-Views, `/api/stadt/komunis/doc` löst die Dokumentseite auf und liefert die direkten XLSX-Anhänge. Die Oberfläche zeigt Kategorien, Monat, Tabellentyp und Download.
- **Transparenz:** `/api/stadt/fragdenstaat` liest die 285 öffentlichen IFG-Anfragen an die Stadt (Behörden-ID 9384), `/api/stadt/fragdenstaat.rss` macht sie abonnierbar. Die Beteiligungsplattform wird wegen `Disallow: /api/` in robots.txt nur verlinkt, nicht automatisch abgefragt.
- **Fundstücke:** 12 öffentliche Fairteiler von foodsharing, GBIF-Artenfunde im Umkreis, offene OSM-Hinweise (Schreiben über den OSM-Editor) und eine Wikidata-SPARQL-Abfrage nach Orten ohne Wikipedia-Artikel. Dazu die K10plus-SRU-Suche.
- **Ausgabe:** Jeder freigegebene Layer ist als GeoJSON und RSS abrufbar; „Was geht“ bleibt als iCal, das Stadtgedächtnis und FragDenStaat als RSS, das Archiv als CSV. Detailansichten teilen einen permanenten Link (`?o=…`); das QR-Schild wird lokal im Browser erzeugt und gedruckt. `?display=kiosk` startet das Public-Display-Profil.
- **Standards:** Die App führt in „Ausgabe“ eine Matrix, was live integriert ist, was nur verlinkt wird und was einen Key oder eine Freigabe braucht. Die vollständige Zuordnung steht in [`docs/schnittstellen-integration.md`](docs/schnittstellen-integration.md).

### Unfallatlas, Stadtgedächtnis und die neuen Freizeitdaten

- **Unfallatlas:** `npm run data:unfall` lädt den aktuellen Unfallatlas (Standard 2025), filtert den Stadtkreis Stuttgart und schreibt `server/data/unfaelle-stuttgart.json` (dl-de/by-2-0). Die Karte zeigt die Punkte nach Schwere, die Adressansicht zählt Unfälle im 300-Meter-Umkreis, und im Routenmodul werden Unfälle im 30-Meter-Korridor der gewählten Verbindung gezählt. Es sind nur Unfälle mit Personenschaden, keine Sachschäden.
- **Stadtgedächtnis:** `/api/stadtgedaechtnis?days=30` führt Meldungen, amtliche Bekanntmachungen, OpenStreetMap-Neuigkeiten (mit `OS_OPENINGS=1`) und Änderungen an den Verwaltungsseiten zusammen. Jeder Eintrag nennt Datum, Quelle und Lizenz. Der Vergleichsstand liegt in `server/.cache/`; der erste Lauf setzt nur den Stand. Der Feed ist unter `/api/stadtgedaechtnis.rss` abonnierbar.
- **Wanderwege:** `/api/wanderwege` liefert Weinwanderwege, Innenstadtrundweg und Woodpecker-Trail aus dem Geoserver sowie die OSM-Routenrelationen (Blaustrümpflerweg, Rößleweg, 4-Burgen-Weg, Georg-Fahrbach-Weg, HW 5, Stuttgarter Weinwanderwege) mit Länge, Auf-/Abstieg, Start/Ziel, Haltestellen und Brunnen/Toiletten im 150-Meter-Korridor. Die OSM-Datei wird mit `npm run data:wanderwege` erneuert. Die Ebene `hike` zeigt alle Linien, im Modul „Weg“ lassen sie sich öffnen.
- **Vereine und Engagement:** neue Kategorien in „Nähe“ für öffentliche Sportanlagen, Bürgerhäuser, Jugendtreffs, Kultur- und Musikorte. Bewusst nur öffentliche Adressen, keine Vorstands-Wohnadressen.
- **Kollektive:** kuratierte Stammliste in `server/data/kollektive.json` plus Erkennung von `kollektiv:<slug>` und Veranstalter-Nennungen in Gancio-Terminen. Filter „Kollektive & freie Szene“ in „Was geht“.
- **Geocaching:** `/api/geocaches` liest Opencaching.de höchstens alle 12 Stunden und zeigt nur Startkoordinaten, D/T-Wertung, Größe und Listing-Link. Die Quelle war bei der Einrichtung nicht erreichbar (HTTP 503); ein lokaler Bestand und ein optionaler JSON-Export (`OS_OPENCACHING_JSON`) sind vorbereitet. Keine Spoiler, kein Geocaching.com-Scraping.
- **Vegan/vegetarisch:** In „Essen und Trinken“ filtern „Vegan“ und „Vegetarisch“ nach `diet:vegan`/`diet:vegetarian` aus OpenStreetMap. „Nur komplett“ trennt `only` von `yes`.
- **Versteckte Schnittstellen:** Das StadtPalais veröffentlicht seine Ausstellungen und einen AJAX-Kalender mit serverseitigem Datumsfilter (`/api/stadt/stadtpalais`; die REST-Termine waren bereits im Kulturmodul), die Stuttgarter Bäder liefern ihr komplettes Verzeichnis als JSON (`baeder.json`, ergänzt `/api/nearby/baeder`), und der städtische CKAN-Katalog ist mit 140 Datensätzen unter `/api/stadt/ckan` angebunden. Funde, Prüfungen und Grenzen stehen in `docs/api-recherche-2026-10-versteckte-schnittstellen.md`.
- **Everything Search:** `npm run data:search` baut aus `server/data/verwaltung.sqlite` die lokale `server/data/suche.sqlite` mit Dokumentenregister, FTS5, 167.098 Links, 2.075 Ablaufschritten und 4.195 Bezugsquellen. Die App bietet dafür `Cmd/Ctrl+K` und den Dokumentenleser; Details in `docs/suche-dokumentenregister.md`. Die Vektortabelle ist mit `sqlite-vec` angelegt, die Embeddings folgen.
- **Optional:** `OS_SCENE_JUGENDAGENTUR=1` aktiviert die Jugendagentur (The Events Calendar), `OS_TICKETMASTER_KEY` die Ticketmaster Discovery API (nur große Häuser, keine Bilder). Beide sind standardmäßig aus, weil die Jugendagentur im Test nicht erreichbar war und Ticketmaster einen Key braucht.

### Verbindungen zwischen den Daten

- **Hinkommen:** Zu jedem Termin und jedem Ort die nächsten Haltestellen mit Gehzeit und Linien, dazu Parkhäuser
  in der Nähe mit freien Plätzen jetzt.
- **Heimweg:** Erste Fahrten ab der Haltestelle am Veranstaltungsort nach dem Ende (ohne Angabe: Beginn plus 2,5 Stunden),
  aus der EFA-Abfahrtsauskunft für diesen Zeitpunkt; Hinweis auf Nachtbusse bei spätem Ende.
- **Wetter zur Beginnzeit:** Stundenwert des DWD zum Termin, Regenhinweis; bei Regen am Abend schlägt das Kulturmodul
  die Termine vor, die drinnen stattfinden.
- **Fernsicht:** Sichtweite und Bewölkung bewerten, ob sich die Aussichtspunkte heute lohnen.
- **Rund um die Haltestelle:** Die Abfahrtsansicht zeigt, was heute in Gehweite los ist und was es zu sehen gibt.
- **Abendsonne:** Gelände-Sonnenuntergang je Ort, verbunden mit Bewölkung und der nächsten Haltestelle.
- **Baustellen und Linien:** Jede Baustelle wird den Stadtbahn- und S-Bahn-Linien im Umkreis von 30 m zugeordnet;
  die Abfahrtsansicht nennt Baustellen an den Linien der Haltestelle.
- **Alternativen bei Ausfall:** Fällt eine Fahrt aus oder ist sie mehr als 10 Minuten verspätet, nennt die
  Abfahrtsansicht die nächste Fahrt derselben Linie, Leihfahrzeuge im Umkreis von 300 m und Nachbarhaltestellen bis 500 m.
- **Großveranstaltungen:** Hinweis bei Terminen in Stadion, Hallen, Wasen oder Messe mit erwartetem Verkehrszeitraum,
  freien Parkplätzen in der Umgebung und Wetter zum Veranstaltungsende.
- **Bike+Ride am Gleis und Schließfach am Abend:** Die Abfahrtsansicht zeigt freie Fahrradboxen und Schließfächer
  der Haltestelle in Echtzeit („noch 9 von 20 Boxen frei“); „Was geht“ nennt für den Abend das nächste freie
  Schließfach für Rucksack oder Helm am Hauptbahnhof oder in der Stadtmitte.
- **Grünstrom zum Laden:** An den Ladepunkten steht neben der Belegung der aktuelle Anteil erneuerbarer Energien
  im Stuttgarter Netz und das günstigste Zeitfenster der nächsten Stunden.
- **Warnung und Notfall:** Liegt eine amtliche Meldung vor, blendet die Karte das Warngebiet als Fläche ein und
  nennt den nächsten Notfall-Treffpunkt sowie Leuchtturm mit Notstrom außerhalb des Gefahrenbereichs.
- **Gieß-Radar und Pollen-Hotspots:** Junge Bäume (seit 2020 gepflanzt), Regenbilanz der letzten sieben Tage und
  der nächste Wasserbrunnen zeigen, wo Gießen sinnvoll ist; die Pollenkarte verbindet die DWD-Tageswerte mit den
  Baumstandorten und markiert Rasterfelder mit vielen Bäumen der belasteten Gattung.
- **Abendspaziergang in der kühlen Brise:** Bei Wärme oder Inversion schlägt das Kessel-Modul vor, die
  Kaltluftströmungspfeile des Klimaatlas einzublenden – die Täler mit nächtlichem Frischluftzufluss werden sichtbar.
- **Fluglärm einordnen:** Wer ein Brummen über der Stadt hört, sieht, welches Luftfahrzeug gerade in welcher Höhe
  unterwegs ist; aus Wind und METAR wird abgeleitet, ob die Piste 07 oder 25 in Betrieb ist.
- **Mensa-Tipp für den Abend:** „Was geht“ ergänzt das günstigste Tagesgericht der nächsten Mensa mit
  Studierenden- und Gästepreis.

### Über die Anwendung

- **Grundsätze:** kein Konto, keine Werbung, keine bezahlte Reihenfolge, kein Tracking; eigene Einschätzungen sind gekennzeichnet.
- **Wie entsteht dieser Wert?** Das Zeichen ⓘ an jeder Ansicht führt zu Quelle, Abrufintervall, Grenzen und Lizenz (`src/lib/erklaerungen.ts`).
- **Barrierefreiheit:** Erklärung nach BITV 2.0 (Selbstbewertung), Sprunglink, Tastaturbedienung, Listen als Alternative zur Karte, Kurztexte in Leichter Sprache.
- **Sprachen:** Bedienelemente, Überschriften und Grundsätze auf Englisch umschaltbar (`src/lib/i18n.ts`); Inhalte der Quellen bleiben in der Originalsprache.
- **Offenes Archiv:** Der Server zeichnet Besucherzahlen der Bäder und Wartezeit-Stufen der Bürgerbüros alle 5 Minuten auf (`server/.cache/archiv/JJJJ-MM-TT.csv`, herunterladbar unter `/api/archiv`). Abschalten mit `OS_VERLAUF=0`.
- **Berechnete Fahrzeugpositionen** kosten je Haltestelle 1 + höchstens 6 Anfragen bei EFA-BW alle 30 Sekunden und nur, solange jemand sie eingeschaltet hat. Abschalten mit `OS_VEHICLES=0`.
- **Echtzeitfeed gtfs.de** wird höchstens alle 3 Minuten geladen (rund 27 MB); Archiv `server/.cache/archiv/puenktlichkeit-JJJJ-MM-TT.csv`. Abschalten mit `OS_GTFSRT=0`. Neue gtfs.de-Statik erfordert `node scripts/gtfsde-stuttgart.mjs`.
- **Was geht:** jede Quelle einzeln abschaltbar mit `OS_SCENE_<KEY>=0`. Ein eigenes offenes Veranstaltungsregister auf Basis von Gancio 1.28.2 wird über `OS_GANCIO_URL` angebunden (Konfiguration in `gancio/`, Spezifikation und Ansprache-Entwürfe in `docs/gancio-register-und-ansprachen.md`). Die Auswertung neu erfasster Orte aus OpenStreetMap ist noch nicht im Dauerbetrieb geprüft und nur mit `OS_OPENINGS=1` aktiv. Die Quellenstrategie für eine möglichst vollständige, tatsächlich stattfindende Terminliste (Hausseiten, offene Register, freigegebene Aggregatoren, Umgang mit Rausgegangen/RA/VIVA) steht in `docs/veranstaltungen-alle-quellen.md`; `npm run check:wasgeht` prüft alle Quellen auf Anzahl, Alter und Fehler.
- **Daten der Stadt:** Für Mängelmelder, PVOG-Verwaltungsassistent, Sperrungen, SSB-Fahrzeuge, Verkehrszählung, Apotheken-Notdienst, Starkregen-Frühwarnung und weitere Wartezeiten sind Schnittstellen vorbereitet (`server/sources/partner.mjs`); sie werden über Umgebungsvariablen angebunden, sobald Zugang besteht.
- **Verwaltungsdatensatz:** Ämter, Gebäude und Leistungen aus dem Stadtseiten-Crawl (`docs/bericht-crawl.md`, `docs/spezifikation-ebene-verwaltung.md`, `docs/verwaltung-datensatz.md`) werden über `server/sources/verwaltung.mjs` eingebunden (`server/data/verwaltung-demo.json`, `server/data/verwaltung.json` oder `server/data/verwaltung.sqlite`).
- **StuttBot:** Der Assistent läuft über `POST /api/bot`, hält Sessions nur im Arbeitsspeicher und arbeitet mit
  Function Calling: Ist ein Modell konfiguriert, wählt es selbst Werkzeuge (Leistungssuche, Leistungsdetails,
  Bürgerbüro mit Wartezeit, Route, Ortsauflösung), der Server führt sie aus und erdet die Antwort gegen die
  Werkzeugergebnisse. Ohne `GEMINI_API_KEY` (oder `GOOGLE_API_KEY`) greift der deterministische Regelpfad. Der Key kann in einer `.env` im Projektordner liegen (wird von `server/env.mjs` geladen, `.env` ist ignoriert) oder als Umgebungsvariable gesetzt werden. Standardmodell ist `gemini-2.5-flash-lite`, Tagesbudget 0,50 USD (`OS_BOT_DAILY_USD`), Rate-Limit 40 Anfragen pro Stunde und IP (`OS_BOT_RATE`). Kill-Switch: `OS_BOT=0`. Konzept, Prompting, Kosten und Datenschutz: [`docs/stuttbot.md`](docs/stuttbot.md). Rauchtest: `npm run check:bot`.

Teilbare Links: Der Kartenausschnitt steht in der Adresse (`#karte=zoom/lat/lon`), eine gewählte Haltestelle als
`?stop=de:08111:6115`.

## Aufbau

```
server/            Node-Server ohne Abhängigkeiten
  index.mjs        API-Routen /api/* und Auslieferung von dist/
  cache.mjs        Zwischenspeicher mit Ablaufzeit, höflicher Abruf je Host, letzter guter Wert bei Ausfall
  sources/         eine Datei je Quelle (efa, parking, sharing, roadworks, environment, culture, events-extra, radar, kessel,
                   nearby, adresse, verwaltung, verlauf, routing, aufzuege, hitze, beteiligung, partner, bot, bot-katalog)
  .cache/          dauerhafter Zwischenspeicher (iCal-Details, Verortungen), nicht im Git
src/
  map/             Kartenstil (mapStyle.ts), Fachebenen (overlays.ts), Symbole (icons.ts), MapView.tsx
  modules/         Themenmodule: nearby, route, mobility, environment, culture, sun
  components/      Suche, Detailansichten, Bedienelemente, StuttBot mit Fernsehtürmli-Maskottchen
  lib/             Datenabruf, Formatierung, Typen, Geometrie, Sonnenstand, sunWorker.ts (Schattenrechnung im Web Worker)
public/data/       aufbereitete Fahrplandaten (network.geojson, stops.geojson)
scripts/           build_gtfs.py (Fahrplan aufbereiten), dev.mjs, bot-eval.mjs (StuttBot-Rauchtest)
```

### Neues Modul ergänzen

1. Datenquelle als `server/sources/<name>.mjs` anlegen und in `server/index.mjs` als Route eintragen.
2. Abruf in `src/lib/data.tsx` ergänzen (`usePolling('/api/<name>', intervall)`).
3. Kartenebene in `src/map/overlays.ts` (Quelle, Layer, Eintrag in `OVERLAY_LAYERS`) anlegen.
4. Panel unter `src/modules/<name>/` schreiben und in `src/modules/index.ts` registrieren.

Das Modul „Kultur“ ist ein vollständiges Beispiel dafür.

### Fahrplandaten aktualisieren

Die Dateien in `public/data/` stammen aus dem VVS-GTFS (Stand 19.10.2026, gültig bis 19.01.2027). Neu erzeugen:

```bash
curl -L -o vvs.zip https://download.vvs.de/gtfs_realtime.zip   # trotz Name statischer Fahrplan, ca. 120 MB
npm run data:gtfs -- vvs.zip                                     # braucht Python 3, nur Standardbibliothek
```

## Rücksicht auf die Quellen

Alle Abrufe laufen über den Server, nie direkt aus dem Browser. Jede Quelle wird höchstens so oft gefragt, wie es
fachlich nötig ist, für alle Nutzer gemeinsam: Abfahrten je Haltestelle höchstens alle 20 Sekunden, Parken und Sharing
einmal pro Minute (GBFS-`ttl` beachtet), Luft und Pegel alle 15 Minuten, Wetter alle 10 Minuten, Baustellen alle
15 Minuten. Der Veranstaltungsfeed wird alle 30 Minuten gelesen; die iCal-Details holt der Server nur für den
angefragten Tag, einen Termin pro Sekunde, und hält sie 12 Stunden auf der Platte. Die Hausseiten von Kulturbunker,
Fridas Pier, Climax und Kowalski werden höchstens alle 6 Stunden gelesen, EINTOPF höchstens alle 12 Stunden über
seine öffentlichen Tageslisten (23 Seiten), evensos alle 6 Stunden. Adressen werden über Nominatim
höchstens einmal pro Sekunde verortet und 90 Tage gespeichert. Wikidata wird einmal am Tag gefragt. Das Niederschlagsradar wird alle 5 Minuten geholt, Open-Meteo einmal pro Stunde,
Sensor.Community alle 10 Minuten. Luftbilder werden erst ab Zoomstufe 13 und nur bei eingeschalteter Ebene geladen.
OpenLigaDB wird zweimal am Tag gefragt. Die Stadtbibliothek wird je angefragtem Tag höchstens alle 12 Stunden gelesen
(höchstens 6 Listenseiten, 2 Sekunden Abstand). Für Stuttgart-Marketing gibt es keinen offenen Export; übergangsweise
liest der Server die Sitemap höchstens einmal am Tag und die Veranstaltungsseiten nacheinander im Hintergrund mit
5 Sekunden Abstand, jede Seite höchstens alle 7 Tage. Die in robots.txt gesperrten Pfade werden nicht verwendet. Bürgerbüro-Wartezeiten und Bäder werden einmal pro Minute
gelesen, Geoserver-Ebenen einmal am Tag, Angaben zu einer Adresse höchstens alle 30 Tage je Ort. Verbindungen: EFA je
gleicher Anfrage höchstens alle 60 Sekunden; Valhalla, OSRM und BRouter höchstens eine Anfrage pro Sekunde, gleiche Wege
24 Stunden gespeichert. Der Aufzugsabgleich der DB (NeTEx, etwa 19 MB) wird höchstens einmal pro Woche geladen. DWD-Dateien
zu Hitze und Biowetter alle 30 Minuten. Bevölkerungsschutz-Warnungen (warnung.bund.de) alle 2 Minuten, ADS-B-Flugdaten
höchstens alle 45 Sekunden, Artenbeobachtungen und Speisepläne alle 15 bzw. 60 Minuten, Grünstrom alle 15 Minuten.
Die Beteiligungsplattform der Stadt wird nicht automatisch abgefragt (robots.txt).
Ein offizieller Export ist angefragt bzw. anzufragen. Zwischen zwei Anfragen an denselben Host liegt eine Mindestpause. Die Anfragen tragen einen eigenen
User-Agent. Fällt eine Quelle aus, zeigt die Demo den letzten guten Stand und einen Hinweis.

## Lizenzen und Namensnennung

- Fahrplan: VVS, CC BY 4.0
- Abfahrten: NVBW / EFA-BW, Datenlizenz Deutschland – Namensnennung 2.0
- Parken: Landeshauptstadt Stuttgart, PBW, über MobiData BW
- Sharing: jeweilige Anbieter über MobiData BW (GBFS)
- Baustellen, Radrouten: Landeshauptstadt Stuttgart, Open Data
- Luft: Umweltbundesamt mit Daten der LUBW, dl-de/by-2-0
- Wetter: Deutscher Wetterdienst über Bright Sky
- Pegel: WSV, PEGELONLINE
- Termine: Landeshauptstadt Stuttgart, Veranstaltungskalender; Stadtbibliothek Stuttgart; Stuttgart-Marketing GmbH;
  OpenLigaDB (jeder Eintrag verlinkt die Originalseiten)
- Niederschlagsradar: Deutscher Wetterdienst über Bright Sky
- Luftaustausch: Open-Meteo (CC BY 4.0), Sensor.Community (ODbL)
- Luftbilder: Landeshauptstadt Stuttgart, Stadtmessungsamt
- Orte: Wikidata (CC0), Texte Wikipedia (CC BY-SA 4.0), Bilder Wikimedia Commons (Lizenz je Bildseite)
- Verortung: © OpenStreetMap-Mitwirkende, Nominatim (ODbL)
- Karte: © OpenStreetMap-Mitwirkende, OpenMapTiles, OpenFreeMap; Relief: Mapzen Terrain Tiles
- Einrichtungen, Wahlbezirke, Starkregen, Lärm, Bebauungspläne, Notfall-Treffpunkte: Landeshauptstadt Stuttgart, CC BY 4.0
- Wartezeiten der Bürgerbüros, Wahlergebnisse, Gelbe Karte: Landeshauptstadt Stuttgart
- Besucherzahlen: Stuttgarter Bäder; Abfuhrtermine: Abfallwirtschaft Stuttgart
- Ladepunkte: MobiData BW (OCPDB)
- Gastronomie: © OpenStreetMap-Mitwirkende, ODbL
- Wege: Valhalla und OSRM (FOSSGIS), BRouter, Kartendaten © OpenStreetMap-Mitwirkende; Aufzüge: BFRK (NVBW, dl-de/by-2-0), DB InfraGO
- Pollen, UV, Hitze, Biowetter, Höchsttemperatur: Deutscher Wetterdienst; Stromnetz: TransnetBW; Grünstrom: Fraunhofer ISE, Energy-Charts (CC BY 4.0)
- Flugverkehr: adsb.lol (ODbL); METAR: NOAA Aviation Weather (gemeinfrei)
- Stadt-Natur: iNaturalist-Community (CC BY 4.0), Fotos cc0 / CC BY / CC BY-SA je Beobachtung
- Mensen: OpenMensa (CC BY-SA 4.0), Daten der Studierendenwerke
- Schriften: Merriweather Sans und DM Sans (SIL Open Font License), lokal eingebunden

Die Nutzung der städtischen Daten und der Drittanbieter ist laut Projektleitung durch eine schriftliche Bestätigung
der Stadt (Fair Use) gedeckt. Die Quellenangaben stehen zusätzlich in der App an jeder Ansicht.

## Bekannte Grenzen

- Die Station „Am Neckartor“ liefert beim UBA seit August 2026 keine Werte, die Demo zeigt das an.
- Bright Sky antwortet gelegentlich mit Fehler 502; dann nimmt die Demo den nächstgelegenen Stundenwert.
- Linienverläufe stammen aus dem Soll-Fahrplan; Fahrzeugpositionen in Echtzeit gibt es für den VVS nicht offen.
- S-Bahn-Linienfarben sind an den VVS-Netzplan angelehnt, weil das GTFS alle S-Bahnen gleich färbt.
- Stadtlogo und Wappen fehlen bewusst, bis sie offiziell als Datei bereitstehen.
- Die Schattenrechnung kennt nur das Gelände (Raster etwa 25 m), keine Gebäude und Bäume; in der Innenstadt ist die
  Sonne daher oft früher weg. Türme sind am Boden gerechnet, außer der Plattform des Fernsehturms.
- Gut zehn Prozent der Termine lassen sich nicht oder nur über die Postleitzahl verorten; die Demo kennzeichnet das.
- Der Luftaustausch ist eine Einschätzung aus Modell- und Sensordaten, keine amtliche Messung. Bürgersensoren können
  durch Sonne oder Hauswände verfälscht sein; Ausreißer werden verworfen.
- Der Geoserver der Stadt veröffentlicht (Stand 10/2026) keine Flächen der Sanierungsgebiete; die Abfrage im
  Adressprofil ist vorbereitet und zeigt Werte, sobald der Datensatz erscheint.
- ADS-B erfasst nur Flugzeuge mit sendendem Transponder in Reichweite; die Betriebsrichtung des Flughafens ist aus
  dem Wind abgeleitet, keine amtliche Betriebsinformation.
- Die Zahl der Termine je Tag in der Tagesauswahl ist eine Obergrenze, weil der Abgleich nur für den gewählten Tag läuft.

## Lizenz

Der Code steht unter der European Union Public Licence 1.2 (EUPL-1.2), siehe `LICENSE`. Für die Daten gelten die
Lizenzen der jeweiligen Quellen (oben). Beiträge: siehe `CONTRIBUTING.md`.
