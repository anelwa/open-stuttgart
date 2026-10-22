# Versteckte Schnittstellen, zweite Runde (22.10.2026)

Diese Recherche ergänzt [`api-recherche-2026-10-tiefensuche.md`](api-recherche-2026-10-tiefensuche.md)
und [`schnittstellen-im-weiten-sinn.md`](schnittstellen-im-weiten-sinn.md). Gesucht wurden
**öffentlich erreichbare, aber nirgends dokumentierte** Datenendpunkte, die im Projekt noch
nicht angebunden sind. Der Blick ging bewusst in CMS-/WordPress-Installationen, JS-Bundles,
`fileadmin/jsonData`-Verzeichnisse und AJAX-Router – nicht in die offiziellen Open-Data-Listen.

**Stand:** 22.10.2026. Alle Endpunkte wurden live mit `curl` geprüft (Status, Content-Type,
Beispielantwort). Technisch erreichbar ist nicht automatisch frei nutzbar; die Lizenz- und
Nutzungshinweise stehen bei jedem Fund.

## 0. Kurzfazit

| # | Fund | Was | Aufwand | Status im Projekt |
|---|------|-----|---------|-------------------|
| 1 | **StadtPalais WordPress-REST + AJAX** | 2.833 Termine, 112 Ausstellungen, 6 Orte; serverseitiger Datumsfilter | gering | **teilweise integriert**: REST-Termine bereits in `events-extra.mjs`; AJAX-Kalender und Ausstellungen neu über `/api/stadt/stadtpalais` |
| 2 | **Bäderverzeichnis `baeder.json`** | 17 Bäder mit Adresse, Öffnungszeiten, Merkmalen, Telefon, Website | sehr gering | **integriert** (`/api/nearby/baeder`) |
| 3 | **OpenData@Stuttgart CKAN** | 140 lokale Datensätze mit Download-Links, CC BY 4.0 | gering | **integriert** (`/api/stadt/ckan`) |
| 4 | **HVZ BW Pegel-Detailseiten** | Neckar-/Landespegel, Vorhersage, 5-Minuten-Aktualisierung | mittel (HTML) | dokumentiert, nicht integriert |
| 5 | **Stadtklima-PDF-Archiv** | Feinstaub-Jahresreihen 2016–2026 als PDF | gering | dokumentiert, nicht integriert |
| 6 | **Linden-Museum WordPress-REST** | Posts/Pages, kein eigener Event-Typ | gering | dokumentiert, nicht integriert |
| 7 | **Weissenhofmuseum WordPress-REST** | Pages/Posts, kein Event-Typ | gering | dokumentiert, nicht integriert |
| 8 | **Staatstheater `/api`** | Web-API vorhanden, aber kein öffentlicher Spielplan-Endpunkt gefunden | – | nicht nutzbar |
| 9 | **VHS `tx_eckuferconnect_courselist`** | Kursliste nur als HTML (1,8 MB), kein JSON | – | nicht nutzbar |
| 10 | **Messe Stuttgart** | nur Newsletter-API, kein Event-Endpunkt | – | nicht nutzbar |
| 11 | **Stadtbibliothek aDISWeb** | kein SRU-/REST-Endpunkt gefunden | – | nicht nutzbar |

Die drei integrierten Quellen sind bewusst so gebaut, dass sie auch bei einem Umbau der
Websites **nicht den ganzen Server blockieren**: eigener Cache, optionaler Fallback, nur
Fakten und Links, keine Text- oder Bildübernahme.

---

## 1. StadtPalais: WordPress-REST und der versteckte AJAX-Kalender

Das StadtPalais (Museum für Stuttgart) betreibt eine WordPress-Installation mit eigenen
Custom Post Types. Die REST-Schnittstelle ist öffentlich, wird aber nirgends verlinkt.
**Wichtig für die Einordnung:** Die REST-Termine (`/wp-json/wp/v2/veranstaltungen`) werden
im Projekt bereits über `server/sources/events-extra.mjs` in „Was geht“ eingebunden. Neu
sind hier der **AJAX-Kalender mit serverseitigem Datumsfilter** und der **Ausstellungs-CPT**
(`/wp-json/wp/v2/ausstellungen`), die bisher nicht genutzt wurden.

### 1.1 REST-Basis

