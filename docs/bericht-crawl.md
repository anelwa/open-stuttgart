# stuttgart.de vollständig erfasst: Verwaltung als Netz

Stand: 20.10.2026. Abruf 13:10 bis 15:40 Uhr (MESZ: 15:10 bis 17:40). Datensatz: `daten/`, Aufbau: `SCHEMA.md`, Nutzung in der Demo: [`docs/spezifikation-ebene-verwaltung.md`](./spezifikation-ebene-verwaltung.md).

## 1. Ergebnis in Zahlen

| Bestand | Anzahl |
|---|---|
| Deutschsprachige Seiten in den 92 Sitemaps | 13 201 |
| davon abgerufen | 9 266, dazu 377 verlinkte Seiten außerhalb der Sitemaps; 9 629 erfolgreich |
| Verwaltungsleistungen | 407 (384 aus den Sitemaps, 23 nur über Links erreichbar), 286 mit LeiKa-Schlüssel |
| Verwaltungseinheiten (Ämter, Abteilungen, Dienststellen) | 1 477 |
| Adressen (Einrichtungen, Schulen, Vereine, Bürgerhäuser, Kunstwerke) | 3 646 |
| Gremien, Beteiligungsunternehmen, nichtstädtische Behörden | 209, 37, 6 |
| Gebäude (eindeutige Anschriften) | 2 845, davon 2 774 mit Koordinate (2 608 aus den Seiten der Stadt, 166 über Nominatim) |
| Einheiten mit Öffnungszeiten | 1 366 |
| Verknüpfungen Leistung ↔ Einheit | 2 984 (381 zuständig, 1 755 angeboten in, 848 verlinkt) |
| Online-Angebote | 17 Terminbuchungen, 36 Online-Dienste der Stadt, 5 Online-Anträge des Landes, 17 Bundesdienste, 159 Leistungsbeschreibungen auf service-bw, 438 PDF-Formulare, 1 Live-Wartezeit |
| Links im Hauptbereich aller Seiten | 167 098 |
| Wartezeit-Tafeln der Bürgerbüros, einem Gebäude zugeordnet | 19 von 19 |

Von den 407 Leistungen verlinken 132 eine Terminbuchung, 78 einen Online-Dienst der Stadt, 11 einen Online-Antrag des Landes und 12 einen Bundesdienst. 232 Leistungen sind im CMS als „digitaler Dienst“ markiert; was diese Markierung genau bedeutet, ist nicht dokumentiert, deshalb nutzt der Datensatz für „online möglich“ nur die tatsächlich verlinkten Online-Dienste.

## 2. Was die Seiten hergeben

Der wichtigste Befund: Jede Seite von `stuttgart.de` trägt im Kopf ein maschinenlesbares JSON-Objekt des CMS (Sitepark, Modul „citygov“). Darin stehen CMS-ID, Objekttyp, Änderungsdatum, Koordinate in WGS 84, der Pfad im Organigramm als ID-Liste, bei Leistungen der LeiKa-Schlüssel und die zuständige Organisation, bei Einheiten Organisationszeichen, Telefon, E-Mail und Anschrift. Die Inhalte der Leistungsseiten sind in feste Abschnitte gegliedert (Voraussetzungen, Unterlagen, Ablauf, Gebühren, Bearbeitungsdauer, Formulare, Termin, Rechtsgrundlage). Damit war kein Raten aus Fließtext nötig.

Weitere Befunde:

- **Brücke zur Wartezeit-Ampel:** Die Einheiten tragen eine Fachverfahrens-ID (`ibs.dept.101268`). Diese Nummer ist identisch mit `department` in der Ampel `wartezeiten.stuttgart.de/bb/status`. Alle 19 Tafeln sind damit eindeutig einem Bürgerbüro und seinem Gebäude zugeordnet.
- **Bedeutung der Ampelwerte** (aus dem Frontend-Skript der Ampel): `0` = außerhalb der Öffnungszeiten, `1` bis `10` = ca. 15 Minuten je Stufe, `11` = alle Wartemarken vergeben. Am Dienstagnachmittag standen 18 von 19 Büros auf `10`; nachmittags gilt dort „nur mit Termin“. Ob `10` das ausdrückt oder eine echte Wartezeit von 150 Minuten oder mehr, ist offen.
- **Sitemaps sind unvollständig:** 377 Seiten des Organigramms werden verlinkt, stehen aber in keiner Sitemap, darunter 23 Leistungen und ausgerechnet das Bürgerbüro Mitte. Ein reiner Sitemap-Crawl hätte sie übersehen.
- **Terminbuchung:** 15 Kalender bei `stuttgart.konsentas.de` (Formularnummern 5 bis 77) und der Traukalender. Der Kalender der Bürgerbüros (`form/29`) hängt an allen Bürgerbüro-Leistungen.
- **Online-Dienste der Stadt** liegen unter `service.stuttgart.de/lhs-services/…` (Bewohnerparken, Sperrmüll, Diesel-Ausnahmen, Kita-Vormerkung, Störungsmelder, Sondernutzungen u. a.).
- **Zuständigkeit:** Bei 381 von 407 Leistungen ist die zuständige Einheit bekannt (teils über die Dachzeile, wenn die im CMS hinterlegte Organisation nicht veröffentlicht ist). Das CMS nennt bei Pass- und Ausweisleistungen ein einzelnes Bürgerbüro als „Organisation“ (z. B. Bürgerbüro Ost); tatsächlich bieten alle Bürgerbüros die Leistung an. Für die Karte zählt deshalb die Rolle „angeboten in“.
- **Gebäude mit den meisten Einheiten:** Rathaus Marktplatz 1 (135), Eberhardstraße 33 (57), Eichstraße 7 (52), Schloßstraße 91 (45).
- **Keine Änderungssignale:** Die Sitemaps haben kein `lastmod`, die Seiten keine `ETag`/`Last-Modified`. Änderungen lassen sich nur über das `changed`-Feld im Seitenkopf erkennen, also nach dem Abruf.
- **Antwortzeit:** Der Server braucht 1,7 bis 2,2 Sekunden je Seite (Erzeugung, kein Cache). Ein Strang schafft rund 30 Seiten pro Minute.

