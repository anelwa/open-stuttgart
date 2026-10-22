# Tiefensuche Oktober 2026: versteckte Stuttgarter Schnittstellen

Ziel dieser Recherche: öffentliche und **halböffentliche** Datenquellen der Landeshauptstadt
Stuttgart finden, die nicht im offiziellen Open-Data-Katalog stehen und sich trotzdem für
Open Stuttgart eignen. Der Schwerpunkt lag bewusst auf Diensten, die die Stadt selbst
betreibt und die erst beim Blick in Kartenanwendungen, Konfigurationsdateien oder
Fachanwendungen sichtbar werden.

Ergänzung zu [`api-recherche-2026-10-ergaenzungen.md`](api-recherche-2026-10-ergaenzungen.md)
(bundesweite/weltweite APIs) und [`schnittstellen-im-weiten-sinn.md`](schnittstellen-im-weiten-sinn.md)
(offene Standards, physische und Ausgabe-Schnittstellen). Dieses Dokument konzentriert sich
auf die **konkreten Datenendpunkte der Stadt Stuttgart**, die dort noch nicht stehen.

**Stand:** 22.10.2026. Alle Endpunkte wurden live geprüft (HTTP-Status, Content-Type,
Beispielantwort). Die Beispiele sind so gewählt, dass sie mit `curl` nachvollziehbar sind.

**Wichtig vorab:** Technisch erreichbar ist nicht dasselbe wie rechtlich freigegeben.
Die allgemeinen Geodaten-Nutzungsbedingungen der Stadt sagen ausdrücklich, dass Karten,
Geodienste und das 3D-Stadtmodell **nicht frei als Open Data** nutzbar sind. Nur die im
Open-Data-Portal veröffentlichten Datensätze stehen unter freien Lizenzen (überwiegend
CC BY 4.0). Details in Abschnitt 7.

---

## 0. Kurzfazit

| # | Fund | Was | Aufwand | Nutzen |
|---|------|-----|---------|--------|
| 1 | **GeoServer-WFS mit 458 Vektor-Layern** | Brunnen, B-Pläne, Baustellen, Wahllokale, Starkregen, Lärm, Bäume, Sozialdaten … | gering | ★★★★★ |
| 2 | **`gis6.stuttgart.de` Stadt-Geocoder** | Adressen, Straßen, Haltestellen, Stadtteile, Flurstücke als JSON | sehr gering | ★★★★★ |
| 3 | **Beteiligungs-API `stuttgart-meine-stadt.de/api/public`** | 99 Bürgerbeteiligungsprojekte inkl. Phasen, Umfragen | gering | ★★★★ |
| 4 | **KOMUNIS (Lotus Domino)** | Statistisches Jahrbuch als JSON-Views + XLSX (2008–2026) | mittel | ★★★★ |
| 5 | **3D-Stadtmodell `3d.stuttgart.de`** | 3D-Tiles der Gebäude, Bäume, Mesh 2025 | gering (technisch) | ★★★ (Lizenz!) |
| 6 | **Masterportal-Konfigurationen** | 287 Layer des offiziellen Stadtplans, Wahllokalfinder, B-Plan-Viewer | gering | ★★★ |
| 7 | **`service.stuttgart.de` / AWS-Apps** | Abfallkalender, Online-Dienste, Formular-Endpunkte | mittel | ★★ |

Die wichtigste Erkenntnis: **Der größte Schatz liegt nicht im CKAN-Portal, sondern im
GeoServer der Stadt.** Dort liegen hunderte Fachlayer, die die Stadt selbst in ihren
Masterportal-Anwendungen (Stadtplan, Stadtklima, Wahllokalfinder, Bebauungspläne) nutzt.

---

## 1. Der GeoServer der Stadt: 458 WFS-Layer

### 1.1 Zugriff

Zwei Einstiegspunkte, beide ohne Login:

```text
https://geoserver.stuttgart.de/geoserver/ows     # voller Bestand
https://geoserver.stuttgart.de/gdc/ows           # kuratierter Themenbestand
```

Der volle Bestand ist per **WFS 2.0.0** abfragbar. GeoJSON kommt direkt heraus,
und die Koordinaten lassen sich mit `srsName=EPSG:4326` auf WGS84 umstellen – beides
verifiziert:

```bash
# Layer-Katalog (einmalig, ca. 1,2 MB WMS / 400 KB WFS – nicht im Hotpath abrufen)
curl -s "https://geoserver.stuttgart.de/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities" \
  -o wfs-caps.xml

# Einzelner Layer als GeoJSON, WGS84
curl -s "https://geoserver.stuttgart.de/geoserver/ows?service=WFS&version=2.0.0\
&request=GetFeature\
&typeNames=GEOLINE_FLEX:A62_BRU_BRUNNEN_Brunnen_in_Betr_EPSG25832\
&count=1\
&outputFormat=application/json\
&srsName=EPSG:4326"
```

Beispielantwort (gekürzt):

```json
{"type":"FeatureCollection","features":[{"type":"Feature",
 "geometry":{"type":"Point","coordinates":[9.213,48.8032]},
 "properties":{"NAME":"Schiffmann- Tiefbr. artesischer Mineralwas..."}}]}
```

Eigenschaften des Dienstes:

* **CORS:** `Access-Control-Allow-Origin: *` – technisch auch direkt aus dem Browser nutzbar.
  Im Projekt trotzdem über den Server-Proxy (`politeFetch`, TTL-Cache) gehen.
* **Formate:** GeoJSON, GML, CSV, Shapefile-ZIP (je nach Layer).
* **Filter:** WFS 2.0 `count`, `bbox`, `CQL_FILTER` (GeoServer-Standard).
* **Projektion:** Die Layernamen enden auf `_EPSG25832`, mit `srsName=EPSG:4326`
  liefert der Server aber WGS84 (getestet).
* **Kein API-Key, keine Registrierung.**
* **Große Layer** (Bäume, Gebäude, Flurstücke, Baumkataster) immer mit `bbox` und
  `count` abfragen – sonst gehen schnell mehrere Megabyte über die Leitung.

### 1.2 Workspaces

| Workspace | Anzahl WFS-Layer | Inhalt |
|-----------|-----------------|--------|
| `GEOLINE_FLEX` | 392 | Fachdaten aller Ämter: Verkehr, Umwelt, Klima, Soziales, Kultur, Bauen |
| `Base` | 49 | Basiskarte: Gebäude, Straßen, Flurstücke, Stadtteile, Luftbilder |
| `Daten` | 6 | u. a. Gehschulwege, hochfrequentierte Plätze, Vorbehaltsstraßen |
| `DVFO_Aufbau_ERZ` | 8 | Verkehrsmodell: Fahrzeiten, Level of Service, Emissionen |
| `Sensordaten` | 1 | senseBox-Umweltmessungen (Archiv) |
| `Monitoring` | 1 | Zabbix-Kontrolllayer (intern) |
| `Test_Zwangsarbeitslager` | 1 | Testdaten historischer Zwangsarbeitslager |

