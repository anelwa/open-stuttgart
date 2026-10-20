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
| Was geht | Szene-Termine (Clubs, Bühnen, Hochschulen) abgeglichen mit dem Kulturkalender, Filter „junges Publikum“, Meldungen aus offenen Feeds (nur Titel und Link) | Theaterhaus, Im Wizemann, Bix, Wagenhallen, ticket.io, Love Your Artist, Hochschulen, stuvus; Stadt, Feuerwehr, SWR, Polizei, Bundespolizei, Kessel.TV |
| Verkehrsmeldungen | Unfälle, Staus, Sperrungen und Baustellen im Stadtgebiet; Autobahnstau im Umkreis von 25 km mit Geschwindigkeit und Zeitverlust | Landesmeldestelle BW und Verkehrsleitzentrale Stuttgart (DATEX II über MobiData BW), Autobahn GmbH |
| Parken | 42 Parkhäuser der Stadt, davon gut 30 mit freien Plätzen in Echtzeit, Belegung, Preise, Öffnungszeiten | ParkAPI von MobiData BW (Quelle `stuttgart_carparks`) |
| Sharing | stadtmobil, Flinkster, RegioRad, Call a Bike, Dott, Bolt, Lime im Stadtgebiet | GBFS 2.3 über MobiData BW |
| Baustellen | laufende und geplante Baustellen des Tiefbauamts mit Zeitraum und Auswirkung | WFS geoserver.stuttgart.de |
| Radrouten | Hauptradrouten | WFS geoserver.stuttgart.de |
| Luft | vier Messstationen mit UBA-Luftqualitätsindex, Schadstoffen und 24-Stunden-Verlauf | Umweltbundesamt (Daten der LUBW) |
| Wetter | aktuelle Messung, Vorhersage 24 h, amtliche Warnungen | DWD über Bright Sky |
| Neckar | Wasserstand Pegel Cannstatt mit Verlauf | PEGELONLINE (WSV) |
| Termine | Veranstaltungskalender der Stadt für 14 Tage, ergänzt um Stadtbibliothek, Stuttgart-Marketing und VfB-Heimspiele; doppelte Einträge werden nach Zeit, Ort und Titel zusammengeführt, alle Quellen bleiben verlinkt; gefiltert nach Tag und Art (Bühne, Musik, Ausstellung, Kinder …), „läuft gerade“ und „beginnt noch“, Orte auf der Karte | stuttgart.de (RSS und iCal je Termin), veranstaltungen-stadtbibliothek-stuttgart.de und stuttgart-tourist.de (schema.org), OpenLigaDB, Verortung über Nominatim |
| Sehenswürdigkeiten | rund 260 Museen, Bühnen, Aussichtspunkte, Parks, Denkmäler und Kirchen mit Bild und Wikipedia-Kurztext | Wikidata, Wikimedia Commons, Wikipedia |
| Niederschlag | Radarbild der letzten Stunde und Vorhersage für die nächsten 50 Minuten als Kartenebene zum Abspielen; an jeder Haltestelle Beginn und Ende des Niederschlags im Vergleich zur nächsten Abfahrt | DWD-Radar (RV-Produkt) über Bright Sky |
| Luftaustausch | Einschätzung, ob eine Inversion über dem Talkessel den Luftaustausch behindert: Modellwerte (Temperatur in 2 m und 925 hPa, Grenzschichthöhe, Wind) für 48 Stunden und gemessenes Höhenprofil aus Bürgersensoren | Open-Meteo (Modelle des DWD), Sensor.Community |
| Luftbilder | Senkrechtluftbilder der Stadt 2006 bis 2025 als Kartenebene mit Jahreswahl und Deckkraft | WMS geoserver.stuttgart.de, Stadtmessungsamt |
| Meine Adresse | Adresse eingeben oder Standort freigeben: Stadtbezirk, Grundschulbezirk, Wahlbezirk und Wahllokal mit Barrierefreiheit, Wahlkreise, nächstes Bürgerbüro mit Wartezeit, Abfuhrtermine als Kalenderdatei, Starkregengefahr, Lärm an der Fassade, Notfall-Treffpunkt, rechtskräftige Bebauungspläne, Planauslage, Wahlergebnis im Stadtbezirk, Übergabe an die Gelbe Karte | Geoserver der Stadt (Wahlbezirke, Wahllokale, Grundschulbezirke, Starkregengefahrenkarte, Lärmkartierung 2022, Notfall-Treffpunkte, Bebauungspläne), AWS, Statistisches Amt |
| In der Nähe | Kitas, Schulen, Spielplätze, Toiletten, Trinkbrunnen, kühle Orte, Wertstoffhöfe, Notfall-Treffpunkte und weitere Einrichtungen nach Entfernung; Ladepunkte; Essen und Trinken mit „jetzt geöffnet“ und „stufenlos“ | Geoserver der Stadt (CC BY 4.0), OCPDB über MobiData BW, OpenStreetMap (Auszug 17.10.2026, ODbL) |
| Live-Zustände | Wartezeit der Bürgerbüros und Besucherzahl der Bäder als Kartenebene, mit „üblich um diese Zeit“, bester Zeit und Trefferquote aus eigener Aufzeichnung | Wartezeitanzeige der Stadt, Stuttgarter Bäder |
| Weg | Bus und Bahn von Tür zu Tür mit Echtzeit, Profile „stufenlos“ und „mit Kinderwagen“, Aufzugsstatus der DB-Stationen; Fahrrad mit Steigung, Pedelec, zu Fuß mit Höhenprofil, Auto mit freien Parkhäusern am Ziel; Übergabe an Google Maps, Apple Karten, OpenStreetMap | EFA-BW, BFRK (NVBW), DB SIRI-FM, Valhalla und OSRM (FOSSGIS), BRouter |
| Gesundheit | Pollenflug, UV-Index, amtliche Hitzewarnung und Hitzetrend, Biowetter, Höchsttemperatur, Zustand des Stromnetzes | DWD Opendata, TransnetBW StromGedacht |
| Sonne | Abendsonne-Finder: wann das Gelände an welchem Ort die Sonne verdeckt, als Schattenkarte zum Abspielen und als Liste der Aussichtspunkte | eigene Rechnung aus dem Höhenmodell (Mapzen Terrain Tiles), Wolken vom DWD |

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

