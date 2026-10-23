# Neue Module und Quellen (Stand 21.10.2026)

Diese Datei dokumentiert die zuletzt ergänzten Quellen, Endpunkte, Lizenzen und Grenzen. Sie ergänzt
`docs/api-recherche-lifestyle.md`, `docs/quellen-lifestyle-freizeit-alltag.md` und
`docs/veranstaltungen-alle-quellen.md`.

## 1. Unfallatlas (Unfälle mit Personenschaden)

- **Quelle:** Statistische Ämter des Bundes und der Länder, Unfallatlas.
- **Bezug:** `https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/`
  (Jahres-ZIP, CSV in EPSG:25832 mit WGS84-Koordinaten).
- **Aufbereitung:** `npm run data:unfall` (bzw. `node scripts/build-unfaelle.mjs --jahr 2025`) filtert
  `ULAND=08`, `UREGBEZ=1`, `UKREIS=11` (Stadtkreis Stuttgart) und schreibt
  `server/data/unfaelle-stuttgart.json`.
- **Felder:** `kategorie` (1 getötet, 2 schwer, 3 leicht), `art`, `typ`, `licht`, `rad`, `fuss`, `pkw`,
  `krad`, `gkfz`, `sonstige`, `monat`, `stunde`, `wochentag`, `lat`, `lon`.
- **API:** `GET /api/unfaelle` (alle), `?lat=&lon=&r=` (Umkreis), `?bbox=minLon,minLat,maxLon,maxLat`,
  `?art=rad|fuss|pkw|…`, `?schwere=tote|schwer|leicht`; `GET /api/unfaelle/statistik`.
- **Frontend:** Kartenebene `unfall`, Abschnitt im Modul „Mobilität“, Unfallschwerpunkte in „Meine Adresse“
  (300 m) und im Modul „Weg“ (30-m-Korridor der Route).
- **Lizenz:** dl-de/by-2-0.
- **Grenzen:** nur Unfälle mit Personenschaden, keine Sachschäden; punktgenau, nicht adressscharf; die
  Unfallaufnahme kann sich nach dem Datenstand ändern; ein Korridor ist keine Sicherheitsbewertung.

## 2. Stadtgedächtnis

- **Ziel:** nicht „mehr Quellen scrapen“, sondern öffentliche Veränderungen mit Quelle und Datum sichtbar
  machen. Keine Personendaten, keine Volltexte.
- **Quellen:**
  - Meldungen: `server/sources/wasgeht/news.mjs` (Stadt, Feuerwehr, Polizei, Bundespolizei, SWR, Kessel.TV).
  - Amtliche Bekanntmachungen: `https://www.stuttgart.de/rathaus/amtliche-bekanntmachungen/` (HTML;
    Titel, Zeitraum, PDF-Link). Der RSS-Feed der Seite ist derzeit leer.
  - OpenStreetMap-Neuigkeiten: `server/sources/wasgeht/neueroeffnungen.mjs`, nur mit `OS_OPENINGS=1`.
  - Verwaltungsseiten: Vergleich des kompakten Datensatzes `server/data/verwaltung.json` mit dem
    Vergleichsstand in `server/.cache/stadtgedaechtnis-verwaltung.json`.
- **API:** `GET /api/stadtgedaechtnis?days=30&district=&topic=` und `GET /api/stadtgedaechtnis.rss`.
- **Frontend:** Abschnitt „Stadtgedächtnis“ im Modul „Was geht“ mit Themen- und Bezirksfilter.
- **Lizenzen:** Quellenangabe je Eintrag; amtliche Werke (§ 5 UrhG), Pressemitteilungen mit Quellenangabe,
  OpenStreetMap ODbL, Geodaten CC BY 4.0.
- **Grenzen:** Ein Eintrag ist ein Hinweis, keine amtliche Feststellung. Der Verwaltungsvergleich beginnt mit
  dem ersten Lauf; davor gibt es keine Vergleichsbasis. Meldungen können verzögert oder fehlerhaft sein.

## 3. Wanderwege, Weinwanderwege und Downhill

