# Mitwirken

Beiträge sind willkommen: Fehlerberichte, Hinweise auf weitere offene Datenquellen und Code.

- Fehler und Vorschläge bitte als Issue anlegen. Bei Datenfehlern die Quelle und die betroffene Ansicht nennen.
- Änderungen als Pull Request gegen `main`. Vorher `npx tsc -p tsconfig.json` und `npm run build` ausführen.
- Neue Datenquellen: eine Datei unter `server/sources/`, Abruf nur über den Server mit Zwischenspeicher und
  Mindestabstand je Host (`server/cache.mjs`). Lizenz und Namensnennung in der Ansicht und in der README angeben.
  Nutzungsbedingungen und robots.txt der Quelle beachten; keine Zugangsschutzmaßnahmen umgehen.
- Keine Schlüssel, Tokens oder personenbezogenen Daten ins Repository. Zugangsdaten gehören in Umgebungsvariablen.
- Texte in der Anwendung sachlich und knapp halten, ohne Werbesprache.
- Mit dem Einreichen eines Beitrags stimmen Sie zu, dass er unter der EUPL-1.2 veröffentlicht wird.
