# Erweiterungsprogramm: 101 Schnittstellen und 100 Werkzeuge

Stand: 24.10.2026. Dieses Dokument wird aus `server/extras/sources.mjs` und `server/extras/features/registry.mjs` erzeugt.

**Auftrag:** Mindestens 100 öffentliche Schnittstellen, APIs und Datensätze, die vorher nicht eingebaut waren, Schritt für Schritt anbinden. Zusätzlich 100 neue, hochwertige Funktionen entwickeln und ebenfalls Schritt für Schritt einbauen.

## Stand

| Bereich | Anspruch | umgesetzt | offen |
|---|---:|---:|---:|
| Schnittstellen, APIs, Datensätze | mindestens 100 | 101 | 0 |
| Werkzeuge und Funktionen | 100 | 100 | 0 |

### Grundsätze

* Jede Quelle nennt Lizenz, Quellenangabe, Stand und Grenzen.
* Keine Quelle ohne Freigabe; keine Grauzone wird als „Open Data“ ausgegeben.
* Keine Personendaten, keine Bewegungsprofile, keine Werbung.
* Jedes Werkzeug beantwortet eine konkrete Frage und sagt, was es nicht kann.
* Abrufe laufen serverseitig, zwischengespeichert und mit höflichem Abstand.

## 101 Schnittstellen, APIs und Datensätze

Die Nummerierung ist stabil. `live` heißt: Adapter, Cache und API-Route laufen; die Quelle wurde mindestens einmal erfolgreich abgerufen. `geplant` heißt: recherchiert, aber noch nicht angebunden. `key` heißt: frei beantragbarer Schlüssel nötig.

