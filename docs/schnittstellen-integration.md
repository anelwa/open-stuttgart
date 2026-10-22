# Schnittstellen im weiten Sinn: Umsetzungsstand

Stand: 22.10.2026. Dieses Dokument ist die Brücke zwischen den beiden Recherchen
[`api-recherche-2026-10-tiefensuche.md`](api-recherche-2026-10-tiefensuche.md) und
[`schnittstellen-im-weiten-sinn.md`](schnittstellen-im-weiten-sinn.md) und dem, was in der
Anwendung tatsächlich läuft.

Leitsatz: **Alles ist auffindbar und bewertet; live angebunden wird nur, was ohne Key,
ohne Login und ohne Rechtsverstoß funktioniert.** Wo eine Quelle eine Freigabe, einen Key
oder einen offiziellen Endpunkt braucht, steht das hier und in der App.

## Wo das in der App steckt

| Ort | Inhalt |
| --- | --- |
| **Stadtwissen** (Schnellaktion und „Alle Themen“) | Fünf Reiter: Karte, Zahlen, Transparenz, Fundstücke, Ausgabe |
| **Karte → Stadt-Layer** | Katalog aller 458 WFS-Layer, Suche, Workspace-Filter, Freigabestatus; 77 Layer direkt ladbar |
| **Karte → Adresse finden** | amtlicher gis6-Geocoder; zugleich Rückgrat der Adresssuche in „In der Nähe“ und „Meine Adresse“ |
| **Zahlen → Kiez in Zahlen** | KOMUNIS-Navigation, Tabellen, direkte XLSX-Anhänge |
| **Transparenz → IFG-Anfragen** | FragDenStaat, 285 Anfragen, Status und Link; dazu Haushalt/OParl/Gelbe Karte |
| **Fundstücke** | Fairteiler (foodsharing), Artenfunde (GBIF), OSM-Hinweise, Wikidata-Lücken, K10plus-Bibliothek |
| **Ausgabe** | GeoJSON/RSS/iCal/CSV, permanenter Link, QR-Schild, OSM-Meldung, Kiosk, TTS, Standards-Matrix |
| **`?display=kiosk`** | großer Bildschirm für Bürgerbüros/Bibliotheken, rotierende Karten |
| **`?o=…`** | permanente Objektlinks (Haltestelle, Parkhaus, Baustelle, Ort, Stadt-Layer, …) |

## 1. Offene Standards

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| Open311 / Gelbe Karte | **Verweis** | Kein offener Endpunkt. Link zur Gelben Karte in „Transparenz“; eine Anfrage an die Stadt bleibt der nächste Schritt. |
| DCAT-AP / GovData | **live** | `/api/stadt/katalog` liest GovData (CKAN), zeigt neue Datensätze als Änderungsfeed und verlinkt sie. |
| CAP | **live (mittelbar)** | Warnungen kommen über NINA/MoWaS bereits mit Polygon, Schwere und Zeitraum auf die Karte. |
| SensorThings / NGSI-LD | **offen** | Kein Stuttgarter Endpunkt bekannt. In der Standards-Matrix dokumentiert, keine eigenen Sensorformate. |

## 2. Physische Schnittstellen

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| QR-/NFC-Tags | **live (QR)** | „Schild mit QR-Code drucken“ erzeugt lokal ein DIN-A6-Schild mit Deep Link. NFC ist nicht nötig, weil jeder QR-Link ein normaler HTTPS-Link ist. |
| Kiosk-/Public-Display-Modus | **live** | `?display=kiosk`: Wetter, Bürgerbüro-Wartezeiten, Termine und Parken rotieren alle 12 Sekunden, ohne Bedienelemente. |

## 3. Zugänglichkeit

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| TTS / Vorlesen | **live** | `SpeakButton` über die Web Speech API: in StuttBot-Antworten, in Stadt-Layer-Details und in „Ausgabe“. Keine Cloud, kein Server. |
| Leichte Sprache | **vorhanden** | Eigene Seite in der App („Über diese Anwendung → Leichte Sprache“); keine neue API nötig. |
| IVR / Sprachassistent | **offen** | Eigene Infrastruktur; die JSON-Endpunkte sind dafür vorbereitet. |

## 4. Transparenz

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| FragDenStaat | **live** | `/api/stadt/fragdenstaat`, Liste mit Status und Link, dazu `/api/stadt/fragdenstaat.rss`. |
| Offener Haushalt | **Verweis** | Keine kommunale Maschinenschnittstelle gefunden; Links zu offenerhaushalt.de und transparenz-bw.de. |
| OParl / ALLRIS | **Verweis** | Vorbereitung in `docs/anfrage-allris-oparl.md`; Link zu OParl. |
| Beteiligungsportal | **Verweis** | `stuttgart-meine-stadt.de` sperrt `/api/` in robots.txt. Die App verlinkt das Portal, fragt die API aber bewusst nicht automatisch ab. |
| Gelbe Karte | **Verweis** | siehe Open311. |

