# UX-Kritik und Korrekturplan „Open Stuttgart"

Externe UI-/UX-/Flow-Begutachtung, Stand 22.10.2026.
Auftrag: harsche Kritik, vollständige Liste des Verbesserungswürdigen, und das Optimum an Korrektur.

**Kurzfassung, ungeschönt:** Das Datenangebot ist herausragend, die Oberfläche wirkt wie eine
Behörden-Ausstellungshalle: Alles ist da, nichts ist gefragt worden. Die App beantwortet
200 Fragen, bevor sie eine gestellt hat. Dazu kommen zwei übereinandergelegte Designsysteme,
die sich gegenseitig kaputtmachen, ein Einstieg mit zwei konkurrierenden Navigations­systemen,
mindestens sechs UserFlows, die ohne Ergebnis enden, und eine Reihe harter Barrierefreiheits-
Verstöße in genau den Elementen, die am häufigsten benutzt werden. Dazu stand der Build bei
Prüfbeginn kaputt.

Das ist nicht „noch ein bisschen Feinschliff". Das ist eine Überarbeitung der
Informationsarchitektur und ein Ablösen des Doppel-CSS. Beides ist machbar, ohne die
bestehende Designsprache (Amber/Tinte, DM Sans/Merriweather Sans, eigener Kartenstil,
Transparenz je Wert) zu verlieren — sie ist nämlich gut und darf bleiben.

---

## 1. Was geprüft wurde

| Ebene | Basis |
|---|---|
| Gerenderte Oberfläche | REA-Browser-Szenarien gegen den laufenden Build (`node server/index.mjs`, :8787), Chrome headless, de-DE, Europe/Berlin, Light, 1440×900 und 390×844, Screenshot + Accessibility-Baum je Schritt (Evidence `ev_6bf397ef…`, `ev_9b9a4d5c…`) |
| Quelltext | `src/` (34 Komponenten, 8 Module, 3 CSS-Dateien, `map/`, `lib/`), Zeilenangaben unten |
| Bestehende Unterlagen | `docs/ux-audit.md` (22.10.2026) und `docs/ux-benchmark-maps.md` als Vergleichsbasis — Widersprüche dazu sind unten ausdrücklich benannt |

Nicht geprüft: Backend-Datenqualität, Lizenzen, Performance der Quellen. Sie fließen nur ein,
wo sie die Oberfläche sichtbar machen (z. B. Ladezeiten > 7 s).

---

## 2. P0 — Blocker

### 2.1 Der Build war kaputt (behoben)
`src/modules/route/RoutePanel.tsx` enthielt ein überzähliges `</div>` (eingefügt im laufenden
Arbeitsstand, im Diff als reine `+`-Zeile sichtbar). `npm run build` brach mit drei Syntaxfehlern
ab, `dist/` war veraltet. **Ein Commit, der nicht baut, ist kein Zwischenstand, sondern ein
Verlust.** Das eine Zeichen habe ich entfernt; der Build läuft wieder.
*Maßnahme:* Build-Lauf als Pflicht in `npm run dev`-Workflow (z. B. `tsc --noEmit` vor jedem
Commit, oder `npm run build` als CI-Gate). Ein UI-Projekt, das man nicht starten kann, kann man
nicht begutachten — und niemand kann eure Arbeit benutzen.

### 2.2 Ein Render-Zeiger kann das gesamte Panel abschießen
`src/modules/wasgeht/WasGehtPanel.tsx:291` — `new URL(e.ticketUrl)` ohne `try/catch` im Render.
Eine einzige kaputte URL aus einer fremden Quelle wirft im Render und reißt die gesamte
„Was geht"-Ansicht in die Fehlergrenze. *Korrektur:* URL validieren und im Zweifel weglassen
(`try { u = new URL(...) } catch { u = null }`), nie im Render parsen.

### 2.3 Modale Dialoge liegen unter der Karten-UI
`src/styles/app.css:628` setzt `.info-backdrop` auf `z-index: 40`; `src/styles/search.css:189`
(`.quick-actions`) steht auf **55**, `.search-dock` (`search.css:94`) auf **60**, `.layers-backdrop`
auf 70, `.cmdk-backdrop` auf 80. Der Dialog „Über diese Anwendung / Barrierefreiheit" wird also
von den Schnellaktionen und der Suchpille **überlagert**. Ein modaler Dialog, der nicht oben
liegt, ist kein Dialog. *Korrektur:* eine einzige z-Index-Skala definieren (siehe Abschnitt 5.4).