```bash
curl -s "https://www.stadtpalais-stuttgart.de/wp-json" | jq '.name, .namespaces'
# "StadtPalais – Museum für Stuttgart"
# ["oembed/1.0", "contact-form-7/v1", ..., "wp/v2", ...]
```

Relevante Routen:

| Route | Inhalt | Anzahl |
|-------|--------|--------|
| `/wp-json/wp/v2/veranstaltungen` | Termine (Custom Post Type) | 2.833 |
| `/wp-json/wp/v2/ausstellungen` | Ausstellungen (Custom Post Type) | 112 |
| `/wp-json/wp/v2/event-locations` | Ortsbegriffe | 6 |
| `/wp-json/wp/v2/event-categories` | Kategorien | mehrere |
| `/wp-json/wp/v2/exhibition-categories` | Ausstellungskategorien | mehrere |

Beispiel:

```bash
curl -s "https://www.stadtpalais-stuttgart.de/wp-json/wp/v2/veranstaltungen?per_page=1&_fields=id,title,link,acf,event-locations" \
  | jq '.[0]'
```

Wichtige ACF-Felder:

```json
{
  "date": "20261222",
  "time-from": "19:30",
  "time-to": "21:00",
  "disruptor": { "active": false, "text": "Abgesagt!" },
  "event-categories": [144, 25],
  "location": 26,
  "kids": false,
  "excerpt": "…",
  "booking-link": "",
  "export-status": "",
  "export-id": ""
}
```

`date` ist `YYYYMMDD`, `location` ist die ID aus `event-locations`, die Kategorien sind IDs
aus `event-categories`. Die REST-Abfrage lässt sich **nicht** nach dem ACF-Datum filtern:
`meta_key=date&meta_value=…&meta_compare=>=` wird ignoriert (X-WP-Total bleibt 2.833). Deshalb
ist der AJAX-Endpunkt der bessere Weg.

### 1.2 AJAX-Kalender mit Datumsfilter

Die Veranstaltungsseite lädt ihre Karten über:

```text
POST https://www.stadtpalais-stuttgart.de/wp-admin/admin-ajax.php
action=events
time_span=datepicker
date_from=20261022
date_to=20261112
target_groups=
categories=
locations=
```

Beispiel:

```bash
curl -s -X POST "https://www.stadtpalais-stuttgart.de/wp-admin/admin-ajax.php" \
  --data "action=events&time_span=datepicker&date_from=20261022&date_to=20261112" \
  -o events.html
```

Antwort: HTML-Karten (20 pro Seite) plus ein eingebettetes `ajax_loadmore_params.posts`-JSON.
Darin steht die tatsächliche `meta_query`:

```json
{
  "post_type": "veranstaltungen",
  "posts_per_page": 20,
  "orderby": { "date_clause": "ASC", "time_clause": "ASC" },
  "meta_query": {
    "relation": "AND",
    "0": { "key": "date", "value": "20261112", "type": "DATE", "compare": "<=" },
    "date_clause": { "key": "date", "value": "20261022", "type": "DATE", "compare": ">=" }
  }
}
```

Jede Karte enthält Titel, Tag/Monat, Uhrzeit, Ort, Kategorien und den Link. Das reicht für
eine Terminliste; Beschreibungen und Bilder werden nicht übernommen.

**Grenzen:** Die Antwort ist HTML, kein JSON. Es gibt 20 Karten pro Seite; „Mehr laden“ nutzt
`action=loadmore` mit dem Query-JSON und einer Seitenzahl. Der Loadmore-Aufruf mit dem
46-KB-Query-JSON wurde mit HTTP 403 beantwortet (WAF/Wordfence wurde nicht weiter
untersucht). Für die App reicht die erste Seite mit den nächsten 21 Tagen; sie wird alle
6 Stunden erneuert.

**Lizenz:** Die Inhalte sind urheberrechtlich geschützt. Übernommen werden nur Fakten
(Titel, Datum, Ort, Kategorie, Link) mit Quellenangabe. Keine Beschreibungen, keine Bilder.