Der kuratierte `gdc`-Zweig enthält nur 8 Layer (Baustellen aktuell/geplant,
Hauptradrouten, Radfahrempfehlungen, drei Brunnen-Layer) – das sind die Layer, die
auch im CKAN-Portal verlinkt sind.

### 1.3 Die stärksten Layer (kuratiert)

Die folgenden Layer sind nach App-Mehrwert ausgewählt. Die Namen sind aus
Platzgründen gekürzt: Im Zweifel das volle Suffix `_EPSG25832` (Vektor) bzw.
`_EPSG25832_TIFF` (Raster) anhängen – die exakte Schreibweise steht in den
GetCapabilities. Mit `count=1` lässt sich jeder Layer vorab testen.

Zwei Hinweise zur Schreibweise:

* Die meisten Layer liegen im Workspace `GEOLINE_FLEX`; einige Basis-Layer
  (Bäume, Brücken, Tunnel, Bahn, Gebäude, Flurstücke, Luftbilder) im Workspace `Base`.
  Das Präfix steht in den Tabellen nur dort, wo es abweicht.
* Einträge mit `(WMS)` sind **Raster** und liefern Bilder, kein GeoJSON
  (Luftbilder, Lärmkarten, Bodenrichtwerte, Solarertrag, Überflutungstiefe).
  Für diese im Frontend WMS-Tiles bzw. `GetMap` nutzen, nicht WFS.

#### Alltag, Verwaltung, Orientierung

| Layer | Inhalt | Idee |
|-------|--------|------|
| `A62_BRU_BRUNNEN_Brunnen_in_Betr` | Brunnen in Betrieb | Brunnen-Layer |
| `A62_BRU_BRUNNEN_Trinkwasserbr_in_Betr` | Trinkwasserbrunnen | „Wasser nachfüllen“ im Sommer |
| `A62_BRU_BRUNNEN_Mineralbr_in_Betr` | Mineralbrunnen | Stuttgart als Mineralwasserstadt |
| `A10_POI_NETTE_TOILETTE` | „Nette Toilette“ | öffentliche Toiletten |
| `IP_2_10_10_TOILETTENANLAGE` | städtische Toiletten | Toiletten-Layer |
| `IP_2_10_04_ALTGLAS` | Altglascontainer | Entsorgung in der Nähe |
| `IP_2_10_06_ALTKLEIDER` | Altkleidercontainer | Entsorgung in der Nähe |
| `IP_3_06_04_WERTSTOFFHOF` | Wertstoffhöfe | Entsorgung |
| `IP_2_10_24_UMWELTMOBIL` | Schadstoff-/Wertstoffmobil | Termine/Standorte |
| `A62_SPF_SPIELPLAETZE` | Spielplätze | Familien-Layer |
| `IP_2_03_38_GRILLPLATZ` | Grillplätze | Freizeit |
| `IP_2_03_62_KLETTERANLAGE` | Kletteranlagen | Freizeit |
| `IP_2_03_36_FREIBAD` / `HALLENBAD` / `MINERALBAD` | Bäder | Bäder-Layer |
| `A53_ALG_KUEHLE_ORTE` | kühle Orte | Hitzeschutz |
| `A62_ALG_STUTTGARTER_STAEFFELE_P` | Stuttgarter Stäffele | Alleinstellungsmerkmal |
| `A62_POI_AUSSICHTSPUNKTE_PUNKTE` | Aussichtspunkte | Touren |
| `A62_POI_INNENSTADTRUNDWEG_PUNKTE` | Innenstadtrundweg | Stadtspaziergang |
| `A62_WANDERN_WEINWANDERWEG` | Weinwanderweg | Tourismus |
| `A62_INFOPOOL_DIREKTVERMARKTER` | Direktvermarkter | regionale Lebensmittel |

#### Bauen, Wohnen, Grundstück

| Layer | Inhalt | Idee |
|-------|--------|------|
| `A61_BPLAN` | Bebauungspläne | **pro Adresse: Welcher B-Plan gilt?** |
| `A12_MSP_LAGEN` | Mietspiegel-Lagen | Wohnlage im Adressprofil |
| `A62_BRWZ_Atlas_2026_gesamt_20cm_EPSG25832_TIFF` | Bodenrichtwerte 2026 (WMS) | Grundstückspreis-Kontext |
| `A61_BAULUECKE_PUNKT` / `_FLAECHE` | Baulücken | Innenentwicklung |
| `A61_DENKAS_GESAMT_Erhaltungssatz_Gesamtanl` | Erhaltungssatzungen | Denkmalschutz |
| `Base:A62_GK_GEB_KOMMUNAL` | Gebäude | 3D-/Schatten-Kontext |
| `Base:A62_GK_FLURST_KOMMUNAL` | Flurstücke | Grundstücksbezug |
| `A12_GBE_WAHLBEZAREA` | Wahlbezirke | Wahlen |
| `A12_GBE_WAHLLOKALE` | Wahllokale | **„Wo muss ich wählen?“** inkl. Barrierefreiheit |
| `A12_GBE_BWKAREA` | Bundestagswahlkreise | Wahlen |
| `A12_GBE_LWKAREA` | Landtagswahlkreise | Wahlen |
| `A12_GBE_PLZBEZAREA` | Postleitzahlbezirke | Adressprofil |
| `A62_GBE_POLIZEIREVIERE` | Polizeireviere | Zuständigkeit |

Der B-Plan-Layer ist besonders wertvoll, weil er die komplette Kette mitliefert:

```json
{
  "BPLAN_ID": "1968_018",
  "NAME": "Sprollstraße Degerloch",
  "JAHR": 1968,
  "URL_MASTERPORTAL": "https://maps.stuttgart.de/bebauungsplaene/?layerIds=...",
  "KOMM_ONE_URL": "https://geodienste.komm.one/ows/services/...",
  "AUSFERTIGUNG_URL": "https://geodienste.komm.one/store/attachments/.../ausfertigung.pdf"
}
```

Die `AUSFERTIGUNG_URL` liefert direkt das Plan-PDF (getestet: HTTP 200,
`application/pdf`, 361 KB). Damit lässt sich im Adressprofil „B-Plan anzeigen“
plus „Plan-PDF öffnen“ anbieten, ohne eigene Dokumentenlogik.

#### Mobilität, Verkehr, Parken

