# API- und Schnittstellen-Recherche: Was geht, junge Leute, Gastronomie, Alltag

Stand: 21.10.2026 · Für Open Stuttgart

Ziel: Quellen finden, die **zusätzlich** zu dem passen, was bereits in `server/sources/` steckt – mit Schwerpunkt
Veranstaltungen, junge Zielgruppe, Restaurants (vegan/vegetarisch), Lifestyle/Freizeit/Alltag. Bewertet wird nach
offener Lizenz, technischem Zugang, Abdeckung in Stuttgart und Aufwand.

## Kurzfassung

Die größten Lücken sind nicht „noch mehr Veranstaltungen“, sondern:

1. **Jugend- und Szene-Termine**, die nicht im städtischen Kalender stehen (Jugendagentur, Jugendhäuser, Clubs).
2. **Vegane/vegetarische Gastronomie** jenseits von OSM – ohne teure oder rechtlich problematische APIs.
3. **Alltag und Freizeit** (Kurse, Kino, Sommerangebote), die selten offene Schnittstellen haben.

Konkrete Empfehlung, in dieser Reihenfolge:

1. **Vegan-/Vegetarisch-Filter auf den vorhandenen OSM-Daten** – sofort möglich, keine neue Quelle.
2. **Jugendagentur Stuttgart testen** (`/wp-json/tribe/events/v1/events` und `?ical=1`) – potenziell viele junge Termine.
3. **Ticketmaster Discovery API** als optionale Quelle für große Häuser (Porsche Arena, Schleyer-Halle, Schräglage).
4. **Partnerschaften statt Scraping**: Stuttgart-Marketing (vegane Liste), Clubkollektiv (40 Clubs), stjg (41 Jugendhäuser), Stadtjugendring (58 Verbände) für das Gancio-Register.
5. **Foursquare Places** nur kuratiert und sparsam einsetzen (vegane/vegetarische Attribute, 500 freie Calls/Monat).

## 1. Was im Projekt schon vorhanden ist

| Bereich | Quelle | Wo im Code |
|---|---|---|
| Szene-Termine | Gancio, Theaterhaus, Im Wizemann, Bix, Wagenhallen, ticket.io, Love Your Artist, Hochschulen, stuvus | `server/sources/wasgeht/termine.mjs` |
| Stadtkalender | stuttgart.de RSS + iCal je Termin | `server/sources/culture.mjs` |
| Tourismus-Termine | Stuttgart-Marketing (schema.org) | `server/sources/events-extra.mjs` |
| Bibliothek | veranstaltungen-stadtbibliothek-stuttgart.de (schema.org) | `server/sources/events-extra.mjs` |
| Sport | OpenLigaDB (VfB) | `server/sources/events-extra.mjs` |
| Gastronomie | OpenStreetMap-Auszug, inkl. `diet:vegan`/`diet:vegetarian` | `server/sources/nearby.mjs`, `public/data/gastro.geojson` |
| Freizeit-POIs | Geoserver Stuttgart, OSM, OCPDB/MobiData BW | `server/sources/nearby.mjs` |

Wichtig: Die OSM-Gastronomie hat bereits **2.082** Food-POIs, davon **171** mit `diet:vegan=yes|only` und **370** mit
`diet:vegetarian=yes|only` (Auszug 17.10.2026). Es fehlt also weniger die Quelle als die **Auswertung in der Oberfläche**.

## 2. Was geht / junge Leute

