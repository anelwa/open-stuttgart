# Spezifikation: Ebene „Verwaltung“ und Grundlage für den Assistenten

Stand: 20.10.2026. Grundlage ist der Datensatz aus dem Stadtseiten-Crawl (siehe [`docs/bericht-crawl.md`](./bericht-crawl.md) und [`docs/verwaltung-datensatz.md`](./verwaltung-datensatz.md)).

## 1. Zweck

Bürgerinnen und Bürger sollen auf der Karte sehen, wo sie eine Verwaltungsleistung erledigen können, ob sie es auch online erledigen können, wie sie einen Termin bekommen und wie lange sie im Bürgerbüro gerade warten. Der Assistent soll Fragen wie „Wo verlängere ich meinen Reisepass und wie lange dauert das?“ mit den Angaben der Stadt beantworten und immer auf die Originalseite verweisen.

Die Ebene ergänzt das bestehende Modul „In der Nähe“ (`server/sources/nearby.mjs`), das Bürgerbüros aus dem Geoserver und die Wartezeit-Ampel schon zeigt. Neu sind die Verknüpfung Leistung ↔ Dienststelle ↔ Gebäude ↔ Online-Angebot und die Öffnungszeiten.

## 2. Daten für die Demo

Die Demo hat einen Node-Server ohne Abhängigkeiten. Deshalb nutzt der Server folgende Dateien unter `server/data/` (oder über Umgebungsvariablen):

| Datei | Umgebungsvariable | Inhalt | Verwendung |
|---|---|---|---|
| `server/data/verwaltung-demo.json` | `OS_VERWALTUNG_DEMO` | Gebäude, Einheiten, Leistungen, Verknüpfungen, Online-Angebote, kompakt | einmal laden, im Speicher halten |
| `server/data/gebaeude.geojson` | `OS_VERWALTUNG_GEBAEUDE` | ein Punkt je Gebäude mit Einheiten und Zahl der Leistungen | Kartenebene direkt |
| `server/data/verwaltung.json` (`verwaltung-dock.json`) | `OS_VERWALTUNG` | 1 813 Dienststellen mit Lage, Anschrift, Öffnungszeiten, Terminlink und Leistungen | Andockstelle für „Meine Adresse“ und automatische Gebäude-/Leistungsableitung, falls `verwaltung-demo.json` nicht separat vorliegt |
| `server/data/verwaltung.sqlite` | `OS_VERWALTUNG_SQLITE` | vollständiger Datensatz mit Texten und allen Links | Assistent (Suche, Abschnitte), Auswertungen |

## 3. Server: Routen

Quelle `server/sources/verwaltung.mjs`, eingetragen in `server/index.mjs`:

| Route | Antwort |
|---|---|
| `/api/verwaltung/gebaeude` | GeoJSON aller Gebäude mit `id`, Anschrift, Stadtbezirk, Einheiten (Name, Art), Zahl der Leistungen, Kennzeichen `buergerbuero` und `tafel_id` |
| `/api/verwaltung/gebaeude?id=geb-…` | ein Gebäude mit Einheiten, je Einheit Öffnungszeiten (Zeilen), Telefon, E-Mail, Leistungen (Name, URL, Rolle), Online-Angebote |
| `/api/verwaltung/leistung?url=…` | Leistung mit Abschnitten (Voraussetzungen, Unterlagen, Gebühren, Bearbeitungsdauer, Ablauf), zuständiger Einheit, Orten (Gebäude mit Koordinate), Online-Angeboten nach Art |
| `/api/verwaltung/suche?q=…` | bis zu 20 Treffer über Leistungen, Einheiten und Straßen (Name vor Text, Umlaute und „ss/ß“ gleich behandeln) |
| `/api/verwaltung/wo?leistung=…&lat=…&lon=…` | Orte der Leistung nach Entfernung, je Ort „jetzt geöffnet“, Wartezeit (falls Bürgerbüro) und Terminlink |
| `/api/verwaltung/werkzeuge` | Werkzeuge für den Assistenten (`suche_leistung`, `leistung`, `wo_erledigen`, `einheit`, `wartezeit`) |