## 5. Wissensgraphen

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| Wikidata SPARQL | **live** | „Was fehlt im Netz?“ fragt Orte in Stuttgart mit Koordinate und ohne Wikipedia-Artikel ab (Limit 100, 24 h Cache). |
| GND / SRU | **Verweis** | Der DNB-SRU antwortet derzeit mit „General System Error“. Die GND bleibt als Normdaten-Verweis dokumentiert; K10plus deckt den Bibliotheksfall live ab. |
| DDB / Europeana | **Key nötig** | Beide Suchen verlangen einen Key. In der Standards-Matrix als „Key nötig“ markiert; kein stiller Fallback. |

## 6. Archiv und Bild

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| IIIF | **Verweis** | Der Standard ist dokumentiert; freie Stuttgarter Manifeste sind nicht bekannt. Ein Viewer ohne Quelle wäre eine leere Hülle. |
| SRU / OAI-PMH | **live (SRU)** | K10plus-Suche in „Fundstücke“; OAI-PMH bleibt als Archiv-Standard dokumentiert. |

## 7. Bürger-Wissenschaft

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| OSM Notes | **live (lesen) + Verweis (schreiben)** | Offene Hinweise im Umkreis werden als Liste und Karte gezeigt. „Neuen Hinweis schreiben“ öffnet den offiziellen OSM-Editor; Schreiben braucht ein OSM-Konto. |
| Foodsharing | **live** | 12 öffentliche Fairteiler mit Koordinaten; keine Körbe/Statusdaten ohne Login. |
| GBIF | **live** | Artenfunde im 2,5-km-Umkreis, mit Dataset-Link und Lizenz. |

## 8. Ausgabe-Schnittstellen

| Fund | Status | Umsetzung / Grund |
| --- | --- | --- |
| RSS / iCal / GeoJSON | **live** | WFS-Layer als GeoJSON und RSS, „Was geht“ als iCal, Stadtgedächtnis und FragDenStaat als RSS, Archiv als CSV. |
| Permanente URLs | **live (Kernobjekte)** | `?o=…` für Haltestelle, Parkhaus, Baustelle, Ort, Stadt-Layer, Luft, Sharing, Pegel, Termin, Einrichtung und Verwaltung. Der Teilen-Knopf sitzt in jeder Detailansicht. |
| Web Push / ntfy | **offen** | Kein Kanal eingerichtet; in der Standards-Matrix als offen markiert. |
| ActivityPub / Fediverse | **offen** | Kein Bot-Konto eingerichtet; als offen markiert. |

## 9. Bewusst nicht integriert

* **3D-Tiles von `3d.stuttgart.de`:** ausdrücklich nicht Open Data. Nur Deep-Link zum amtlichen Viewer.
* **WFS-Layer ohne Freigabe:** im Katalog sichtbar, aber nicht ladbar. Die App zeigt „Freigabe nötig“ statt einer Grauzone.
* **Foodsharing-Körbe/-Status:** 401 ohne Login, daher nicht verwendet.
* **Beteiligungs-API:** robots.txt sperrt `/api/`; daher nur Verweis.
* **Scraping hinter Logins/ToS:** nicht Teil des Projekts.

## 10. Technische Bausteine

| Datei | Aufgabe |
| --- | --- |
| `server/sources/schnittstellen.mjs` | WFS-Katalog und -Proxy, gis6, KOMUNIS, FragDenStaat, Foodsharing, GBIF, OSM Notes, Wikidata, K10plus, GovData |
| `server/index.mjs` | Routen `/api/stadt/*`, RSS-Ausgaben |
| `src/modules/schnittstellen/SchnittstellenPanel.tsx` | fünf Reiter der Oberfläche |
| `src/components/WissenDetail.tsx` | Detailansicht für WFS-/GBIF-/Fairteiler-Objekte, permanenter Link |
| `src/components/Kiosk.tsx` | Kiosk-Profil |
| `src/components/PrintSign.tsx` | QR-Schild und Druckansicht |
| `src/components/SpeakButton.tsx` | Vorlesen über Web Speech API |
| `src/styles/schnittstellen.css` | Stadtwissen, Kiosk, Schild, Teilen |

## 11. Offene Punkte mit klarer Zuständigkeit

1. **Freigabe der WFS-Layer** beim Stadtmessungsamt klären; danach können weitere der 458 Layer ohne Codeänderung freigeschaltet werden (`OPEN_PREFIXES`).
2. **Open311 / Gelbe Karte** bei der Stadt anfragen; der Client ist vorbereitet.
3. **Beteiligungs-API** schriftlich freigeben lassen; dann 99 Projekte live anbinden.
4. **DDB/Europeana-Keys** besorgen; die UI kann die Objekte dann im Stadtgedächtnis ergänzen.
5. **IIIF-Manifeste** aus dem Stadtarchiv benennen; der Viewer kann als externe Einbettung folgen.
6. **Web Push/ntfy** und **ActivityPub** erst nach Betriebsentscheidung, weil sie Zustellung und Moderation brauchen.

## 12. Prüfliste

* [x] Jede Quelle ist ohne Key/Login erreichbar oder als „Key nötig“ markiert.
* [x] Jede Quelle nennt Lizenz und Attribution in der App.
* [x] Keine automatischen Abrufe gegen robots.txt.
* [x] Server-Cache und höfliche Abstände für alle neuen Hosts.
* [x] Kein Personenbezug, keine Chat-/Anfrageinhalte werden gespeichert.
* [x] Alle neuen Seiten funktionieren auch ohne die optionalen Quellen.