- **Quelle:** Geoserver Stuttgart, Workspace `GEOLINE_FLEX` (CC BY 4.0):
  - `A62_WANDERN_WEINWANDERWEG` (Weinwanderwege, Start/Ziel, Auf-/Abstieg, Länge),
  - `A62_POI_INNENSTADTRUNDWEG_LINIE` (Innenstadtrundweg),
  - `A62_RAD_DOWNHILL_LINIE_Strecke` (Woodpecker-Trail).
- **OSM-Routen:** `scripts/build-wanderwege.mjs` holt die Relationen Blaustrümpflerweg, Stuttgarter
  Rundwanderweg/Rößleweg, 4-Burgen-Weg, Georg-Fahrbach-Weg, HW 5 und die Stuttgarter Weinwanderwege über
  Overpass und schreibt `server/data/wanderwege-osm.json` (ODbL). Der Server führt sie mit den WFS-Wegen
  zusammen; Geometrien werden an der Stadtgrenze gekappt.
- **API:** `GET /api/wanderwege` (Routen mit Metadaten) und `GET /api/wanderwege.geojson`
  (Linien für die Karte).
- **Verknüpfung:** nächste Haltestellen aus `public/data/stops.geojson`, Trinkbrunnen und Toiletten aus
  `server/sources/nearby.mjs` im 150-Meter-Korridor.
- **Frontend:** Ebene `hike` und Abschnitt „Wanderwege und Rundwege“ im Modul „Weg“.
- **Grenzen:** ausgeschilderte Routen, keine Navigation mit Ansage; Höhen aus dem Datensatz, kein
  Geländemodell; Baustellen/Sperrungen/Witterung nicht enthalten.

## 4. Vereine und Engagement

- **Quelle:** Geoserver Stuttgart, Einrichtungsverzeichnis/Infopool (CC BY 4.0).
- **Kategorien:** `verein_sport` (Sporthallen, Sportplätze, Eis- und Reitsport), `verein_kultur`
  (Stadtteilkultur, Musikschule), `verein_stadtteil` (sonstige Vereinigungen, Bürgerhäuser,
  Kinder-/Jugendtreffs, Jugendgästehaus, Jugendberatung, Jugendgesundheit), `verein_natur` (Waldheim).
- **Grundsatz:** nur öffentliche Einrichtungen mit eigener Adresse; keine Wohnadressen von Vorständen.
  Das ist kein vollständiges Vereinsregister.
- **Frontend:** Gruppe „Vereine und Engagement“ in „Nähe“.

## 5. Kollektive

- **Datenmodell:** `server/data/kollektive.json` (id, name, aliases, szene, genre, url, festerOrtVenueId).
- **Erkennung:** Gancio-Schlagwort `kollektiv:<slug>` (CC0 1.0) und Formulierungen wie „präsentiert von …“,
  „hosted by …“ oder „A × B“ in Titel/Untertitel. Kuratierte Treffer haben Vorrang.
- **API:** die Kollektive erscheinen in `/api/wasgeht` als `collectives` und `collective` je Termin.
- **Frontend:** Abzeichen am Termin, Filter „Kollektive & freie Szene“, Klick auf das Kollektiv filtert alle
  Termine dieses Kollektivs.
- **Grenzen:** heuristische Zuordnung, keine Bestätigung des Veranstalters; keine Personendaten.

## 6. Geocaching

- **Quelle:** Opencaching.de (CC BY-NC-ND 3.0 DE). Kein Geocaching.com-Scraping.
- **API:** `GET /api/geocaches?lat=&lon=&r=`.
- **Anzeige:** nur Startkoordinaten, Cache-Art, Größe, D/T-Wertung und Link zum Listing. Keine
  Final-Koordinaten, keine Beschreibungstexte, keine Spoiler.
- **Cache:** höchstens alle 12 Stunden.
- **Status:** Die offene Quelle antwortete bei der Einrichtung mit HTTP 503. Ein lokaler Bestand
  (`server/data/geocaches.json`) und ein optionaler JSON-Export (`OS_OPENCACHING_JSON`) sind vorbereitet.
- **Frontend:** Abschnitt „Geocaching in der Nähe“ in „Nähe“; bei Ausfall mit Link zur Suche.

## 7. Vegan/vegetarisch