Die Wartezeit kommt weiter aus der bestehenden Route `/api/nearby/buergerbueros` (einmal pro Minute). Die Zuordnung zum Gebäude läuft über `department` der Ampel = Nummer in `ibs_id` der Einheit (`ibs.dept.101268` ↔ `department: 101268`).

## 4. Kartenebene „Verwaltung“

- **Symbole:** ein Punkt je Gebäude, nicht je Einheit (ein Rathaus beherbergt viele Einheiten). Größe nach Zahl der Einheiten, gebündelt bei kleiner Zoomstufe.
- **Filter (Chips):** `Bürgerbüros`, `Ämter und Dienststellen`, `Bezirksämter`, `Schulen und Bildung`, `Beratung und Soziales`, `Sonstige Adressen`. Standard beim Einschalten: Bürgerbüros und Ämter, ohne die Adressseiten von Vereinen und Kunstwerken.
- **Live-Zustand am Symbol:** Bürgerbüros mit Ring in Ampelform und Text, nie nur Farbe:
  - Status 0: „außerhalb der Öffnungszeiten“ (grau)
  - Status 1 bis 5: „ca. 15 bis 75 Minuten“ (grün)
  - Status 6 bis 9: „ca. 90 bis 135 Minuten“ (gelb)
  - Status 10: „150 Minuten oder mehr“ (gelb)
  - Status 11: „alle Wartemarken vergeben“ (rot)
- **Jetzt geöffnet:** aus den Öffnungszeiten-Zeilen (`day`, `times`, `note`). Zeiten mit Hinweis „nach vorheriger Online-Terminvereinbarung“ als „nur mit Termin“ anzeigen. Feiertage Baden-Württemberg berücksichtigen. Zeilen, die sich nicht lesen lassen, als Text zeigen statt zu raten.

## 5. Panel „Gebäude“

1. Anschrift, Stadtbezirk, „Hinkommen“ (nächste Haltestellen mit Gehzeit).
2. Je Einheit im Gebäude: Name, übergeordnetes Amt, Zustand jetzt (geöffnet bis …, nur mit Termin, geschlossen), Wartezeit bei Bürgerbüros.
3. Knöpfe in fester Reihenfolge: **Termin buchen** (Terminbuchung), **Online erledigen** (Online-Dienst Stadt, Land oder Bund), **Seite der Stadt**.
4. Leistungen der Einheit, gruppiert nach **Online möglich** / **Nur vor Ort**, mit Suche bei mehr als 15 Einträgen.
5. Telefon und E-Mail als Text mit Kopierknopf (keine Personen, nur Funktionsadressen).
6. Quelle und Stand: „Landeshauptstadt Stuttgart, stuttgart.de, Stand TT.MM.JJJJ“.

## 6. Panel „Leistung“ (aus Suche oder Assistent)

Kopf mit Name und Knöpfen Termin/Online wie oben. Darunter „Wo erledigen“ als Liste der Orte nach Entfernung zum Standort oder zu „Meine Adresse“, mit Zustand jetzt und Wartezeit. Danach die Abschnitte der Stadt in deren Reihenfolge: Voraussetzungen, Benötigte Unterlagen, Gebühren, Bearbeitungsdauer, Ablauf, Rechtsgrundlage. Texte unverändert übernehmen, keine Kürzung durch ein Sprachmodell in diesem Panel.

## 7. Grundlage für den Assistenten

| Werkzeug | Eingabe | Ausgabe |
|---|---|---|
| `suche_leistung` | Freitext | bis zu 5 Leistungen mit URL und Kurzbeschreibung |
| `leistung` | URL | Abschnitte, Gebühren, Unterlagen, Online-Angebote, Terminlink |
| `wo_erledigen` | Leistungs-URL, Ort (Koordinate oder Adresse) | Orte nach Entfernung mit „jetzt geöffnet“, Wartezeit, Terminlink, Anfahrt |
| `einheit` | URL oder Name | Anschrift, Öffnungszeiten, Kontakt, Leistungen |
| `wartezeit` | – | aktuelle Ampel aller Bürgerbüros mit Zeitstempel |
