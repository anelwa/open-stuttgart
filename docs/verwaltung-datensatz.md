# Andockstelle: Verwaltungsgebäude und Leistungen

Die Seite „Meine Adresse“ zeigt die nächsten Ämter und Dienststellen, sobald ein Datensatz vorliegt. Der Server liest ihn
aus `server/data/verwaltung.json` oder aus dem Pfad in der Umgebungsvariable `OS_VERWALTUNG`. Die Datei wird bei jeder
Änderung neu eingelesen; ein Neustart ist nicht nötig.

## Format

Eine Liste, ein Objekt mit `items` oder eine GeoJSON-FeatureCollection mit Punkten. Je Eintrag:

| Feld | Pflicht | Inhalt |
|---|---|---|
| `id` | nein | eindeutige Kennung |
| `name` | ja | Name der Dienststelle, z. B. „Bürgerbüro Mitte“ |
| `lat`, `lon` | ja | Lage in WGS 84 (bei GeoJSON aus der Geometrie) |
| `address` | nein | Anschrift |
| `web` | nein | Seite auf stuttgart.de |
| `booking` | nein | Online-Terminvereinbarung |
| `hours` | nein | Öffnungszeiten als Text |
| `services` | nein | Liste `{ name, url, online }`; `online: true` für Leistungen, die vollständig online erledigt werden können |

## Verwendung

- `/api/adresse/profil` liefert unter `verwaltung` die fünf nächsten Einträge mit Entfernung.
- Die Oberfläche zeigt bis zu vier davon unter „Zuständig für diesen Ort“ mit Anzahl der Leistungen; die Detailansicht
  nennt Anschrift, Öffnungszeiten, Terminbuchung und bis zu sechs Leistungen.