| # | ID | Titel | Typ | Lizenz | Status |
| ---: | --- | --- | --- | --- | --- |
| 1 | ckan-einwohner-altersgruppen | Einwohner nach Altersgruppen und Stadtbezirken | CKAN-Datensatz | CC BY 4.0 | live |
| 2 | ckan-privathaushalte | Privathaushalte nach Personenzahl | CKAN-Datensatz | CC BY 4.0 | live |
| 3 | ckan-familien | Familien mit Kindern nach Stadtbezirken | CKAN-Datensatz | CC BY 4.0 | live |
| 4 | ckan-beschaeftigte | Sozialversicherungspflichtig Beschäftigte am Wohnort | CKAN-Datensatz | CC BY 4.0 | live |
| 5 | ckan-arbeitslos | Arbeitslos Gemeldete nach Stadtbezirken | CKAN-Datensatz | CC BY 4.0 | live |
| 6 | ckan-sgb2 | Sozialgeldempfänger SGB II | CKAN-Datensatz | CC BY 4.0 | live |
| 7 | ckan-einkommen | Steuerpflichtiges Einkommen | CKAN-Datensatz | CC BY 4.0 | live |
| 8 | ckan-einkommensverteilung | Einkommensverteilung | CKAN-Datensatz | CC BY 4.0 | live |
| 9 | ckan-armut | Armut in Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 10 | ckan-kinderbetreuung | Betreuungsquote von Kindern | CKAN-Datensatz | CC BY 4.0 | live |
| 11 | ckan-wohnungen-groesse | Wohnungen nach Wohnungsgröße | CKAN-Datensatz | CC BY 4.0 | live |
| 12 | ckan-wohngebaeude | Wohngebäude, Wohnungen und Wohnfläche | CKAN-Datensatz | CC BY 4.0 | live |
| 13 | ckan-baugenehmigungen | Baugenehmigungen in den Stadtbezirken | CKAN-Datensatz | CC BY 4.0 | live |
| 14 | ckan-energieverbrauch | Energieverbrauch in Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 15 | ckan-treibhausgas | Treibhausgasausstoß | CKAN-Datensatz | CC BY 4.0 | live |
| 16 | ckan-co2 | Kohlendioxid-Emissionen | CKAN-Datensatz | CC BY 4.0 | live |
| 17 | ckan-klima-wetter | Klima- und Wetterdaten | CKAN-Datensatz | CC BY 4.0 | live |
| 18 | ckan-luftqualitaet | Luftqualität in Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 19 | ckan-laermbelastung | Lärmbelastung in Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 20 | ckan-naturschutzflaechen | Naturschutzflächen | CKAN-Datensatz | CC BY 4.0 | live |
| 21 | ckan-flaechennutzung | Flächennutzung in Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 22 | ckan-strassennetz | Straßennetz in Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 23 | ckan-verkehrszaehlungen | Ergebnisse der Verkehrszählungen | CKAN-Datensatz | CC BY 4.0 | live |
| 24 | ckan-unfaelle-schadensart | Unfälle nach Schadensart | CKAN-Datensatz | CC BY 4.0 | live |
| 25 | ckan-strassenverkehrsunfaelle | Straßenverkehrsunfälle | CKAN-Datensatz | CC BY 4.0 | live |
| 26 | ckan-flugziele | Flugziele am Flughafen Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 27 | ckan-luftverkehr | Luftverkehr am Flughafen Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 28 | ckan-wilhelma | Wilhelma-Besucherzahlen | CKAN-Datensatz | CC BY 4.0 | live |
| 29 | ckan-staatstheater | Staatstheater: Aufführungen und Besucher | CKAN-Datensatz | CC BY 4.0 | live |
| 30 | ckan-museen | Museen und Besucherzahlen | CKAN-Datensatz | CC BY 4.0 | live |
| 31 | ckan-sportanlagen | Sportanlagen in Stuttgart | CKAN-Datensatz | CC BY 4.0 | live |
| 32 | ckan-schwimmbaeder | Besucher der Schwimmbäder | CKAN-Datensatz | CC BY 4.0 | live |
| 33 | ckan-aerzte | Ärztliche Versorgung | CKAN-Datensatz | CC BY 4.0 | live |
| 34 | ckan-krankenhaeuser | Krankenhäuser und Betten | CKAN-Datensatz | CC BY 4.0 | live |
| 35 | ckan-pflegebeduerftige | Pflegebedürftige Leistungsempfänger | CKAN-Datensatz | CC BY 4.0 | live |
| 36 | ckan-straftaten | Erfasste Straftaten | CKAN-Datensatz | CC BY 4.0 | live |
| 37 | ckan-schulen | Öffentliche Schulen, Klassen und Schüler | CKAN-Datensatz | CC BY 4.0 | live |
| 38 | ckan-schueler | Schüler an öffentlichen Schulen | CKAN-Datensatz | CC BY 4.0 | live |
| 39 | ckan-studierende | Studierende an Universitäten und Hochschulen | CKAN-Datensatz | CC BY 4.0 | live |
| 40 | ckan-wahlergebnisse | Wahlergebnisse und Sitzverteilungen | CKAN-Datensatz | CC BY 4.0 | live |
| 41 | ckan-kulturausgaben | Kulturausgaben und Kulturerträge | CKAN-Datensatz | CC BY 4.0 | live |
| 42 | wfs-aussichtspunkte | Aussichtspunkte in Stuttgart | WFS-Layer | CC BY 4.0 | live |
| 43 | wfs-innenstadtrundweg | Innenstadtrundweg: Stationen | WFS-Layer | CC BY 4.0 | live |
| 44 | wfs-trauungsorte | Heirats-Wunschorte | WFS-Layer | CC BY 4.0 | live |
| 45 | wfs-engagement-orte | Engagement-Orte | WFS-Layer | CC BY 4.0 | live |
| 46 | wfs-mobilfunk | Mobilfunkstandorte | WFS-Layer | CC BY 4.0 | live |
| 47 | lubw-naturpark | Naturpark Stuttgart | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 48 | lubw-naturschutzgebiet | Naturschutzgebiete | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 49 | lubw-landschaftsschutzgebiet | Landschaftsschutzgebiete | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 50 | lubw-ffh | Natura-2000-FFH-Gebiete | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 51 | lubw-vogelschutz | Natura-2000-Vogelschutzgebiete | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 52 | lubw-wasserschutzgebiet | Wasserschutzgebiete | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 53 | lubw-ueberschwemmungsgebiet | Überschwemmungsgebiete | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 54 | lubw-umweltzone | Umweltzone Baden-Württemberg | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 55 | lubw-naturdenkmal | Naturdenkmäler (flächenhaft) | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 56 | lubw-biotopkartierung | Biotopkartierung | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 57 | lubw-streuobst | Streuobst-Bestand | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 58 | lubw-globalstrahlung | Globalstrahlung | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 59 | lubw-windkraft | Windkraft-Bestand | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 60 | lubw-wasserkraft | Wasserkraft-Bestand | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 61 | lubw-artenfunde | Artenfunde Baden-Württemberg | LUBW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 62 | lgl-landnutzung | ATKIS Landnutzung | LGL-BW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 63 | lgl-vegetation | ATKIS Vegetationsflächen | LGL-BW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 64 | lgl-siedlung | ATKIS Siedlungsflächen | LGL-BW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 65 | lgl-verkehr | ATKIS Verkehrsflächen | LGL-BW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 66 | lgl-besondere-flaeche | ATKIS Besondere Flächen | LGL-BW-WFS | Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0) | live |
| 67 | api-emsc-erdbeben | EMSC-Erdbeben (FDSN) | Erdbebendienst | CC BY 4.0 | live |
| 68 | api-usgs-erdbeben | USGS-Erdbeben | Erdbebendienst | USGS Open Data (public domain) | live |
| 69 | api-open-meteo-archiv | Open-Meteo Archiv | Klimaarchiv | CC BY 4.0 | live |
| 70 | api-open-meteo-hochwasser | Open-Meteo Hochwasser | Hochwassermodell | CC BY 4.0 | live |
| 71 | api-open-meteo-luft | Open-Meteo Luftqualität | Luftqualitätsprognose | CC BY 4.0 | live |
| 72 | api-open-meteo-klima | Open-Meteo Klimaprojektion | Klimaprojektion | CC BY 4.0 | live |
| 73 | api-met-no | MET Norway Locationforecast | Wettervorhersage | CC BY 4.0 / NLOD | live |
| 74 | api-rainviewer | RainViewer-Radar | Radar | RainViewer-Nutzungsbedingungen | live |
| 75 | api-transitous | Transitous/MOTIS-Routing | Multimodales Routing | MIT / OpenStreetMap ODbL, GTFS-Quellen | live |
| 76 | api-celestrak | CelesTrak TLE | Satellitenbahnen | CelesTrak-Nutzungsbedingungen (frei) | live |
| 77 | api-nasa-gibs | NASA GIBS Satellitenbilder | Satellitenbilder | NASA Open Data | live |
| 78 | api-nasa-eonet | NASA EONET Naturereignisse | Naturereignisse | NASA Open Data | live |
| 79 | api-gdacs | GDACS Warnungen | Katastrophenwarnungen | GDACS-Nutzungsbedingungen | live |
| 80 | api-smard-strom | SMARD Strommarktdaten | Strommarktdaten | CC BY 4.0 | live |
| 81 | api-opensky | OpenSky Network Flugdaten | Flugverkehr | OpenSky-Nutzungsbedingungen (Open Data) | live |
| 82 | api-commons-geosuche | Wikimedia Commons Geosuche | Bildarchiv | CC-BY/CC0 je Datei, ODbL für Geodaten | live |
| 83 | api-wikipedia-geosuche | Wikipedia Geosuche | Lexikon | CC BY-SA 4.0 | live |
| 84 | api-wikipedia-pageviews | Wikipedia Seitenaufrufe | Aufmerksamkeitsdaten | CC0 1.0 | live |
| 85 | api-wikidata-kunst | Wikidata: Kunst im öffentlichen Raum | Wissensgraph | CC0 1.0 | live |
| 86 | api-openlibrary | Open Library | Bibliothekskatalog | Open Library Data (CC0) | live |
| 87 | api-internet-archive | Internet Archive | Digitalarchiv | Je Objekt; Metadaten offen | live |
| 88 | api-tagesschau | Tagesschau-Nachrichten | Nachrichten | Quellenangabe tagesschau.de | live |
| 89 | api-abgeordnetenwatch | Abgeordnetenwatch | Parlamentsdaten | CC BY-SA 4.0 | live |
| 90 | api-data-europa | data.europa.eu | Datenkatalog | CC BY 4.0 (Metadaten) | live |
| 91 | api-feiertage | Feiertage Baden-Württemberg | Kalender | Freie Nutzung, Quellenangabe | live |
| 92 | api-photon | Photon Geocoder | Geocoder | ODbL (OpenStreetMap) | live |
| 93 | api-overpass | OpenStreetMap Overpass | OpenStreetMap | ODbL | live |
| 94 | api-dipul | DIPUL Drohnen-Geozonen | Drohnen-Geodaten | CC BY-ND 4.0 | live |
| 95 | api-pvgis | PVGIS Solarertrag | Solarrechner | EUPL / JRC Open Data | live |
| 96 | api-catalogue-of-life | Catalogue of Life | Taxonomie | CC BY 4.0 | live |
| 97 | api-sunrise-sunset | Sunrise-Sunset | Astronomie | CC BY 4.0 | live |
| 98 | api-jpl-horizons | JPL Horizons | Ephemeriden | NASA Open Data | live |
| 99 | api-crossref | Crossref | Forschungsdaten | CC0 (Metadaten) | live |
| 100 | api-openalex | OpenAlex | Forschungsdaten | CC0 1.0 | live |
| 101 | api-wikivoyage | Wikivoyage Ortsartikel | Reiseführer | CC BY-SA 4.0 | live |

