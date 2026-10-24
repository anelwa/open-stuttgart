// 100 Verbesserungen für StuggiAI, Bedienung, Design, Zuverlässigkeit und Inhalt.
// Jede Verbesserung ist konkret prüfbar; der Status wird mit der Umsetzung gepflegt.
const spec = [
  // ---------- StuggiAI (25) ----------
  ['stuggi-copy-answer', 'Antwort kopieren', 'stuggi', 'Jede Bot-Antwort lässt sich mit einem Klick als Text kopieren.'],
  ['stuggi-regenerate', 'Antwort neu erzeugen', 'stuggi', 'Die letzte Frage kann mit einem Knopf erneut beantwortet werden.'],
  ['stuggi-stop', 'Antwort abbrechen', 'stuggi', 'Eine laufende Anfrage lässt sich sofort stoppen; die Oberfläche bleibt bedienbar.'],
  ['stuggi-source-links', 'Quellen verlinken', 'stuggi', 'Quellen unter einer Antwort sind direkt anklickbar, nicht nur Text.'],
  ['stuggi-shortcut', 'Tastenkürzel für StuggiAI', 'stuggi', 'Cmd/Ctrl+J öffnet und schließt den Assistenten von jeder Ansicht aus.'],
  ['stuggi-clear', 'Chat leeren', 'stuggi', 'Ein Knopf leert den sichtbaren Verlauf nach Rückfrage.'],
  ['stuggi-timestamps', 'Zeitstempel', 'stuggi', 'Jede Nachricht zeigt, wann sie gesendet wurde.'],
  ['stuggi-prompt-help', 'Fragehilfe', 'stuggi', 'Ein Hilfe-Knopf zeigt Beispielfragen nach Thema.'],
  ['stuggi-retry', 'Fehler wiederholen', 'stuggi', 'Bei einem Fehler gibt es einen direkten Wiederholen-Knopf.'],
  ['stuggi-share-answer', 'Antwort teilen', 'stuggi', 'Antworten lassen sich über die Web-Share-API oder als Link teilen.'],
  ['stuggi-markdown-copy', 'Antwort als Markdown', 'stuggi', 'Kopieren als Markdown mit Quelle und Zeit.'],
  ['stuggi-context-chips', 'Kontext-Chips', 'stuggi', 'Ort, Zeit und gewählte Ebene werden als Chips neben dem Eingabefeld gezeigt.'],
  ['stuggi-voice-status', 'Sprachstatus', 'stuggi', 'Mikrofon, Freihändig und Vorlesen haben einen klaren, barrierefreien Status.'],
  ['stuggi-aria-live', 'Statusmeldungen', 'stuggi', 'Neue Antworten und Fehler werden Screenreadern höflich angekündigt.'],
  ['stuggi-mobile-full', 'Mobiles Vollbild', 'stuggi', 'Auf kleinen Bildschirmen nutzt der Assistent die volle Höhe ohne abgeschnittene Eingabe.'],
  ['stuggi-search-history', 'Verlauf durchsuchen', 'stuggi', 'Die aktuelle Unterhaltung lässt sich nach Stichworten filtern.'],
  ['stuggi-feedback', 'Antwort-Feedback', 'stuggi', 'Daumen hoch/runter wird lokal gespeichert, ohne Profil oder Server.'],
  ['stuggi-summary', 'Antwort zusammenfassen', 'stuggi', 'Lange Antworten lassen sich auf drei Sätze verdichten.'],
  ['stuggi-plain', 'Leichte Sprache im Bot', 'stuggi', 'Der Bot kann dieselbe Antwort in einfacher Sprache ausgeben.'],
  ['stuggi-suggestions-context', 'Kontextuelle Vorschläge', 'stuggi', 'Folgefragen richten sich nach dem letzten Ergebnis.'],
  ['stuggi-tool-progress', 'Werkzeug-Fortschritt', 'stuggi', 'Während der Anfrage wird sichtbar, welche Quelle geprüft wird.'],
  ['stuggi-rate-limit', 'Limit-Hinweis', 'stuggi', 'Bei Rate-Limit nennt der Bot die Wartezeit statt eines technischen Fehlers.'],
  ['stuggi-location-remember', 'Standort merken', 'stuggi', 'Der zuletzt freigegebene Ort wird lokal gespeichert und kann gelöscht werden.'],
  ['stuggi-action-log', 'Aktionsprotokoll', 'stuggi', 'Ausgeführte Kartenaktionen sind als kompakte Liste sichtbar und rückgängig zu machen.'],
  ['stuggi-keyboard', 'Tastaturbedienung', 'stuggi', 'Eingabe, Senden, Stoppen und Schließen sind vollständig per Tastatur erreichbar.'],

  // ---------- User Experience (25) ----------
  ['ux-shortcut-help', 'Tastenkürzel-Hilfe', 'ux', 'Ein Overlay erklärt die wichtigsten Kürzel (?, Cmd+K, Cmd+J, Esc).'],
  ['ux-recent-search', 'Letzte Suchen', 'ux', 'Die Suche zeigt die letzten Suchbegriffe aus dem lokalen Speicher.'],
  ['ux-clear-search', 'Suche löschen', 'ux', 'Ein X im Suchfeld setzt Eingabe und Treffer zurück.'],
  ['ux-no-results', 'Keine Treffer mit Ausweg', 'ux', 'Leere Suchen schlagen Alternativen und Kartenaktionen vor.'],
  ['ux-scroll-restore', 'Scrollposition merken', 'ux', 'Beim Zurückkehren in ein Modul bleibt die Scrollposition erhalten.'],
  ['ux-deep-tabs', 'Tabs verlinkbar', 'ux', 'Jeder Reiter eines Moduls hat einen stabilen Deep-Link.'],
  ['ux-back-button', 'Zurück-Taste', 'ux', 'Die Browser-Zurück-Taste schließt Details, statt die Seite zu verlassen.'],
  ['ux-copy-toast', 'Kopier-Quittung', 'ux', 'Kopieren wird mit einer kurzen, zugänglichen Meldung bestätigt.'],
  ['ux-web-share', 'Teilen mit dem System', 'ux', 'Wo verfügbar, öffnet sich der native Teilen-Dialog.'],
  ['ux-empty-states', 'Leere Zustände', 'ux', 'Jede Liste erklärt bei null Treffern, warum und was als Nächstes geht.'],
  ['ux-skeletons', 'Einheitliche Ladebilder', 'ux', 'Ladezustände sehen überall gleich aus und springen nicht.'],
  ['ux-retry', 'Erneut laden', 'ux', 'Fehlerzustände bieten überall einen sinnvollen Wiederholen-Knopf.'],
  ['ux-offline', 'Offline-Hinweis', 'ux', 'Ein Banner zeigt fehlende Verbindung und pausiert automatische Abrufe.'],
  ['ux-slow-source', 'Langsame Quelle', 'ux', 'Nach acht Sekunden erscheint ein Hinweis mit der Möglichkeit, weiterzuwarten.'],
  ['ux-filter-counts', 'Filter mit Zahlen', 'ux', 'Filterchips zeigen, wie viele Treffer sie liefern.'],
  ['ux-url-state', 'Filter in der URL', 'ux', 'Aktive Filter stehen in der Adresse und überleben einen Reload.'],
  ['ux-sticky-headers', 'Klebende Abschnitte', 'ux', 'Lange Module behalten ihre Abschnittsüberschrift beim Scrollen.'],
  ['ux-reduced-motion', 'Bewegung reduzieren', 'ux', 'Animationen respektieren prefers-reduced-motion.'],
  ['ux-touch-targets', 'Größere Touchziele', 'ux', 'Alle wichtigen Knöpfe sind mindestens 44 × 44 Pixel groß.'],
  ['ux-keyboard-list', 'Listen per Tastatur', 'ux', 'Listen lassen sich mit Pfeiltasten durchlaufen und öffnen.'],
  ['ux-esc', 'Esc schließt', 'ux', 'Escape schließt Dialoge, Details und Overlays in der richtigen Reihenfolge.'],
  ['ux-focus-return', 'Fokus zurück', 'ux', 'Nach dem Schließen eines Dialogs kehrt der Fokus zum Auslöser zurück.'],
  ['ux-live-region', 'Toasts für Screenreader', 'ux', 'Kurze Meldungen laufen über eine höfliche Live-Region.'],
  ['ux-autocomplete-aria', 'Autocomplete barrierefrei', 'ux', 'Suchvorschläge sind mit combobox/listbox-Semantik ausgezeichnet.'],
  ['ux-form-validation', 'Formulare validieren', 'ux', 'Pflichtfelder und Fehler werden direkt am Feld und für Screenreader erklärt.'],

  // ---------- Design und Barrierefreiheit (20) ----------
  ['design-contrast', 'Kontrast geprüft', 'design', 'Text- und Statusfarben erreichen mindestens WCAG AA.'],
  ['design-dark-labor', 'Dunkles Stadtlabor', 'design', 'Das neue Modul ist im dunklen Thema vollständig lesbar.'],
  ['design-focus-ring', 'Sichtbarer Fokus', 'design', 'Alle interaktiven Elemente haben einen deutlichen Fokusring.'],
  ['design-headings', 'Saubere Überschriften', 'design', 'Jede Ansicht hat genau eine H1 und eine logische H2/H3-Reihenfolge.'],
  ['design-landmarks', 'Landmarks', 'design', 'Navigation, Hauptinhalt und Ergänzungen sind als Landmarks ausgezeichnet.'],
  ['design-table-captions', 'Tabellen mit Beschriftung', 'design', 'Datentabellen haben caption und scope, nicht nur visuelle Kopfzeilen.'],
  ['design-alt-text', 'Alternativtexte', 'design', 'Alle inhaltstragenden Bilder haben passende Alternativtexte.'],
  ['design-lang', 'Sprachattribute', 'design', 'Fremdsprachige Textstellen sind mit lang ausgezeichnet.'],
  ['design-print', 'Druckansicht', 'design', 'Lange Seiten und Schilder drucken ohne Navigation und Schatten.'],
  ['design-kiosk-type', 'Kiosk-Typografie', 'design', 'Der Kiosk nutzt größere Schrift und klarere Abstände.'],
  ['design-color-blind', 'Farbenblind sicher', 'design', 'Status wird nie nur über Farbe, sondern auch über Text/Symbol gezeigt.'],
  ['design-reduced-motion', 'Radar ohne Animation', 'design', 'Radar und Schatten lassen sich ohne automatische Bewegung anzeigen.'],
  ['design-touch', '44-Pixel-Regel', 'design', 'Knöpfe und Zeilen erfüllen die Mindestgröße auch auf dem Handy.'],
  ['design-form-labels', 'Formularlabels', 'design', 'Jedes Eingabefeld hat ein sichtbares Label, nicht nur einen Platzhalter.'],
  ['design-toast-live', 'Toasts zugänglich', 'design', 'Toasts sind kontrastreich, kurz und für Screenreader hörbar.'],
  ['design-high-contrast', 'Hoher Kontrast', 'design', 'Ein Hochkontrastmodus verstärkt Linien und Text.'],
  ['design-responsive-type', 'Responsive Schrift', 'design', 'Überschriften skalieren mit dem Viewport, ohne umzubrechen.'],
  ['design-icons', 'Einheitliche Icons', 'design', 'Neue Icons haben dieselbe Strichstärke und Größe wie die bestehenden.'],
  ['design-empty-art', 'Leere Zustände gestalten', 'design', 'Leere Zustände nutzen ein ruhiges Symbol statt einer weißen Fläche.'],
  ['design-spacing', 'Abstände im Detail', 'design', 'Detailansichten haben konsistente Abstände und keine überlaufenden Texte.'],

  // ---------- Leistung und Zuverlässigkeit (15) ----------
  ['perf-lazy-modules', 'Module nachladen', 'performance', 'Schwere Module werden erst beim Öffnen geladen.'],
  ['perf-split-map', 'Karte splitten', 'performance', 'Die Kartenbibliothek liegt in einem eigenen Chunk.'],
  ['perf-cache-headers', 'Cache-Header', 'performance', 'Statische Assets und Katalogantworten haben passende Cache-Header.'],
  ['perf-etag', 'ETag für Kataloge', 'performance', 'Das Quellenregister antwortet mit ETag und 304.'],
  ['perf-dedupe', 'Anfragen bündeln', 'performance', 'Gleiche parallele Anfragen teilen sich einen Abruf.'],
  ['perf-abort-search', 'Suche abbrechen', 'performance', 'Eine neue Suche bricht die alte Anfrage ab.'],
  ['perf-debounce', 'Filter entprellen', 'performance', 'Texteingaben lösen höchstens alle 300 ms eine Anfrage aus.'],
  ['perf-virtual-list', 'Lange Listen virtualisieren', 'performance', 'Listen mit hunderten Einträgen rendern nur den sichtbaren Teil.'],
  ['perf-lazy-images', 'Bilder nachladen', 'performance', 'Bilder laden mit loading="lazy" und fester Größe.'],
  ['perf-preconnect', 'Tile-Hosts vorverbinden', 'performance', 'Die Karte verbindet sich früher mit Tile-Hosts.'],
  ['perf-service-worker', 'Offline-Hülle', 'performance', 'Eine kleine Offline-Seite erklärt den Zustand, statt einer Browserfehlerseite.'],
  ['perf-health-detail', 'Health mit Details', 'performance', 'Der Health-Endpunkt nennt Datenstand, Cache und optionale Quellen.'],
  ['perf-fallback', 'Letzter guter Wert', 'performance', 'Ausgefallene Quellen liefern den letzten guten Stand mit Hinweis.'],
  ['perf-timeouts', 'Harte Timeouts', 'performance', 'Jeder Upstream-Abruf hat einen definierten Timeout.'],
  ['perf-slow-log', 'Langsame Abrufe protokollieren', 'performance', 'Abrufe über zwei Sekunden erscheinen im Log, ohne Inhalte zu speichern.'],

  // ---------- Inhalt und Dokumentation (15) ----------
  ['content-labor-help', 'Stadtlabor-Hilfe', 'content', 'Ein Hilfe-Abschnitt erklärt Quellen, Werkzeuge, Status und Grenzen.'],
  ['content-api-docs', 'API-Dokumentation', 'content', 'Die neuen Endpunkte sind mit Beispielen dokumentiert.'],
  ['content-changelog', 'Änderungsprotokoll', 'content', 'Ein Changelog nennt neue Quellen und Werkzeuge mit Datum.'],
  ['content-attribution', 'Quellen- und Lizenzseite', 'content', 'Eine eigene Seite bündelt Attribution und Lizenzhinweise.'],
  ['content-freshness', 'Datenstand sichtbar', 'content', 'Jede Werkzeugantwort zeigt Abrufzeit und Datenstand.'],
  ['content-whats-new', 'Was ist neu', 'content', 'Ein Banner weist auf neue Module und Quellen hin.'],
  ['content-i18n', 'Mehrsprachige Texte', 'content', 'Die wichtigsten neuen Texte laufen über die Übersetzungsschicht.'],
  ['content-english', 'Englische Fassung', 'content', 'Stadtlabor und Hilfe sind auf Englisch verfügbar.'],
  ['content-plain', 'Leichte Sprache aktualisiert', 'content', 'Die Seite in Leichter Sprache erklärt das Stadtlabor.'],
  ['content-faq', 'FAQ', 'content', 'Häufige Fragen zu Daten, Lizenzen und Grenzen sind beantwortet.'],
  ['content-source-request', 'Quellenvorschlag', 'content', 'Ein Formular oder Link ermöglicht Vorschläge für neue Quellen.'],
  ['content-report-problem', 'Problem melden', 'content', 'Jede Werkzeugansicht bietet einen Weg, Fehler zu melden.'],
  ['content-methods', 'Methodenseiten', 'content', 'Raster, Modelle und Näherungen werden je Werkzeug erklärt.'],
  ['content-glossary', 'Glossar', 'content', 'Fachbegriffe wie WFS, CKAN, AQI und HQ100 werden erklärt.'],
  ['content-print-sheets', 'Druckdatenblätter', 'content', 'Wichtige Ergebnisse lassen sich als kompaktes Datenblatt drucken.'],
];