| Layer | Inhalt | Idee |
|-------|--------|------|
| `A66_BAUM_BAUSTELLEN_DATE_im_Bau` | Baustellen aktuell | „Was ist bei mir gesperrt?“ |
| `A66_BAUM_BAUSTELLEN_DATE_geplant` | Baustellen geplant | Vorausschau |
| `A66_BAUM_MASSNAHME_AUSKUNFT_STADTWERKE` | Stadtwerke-Baustellen | Versorgungsbaustellen |
| `A66_PRM_ZONE_AUSKUNFT_*` | Parkraummanagement-Zonen (12 Bezirke) | Anwohnerparken |
| `A66_TIBIS_PRM_STELLPLATZ_*` | Behindertenstellplätze | Barrierefreiheit |
| `A66_TIBIS_RADW_RADBUEGEL_*` | Radabstellanlagen, Fahrradgaragen, Lastenrad | Radinfrastruktur |
| `A61_RAD_REPSAEULEN` | Fahrrad-Reparatursäulen | Panne unterwegs |
| `A61_RAD_HAUPTRADROUTEN` | Hauptradrouten | Radrouting |
| `A61_RAD_RADEMPFEHLUNGEN` | Radfahrempfehlungen | Radrouting |
| `FREMDDATEN_ADFC_THEMENROUTEN_*` | ADFC-Themenrouten | Touren |
| `FREMDDATEN_VVS_HALTESTELLEN` | VVS-Haltestellen | ÖPNV |
| `FREMDDATEN_REGION_PARK_RIDE_ANLAGEN_*` | P+R-Anlagen | Pendler |
| `FREMDDATEN_POI_BIKESHARING` / `CARSHARING` | Sharing-Standorte | Mikromobilität |
| `A32_ES_ABSTELLFLAECHEN` / `_ABSTELLVERBOTSZONEN` | E-Scooter-Zonen | „Wo darf ich parken?“ |
| `A32_DVVZ_FLAECHE` / `A32_DVV_STRASSE_EURO5` | Diesel-Fahrverbotszonen | Umweltzone |
| `A66_GB_TEMPO30_GEBIETE` | Tempo-30-Zonen | Verkehrsregeln |
| `Base:A62_GK_BAHNSCHIENEN` / `A62_GK_BAHNACHSEN` | Stadtbahnschienen | Kartenbild |
| `A66_VFL_FUSSGAENGERZ` | Fußgängerzonen | Kartenbild |
| `A61_LKW_DURCHFAHRTSVERBOTSZONE` | LKW-Durchfahrtsverbot | Logistik |

Die Baustellen-Features enthalten u. a. `VERKEHRSAUSWIRKUNG` (z. B. „Vollsperrung“)
und `DETAILS_STANDORT` – gut für eine Kachel „Baustellen in meiner Nähe“.

#### Natur, Umwelt, Klima

| Layer | Inhalt | Idee |
|-------|--------|------|
| `Base:A67_GFM_BAUM_PLUS` | Bäume (Baumkataster) | Baum-Layer, Arten, Schatten |
| `A67_GFM_Eiche` … `Platane` | Bäume nach Art | „Welcher Baum blüht hier?“ |
| `A61_BAUM_BAUMSCHUTZAREA` | Baumschutzsatzung | Adressprofil |
| `A61_ALG_GRUENDACHKATASTER` | Gründachpotenzial | Gebäudeprofil |
| `A36_SOLAR_GEB_GRUNDRISSE` / `A36_SOLAR_ERTRAGSRASTER_EPSG25832_TIFF` (WMS) | Solaratlas | Solarpotenzial |
| `A36_BOISS_GEOT_BOHRUNGEN_RANDBED` | Geothermie | Wärmewende |
| `A36_KLIMA_KLIMATOPE` | Klimatope | Stadtklima |
| `A36_KLIMA_KALTLUFTPROD` / `KALTLUFTSAMMEL` | Kaltluft | Klimaanalyse |
| `A36_BIOKLIMA_WAERMEBELASTUNG_STGT_..._TIFF` (WMS) | Wärmebelastung | Hitzekarte |
| `A36_LUFT_IMMISSION_NOX` / `PM10` | Luftbelastung | Umwelt |
| `A36_LAERM2022_FASSADENPEGEL_STR` / `_BAHN` | Lärm Fassadenpegel 2022 | Adressprofil „Wie laut?“ |
| `A36_LAERM_2022_STRASSE_LDEN_EPSG25832_TIFF` (WMS) | Lärmkarte Straße 2022 | Lärm-Layer |
| `A66_SRGS_UEBERFLUTUNGSAUSD_*` | Starkregen-Überflutung | **Hochwasserrisiko pro Adresse** |
| `A66_UEBERFLUTUNGSTIEFE_*_EPSG25832_TIFF` (WMS) | Überflutungstiefe | Risiko |
| `A36_HWGK_GEN_HQ100_HAUPTWASSERK` | HQ100-Überflutung | Hochwasser |
| `A36_GEW_UEBERSCHWG_1982` | Überschwemmungsgebiete 1982 | historisch |
| `A36_GEW_HEILQUELLENSG` | Heilquellenschutzgebiete | Stuttgart-spezifisch |
| `A36_SG_NSG` / `LSG` | Natur-/Landschaftsschutz | Umwelt |
| `A36_NATURA2000_FFH` / `VOGELSCHUTZ` | Natura 2000 | Umwelt |
| `A36_ND_END_M1` / `ND_FND_M1` | Naturdenkmale | Umwelt |
| `A36_BIOTOP_EINZELBIOTOPE` | Einzelbiotope | Umwelt |
| `A67_KGA_ANLAGE_WEB` | Kleingartenanlagen | Freizeit |
| `A67_PARK_GRUENANLAGE_FLAECHE` | Park-/Grünanlagen | Freizeit |
| `IP_3_05_05_FRIEDHOF` | Friedhöfe | Orientierung |
| `A62_MOFU_STANDORTE` | Mobilfunkantennen | Infrastruktur |

Der Starkregen-Layer ist ein starkes Alleinstellungsmerkmal: Er beantwortet die Frage
„Ist meine Adresse bei Starkregen gefährdet?“ mit amtlichen Fließwegen und
Überflutungsflächen. Als WMS-Raster (Überflutungstiefe) oder WFS (Ausdehnung) nutzbar.

#### Soziales, Gesundheit, Sicherheit