**Im Projekt:** `server/sources/stadtpalais.mjs`, Route `GET /api/stadt/stadtpalais`,
Abschnitte „StadtPalais: Termine“ und „StadtPalais: Ausstellungen“ im Modul
„Schnittstellen → Fundstücke“. Die Route nutzt für Termine den AJAX-Endpunkt (nicht den
REST-Endpunkt aus `events-extra.mjs`), damit die 21-Tage-Auswahl serverseitig gefiltert
wird; Ausstellungen kommen aus dem REST-CPT. Cache-Schlüssel bewusst getrennt
(`stadtpalais-schnittstellen`), damit der bestehende Kultur-Cache nicht überschrieben wird.

---

## 2. Stuttgarter Bäder: das vollständige Verzeichnis als JSON

Die Bäder-Website liefert nicht nur die Besucherzahlen, sondern ein komplettes
Bäderverzeichnis – 121 KB, 17 Bäder, ohne Login:

```bash
curl -s "https://www.stuttgarterbaeder.de/fileadmin/jsonData/baeder.json" | jq 'length'
# 17
```

Beispielobjekt (gekürzt):

```json
{
  "id": 1,
  "name": "SoleBad Cannstatt",
  "subtitle": null,
  "lookups": {
    "type": { "value": "Therme" },
    "characteristic": [
      { "value": "Barrierefrei" },
      { "value": "Außenbecken" },
      { "value": "Sauna" },
      { "value": "Gastronomie" },
      { "value": "Liegewiese" }
    ],
    "targetgroup": [{ "value": "Für Senioren" }, { "value": "Für Saunabegeisterte" }]
  },
  "building": {
    "street": "Sulzerrainstraße 2",
    "zip_code": "70372",
    "city": "Stuttgart",
    "district": "Bad Cannstatt"
  },
  "communications": [
    { "type": "t", "address": "+49 711 216-66270" },
    { "type": "i", "address": "https://www.stuttgarterbaeder.de/solebadcannstatt" }
  ],
  "businesshours": {
    "usually_bhpool": [
      {
        "type": "bhpool",
        "mo": { "from": "09:00", "to": "21:30" },
        "di": { "from": "09:00", "to": "21:30" }
      }
    ],
    "usually_bhsauna": [ … ]
  }
}
```

Die Live-Besucherzahlen stehen weiterhin in
`/fileadmin/jsonData/visitor_count.json` (nur geöffnete Bäder, derzeit 5 von 17).
Das Verzeichnis ergänzt Adresse, Stadtbezirk, Typ, Merkmale, Zielgruppen, Telefon, Website
und die heutigen Öffnungszeiten.

**Grenzen:** Feiertage und Sonderzeiten sind nicht enthalten; die Website bleibt maßgeblich.
Die Zuordnung zum Live-Besuch erfolgt über den normalisierten Namen.

**Lizenz:** Fakten mit Quellenangabe; keine Übernahme von Texten oder Bildern.

**Im Projekt:** `server/sources/nearby.mjs`, `baeder()`; die bestehende Route
`GET /api/nearby/baeder` liefert jetzt zusätzlich `type`, `features`, `phone`, `website`,
`hoursToday`, `openNow` und `totalPools`.

---

## 3. OpenData@Stuttgart: der lokale CKAN-Katalog

Das städtische Open-Data-Portal ist ein eigenes CKAN. Die API ist offen und liefert
**140 Datensätze** – deutlich mehr als die GovData-Treffer zu Stuttgart:

```bash
curl -s "https://opendata.stuttgart.de/api/3/action/package_search?rows=2&facet=off" \
  | jq '.result.count, .result.results[0].title'
# 140
# "Bundestagswahl 2025 Wahlbezirke"
```

Beispiele für Datensätze, die im Projekt noch nicht als eigene Ansicht stehen:

* `bundestagswahl-2025-wahlbezirke` (GeoPackage)
* `historischer-stadtplan-stuttgart-1914` / `2008` / `2021` (GeoTIFF/ZIP)
* `wahlbezirke`, `ergebnisse-bundestagswahlen`, `ergebnisse-landtagswahlen`
* `schwimmbaeder`, `museen`, `orchester`, `private-theater`, `kinos-und-filmbesucher`
* `luftqualitaet-und-laermbelastung`, `immissionen`, `emissionen`, `laermkartierung`
* `strassennetz-in-stuttgart`, `raddaten`, `ergebnisse-der-verkehrszaehlungen`
* `haushaltsausgaben`, `treibhausgasausstoss`, `energie-und-wasserverbrauch`

