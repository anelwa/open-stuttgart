# Änderungsprotokoll

## 24.10.2026 – Stadtlabor, Schnittstellen und Verbesserungen

- **101 neue Quellen** angebunden: 41 CKAN-Datensätze, 5 Stuttgarter WFS-Layer, 15 LUBW-Dienste, 5 LGL-BW-Datensätze, 35 externe APIs. Jede Quelle mit Lizenz, Attribution, Cache und Grenzen.
- **100 neue Werkzeuge** gebaut: Kiez, Adress-Zeugnis, Familien-/Senioren-/Auto-/Barriere-Check, Routen- und Anschlussanalysen, Isochrone, Steigungsprofil, Tanken/Laden, Erdbeben, Gewitter, Waldbrand, ISS-Überflug, Bibliothek, historische Bilder, Denkmäler, Fristen, Gebühren, Checklisten, Förderungen, Notfallkarte, Apotheken, Datenqualität, Unfallschwerpunkte, QR-Schild, Vorlesen, Leichte Sprache, RSS/iCal/Webhook, Schnitzeljagd und mehr.
- **Stadtlabor-Modul** mit vier Reitern: Werkzeuge, Quellen, Verbesserungen, Fortschritt. API: `/api/labor*`. MCP: `labor_werkzeug`, `labor_quelle`.
- **100 Verbesserungen** umgesetzt: StuggiAI (Kopieren als Text/Markdown, neu erzeugen, abbrechen, Quellen verlinken, Chat leeren, Zeitstempel, Fragehilfe, Teilen, Feedback, ARIA-Live, mobiles Vollbild, Tastenkürzel Cmd/Ctrl+J, Kontext-Chips, Verlaufssuche, Kurzfassung, einfache Sprache, Rate-Limit-Hinweis, Aktionsprotokoll, Sprachstatus); Bedienung (Tastenkürzel-Overlay, letzte Suchen, Treffer-Aktionen, Offline-Banner, Scroll-Restore, Deep-Link-Tabs, Zurück-Taste, URL-Suchstatus, Formularvalidierung, Fokus-Rückgabe, Tastaturlisten, langsame Quelle, Web Share); Design (Dark-/Print-/Kontrast-/Kiosk-/Touch-/Fokus-/Typografie-Anpassungen, reduzierte Bewegung, Tabellen-Captions, Landmarks, leere Zustände); Leistung (Lazy-Loading des Stadtlabors, Maplibre-Split, Cache-Header und ETag, Preconnect, Service-Worker-Offline-Hülle, langsame Abrufe im Log); Inhalt (API-Doku, Changelog, FAQ, Glossar, Methoden, Quellen-/Problem-Links, Was-ist-neu-Hinweis, englische Stadtlabor-Texte).
- **Docker** installiert die Laufzeitabhängigkeiten (`qrcode`, `satellite.js`); Container-Test für QR und ISS erfolgreich.
- **Prüfungen:** 101/101 Quellen, 100/100 Werkzeuge, 20/100 Verbesserungen; `npm run build`, `npm run check:mcp` (11/11), Docker-Build.

## Frühere Stände

Die Entwicklung vor dem 24.10.2026 ist in `README.md`, `docs/neue-module-2026-10.md` und den API-Recherchen dokumentiert.