| Layer | Inhalt | Idee |
|-------|--------|------|
| `IP_2_01_10_KITA` | Kitas | Familien |
| `IP_2_01_11_KINDER_JUGENDTREFFS` | Kinder-/Jugendtreffs | Jugend |
| `IP_2_01_01_SENIORENEINRICHTUNGEN` | Senioreneinrichtungen | Ältere |
| `IP_2_07_01_KLINIKEN` | Krankenhäuser | Gesundheit |
| `IP_3_05_01_JUGENDBERATUNG` | Beratungszentren | Beratung |
| `IP_3_05_11_JUGENDGESUNDHEIT` | Kinder-/Jugendgesundheit | Gesundheit |
| `IP_3_04_01_JOBCENTER` | Jobcenter | Soziales |
| `IP_3_06_04_WOHNUNGSLOSENHILFE` | Wohnungslosenhilfe | Soziales |
| `A50_SOZ_DIGITALE_TEILHABE` | Angebote digitale Teilhabe | Digitalisierung |
| `A51_ALG_FRUEHE_HILFEN_PUB` | Frühe Hilfen (öffentlich) | Familien |
| `OB_SIC_BEZIEHUNGSGEWALT` | Unterstützung bei Beziehungsgewalt | Sensibel: nur mit Kontext |
| `IP_2_05_02_POLIZEI` | Polizeireviere/-posten | Sicherheit |
| `IP_2_05_01_Feuerwehrhaus_freiw_Feuerwehr` | Feuerwehrhäuser | Sicherheit |
| `IP_3_05_01_FEUERWACHE` | Berufsfeuerwehr | Sicherheit |
| `A37_NOTF_TREFFPUNKTE_Stufe1` / `_Stufe2` | Notfall-Treffpunkte | Katastrophenschutz |
| `A37_GBE_JODBEZIRKE_AUSSEN` | Jodbezirke | Katastrophenschutz |
| `A37_FG_FEUERGASSEN` | Feuergassen | Katastrophenschutz |

#### Kultur, Freizeit, Tourismus, Bildung

| Layer | Inhalt | Idee |
|-------|--------|------|
| `IP_MUSEEN` | Museen | Kultur |
| `IP_THEATER` | Theater | Kultur |
| `IP_KULTURAMT_STADTPALAIS` | StadtPalais | Kultur |
| `IP_KULTURAMT_STADTBIBLIOTHEK` | Stadtbibliothek | Bildung |
| `IP_3_05_04u05_STADTBIBLIOTHEK` | Standorte | Bildung |
| `IP_2_04_01_GRUNDSCHULE` … `GYMNASIUM` | Schulen | Bildung |
| `IP_2_04_25-27_UNI_HOCHSCHULE` | Unis/Hochschulen | Bildung |
| `IP_2_04_31_VHS` | Volkshochschulen | Bildung |
| `A52_SIP_STANDORTE` | Sport im Park | Sommerprogramm |
| `A51_ALG_FP_PUNKTE_*` | Ferienprogramm (5 Kategorien) | Familien |
| `A61_JGD_CHILLORTE_*` | ChillOrte für Jugendliche | Jugend |
| `A62_POI_34_TRAUUNG_WUNSCH` | Heirats-Wunschorte | Hochzeit |
| `A10_EP_TOUR_ENGAGEMENT_ORTE` | Engagement-Orte | Ehrenamt |
| `IP_2_12_01_TOURISTIKINFO` | Tourist-Info | Tourismus |
| `IP_2_14_11_JUGENDGAESTEHAUS` | Jugendgästehäuser | Freizeit |
| `IP_2_03_24_ZOO` | Zoo/Botanischer Garten | Freizeit |

#### Infrastruktur, Entsorgung, historische Daten

| Layer | Inhalt | Idee |
|-------|--------|------|
| `FREMDDATEN_AWS_BEZIRKE` | AWS-Abfuhrbezirke | Abfallkalender |
| `FREMDDATEN_AWS_BETRIEBSSTELLEN` | AWS-Betriebsstellen | Entsorgung |
| `FREMDDATEN_RECUP_STANDORTE` | reCup-Standorte | Mehrweg |
| `A66_AWN_GEEIGNETE_STANDORTE` | Abwasserwärme-Standorte | Energiewende |
| `A66_AWN_RELEVANTE_HALTUNGEN` | nutzbare Abwasserhaltungen | Energiewende |
| `Base:A62_GKI_BRUECKEN` | Brücken | Infrastruktur |
| `Base:A62_GKI_UNTERFUELINIEN` | Tunnel | Infrastruktur |
| `A62_SCHRAEGLB_POI_AUSWAHL` | Schrägluftbilder | Stadtbild |
| `Base:A62_Luftbild_2006…2025` | Luftbilder 2006–2025 | Zeitreise |
| `Test_Zwangsarbeitslager:Testdaten_Zwangsarbeitslager` | historische Zwangsarbeitslager | Geschichte (Testdaten, sensibel) |

### 1.4 DVFO: Verkehrsmodell mit Emissionen

Der Workspace `DVFO_Aufbau_ERZ` enthält 12.370 Straßenabschnitte mit:

* `TIME_STAMP`, `LOS` / `LOS_CALC` (Level of Service), `TRAVEL_TIME`, `TRAVEL_TIME_FREE`
* Emissionen: `CO2_E`, `NO2_E`, `NOX_E`, `PM10_E`, `PM25_E`

Beispiel:

```json
{"TIME_STAMP":"2025-03-12T15:17:00+01:00","LOS":1,"LOS_CALC":"A",
 "TRAVEL_TIME":6.2458577,"TRAVEL_TIME_FREE":8.092374,"TLOSS_PERC":-22.8}
```

**Wichtig:** Das ist ein **Modellstand vom 12.03.2025**, kein Live-Verkehr. Als
„Verkehrsbelastung/Emissionskarte“ und für Vergleiche nutzbar, nicht als Echtzeit.

### 1.5 Sensordaten: senseBox-Archiv

`Sensordaten:Umwelt` enthält **511.478 Messpunkte** von senseBoxen
(`sensebox_id`, `sensebox_name`, `sensor_typ` z. B. `feinstaub`, `sensor_value`,
`sensor_unit`, `sensor_lastMeasurement`). Letzte Messung im Datensatz: **22.12.2022**.
Also ein Archiv, kein Live-Feed. Trotzdem interessant für „Umweltmessungen im
Quartier“ und als Zeitreihe. Für Live-Daten ist der bereits integrierte
Sensor.community-/UBA-Weg besser.

### 1.6 Lizenzstatus der GeoServer-Layer

Die Stadt unterscheidet zwei Welten:

* **Open Data (CKAN):** Datensätze wie `baustellen`, `brunnen`, `wahlbezirke`,
  `bebauungsplaene`, `luftqualitaet-und-laermbelastung`, `stadtklima-stuttgart`,
  `klima-und-wetterdaten`, `strassennetz-in-stuttgart`, `radfahrende-zaehlstellen`
  stehen laut CKAN unter **CC BY 4.0**. Die zugehörigen WFS-Layer sind die sichere Bank.