const categories = [
  ['stuggi', 'StuggiAI'],
  ['ux', 'Bedienung'],
  ['design', 'Design & Barrierefreiheit'],
  ['performance', 'Leistung & Zuverlässigkeit'],
  ['content', 'Inhalt & Dokumentation'],
];

const DONE = new Set([
  'stuggi-copy-answer', 'stuggi-regenerate', 'stuggi-stop', 'stuggi-source-links',
  'stuggi-shortcut', 'stuggi-clear', 'stuggi-timestamps', 'stuggi-prompt-help',
  'ux-shortcut-help',
  'stuggi-aria-live', 'stuggi-mobile-full', 'stuggi-retry', 'stuggi-share-answer',
  'stuggi-feedback', 'stuggi-keyboard', 'design-table-captions', 'content-labor-help',
  'content-attribution', 'content-freshness', 'perf-health-detail',
  'stuggi-markdown-copy', 'stuggi-context-chips', 'stuggi-search-history', 'stuggi-summary', 'stuggi-rate-limit',
  'ux-recent-search', 'ux-no-results', 'ux-offline', 'ux-reduced-motion',
  'design-dark-labor', 'design-print', 'design-high-contrast',
  'perf-lazy-modules', 'perf-preconnect', 'perf-slow-log',
  'content-api-docs', 'content-changelog', 'content-faq', 'content-glossary', 'content-methods',
  'stuggi-location-remember', 'ux-web-share', 'ux-copy-toast', 'ux-scroll-restore',
  'design-landmarks', 'content-whats-new', 'content-print-sheets',
  'stuggi-action-log', 'content-source-request', 'content-report-problem', 'content-plain',
  'design-focus-ring', 'design-responsive-type', 'perf-cache-headers', 'perf-etag', 'design-toast-live',
  'stuggi-plain', 'stuggi-suggestions-context', 'ux-sticky-headers', 'ux-form-validation',
  'design-kiosk-type', 'design-form-labels', 'perf-service-worker',
  'ux-esc', 'ux-live-region', 'ux-empty-states', 'design-alt-text', 'design-icons',
  'design-spacing', 'design-empty-art', 'perf-lazy-images', 'ux-touch-targets',
  'design-touch', 'design-reduced-motion', 'stuggi-voice-status', 'ux-deep-tabs',
  'ux-keyboard-list', 'ux-focus-return', 'ux-slow-source',
  'ux-clear-search', 'ux-skeletons', 'ux-retry', 'ux-filter-counts', 'ux-autocomplete-aria', 'ux-url-state',
  'design-contrast', 'design-headings', 'design-lang', 'design-color-blind',
  'perf-dedupe', 'perf-abort-search', 'perf-debounce', 'perf-fallback', 'perf-timeouts',
  'perf-split-map', 'perf-virtual-list', 'ux-back-button', 'stuggi-tool-progress',
  'content-i18n', 'content-english',
]);

