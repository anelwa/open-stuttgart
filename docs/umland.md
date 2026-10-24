# Umland: Ausflugsziele in der Region Stuttgart

Das Modul „Umland“ ergänzt die stadtbezogenen Daten um Ausflugsziele in den fünf
Landkreisen der Region Stuttgart: Böblingen, Esslingen, Göppingen, Ludwigsburg und
Rems-Murr-Kreis. Es ist bewusst kein vollständiger Tourismusführer und keine Rangliste,
sondern eine kuratierte Auswahl mit Quelle, Zeitbedarf, Anreisehinweis und Wetter.

## Datensatz

`server/data/umland-ziele.json` (redaktionell, Stand 24.10.2026) enthält 36 Ziele. Jedes
Ziel hat:

| Feld | Bedeutung |
|---|---|
| `id` | stabiler Schlüssel für Links und API |
| `name`, `gemeinde`, `kreis` | Ortsangabe; der Kreis bestimmt den Filter |
| `kategorie` | `schloss`, `kloster`, `museum`, `stadt`, `natur`, `see`, `wein`, `therme` |
| `lat`, `lon` | WGS84, mit Wikipedia und OpenStreetMap abgeglichen |
| `kurz`, `beschreibung` | redaktioneller Kurztext und Einordnung |
| `highlights` | zwei bis drei Stichpunkte |
| `dauerMin` | geschätzter Zeitbedarf |
| `preis`, `saison`, `familie` | Hinweise für die Planung, keine Live-Angaben |
| `website`, `wikipedia` | Anbieter- und Hintergrundlink |
| `image`, `imagePage` | Bild von Wikimedia Commons und Dateiseite mit Lizenz |
| `stand`, `quelle` | Redaktionsstand und Quellenhinweis |

Die Datei ist klein und wird mit dem Image ausgeliefert. Sie liegt nicht auf dem
Daten-Volume, sondern als Seed-Datei im Image; ein vorhandener Volume-Stand hat Vorrang.

## APIs

Alle Endpunkte liefern JSON, mit Quellen-, Lizenz- und Standangabe. Sie laufen über den
normalen Server (`server/index.mjs`), nicht direkt aus dem Browser.

### `GET /api/umland`

Überblick: Anzahl, Kategorien, Kreise, Bounding Box, Stand, Quelle und Lizenz.

### `GET /api/umland/ziele`

Liste mit Filtern:

| Parameter | Bedeutung |
|---|---|
| `kategorie` | eine Kategorie oder `alle` |
| `kreis` | `Böblingen`, `Esslingen`, `Göppingen`, `Ludwigsburg`, `Rems-Murr-Kreis` oder `alle` |
| `q` | Stichwort in Name, Kurztext, Gemeinde oder Kreis |
| `lat`, `lon` | optionale Mitte für „nächste zuerst“; ohne beide bleibt die Reihenfolge redaktionell |
| `r` | Radius in Metern bei `lat`/`lon` (Standard 120.000) |
| `familie` | `true` für familiengeeignete Ziele |
| `limit` | 1–100, Standard 60 |

Jedes Ziel enthält die nächsten Haltestellen aus dem VVS-Soll-Fahrplan (maximal 3 km
Luftlinie, mit Gehzeit) und optional `entfernungM`.

### `GET /api/umland/ziele/:id`

Steckbrief eines Ziels. Zusätzlich zu den Listenfeldern:

* `wiki`: Wikipedia-Kurztext und Artikel-URL (7 Tage zwischengespeichert),
* `wetter`: Punktvorhersage von Open-Meteo für die nächsten drei Tage (30 Minuten
  zwischengespeichert),
* `naechsteHaltestellen`: bis zu drei Haltestellen.

### `GET /api/umland/ziele.geojson`

Punkt-FeatureCollection für Karten und andere Anwendungen. Jede Feature enthält `id`,
`name`, `kategorie`, `farbe`, `kreis`, `gemeinde`, `kurz`, `image` und `familie`.

### `GET /api/umland/wetter?lat=&lon=&ort=`

Punktvorhersage für einen Ort in der Region (8,3–10,0° O, 48,25–49,3° N). Aktuelle
Temperatur, gefühlte Temperatur, Niederschlag, Wind und drei Tageswerte. Modell von
Open-Meteo, keine amtliche Warnung.

## Karte und Oberfläche

* Kartenebene `umland` mit einem Kategorie-Symbol je Ziel; Namen ab Zoomstufe 11.
* Modul `umland` im Panel: Kategorie-Chips, Landkreis-Auswahl, Suche, Familienfilter
  und „Gefilterte Ziele auf der Karte“.
* Detailansicht mit Bild, Steckbrief, Wetter, „Verbindung suchen“, nächsten
  Haltestellen und Wikipedia-Kurztext.
* Tiefenlink: `?o=umland&id=ebnisee`.
* Erklärung unter „Wie entstehen die Werte?“ (`umland`).

## Datenpflege

```bash
npm run check:umland          # Struktur, Filter, Haltestellen, GeoJSON (offline)
node scripts/check-umland.mjs --urls   # zusätzlich Bild-URLs prüfen
```

Neue Ziele werden in `server/data/umland-ziele.json` ergänzt. Wichtig:

1. `id` bleibt stabil, `kategorie` und `kreis` müssen zum Katalog passen.
2. Koordinaten mit Wikipedia/OpenStreetMap abgleichen; keine geratenen Punkte.
3. Nur belegbare Angaben zu Preis, Saison und Familie; bei Unsicherheit allgemein
   formulieren („Eintritt, Preise auf der Website“).
4. Website nur verlinken, wenn sie erreichbar ist; sonst Wikipedia als Quelle nutzen.
5. Bild von Wikimedia Commons mit Dateiseite und Lizenz; keine Bilder von
   Anbieterseiten einbetten.

Anschließend `npm run check:umland` und `npm run build` ausführen.

## Quellen und Lizenzen

* Kuratierte Auswahl und Texte: EUPL-1.2.
* Haltestellen: VVS-Soll-Fahrplan (GTFS), CC BY 4.0.
* Wetter: Open-Meteo, CC BY 4.0, Modelldaten.
* Wikipedia-Kurztexte: CC BY-SA 4.0.
* Bilder: Wikimedia Commons, Lizenz je Dateiseite.
* Karte: OpenStreetMap-Mitwirkende (ODbL), OpenFreeMap/OpenMapTiles.

## Grenzen

* Die Auswahl ist nicht vollständig; sie enthält keine Gastronomie- und
  Übernachtungsbetriebe und keine bezahlten Platzierungen.
* Öffnungszeiten, Preise und Zugänglichkeit werden nicht live geprüft. Maßgeblich sind
  die Angaben des Anbieters.
* Der Haltestellenbestand enthält außerhalb Stuttgarts nur Schienenhalte. Für Busse im
  Umland die Verbindungssuche im Modul „Weg“ verwenden; sie kennt das EFA-BW-Netz.
* Das Wetter ist eine Modellvorhersage für einen Punkt, keine amtliche Warnung und keine
  Geländekorrektur.
* Die Karte zeigt Punkte; sie ist keine Navigation. Der Weg führt über das Weg-Modul.
