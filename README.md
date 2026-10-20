# Open Stuttgart

Offene Daten der Stadt Stuttgart und der Region auf einer Karte: Echtzeit-Abfahrten, Parkhäuser mit freien Plätzen,
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
| Abfahrten | Haltestelle antippen oder suchen: nächste Abfahrten mit Verspätung, Gleis/Steig, Ausfällen, Filter nach Verkehrsmittel | EFA-BW (NVBW) |
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

Teilbare Links: Der Kartenausschnitt steht in der Adresse (`#karte=zoom/lat/lon`), eine gewählte Haltestelle als
`?stop=de:08111:6115`.

## Aufbau

```
server/            Node-Server ohne Abhängigkeiten
  index.mjs        API-Routen /api/* und Auslieferung von dist/
  cache.mjs        Zwischenspeicher mit Ablaufzeit, höflicher Abruf je Host, letzter guter Wert bei Ausfall
  sources/         eine Datei je Quelle (efa, parking, sharing, roadworks, environment, culture, events-extra, radar, kessel)
  .cache/          dauerhafter Zwischenspeicher (iCal-Details, Verortungen), nicht im Git
src/
  map/             Kartenstil (mapStyle.ts), Fachebenen (overlays.ts), Symbole (icons.ts), MapView.tsx
  modules/         Themenmodule: mobility, environment, culture, sun
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
5 Sekunden Abstand, jede Seite höchstens alle 7 Tage. Die in robots.txt gesperrten Pfade werden nicht verwendet.
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