### Über die Anwendung

- **Grundsätze:** kein Konto, keine Werbung, keine bezahlte Reihenfolge, kein Tracking; eigene Einschätzungen sind gekennzeichnet.
- **Wie entsteht dieser Wert?** Das Zeichen ⓘ an jeder Ansicht führt zu Quelle, Abrufintervall, Grenzen und Lizenz (`src/lib/erklaerungen.ts`).
- **Barrierefreiheit:** Erklärung nach BITV 2.0 (Selbstbewertung), Sprunglink, Tastaturbedienung, Listen als Alternative zur Karte, Kurztexte in Leichter Sprache.
- **Sprachen:** Bedienelemente, Überschriften und Grundsätze auf Englisch umschaltbar (`src/lib/i18n.ts`); Inhalte der Quellen bleiben in der Originalsprache.
- **Offenes Archiv:** Der Server zeichnet Besucherzahlen der Bäder und Wartezeit-Stufen der Bürgerbüros alle 5 Minuten auf (`server/.cache/archiv/JJJJ-MM-TT.csv`, herunterladbar unter `/api/archiv`). Abschalten mit `OS_VERLAUF=0`.
- **Berechnete Fahrzeugpositionen** kosten je Haltestelle 1 + höchstens 6 Anfragen bei EFA-BW alle 30 Sekunden und nur, solange jemand sie eingeschaltet hat. Abschalten mit `OS_VEHICLES=0`.
- **Echtzeitfeed gtfs.de** wird höchstens alle 3 Minuten geladen (rund 27 MB); Archiv `server/.cache/archiv/puenktlichkeit-JJJJ-MM-TT.csv`. Abschalten mit `OS_GTFSRT=0`. Neue gtfs.de-Statik erfordert `node scripts/gtfsde-stuttgart.mjs`.
- **Was geht:** jede Quelle einzeln abschaltbar mit `OS_SCENE_<KEY>=0`. Die Auswertung neu erfasster Orte aus OpenStreetMap ist noch nicht im Dauerbetrieb geprüft und nur mit `OS_OPENINGS=1` aktiv.
- **Daten der Stadt:** Für Mängelmelder, PVOG-Verwaltungsassistent, Sperrungen, SSB-Fahrzeuge, Verkehrszählung, Apotheken-Notdienst, Starkregen-Frühwarnung und weitere Wartezeiten sind Schnittstellen vorbereitet (`server/sources/partner.mjs`); sie werden über Umgebungsvariablen angebunden, sobald Zugang besteht.
- **Verwaltungsdatensatz:** Ämter und Leistungen können als Datei angedockt werden, siehe `docs/verwaltung-datensatz.md`.