| Quelle | Zugang / Endpunkt | Lizenz / Rechte | Abdeckung | Urteil |
|---|---|---|---|---|
| **Gancio** (eigenes Register) | `GET /api/events?start=&end=&tags=&places=&max=` | Fakten CC0 1.0 | Szene, Clubs, Kollektive, Jugendhäuser – wenn eingetragen | **Weiter ausbauen.** Technisch am besten; Engpass ist die Redaktion/Ansprache. |
| **Jugendagentur Stuttgart** | vermutlich WordPress + The Events Calendar: `/wp-json/tribe/events/v1/events?per_page=100`, alternativ `/events/?ical=1` | unklar; nur Fakten + Link übernehmen | junge Zielgruppe, Berufsorientierung, Infoveranstaltungen | **Testen.** Die Seite war von hier aus nicht erreichbar (Timeout); lokal prüfen. Wenn erreichbar: sehr günstige Quelle mit strukturierten Daten. |
| **Ticketmaster Discovery API** | `https://app.ticketmaster.com/discovery/v2/events.json?apikey=…&countryCode=DE&city=Stuttgart` | Ticketmaster Terms; nur Fakten + Deep-Link, keine Bilder | große Häuser: Porsche Arena, Hanns-Martin-Schleyer-Halle, Schräglage u. a. | **Optional ergänzen.** Kostenloser Key, 5.000 Calls/Tag, 5 req/s. Kein Club-/Szene-Ersatz. |
| **Reservix** | Developer-Portal `developer.reservix.de`, API-Key nötig | Partner-/Vertragsbedingungen | viele Theater, Veranstalter und Vorverkaufsstellen; Theaterhaus nutzt Reservix | **Anfragen**, wenn Theater/Comedy-Lücke bleibt. Kein offener Zugang. |
| **Jugendnetz Baden-Württemberg** | HTML-Datenbank `jugendnetz.de` | unklar | Jugendverbände, Einrichtungen, Projekte – **keine Termine** | **Einmaliger Seed** für Jugend-Orte/Verbände; kein API. |
| **stjg – Stuttgarter Jugendhaus gGmbH** | `jugendhaus.net`, Joomla | unklar | 41 Kinder-/Jugendhäuser, 22 Abenteuerspielplätze, Ferienprogramm | **Ansprechen** (Gancio / iCal). Kein API, aber die zentrale Infrastruktur für „junge Leute“. |
| **Stadtjugendring Stuttgart** | `sjr-stuttgart.de` | unklar | 58 Mitgliedsverbände, Newsletter | **Seed/Ansprache**; keine Termin-Schnittstelle. |
| **Clubkollektiv Stuttgart** | `clubkollektiv.de` | unklar | 40 Clubs/Veranstalter der Nachtökonomie | **Seed/Ansprache** für Gancio; keine API. |
| **Rausgegangen** | keine offizielle API; automatischer Abruf wird blockiert | ToS untersagen Weiterverwendung | sehr gute junge Zielgruppe, Clubs, Partys | **Nicht scrapen.** Nur Partnerschaft/Gespräch. |
| **Eventbrite** | öffentliche Event-Suche seit 12/2019 abgeschaltet | – | nur noch eigene Organisationen | **Nicht verwenden.** |
| **Meetup** | GraphQL/OAuth, App-Review | Meetup Terms | Tech/Expat-Nische | Höchstens optional; Aufwand hoch. |

**Einordnung:** Für „Was geht“ ist das eigene Gancio-Register der richtige Weg. Die kommerziellen Plattformen
(Rausgegangen, Resident Advisor, Eventim) sind technisch dicht oder rechtlich riskant. Ticketmaster/Reservix sind
nur für große Häuser sinnvoll und sollten als **Fakten + Link** behandelt werden, nicht als Datenbankersatz.

## 3. Gastronomie, vegan/vegetarisch

| Quelle | Zugang | Lizenz / Rechte | Abdeckung | Urteil |
|---|---|---|---|---|
| **OpenStreetMap** (`diet:vegan`, `diet:vegetarian`, `cuisine`, `opening_hours`) | Overpass API oder vorhandener Auszug; `https://overpass-api.de/api/interpreter` | ODbL (Namensnennung, Share-alike für abgeleitete DB) | 2.082 Food-POIs, 171 vegan, 370 vegetarisch in Stuttgart | **Primärquelle.** Keine Kosten, nachnutzbar, bereits im Projekt. |
| **Foursquare Places API** | `https://api.foursquare.com/v3/places/search`, API-Key | Foursquare Terms; Attribution „Powered by Foursquare“, Cache-/Weiterverwendungsgrenzen | globale POIs; **explizite Attribute/Tastes `vegan` und `vegetarian`** | **Beste kommerzielle Ergänzung.** 500 freie Pro-Calls/Monat, danach 15 USD/1.000; Premium-Felder teurer. Nur kuratiert einsetzen. |
| **Google Places API (New)** | `https://places.googleapis.com/v1/places:searchText`, API-Key | Google Maps Platform Terms; strenge Cache-/Anzeigeregeln | sehr gute Abdeckung; **nur `servesVegetarianFood`**, kein Vegan-Feld | **Nicht als Primärquelle.** Place Details Enterprise+Atmosphere: 25 USD/1.000, 1.000 frei/Monat. |
| **Stuttgart-Marketing: Vegane Restaurants** | `https://www.stuttgart-tourist.de/geniessen-in-stuttgart/vegane-restaurants-stuttgart` | keine offene Lizenz; Fakten + Link | 14 kuratierte vegane/vegetarische Adressen | **Guter Seed.** Kein schema.org/JSON auf der Seite; sauber scrapebar, aber besser Open-Data-Anfrage. |
| **HappyCow** | keine öffentliche API dokumentiert | ToS; Scraping nicht erlaubt | sehr große vegane/vegetarische Datenbank | **Nur manuell/Partnerschaft.** Nicht darauf bauen. |
| **veganfreundlich.org** | HTML-Liste | unklar | 42 Adressen in Stuttgart | **Manueller Seed**; keine API. |
| **Speisekarte.de** | HTML, Menüs mit vegan/vegetarisch-Tags | ToS; kein API | dish-level Kennzeichnung | **Nur Partnerschaft**; nicht scrapen. |
| **Yelp Places API** | Fusion API | kommerzielle Lizenz | Deutschland-Abdeckung schwach | **Nicht geeignet:** ab 229 USD/Monat, kein sinnvoller Free-Tier. |
| **Coolibri** | HTML + schema.org-Restaurantlisten | kommerziell | 1.382 Lokale in Stuttgart laut Eigenangabe | **Nicht offen.** Höchstens manueller Abgleich. |
| **Foursquare OS Places** | Hugging Face, Parquet, Apache 2.0 | Apache 2.0 | 100 M+ POIs, **keine Diet-Attribute** | **Gap-Filling in Bulk**, sehr schwer (263 GB); für den Alltag nicht nötig. |