* **Alles andere:** Die allgemeinen Nutzungsbedingungen sagen:

  > „Die im Internet präsentierten Daten und Karten, das 3D‐Stadtmodell der Anwendung
  > Stuttgart 3D sowie Geodienste des Stadtmessungsamtes … sind urheberrechtlich
  > geschützt. … Die Daten, Karten und Dienste sind nicht frei als Open Data nutzbar.“

  Das betrifft viele der oben genannten Layer (z. B. Lärmkarten, Starkregen,
  Baumkataster, Sozialdaten), solange sie nicht explizit im Open-Data-Portal stehen.

**Konsequenz für Open Stuttgart:** Nur Layer verwenden, die einem CKAN-Datensatz
zugeordnet sind, oder vorab eine schriftliche Freigabe beim Stadtmessungsamt einholen.
Die technische Erreichbarkeit ist kein Lizenzersatz. In der Quellenangabe immer
„Datenquelle: Landeshauptstadt Stuttgart, Stadtmessungsamt, CC BY 4.0“ nennen.

---

## 2. Der offizielle Stadt-Geocoder (`gis6.stuttgart.de`)

Die Stadt betreibt einen eigenen Location Finder, den u. a. der 3D-Viewer und der
Wahllokalfinder verwenden. Er ist nicht dokumentiert, liefert aber sauberes JSON.

```bash
curl "https://gis6.stuttgart.de/locationfinderutm/Finder/Lookup?query=Charlottenplatz&sref=4326"
```

Antwort (gekürzt):

```json
{
  "ok": true,
  "sref": 4326,
  "count": 8,
  "locs": [
    {"id": 600, "type": "Straßenname", "name": "Charlottenplatz",
     "cx": 9.18273685621267, "cy": 48.7756498873436,
     "xmin": 9.1820546877304, "ymin": 48.775201168161,
     "xmax": 9.18341903685424, "ymax": 48.7760986024386}
  ]
}
```

Eigenschaften:

* **Parameter:** `query` (Pflicht), `sref=4326` oder `sref=25832` (Default 25832),
  `limit` (optional).
* **Typen:** Straßenname, Adresse, Haltestelle, Stadtbezirk, Stadtteil, Flurstück,
  Gewann, Behörde/Gericht, Aussichtspunkt, Brunnen, Friedhof, Grünanlage,
  Kindergarten, Kirche/Religion, Konsulat, Krankenhaus, Kultur, Parkhaus,
  Polizeirevier, See, Sportstätte, „Sonstige Adresse“.
* **Rückgabe:** Mittelpunkt (`cx`, `cy`) plus Bounding Box – ideal für Karten-Fokus.
* **Reverse-Geocoding:** Der Endpunkt `/Finder/Reverse` existiert, antwortet aber mit
  `{"ok":false,"info":"Index not prepared for reverse geocoding"}`. Also nicht verfügbar.
* **CORS:** kein `Access-Control-Allow-Origin`-Header (getestet) – serverseitig nutzen.
* **Stabilität:** inoffiziell, keine SLA. Cache pro Query (z. B. 24 h), Fallback auf
  Nominatim.

**Nutzen:** präziser als Nominatim für Stuttgarter Adressen, Straßen und Haltestellen,
und liefert Stadtteil/Stadtbezirk gleich mit. Perfekt für das Adressprofil und die
Suche.

---

## 3. KOMUNIS: das Statistik-Lager der Stadt (Lotus Domino)

`statistik.stuttgart.de` leitet heute auf eine Wahlseite um. Die eigentliche
Statistikdatenbank liegt aber weiterhin unter:

```text
https://www.domino1.stuttgart.de/web/komunis/komunissde.nsf
```

Es handelt sich um eine Lotus-Domino-Datenbank. Domino hat eine eingebaute,
kaum dokumentierte JSON-Schnittstelle für Views:

```bash
curl "https://www.domino1.stuttgart.de/web/komunis/komunissde.nsf/\
annathe20?ReadViewEntries&OutputFormat=JSON&Count=100"
```

Antwort (gekürzt):

```json
{"@toplevelentries":"16","viewentry":[
 {"@position":"1","@noteid":"8001AEAC","@children":"4",
  "entrydata":[{"text":{"0":"Stuttgart im Überblick"}}]},
 {"@position":"2","@noteid":"8001AEF8","@children":"3",
  "entrydata":[{"text":{"0":"Stadtgebiet und Klima"}}]}
]}
```

Die 16 Hauptkategorien:

1. Stuttgart im Überblick
2. Stadtgebiet und Klima
3. Einwohner
4. Bauen und Wohnen
5. Arbeitsmarkt
6. Unternehmen und Wirtschaftsleistung
7. Einkommen, Geld und Preise
8. Soziales und Gesundheitswesen
9. Bildung
10. Kriminalität und Rechtspflege
11. Kultur und Freizeit
12. Tourismus
13. Öffentliche Finanzen und Aufgaben
14. Umwelt und Verkehr
15. Wahlen
16. Umfragen

**Navigation:** Mit `Start=<position>` steigt man in die Hierarchie:

```bash
# Unterkategorien von "Einwohner"
curl "...annathe20?ReadViewEntries&OutputFormat=JSON&Start=3.1&Count=20"

# Tabellenliste von "Bevölkerungsfortschreibung"
curl "...annathe20?ReadViewEntries&OutputFormat=JSON&Start=3.1.3.1&Count=20"
```

Beispiel „3.1.3 Tabelle“ → „3.1.3.1“:

```text
2026/9 | Fortgeschriebene Einwohnerzahl - Monatsdaten | Tabelle
2026/9 | Fortgeschriebene Einwohnerzahl nach Stadtbezirken - Monatsdaten
2026/9 | Fortgeschriebene Einwohnerzahlen 2026 nach Geschlecht, Staatsangehörigkeit …
```

Die Dokumente selbst sind HTML-Seiten mit **XLSX-Anhängen**:

```text
.../komunissde.nsf/<viewUNID>/<docUNID>?OpenDocument
.../komunissde.nsf/<viewUNID>/<docUNID>/$FILE/zz02_.xlsx
```

Getestet: `zz02_.xlsx` = 123.792 Bytes, Excel-Datei mit den Blättern
`Info`, `2026`, `2025`, … `2008` – also eine komplette Zeitreihe.

**Warum das stark ist:** Das ist die amtliche Stuttgarter Statistik auf Stadtteil-
und Stadtbezirksebene, monatlich aktualisiert, kostenlos und ohne Key. Damit lässt
sich „Dein Kiez in Zahlen“ (Einwohner, Haushalte, Arbeitsmarkt, Bauen, Umwelt,
Wahlen) deutlich tiefer umsetzen als mit den statischen CKAN-CSVs.

