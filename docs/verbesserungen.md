# 100 Verbesserungen für StuggiAI, Bedienung und Design

Stand: 24.10.2026. Diese Liste wird aus `server/extras/improvements.mjs` erzeugt.

**Auftrag:** Zusätzlich zu 100 Schnittstellen und 100 Werkzeugen werden 100 Verbesserungen für StuggiAI, User Experience, Design, Barrierefreiheit, Leistung und Inhalt umgesetzt.

## Stand

| Bereich | Anzahl | umgesetzt | offen |
|---|---:|---:|---:|
| Verbesserungen | 100 | 100 | 0 |

| Kategorie | Anzahl | umgesetzt |
|---|---:|---:|
| StuggiAI | 25 | 25 |
| Bedienung | 25 | 25 |
| Design & Barrierefreiheit | 20 | 20 |
| Leistung & Zuverlässigkeit | 15 | 15 |
| Inhalt & Dokumentation | 15 | 15 |

## Liste

| # | ID | Verbesserung | Kategorie | Status |
|---:|---|---|---|---|
| 1 | stuggi-copy-answer | Antwort kopieren – Jede Bot-Antwort lässt sich mit einem Klick als Text kopieren. | StuggiAI | umgesetzt |
| 2 | stuggi-regenerate | Antwort neu erzeugen – Die letzte Frage kann mit einem Knopf erneut beantwortet werden. | StuggiAI | umgesetzt |
| 3 | stuggi-stop | Antwort abbrechen – Eine laufende Anfrage lässt sich sofort stoppen; die Oberfläche bleibt bedienbar. | StuggiAI | umgesetzt |
| 4 | stuggi-source-links | Quellen verlinken – Quellen unter einer Antwort sind direkt anklickbar, nicht nur Text. | StuggiAI | umgesetzt |
| 5 | stuggi-shortcut | Tastenkürzel für StuggiAI – Cmd/Ctrl+J öffnet und schließt den Assistenten von jeder Ansicht aus. | StuggiAI | umgesetzt |
| 6 | stuggi-clear | Chat leeren – Ein Knopf leert den sichtbaren Verlauf nach Rückfrage. | StuggiAI | umgesetzt |
| 7 | stuggi-timestamps | Zeitstempel – Jede Nachricht zeigt, wann sie gesendet wurde. | StuggiAI | umgesetzt |
| 8 | stuggi-prompt-help | Fragehilfe – Ein Hilfe-Knopf zeigt Beispielfragen nach Thema. | StuggiAI | umgesetzt |
| 9 | stuggi-retry | Fehler wiederholen – Bei einem Fehler gibt es einen direkten Wiederholen-Knopf. | StuggiAI | umgesetzt |
| 10 | stuggi-share-answer | Antwort teilen – Antworten lassen sich über die Web-Share-API oder als Link teilen. | StuggiAI | umgesetzt |
| 11 | stuggi-markdown-copy | Antwort als Markdown – Kopieren als Markdown mit Quelle und Zeit. | StuggiAI | umgesetzt |
| 12 | stuggi-context-chips | Kontext-Chips – Ort, Zeit und gewählte Ebene werden als Chips neben dem Eingabefeld gezeigt. | StuggiAI | umgesetzt |
| 13 | stuggi-voice-status | Sprachstatus – Mikrofon, Freihändig und Vorlesen haben einen klaren, barrierefreien Status. | StuggiAI | umgesetzt |
| 14 | stuggi-aria-live | Statusmeldungen – Neue Antworten und Fehler werden Screenreadern höflich angekündigt. | StuggiAI | umgesetzt |
| 15 | stuggi-mobile-full | Mobiles Vollbild – Auf kleinen Bildschirmen nutzt der Assistent die volle Höhe ohne abgeschnittene Eingabe. | StuggiAI | umgesetzt |
| 16 | stuggi-search-history | Verlauf durchsuchen – Die aktuelle Unterhaltung lässt sich nach Stichworten filtern. | StuggiAI | umgesetzt |
| 17 | stuggi-feedback | Antwort-Feedback – Daumen hoch/runter wird lokal gespeichert, ohne Profil oder Server. | StuggiAI | umgesetzt |
| 18 | stuggi-summary | Antwort zusammenfassen – Lange Antworten lassen sich auf drei Sätze verdichten. | StuggiAI | umgesetzt |
| 19 | stuggi-plain | Leichte Sprache im Bot – Der Bot kann dieselbe Antwort in einfacher Sprache ausgeben. | StuggiAI | umgesetzt |
| 20 | stuggi-suggestions-context | Kontextuelle Vorschläge – Folgefragen richten sich nach dem letzten Ergebnis. | StuggiAI | umgesetzt |
| 21 | stuggi-tool-progress | Werkzeug-Fortschritt – Während der Anfrage wird sichtbar, welche Quelle geprüft wird. | StuggiAI | umgesetzt |
| 22 | stuggi-rate-limit | Limit-Hinweis – Bei Rate-Limit nennt der Bot die Wartezeit statt eines technischen Fehlers. | StuggiAI | umgesetzt |
| 23 | stuggi-location-remember | Standort merken – Der zuletzt freigegebene Ort wird lokal gespeichert und kann gelöscht werden. | StuggiAI | umgesetzt |
| 24 | stuggi-action-log | Aktionsprotokoll – Ausgeführte Kartenaktionen sind als kompakte Liste sichtbar und rückgängig zu machen. | StuggiAI | umgesetzt |
| 25 | stuggi-keyboard | Tastaturbedienung – Eingabe, Senden, Stoppen und Schließen sind vollständig per Tastatur erreichbar. | StuggiAI | umgesetzt |
| 26 | ux-shortcut-help | Tastenkürzel-Hilfe – Ein Overlay erklärt die wichtigsten Kürzel (?, Cmd+K, Cmd+J, Esc). | Bedienung | umgesetzt |
| 27 | ux-recent-search | Letzte Suchen – Die Suche zeigt die letzten Suchbegriffe aus dem lokalen Speicher. | Bedienung | umgesetzt |
| 28 | ux-clear-search | Suche löschen – Ein X im Suchfeld setzt Eingabe und Treffer zurück. | Bedienung | umgesetzt |
| 29 | ux-no-results | Keine Treffer mit Ausweg – Leere Suchen schlagen Alternativen und Kartenaktionen vor. | Bedienung | umgesetzt |
| 30 | ux-scroll-restore | Scrollposition merken – Beim Zurückkehren in ein Modul bleibt die Scrollposition erhalten. | Bedienung | umgesetzt |
| 31 | ux-deep-tabs | Tabs verlinkbar – Jeder Reiter eines Moduls hat einen stabilen Deep-Link. | Bedienung | umgesetzt |
| 32 | ux-back-button | Zurück-Taste – Die Browser-Zurück-Taste schließt Details, statt die Seite zu verlassen. | Bedienung | umgesetzt |
| 33 | ux-copy-toast | Kopier-Quittung – Kopieren wird mit einer kurzen, zugänglichen Meldung bestätigt. | Bedienung | umgesetzt |
| 34 | ux-web-share | Teilen mit dem System – Wo verfügbar, öffnet sich der native Teilen-Dialog. | Bedienung | umgesetzt |
| 35 | ux-empty-states | Leere Zustände – Jede Liste erklärt bei null Treffern, warum und was als Nächstes geht. | Bedienung | umgesetzt |
| 36 | ux-skeletons | Einheitliche Ladebilder – Ladezustände sehen überall gleich aus und springen nicht. | Bedienung | umgesetzt |
| 37 | ux-retry | Erneut laden – Fehlerzustände bieten überall einen sinnvollen Wiederholen-Knopf. | Bedienung | umgesetzt |
| 38 | ux-offline | Offline-Hinweis – Ein Banner zeigt fehlende Verbindung und pausiert automatische Abrufe. | Bedienung | umgesetzt |
| 39 | ux-slow-source | Langsame Quelle – Nach acht Sekunden erscheint ein Hinweis mit der Möglichkeit, weiterzuwarten. | Bedienung | umgesetzt |
| 40 | ux-filter-counts | Filter mit Zahlen – Filterchips zeigen, wie viele Treffer sie liefern. | Bedienung | umgesetzt |
| 41 | ux-url-state | Filter in der URL – Aktive Filter stehen in der Adresse und überleben einen Reload. | Bedienung | umgesetzt |
| 42 | ux-sticky-headers | Klebende Abschnitte – Lange Module behalten ihre Abschnittsüberschrift beim Scrollen. | Bedienung | umgesetzt |
| 43 | ux-reduced-motion | Bewegung reduzieren – Animationen respektieren prefers-reduced-motion. | Bedienung | umgesetzt |
| 44 | ux-touch-targets | Größere Touchziele – Alle wichtigen Knöpfe sind mindestens 44 × 44 Pixel groß. | Bedienung | umgesetzt |
| 45 | ux-keyboard-list | Listen per Tastatur – Listen lassen sich mit Pfeiltasten durchlaufen und öffnen. | Bedienung | umgesetzt |
| 46 | ux-esc | Esc schließt – Escape schließt Dialoge, Details und Overlays in der richtigen Reihenfolge. | Bedienung | umgesetzt |
| 47 | ux-focus-return | Fokus zurück – Nach dem Schließen eines Dialogs kehrt der Fokus zum Auslöser zurück. | Bedienung | umgesetzt |
| 48 | ux-live-region | Toasts für Screenreader – Kurze Meldungen laufen über eine höfliche Live-Region. | Bedienung | umgesetzt |
| 49 | ux-autocomplete-aria | Autocomplete barrierefrei – Suchvorschläge sind mit combobox/listbox-Semantik ausgezeichnet. | Bedienung | umgesetzt |
| 50 | ux-form-validation | Formulare validieren – Pflichtfelder und Fehler werden direkt am Feld und für Screenreader erklärt. | Bedienung | umgesetzt |
| 51 | design-contrast | Kontrast geprüft – Text- und Statusfarben erreichen mindestens WCAG AA. | Design & Barrierefreiheit | umgesetzt |
| 52 | design-dark-labor | Dunkles Stadtlabor – Das neue Modul ist im dunklen Thema vollständig lesbar. | Design & Barrierefreiheit | umgesetzt |
| 53 | design-focus-ring | Sichtbarer Fokus – Alle interaktiven Elemente haben einen deutlichen Fokusring. | Design & Barrierefreiheit | umgesetzt |
| 54 | design-headings | Saubere Überschriften – Jede Ansicht hat genau eine H1 und eine logische H2/H3-Reihenfolge. | Design & Barrierefreiheit | umgesetzt |
| 55 | design-landmarks | Landmarks – Navigation, Hauptinhalt und Ergänzungen sind als Landmarks ausgezeichnet. | Design & Barrierefreiheit | umgesetzt |
| 56 | design-table-captions | Tabellen mit Beschriftung – Datentabellen haben caption und scope, nicht nur visuelle Kopfzeilen. | Design & Barrierefreiheit | umgesetzt |
| 57 | design-alt-text | Alternativtexte – Alle inhaltstragenden Bilder haben passende Alternativtexte. | Design & Barrierefreiheit | umgesetzt |
| 58 | design-lang | Sprachattribute – Fremdsprachige Textstellen sind mit lang ausgezeichnet. | Design & Barrierefreiheit | umgesetzt |
| 59 | design-print | Druckansicht – Lange Seiten und Schilder drucken ohne Navigation und Schatten. | Design & Barrierefreiheit | umgesetzt |
| 60 | design-kiosk-type | Kiosk-Typografie – Der Kiosk nutzt größere Schrift und klarere Abstände. | Design & Barrierefreiheit | umgesetzt |
| 61 | design-color-blind | Farbenblind sicher – Status wird nie nur über Farbe, sondern auch über Text/Symbol gezeigt. | Design & Barrierefreiheit | umgesetzt |
| 62 | design-reduced-motion | Radar ohne Animation – Radar und Schatten lassen sich ohne automatische Bewegung anzeigen. | Design & Barrierefreiheit | umgesetzt |
| 63 | design-touch | 44-Pixel-Regel – Knöpfe und Zeilen erfüllen die Mindestgröße auch auf dem Handy. | Design & Barrierefreiheit | umgesetzt |
| 64 | design-form-labels | Formularlabels – Jedes Eingabefeld hat ein sichtbares Label, nicht nur einen Platzhalter. | Design & Barrierefreiheit | umgesetzt |
| 65 | design-toast-live | Toasts zugänglich – Toasts sind kontrastreich, kurz und für Screenreader hörbar. | Design & Barrierefreiheit | umgesetzt |
| 66 | design-high-contrast | Hoher Kontrast – Ein Hochkontrastmodus verstärkt Linien und Text. | Design & Barrierefreiheit | umgesetzt |
| 67 | design-responsive-type | Responsive Schrift – Überschriften skalieren mit dem Viewport, ohne umzubrechen. | Design & Barrierefreiheit | umgesetzt |
| 68 | design-icons | Einheitliche Icons – Neue Icons haben dieselbe Strichstärke und Größe wie die bestehenden. | Design & Barrierefreiheit | umgesetzt |
| 69 | design-empty-art | Leere Zustände gestalten – Leere Zustände nutzen ein ruhiges Symbol statt einer weißen Fläche. | Design & Barrierefreiheit | umgesetzt |
| 70 | design-spacing | Abstände im Detail – Detailansichten haben konsistente Abstände und keine überlaufenden Texte. | Design & Barrierefreiheit | umgesetzt |
| 71 | perf-lazy-modules | Module nachladen – Schwere Module werden erst beim Öffnen geladen. | Leistung & Zuverlässigkeit | umgesetzt |
| 72 | perf-split-map | Karte splitten – Die Kartenbibliothek liegt in einem eigenen Chunk. | Leistung & Zuverlässigkeit | umgesetzt |
| 73 | perf-cache-headers | Cache-Header – Statische Assets und Katalogantworten haben passende Cache-Header. | Leistung & Zuverlässigkeit | umgesetzt |
| 74 | perf-etag | ETag für Kataloge – Das Quellenregister antwortet mit ETag und 304. | Leistung & Zuverlässigkeit | umgesetzt |
| 75 | perf-dedupe | Anfragen bündeln – Gleiche parallele Anfragen teilen sich einen Abruf. | Leistung & Zuverlässigkeit | umgesetzt |
| 76 | perf-abort-search | Suche abbrechen – Eine neue Suche bricht die alte Anfrage ab. | Leistung & Zuverlässigkeit | umgesetzt |
| 77 | perf-debounce | Filter entprellen – Texteingaben lösen höchstens alle 300 ms eine Anfrage aus. | Leistung & Zuverlässigkeit | umgesetzt |
| 78 | perf-virtual-list | Lange Listen virtualisieren – Listen mit hunderten Einträgen rendern nur den sichtbaren Teil. | Leistung & Zuverlässigkeit | umgesetzt |
| 79 | perf-lazy-images | Bilder nachladen – Bilder laden mit loading="lazy" und fester Größe. | Leistung & Zuverlässigkeit | umgesetzt |
| 80 | perf-preconnect | Tile-Hosts vorverbinden – Die Karte verbindet sich früher mit Tile-Hosts. | Leistung & Zuverlässigkeit | umgesetzt |
| 81 | perf-service-worker | Offline-Hülle – Eine kleine Offline-Seite erklärt den Zustand, statt einer Browserfehlerseite. | Leistung & Zuverlässigkeit | umgesetzt |
| 82 | perf-health-detail | Health mit Details – Der Health-Endpunkt nennt Datenstand, Cache und optionale Quellen. | Leistung & Zuverlässigkeit | umgesetzt |
| 83 | perf-fallback | Letzter guter Wert – Ausgefallene Quellen liefern den letzten guten Stand mit Hinweis. | Leistung & Zuverlässigkeit | umgesetzt |
| 84 | perf-timeouts | Harte Timeouts – Jeder Upstream-Abruf hat einen definierten Timeout. | Leistung & Zuverlässigkeit | umgesetzt |
| 85 | perf-slow-log | Langsame Abrufe protokollieren – Abrufe über zwei Sekunden erscheinen im Log, ohne Inhalte zu speichern. | Leistung & Zuverlässigkeit | umgesetzt |
| 86 | content-labor-help | Stadtlabor-Hilfe – Ein Hilfe-Abschnitt erklärt Quellen, Werkzeuge, Status und Grenzen. | Inhalt & Dokumentation | umgesetzt |
| 87 | content-api-docs | API-Dokumentation – Die neuen Endpunkte sind mit Beispielen dokumentiert. | Inhalt & Dokumentation | umgesetzt |
| 88 | content-changelog | Änderungsprotokoll – Ein Changelog nennt neue Quellen und Werkzeuge mit Datum. | Inhalt & Dokumentation | umgesetzt |
| 89 | content-attribution | Quellen- und Lizenzseite – Eine eigene Seite bündelt Attribution und Lizenzhinweise. | Inhalt & Dokumentation | umgesetzt |
| 90 | content-freshness | Datenstand sichtbar – Jede Werkzeugantwort zeigt Abrufzeit und Datenstand. | Inhalt & Dokumentation | umgesetzt |
| 91 | content-whats-new | Was ist neu – Ein Banner weist auf neue Module und Quellen hin. | Inhalt & Dokumentation | umgesetzt |
| 92 | content-i18n | Mehrsprachige Texte – Die wichtigsten neuen Texte laufen über die Übersetzungsschicht. | Inhalt & Dokumentation | umgesetzt |
| 93 | content-english | Englische Fassung – Stadtlabor und Hilfe sind auf Englisch verfügbar. | Inhalt & Dokumentation | umgesetzt |
| 94 | content-plain | Leichte Sprache aktualisiert – Die Seite in Leichter Sprache erklärt das Stadtlabor. | Inhalt & Dokumentation | umgesetzt |
| 95 | content-faq | FAQ – Häufige Fragen zu Daten, Lizenzen und Grenzen sind beantwortet. | Inhalt & Dokumentation | umgesetzt |
| 96 | content-source-request | Quellenvorschlag – Ein Formular oder Link ermöglicht Vorschläge für neue Quellen. | Inhalt & Dokumentation | umgesetzt |
| 97 | content-report-problem | Problem melden – Jede Werkzeugansicht bietet einen Weg, Fehler zu melden. | Inhalt & Dokumentation | umgesetzt |
| 98 | content-methods | Methodenseiten – Raster, Modelle und Näherungen werden je Werkzeug erklärt. | Inhalt & Dokumentation | umgesetzt |
| 99 | content-glossary | Glossar – Fachbegriffe wie WFS, CKAN, AQI und HQ100 werden erklärt. | Inhalt & Dokumentation | umgesetzt |
| 100 | content-print-sheets | Druckdatenblätter – Wichtige Ergebnisse lassen sich als kompaktes Datenblatt drucken. | Inhalt & Dokumentation | umgesetzt |

## Prüfung

`npm run check:extras` prüft 101 Quellen, 100 Werkzeuge und 100 Verbesserungen auf Vollständigkeit und eindeutige IDs. Die Verbesserungen sind im Stadtlabor unter „Verbesserungen“ sichtbar; `/api/labor/verbesserungen` liefert den Stand maschinenlesbar.