**Datenmodell-Vorschlag für die Oberfläche:**

- `dietVegan`: `only` / `yes` / `null`
- `dietVegetarian`: `only` / `yes` / `null`
- `dietSource`: `osm` / `foursquare` / `stuttgart-marketing`
- `dietCheckedAt`: Datum aus `check_date` (OSM) bzw. Abrufdatum
- Anzeige: „100 % vegan“ (`only`) vs. „vegane Optionen“ (`yes`) – nicht vermischen.

**Wichtig:** OSM `diet:vegan=yes` heißt „vegane Optionen“, nicht „vollständig vegan“. `only` ist die belastbare
Aussage. Bei Foursquare/Google sind es ebenfalls Options-/Eigenschafts-Flags, keine Garantie.

## 4. Lifestyle, Freizeit, Alltag

| Quelle | Zugang | Lizenz / Rechte | Was drin ist | Urteil |
|---|---|---|---|---|
| **VHS Stuttgart** | `https://vhs-stuttgart.de/programm/kurssuche`; AJAX `?type=123321` liefert HTML, kein JSON | unklar; Kurse sind öffentlich | Kochkurse, Yoga, Sprachen, Kreativität, junge vhs | **Guter Inhalt, kein API.** Höflich scrapen oder Open-Data-Anfrage; nicht in Echtzeit nötig. |
| **Kinoheld** | GraphQL (undokumentiert); Open-Source-Client existiert | ToS prüfen | Kinoprogramm Stuttgart (Metropol, Gloria, Arthaus …) | **Spannend, aber undokumentiert.** Nur nach Rücksprache/ToS-Prüfung. |
| **LUBW Badegewässer** | `badegewaesserkarte.landbw.de` | Open Data / LUBW | Badeseen, Badestellen | **Link/statische Liste**; der alte WFS wurde 2023 entfernt, kein sauberes API. |
| **Open Data Stuttgart (CKAN)** | `https://opendata.stuttgart.de/api/3/action/package_search` | CC BY 4.0 | Museen, Privattheater, Orchester als CSV; Sportanlagen/Sportvereine nur als Statistik | **Venue-Enrichment**, keine Live-Termine. Keine Gastro-/Event-Datensätze. |
| **Stadtbibliothek** | bereits angebunden | – | Veranstaltungen | Schon vorhanden. |
| **Sport im Park** | Stadtseite/PDF | unklar | kostenlose Sportangebote im Sommer | **Saisonaler Seed**; kein API. |
| **Ferienprogramm Stuttgart** | `https://www.unser-ferienprogramm.de/stuttgart/programm.php` | unklar | Ferienangebote für Kinder/Teens | **Scrape/Anfrage**; gut für Familien, weniger für „junge Leute“. |
| **Bäder, Trinkbrunnen, Spielplätze, Chillorte** | bereits über Geoserver/OSM | CC BY 4.0 / ODbL | – | Schon vorhanden. |

## 5. Recht, Qualität und Fallstricke

- **Keine Bilder/Reviews** von kommerziellen APIs übernehmen, wenn die Lizenz es nicht erlaubt. Für Open Stuttgart
  reichen **Fakten + Deep-Link + Quelle**.