## 3. Vorgehen und Rücksicht

- `robots.txt` erlaubt alles außer einzelnen Medienpfaden und `/kategorien/branchen/`; kein Crawl-Delay.
- Direkter Abruf mit eigenem User-Agent (`OpenStuttgart-Crawler/0.1 (…; github.com/anelwa)`), gzip, Cache, Wiederaufnahme. Zwei Stränge, je eine Anfrage zur Zeit und mindestens eine Sekunde Abstand; durch die Antwortzeit des Servers waren es im Mittel rund 1 Seite pro Sekunde insgesamt. Keine Fehlerhäufung, kein 429.
- Jina Reader war nicht nötig, weil der direkte Abruf funktioniert.
- Nominatim nur für 237 Anschriften ohne Koordinate, 1 Anfrage pro 1,1 Sekunden.
- **Datenschutz:** Die 1 710 Personenseiten wurden nicht abgerufen. Kontaktkanäle mit Personennamen in der Bezeichnung („Frau …“, „Herr …“, „Vorstand: …“) sind aus Einheiten-Tabelle und Exporten entfernt. In `seiten.text` der Rohdaten und in `links` können Namen in Fließtext und Linktexten noch vorkommen; vor einer Veröffentlichung des Datensatzes sollten diese beiden Tabellen gefiltert oder weggelassen werden.
- Die Inhalte stehen nicht unter einer offenen Lizenz. Grundlage ist die schriftliche Bestätigung der Stadt, die der Projektleitung vorliegt. Der Datensatz ist für die Demo und den Assistenten gedacht, nicht zur Weitergabe als Open Data.

## 4. Grenzen

- 71 Anschriften ohne Koordinate (meist Postfächer, Orte ohne Hausnummer oder Adressen außerhalb Stuttgarts), Liste in `daten/gebaeude-ohne-koordinate.txt`.
- Gleiche Gebäude mit unterschiedlicher Schreibweise der Hausnummer („24/26“ und „24“) bleiben getrennt.
- Kategorien des CMS sind nur als IDs gespeichert; die Namen stehen nicht im Seitenkopf.
- Die Rolle „verweis“ ist schwach: Eine Leistungsseite verlinkt oft eine Einheit nur zur Erläuterung.
- Linktexte der Terminbuchung lauten oft „hier“ oder „Online-Termin“; die Bezeichnung des Kalenders ergibt sich aus der Einheit, die ihn verlinkt.
- Die Wartezeiten im Datensatz sind eine Momentaufnahme (20.10.2026, 15:39 UTC). Live bleibt die Ampel die Quelle.

## 5. Empfehlungen

1. **Sofort:** `daten/verwaltung-dock.json` in die vorhandene Andockstelle der Demo legen (`server/data/verwaltung.json` oder `OS_VERWALTUNG`). Das Format entspricht [`docs/verwaltung-datensatz.md`](./verwaltung-datensatz.md).
2. **Ebene „Verwaltung“** nach der Spezifikation bauen: ein Punkt je Gebäude, Live-Ring für Bürgerbüros, Panel mit „Termin buchen“ und „Online erledigen“.
3. **Assistent:** Leistungen abschnittsweise indizieren (SQLite FTS5 genügt), Werkzeuge `suche_leistung`, `leistung`, `wo_erledigen`, `einheit`, `wartezeit`; Gebühren und Unterlagen nur aus den Daten.
4. **Bei der Stadt anfragen:** Export der `citygov`/IBS-Daten (Organisationen, Leistungen, Öffnungszeiten) statt Crawl; Bedeutung der Ampelstufe 10; Liste der Online-Dienste auf `service.stuttgart.de` mit Zuordnung zur Leistung; Sitemaps um die fehlenden Organigramm-Seiten ergänzen.
5. **Aktualisierung:** Leistungs- und Einheitenseiten wöchentlich, Adressen monatlich neu lesen.