## 100 Werkzeuge und Funktionen

Jedes Werkzeug hat eine feste Nummer, eine Kategorie und definierte Eingaben. Die Spalte „Eingaben“ nennt die Pflichtfelder; optionale Felder stehen in der Oberfläche.

| # | ID | Titel | Kategorie | Eingaben | Status |
| ---: | --- | --- | --- | --- | --- |
| 1 | kiez-steckbrief | Kiez-Steckbrief | Mein Kiez | bezirk | live |
| 2 | kiez-zeitreise | Kiez-Zeitreise | Mein Kiez | bezirk, indikator | live |
| 3 | kiez-vergleich | Kiez-Vergleich | Mein Kiez | bezirk, bezirk2 | live |
| 4 | kiez-ranking | Kiez-Ranking | Mein Kiez | indikator | live |
| 5 | adress-zeugnis | Adress-Zeugnis | Mein Kiez | – | live |
| 6 | wohnlage-check | Wohnlage & Miete | Mein Kiez | – | live |
| 7 | familien-check | Familien-Check | Mein Kiez | – | live |
| 8 | senioren-check | Senioren-Check | Mein Kiez | – | live |
| 9 | auto-check | Auto-Check | Mein Kiez | – | live |
| 10 | barriere-check | Barriere-Check | Mein Kiez | – | live |
| 11 | isochron-15 | 15-Minuten-Radius | Unterwegs | modus | live |
| 12 | letzte-verbindung | Letzte Verbindung | Unterwegs | – | live |
| 13 | anschluss-risiko | Anschluss-Risiko | Unterwegs | ankunft | live |
| 14 | baustellen-route | Baustellen auf der Route | Unterwegs | von, nach | live |
| 15 | unfall-route | Unfallschwerpunkte auf der Route | Unterwegs | von, nach | live |
| 16 | steigungs-profil | Steigungsprofil | Unterwegs | nach | live |
| 17 | parkdruck | Parkdruck am Ziel | Unterwegs | – | live |
| 18 | tank-optimierer | Günstigste Tankstelle | Unterwegs | – | live |
| 19 | lade-optimierer | Laden mit Grünstrom | Unterwegs | – | live |
| 20 | flug-analyse | Flug über mir | Unterwegs | – | live |
| 21 | regen-ankunft | Wann kommt der Regen? | Umwelt & Gesundheit | – | live |
| 22 | luft-verlauf | Luftqualität im Verlauf | Umwelt & Gesundheit | – | live |
| 23 | pollen-risiko | Pollenrisiko heute | Umwelt & Gesundheit | – | live |
| 24 | gewitter-radar | Gewitter im Anmarsch | Umwelt & Gesundheit | – | live |
| 25 | erdbeben-check | Erdbeben in der Region | Umwelt & Gesundheit | – | live |
| 26 | waldbrand-check | Waldbrandgefahr | Umwelt & Gesundheit | – | live |
| 27 | neckar-pegel | Neckarpegel & Trend | Umwelt & Gesundheit | – | live |
| 28 | trinkwasser-check | Trinkwasser & Brunnen | Umwelt & Gesundheit | – | live |
| 29 | hitze-check | Hitze-Check | Umwelt & Gesundheit | – | live |
| 30 | naturschutz-check | Schutzgebiet am Ort | Umwelt & Gesundheit | – | live |
| 31 | abend-planer | Abendplaner | Freizeit | – | live |
| 32 | wochenend-planer | Wochenendplaner | Freizeit | – | live |
| 33 | aussicht-finder | Aussichtsfinder | Freizeit | – | live |
| 34 | wander-rundweg | Rundwanderung mit Bahn | Freizeit | – | live |
| 35 | radtour-planer | Radtour mit Rückweg | Freizeit | nach | live |
| 36 | picknick-finder | Picknickplatz | Freizeit | – | live |
| 37 | spielplatz-finder | Spielplatz mit Schatten | Freizeit | – | live |
| 38 | museum-regen | Museum bei Regen | Freizeit | – | live |
| 39 | sport-im-park | Sport im Park heute | Freizeit | – | live |
| 40 | grillplatz-check | Grillplatz-Check | Freizeit | – | live |
| 41 | bibliothek-suche | Bibliothekssuche | Wissen & Bildung | q | live |
| 42 | wissens-luecken | Wissenslücken | Wissen & Bildung | – | live |
| 43 | historische-bilder | Historische Bilder | Wissen & Bildung | – | live |
| 44 | stadtarchiv-quellen | Quellen zur Straße | Wissen & Bildung | q | live |
| 45 | strassen-geschichte | Straßenname erklärt | Wissen & Bildung | q | live |
| 46 | denkmal-erklaerer | Denkmal erklärt | Wissen & Bildung | – | live |
| 47 | baum-arten | Baumarten vor Ort | Wissen & Bildung | – | live |
| 48 | sternenhimmel | Sternenhimmel heute | Wissen & Bildung | – | live |
| 49 | satelliten-ueberflug | ISS-Überflug | Wissen & Bildung | – | live |
| 50 | stadtteil-erklaert | Stadtteil in Zahlen erklärt | Wissen & Bildung | bezirk | live |
| 51 | amt-finder | Zuständiges Amt | Verwaltung & Alltag | q | live |
| 52 | fristen-rechner | Fristen-Rechner | Verwaltung & Alltag | start, art | live |
| 53 | gebuehren-rechner | Gebühren-Rechner | Verwaltung & Alltag | leistung | live |
| 54 | dokumenten-checkliste | Dokumenten-Checkliste | Verwaltung & Alltag | q | live |
| 55 | termin-optimierer | Bester Termin | Verwaltung & Alltag | – | live |
| 56 | ummelde-helfer | Ummelde-Helfer | Verwaltung & Alltag | – | live |
| 57 | abfall-kalender | Abfuhrkalender | Verwaltung & Alltag | strasse, nr | live |
| 58 | sperrmuell-check | Sperrmüll & Sonderabfall | Verwaltung & Alltag | – | live |
| 59 | foerder-finder | Förderungen | Verwaltung & Alltag | – | live |
| 60 | schulweg-check | Sicherer Schulweg | Verwaltung & Alltag | – | live |
| 61 | notfall-karte | Notfallkarte | Sicherheit & Notfall | – | live |
| 62 | apotheken-notdienst | Apotheken-Notdienst | Sicherheit & Notfall | – | live |
| 63 | warnlage | Warnlage | Sicherheit & Notfall | – | live |
| 64 | hochwasser-route | Hochwasser-Route | Sicherheit & Notfall | von, nach | live |
| 65 | stromausfall-check | Stromausfall | Sicherheit & Notfall | – | live |
| 66 | gas-notfall | Gas-Notfall | Sicherheit & Notfall | – | live |
| 67 | erste-hilfe | Erste Hilfe | Sicherheit & Notfall | – | live |
| 68 | defi-check | Defibrillator in der Nähe | Sicherheit & Notfall | – | live |
| 69 | feuerwehr-check | Feuerwehr & Brandschutz | Sicherheit & Notfall | – | live |
| 70 | polizei-check | Polizei & Sicherheit | Sicherheit & Notfall | – | live |
| 71 | quellen-check | Quellen-Check | Daten & Transparenz | quelle | live |
| 72 | datensatz-explorer | Datensatz-Explorer | Daten & Transparenz | – | live |
| 73 | stadt-vergleich | Stadt im Vergleich | Daten & Transparenz | – | live |
| 74 | haushalt-transparenz | Haushalt & Ausgaben | Daten & Transparenz | – | live |
| 75 | ifg-radar | IFG-Radar | Daten & Transparenz | – | live |
| 76 | katalog-neu | Neue Datensätze | Daten & Transparenz | – | live |
| 77 | lizenz-finder | Lizenz-Finder | Daten & Transparenz | q | live |
| 78 | datenqualitaet | Datenqualität vor Ort | Daten & Transparenz | – | live |
| 79 | open-data-export | Open-Data-Export | Daten & Transparenz | q | live |
| 80 | aenderungs-feed | Änderungs-Feed | Daten & Transparenz | – | live |
| 81 | vorlesen | Vorlesen | Teilen & Zugang | text | live |
| 82 | leichte-sprache | Leichte Sprache | Teilen & Zugang | text | live |
| 83 | qr-schild | QR-Schild | Teilen & Zugang | – | live |
| 84 | kiosk-builder | Kiosk-Builder | Teilen & Zugang | – | live |
| 85 | embed-widget | Embed-Widget | Teilen & Zugang | url | live |
| 86 | rss-builder | RSS-Builder | Teilen & Zugang | q | live |
| 87 | ical-builder | iCal-Builder | Teilen & Zugang | q | live |
| 88 | webhook-builder | Webhook & ntfy | Teilen & Zugang | q | live |
| 89 | social-post | Social-Post | Teilen & Zugang | q | live |
| 90 | barrierefreie-route | Barrierefreie Route | Teilen & Zugang | von, nach | live |
| 91 | stadt-quiz | Stadt-Quiz | Spiel & Community | bezirk | live |
| 92 | schnitzeljagd-builder | Schnitzeljagd | Spiel & Community | – | live |
| 93 | foto-rallye | Foto-Rallye | Spiel & Community | – | live |
| 94 | giess-pate | Gieß-Pate | Spiel & Community | – | live |
| 95 | nachbarschafts-tipp | Nachbarschaftstipp | Spiel & Community | – | live |
| 96 | strassen-ranking | Unfallschwerpunkte | Daten & Transparenz | – | live |
| 97 | kessel-wetter | Kessel-Wetter | Spiel & Community | – | live |
| 98 | zeitkapsel | Zeitkapsel | Spiel & Community | – | live |
| 99 | geheimnisorte | Geheimnisorte | Spiel & Community | – | live |
| 100 | mein-stuttgart | Mein Stuttgart | Spiel & Community | bezirk | live |