- **Cache-Grenzen beachten:** Google/Foursquare/Yelp erlauben kein dauerhaftes Vorhalten großer Datenbestände.
  OSM (ODbL) und Stadt-Daten (CC BY 4.0) sind die belastbare Basis.
- **Scraping vermeiden**, wo ToS es untersagen (Rausgegangen, Eventim, HappyCow, Yelp). Das ist auch praktisch
  fragil; die Projektgrundsätze (Quelle an jeder Angabe, keine Werbung) passen besser zu offenen Daten.
- **Namensnennung:** OSM „© OpenStreetMap-Mitwirkende (ODbL)“, Stadt „© Landeshauptstadt Stuttgart (CC BY 4.0)“,
  Foursquare „Powered by Foursquare“, Ticketmaster „Ticketmaster“.
- **Junge Zielgruppe ist kein Datum:** Der städtische Kalender und die meisten Quellen haben kein Alterfeld.
  „Jung“ bleibt eine Kategorie-Heuristik, solange keine Quelle echte Altersangaben liefert (Jugendagentur,
  Ferienprogramm, Hochschulen).

## 6. Konkrete nächste Schritte

1. **Vegan/Vegetarisch-Filter (Quick Win, kein neuer Abruf):**
   In `server/sources/nearby.mjs` die vorhandenen `diet:*`-Felder aus `gastro.geojson` als Filter
   `essen_vegan` / `essen_vegetarisch` anbieten; `only` und `yes` getrennt labeln.
2. **Jugendagentur testen:**
   `curl -sS 'https://www.jugendagentur.net/wp-json/tribe/events/v1/events?per_page=5'` und
   `curl -sS 'https://www.jugendagentur.net/events/?ical=1'`. Wenn erreichbar: Adapter in
   `server/sources/wasgeht/termine.mjs`, Schalter `OS_SCENE_JUGENDAGENTUR=0`.
3. **Ticketmaster optional:**
   Key über `OS_TICKETMASTER_KEY` anbinden, nur `countryCode=DE&city=Stuttgart`, max. 1 Abruf/Stunde,
   keine Bilder. Große Häuser als Ergänzung, nicht als Ersatz.
4. **Partnerschaften:**
   - Stuttgart-Marketing: Open-Data/API für die 14 vegane Adressen (die Seite läuft auf destination.one).
   - Clubkollektiv (40 Clubs), stjg (41 Jugendhäuser), Stadtjugendring (58 Verbände): Gancio-Zugänge und
     iCal-/JSON-Exporte anbieten.
5. **Foursquare evaluieren:**
   Nur für eine kuratierte Liste (z. B. 100–200 vegane/vegetarische Lokale), 500 freie Calls/Monat,
   Attribute `vegan`/`vegetarian`; Ergebnisse als „Quelle: Foursquare“ kennzeichnen.

## Quellen

- Open Data Stuttgart (CKAN): https://opendata.stuttgart.de/api/3/action/package_search
- OpenStreetMap Overpass: https://overpass-api.de/api/interpreter
- Foursquare Places API: https://docs.foursquare.com/fsq-developers-places/reference/places-api-overview
- Foursquare Venue Attributes (vegan/vegetarian): https://docs.foursquare.com/developer/reference/get-venue-attributes
- Foursquare OS Places: https://opensource.foursquare.com/os-places/
- Google Places API (New), Felder: https://developers.google.com/maps/documentation/places/web-service/data-fields
- Google Places Preise: https://developers.google.com/maps/billing-and-pricing/pricing
- Ticketmaster Discovery API: https://developer.ticketmaster.com/products-and-docs/apis/discovery/v2/
- Reservix Developer: https://developer.reservix.de/
- Gancio API: https://gancio.org/dev/api
- Jugendagentur Stuttgart: https://www.jugendagentur.net/
- Jugendnetz BW: https://www.jugendnetz.de/
- stjg: https://www.jugendhaus.net/
- Stadtjugendring Stuttgart: https://www.sjr-stuttgart.de/
- Clubkollektiv Stuttgart: https://www.clubkollektiv.de/
- Stuttgart-Marketing, vegane Restaurants: https://www.stuttgart-tourist.de/geniessen-in-stuttgart/vegane-restaurants-stuttgart
- VHS Stuttgart: https://vhs-stuttgart.de/programm/kurssuche
- Kinoheld (GraphQL-Client): https://github.com/janniksam/Kinoheld.Api.Client
- LUBW Badegewässer: https://badegewaesserkarte.landbw.de/
- Ferienprogramm Stuttgart: https://www.unser-ferienprogramm.de/stuttgart/