### 2.4 Detailansichten rendern bei fehlenden Daten eine leere Fläche
`src/components/Details.tsx:233, 273, 308, 351, 372` und `src/components/CultureDetails.tsx:219, 273`
— jeweils `if (!x) return null`. Wer zu früh klickt, den Link teilt oder nach einem Refresh
kommt, sieht ein weißes Rechteck ohne Erklärung, ohne Zurück, ohne Ladeanzeige. Das ist der
häufigste Weg in eine Sackgasse der gesamten App. *Korrektur:* ein einziges `DetailFallback`
mit drei Zuständen (Lädt / Nicht gefunden / Fehler + „Zurück zur Liste").

---

## 3. Die Kritik

### 3.1 Der Einstieg erklärt sich selbst — und fragt nichts

Der Startzustand (Screenshot 1440×900) besteht aus: Kopfzeile mit Logo (130 px), einer Frage
(„Was möchtest du tun?"), einem **Erklärungssatz darüber, wo man suchen kann**
(„Oben findest du die häufigsten Anliegen, unten suchst du direkt nach einem Ort …"),
dem aufgeklappten Block „Alle Themen" mit 8 Zeilen und „Über diese Anwendung" (6 Einträge).
Dazu 6 Anliegen-Pills oben.

- **14 Navigationspunkte im Einstieg, zwei Vokabularsysteme.** Pills: *Anreise · Parken & Rad ·
  Verkehr · Service · Freizeit · Wetter & Luft*. Liste: *Nähe · Verwaltung · Weg · Mobilität ·
  Umwelt · Kultur · Was geht · Sonne*. Die Zuordnung ist nicht 1:1 und nirgends erklärt:
  Führt „Weg" oder „Anreise" zur Route? Ist „Freizeit" dasselbe wie „Kultur" oder „Was geht"?
  Wer 20 Sekunden nachdenkt, hat schon verloren. (`src/lib/anliegen.ts`, `src/modules/index.ts`)
- **Der zweite Satz des Einstiegs ist Anleitungstext.** Wenn die Oberfläche erklären muss,
  wo die Suche steht, ist die Suche nicht gut genug platziert. (StartPanel.tsx:14-16)
- **Die Karte ist im ersten Moment leer** (Daten kommen, Kacheln laden), und rechts hängt eine
 7-köpfige Leiste mit „3D", Luftbild, Kompass, Mond — Optionen, die kein Mensch in den ersten
 30 Sekunden braucht. (App.tsx:329-347)
- **„Alle Themen" ist als Rückfall gedacht, steht aber aufgeklappt über dem Falz.**
  Ein Rückfall, der im ersten Blickfeld steht, ist keiner. (StartPanel.tsx:19)

### 3.2 Zwei Navigationsmodelle, zwei Erebenen, ein Ziel

Die Pills sind gut (Google-Muster, schnell erreichbar). Das Problem ist, dass das Panel
parallel weiterhin die alte Themenwelt führt — und die Sprache beider Welten auseinanderläuft:
Pill „Service" → Panel „Amt & Service" → Modul „Verwaltung"; Pill „Freizeit" → Panel
„Freizeit & Kultur" → Modul „Was geht"; Pill „Anreise" → Panel „Anreise & Umstieg" → Modul „Weg".
Der Brotkrume zeigt dann „Einstieg / Anreise & Umstieg" und daneben als Kontext „Weg".
(App.tsx:283-292). Drei Namen für dieselbe Sache auf einem Bildschirm.

**Es darf genau eine Navigation geben.** Die Themenliste ist nur noch die vollständige
Ablage — degradiert zu „Alle Themen" *geschlossen* unterhalb der Karte, oder in ein Menü.

### 3.3 Kernflüsse — durchgespielt

#### Flow A „Zum Konzert, wie komme ich hin?"
1. Pill „Freizeit" → Panel „Freizeit & Kultur".
2. **Erste sichtbare Zeile ist die Hero-Box mit „Daten werden geladen …"** — nach 7 Sekunden
   immer noch (Screenshot, Evidence `ev_6bf397ef…`). Der Titelbereich zeigt den Ladezustand
   als Überschrift. (WasGehtPanel)
3. Zwei Datumsreihen (Seg „Heute Abend / Morgen / Wochenende" **und** Tagestreifen „Heute /
   Morgen / Sa 24. / So 25. …"), beide scrollen, beide filtern, keine Zahlen.
4. Vier Filterchips, darunter ein Absatz, der den Filter erklärt.
5. Termin anklicken → **inline** aufgeklappt; in „Kultur" öffnet derselbe Termin ein
   **Sheet**. Zwei Realitäten für dieselbe Aktion (WasGehtPanel:237 vs. CultureDetails:216).
6. Das Aufklappen **fliegt zusätzlich die Karte weg** — auf Mobil unsichtbar, auf Desktop ein
   unerwarteter Sprung. (WasGehtPanel:237)
7. „Ort und Anreise" sucht per `o.find(o => o.lat === e.lat)` — **Float-Vergleich**. Findet er
   nichts, passiert nichts: toter Knopf. (WasGehtPanel:162-167)
8. Anreise steht in der Detailansicht auf Platz ~8, hinter Teaser, Fakten, Tags, Quelllinks,
   Wetter. Die Primärfrage ist die zweitletzte. (CultureDetails:229-252)

**Bewertung: 4 von 10.** Der Inhalt ist da, der Weg dorthin ist ein Parcours.

#### Flow B „Ich will parken"
1. Pill „Parken & Rad" → Panel, Panel beginnt (mobil, Screenshot) **mit einem Lizenzabsatz**
   zu DB-Verspätungsdaten („Peri-5-Lizenz, Meldeschlüssel …") — Quellenblock vor jedem Inhalt.
2. „Parkhäuser, aktuelle Belegung" ist dagegen **exzellent**: „39 % durchschnittlich belegt",
   Balken, „2 Parkhäuser voll oder nahezu voll belegt." Das ist die richtige Form.
3. Darunter 5 Häuser, sortiert nach **meisten freien Plätzen** statt nach Entfernung
   (MobilityPanel:45: `sort((a,b) => (b.free ?? 0) - (a.free ?? 0))`) — „Milanoo 2065 frei"
   ist für niemanden relevant, der in Stuttgart-Mitte steht.
4. In der Liste „Parkhäuser" steht **„P+R Österfeld"**, zwei Abschnitte später beginnt
   „Park+Ride (P+R) am Stadtrand" — dasselbe Objekt doppelt, in zwei Kategorien.
5. Klick auf eine P+R-Zeile: die Karte fliegt zur **Anlage**, das Sheet zeigt die **Haltestelle**
   (MobilityPanel:227-233). Karte und Detail zeigen verschiedene Dinge.
6. `ParkingDetail` (Details.tsx:230-268) endet nach Adresse, Preis, Betreiber — **ohne
   „Verbindung suchen", ohne „Route", ohne Öffnungszeiten**. Der Flow stirbt.

**Bewertung: 3 von 10.** Der einzig wirklich gute Block (Belegungs-Summary) wird von vier
Fehlentscheidungen eingekreist.

#### Flow C „Amtsleistung erledigen"
1. Pill „Service" → „Amt & Service" → 12 **hartkodierte** Kernleistungen (VerwaltungPanel:68-81).
   Kein „Alle Leistungen". Was nicht in der Suche steckt, ist unerreichbar.
2. Suche „Leistung, Amt oder Straße suchen" — die Straßentreffer der API werden **verworfen**
   (VerwaltungPanel:52 liefert `gebaeude`, gerendert werden nur `leistungen`/`einheiten`).
   Das Feld verspricht also etwas, das es nicht hält.
3. Die Suche hat **keinen Lade- und keinen Fehlerzustand** (VerwaltungPanel:188 rendert nur
   `bei suche.data`). Während des Ladens bleibt der Bildschirm unverändert — nichts zeigt, dass
   überhaupt gesucht wurde.
4. Leistung öffnen → Textblöcke → Ende. Kein Rücksprung, keine verwandten Leistungen,
   kein „Zuständigkeit für meine Adresse". (VerwaltungDetail:400-407)
5. Termin-CTA heißt je nach Ort „Termin buchen", „Termin vereinbaren" oder
   „Terminbuchung verfügbar".

**Bewertung: 4 von 10.**

#### Flow D „Haltestelle / Abfahrt suchen"
1. Die globale Suche verspricht „Ort, Haltestelle, Amt …" (Search.tsx:135), findet aber nur
   Haltestellen und Dokumente. Adresssuche existiert nur in „Nähe" (ab 4 Zeichen) und „Weg"
   (ab 3 Zeichen) — **drei Mindestlängen für dasselbe Bedürfnis** (Search, NearbyPanel:111,
   RoutePanel:45).
2. Trefferliste auf 12 Dokumente gedeckelt, die Fußzeile nennt aber `data.total`
   (Search.tsx:40 vs. :258) — „140 Treffer", sichtbar sind 12, ohne „mehr".
3. StopDetail zeigt 18 Abfahrten, dann ist Schluss (Details.tsx:59).

**Bewertung: 6 von 10.** Am wenigsten kaputt, aber das Versprechen im Platzhalter stimmt nicht.

#### Flow E „Route A → B"
1. Formular oben im dunklen Kasten; **Swap-Knopf liegt auf dem „Von"-Feld**
   (app.css:695 `right:14px; top:14px`) — auf schmalen Displays überlappt er Eingabe und
   „Ändern"-Link.
2. „Abfahrt" ist vorgesehen, **„Ankunft" fehlt** (RoutePanel:251). Für Konzert/Arbeit die
   halbe Frage.
3. Profil ≠ Standard + Reiter „Auto" anklicken: Anfrage wird nicht gestellt, Zusammenfassung
   sagt „nicht bei diesem Profil", **unter dem Reiter erscheint nichts** (RoutePanel:186, 231).
   Ein leerer Zustand ohne Erklärung.
4. Die Reiterzusammenfassung zeigt immer `varianten[0]`, die Detailansicht folgt der Auswahl
   (RoutePanel:234 vs. :189) — der Reiter kann etwas anderes versprechen als geliefert wird.
5. Fuß- und Radrouten zeigen Dauer/Strecke/Höhenprofil, aber **keinen Verlauf** — das Feld
   `anweisungen` existiert und wird nie gerendert (RoutePanel:21, 300).
6. Jeder Klick auf Profil/Modus/Zeit löscht alle vier Ergebnisse neu (lib/api.ts:28-31),
   danach vier parallele Polls + Unfallkorridor-Rechnung → Skelett-Flackern als Normalzustand.
7. Unten hängt „Wanderwege und Rundwege — 21 Wege" mit fünf Filterchips — für „A nach B"
   reines Scroll-Hindernis, für „Wandern" der falsche Ort (der Flow heißt dann „Anreise").
8. Statt einer Erklärung, warum das Feld leer ist, steht dort: „In jeder Detailansicht führt
   ‚Verbindung suchen' hierher." — die App dokumentiert ihre eigene Navigation im Fließtext.

**Bewertung: 5 von 10.**

### 3.4 Interaktion und Zustände

| Befund | Beleg |
|---|---|
| Rohfehler im Klartext: „Termine nicht verfügbar: 502 …" | CulturePanel:121, WasGehtPanel:223, Search.tsx:193 |
| Andere Panels zeigen für denselben Fehler „Derzeit nicht abrufbar." | MobilityPanel:188 |
| Ganz stumm: Verwaltungssuche, Adresssuche, PlaceField, P+R, Rad, Geocaching, Gieß-Radar | VerwaltungPanel:113/188, NearbyPanel:111/181, RoutePanel:45/69, MobilityPanel:217/255, NearbyPanel:68 |
| Stale-Daten nicht gekennzeichnet: alter Stand wirkt live | Gates überall `error && !data`, z. B. NearbyPanel:204 |
| Jeder Parameterwechsel leert die Listen (URL-Reset) | lib/api.ts:28-31 |
| Vier „mehr anzeigen"-Muster, drei Disclosure-Implementierungen | ui.tsx:67/88, CulturePanel:133/149, WasGehtPanel:303/327, RouteButtons:10 |
| `ShowMore` erzeugt `<button>` als direktes Kind von `<ul>` — ungültiges Markup | CulturePanel:132-136 + ui.tsx:96-108 |
| Pfeil zeigt Aktion an, Klick tut nichts (Hills in „Sonne") | SunPanel:180, 190 |
| Kartenmitte als bewegliches Ziel: jeder Pan sortiert „In der Nähe" neu | NearbyPanel:107, 127-130 |
| Kein Zurück: Detail ersetzt Liste, DocumentReader ohne Historie | Details.tsx:389-403, DocumentReader:191 |
| Gleiche Wartezeit-Ampel dreifach kopiert, eine Variante weicht ab (`w-mittel` statt `w-kurz`) | VerwaltungPanel:85-90, VerwaltungDetail:118-124, VerwaltungSection:76-81, NearbyPanel:210 |
| `fmtDist` viermal dupliziert, `readAddr` zweimal mit anderem Shape | VerwaltungPanel:83, VerwaltungSection:74, VerwaltungDetail:116, NearbyPanel:28, RoutePanel:40 |
| Clipboard-Fehler werden geschluckt — Knopf reagiert scheinbar nicht | VerwaltungDetail:137-140, MyAddress:339 |

### 3.5 Visuelles System: zwei CSS-Systeme, die sich gegenseitig umbringen

Geladen wird `app.css` → Komponenten-Styles → `design-pass.css` (main.tsx:8-10). Der Design-Pass
ist bewusst als Überschichtung gebaut („darf deshalb gezielt bestehende Regeln überschreiben",
design-pass.css:13). **Das Ergebnis ist ein System ohne verbindliche Werte.**

- **Dieselbe Datei, zwei Werte:** `--radius` 24 px (app.css:27) vs. 26 px (design-pass.css:24),
  `--shadow` komplett verschieden, `--accent-hover` ist `#C28800` **und** `#e0a000`.
- **~80 hartcodierte Hex-Neben ~25 Tokens**, davon ~15 leicht verschiedene Gelb-/Orangetöne
  für dieselbe Aussage („mittel/belegt/warn") und drei Rote für „kritisch".
- **29 Schriftgrößen** (10 … 56 px, inkl. 10,5 / 11,5 / 12,5 / 13,5 …), **40+ Border-Radius**,
  „8er-Raster" als Kommentar, Abstände wie 17 px und 13 px 12 px 13 px 18 px.
- **Tote Dinge:** `--warn-bg` und `--link` werden benutzt, aber nie definiert (app.css:570, 646);
  die Klasse `ghost` wird in sechs Komponenten gesetzt und existiert in keiner CSS-Datei.
- **Der Pass hat Fehler geschaffen, nicht nur gelöst:**
  - `.aerial-card`: app.css:551 setzt mobil `top: 70px`, design-pass setzt `bottom: 46dvh+12px`
    und vergisst `top` zurückzusetzen → die Box **streckt sich über die halbe Karte** und
    überdeckt mit `z-index:5` die Kartensteuerung (`4`).
  - Suchpille vs. Kartensteuerung: ab 1181 px mit offenem Detail liegt die Suchpille
    (design-pass.css:1408) **auf dem Kontrollstapel** (design-pass.css:1399) — Überlappung
    bei 1280–~1510 px Breite.
  - `.status-cluster` mobil: app.css:557 `bottom: 78px` vs. design-pass.css:1622
    `top: calc(safe-area + 122px)` — zwei Anker für dieselbe Komponente.
  - `.facts div`-Labelspalte in **sechs** Breiten (110/112/118/130/132/138 px).
- **Alles in px, kein einziges rem:** die Schriftgrößeneinstellung des Browsers hat keinen
  Effekt. Inputs mit 15 px/15,5 px lösen auf iOS beim Fokus den Zoom aus (design-pass.css:853, 1544).

### 3.6 Barrierefreiheit: gute Technik, falsche Architektur

Das Markup ist sorgfältig (Skip-Link, `role="switch"`, `aria-pressed`, `prefers-reduced-motion`,
`prefers-contrast`). Die Verstöße liegen woanders:

1. **`outline: none` in beiden Haupteingabefeldern** (search.css:21, 238) — im wichtigsten Feld
   der App gibt es für Tastaturnutzer **keinen Fokusindikator**. WCAG 2.4.7 direkt verfehlt.
2. **Fokusregel `border-radius: 6px`** (design-pass.css:100) verwinkelt alle Pills beim
   Tastaturfokus (`.quick-pill` hat 99 px) — der Fokus sieht aus wie ein Renderingfehler.
3. **`aria-live="polite"` auf der gesamten Detailansicht** (App.tsx:369) — beim Öffnen liest der
   Screenreader Hunderte Zeilen vor. Live-Regionen gehören auf den Status, nicht auf die Seite.
4. **`role="status"` mit interaktivem Knopf im BigEventBanner** (BigEvent.tsx:40-50) —
   Live-Region und Interaktion schließen sich aus.
5. **Zustände nur farbig** (Belegung, Luft, Live-Stufe, Unfallschwere) — und es gibt
   **keine Kartenlegende** im gesamten Code (nur `.sun-legend`).
6. **Touch-Ziele flächig unter 44 px:** Schließen-Knöpfe 30×30 (app.css:519, 528),
   `.explain` 22×22, `.layer-switch` 34×20, `.seg button` 30 px, `.chip` 34 px,
   **Marker-Hitbox 12×12 px** (MapView.tsx:344).
7. **`aria-label`s sind hartkodiert Deutsch**, obwohl `tr()` existiert — der Sprachumschalter
   ist halb tot (App.tsx:264/329/350/369, QuickActions:16, RouteButtons:9-13, ui.tsx:100).
8. **Kein einziges `:disabled`/`aria-disabled`** im gesamten UI — „wird geladen" zeigt nur Opacity.
9. **`Icon` rendert bei unbekanntem Namen still ein „info"-Symbol** (Icon.tsx:63) — ein
   Fehl-Icon sieht aus wie eine Absicht.
10. **`prefers-reduced-motion` als Atomschlag** (`* { animation: none !important }`,
    app.css:564) schaltet auch den Lade-Spinner ab — er steht dann starr da und sieht defekt aus.

### 3.7 Mobil: dasselbe Panel in weniger Breite

- Der Suchpille liegt oben, die Pills-Reihe darunter **wird abgeschnitten** („Anreise · Parken &
  Rad · Verkehr …") ohne sichtbaren Scroll-Hinweis, die Statuspills darüber schieben sich in
  dieselbe Zone, rechts steht der volle Kartensteuerungsstapel — in einem 390-px-Bildschirm
  konkurrieren oben vier Ebenen um ~200 px.
- **Die Quellzeile klebt unter der Suche** („Relief: Mapzen Terrain Tiles | OpenFreeMap …")
  und bricht zweizeilig um.
- Das Bottom Sheet ist kein Bottom Sheet, sondern das Panel, das von unten wächst:
  **keine Wischgeste, keine Zwischenposition** (App.tsx:265-268 schaltet nur peek/open),
  Handle 100×28 px, **im Detail-Sheet gibt es gar keinen Handle** (App.tsx:368-372),
  64 dvh sind nicht verkleinerbar.
- **Fünf gestapelte Ebenen in festen px** (12/74/122 px, design-pass.css:1530-1646): bei
  667 px Höhe und offenem Sheet verschwinden die unteren Kartenknöpfe (u. a. der Theme-Umschalter)
  hinter dem Sheet; in Landscape (844×390 greift der 900-px-Break!) ist der Stapel komplett
  begraben. Keine einzige Orientierungs-Media-Query im CSS.
- `safe-area-inset` wird für oben/unten beachtet, **nie links/rechts** — in Landscape liegt die
  Notch auf Panel-Inhalt.
- Kamera-Padding rechnet mit 62 %/45 %, das Sheet ist 64 dvh/46 dvh (App.tsx:120-127 vs.
  design-pass.css:1673) — Marker landen beim Anwählen hinter dem Sheet. Dazu ist das Padding
  einmalig berechnet, ohne Resize-/Orientation-Listener.

### 3.8 Sprache und Ton

- **Sie und Imperativ gemischt:** „an dem **Sie** die Leistung erledigen" (VerwaltungPanel:278)
  neben „Erneut laden", „Filter aufheben".
- **Vier Datumsformate** (`Do 23.` / `heute (Donnerstag, 20.10.)` / `20.10.2026` / Giess-Radar),
  **zwei Währungen** („ab 12 Euro" vs. „ab 12 €"), **Uhr mal mit, mal ohne „Uhr"**,
  „vor 5 min" neben „Minuten".
- **UTC-Fehler im Abfallmodul:** `new Date().toISOString().slice(0,10)` (NearbyPanel:163) —
  um Mitternacht UTC werden Termine falsch als vergangen markiert. `berlinDate` existiert
  bereits (format.ts:58).
- **Fachjargon im Nutzertext:** „Eco-Counter-Querschnitte", „ParkAPI", „GBFS", „dl-de/by-2-0",
  „Peri-5-Lizenz", „Meldeschlüssel", „ADS-B", „Radiosonde". Gehört in die Quellenangabe,
  nicht in den Fließtext.
- **Implementierungssprache:** „Filter (Chips)" als Beschriftung (VerwaltungPanel:262).
- **Unübersetzte Reste trotz Sprachumschalter** — `tr()` lässt unbekannte Texte auf Deutsch
  (i18n.ts:64), das Wörterbuch hat 31 Einträge (nur Überschriften).
- **Keine Silbentrennung im ganzen Repo**, dafür 9× `text-overflow: ellipsis` auf genau den
  Langwörtern („Barrierefreiheit", „Verantwortliche Stelle", Suchtreffertitel).

---

## 4. Was gut ist — und bleiben muss

Ehrlich, weil Kritik ohne das hier unglaubwürdig wäre:

1. **„Wie entsteht dieser Wert?" plus Quelle und Lizenz an jedem einzelnen Wert.** Das ist
   europaweit ein Alleinstellungsmerkmal. Es muss nur aus dem Lesefluss heraus (Abschnitt 5.2).
2. **Die Belegungs-Zusammenfassung „39 % durchschnittlich belegt · 2 Parkhäuser voll"**
   (Screenshot mobil) — genau so muss Information aussehen: Zahl, Einordnung, Konsequenz.
3. **Der eigene Kartenstil, das Relief, die Linienfarben, die Haltestellen-Badges.** Wiedererkennbar.
4. **Barrierefreiheitsprofile beim Routing (stufenlos, mit Kinderwagen) inkl. Aufzugsstatus.**
5. **Die Breite der Datenquellen** (50+ Quellen, alle verlinkt) — das ist die Substanz des Produkts.
6. **Technische Sorgfalt im Markup** (Skip-Link, `role="switch"`, `aria-pressed`, Reduced Motion,
   Dark Mode über `data-theme`) — die Probleme liegen in der Architektur, nicht in der Sorgfalt.

---

## 5. Das Optimum an Korrektur

### 5.1 Leitprinzipien (verbindlich, vor jedem Merge prüfbar)

1. **Eine Frage pro Bildschirm.** Jede Ansicht hat genau eine Primäraktion und beantwortet
   zuerst die Frage, die zu ihr geführt hat.
2. **Eine Navigation, eine Sprache.** Ein Begriff je Ding, in Pills, Panel, Detail und Karte.
3. **Erst Handlung, dann Erklärung.** Alles, was Methodik, Quelle, Lizenz, Historie ist,
   liegt eine Ebene tiefer — vollständig erhalten, aber nicht im Lesefluss.
4. **Jeder Zustand ist gestaltet:** Laden, leer, veraltet, Fehler, offline — mit nächstem Schritt.
5. **Ein Designsystem.** Eine Token-Datei, eine Implementierung je Muster, kein Überschreiben
   über zwei Dateien.

### 5.2 Ziel-Informationsarchitektur: drei Schichten

```
Schicht 1  Einstieg (≤ 20 sichtbare Bedienelemente)
           [ Suchfeld ————————————————  Route ]
           Anreise · Parken · Erledigen · Losgehen · Was geht · Wetter & Luft
           ─────────────────────────────────────────────
           Karte als Bühne, keine Liste

Schicht 2  Anliegen (ein Fokus, eine Primäraktion oben)
           [ Primäraktion ] [ Teilen ] [ Merken ] [ In der Nähe ]
           2–4 Abschnitte, die die Frage beantworten
           Detail rechts (Desktop) / Bottom Sheet (Mobil)

Schicht 3  Tiefe (aufklappbar, immer vorhanden)
           „Wie entsteht dieser Wert" · Quellen & Lizenzen · Historie · Grenzen der Berechnung
```

Konkrete Auflösung der Doppel-Navigation:

| Pill (bleibt) | Panel-Inhalt | Altes Vokabular, das entfällt |
|---|---|---|
| Anreise | Weg: Verbindung, Abfahrten, Umstieg | „Weg", „Anreise & Umstieg" |
| Parken | Parkhäuser, P+R, Bike+Ride, Sharing | Teil von „Mobilität" |
| Erledigen | Amt & Service: Leistung → Zuständigkeit → Termin | „Verwaltung", „Service", „Amt & Service" |
| Losgehen | Kultur, Natur, Aussicht, Wanderwege | „Kultur", Teil von „Nähe", Wandersektion aus „Weg" |
| Was geht | Termine heute/ab Ende, Szene | „Was geht" (Name passt) |
| Wetter & Luft | Wetter, Radar, Luft, Hitze, Wasser | „Umwelt", „Sonne" als Abschnitt darin |

„Alle Themen" bleibt erhalten, aber **geschlossen und unten**, als vollständige Ablage —
nicht als zweite Navigation im ersten Blickfeld.

**Reihenfolge innerhalb eines Anliegens folgt der Aufgabe, nicht der Datenquelle.**
Beispiel „Parken": 1. Belegungs-Summary (schon vorhanden), 2. Häuser **nach Entfernung**
sortiert, 3. P+R getrennt, 4. Alternativen bei Vollauslastung („2 Parkhäuser voll — P+R
Österfeld hat 382 Plätze, 12 Min. zur S-Bahn"), 5. Tiefe (Quellen).

### 5.3 Die fünf Kernflüsse als Ablaufspezifikation

**A. „Zum Konzert"** — Ziel: in ≤ 3 Interaktionen zur Anreise.
1. Pill „Was geht" → Liste der Termine **mit Datum, Uhrzeit, Ort, Gehzeit zur Haltestelle**
   in jeder Zeile. Keine zweite Datumsreihe: eine Reihe „Heute · Morgen · Sa · So · …" mit
   Trefferzahl je Tag, Rest in „Alle Tage".
2. Termin → **ein** Detail (Sheet, gleiche Komponente wie in „Losgehen"), Reihenfolge:
   Titel/Zeit → **Primäraktion „Verbindung suchen"** → Ort + Anreise (Haltestelle, Gehzeit,
   Parkhaus) → Beschreibung → Wetter zum Beginn → Tiefe.
3. „Verbindung suchen" → Flow E mit vorausgefülltem Ziel; Rückkehr über „Zurück" mit
   erhaltenem Scrollstand.
Abbruchkriterium: Anreise ist sichtbar, ohne dass gescrollt werden muss.

**B. „Parken"** — Ziel: freien Platz mit Weg dorthin.
1. Pill „Parken" → Summary (bleibt) → Liste **nach Fußweg** sortiert, jede Zeile mit
   `Entfernung · frei/gesamt · Preis`.
2. Zeile → Detail mit Primäraktion **„Verbindung suchen"** (fehlt heute komplett) und
   Sekundäraktion „Auf der Karte".
3. P+R in eigener Gruppe; Klick zeigt P+R **und** die zugehörige Haltestelle gemeinsam
   (eine Zuordnung für Karte und Detail).
4. Ist die Innenstadt > 85 % belegt, steht der Hinweis **bei der Liste**, mit Handlung:
   „Innenstadt fast voll — P+R Österfeld: 382 Plätze".
Abbruchkriterium: Aus jedem Listeneintrag führt eine Aktion weiter, kein Detail ohne Primäraktion.

**C. „Amtssache"** — Ziel: die richtige Stelle mit Termin.
1. Pill „Erledigen" → **ein** Suchfeld (Platzhalter: „Was möchtest du erledigen?"),
   darunter 6 häufige Leistungen **plus „Alle Leistungen (1.2xx)"**.
2. Suche zeigt Lade- und Fehlerzustand und liefert **alle** Trefferarten (Leistung, Stelle,
   Gebäude, Straße) — mit Typfilter, nicht mit Wegwerfen.
3. Leistung → Voraussetzungen/Unterlagen/Gebühren → **„Zuständig für meine Adresse"** →
   Primäraktion „Termin buchen" (ein Wortlaut überall) → Tiefe.
Abbruchkriterium: Von der Leistung zur Terminbuchung ohne Zurückgehen.

**D. „Abfahrt"** — Ziel: die nächste Verbindung in ≤ 2 Interaktionen.
1. Ein Suchfeld global (Orte, Adressen, Haltestellen, Leistungen — ein Index, eine
   Mindestlänge von 2 Zeichen, eine Ergebnisdarstellung mit Typ-Badge).
2. StopDetail: nächste 10 Abfahrten, „Weitere anzeigen", Filter je Verkehrsmittel,
   Live-Stale-Kennzeichnung („Stand 14:30 Uhr, keine Echtzeit").
Abbruchkriterium: Keine Ergebnisliste endet ohne „mehr" oder „keine Treffer".

**E. „Route"** — Ziel: eine Verbindung, die man versteht.
1. Von/Nach mit gemeinsamer Suche; **Swap daneben, nicht darüber**; „Abfahrt | Ankunft" als Seg.
2. Reiter Zusammenfassung zeigen **die gewählte** Variante (nicht `varianten[0]`).
3. Nicht passende Kombinationen (Auto + stufenlos) werden **deaktiviert** (`aria-disabled`
   + Grund im Tooltip), nicht leer gerendert.
4. Fuß/Rad zeigen den Verlauf (`anweisungen` existiert bereits).
5. Wanderwege bekommen den eigenen Anliegen-Punkt „Losgehen" — nicht das Routenformular.

### 5.4 Designsystem: eine Schicht, verbindliche Werte

**Sofort (halber Tag):**
- `z-index` als Skala in einer Datei: `--z-map: 1 … --z-modal: 100 --z-toast: 110`.
  Modal immer über allem (behebt 2.3).
- Tote Tokens/`ghost`/`--warn-bg`/`--link` definieren oder entfernen.
- `.aerial-card` mobil `top: auto` setzen (behebt 3.5).
- `outline: none` in `search.css:21/238` entfernen, Fokusring über `outline: 2px solid
  var(--focus-ring); outline-offset: 2px` — **ohne** `border-radius`-Eingriff (behebt 3.6.1/2).
- Inputs auf `font-size: 16px` (iOS-Zoom).
- Kontraste: `.chip small` (11,5 px @ 68 % → 3,1:1), `.section-toggle:hover h3`
  (`#e0a000` auf Weiß → 2,1:1), `.img-credit` über Fotos — alle auf ≥ 4,5:1 bringen.

**Danach (1–2 Tage):** `tokens.css` als einzige Quelle:
`--space-1…8` (4er-Raster), `--text-xs…3xl` (max. 6 Stufen, in `rem`), `--radius-s/m/l/pill`
(4 statt 40+), `--surface-*`, `--state-ok/warn/crit/info` (jeweils **eine** Farbe + Symbol),
`--shadow-1/2/3`. Danach `app.css` und `design-pass.css` verschmelzen: die Werte des Passes
gelten, `app.css` enthält nur noch Struktur ohne Farben/Maße. Kriterium: `grep -o '#[0-9a-fA-F]\{6\}'`
liefert ≤ 12 Treffer (Tokens + Kartenfarben).

**Wiederkehrende Muster, je genau eine Implementierung:**
`Section` (kollabierbar), `Disclosure` (Tiefe), `ShowMore` (Listenlänge), `Chip` (Filter/Toggle/Link
als Variante mit klarer Rolle), `Seg` (immer `radiogroup`), `DetailFallback`, `ErrorNote`
(immer mit `onRetry`), `Source` (immer `disclosure`). Verboten: `<details>`, eigene
`more-btn`, Hand-HTML-Sektionen, `waitDotClass`-Kopien, `fmtDist`-Kopien.
`ShowMore` rendert `<li>`-Kinder oder wird außerhalb der `<ul>` platziert (behebt Markup-Fehler).

### 5.5 Zustandsmatrix (für jede Datenanzeige verbindlich)

| Zustand | Anzeige | Aktion |
|---|---|---|
| lädt | Skelett in echter Zeilenhöhe (kein Layout-Shift) | – |
| leer | „Keine X in dieser Auswahl." + Filter zurücksetzen | vorhanden |
| veraltet | „Stand 14:30 Uhr — keine Echtzeit" (`LiveDot stale`) | „Neu laden" |
| Fehler | „X derzeit nicht abrufbar." (kein Rohfehler) | **immer** „Erneut laden" |
| Teilfehler | Block ersetzen, Rest behalten | „Block neu laden" |

Details nutzen immer `DetailFallback` statt `return null`. Parameterwechsel darf bestehende
Daten nicht leeren: alte Liste sichtbar lassen, bis die neue kommt (behebt lib/api.ts:28-31
und das Skelett-Flackern).

### 5.6 Mobil: eigenes Informationsmodell

1. **Bottom Sheet mit drei Rasten** (peek 22 dvh · medium 52 dvh · full 88 dvh),
   **ziehbar** (Pointer-Events, `touch-action: none` am Handle), Handle 44 px Trefferfläche,
   **auch im Detail-Sheet**.
2. Oben nur noch zwei Lagen: Suche (12 px) + Pills (darunter). Statuspills **ins Panel** oder
   in die Suche integrieren. Kartensteuerung wird in **eine** Schaltfläche „Kartenoptionen"
   zusammengefasst, die das LayerSheet öffnet.
3. Landscape: Sheet wird zur Seitenspalte (50 %), `safe-area-inset-left/right` beachten.
4. Kamera-Padding aus denselben Variablen wie das CSS (`--sheet-h`), mit Resize-Listener.
5. Attribution einzeilig, in die Kartenfußleiste.

### 5.7 Barrierefreiheit — Abnahmekriterien

- Sichtbarer Fokus an **jedem** fokussierbaren Element (Test: nur mit Tab durchklicken).
- Kein Bedienelement unter 44×44 px Trefferfläche (auch Marker: 24 px sichtbar, 44 px Hitbox).
- `aria-live` nur auf Statuszeilen („3 Verbindungen gefunden"), nie auf ganzen Ansichten.
- Jeder farbig koderte Zustand zusätzlich mit Text/Symbol; Kartenlegende als eigenes Sheet.
- Alle Texte inkl. `aria-label`/`title` durch `tr()` — Sprachumschalter darf nicht halb tot sein.
- Schriftgrößen in `rem`; Kontraste ≥ 4,5:1 (Text) bzw. 3:1 (UI).
- `prefers-reduced-motion` schaltet Kamerafahrten ab, **nicht** den Lade-Indikator.

### 5.8 Messplan

Vor dem Umbau erheben (eine Stunde, REA wie in `docs/ux-audit.md`), danach gegen dieselbe
Methode prüfen:

| Kennzahl | Ist | Ziel |
|---|---:|---:|
| Interaktive Elemente im Einstieg | 24 | ≤ 20 |
| Navigationsvokabulare im Einstieg | 2 | **1** |
| Klicks „Einstieg → Anreise sichtbar" (Flow A) | ~6 | **≤ 3** |
| Klicks „Einstieg → freier Parkplatz mit Route" (Flow B) | ~8 (endet ohne Route) | **≤ 3** |
| Sichtbare Quellen-/Methodikabsätze im Lesefluss | 12 | 0 |
| Panels mit definiertem Fehlerzustand | ~40 % | 100 % |
| Detailansichten ohne `return null` | 2/9 | 9/9 |
| Touch-Ziele < 44 px | ~14 | 0 |
| CSS-Dateien mit Farbwerten | 3 | 1 |

---

## 6. Maßnahmenkatalog

### P0 — diese Woche
1. Build-Gate (`tsc --noEmit` vor jedem Commit). *(behoben, Regel fehlt)*
2. `new URL()` im Render absichern (WasGehtPanel:291).
3. z-Index-Skala, Dialoge nach oben (app.css:628).
4. `DetailFallback` statt `return null` (7 Stellen).
5. `outline: none` entfernen, Fokusring korrigieren (search.css:21, 238; design-pass.css:100).
6. `.aerial-card` mobil (design-pass.css:1652) und Suchpille/Controls-Überlappung ab 1180 px
   (design-pass.css:1399/1408) beheben.
7. Parkhäuser nach Entfernung sortieren, P+R aus der Parkhausliste nehmen (MobilityPanel:45).
8. Rohfehler durch `ErrorNote` ersetzen (3 Stellen), Fehlerzustand in der Verwaltungssuche.

### P1 — nächste zwei Wochen
9. Eine Navigation: Pills sind die einzige Steuerung, „Alle Themen" geschlossen und unten.
10. Einheitliche Sprache je Ding (eine Tabelle in `docs/`, aus der `tr()` gespeist wird).
11. Flows A–E nach Spezifikation 5.3 umbauen (Reihenfolge, Primäraktionen, „Ankunft",
    „anweisungen" rendern, Auto-Tab deaktivieren statt leer).
12. Zustandsmatrix 5.5 in allen Panels; Parameterwechsel ohne Datenverlust.
13. Komponenten konsolidieren (5.4): eine Implementierung je Muster, Duplikate löschen
    (`fmtDist`, `waitDotClass`, `readAddr`).
14. Mobiles Sheet mit drei Rasten und Drag; Kartensteuerung zu einer Schaltfläche.

### P2 — danach
15. `tokens.css`, Verschmelzen von `app.css` und `design-pass.css`, Farben auf ≤ 12.
16. `rem`-Umstellung, Silbentrennung (`hyphens: auto` + `lang="de"`), Ellipsen durch Umbruch.
17. Kartenlegende, Marker-Hitboxen, Auswahl-Feedback (Halo-Kontrast 1,3:1 ist zu wenig).
18. Zeit-/Datums-/Währungshelfer zentralisieren, UTC-Fehler im Abfallmodul (NearbyPanel:163).
19. Teilen/Merken (LocalStorage) als zweite Primäraktion — der Nutzer kommt für einen Termin
    heute zweimal in die App (herausfinden, hingehen) und hat keinen Weg, zu speichern.
20. Sichtbare Ladefortschritte („Sonne", Kultur) mit Abbruch statt „Berechnung läuft …".

---

## 7. Abschluss

Das Produkt hat die schwierigste Arbeit gemacht: Daten sammeln, verknüpfen, sauber
kennzeichnen. Was fehlt, ist der Teil, den Nutzer bewerten — der Weg von der Absicht zur
Antwort. Aktuell ist die App eine **Datenbibliothek mit Suchfeld**; sie muss eine
**Auskunft mit Datenbibliothek dahinter** werden. Die drei Hebel mit dem größten Effekt:

1. **Eine Navigation, eine Sprache** (Abschnitt 5.2) — löst die Hälfte der Verwirrung.
2. **Primäraktion je Ansicht, Reihenfolge nach Aufgabe** (5.3) — macht aus Flows Sackgassen Wege.
3. **Ein Designsystem statt zweier** (5.4) — behebt die sichtbaren Layoutfehler und macht
   künftige Änderungen billig.

Alle drei sind ohne Datenverlust und ohne Verlust der bisherigen Designsprache machbar.
Der Aufwand für P0 ist in einem Tag erledigt; P1 ist eine Woche fokussierter Arbeit.