Die Ressourcen verlinken teils direkt auf CSV/XLSX/GPKG, teils auf den Geoserver
(`geoserver.stuttgart.de/gdc/...`) oder auf KOMUNIS. Damit ist der CKAN-Katalog der
beste Einstiegspunkt für neue Datensätze – besser als GovData, weil die Metadaten und
Download-Links lokaler und vollständiger sind.

**Lizenz:** Metadaten und viele Datensätze CC BY 4.0; Lizenz je Datensatz prüfen.

**Im Projekt:** `server/sources/schnittstellen.mjs`, `stadtKatalog()`, Route
`GET /api/stadt/ckan`; im Modul „Schnittstellen → Karte“ als Abschnitt
„Open Data der Stadt“ mit Suche und Direktlinks.

---

## 4. HVZ Baden-Württemberg: Pegel-Detailseiten

Die Hochwasservorhersagezentrale liefert pro Pegel eine HTML-Detailseite mit aktuellem
Wasserstand, Kennwerten und Vorhersage:

```bash
curl -s "https://www.hvz.baden-wuerttemberg.de/pegel.html?id=1" | head
# <title>HVZ Pegel-Info</title>
# <meta http-equiv="refresh" content="300">
```

Die Stationen stehen in `map_peg.html` als `SiteStations`-Array; die Detailseite lädt
`pegel.html?id=<stationsId>`. Der frühere CGI-Endpunkt `cgi/peg_info.pl?id=…` antwortet
mit **HTTP 403** und ist nicht nutzbar.

**Nutzen:** Ergänzung zu Pegelonline (WSV) um Neckar-/Landespegel und Vorhersagen.
**Grenzen:** HTML, kein JSON; 20 KB pro Station; 5-Minuten-Refresh. Für die App nur mit
einem schmalen Parser und Cache sinnvoll, nicht als Massenabruf.
**Im Projekt:** bewusst nicht integriert, weil Pegelonline bereits den Cannstatter Neckar
abdeckt und die HVZ-Seite keine offene Lizenz ausweist.

---

## 5. Stadtklima Stuttgart: PDF-Archiv der Feinstaubjahre

Die alte Stadtklima-Seite hat kein JSON, aber ein sauber benanntes PDF-Archiv:

```bash
curl -I "http://www.stadtklima-stuttgart.de/stadtklima_filestorage/download/luft/Feinstaubwerte-2026_AN.pdf"
# HTTP/1.1 200 OK, application/pdf, 97.522 Bytes
```

Muster: `Feinstaubwerte-<Jahr>_AN.pdf` und `Feinstaubwerte-<Jahr>_AN_k.pdf`
(2016–2026). Dazu gibt es die Tabellen `index.php?luft_messdaten_feinstaubwerte` und
`…_hs-str`, `…_stationeninstuttgart`.

**Nutzen:** Historische PM10-Reihen für „Am Neckartor“ und andere Stationen.
**Grenzen:** PDF, kein maschinenlesbarer Endpunkt; die aktuellen Werte kommen besser
über UBA/LUBW. Im Projekt nicht integriert.

---

## 6. Weitere WordPress-REST-Installationen

### 6.1 Linden-Museum Stuttgart

```bash
curl -s "https://lindenmuseum.de/wp-json" | jq '.name, (.routes | keys | length)'
# "Linden-Museum Stuttgart", 455
```

Es gibt `wp/v2/posts` und `wp/v2/pages`, aber **keinen eigenen Event-/Ausstellungs-Typ**.
Für Termine daher nur eingeschränkt nutzbar; die normale Website ist die bessere Quelle.

### 6.2 Weissenhofmuseum im Haus Le Corbusier

```bash
curl -s "https://weissenhofmuseum.de/wp-json" | jq '.name, (.routes | keys | length)'
# "Weissenhofmuseum im Haus Le Corbusier", 190
```

Nur `posts`/`pages`, keine Termine. Als Faktenquelle für die Dauerausstellung denkbar,
aber kein Termin-Feed.

### 6.3 Stadtmuseum Stuttgart

`https://www.stadtmuseum-stuttgart.de/wp-json` liefert dieselbe Installation wie das
StadtPalais (Zertifikat abgelaufen, `-k` nötig). Die Inhalte sind identisch; die
StadtPalais-Domain ist die saubere Wahl.

---

## 7. Was geprüft und verworfen wurde