export const IMPROVEMENTS = spec.map(([id, title, category, summary], i) => ({
  number: i + 1, id, title, category, summary, status: DONE.has(id) ? 'done' : 'offen',
}));

if (IMPROVEMENTS.length !== 100) throw new Error(`Verbesserungsregister muss 100 Einträge haben, hat aber ${IMPROVEMENTS.length}`);
if (new Set(IMPROVEMENTS.map((x) => x.id)).size !== 100) throw new Error('Doppelte Verbesserungs-ID');

export const IMPROVEMENT_CATEGORIES = categories.map(([id, label]) => ({ id, label, count: IMPROVEMENTS.filter((x) => x.category === id).length }));

export function improvementCatalog() {
  return {
    count: IMPROVEMENTS.length,
    done: IMPROVEMENTS.filter((x) => x.status === 'done').length,
    open: IMPROVEMENTS.filter((x) => x.status !== 'done').length,
    categories: IMPROVEMENT_CATEGORIES.map((c) => ({ ...c, done: IMPROVEMENTS.filter((x) => x.category === c.id && x.status === 'done').length })),
    improvements: IMPROVEMENTS,
  };
}

export function setImprovementStatus(id, status) {
  const item = IMPROVEMENTS.find((x) => x.id === id);
  if (item) item.status = status;
  return item;
}
