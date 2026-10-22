# UX-Audit: Informationsarchitektur und Interaktionsdichte

Stand 22.10.2026. Messbasis ist die **gerenderte UI** (Accessibility-Baum) über REA,
nicht der Quelltext. Ziel ist zu belegen, *warum* die Oberfläche überladen wirkt, und
ein Zielbild zu definieren, das die bestehende Designsprache behält.

## Methode

- REA `capture_browser_scenario` gegen den lokalen Build (`node server/index.mjs`, Port 8787).
- Chrome headless, de-DE, Europe/Berlin, Light, `prefers-reduced-motion: reduce`.
- Pro Modul ein Szenario: laden, 4 s warten, jeden Reiter anklicken, 3 s warten.
- Ausgewertet wird jeweils der **Endzustand** nach Datenladung.
- Gezählt wird der Accessibility-Baum: Er enthält jede interaktive Bedienebene mit Rolle
  und Name. Er ist damit ein ehrlicheres Maß für „was muss der Nutzer erfassen" als die
  Anzahl sichtbarer Pixel.
- **Es wurden keine Inhalte der Vergleichsprodukte übernommen.** Apple Karten wurde nur als
  Referenz für die Interaktionsdichte gemessen.

### Evidence-IDs

| Sicht | Evidence-ID |
|---|---|
| Desktop, 8 Themenreiter | `ev_786f1baca0e60fc77a65f05439535cba521754ba0facfe98f0b82277bec1205c` |
| Mobil, 390×844, 4 Reiter | `ev_5afc3f253ebae91a420dd6dc7860048526966077bf53a25ee3acd40194fa823a` |
| Startzustand Desktop (Detail) | `ev_21f830cd2b80932cd110c819d63620fbd39d4ad922beb4b0dce2b3913969bc2d` |
| Startzustand (Vorlauf) | `ev_a7027378f96343bc80a541cf41fbd67f7cd661fcb2a68e1900491f30b4704bb9` |
| Referenz Apple Karten | `ev_af96bd3a5b6d974120e824a754fde6e352359eb3750c8c98c3eff0e4045e508c` |

## Messwerte Desktop (1440×900)

`Interaktiv` = Buttons, Links, Reiter, Schalter, Auswahlfelder, Kontrollkästchen.