- **Quelle:** OpenStreetMap, `diet:vegan` und `diet:vegetarian` (`yes`, `only`).
- **API:** `GET /api/nearby/facilities?cat=essen_restaurant&diet=vegan|vegan-only|vegetarian|vegetarian-only`.
- **Frontend:** Chips „Vegan“, „Vegetarisch“ und „Nur komplett …“ in „Essen und Trinken“.
- **Grenzen:** OSM-Angaben können veraltet sein; maßgeblich ist die Karte des Betriebs. Keine Bewertung,
  keine bezahlte Reihenfolge.

## 8. Himmel: Wetterballons, ISS, Mond

- **SondeHub:** `https://api.v2.sondehub.org/sondes/telemetry?duration=3h&lat=48.78&lon=9.18&distance=300`
  (offene Community-Empfänge; Typ, Höhe, Temperatur, Position).
- **ISS:** `https://api.wheretheiss.at/v1/satellites/25544` (Open Data; Position, Höhe, Sichtbarkeit).
- **Mond:** lokal berechnete synodische Phase, keine externe Quelle.
- **Frontend:** Abschnitt „Himmel über Stuttgart“ im Modul „Umwelt“. Keine Ableitung von Einsatzarten,
  keine Bewertung von Rettungs- oder Polizeiflügen.

## 9. Bereits vorhandene, hier nur geprüfte Quellen

Diese waren im Projekt schon angebunden und wurden nicht neu aufgebaut:

- P+R, Bike+Ride, Schließfächer und Eco-Counter über MobiData BW (`parking.mjs`).
- Solarkataster, Gründachkataster, Wärmeplanung, Geothermie, Abwasserwärme, Mietspiegel, Satzungen,
  Klimaatlas und Baumkataster in `adresse.mjs`.
- BBK NINA / MoWaS in `environment.mjs`.
- Grünstrom über Fraunhofer ISE in `nearby.mjs`.
- iNaturalist und OpenMensa als eigene Abschnitte.
- Kaltluft, Mineralbrunnen, Chillorte und Gute Fee in `nearby.mjs`.

## 10. Bar-Touren

- **Datenmodell:** `server/data/bartouren.json` mit sieben kuratierten Touren, 37 Stationen, Koordinaten,
  Öffnungszeiten, Barrierefreiheit, alkoholfreien Optionen, Varianten und Quellen. Grundlage ist der
  OSM-Auszug `public/data/gastro.geojson` (ODbL, 20.10.2026) sowie die Websites der Betriebe.
- **Server:** `server/sources/bartouren.mjs` ergänzt die nächsten Haltestellen und liefert Liste, Detail,
  GeoJSON und GPX. API: `GET /api/bartouren`, `GET /api/bartouren/:id`,
  `GET /api/bartouren.geojson`, `GET /api/bartouren/:id.gpx`.
- **Frontend:** Modul „Bar-Touren“ (`src/modules/bartouren/BartourenPanel.tsx`) mit Filterchips,
  Tourkarten, Stationen, Karten-Layer, Detailansicht je Stopp und Übergabe an das Weg-Modul.
  Schnellaktion „Ausgehen“ und Eintrag unter „Alle Themen“.
- **Karte:** Ebene `bartouren` mit gestricheltem Verlauf und nummerierten Stationen; die Linie
  verbindet die Stationen und ist keine Navigation.
- **Grenzen:** Öffnungszeiten, Einlass und Barrierefreiheit sind Momentaufnahmen. Bei Widersprüchen
  (Beispiel Kabi: OSM Mo–Fr, Website Di–Sa) wird der Widerspruch angezeigt, nicht geglättet.
  Die Touren sind redaktionelle Vorschläge, keine bezahlte Platzierung und keine Rangliste.

## 11. Betriebsgrenzen und bewusste Auslassungen

- Keine Social-Media-Scrapes (Instagram, TikTok, Facebook, Telegram).
- Keine kostenpflichtigen Bulk-Datenbanken (Google Places, Foursquare, Yelp, HappyCow).
- Kein ALLRIS-Crawl (`robots.txt: Disallow: /`); nur mit schriftlicher Freigabe.
- Keine Polizei-/Rettungs-Spekulation aus Flugdaten.
- Keine Webcams mit Personenerkennung, keine Bewegungsprofile.
- Presse nur mit Titel, Datum, Anreißer und Link; keine Volltexte.