## Kategorien und Fortschritt

| Kategorie | Werkzeuge | umgesetzt |
|---|---:|---:|
| Mein Kiez | 10 | 10 |
| Unterwegs | 10 | 10 |
| Umwelt & Gesundheit | 10 | 10 |
| Freizeit | 10 | 10 |
| Wissen & Bildung | 10 | 10 |
| Verwaltung & Alltag | 10 | 10 |
| Sicherheit & Notfall | 10 | 10 |
| Daten & Transparenz | 11 | 11 |
| Teilen & Zugang | 10 | 10 |
| Spiel & Community | 9 | 9 |

## Technik

* Quellenregister: `server/extras/sources.mjs` – 101 Einträge, je mit Adapter und Konfiguration.
* Adapter: `server/extras/adapters.mjs` – CKAN-CSV, WFS, LGL-WFS, LUBW/ArcGIS, JSON, Text/XML, Overpass.
* Normalisierer: `server/extras/normalizers.mjs` – externe Antworten werden auf eine gemeinsame Form gebracht.
* Werkzeuge: `server/extras/features/*.mjs` – je Kategorie ein Modul; das Register steht in `server/extras/features/registry.mjs`.
* API: `/api/labor`, `/api/labor/quellen`, `/api/labor/quelle?id=…`, `/api/labor/werkzeuge`, `/api/labor/werkzeug?id=…`.
* Oberfläche: Modul „Stadtlabor“ (`src/modules/labor/LaborPanel.tsx`).
* Prüfung: `npm run check:extras` (Struktur) und `npm run check:extras -- --live` (alle Quellen) bzw. `-- --live-features` (alle Werkzeuge).
* Dokumentation neu erzeugen: `npm run docs:extras`.

## Offene Punkte

Alle Quellen sind angebunden.

Alle 100 Werkzeuge sind gebaut.
