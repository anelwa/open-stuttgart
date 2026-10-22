# UX-Benchmark: Google Maps, Apple Karten und Open Stuttgart

Stand 21.10.2026. Ziel ist nicht, fremdes Design oder fremden Code zu kopieren, sondern
öffentlich beobachtbare Interaktionsmuster zu verstehen und in der bestehenden
Open-Stuttgart-Designsprache besser zu lösen.

## Methode und Grenzen

- **REA** ist installiert und mit OpenCode verbunden (MCP, Version 6.7.0). Verifiziert mit
  `rea doctor --client opencode` (`healthy: true`, Skill aligned) und einem echten
  Browser-Target des lokalen Builds (`ev_f43b6797dc6cd09a5fd019153d7d8c297d120339f3e809ef973de6567f0bf1cd`).
- **Apple Karten** wurde zusätzlich als kontrolliertes REA-Browserszenario geöffnet
  (`ev_961ea7660135f888485c29f59b563dd51cb26f85b60f5a7b54d73be4c59f482d`, Screenshot
  `captured`, Status `completed`, completeness `complete`).
- **Google Maps** wurde nach dem öffentlichen Cookie-Dialog in einem eigenen
  Chrome-Profil betrachtet. Die Seite ist eine Consent-Wand; es wurden keine Logins
  umgangen und keine Kartendaten extrahiert.
- Es wurden **keine** Assets, Icons, Texte, Kartendaten oder proprietären Skripte
  übernommen. Die Beobachtung dient ausschließlich der Muster- und Flow-Analyse.
- Native iOS-/Android-Apps sind nicht Teil dieser Untersuchung.

## Beobachtete Muster

### Google Maps (Desktop)

- Karte full-bleed; Suchfeld als dominantes, großes Element oben links.
- Direkt daneben horizontale Kategorie-Chips (Restaurants, Hotels, Aktivitäten, Museen,
  ÖPNV, Apotheken …).
- Linke schmale Rail für „Gespeichert“, „Zuletzt verwendet“, „App herunterladen“.
- Schwebende Ortskarte oben links mit Zusammenfassung und „>“ für Details.
- „Ebenen“ als eigene Schaltfläche unten links; Zoom/Street-View/3D unten rechts.
- Kartensteuerung ist minimal und überlagert die Karte, nicht den Inhalt.

### Apple Karten (Desktop)

- Karte full-bleed, keine permanente Sidebar.
- Schwebende dunkle Karte oben links mit drei primären Aktionen: **Suchen**,
  **Reiseführer**, **Route**.
- Diese drei Einstiege sind groß, klar hierarchisiert und sofort verständlich.
- Kartensteuerung oben rechts (3D/Kompass), Attribution unten, Zoom unten rechts.
- Ein blauer „Hier ist dein Unternehmen?“-Hinweis erscheint kontextuell unten links.
- Die Karte bleibt der Hauptinhalt; die UI schwebt darüber.

## Was Open Stuttgart heute anders macht

- Permanentes linkes Panel mit Brand, Modul-Tabs, Suche und langem Scroll-Inhalt.
- Suche ist aktuell eine Haltestellensuche; die globale Inhaltssuche war nicht sichtbar.
- Kartenebenen sind über viele Module verteilt; es gibt keinen zentralen „Ebenen“-Einstieg.
- Detailansichten sind auf Desktop rechts, mobil als Bottom Sheet – das ist bereits nah an
  Apple/Google, aber die Hierarchie ist oft textlastig.
- Die Stärke – Quellen, Erklärungen, Backlinks – ist einzigartig und sollte nicht
  zugunsten einer reinen Maps-Kopie aufgegeben werden.

## Umgesetzt

1. **Globale Everything Search (Cmd/Ctrl+K)** über 10.289 Seiten, Leistungen,
   Dienststellen, Online-Dienste und Dokumente.
   - Große Suchpalette, Typ-Facetten, Quellen, Änderungsdatum, hervorgehobene Snippets.
   - Dokumentenleser mit Ablauf, Zuständigkeit, Bezugsquellen, verwandten Dokumenten und
     Backlinks.
   - Mobil Vollbild, Desktop zentrierte Palette.
2. **Globale Ebenen-Auswahl** als schwebende Karte (Desktop) bzw. Bottom Sheet (mobil).
   - 23 Ebenen in vier Gruppen: Verkehr, Orte, Umwelt, Karte.
   - Schalter mit Zustand, Icon und Kurzbeschreibung; Auswahl bleibt lokal gespeichert.
3. **Mobiler Vollbild-Suchmodus** und bestehende Bottom-Sheet-Logik beibehalten.
4. **Dokumentenregister** als Grundlage für „Was hängt mit diesem Anliegen zusammen?“:
   - Quellen, Formulare, zuständige Stellen, Ablauf, Backlinks, Related.

## Nächste sinnvolle Schritte

1. **Primäre Ortsaktionen** in jeder Detailansicht ganz oben: „Route planen“, „Teilen“,
   „Merken“, „In der Nähe“. Google/Apple setzen diese vor die Details.
2. **Kategorie-Chips auf der Karte** für die häufigsten Anliegen (Personalausweis,
   Abfall, Baustelle, Parken, Essen, Veranstaltungen), nicht nur im Panel.
3. **Schwebende Suche auf Mobil**: ein kleiner Such-Button über der Karte, damit die Suche
   auch bei geschlossenem Panel erreichbar ist.
4. **Letzte Suchen und beliebte Anliegen** in der leeren Palette.
5. **Detailansicht stärker progressiv offenbaren**: Zusammenfassung + Primäraktionen
   zuerst, lange Textabschnitte und Quellen einklappbar.
6. **Kartenlegende** für Unfallatlas, Wanderwege und Warngebiete direkt am Layer.
7. **Messbare UX-Kriterien**: Time-to-first-result, Klicks bis „Route“, Klicks bis
   „Bezugsquelle“, Anteil leerer Suchen, Abbruchrate auf Mobil.

## REA-Evidence

- Lokaler Browser-Target: `ev_f43b6797dc6cd09a5fd019153d7d8c297d120339f3e809ef973de6567f0bf1cd`
- Apple-Maps-Szenario: `ev_961ea7660135f888485c29f59b563dd51cb26f85b60f5a7b54d73be4c59f482d`
- Lokaler Such-Flow (REA-gesteuert: Palette öffnen, „Personalausweis“ eingeben, warten,
  Screenshot): `ev_028cc4b4d2d14554671a60dd8d8f77d685f7a7279a243f8f49477fd63715d706`
  – Status `completed`, Screenshot `captured` (332.309 Bytes), einziges fehlendes
  Event-Feld: `events`; die Interaktion selbst wurde ausgeführt und beobachtet.
- Google Maps: öffentlicher Cookie-Dialog in einem separaten Chrome-Profil; die
  UI-Beobachtung erfolgte nach dem öffentlichen „Alle akzeptieren“. Keine Anmeldung,
  keine Massenabfrage, keine Übernahme von Inhalten.

Die Evidence-IDs belegen die Beobachtung, nicht eine Übernahme von Inhalten. Bei künftigen
Vergleichen werden Beobachtung, Inferenz und offene Fragen getrennt dokumentiert.