| Reiter | A11y-Bytes | Interaktiv | Überschriften | Listeneinträge | Buttons | Links |
|---|---:|---:|---:|---:|---:|---:|
| Startzustand („Mobilität" aktiv) | 12.206 | 75 | 12 | 28 | 47 | 5 |
| Nähe | 12.198 | **124** | 10 | 17 | **101** | 8 |
| Verwaltung | 10.709 | 67 | 6 | 30 | 50 | 5 |
| Weg | 9.376 | 46 | 2 | 21 | 28 | 5 |
| Mobilität | 18.905 | 96 | 14 | 59 | 63 | 6 |
| Umwelt | 11.431 | 59 | 12 | 21 | 38 | 5 |
| **Kultur** | **51.659** | **220** | 8 | **176** | **190** | 5 |
| Was geht | 16.211 | 106 | 9 | 31 | 53 | 26 |
| Sonne | 3.021 | 35 | 4 | 0 | 18 | 5 |
| **Durchschnitt** | **16.191** | **92** | 8,7 | 39 | 54 | 7,4 |

## Messwerte Mobil (390×844)

| Reiter | A11y-Bytes | Interaktiv | Listeneinträge | Buttons | Links |
|---|---:|---:|---:|---:|---:|
| Startzustand | 18.360 | 96 | 59 | 63 | 6 |
| Nähe | 14.304 | **134** | 27 | 106 | 13 |
| Kultur | 51.115 | 220 | 176 | 190 | 5 |
| **Was geht** | **29.940** | **152** | 61 | 69 | **41** |
| Sonne | 2.477 | 35 | 0 | 18 | 5 |

**Mobil ist in drei von fünf Fällen schwerer als Desktop.** „Was geht" wächst von
16.211 auf 29.940 Bytes und von 26 auf 41 Links. Die mobile Ansicht ist kein eigenes
Design, sondern dasselbe Panel in geringerer Breite — auf dem kleinsten Bildschirm
trifft die volle Informationsdichte.

## Referenz: Apple Karten (Desktop-Startzustand)

| Merkmal | Apple Karten | Open Stuttgart (Ø) | Faktor |
|---|---:|---:|---:|
| A11y-Bytes | 974 | 16.191 | **17×** |
| Interaktive Elemente | 14 | 92 | **6,6×** |
| Sichtbare Überschriften | 1 | 8,7 | **9×** |
| Reiter | 0 | 13 (8 Themen + Filter) | – |
| Schalter im Startzustand | 0 | 1–8 | – |

Der Startzustand von Apple Karten besteht aus **drei Einstiegen**: Suchen, Reiseführer,
Route. Alles Weitere erscheint erst nach einer Nutzerentscheidung.

## Diagnose

### 1. Kein Startzustand — nur ein Endlos-Report

Beim Öffnen sind sofort Unfallatlas-Statistik („1.635 Unfälle"), Pünktlichkeitshistorie
seit 2024, Verspätungsgründe, Parkhäuser, P+R und Radzählstellen sichtbar. Das sind
**Antworten auf Fragen, die niemand gestellt hat**. Der Nutzer wird nicht gefragt, was er
will, sondern mit dem gesamten Datenbestand begrüßt.

Belegt: Startzustand Desktop zeigt 12 Überschriften und 75 interaktive Elemente, bevor
der Nutzer irgendetwas getan hat. Selbst unmittelbar nach dem Laden (vor Datenankunft)
stehen bereits 47 interaktive Elemente und 10 Abschnitte im Baum.

### 2. Die Themenreiter sind Datenkategorien, keine Anliegen

Der Reiter „Mobilität" enthält mindestens sechs verschiedene Anliegen: Haltestellen,
Unfallatlas, Baustellen, Pünktlichkeit, Bahn am Hauptbahnhof, Parken, Radverkehr.
Nutzer denken in Anliegen („Wo kann ich parken?", „Komme ich pünktlich weg?"), nicht in
Datenquellen. Der Reitername erfüllt ein Erwartungsversprechen, das der Inhalt nicht hält.

### 3. Drei Navigationserebenen verschachtelt

„Kultur" enthält **22 Reiter**, „Was geht" **25 Reiter** — jeweils 8 Themenreiter plus
14 beziehungsweise 17 Filterreiter *innerhalb* des Panels. Der Pfad zu einem Inhalt lautet
also: Themenreiter → Filterreiter → langer Listenblock. Auf Mobil verschärft sich das,
weil Filter und Liste in derselben Spalte liegen.

### 4. Kartensteuerung doppelt

Der Block „Auf der Karte" mit seinen Schaltern erscheint in fast jedem Reiter (8 Schalter
in „Mobilität", 6 in „Umwelt", 2 in „Kultur") — **und** gibt es „Kartenebenen" als eigene
Schaltfläche in der Kartensteuerung. Ebenen sind ein Karten-Interessenraum, kein
Inhaltsabschnitt zwischen Haltestellenwahl und Statistik.

### 5. Keine progressive Disclosure

Jeder der 9 bis 14 Abschnitte wiederholt dasselbe Muster:
Überschrift → „Wie entsteht dieser Wert" → Fließtext → Liste → zwei Quellenabsätze.
Die Quellen- und Lizenzangaben sind rechtlich notwendig und fachlich ein Alleinstellungs-
merkmal — sie gehören aber in eine aufklappbare dritte Ebene, nicht in den Lesefluss.

### 6. Zahlen ohne Handlung

„0 (7 Tage)" an Radzählstellen, „1.635 Unfälle", „99 % pünktlich" — Werte ohne
erkennbare nächste Aktion. Die Vorbilder setzen Aktion vor Information: erst „Route",
dann Details.

## Besondere Befunde

- **Kultur ist der Ausreißer**: 220 interaktive Elemente, 176 Listeneinträge, 190 Buttons,
  51.659 Bytes — das 53-Fache des Referenz-Startzustands. 159 Veranstaltungen plus
  Aussichtspunkte plus Sehenswürdigkeiten in einem einzigen, ungebremsten Listenblock.
- **„Nähe" hat 101 Buttons**, mehr als jeder andere Reiter außer Kultur, bei nur
  17 Listeneinträgen. Die Buttons stammen aus dicht gestapelten Einrichtungsblöcken.
- **„Sonne" bleibt im Ladezustand**: auch nach 3,5 s steht „Berechnung läuft …" im Baum.
  Die Schattenberechnung im Web Worker hat keinen sichtbaren Fortschritt und keinen
  Abbruch.
- **Defekt**: `/api/roadworks` liefert im Startzustand **502 Bad Gateway**
  (REA-Console-Event, Evidence `ev_21f830cd…`).
- **A11y-Technik ist gut, die Architektur nicht.** Rollen, `switch`-Semantik, `status`-
  Region, Skip-Link und `prefers-reduced-motion` sind korrekt umgesetzt. Das Problem ist
  nicht mangelnde Sorgfalt im Markup, sondern die Menge und Anordnung des Inhalts.

## Zielbild: drei Schichten statt Themen-Endlosschleife

**Schicht 1 — Einstieg** (leerer Zustand, höchstens 20 interaktive Elemente)
Große Suche als dominantes Element, darunter 6 bis 8 **Anliegen-Chips** statt
8 Themenreiter. „In der Nähe" lebt als Kartenansicht, nicht als Liste.

Vorschlag für die Anliegen: **Ankommen · Parken · Erledigen · Losgehen · Was geht ·
Wetter & Luft**. Jeder Chip bündelt genau die Datenblöcke, die heute über mehrere Reiter
verteilt sind.

**Schicht 2 — Kontext** (nach Auswahl)
Ein Anliegen = ein fokussierter Ablauf mit **einer** Primäraktion. Detail rechts
(Desktop) beziehungsweise Bottom Sheet (Mobil). Primäraktionen ganz oben, wie bei den
Vorbildern: **Route · Teilen · Merken · In der Nähe**.

**Schicht 3 — Tiefe** (aufklappbar)
„Wie entsteht dieser Wert", Quellen, Lizenzen, Historie, Grenzen der Berechnung —
eingeklappt, außerhalb des Leseflusses. Der Transparenz-Charakter bleibt erhalten,
verschwindet aber nicht hinter Fließtext.

## Zielmetriken und erreichte Werte

Gemessen mit REA nach dem Umbau, gleiche Methode, gleicher Browser, gleiche Viewports.

| Kennzahl | Ist vorher (Desktop Ø) | Ziel | **Ist nachher** | Bewertung |
|---|---:|---:|---:|---|
| Interaktive Elemente im Einstieg | 75 | ≤ 20 | **24** | knapp verfehlt, siehe unten |
| Sichtbare Abschnitte im Einstieg | 12 | ≤ 3 | **2** | erreicht |
| Themenreiter im Einstieg | 8 | 0 | **0** | erreicht |
| A11y-Bytes Einstieg | 12.206 | ≤ 3.000 | **2.106** | erreicht |
| Quellenabsätze im Lesefluss | 13 | 0 | **0** | erreicht |
| Kultur: interaktive Elemente | 220 | – | **56** | −75 % |
| Kultur: Listeneinträge | 176 | – | **11** | −94 % |
| „Was geht": interaktive Elemente | 106 | – | **59** | −44 % |
| „Was geht" mobil | 152 | – | **59** | −61 % |
| Einstieg mobil | 96 | – | **25** | −74 % |
| Panel-Scrolllänge | ~15.000 px | ~1.200 px | ~1.500 px | erreicht |

### Die verbleibenden 24 Elemente im Einstieg

Das Ziel ≤ 20 ist um vier Elemente verfehlt. Die Zusammensetzung:

| Elemente | Anzahl | Notwendig? |
|---|---:|---|
| Anliegen-Chips | 6 | ja — Kern der Navigation |
| Kartensteuerung (Zoom, Ebenen, 3D, Luftbild, Kompass, Hell/Dunkel) | 7 | ja — Kartenanwendung |
| Suche + „Alles durchsuchen" | 2 | ja |
| Aufklappbare Blöcke („Alle Themen", „Über diese Anwendung") | 2 | ja — sonst wären es 14 |
| Statusmeldungen (Wetter, Luftqualität) | 2 | kontextuell, sinnvoll |
| Hinweisbanner Großveranstaltung | 1 | kontextuell |
| Sprungmarke „Zum Inhalt springen" | 1 | ja — Barrierefreiheit |
| Sonstige (Marke, Text) | 3 | nein, nicht interaktiv |

Zum Vergleich: Apple Karten hat 14 interaktive Elemente, davon 5 Kartensteuerung und
9 Fußzeilen-Links. Die Zahl ist also nicht auf null zu drücken, ohne Funktion zu verlieren.
**Empfehlung:** Zielwert auf ≤ 25 korrigieren statt Elemente zu entfernen, die ihren Zweck haben.

### Vorher-Nachher je Ansicht (Desktop 1440×900)

| Ansicht | Bytes vorher | Bytes nachher | Interaktiv vorher | Interaktiv nachher |
|---|---:|---:|---:|---:|
| Einstieg | 12.206 | **2.106** | 75 | **24** |
| Anreise & Umstieg | 9.376 | 8.517 | 46 | **33** |
| Parken & Rad | 18.905 | 10.266 | 96 | **51** |
| Verkehr & Bahn | 18.905 | 12.953 | 96 | **58** |
| Amt & Service | 10.709 | 9.555 | 67 | **47** |
| Freizeit & Kultur | 16.211 | **7.286** | 106 | **59** |
| Wetter & Luft | 11.431 | 9.814 | 59 | **39** |
| Kultur (über „Alle Themen") | 51.659 | **5.851** | 220 | **56** |

### Vorher-Nachher mobil (390×844)

| Ansicht | Bytes vorher | Bytes nachher | Interaktiv vorher | Interaktiv nachher |
|---|---:|---:|---:|---:|
| Einstieg | 18.360 | **2.073** | 96 | **25** |
| Freizeit & Kultur | 29.940 | **6.767** | 152 | **59** |
| Kultur | 51.115 | **5.851** | 220 | **56** |

**Mobil und Desktop liegen jetzt gleichauf** (jeweils 59 interaktive Elemente in
„Freizeit & Kultur"). Der Befund „mobil schwerer als Desktop" ist behoben.

Ergänzend zu den im `ux-benchmark-maps.md` genannten sieben Kriterien:
Time-to-first-result, Anteil leerer Suchen, Abbruchrate auf Mobil.

## Was unverändert bleibt

- Farbwelt, Typografie (DM Sans, Merriweather Sans), Karten-CI, Geländerelief, Dunkelmodus.
- **„Wie entsteht dieser Wert"** als Methode der Transparenz.
- Quellen- und Lizenzangabe für jeden einzelnen Wert.
- Barrierefreiheitsprofile beim Routing (stufenfrei, Kinderwagen).
- Skip-Link, `prefers-reduced-motion`, Tastaturbedienung.
- Shareable URLs (`#karte=…`, `?stop=…`).

**Zwei Suchen wurden zu einer (22.10.2026, zweiter Durchgang)**

Vorher standen im Kopf zwei getrennte Suchfelder nebeneinander: „Haltestelle suchen"
(lokal über 724 Halte) und „Alles durchsuchen ⌘ K" (serverseitig über 10.289 Dokumente).
Das war der offensichtlichste Mangel am Einstieg — Google und Apple führen genau ein
Suchfeld. Jetzt ist es eines:

- `src/components/Search.tsx` — ein einziges Suchfeld, das beides gleichzeitig findet.
  Die Ergebnisse erscheinen gruppiert in einem Ausklappfeld darunter:
  **Haltestellen** (lokal, sofort, inklusive Linien) und **Seiten, Leistungen und
  Dokumente** (lokal aus `suche.sqlite`, mit Typfiltern).
- `src/components/DocumentReader.tsx` — der Dokumentenleser als eigene Ansicht. Wird
  geöffnet, wenn ein Dokument gewählt wird, und lässt sich über Bezugsquellen, verwandte
  Dokumente und Backlinks weiterverfolgen, ohne die Suche zu verlassen.
- `src/components/EverythingSearch.tsx` ist **entfallen**; ihr Inhalt steht jetzt in den
  beiden obigen Komponenten. Der zugehörige CSS-Block wurde ebenfalls entfernt.
- `⌘ K` setzt den Fokus in dieses eine Feld. Es gibt keinen zweiten Einstieg mehr.

Gemessen (Evidence `ev_a7801f15…`, `ev_f6cf9a5e…`, `ev_4c4f4723…`):

| Eingabe | Ergebnis im selben Feld |
|---|---|
| „Charlottenplatz" | Haltestelle **mit Linien** (S2E, U1, U2, U4) **und** Dokumente |
| „Personalausweis" | 140 Leistungen, davon die ersten 12 mit Ablauf und Rechtsgrundlage |

Ein Klick öffnet den Dokumentenleser mit Ablauf und Zuständigkeit, Bezugsquellen,
verwandten Dokumenten, Backlinks, Gebühren, Rechtsgrundlage und Originalseite.
Anzahl Suchfelder im Dokument: **1**.

**Pill-Layout nach Vorbild (22.10.2026, dritter Durchgang)**

Nach Sichtprüfung der gebauten Oberfläche (REA-Screenshots) wurde das Grundlayout auf das
Muster von Google Maps umgestellt, ohne die Designsprache zu ändern:

- **Suche als Pill unten zentral.** Ein einziges Suchfeld, rundum abgerundet, mit
  Platzhalter, `⌘ K`-Hinweis und einer Akzent-Aktion „Route planen" rechts — analog zum
  Routensymbol im Vorbild. Bei Klick öffnet sich das Ergebnisfeld **nach oben**, nicht
  nach unten (`src/components/Search.tsx`, `.search-dock`, `.search-pill`).
- **Schnellaktionen als Pills oben über der Karte** (`src/components/QuickActions.tsx`).
  Sechs Anliegen mit Icon und Kurzform — `Anreise · Parken & Rad · Verkehr · Service ·
  Freizeit · Wetter & Luft` — horizontal scrollbar, mit Verlauf rechts als Hinweis darauf.
  Die Kurzform ist nötig, damit die Reihe bei 1440 px nicht abgeschnitten wird; der
  vollständige Text steht als Tooltip und für Screenreader zur Verfügung.
- **Panel links, Detail rechts** wie gewohnt.

Dabei wurden zwei Kollisionen behoben, die erst im Screenshot sichtbar wurden:
Das Hinweisbanner zur Großveranstaltung und die Statusanzeigen (Wetter, Luftqualität)
standen noch auf `top: 16 px` und wurden von der Pills-Reihe überdeckt. Beide liegen jetzt
darunter (`top: 66 px`); auf Mobil stehen die Statusanzeigen über dem Such-Pill.

## Umgesetzt (22.10.2026)

**Informationsarchitektur**

- `src/lib/anliegen.ts` — Anliegen-Modell: sechs Anliegen mit Hinweis, Zielmodul, Fokus,
  Ebenen und Primäraktion. Themenreiter bleiben über „Alle Themen" erreichbar.
- `src/components/StartPanel.tsx` — Schicht 1, der Einstieg: „Was möchtest du tun?",
  sechs Anliegen-Chips, darunter aufklappbar „Alle Themen" und „Über diese Anwendung".
- `src/App.tsx` — `moduleId` kann jetzt `null` sein (Einstieg). Themenreiterzeile entfernt,
  dafür Brotkrume „Einstieg / Thema" im Panel. Anliegen öffnen das Panel, schalten die
  passenden Ebenen zu und setzen den Fokus.

**Progressive Disclosure**

- `src/components/ui.tsx` — `Section` kann jetzt eingeklappt werden (`collapsible`,
  `defaultOpen`), neu `Disclosure` und `ShowMore`. `Source` kann mit `disclosure` die
  Quellen- und Lizenzangabe einklappen.
- Der Abschnitt „Auf der Karte" ist in allen sechs Panels eingeklappt. Er ist eine
  Kartenangelegenheit und steht zusätzlich in der Kartensteuerung zur Verfügung.
- Quellen- und Lizenzangaben sind in allen Panels eingeklappt, inhaltlich unverändert.
- `CulturePanel` zeigt acht statt aller kommenden Veranstaltungen, `WasGehtPanel` zwölf
  Termine — beide mit „Weitere anzeigen".
- `MobilityPanel` öffnet je Anliegen andere Abschnitte: „Parken & Rad" zeigt Parkhäuser,
  P+R und Radverkehr; „Verkehr & Bahn" zeigt Unfallatlas, Verkehrsmeldungen und Bahn.
- `WasGehtPanel` klappt „Neu in der Stadt", „Meldungen", „Stadtgedächtnis",
  „Unterwegs am Abend" und „Quellen und Lizenzen" ein.

**Behobene Defekte**

- `/api/roadworks` lieferte **502 Bad Gateway**. Zwei Ursachen:
  1. Der GeoServer-Layer `…_geplant…` hat ein defektes Schema — er meldet das Feld
     `VERKEHRSAUSWIRKUNG`, das in der Tabelle nicht existiert, und antwortet auf eine
     vollständige Abfrage mit einer OWS-ServiceException in XML statt JSON. Dadurch
     scheiterte `res.json()` und der ganze Abruf fiel aus.
     *Behoben* durch eine feste Attributliste je Layer (`propertyName`) mit nur den Feldern,
     die in beiden Layern wirklich vorhanden sind.
  2. Ein Fehler eines einzelnen Layers ließ den gesamten Abruf scheitern.
     *Behoben* dadurch, dass jeder Layer getrennt abgefangen wird (`failed`-Liste in der
     Antwort), plus eine Absicherung, die bei Ausfall eine ehrliche leere Liste liefert statt
     eines Fehlers.
  - Ergebnis: **54 Baustellen** (50 im Bau, 4 geplant) statt 502.
- Der Ladezustand „Sonne" blieb ewig auf „Berechnung läuft …" stehen: ohne Ortsdaten kehrte
  der Effekt in `useSunDay` frühzeitig zurück und startete nie eine Rechnung. Jetzt wird
  „Warte auf Ortsdaten …" von „Berechnung läuft …" unterschieden, ein Abbruch des Workers
  wird gemeldet, und nach 30 Sekunden ohne Ergebnis erscheint ein ehrlicher Hinweis.

**Was bewusst nicht geändert wurde**

Farbwelt, Typografie, Karten-CI, Geländerelief, Dunkelmodus, „Wie entsteht dieser Wert",
Quellen- und Lizenzangabe je Wert, Barrierefreiheitsprofile, Skip-Link,
`prefers-reduced-motion`, Tastaturbedienung und shareable URLs.

## Offene Punkte

1. **Zielwert ≤ 20 interaktive Elemente im Einstieg prüfen.** Erreicht sind 24. Die
   verbleibenden sind überwiegend Kartensteuerung und Barrierefreiheit — sie zu entfernen
   würde Funktion kosten. Empfehlung: Zielwert auf ≤ 25 anheben.
2. **Datumsleiste in „Was geht"** zeigt 17 Reiter. Das ist die letzte hohe Einzelzahl;
   sinnvoll wäre eine Ausgabe auf die nächsten sieben Tage mit aufklappbarer Fortsetzung.
3. **Ablaufmessung der drei Kernflüsse** (Parken, pünktlich heim, Route) als
   Vorher-Nachher-Vergleich. Die reinen Zahlen sind mit dem Umbau gemessen, die
   Klickpfade noch nicht.
4. **Mobiles Eigenlayout.** Mobil und Desktop sind jetzt gleichauf, aber ein eigenes
   mobiles Informationsmodell (Bottom Sheet statt Panel-Spalte) wäre weiterhin ein Gewinn.
5. **Vector-Suche und Prisma-Frage** sind zurückgestellt. Kurzfassung: Die Embeddings in
   `vec_chunks` (10.200 Chunks, `multilingual-e5-small`, 384 Dimensionen) fehlen noch.
   Prisma ist für die jetzige Stufe nicht sinnvoll, weil FTS5 und `sqlite-vec` virtuelle
   Tabellen sind, die Prisma nicht abbildet, und die Datenbank abgeleitet und
   überwiegend read-only ist. Prisma wird erst interessant bei Postgres plus pgvector,
   Redaktionsworkflows und Mehrbenutzerbetrieb.
6. **Geländekacheln (Terrain)** schlagen in isolierten Netzen fehl (`elevation-tiles-prod`
   nicht erreichbar). Die Anwendung bleibt nutzbar, die 3D-Geländedarbietung entfällt
   dann. Ein Hinweis im Zustand „3D nicht verfügbar" wäre ehrlicher als ein stiller Verlust.