Teilbare Links: Der Kartenausschnitt steht in der Adresse (`#karte=zoom/lat/lon`), eine gewählte Haltestelle als
`?stop=de:08111:6115`.

## Aufbau

```
server/            Node-Server ohne Abhängigkeiten
  index.mjs        API-Routen /api/* und Auslieferung von dist/
  cache.mjs        Zwischenspeicher mit Ablaufzeit, höflicher Abruf je Host, letzter guter Wert bei Ausfall
  sources/         eine Datei je Quelle (efa, parking, sharing, roadworks, environment, culture, events-extra, radar, kessel,
                   nearby, adresse, verlauf, routing, aufzuege, hitze, beteiligung, partner)
  .cache/          dauerhafter Zwischenspeicher (iCal-Details, Verortungen), nicht im Git
src/
  map/             Kartenstil (mapStyle.ts), Fachebenen (overlays.ts), Symbole (icons.ts), MapView.tsx
  modules/         Themenmodule: nearby, route, mobility, environment, culture, sun
  components/      Suche, Detailansichten, Bedienelemente
  lib/             Datenabruf, Formatierung, Typen, Geometrie, Sonnenstand, sunWorker.ts (Schattenrechnung im Web Worker)
public/data/       aufbereitete Fahrplandaten (network.geojson, stops.geojson)
scripts/           build_gtfs.py (Fahrplan aufbereiten), dev.mjs
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
angefragten Tag, einen Termin pro Sekunde, und hält sie 12 Stunden auf der Platte. Adressen werden über Nominatim
höchstens einmal pro Sekunde verortet und 90 Tage gespeichert. Wikidata wird einmal am Tag gefragt. Das Niederschlagsradar wird alle 5 Minuten geholt, Open-Meteo einmal pro Stunde,
Sensor.Community alle 10 Minuten. Luftbilder werden erst ab Zoomstufe 13 und nur bei eingeschalteter Ebene geladen.
OpenLigaDB wird zweimal am Tag gefragt. Die Stadtbibliothek wird je angefragtem Tag höchstens alle 12 Stunden gelesen
(höchstens 6 Listenseiten, 2 Sekunden Abstand). Für Stuttgart-Marketing gibt es keinen offenen Export; übergangsweise
liest der Server die Sitemap höchstens einmal am Tag und die Veranstaltungsseiten nacheinander im Hintergrund mit
5 Sekunden Abstand, jede Seite höchstens alle 7 Tage. Die in robots.txt gesperrten Pfade werden nicht verwendet. Bürgerbüro-Wartezeiten und Bäder werden einmal pro Minute
gelesen, Geoserver-Ebenen einmal am Tag, Angaben zu einer Adresse höchstens alle 30 Tage je Ort. Verbindungen: EFA je
gleicher Anfrage höchstens alle 60 Sekunden; Valhalla, OSRM und BRouter höchstens eine Anfrage pro Sekunde, gleiche Wege
24 Stunden gespeichert. Der Aufzugsabgleich der DB (NeTEx, etwa 19 MB) wird höchstens einmal pro Woche geladen. DWD-Dateien
zu Hitze und Biowetter alle 30 Minuten. Die Beteiligungsplattform der Stadt wird nicht automatisch abgefragt (robots.txt).
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
- Pollen, UV, Hitze, Biowetter, Höchsttemperatur: Deutscher Wetterdienst; Stromnetz: TransnetBW
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
- Die Zahl der Termine je Tag in der Tagesauswahl ist eine Obergrenze, weil der Abgleich nur für den gewählten Tag läuft.

## Lizenz

Der Code steht unter der European Union Public Licence 1.2 (EUPL-1.2), siehe `LICENSE`. Für die Daten gelten die
Lizenzen der jeweiligen Quellen (oben). Beiträge: siehe `CONTRIBUTING.md`.