| Quelle | Befund |
|--------|--------|
| **Staatstheater Stuttgart** | `/api` antwortet mit ASP.NET-Runtime-Fehler (500), `/api/help` mit JSON-404. Der Spielplan ist serverseitig gerendert (517 KB HTML), ein öffentlicher Spielplan-Endpunkt wurde nicht gefunden. |
| **VHS Stuttgart** | Kursliste über `tx_eckuferconnect_courselist[action]=showList`; 1,8 MB HTML, `type=json`/`format=json` ändern nichts. Kein JSON-Endpunkt. |
| **Messe Stuttgart** | Nur `POST /api/v2/newsletter` im JS; `/api/v1/public/events`, `/api/v2/public/events`, `/veranstaltungen` liefern 404. Kein Event-API. |
| **Stuttgart Tourist** | Kein offener Event-Endpunkt gefunden; die Detailseiten sind serverseitig, die bestehende Lösung nutzt schema.org in den Detailseiten. |
| **Stadtbibliothek Stuttgart** | aDISWeb/Mosaik; `/aDISWeb/sru`, `/aDISWeb/rest`, `/aDISWeb/api` liefern 404. Kein SRU/REST gefunden. |
| **StadtPalais RSS** | `/veranstaltungen/feed/` liefert nur die 10 zuletzt angelegten Einträge (nach Post-Datum), nicht die nächsten Termine. Für „demnächst“ ungeeignet. |
| **BORIS BW** | Kein API-/WFS-Endpunkt an der Oberfläche gefunden; nur TYPO3-Webapp. |
| **Denkmalpflege BW** | Denkmalliste/Denkmalatlas nicht als offener Endpunkt bestätigt. |
| **Stadtwerke Stuttgart** | Website antwortet mit 403 (Bot-Schutz); keine offene Ladesäulen-API gefunden. OCPDB/MobiData bleibt die Quelle. |

---

## 8. Einbau im Projekt

| Datei | Änderung |
|-------|----------|
| `server/sources/stadtpalais.mjs` | Neue Quelle: AJAX-Termine + REST-Ausstellungen, 6 h Cache, nur Fakten; die REST-Termine selbst waren bereits in `events-extra.mjs` |
| `server/sources/nearby.mjs` | `baeder()` liest zusätzlich `baeder.json` (24 h Cache) |
| `server/sources/schnittstellen.mjs` | `stadtKatalog()` für OpenData@Stuttgart (12 h Cache) |
| `server/index.mjs` | `GET /api/stadt/stadtpalais`, `GET /api/stadt/ckan` |
| `server/cache.mjs` | Höfliche Mindestabstände für die drei neuen Hosts |
| `src/modules/nearby/NearbyPanel.tsx` | Bäderkarte zeigt Typ, Merkmale, Öffnungszeit, Telefon, Website |
| `src/modules/schnittstellen/SchnittstellenPanel.tsx` | CKAN-Katalog, StadtPalais-Termine/-Ausstellungen, neue JSON-Feeds |

**Cache-/Lastregeln:** StadtPalais 6 h, Bäderverzeichnis 24 h, CKAN 12 h, Besucherzahlen
weiterhin 60 s. Die neuen Quellen laufen über `cache.mjs` mit Last-Good-Fallback; ein
Ausfall einer Quelle leert nicht die anderen Bereiche.

---

## 9. Nächste Kandidaten

1. **StadtPalais-Ausstellungen auf die Karte**: Die ACF-Felder enthalten keine Koordinaten,
   aber der Ort ist als Taxonomie vorhanden. Für „StadtPalais“ und „Städtisches Lapidarium“
   ließen sich feste Koordinaten hinterlegen.
2. **OpenData@Stuttgart auswerten**: Die 140 Datensätze sind ein guter Anlass für
   „Kiez in Zahlen“ direkt aus CSV/GPKG, unabhängig von KOMUNIS.
3. **HVZ-Pegel** nur mit schmalem Parser und klarer Quellenangabe, falls die Neckar-
   Vorhersage für das Modul „Umwelt“ wichtiger wird.
4. **Weitere WordPress-Museen** prüfen: Das Muster `wp-json/wp/v2/<custom-post-type>` ist
   bei StadtPalais sehr ergiebig; andere Häuser haben teils nur `posts`/`pages`.