**Umsetzung:** `scripts/build-komunis.mjs` (Build-Zeit) traversiert die Views,
lädt die XLSX-Anhänge und schreibt `server/data/komunis.json` bzw. eine SQLite-Tabelle.
Die XLSX-Auswertung kann wie beim GTFS-Build über Python (`openpyxl`/`pandas`) laufen.
Wegen der inoffiziellen Domino-Schnittstelle: nur nächtlich/weekly crawlen, User-Agent
setzen, keine parallelen Requests.

**Caveats:** View-Positionen und UNIDs können sich bei einem Datenbank-Rebuild ändern.
Deshalb die Dokument-URLs aus der HTML-Ansicht (`?OpenView`) auflösen, nicht hart kodieren.
Die Seite nennt keine explizite Open-Data-Lizenz – Quellenangabe „Statistisches Amt
der Landeshauptstadt Stuttgart“ ist Pflicht, kommerzielle Weiterverwendung vorher klären.

---

## 4. 3D-Stadtmodell: `3d.stuttgart.de`

Der offizielle 3D-Viewer („Stuttgart 3D“) ist eine Cesium-/Plexgis-Anwendung.
Die Konfiguration ist öffentlich:

```bash
curl "https://3d.stuttgart.de/api/v2/viewer/view/\
9370ae24-2f03-4921-9ad8-4fc0bc79326f/config"
```

Darin u. a.:

* Layer `Bestandsgebäude`, `einfache Bestandsgebäude`, `texturierte Gebäude`,
  `Bäume`, `Meshmodell_2025`, `terrain_cesium`, `Luftbilder`
* Typen: `cesium_tiles`, `cesium_terrain`, `mapproxy`
* `"tiles_url": "/static/tiles/"`
* Location Finder: `https://gis6.stuttgart.de/locationfinderutm/Finder/Lookup`

Die 3D-Tiles sind direkt abrufbar (getestet):

```bash
curl "https://3d.stuttgart.de/static/tiles/\
f3374fec-0eb7-4c39-aaf1-636a64913854_11/tileset.json"
# HTTP 200, application/json, 1.137 Bytes, 3D Tiles 1.0
```

**Nutzen:** echtes LoD2-/texturiertes Stadtmodell inkl. Bäumen und Mesh 2025.
Technisch ein Traum für ein 3D-Modul oder Schattenberechnungen.

**Aber:** Das 3D-Stadtmodell ist laut Nutzungsbedingungen **ausdrücklich nicht**
frei als Open Data nutzbar. Eine Integration der Tiles in Open Stuttgart ist ohne
schriftliche Freigabe nicht vertretbar. Sinnvolle Zwischenlösung: aus der App auf den
offiziellen Viewer verlinken (Deep-Link mit Koordinate) und die Freigabe anfragen.

---

## 5. Bürgerbeteiligung: die API hinter `stuttgart-meine-stadt.de`

Die Beteiligungsplattform ist eine Angular-App (Plattform „Crowdi“). Sie nutzt eine
öffentliche JSON-API, die auch ohne Login erreichbar ist:

```text
https://stuttgart-meine-stadt.de/api/public/...
```

Verifizierte Endpunkte:

| Endpunkt | Inhalt | Status |
|----------|--------|--------|
| `GET /api/public/participations` | alle Beteiligungsprojekte (99 Stück, ~691 KB) | 200 |
| `GET /api/public/participations/<id>` | Detail: Phasen, Umfragen, Kontakte, Ressourcen | 200 |
| `GET /api/public/pages` | statische Seiten/Inhalte | 200 |
| `GET /api/public/participation-groups` | Gruppen (aktuell leer) | 200 |
| `GET /api/public/analysis/insights/<id>` | Auswertungs-Insights | laut Frontend |
| `GET /api/public/analysis/key-statements/<id>` | Kernaussagen | laut Frontend |
| `GET /api/public/analysis/decisions/<id>` | Entscheidungen | laut Frontend |
| `GET /api/public/maps/<mapId>/markers` | Kartenmarker | laut Frontend |

Beispielprojekt:

```json
{
  "id": "b0fe1611-e552-4827-99bd-7e407a11318b",
  "name": "Fortschreibung des Stuttgarter Radverkehrskonzepts 2026",
  "status": "active",
  "startDate": "2026-04-30T17:00:00.000Z",
  "endDate": "2027-10-31T22:59:00.000Z",
  "description": "## Stuttgart will Fahrradstadt werden ...",
  "projectPhases": [{"title": "Öffentliche Auftaktveranstaltung", "...": "..."}],
  "surveys": [{"title": "Umfrage zum Radverkehrskonzept 2026", "...": "..."}]
}
```

**Nutzen:** Das Beteiligungsmodul kann echte Projekte mit Status, Laufzeit, Phasen,
Umfragen und (falls vorhanden) Kartenmarkern anzeigen – ergänzend zu ALLRIS/OParl.
99 Projekte, viele mit Bezug zu Sanierungsgebieten, Schulen, Neckar, IBA'27, Radverkehr.

**Caveats:** Die API ist öffentlich, aber nicht als offizielle Schnittstelle
dokumentiert. CORS ist offen (`Access-Control-Allow-Origin` spiegelt den Origin,
`credentials: true`), Cache-Control aber `private`. Serverseitig cachen (10–30 min),
keine Massenabfragen, auf Änderungen der Plattform vorbereitet sein. Quellenangabe
und Verlinkung auf das Originalprojekt.

---

## 6. Weitere versteckte bzw. semistrukturierte Quellen

### 6.1 Masterportal-Konfigurationen und Alerts

Die Stadt betreibt mehrere Masterportal-Instanzen unter `maps.stuttgart.de`.
Deren `config.json` ist öffentlich und enthält die komplette Layerliste:

| Anwendung | Konfiguration | Inhalt |
|-----------|---------------|--------|
| Stadtplan | `https://maps.stuttgart.de/stadtplan/config.json` | 287 Layer |
| Stadtklima | `https://maps.stuttgart.de/stadtklima/config.json` | Klima-/Luft-Layer |
| Wahllokalfinder | `https://maps.stuttgart.de/wahlen/config.json` | Wahllokale, Adresssuche |
| Bebauungspläne | `https://maps.stuttgart.de/bebauungsplaene/config.json` | alle B-Pläne (419 KB) |

Zusätzlich gibt es einen kleinen Alerting-Feed:

```bash
curl "https://maps.stuttgart.de/stadtplan/alerts.json"
# {"globalAlerts":["InfoPopUp"],"restrictedAlerts":{},"alerts":{...}}
```

Das ist kein redaktioneller News-Feed, sondern die Masterportal-Hinweise
(z. B. Info-Popup). Für „aktuelle Hinweise“ nur bedingt geeignet, aber ein
interessantes Beispiel dafür, wie die Stadt ihre Karten konfiguriert.

**Technik-Tipp:** Die Configs sind eine Fundgrube für Layer-IDs, WMS-Namen und
Deep-Links (z. B. `?layerIds=Stadtplan,Bebauungsplaene,...`). Sie ersparen das
Reverse Engineering der Kartenanwendungen.

### 6.2 `service.stuttgart.de`: MeinServiceStuttgart und AWS-Apps

`https://service.stuttgart.de/` ist das Portal „MeinServiceStuttgart“ mit den
Online-Diensten der Stadt. Daneben gibt es Fachanwendungen unter
`/lhs-services/<ressort>/...`, z. B.:

* `https://service.stuttgart.de/lhs-services/aws/abfallkalender`
* `https://service.stuttgart.de/lhs-services/aws/abfuhrtermine`
* `https://service.stuttgart.de/lhs-services/aws/jahreskalender`

Die Abfall-Apps haben klassische Formulare (`calendar[street]`, `calendar[streetnr]`,
`calendar[datefrom]`, `calendar[dateto]`, `calendar[wastetype][]`). Ein direkter
POST ohne vollständige Felder/CSRF-Schutz endet mit HTTP 422 („Pflichtfelder“).
Es gibt laut stuttgart.de einen iCal-Export; der sauberste Weg ist, den ICS-Link
aus der App zu übernehmen, statt das Formular zu automatisieren. Für Open Stuttgart
reicht zunächst der Deep-Link „Abfuhrtermine für meine Adresse“ – das ist ehrlicher
als ein fragiler Crawler.

### 6.3 `stadtklima-stuttgart.de`: tabellarische Luftmessdaten

Die Stadt betreibt eine eigene Klima-/Luftseite mit PHP-Tabellen, u. a.:

* `index.php?luft_messdaten_feinstaubwerte`
* `index.php?luft_messdaten_feinstaubwerte_hs-str`
* `index.php?luft_messdaten_stationeninstuttgart`

Das sind **keine APIs**, sondern historisch gewachsene HTML-Tabellen. Für
Feinstaub-Zeitreihen (speziell „Am Neckartor“) sind sie aber eine wertvolle
Ergänzung. Besser: die bereits angebundenen UBA-/LUBW-Daten nutzen und die
Stadtseite nur verlinken.

### 6.4 `feuerwehr.stuttgart.de`: Meldungen, kein Feed

Die Feuerwehr veröffentlicht aktuelle Meldungen unter
`/oeffentlichkeitsarbeit/aktuelle-meldungen/` (HTML). Ein strukturierter
Einsatz-Feed existiert nicht. Für „Was brennt gerade?“ bleibt nur der Umweg über
Presseportal/Polizei oder ein sehr vorsichtiger HTML-Crawl – nicht empfohlen.

### 6.5 Was **keine** saubere Schnittstelle hat

Ehrlich benannt, damit die Lücke nicht immer wieder gesucht wird:

* **Bäder-Auslastung:** keine öffentliche API gefunden; die Bäder-Website liefert
  keine Live-Belegung als JSON.
* **Parkleitsystem der Stadt:** kein eigener offener Endpunkt gefunden; die
  dynamischen Parkdaten laufen über MobiData BW (ParkAPI), das bereits angebunden ist.
* **Veranstaltungen:** kein offizielles Event-API der Stadt; weiterhin Crawling
  bzw. die vorhandenen Quellen (Stuttgart Tourist, Rausgegangen, Gancio …).
* **OParl/ALLRIS:** weiterhin offen; siehe `docs/anfrage-allris-oparl.md`.
* **Stadtlexikon:** SPA mit Artikel-Route (`/article/:lemmaId/...`), aber keine
  dokumentierte API. Als Linkziel/Content-Quelle nutzbar, nicht als Datenfeed.

---

## 7. Lizenz- und Nutzungsregeln (Kurzfassung)

| Quelle | Lizenz/Status | Empfehlung |
|--------|---------------|------------|
| CKAN-Datensätze (`opendata.stuttgart.de`) | CC BY 4.0 (Beispiele geprüft) | verwenden, Namensnennung |
| WFS-Layer, die CKAN-Datensätzen zugeordnet sind | wie Datensatz (meist CC BY 4.0) | verwenden |
| Übrige GeoServer-Layer | Nutzungsbedingungen, **nicht** Open Data | nur nach Freigabe |
| `gis6`-Geocoder | inoffiziell, öffentlich | sparsam nutzen, cachen |
| KOMUNIS | Statistik der Stadt, keine explizite Lizenz | Quellenangabe, Freigabe klären |
| 3D-Tiles | ausdrücklich **nicht** Open Data | nicht integrieren ohne Freigabe |
| Beteiligungs-API | öffentlich, nicht dokumentiert | cachen, verlinken, kein Massenabruf |
| `service.stuttgart.de` | Formulare/Apps | Deep-Links statt Automatisierung |

**Attributionsbausteine:**

* `Datenquelle: Landeshauptstadt Stuttgart, Stadtmessungsamt, CC BY 4.0`
* `Datenquelle: Statistisches Amt der Landeshauptstadt Stuttgart`
* `Bürgerbeteiligung: Landeshauptstadt Stuttgart, stuttgart-meine-stadt.de`

---

## 8. Konkrete Roadmap für Open Stuttgart

### Quick Wins (1–3 Tage)

1. **`server/sources/stadt-wfs.mjs`** mit Allowlist und GeoJSON-Proxy.
   Start mit 8 Layern: Brunnen, Trinkwasserbrunnen, Kühle Orte, Stäffele,
   Toiletten, Baustellen (aktuell), Spielplätze, Wahllokale.
   Cache 6–24 h, `srsName=EPSG:4326`, Attribution.

2. **Adressprofil aufwerten** (der größte Hebel):
   * Geocoding über `gis6` (Adresse → WGS84 + Stadtteil)
   * B-Plan: räumliche Verschneidung mit `A61_BPLAN`, Link auf `AUSFERTIGUNG_URL`
   * Mietspiegel-Wohnlage (`A12_MSP_LAGEN`)
   * Starkregen-Gefährdung (`A66_SRGS_*`, WMS/Overlay)
   * Lärm-Fassadenpegel (`A36_LAERM2022_FASSADENPEGEL_STR`)
   * Wahllokal (`A12_GBE_WAHLLOKALE`)

3. **Beteiligungsmodul** mit `GET /api/public/participations`:
   Liste, Filter nach Status/Stadtbezirk, Detailseite mit Phasen und Umfragen,
   Deep-Link auf das Originalprojekt.

4. **Neue Karten-Layer** aus dem WFS: Trinkbrunnen, Kühle Orte, Stäffele,
   Nette Toilette, E-Scooter-Zonen, Parkraummanagement, Baustellen.

### Mittel (1–2 Wochen)

5. **KOMUNIS-Import** (`scripts/build-komunis.mjs`) → „Kiez in Zahlen“ je
   Stadtbezirk/Stadtteil, Zeitreihen 2008–2026.

6. **Baumkataster + Solar/Gründach/Geothermie** als Gebäude-/Quartiersprofile.

7. **B-Plan-Viewer** mit Plan-PDF und WMS-Overlay pro B-Plan.

8. **3D-Deep-Link** aus der App + formelle Anfrage für die Tiles.

### Große Brocken (mit Klärung)

9. **Lizenzklärung** für die Nicht-CKAN-Layer (Stadtmessungsamt).
10. **OParl/ALLRIS** (bestehende Anfrage fortsetzen).
11. **KOMUNIS-Automatisierung** offiziell abstimmen.
12. **3D-Tiles** freigeben lassen und als eigenes Modul evaluieren.

---

## 9. Offene Fragen an die Stadt (für die nächste Anfrage)

* Welche Layer des GeoServers (`geoserver.stuttgart.de/geoserver/ows`) sind
  offiziell Open Data, welche nur intern? Gibt es eine Layer-Lizenzliste?
* Ist die Nutzung der 3D-Tiles (`/static/tiles/.../tileset.json`) für ein
  nicht-kommerzielles Open-Source-Projekt möglich? Wenn ja, zu welchen Bedingungen?
* Gibt es eine stabile, dokumentierte Schnittstelle für KOMUNIS (statt Domino-Views)?
* Ist die Beteiligungs-API (`/api/public/...`) für Dritte freigegeben, und gibt es
  Rate-Limits?
* Gibt es einen offiziellen iCal-Endpunkt für die Abfuhrtermine (statt Formular)?
* Ist OParl/ALLRIS mittelfristig geplant (siehe `docs/anfrage-allris-oparl.md`)?

---

## 10. Methodik: Wie man solche Quellen selbst findet

Die Funde sind kein Zufall, sondern folgen einem Muster. Für künftige Recherchen:

1. **Open-Data-Katalog als Einstieg, nicht als Ende.** `package_show` liefert die
   Ressourcen-URLs. Viele zeigen nicht auf CSV, sondern auf `geoserver.stuttgart.de/gdc/...`
   – von dort führt der Weg zum vollen GeoServer.
2. **OGC-Capabilities lesen.** `?service=WFS&request=GetCapabilities` listet alle Layer
   mit Namen und Titel. Das ist bei Stadt-GeoServern fast immer die größte Fundgrube.
3. **Masterportal-Configs suchen.** Stadtplan-Anwendungen laden `<app>/config.json`.
   Probiere `stadtplan`, `stadtklima`, `wahlen`, `bebauungsplaene` unter
   `maps.<stadt>.de`. Die Config enthält Layer-IDs, WMS-Namen und Deep-Links.
4. **JavaScript-Bundles greppen.** Nach `"/api/`, `"/public/`, `apiUrl`, `fetch(`,
   `baseURL` suchen. Bei SPAs steht die API-Basis oft in `assets/env.js` oder
   `window.__NUXT__`/`Plexgis.config`.
5. **CKAN-Ressourcen auf WFS prüfen.** `package_show?id=<dataset>` und dann
   `resources[].url` ansehen. So findet man die kuratierten `gdc`-Layer.
6. **Lotus-Domino-Views testen.** `?ReadViewEntries&OutputFormat=JSON&Count=...`
   funktioniert bei vielen Behörden-Datenbanken; `?OpenView` liefert die Dokument-Links
   für Anhänge.
7. **3D-Viewer-Konfiguration lesen.** Cesium-/Plexgis-Viewer haben
   `/api/v2/viewer/view/<id>/config`; darin steht `tiles_url`, oft `/static/tiles/`.
8. **Formulare ernst nehmen.** Wenn eine App ein Formular mit `street`, `streetnr`,
   `datefrom` hat, ist der Weg zur ICS-Datei meist nur ein Klick – aber ohne CSRF/Token
   kein sauberer API-Endpunkt.
9. **Immer Lizenz und Robots prüfen.** Technisch erreichbar ≠ erlaubt. Die
   Nutzungsbedingungen der Stadt sind eindeutig (siehe Abschnitt 7).

---

## 11. Endpoint-Cheat-Sheet

```bash
# GeoServer: Katalog
curl "https://geoserver.stuttgart.de/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities"

# GeoServer: Layer als GeoJSON (WGS84)
curl "https://geoserver.stuttgart.de/geoserver/ows?service=WFS&version=2.0.0\
&request=GetFeature&typeNames=GEOLINE_FLEX:A53_ALG_KUEHLE_ORTE_EPSG25832\
&count=20&outputFormat=application/json&srsName=EPSG:4326"

# GeoServer: kuratierter Themenzweig
curl "https://geoserver.stuttgart.de/gdc/ows?service=WFS&version=2.0.0&request=GetCapabilities"

# Geocoder
curl "https://gis6.stuttgart.de/locationfinderutm/Finder/Lookup?query=Charlottenplatz&sref=4326"

# KOMUNIS: Kategorien
curl "https://www.domino1.stuttgart.de/web/komunis/komunissde.nsf/annathe20?ReadViewEntries&OutputFormat=JSON&Count=100"

# KOMUNIS: Unterkategorie "Einwohner"
curl "https://www.domino1.stuttgart.de/web/komunis/komunissde.nsf/annathe20?ReadViewEntries&OutputFormat=JSON&Start=3.1&Count=20"

# Beteiligung: alle Projekte
curl "https://stuttgart-meine-stadt.de/api/public/participations"

# Beteiligung: ein Projekt
curl "https://stuttgart-meine-stadt.de/api/public/participations/b0fe1611-e552-4827-99bd-7e407a11318b"

# 3D-Viewer-Konfiguration
curl "https://3d.stuttgart.de/api/v2/viewer/view/9370ae24-2f03-4921-9ad8-4fc0bc79326f/config"

# 3D-Tiles (Lizenz beachten!)
curl "https://3d.stuttgart.de/static/tiles/f3374fec-0eb7-4c39-aaf1-636a64913854_11/tileset.json"

# Masterportal: Stadtplan-Layer
curl "https://maps.stuttgart.de/stadtplan/config.json"

# Masterportal: Alerts
curl "https://maps.stuttgart.de/stadtplan/alerts.json"
```
