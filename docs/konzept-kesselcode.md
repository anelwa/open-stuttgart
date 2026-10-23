# Kesselcode

**Das Open-Stuttgart-Stadtspiel — fünf Routen, ein Routenbuch und Antworten, die wirklich vor Ort stehen.**

Stand: 22. Oktober 2026 · Für Open Stuttgart · Entwurf · Arbeitstitel „Kesselcode“

> Dies ist ein Konzept, kein fertiges Produkt. Orte, Aufgaben und Beispielantworten sind vor der
> Veröffentlichung vor Ort zu prüfen. Besonders Jahreszahlen, Inschriften und Wege können sich durch
> Sanierung, Baustellen oder Umbauten ändern. Jede Station braucht ein Prüfdatum und eine zweite Person,
> die die Antwort unabhängig bestätigt.

> **Umsetzung:** Die erste Fassung ist als Modul `spiel` eingebaut. Die redaktionellen Daten liegen in
> `scripts/build-spiel-data.mjs` (generiert `server/data/spiel/routen.json`), die Antwortprüfung in
> `server/sources/spiel.mjs`. Die Zahlen in diesem Konzept sind die Planung; maßgeblich für die App ist
> der Datensatz.

## Inhalt

1. Die Idee
2. Warum das zu Open Stuttgart passt
3. Spielprinzip
4. Die fünf Routen
5. Aufgaben, Antworten und redaktionelle Regeln
6. Routenbuch, Punkte und Abzeichen
7. Gestaltung und UX
8. Technik
9. Produktion und Betrieb
10. Risiken und offene Fragen
11. Nächste Schritte

## Auf einen Blick

| | |
|---|---|
| **Spielidee** | Eine Schnitzeljagd durch Stuttgart, bei der die Antworten an den Orten selbst stehen: Jahreszahlen, Inschriften, Tiere, Symbole, Stufen, Namen. |
| **Routen** | 5 Routen mit unterschiedlicher Länge, Dauer und Schwierigkeit: 2 bis 8 Stunden, 4 bis 13 Kilometer, 8 bis 13 Stationen. |
| **Fortschritt** | Lokal im Browser, ohne Konto, ohne Serverprofil. Teilen als Ergebnisbild oder Challenge-Link, nicht als Personenprofil. |
| **Belohnung** | Ein Siegel pro Station, ein Kapitel pro Route, ein „Kesselwappen“ für alle fünf Routen. Dazu eine sammelbare Stadtwissen-Karte mit Quelle. |
| **Besonderheit** | Das Spiel nutzt die vorhandenen Open-Stuttgart-Daten: Haltestellen, Abfahrten, Wetter, Sonnenuntergang, Baustellen, Warnungen, Trinkbrunnen, Toiletten und Höhenprofile. |
| **Haltung** | Kein Countdown, kein Ranking, keine Werbung, keine Push-Nachrichten, keine gekauften Orte. Die Stadt ist kein Spielplatz, sondern der Grund für das Spiel. |

---

## 1. Die Idee

Stuttgart liegt im Kessel. Wer die Stadt zu Fuß erkundet, stößt alle paar Meter auf eine Geschichte:
eine Jahreszahl über einem Portal, einen Hirsch im Wappen, einen Hahn auf einem Kirchturm, sechs Enten
an einem Brunnen, 175 Stufen, die nach oben führen. Genau diese Dinge sollen die Aufgaben sein.

**Kesselcode** ist eine Schnitzeljagd, die ohne versteckte Dosen und ohne QR-Aufkleber auskommt. An jeder
Station steht eine Frage, deren Antwort tatsächlich dort zu finden ist. Man liest, zählt, schaut genau hin,
kombiniert und tippt die Antwort in die App. Stimmt sie, gibt es ein Siegel, einen kurzen Stadtwissen-Text
mit Quelle und den nächsten Suchraum. Am Ende setzt man aus den Buchstaben der Hauptstationen das
Lösungswort der Route zusammen und schließt das Kapitel ab.

Fünf Routen erzählen fünf verschiedene Stuttgarter Geschichten: die Innenstadt, den Neckar, die Nacht,
die Weinberge und die Höhen. Jede Route funktioniert für sich. Wer alle fünf abschließt, bekommt das
**Kesselwappen** — ein eigenes, fiktives Wappen aus fünf Siegeln, kein Stadtwappen.

Die Rahmenhandlung ist bewusst leicht: Eine alte **Kesselchronik** ist in fünf Kapitel zerfallen. Die
Spielerinnen und Spieler sind Spurensucher und setzen sie wieder zusammen. Wer keine Geschichte mag,
kann sie überspringen. Die Rätsel funktionieren auch ohne.

### Leitprinzipien

1. **Ort vor Kulisse.** Jede Station ist ein echter Ort mit einer echten Geschichte, keine erfundene
   Station und keine reine Dekoration.
2. **Die Antwort steht vor Ort.** Keine Frage, die man nur mit Internetwissen lösen kann.
3. **Die Stadt ist kein Spielplatz.** Respekt vor Anwohnern, Kirchen, Friedhöfen, Naturschutz und
   privatem Grund.
4. **Kein Zwang.** Keine Zeitlimits, keine Rangliste, keine Streaks, keine Push-Nachrichten.
5. **Sicherheit vor Rätsel.** Keine Aufgabe ist wichtiger als der sichere Weg.
6. **Ehrliche Barrierefreiheit.** Keine pauschalen Versprechen; Etappen, Treppen und Steigungen werden
   benannt.
7. **Daten mit Quelle.** Jede Stadtwissen-Karte nennt Quelle und Lizenz.
8. **Pflege statt Einmal-Liste.** Jede Station hat ein Prüfdatum und eine zweite Person, die die
   Antwort bestätigt.

---

## 2. Warum das zu Open Stuttgart passt

Open Stuttgart ist keine reine Karten-App. Es ist ein Ort, an dem Stadtwissen mit Quelle, Datum und
Grenzen sichtbar wird. Das Spiel setzt genau dort an:

- **Die Infrastruktur ist schon da.** Karte, Ortsdaten, Haltestellen, Abfahrten, Wetter, Sonnenstand,
  Warnungen, Baustellen, Trinkbrunnen, Toiletten und der Routenplaner existieren bereits. Das Spiel
  braucht keine neue Datenwelt, sondern eine neue Erzählform für die vorhandene.
- **Die Werte bleiben erhalten.** Kein Konto, kein Tracking, keine Werbung, keine bezahlte Reihenfolge.
  Fortschritt liegt lokal. Das passt zu einem Projekt, das bewusst ohne Nutzerprofile arbeitet.
- **Stadtwissen statt Quiz.** Nach jeder gelösten Station gibt es keine beliebige Fun-Fact-Karte, sondern
  einen kurzen, belegten Text: Warum steht diese Säule hier? Wer baute dieses Haus? Was erzählt der
  Brunnen? Mit Quelle und Lizenz, wie im Rest der App.
- **Abgrenzung zu Geocaching und kommerziellen Stadtführungen.** Keine versteckten Dosen, kein
  Geocaching.com-Scraping, keine Ticketverkäufe, keine Affiliate-Links. Die Route bleibt frei zugänglich;
  Attraktionen mit Eintritt sind nur freiwillige Bonusstationen und klar gekennzeichnet.
- **Barrierefreiheit als Teil des Konzepts.** Nicht jede Route ist für alle gleich geeignet. Das wird
  offen gesagt, statt mit einem pauschalen „barrierefrei“ zu werben. Route 1 ist barrierearm, Route 2
  kinderwagenfreundlich, die anderen Routen haben Treppen, Steigungen oder Nachtwege.

---

## 3. Spielprinzip

### 3.1 Die Spielschleife

1. **Route wählen.** Fünf Kapitel mit unterschiedlichem Charakter, Dauer und Schwierigkeit.
2. **Ankommen.** Die App zeigt Startpunkt, Anreise mit Bus und Bahn, Wetter und was man mitnehmen sollte.
3. **Suchraum finden.** Statt eines exakten Pins gibt es einen Suchraum und einen Text: „Du stehst vor
   dem Gebäude mit den zwei ungleichen Türmen.“ Der genaue Punkt wird erst beim Ankommen enthüllt.
4. **Aufgabe lösen.** Antwort eintragen: eine Zahl, ein Jahr, ein Wort, eine Auswahl, eine Richtung.
5. **Siegel und Stadtwissen.** Die App bestätigt, erzählt die Geschichte weiter und zeigt die Quelle.
6. **Nächster Suchraum.** Die Route füllt sich, die Karte zeigt nur den bereits gelaufenen Weg.
7. **Finale.** Aus den Buchstaben der Hauptstationen entsteht das Lösungswort. Wer es eintippt, schließt
   das Kapitel ab.
8. **Routenbuch.** Alle Siegel, Zeiten, Hinweise und Stadtwissen-Karten bleiben lokal gespeichert.

### 3.2 Der Reiz liegt im genauen Hinsehen

Die besten Aufgaben sind keine Wissensfragen, sondern Beobachtungsfragen:

- Wie viele Reliefs sind am Fuß der Jubiläumssäule? (4)
- Welches Tier trägt den Reiter im Innenhof des Alten Schlosses? (Pferd)
- Wie viele Enten sitzen am Hans-im-Glück-Brunnen? (6)
- Wie viele Stufen hat die Eugenstaffel? (175)
- Wie viele Meter Trümmerschutt wurden auf den Birkenkopf geschüttet? (rund 40)

Die Antwort steht nicht im Internet, sondern vor der Nase. Das ist der Unterschied zwischen einem
Stadtquiz und einer Schnitzeljagd.

### 3.3 Antworttypen

| Typ | Beispiel | Prüfung |
|---|---|---|
| **Zahl** | Wie viele Stufen? | Zahl mit Toleranz, z. B. ±1 oder ±5 Prozent |
| **Jahr** | In welchem Jahr wurde das Denkmal enthüllt? | exakte Jahreszahl, Toleranz nur bei unklaren Inschriften |
| **Wort** | Welches Tier trägt den Reiter? | normalisierter Text, Aliase, Umlautvarianten |
| **Zählung** | Wie viele Säulen hat die Kolonnade? | Zahl, bei großen Mengen mit Toleranz |
| **Auswahl** | Welche Kuppelform? | Multiple Choice mit vier bis sechs Optionen |
| **Richtung** | In welche Himmelsrichtung zeigt der Hahn? | acht Himmelsrichtungen, optional mit Kompass |
| **Live** | Wann geht die Sonne heute unter? | Zeitfenster, berechnet aus den vorhandenen Daten |
| **Karte** | Wo steht das Denkmal? | Tippen auf die Karte, Radius |
| **Foto** | Dein schönster Blick | nur lokal, keine Prüfung, keine Uploads; reine Bonusaufgabe |
| **Finale** | Setze das Lösungswort zusammen | Buchstaben aus den Hauptstationen |

Keine Aufgabe verlangt einen freien Aufsatz. Alles ist eindeutig prüfbar. Bei mehreren plausiblen
Schreibweisen hilft eine Alias-Liste: „Reitwagen“ akzeptiert auch „Motorrad“ oder „Einspur“, „Galatea“
auch „Galathea“, „Bad Cannstatt“ auch „Cannstatt“, „U5“ auch „5“.

### 3.4 Hilfen, Pausen und Fairness

- **Drei Hinweisstufen.** Stufe 1 lenkt den Blick, Stufe 2 wird konkreter, Stufe 3 nennt die Lösung und
  zeigt den Stadtwissen-Text. Hinweise sind kein Scheitern, sondern Teil des Spiels.
- **Kein Countdown.** Die angegebene Dauer ist eine Empfehlung, keine Frist. Die Zeit wird gemessen,
  aber nicht bestraft. Pausen sind ausdrücklich erlaubt.
- **Kein Scheitern.** Nach der dritten falschen Antwort wird die Lösung angeboten. Wer eine Station
  nicht lösen kann, kommt weiter.
- **Standort nur auf Knopfdruck.** Die App fragt nicht im Hintergrund nach dem Standort. Ein Tipp auf
  „Bin ich hier?‘ prüft die Nähe, zeigt aber keine exakte Distanz und speichert nichts. Wer keinen
  Standort freigeben will, bestätigt einfach „Ich bin da“.
- **Keine Rangliste gegen andere.** Es gibt lokale Bestzeiten und persönliche Abzeichen, aber keine
  globale Bestenliste. Das Spiel soll niemanden unter Druck setzen.
- **Keine Dark Patterns.** Keine Streaks, keine täglichen Quests, keine Push-Nachrichten, keine
  künstliche Verknappung, keine Werbung für Orte.

### 3.5 Das Lösungswort

Jede Route hat ein Lösungswort. Die Hauptstationen liefern die Buchstaben, die Bonusstationen geben
zusätzliche Siegel und Stadtwissen. Am Ende fragt die App das Wort ab.

| Route | Lösungswort | Hauptstationen |
|---|---|---|
| Der Kessel-Code | **KESSEL** | 6 |
| Neckar & Nymphen | **NECKAR** | 6 |
| Nachtschicht | **DUNKEL** | 6 |
| Stäffele & Wein | **WEINBERG** | 8 |
| Gipfelstürmer | **GIPFEL** | 6 |

Das Wort ist kein Passwort und kein Sicherheitsmerkmal. Es ist der Abschluss der Geschichte und steht
bewusst nicht auf dem Teilen-Bild, damit es nicht gespoilert wird. Die Buchstaben sind willkürlich
auf die Hauptstationen verteilt; sie ergeben erst am Ende das Wort.

### 3.6 So sieht eine Station aus

```text
┌──────────────────────────────────────────┐
│ KESSELCODE                    Kapitel I  │
│ Der Kessel-Code                2:14 h    │
│ ●●●●○○○○   4 von 8 Siegeln              │
├──────────────────────────────────────────┤
│ Station 5 · Schillerdenkmal              │
│                                          │
│ In welchem Jahr wurde das Denkmal        │
│ enthüllt?                                │
│                                          │
│ [ 1839                         ]         │
│ [ Antwort prüfen ]                       │
│                                          │
│ Hinweis · Ich bin da · Pause             │
└──────────────────────────────────────────┘
```

Nach der richtigen Antwort erscheint eine stempelartige Bestätigung, ein kurzer Stadtwissen-Text und
der nächste Suchraum. Auf dem Desktop liegt das Routenbuch links, die Karte rechts. Mobil ist es ein
Bottom Sheet über der Karte.

---

## 4. Die fünf Routen

Alle fünf Routen sind so angelegt, dass sie **öffentlich zugänglich** sind. Hauptstationen kosten
keinen Eintritt. Wo eine Attraktion Eintritt kostet, ist sie eine freiwillige Bonusstation.

| Nr. | Route | Gebiet | Schwierigkeit | Dauer | Länge | Höhenmeter | Stationen | Für wen |
|---|---|---|---|---|---|---|---|---|
| 1 | **Der Kessel-Code** | Mitte | 1/5 | 2–2,5 h | 4,0 km | ca. 30 m | 8 (6 + 2 Bonus) | Familien ab ca. 8 Jahren, Gäste, Schulklassen |
| 2 | **Neckar & Nymphen** | Rosenstein, Cannstatt | 2/5 | 2,5–3,5 h | 5,5 km | ca. 30 m | 9 (6 + 3 Bonus) | Familien, Kinderwagen, Gäste |
| 3 | **Nachtschicht** | Mitte, Bohnenviertel | 3/5 | 2–2,5 h | 4,0 km | ca. 50 m | 8 (6 + 2 Bonus) | Jugendliche ab 14, Erwachsene |
| 4 | **Stäffele & Wein** | Süd | 4/5 | 3,5–4,5 h | 7,5 km | ca. 300 m | 10 (8 + 2 Bonus) | Trittsichere Erwachsene und Teens |
| 5 | **Gipfelstürmer** | Nord und Süd | 5/5 | 6–8 h | ca. 13 km | ca. 550 m | 13 (6 + 7 Bonus) | Ausdauernde Erwachsene |

Die Schwierigkeit bewertet nicht nur die Länge, sondern auch Steigung, Treppen, Orientierung, Tageszeit
und die Menge der Aufgaben. Eine Route mit 4 Kilometern kann schwerer sein als eine mit 8 Kilometern,
wenn sie nachts, steil oder unübersichtlich ist.

| Stufe | Typische Merkmale | Route |
|---|---|---|
| 1 | bis 4 km, kaum Steigung, fester Belag, familientauglich | Der Kessel-Code |
| 2 | bis 6 km, wenig Steigung, überwiegend kinderwagentauglich | Neckar & Nymphen |
| 3 | körperlich leicht, aber Nacht, Orientierung oder Live-Daten | Nachtschicht |
| 4 | 6–10 km, 200–400 Höhenmeter, Treppen, Trittsicherheit | Stäffele & Wein |
| 5 | über 12 km, über 500 Höhenmeter, ganzer Tag, Ausdauer | Gipfelstürmer |

Die **Dauer** ist Gehzeit plus Rätselzeit, ohne Anreise und ohne längere Einkehr. Sie ist eine
Empfehlung, keine Frist. Bonusstationen sind freiwillig und können in beliebiger Reihenfolge besucht
werden. Die Tabellen nennen eine empfohlene Reihenfolge.

### 4.1 Route 1 — Der Kessel-Code

**Charakter.** Die Einstiegsroute. Sie führt einmal quer durch die Innenstadt, von der Jubiläumssäule
bis zur Stadtbibliothek, und zeigt, wie das Spiel funktioniert. Kurze Wege, viele Bänke, viele
Einkehrmöglichkeiten, jede Menge Haltestellen. Die Rätsel sind leicht, aber nicht trivial: zählen,
lesen, genau hinsehen.

**Eckdaten.**

| | |
|---|---|
| Schwierigkeit | 1/5 |
| Dauer | 2 bis 2,5 Stunden |
| Länge | ca. 4,0 km |
| Höhenmeter | ca. 30 m |
| Stationen | 8 (6 Haupt, 2 Bonus) |
| Start | Schlossplatz, Jubiläumssäule |
| Ziel | Stadtbibliothek am Mailänder Platz |
| ÖPNV | U5, U6, U7, U12, U15 Schlossplatz; U5, U12, U15 Stadtbibliothek |
| Barrierefreiheit | barrierearm; Kopfsteinpflaster, einzelne Stufen; Details pro Etappe |
| Beste Zeit | ganzjährig, vormittags; im Dezember Weihnachtsmarkt-Umleitung |
| Lösungswort | **KESSEL** |

**Stationen.**

| # | Ort | Aufgabe | Antwort | Code |
|---|---|---|---|---|
| 1 | Schlossplatz, Jubiläumssäule | Wie viele Reliefs sind am Fuß der Säule? | 4 | Prolog |
| 2 | Königsbau | Wie viele Säulen hat die Kolonnade? | 34 | Bonus |
| 3 | Altes Schloss, Innenhof | Welches Tier trägt den Reiter? | Pferd | K |
| 4 | Stiftskirche | Wie viele Türme hat die Kirche? | 2 | E |
| 5 | Schillerdenkmal | In welchem Jahr wurde das Denkmal enthüllt? | 1839 | S |
| 6 | Markthalle | In welchem Jahr wurde die Markthalle eröffnet? | 1914 | S |
| 7 | Wilhelmspalais | In welchem Jahr wurde das Palais fertiggestellt? | 1840 | E |
| 8 | Stadtbibliothek | Wie viele Buchstaben hat der Name des Platzes davor? | 14 (Mailänder Platz) | L |

Der Prolog an der Jubiläumssäule zählt als Bonusstation: Er gibt das erste Siegel, aber keinen
Buchstaben. Das Lösungswort beginnt erst am Alten Schloss.

**Beispielstation: Altes Schloss.**

- **Aufgabe:** „Im Innenhof steht ein Reiterdenkmal. Welches Tier trägt den Reiter?“ (Wort)
- **Antwort:** Pferd; akzeptiert auch „Ross“.
- **Hinweis 1:** „Schau in die Mitte des Innenhofs, nicht auf die Fassade.“
- **Hinweis 2:** „Es ist das Tier, auf dem man reitet.“
- **Stadtwissen:** „Das Alte Schloss war ursprünglich eine mittelalterliche Wasserburg und wurde
  1553–1578 zum Renaissanceschloss umgebaut. Im Innenhof steht ein Reiterdenkmal von Ludwig von
  Hofer aus dem Jahr 1859. Heute beherbergt das Schloss das Landesmuseum Württemberg.“
- **Quelle:** Landesmuseum Württemberg, Stadt Stuttgart.

**Besonderheiten.**

- Die Route ist als Einstieg gedacht: keine großen Steigungen, viele Sitzgelegenheiten, Toiletten in
  der Markthalle und in der Nähe des Rathauses, Trinkbrunnen in der Nähe.
- Der Königsbau-Bonus mit 34 Säulen ist die einzige längere Zählaufgabe. Wer keine Lust hat, lässt ihn
  aus; das Lösungswort bleibt vollständig.
- Im Dezember kreuzt der Weihnachtsmarkt den Weg. Dann führt die App um die dichtesten Bereiche herum
  und markiert die Stationen, die trotzdem erreichbar sind.
- Die Markthalle ist tagsüber geöffnet; die Aufgabe funktioniert an der Fassade und ist nicht von
  Öffnungszeiten abhängig.

### 4.2 Route 2 — Neckar & Nymphen

**Charakter.** Eine grüne Route am Wasser. Sie beginnt im Rosensteinpark, streift die Wilhelma,
besucht das Daimler-Gartenhaus, folgt dem Neckar und endet in Bad Cannstatt. Die Geschichte erzählt
von einem Fluss, der die Stadt ernährt, von königlichen Gärten und von einem Erfinder, der im
Gartenhaus das Motorrad vorbereitete. Viele Wege sind breit und kinderwagentauglich; die Wilhelma
selbst ist nur eine freiwillige Bonusstation.

**Eckdaten.**

| | |
|---|---|
| Schwierigkeit | 2/5 |
| Dauer | 2,5 bis 3,5 Stunden |
| Länge | ca. 5,5 km |
| Höhenmeter | ca. 30 m |
| Stationen | 9 (6 Haupt, 3 Bonus) |
| Start | Schloss Rosenstein / Rosensteinpark |
| Ziel | Bahnhof Bad Cannstatt |
| ÖPNV | U13 Wilhelma, U13 und S-Bahn Bad Cannstatt |
| Barrierefreiheit | überwiegend kinderwagentauglich; einzelne Parkwege mit Kies; Wilhelma weitgehend barrierefrei |
| Beste Zeit | April bis Oktober; im September/Oktober Wasen-Betrieb; Daimler-Gedächtnisstätte montags geschlossen |
| Lösungswort | **NECKAR** |

**Stationen.**

| # | Ort | Aufgabe | Antwort | Code |
|---|---|---|---|---|
| 1 | Schloss Rosenstein | Welches Museum ist heute im Schloss? | Naturkundemuseum | N |
| 2 | Wilhelma-Haupteingang | Welche zwei Bereiche verbindet die Wilhelma? | Zoo und Botanischer Garten | E |
| 3 | Gottlieb-Daimler-Gedächtnisstätte | Wie heißt das 1885 gebaute Fahrzeug? | Reitwagen | C |
| 4 | Neckar, Rosensteinbrücke | Wie heißt der Fluss? | Neckar | K |
| 5 | Kursaal Bad Cannstatt | In welchem Jahr wurde der Kursaal eröffnet? | 1837 | A |
| 6 | Bahnhof Bad Cannstatt | Welche Stadtbahn-Linie fährt zur Wilhelma? | U13 | R |
| 7 | Cannstatter Wasen | Wie heißt das große Volksfest hier? | Cannstatter Volksfest | Bonus |
| 8 | Rosensteinpark | Wie viele Minuten bis zur nächsten U13? | Live-Abfahrt | Bonus |
| 9 | Wilhelma, Maurisches Landhaus (Ticket) | Welche Form hat die Kuppel? | Zwiebelkuppel | Bonus |

**Beispielstation: Gottlieb-Daimler-Gedächtnisstätte.**

- **Aufgabe:** „Im Gartenhaus baute Gottlieb Daimler 1885 zusammen mit Wilhelm Maybach ein
  zweirädriges Fahrzeug. Wie heißt es?“ (Wort)
- **Antwort:** Reitwagen; akzeptiert auch „Motorrad“ oder „Einspur“.
- **Hinweis 1:** „Es hat zwei Räder und einen Motor.“
- **Hinweis 2:** „Der Name klingt nach einem Pferd, auf dem man sitzt.“
- **Stadtwissen:** „Der Reitwagen von 1885 gilt als Vorläufer des Motorrads. Daimler und Maybach
  bauten ihn in Cannstatt; der schnelllaufende Viertaktmotor war die eigentliche Sensation. Daimler
  wurde 1834 in Schorndorf geboren und lebte später in Cannstatt.“
- **Quelle:** Mercedes-Benz Museum, Gottlieb-Daimler-Gedächtnisstätte.

**Besonderheiten.**

- Die Hauptroute bleibt außerhalb der Wilhelma. Wer hineinwill, braucht ein Ticket; die Bonusstation
  ist klar als kostenpflichtig markiert.
- Der Rosensteinpark ist ein historischer Landschaftspark. Wege nicht verlassen, keine Tiere füttern,
  keine Pflanzen pflücken.
- Am Wasen kann es voll und laut werden. Die App zeigt an, ob die Route gerade ungünstig ist, und
  bietet eine Variante über den Kursaal an.
- Die Daimler-Gedächtnisstätte ist Dienstag bis Sonntag geöffnet, montags geschlossen. Die Aufgabe ist
  so formuliert, dass sie an der Außentafel lösbar ist; sonst zeigt die App die Antwort als Hinweis und
  erklärt, warum. Sie liegt in einer Wohnstraße; die App zeigt den kleinen Abstecher und die nächste
  Haltestelle.

### 4.3 Route 3 — Nachtschicht

**Charakter.** Eine Route für die blaue Stunde. Sie beginnt kurz vor Sonnenuntergang am Schlossplatz,
führt durch die Gassen des Bohnenviertels und endet am Marienplatz. Die Aufgaben sind leiser: ein
Sonnenuntergang, eine Nachtwächterlaterne, sechs Enten, ein beleuchteter Bibliothekswürfel. Die Route
ist körperlich leicht, aber sie verlangt Aufmerksamkeit, Orientierung und Lust auf Dunkelheit.

**Eckdaten.**

| | |
|---|---|
| Schwierigkeit | 3/5 |
| Dauer | 2 bis 2,5 Stunden |
| Länge | ca. 4,0 km |
| Höhenmeter | ca. 50 m |
| Stationen | 8 (6 Haupt, 2 Bonus) |
| Start | Schlossplatz, 30 Minuten vor Sonnenuntergang |
| Ziel | Marienplatz |
| ÖPNV | U5, U6, U7, U12, U15 Schlossplatz; U1, U14 Marienplatz; Zacke Marienplatz |
| Barrierefreiheit | ebene, gut beleuchtete Straßen; einzelne Kopfsteinpflasterpassagen; nicht für Kinder unter 14 gedacht |
| Beste Zeit | ganzjährig; im Sommer startet die Route spät, im Winter früh; Mai bis September empfohlen |
| Lösungswort | **DUNKEL** |

**Stationen.**

| # | Ort | Aufgabe | Antwort | Code |
|---|---|---|---|---|
| 1 | Schlossplatz | Wann geht die Sonne heute unter? | Uhrzeit, ±5 Minuten | D |
| 2 | Stiftskirche | Wie viele Türme hat die Kirche? | 2 | U |
| 3 | Hans-im-Glück-Brunnen | Wie viele Enten sitzen am Brunnen? | 6 | N |
| 4 | Bohnenviertel | Welche Hülsenfrucht gab dem Viertel den Namen? | Bohne | K |
| 5 | Nachtwächterbrunnen, Leonhardsplatz | Was hält die Nachtwächterfigur in der Hand? | Laterne | E |
| 6 | Stadtbibliothek | Welches Wort steht über dem Eingang? | Stadtbibliothek | L |
| 7 | Marktplatz / Rathaus | Wie viele Minuten bis zur nächsten U-Bahn? | Live-Abfahrt | Bonus |
| 8 | Marienplatz | Wie viele Minuten bis zur nächsten Zacke? | Live-Abfahrt | Bonus |

**Beispielstation: Hans-im-Glück-Brunnen.**

- **Aufgabe:** „Wie viele Enten sitzen am Postament des Brunnens?“ (Zahl)
- **Antwort:** 6.
- **Hinweis 1:** „Schau auf den runden Sockel unter der Figur.“
- **Hinweis 2:** „Es sind mehr als vier und weniger als acht.“
- **Stadtwissen:** „Der Hans-im-Glück-Brunnen wurde 1909 von Josef Zeitler geschaffen. Der Bauernbursche
  mit dem goldenen Schwein und die sechs Enten erinnern an das Märchen vom Hans im Glück. Der Brunnen
  steht in der Geißstraße im Bohnenviertel und ist im Sommer in Betrieb.“
- **Quelle:** Stadt Stuttgart, Wikipedia.

**Besonderheiten.**

- Die Startzeit richtet sich nach dem Sonnenuntergang. Die App berechnet sie aus den vorhandenen
  Sonnendaten und zeigt sie beim Start an. Wer früher kommt, kann die erste Station schon lesen; das
  Finale bleibt aber erst nach Sonnenuntergang sichtbar.
- Die Route bleibt auf beleuchteten Straßen. Keine Parks, keine dunklen Hinterhöfe, keine Friedhöfe.
  Gruppen sind empfohlen; Kopfhörer sollten draußen bleiben.
- Die letzte Zacke und die letzten Stadtbahnen werden angezeigt. Wer zu spät dran ist, bekommt eine
  Warnung und eine kürzere Variante zum Marienplatz.
- Der Nachtwächterbrunnen hinter der Leonhardskirche ist der heimliche Star der Route: eine dunkle
  Figur mit Laterne, die an den nächtlichen Wachdienst erinnert.
- Die Nachtroute ist kein Gruselspiel. Keine Erschrecker, keine lauten Geräusche, keine Aufgaben, die
  andere Menschen erschrecken.

### 4.4 Route 4 — Stäffele & Wein

**Charakter.** Die Route für alle, die Stuttgart von oben sehen wollen. Sie startet am Eugensplatz,
steigt die Eugenstaffel hinunter, quert den Marienplatz, führt durch den Weißenburgpark und die
Weinberge und endet nach dem Fernsehturm in Degerloch. 175 Stufen am Anfang, viele Höhenmeter und ein
Blick, der die Anstrengung vergessen lässt.

**Eckdaten.**

| | |
|---|---|
| Schwierigkeit | 4/5 |
| Dauer | 3,5 bis 4,5 Stunden |
| Länge | ca. 7,5 km |
| Höhenmeter | ca. 300 m |
| Stationen | 10 (8 Haupt, 2 Bonus) |
| Start | Eugensplatz, Galateabrunnen |
| Ziel | Degerloch, Zacke |
| ÖPNV | U15 Eugensplatz; U1, U14 Marienplatz; Zacke Degerloch |
| Barrierefreiheit | nicht barrierefrei; viele Treppen, Steigungen, unebene Weinbergwege; festes Schuhwerk nötig |
| Beste Zeit | März bis November; nicht bei Nässe, Eis oder nach Einbruch der Dunkelheit |
| Lösungswort | **WEINBERG** |

**Stationen.**

| # | Ort | Aufgabe | Antwort | Code |
|---|---|---|---|---|
| 1 | Eugensplatz, Galateabrunnen | Welche Figur steht auf dem Brunnen? | Galatea | W |
| 2 | Eugenstaffel | Wie viele Stufen hat die Treppe? | 175 | E |
| 3 | Marienplatz, Zacke | Seit wann fährt die Zacke? | 1884 | I |
| 4 | Weißenburgpark, Teehaus | In welchem Jahr wurde das Teehaus erbaut? | 1913 | N |
| 5 | Karlshöhe | Wie hoch liegt die Karlshöhe? | 344 m | B |
| 6 | Weinberg an der Weinsteige | Welche Rebsorte steht auf dem Schild? | z. B. Trollinger | E |
| 7 | Weinsteige | Wie viele Stufen hat die Treppe an dieser Stelle? | Zahl vor Ort geprüft | R |
| 8 | Bopser / Fernsehturm | Wie hoch ist der Fernsehturm? | 216,6 m | G |
| 9 | Degerloch | Wie viele Minuten bis zur nächsten Zacke? | Live-Abfahrt | Bonus |
| 10 | Heslacher Wasserfälle (Bonus-Abstecher ab Weinsteige) | Aus welchem Stausee kommt ein Teil des Wassers? | Pfaffensee | Bonus |

**Beispielstation: Eugenstaffel.**

- **Aufgabe:** „Wie viele Stufen hat die Eugenstaffel?“ (Zahl)
- **Antwort:** 175; Toleranz ±2.
- **Hinweis 1:** „Zähle in Zehnern, dann verlierst du nicht den Faden.“
- **Hinweis 2:** „Es sind mehr als 150 und weniger als 200.“
- **Stadtwissen:** „Die Eugenstaffel verbindet die Urbanstraße mit dem Eugensplatz. 175 Stufen führen
  hinauf; oben steht der Galateabrunnen von 1890, gestiftet von Königin Olga. Die Treppe ist eine der
  bekanntesten Stäffele der Stadt.“
- **Quelle:** Stadt Stuttgart, Stuttgart-Tourist.

**Besonderheiten.**

- Die Route ist bewusst als sportliche Halbtagstour geschnitten. Wer nur die Aussicht will, kann an
  der Karlshöhe aussteigen und mit der Zacke ab Marienplatz oder dem Bus zurückfahren.
- Die Weinberge sind Arbeitsflächen. Wege nicht verlassen, keine Reben anfassen, keine Trauben essen.
  In der Lesezeit kann es Absperrungen geben.
- Die Weinsteige ist eine viel befahrene Straße. Die Route nutzt die Treppen und Fußwege, nicht die
  Fahrbahn.
- Der Fernsehturm ist das Finale der Aussicht, nicht der Inhalt: Die Aufgabe funktioniert von außen.
  Wer hinauffahren will, braucht ein Ticket und Zeit.
- Die Heslacher Wasserfälle sind ein Bonus-Abstecher, kein Hauptweg. Bei Nässe rutschig.

### 4.5 Route 5 — Gipfelstürmer

**Charakter.** Die Königsetappe. Fünf Gipfel, eine Stadtbahnfahrt, ein ganzer Tag. Die Route beginnt
am Killesbergturm, führt über die Weißenhofsiedlung und den Bismarckturm, dann mit der U5 in die Stadt
und mit U1/U14 nach Marienplatz, hinauf zur Karlshöhe, weiter zum Birkenkopf und über den Bopser nach
Degerloch. Wer sie schafft, hat Stuttgart einmal von allen Seiten gesehen.

**Eckdaten.**

| | |
|---|---|
| Schwierigkeit | 5/5 |
| Dauer | 6 bis 8 Stunden |
| Länge | ca. 13 km |
| Höhenmeter | ca. 550 m |
| Stationen | 13 (6 Haupt, 7 Bonus) |
| Start | Killesberg, U5 |
| Ziel | Degerloch, U5 / Zacke |
| ÖPNV | U5 Killesberg; U1, U14 Marienplatz; U5 Degerloch; Zacke Degerloch |
| Barrierefreiheit | nicht barrierefrei; lange Strecke, Steigungen, Wald- und Wiesenwege; gute Kondition und Ausrüstung nötig |
| Beste Zeit | April bis Oktober; früh starten; nicht bei Hitze, Gewitter, Eis oder Schnee |
| Lösungswort | **GIPFEL** |

**Stationen.**

| # | Ort | Aufgabe | Antwort | Code |
|---|---|---|---|---|
| 1 | Killesbergturm | Wie viele Stufen bis zur obersten Plattform? | 348 | G |
| 2 | Weißenhofsiedlung | In welchem Jahr wurde die Siedlung gebaut? | 1927 | I |
| 3 | Gähkopf, Bismarckturm | In welchem Jahr wurde der Turm eröffnet? | 1904 | P |
| 4 | U5 Killesberg | Welche Linie verbindet Killesberg und Degerloch? | U5 | F |
| 5 | Karlshöhe | Wie hoch liegt die Karlshöhe? | 344 m | E |
| 6 | Birkenkopf | Um wie viele Meter wurde der Berg nach dem Krieg aufgeschüttet? | ca. 40 m | L |
| 7 | Bopser / Fernsehturm | In welchem Jahr wurde der Fernsehturm eröffnet? | 1956 | Bonus |
| 8 | Degerloch, Zacke | Seit wann fährt die Zacke? | 1884 | Bonus |
| 9 | Weißenburgpark | In welchem Jahr wurde das Teehaus erbaut? | 1913 | Bonus |
| 10 | Weinsteige | Welche Rebsorte wächst hier? | z. B. Trollinger | Bonus |
| 11 | Heslacher Wand | Wie viele Minuten bis zur nächsten Haltestelle? | Live-Abfahrt | Bonus |
| 12 | Marienplatz | Wie viele Minuten bis zur nächsten Zacke? | Live-Abfahrt | Bonus |
| 13 | Degerloch | Wie viele Minuten bis zur nächsten U5? | Live-Abfahrt | Bonus |

Die Nummern folgen den Hauptstationen. Die Bonusstationen stehen bei ihrem Ort und können unterwegs
in beliebiger Reihenfolge mitgenommen werden.

**Beispielstation: Birkenkopf.**

- **Aufgabe:** „Der Birkenkopf wurde nach dem Zweiten Weltkrieg mit Trümmerschutt aufgeschüttet.
  Um wie viele Meter wuchs der Berg dadurch etwa?“ (Zahl)
- **Antwort:** 40; Toleranz ±5.
- **Hinweis 1:** „Es ist eine runde Zahl.“
- **Hinweis 2:** „Der Berg ist heute 511 Meter hoch.“
- **Stadtwissen:** „Der Birkenkopf ist mit 511 Metern der höchste Punkt im inneren Stadtgebiet. Nach
  dem Zweiten Weltkrieg wurde er mit rund 40 Metern Trümmerschutt aufgeschüttet. Die Stuttgarter
  nennen ihn liebevoll ‚Monte Scherbelino‘.“
- **Quelle:** Stadt Stuttgart, Wikipedia.

**Besonderheiten.**

- Die Route ist lang, aber technisch einfach. Es gibt keine Kletterstellen, keine Wege abseits der
  markierten Pfade und keine Aufgaben, die Mutproben verlangen.
- Die U5 verbindet Killesberg und Degerloch. Marienplatz erreicht man mit U1/U14 oder mit der Zacke.
  Die Fahrt ist Teil der Route und kein Bruch: Die App zeigt die nächste Abfahrt und den Fußweg zum
  Bahnsteig.
- Drei Ausstiegspunkte: Killesberg, Marienplatz, Degerloch. Wer nicht mehr kann, fährt zurück.
- Wasser, Sonnenschutz und eine Regenjacke sind Pflicht. Die App zeigt Trinkbrunnen, Toiletten und
  die nächste Haltestelle.
- Bei Gewitter, Hitze oder schlechter Sicht wird die Route nicht empfohlen. Die App verweist auf
  Route 1 oder 2 als Alternative.

---

## 5. Aufgaben, Antworten und redaktionelle Regeln

### 5.1 Was eine gute Station ausmacht

Eine gute Station erfüllt sieben Bedingungen:

1. **Die Antwort ist vor Ort sichtbar.** Keine Frage, die man nur mit Internetwissen lösen kann.
2. **Die Antwort ist eindeutig.** Keine Geschmacksfragen, keine „schönste Aussicht“, keine freien
   Assoziationen.
3. **Die Antwort ist stabil.** Keine Preise, keine Schaufenster, keine temporären Schilder, keine
   Veranstaltungsdaten.
4. **Der Ort ist öffentlich zugänglich.** Kein Betreten von Privatgrund, Baustellen, Gleisen oder
   Naturschutzgebieten.
5. **Die Aufgabe ist sicher.** Kein Überqueren viel befahrener Straßen ohne Querung, kein Klettern,
   kein Anfassen von Denkmälern.
6. **Die Aufgabe respektiert Menschen.** Keine Fotos von Personen, keine Fragen zu Wohnungen, keine
   Aufgaben, die Anwohner stören.
7. **Die Station hat einen Mehrwert.** Nach dem Lösen weiß man etwas, das man vorher nicht wusste.

### 5.2 Was ausdrücklich nicht vorkommt

- keine versteckten Dosen, keine QR-Aufkleber, keine physischen Stempelkästen
- keine Hauptaufgaben, die Geld ausgeben oder einen Eintritt voraussetzen; Bonusstationen mit Eintritt
  sind klar gekennzeichnet und freiwillig
- keine Aufgaben in Kirchen während Gottesdiensten
- keine Aufgaben auf Friedhöfen, in Krankenhäusern oder in Schulen
- keine Aufgaben, die Menschen fotografieren oder filmen
- keine Aufgaben, die Tiere füttern oder anfassen
- keine Aufgaben, die Lärm machen oder Sachen beschädigen
- keine Aufgaben, die nur mit Smartphone-Kamera oder Augmented Reality funktionieren
- keine Aufgaben, die ohne Smartphone nicht lösbar wären; Aufgaben und Wege sind auch als Textliste lesbar

Der Verzicht auf physische Caches ist Absicht: keine Wartung, kein Vandalismus, keine zusätzliche
Verpackung im öffentlichen Raum. Die Stadt liefert die Rätsel bereits.

Schummeln ist möglich. Das ist in Ordnung. Es gibt keine Preise, keine Rangliste und keinen Server,
der etwas beweist. Wer schummelt, betrügt sich um den schönsten Teil: das genaue Hinsehen.

### 5.3 Antwortnormalisierung

Die Prüfung ist großzügig, aber nicht beliebig:

- Groß- und Kleinschreibung wird ignoriert.
- Umlaute werden aufgelöst: ä → ae, ö → oe, ü → ue, ß → ss.
- Leerzeichen, Bindestriche und Satzzeichen am Rand werden entfernt.
- Zahlen werden als Zahl oder als Wort akzeptiert: „6“ und „sechs“.
- Jahre werden als Zahl akzeptiert: „1839“, „1839 n. Chr.“, „im Jahr 1839“.
- Schreibweisen mit und ohne h werden akzeptiert: „Galatea“ und „Galathea“.
- Regionale Varianten werden akzeptiert: „Stäffele“ und „Staffel“, „Cannstatt“ und „Bad Cannstatt“.
- Bei Zahlen gibt es eine fachlich begründete Toleranz: Stufen ±2, Höhenmeter ±2, Jahreszahlen exakt.
- Bei mehreren richtigen Antworten wird eine Alias-Liste gepflegt.

### 5.4 Live-Aufgaben

Ein bis zwei Aufgaben pro Route dürfen mit den vorhandenen Live-Daten arbeiten:

- Sonnenuntergang aus dem Sonnenmodul
- Mondphase aus der berechneten Astronomie
- nächste Abfahrt einer Stadtbahn, S-Bahn oder Zacke
- aktueller Neckarpegel
- Wettertemperatur oder Windrichtung

Das ist kein Selbstzweck. Es macht sichtbar, dass Stuttgart eine lebende Stadt ist und dass Open
Stuttgart Daten liefert, die man sonst nur in getrennten Apps findet. Die Live-Aufgabe muss aber
immer eine stabile Alternative haben, falls die Quelle gerade nicht antwortet. Dann gilt die Antwort
aus der letzten bekannten Prognose oder die Station wird übersprungen.

### 5.5 Hinweise

Jede Hauptstation hat drei Hinweise:

1. **Blickrichtung:** „Schau auf den Sockel, nicht auf die Säule.“
2. **Konkretisierung:** „Die Zahl steht auf der Tafel links vom Eingang.“
3. **Lösung:** „Die Antwort ist 1839. Hier ist, warum.“

Der dritte Hinweis ist keine Strafe. Er beendet nur die Suche und öffnet den Stadtwissen-Text. Wer
ihn nutzt, bekommt weniger Kesselpunkte, aber dasselbe Siegel.

### 5.6 Keine Zeitlimits, keine Bestenliste

Die Zeit ist eine Information, kein Wettkampf. Die App zeigt nach dem Abschluss:

- Gesamtzeit
- Gehzeit ohne Pausen
- Anzahl der Hinweise
- Anzahl der falschen Antworten
- alle gesammelten Stadtwissen-Karten

Es gibt keine globale Bestenliste und keine Rangfolge zwischen Personen. Nur auf dem eigenen Gerät
kann man frühere Zeiten vergleichen. Das ist bewusst so: Eine Schnitzeljagd, die hetzt, ist keine
gute Schnitzeljagd.

---

## 6. Routenbuch, Punkte und Abzeichen

### 6.1 Das Routenbuch

Das Routenbuch ist die Sammlung im Spiel. Es hat fünf Kapitel, jedes mit einer eigenen Farbe und
einem eigenen Siegel:

| Kapitel | Route | Farbe | Siegelmotiv |
|---|---|---|---|
| I | Der Kessel-Code | warmes Rot | Säule |
| II | Neckar & Nymphen | Blau | Welle |
| III | Nachtschicht | Indigo/Amber | Mond |
| IV | Stäffele & Wein | Weinrot/Grün | Rebe |
| V | Gipfelstürmer | Grün/Himmelblau | Gipfel |

Jede Routenseite zeigt:

- die Stationen als Stempel (gelöst, offen, Bonus)
- das Lösungswort mit leeren Feldern
- die gesammelten Stadtwissen-Karten
- Zeit, Hinweise und falsche Antworten
- das Datum des Abschlusses
- einen Teilen-Knopf für das Ergebnisbild

Das Routenbuch liegt lokal im Browser. Es gibt keinen Account und keine Synchronisierung. Wer das
Gerät wechselt, kann das Routenbuch als JSON exportieren und auf dem anderen Gerät importieren.

### 6.2 Punkte

| Aktion | Kesselpunkte |
|---|---|
| Hauptstation gelöst | +100 |
| Bonusstation gelöst | +50 |
| Route abgeschlossen | +200 |
| Hinweis 1 | −10 |
| Hinweis 2 | −20 |
| Hinweis 3 | −30 |
| Falsche Antwort | −5, maximal −20 pro Station |
| Zeit | keine Punkte |

Die Abzüge gelten pro Station und sind kumulativ: Wer alle drei Hinweise nutzt, verliert 60 Punkte,
behält aber das Siegel. Die Punkte sind eine Orientierung, kein Wettbewerb. Sie zeigen, wie gründlich
man geschaut hat, nicht wie schnell man war.

### 6.3 Abzeichen

| Abzeichen | Bedingung |
|---|---|
| **Spur** | Route abgeschlossen, auch mit Hinweisen oder Auslassungen |
| **Kundig** | alle Hauptstationen gelöst, höchstens zwei Hinweise |
| **Kartograph** | alle Haupt- und Bonusstationen gelöst, höchstens ein Hinweis, keine Auslassung |
| **Kesselwappen** | alle fünf Routen mindestens mit „Kundig“ abgeschlossen |

Das Kesselwappen ist ein eigenes, fiktives Wappen aus den fünf Siegeln. Es ist kein Stadtwappen und
kein Hoheitszeichen. Es wird lokal als SVG oder PNG erzeugt und kann geteilt werden.

### 6.4 Teilen

Das Ergebnisbild zeigt:

- den Routennamen und das Kapitel
- die Stationen als Siegel
- Zeit und Datum
- die Zahl der Stadtwissen-Karten
- das Open-Stuttgart-Zeichen
- einen QR-Code oder Link zur Route

Es zeigt **nicht**:

- den Namen der Person
- den Standortverlauf
- das Lösungswort
- Fotos
- eine Rangliste

Wer seine Route mit anderen spielen will, teilt den Challenge-Link. Der startet dieselbe Route,
aber ohne den eigenen Fortschritt.

---

## 7. Gestaltung und UX

### 7.1 Einstieg

Das Spiel bekommt einen eigenen Bereich „Spiel“ in Open Stuttgart. Zusätzlich gibt es:

- eine Karte „Stadtspiel“ auf der Startseite
- einen Deep-Link `?spiel=kessel-code`
- einen QR-Code auf dem Teilen-Bild und auf einer späteren Druckversion
- einen Eintrag im Freizeit-Kontext, nicht in der Verwaltung

Der Bereich wird als Modul registriert, aber nicht als neuer Dauer-Tab in den Vordergrund gedrängt.
Auf dem Desktop erscheint er als Modul, auf dem Mobilgerät als Vollbildmodus mit einer klaren
„Spiel beenden“-Möglichkeit.

### 7.2 Bildschirme

1. **Übersicht.** Fünf Routenkarten mit Schwierigkeit, Dauer, Länge, Höhenmetern, Charakter und
   „Starten“.
2. **Routendetail.** Karte mit Start und Ziel, Höhenprofil, Anreise, was man mitnehmen sollte,
   Barrierefreiheit, Sicherheitshinweise, Saison.
3. **Station.** Fortschritt, Suchraum, Aufgabe, Eingabe, Hinweise, „Ich bin da“, Pause.
4. **Rückmeldung.** Siegel, Stadtwissen-Karte mit Quelle, nächster Suchraum.
5. **Finale.** Lösungswort, Kapitelabschluss, Ergebnis, Teilen.
6. **Routenbuch.** Alle Kapitel, Stempel, Stadtwissen, Export und Löschen.

Am Ziel zeigt die App die nächste Haltestelle, die nächste offene Toilette und – wenn gewünscht –
was heute in der Nähe los ist. Das ist kein Werbeplatz, sondern die vorhandene „Was geht“-Ansicht
ohne bezahlte Reihenfolge.

### 7.3 Karte

- **Vor dem Start:** Route als Übersicht, Start und Ziel, keine Stationspins.
- **Während des Spiels:** nur der aktuelle Suchraum als Kreis, gelaufene Abschnitte als Linie,
  kommende Abschnitte als gestrichelte Linie ohne exakten Punkt.
- **Nach dem Lösen:** Die Station wird als Stempel markiert, der nächste Suchraum erscheint.
- **Standort:** nur auf Knopfdruck, als blauer Punkt; keine dauerhafte Verfolgung.
- **Listenansicht:** Jede Station ist auch als Text mit Adresse und Wegbeschreibung verfügbar. Die
  Karte ist nie die einzige Informationsquelle.
- **Nachtmodus:** Route 3 nutzt die dunkle Karte und warme Akzente; die anderen Routen bleiben im
  bestehenden Hell-/Dunkelmodus.

### 7.4 Gestaltung

- **Routenbuch statt Spielautomat.** Die Sammlung sieht aus wie ein Feldbuch: Papierstruktur, Stempel,
  klare Typografie. Keine Comicfiguren, keine Punkte-Explosionen.
- **Fünf Farben, fünf Siegel.** Jede Route hat eine Farbe und ein einfaches Linienmotiv. Die Motive
  werden als SVG gezeichnet, damit sie in Hell und Dunkel funktionieren.
- **Bestehende Designsprache.** DM Sans und Merriweather Sans, die vorhandenen Kartenfarben und
  Bedienelemente. Das Spiel soll wie ein Teil von Open Stuttgart aussehen, nicht wie eine Werbeaktion.
- **Bewegung sparsam.** Ein Stempel setzt sich, die Route zeichnet sich, das war’s. `prefers-reduced-motion`
  wird respektiert.
- **Ton.** Ruhig, neugierig, direkt. „Schau noch einmal hin“ statt „Falsch!“. „Du bist da“ statt
  „Standort verifiziert“. Keine Verniedlichung, keine flapsige Ansprache.
- **Kein Sound im Standard.** Ein optionaler Stempelton ist möglich, aber standardmäßig aus.

### 7.5 Barrierefreiheit

- **Route 1** ist barrierearm: kurze Wege, viele Bänke, ebene Abschnitte, Aufzüge in der Stadtbibliothek.
  Kopfsteinpflaster und einzelne Stufen werden pro Etappe genannt.
- **Route 2** ist überwiegend kinderwagentauglich; Kieswege und der Wilhelma-Eingang werden beschrieben.
- **Route 3** ist körperlich leicht, aber nachts; sie ist nicht für Kinder unter 14 gedacht.
- **Route 4 und 5** sind nicht barrierefrei. Das wird klar gesagt, nicht versteckt.
- **Bedienung:** große Schaltflächen, Fokusmanagement, Screenreader-Beschriftungen, `aria-live` für
  Rückmeldungen, keine Farbe als einziges Signal.
- **Alternative Aufgaben:** Wo eine visuelle Zählung nicht möglich ist, gibt es eine Textvariante,
  einen Hinweis oder die Möglichkeit, die Station mit Hilfe zu lösen.
- **Leichte Sprache:** Für Route 1 ist eine einfache Sprachvariante vorgesehen; sie kann später auf
  weitere Routen ausgeweitet werden.
- **Keine Audio-only-Aufgaben.** Alles, was gehört werden muss, hat eine Textalternative.

### 7.6 Sicherheit

- Hauptwege meiden gefährliche Querungen; die Wegbeschreibung nennt Ampeln und Querungshilfen.
- Keine Aufgaben auf Gleisen, an Baustellen, auf privatem Grund oder in Naturschutzgebieten.
- Nachtroute: beleuchtete Straßen, Gruppen empfohlen, keine Kopfhörer, letzte Abfahrten prüfen.
- Route 5: Wasser, Sonnenschutz, Regenjacke, Ausstiegspunkte, letzte U5.
- Bei amtlicher Unwetterwarnung zeigt die App einen klaren Hinweis und schlägt eine Verschiebung vor.
- Bei Hitze zeigt sie Trinkbrunnen und schattige Abschnitte; bei Eis und Schnee markiert sie Route 4
  und 5 als nicht empfohlen.
- Notfall: 112, nächste Haltestelle, nächste Toilette, „Route beenden“.
- Teilnahme auf eigene Gefahr. Das Spiel ist keine geführte Veranstaltung und keine Aufsicht.

---

## 8. Technik

### 8.1 Einordnung

Das Spiel wird ein Modul von Open Stuttgart, keine separate App. Es nutzt die vorhandene Karte, die
vorhandenen Daten und die vorhandene Gestaltung. Ein eigenes Backend für Nutzerprofile gibt es nicht.

```ts
// src/modules/index.ts (Auszug)
{ id: 'spiel', label: 'Spiel', icon: 'compass', status: 'live', overlays: ['spiel'], Panel: SpielPanel }
```

Ergänzt werden außerdem der Overlay-Schlüssel `spiel` in `src/map/overlays.ts` und ein
Selection-Typ für Stationen in `src/lib/types.ts`, damit die Karte eine Station öffnen kann, ohne
dass die bestehende Detailansicht umgebaut wird.

Neue Dateien und Bereiche:

```text
src/modules/spiel/
  SpielPanel.tsx        # Übersicht, Routenbuch
  RouteDetail.tsx       # Routendetail
  StationSheet.tsx      # Aufgabe und Rückmeldung
  Finale.tsx            # Lösungswort und Abschluss
  Routenbuch.tsx        # Sammlung
  ShareCard.tsx         # Ergebnisbild
  useSpiel.ts           # Zustand, Speicherung, Prüfung
  types.ts
server/sources/spiel.mjs
server/data/spiel/
  routen.json
  kessel-code.json
  neckar.json
  nachtschicht.json
  staeffele.json
  gipfel.json
scripts/build-spiel.mjs
```

### 8.2 Datenmodell

```ts
type Difficulty = 1 | 2 | 3 | 4 | 5;

interface StationPoint {
  name: string;
  point: [number, number];
}

interface Route {
  id: string;
  title: string;
  chapter: number;
  subtitle: string;
  difficulty: Difficulty;
  durationMin: [number, number];
  distanceKm: number;
  ascentM: number;
  start: StationPoint;
  end: StationPoint;
  word: string;
  seasons: string;
  access: string;
  accessibility: string;
  safety: string[];
  stations: Station[];
}

interface Station {
  id: string;
  no: number;
  name: string;
  kind: 'prologue' | 'main' | 'bonus';
  point: [number, number];
  radiusM: number;
  prompt: string;
  answer: AnswerSpec;       // nur serverseitig
  answerHash: string;       // für Offline-Prüfung, ohne Klartext
  aliases: string[];
  hints: [string, string, string];
  fact: string;
  source: string;
  license: string;
  verified: string;         // ISO-Datum
  openingHours?: string;    // z. B. „Di–So 13–17 Uhr, Mo geschlossen“
  status?: 'open' | 'closed' | 'alternative';
}

type AnswerSpec =
  | { type: 'number'; value: number; tolerance?: number }
  | { type: 'year'; value: number }
  | { type: 'text'; value: string }
  | { type: 'choice'; options: string[]; correct: number }
  | { type: 'compass'; directions: string[] }
  | { type: 'live'; source: 'sun' | 'moon' | 'departure' | 'water' | 'weather'; tolerance?: number }
  | { type: 'map'; point: [number, number]; radiusM: number };
```

Die öffentliche Route enthält `answerHash`, aber nicht `answer`. Die Klartextantworten liegen in einer
redaktionellen Datei, die nicht an den Browser ausgeliefert wird. Das ist keine Sicherheitsgarantie –
wer den Quelltext liest, kann Hashes angreifen – aber es verhindert versehentliche Spoiler im Netzwerk
und im UI.

### 8.3 Autorenformat

Die Routen werden als YAML gepflegt und mit `npm run data:spiel` geprüft und in JSON umgewandelt.
Ein Ausschnitt:

```yaml
id: kessel-code
title: Der Kessel-Code
chapter: 1
difficulty: 1
duration: [120, 150]
distance_km: 4.0
ascent_m: 30
word: KESSEL
start: { name: Schlossplatz, point: [9.1797, 48.7784] }
stations:
  - id: altes-schloss
    no: 3
    name: Altes Schloss
    kind: main
    point: [9.1800, 48.7775]
    radius_m: 60
    prompt: "Im Innenhof steht ein Reiterdenkmal. Welches Tier trägt den Reiter?"
    answer: { type: text, value: Pferd }
    aliases: [Ross]
    hints:
      - "Schau in die Mitte des Innenhofs."
      - "Es ist das Tier, auf dem man reitet."
      - "Die Antwort ist Pferd."
    fact: "Das Alte Schloss war eine Wasserburg und wurde 1553–1578 zum Renaissanceschloss umgebaut. Im Innenhof steht ein Reiterdenkmal von 1859."
    source: "https://www.landesmuseum-stuttgart.de/museum/altes-schloss"
    license: "CC BY 4.0"
    verified: "2026-10-22"
```

### 8.4 API

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/spiel/routen` | Liste der Routen mit Eckdaten, ohne Antworten |
| `GET` | `/api/spiel/routen/:id` | Öffentliche Route mit Stationen, Hinweisen, Fakten, Hashes |
| `POST` | `/api/spiel/pruefen` | Antwort prüfen; `{ routeId, stationId, answer }`; Antwort nur `{ correct, normalized }` |
| `GET` | `/api/spiel/routen/:id/geojson` | Route als GeoJSON für Karte und Export |
| `GET` | `/api/spiel/routen/:id/gpx` | optionaler GPX-Export für Wander-Apps |

Es gibt bewusst **keine** Endpunkte für Login, Fortschritt, Rangliste oder Profil. Der Fortschritt
liegt im `localStorage` des Browsers. Die Prüfung ist zustandslos; sie speichert weder Antwort noch
Person. Ein In-Memory-Rate-Limit pro IP verhindert grobes Durchprobieren, ohne IP-Adressen dauerhaft
zu speichern.

### 8.5 Offline und schlechte Verbindung

Die Stadt hat Funklöcher. Deshalb:

- Die öffentliche Route wird beim Start vollständig geladen und im `localStorage` oder Cache Storage
  abgelegt.
- Die Antwortprüfung funktioniert offline über den `answerHash`; die Hashes sind mit einem
  stationsspezifischen Salt versehen.
- Live-Aufgaben werden offline übersprungen oder mit dem letzten bekannten Wert geprüft; die App sagt,
  dass es sich um einen Näherungswert handelt.
- Die Karte braucht online Kacheln. Deshalb gibt es eine **Textroute** mit Adressen, Wegbeschreibung
  und einer statischen Übersichtskarte als SVG. Keine Aufgabe hängt von der Kartenkachel ab.
- Wenn die Verbindung zurückkommt, werden keine Standortdaten nachgesendet. Es gibt nichts zu syncen.

### 8.6 Datenschutz

- Kein Konto, keine E-Mail, keine Telefonnummer.
- Kein Hintergrund-Standort. `navigator.geolocation` nur auf Knopfdruck, ohne Speicherung.
- Keine Fotos-Uploads. Fotoaufgaben bleiben lokal und sind optional.
- Keine Analyse-Skripte, keine Werbe-Pixel, keine Werbe-IDs.
- Kein serverseitiger Fortschritt. Das Routenbuch kann jederzeit gelöscht werden.
- Teilen erzeugt ein Bild auf dem Gerät; es wird kein Server gespeichert.
- Wenn eine Station gemeldet wird, gehen nur Stations-ID, Problemart und optional ein freier Text an
  den Server. Kein Standort, kein Gerätekennzeichen.
- Die Erklärung im Spiel nennt dieselben Grenzen wie der Rest der App.

### 8.7 Inhaltsprüfung und Build

`scripts/build-spiel.mjs` prüft vor jedem Build:

- Koordinaten liegen im Stuttgarter Stadtgebiet.
- Hauptstationen liegen in der richtigen Reihenfolge und die Route ist nicht länger als angegeben.
- Jede Hauptstation hat genau einen Codebuchstaben; das Lösungswort passt zur Anzahl.
- Jede Station hat Aufgabe, Antwort, drei Hinweise, Quelle, Lizenz und Prüfdatum.
- Keine doppelten Station-IDs, keine fehlenden Aliase, keine leeren Fakten.
- Die Route enthält keine Station auf Privatgrund, auf Gleisen oder in einer Baustelle.
- Die Barrierefreiheits- und Sicherheitsfelder sind gesetzt.
- Die Antwort-Hashes stimmen mit den Klartextantworten überein (Test mit Aliasen).

Der Build erzeugt:

```text
server/data/spiel/public/*.json   # ohne Klartextantworten
server/data/spiel/private/*.json  # mit Antworten, nur serverseitig
```

Die Routengeometrie und die öffentlichen Fakten können zusätzlich als GeoJSON und GPX veröffentlicht
werden. Der Antwortschlüssel bleibt redaktionell und wird nicht mitgeliefert.

### 8.8 Tests

- **Unit:** Normalisierung, Alias-Erkennung, Zahlen-Toleranz, Hash-Prüfung, Lösungswort-Logik.
- **Server:** Prüf-Endpunkt mit richtigen, falschen, groß/klein geschriebenen und Umlaut-Antworten;
  Rate Limit; keine Antwort im Response.
- **UI:** Tastaturbedienung, Screenreader-Reihenfolge, Fokus nach Rückmeldung, `prefers-reduced-motion`.
- **E2E:** Route 1 einmal komplett auf Desktop und Mobil; Offline-Prüfung; Abbruch und Fortsetzen;
  Teilen-Bild.
- **Feldtest:** jede Route zweimal gehen, einmal mit einer ortskundigen Person, einmal mit einer
  Person, die die Stadt nicht kennt. Zeit, Hinweise, Verwirrung, Sicherheit und Spaß protokollieren.

---

## 9. Produktion und Betrieb

### 9.1 Aufwand

| Baustein | Aufwand | Anmerkung |
|---|---|---|
| Konzept und UX | 2–3 Wochen | inklusive Papierprototyp und Tests |
| Frontend-Modul | 4–6 Wochen | eine erfahrene Person; Karte, Zustand, UI, Teilen |
| Server und Build | 1–2 Wochen | statische Daten, Prüf-Endpunkt, Validierung |
| Design | 2–3 Wochen | Routenbuch, Siegel, Karten, Teilen-Bild, Icons |
| Inhalte | 8–10 Wochen | rund 50 Stationen, Recherche, Fotos, Quellen, Tests |
| Test und Barrierefreiheit | 3–4 Wochen | Feldtests, Screenreader, Kinderwagen, Rechtliches |
| **MVP mit 2 Routen** | **10–12 Wochen** | 2 Personen, parallel |
| **Alle 5 Routen** | **4–6 Monate** | mit Redaktion und Testläufen |

Die Inhalte sind der größte Posten. Eine Station ist nicht mit einer Stunde getan: recherchieren,
hinschauen, fotografieren, Antwort prüfen, Quelle und Lizenz klären, Hinweise schreiben, testen.
Realistisch sind 1,5 bis 2 Stunden pro Station, plus zwei Testläufe pro Route.

### 9.2 Roadmap

**Phase 0 — Papierprototyp (2 Wochen).**
Route 1 als acht Karten drucken, mit fünf Gruppen gehen, beobachten: Wo stocken sie? Welche Hinweise
helfen? Wie lange dauert es wirklich? Danach das Konzept schärfen.

**Phase 1 — Engine und Route 1 (6–8 Wochen).**
Modul, Karte, Stationen, Routenbuch, lokale Speicherung, Teilen-Bild. Route 1 vollständig und
getestet. Noch keine anderen Routen.

**Phase 2 — Route 4 (4–6 Wochen).**
Die sportliche Route als Kontrast. Höhenprofil, Zacke-Abfahrten, Offline-Textroute. Beta-Start mit
zwei Routen.

**Phase 3 — Route 2, 3 und 5 (8–10 Wochen).**
Familienroute, Nachtmodus, Sonnenuntergang, Live-Aufgaben, Kesselwappen, alle fünf Kapitel.
Öffentlicher Start.

**Phase 4 — Ausbau.**
Englische Fassung, Schulmodus mit druckbaren Antwortbögen, Saisonrouten (Weihnachtsmarkt, Wasen,
Weinlese), Route-Editor für Schulen und Vereine, optional moderierte Partnerstationen.

### 9.3 Testplan

- **5 Haushalte** mit Kindern zwischen 8 und 14: Route 1.
- **2 Schulklassen** der Klassen 6–8: Route 1 als Schulausflug, mit Aufsicht.
- **1 Seniorinnengruppe**: Route 1, barrierearme Variante.
- **1 Rollstuhl-/Kinderwagentest**: Route 1 und 2; dokumentieren, wo es nicht weitergeht.
- **2 erfahrene Wanderer**: Route 4 und 5; Zeit, Wasser, Ausstiegspunkte.
- **1 Nachtgruppe**: Route 3; Sicherheit, Beleuchtung, letzte Abfahrten.
- **1 blinder oder sehbehinderter Tester**: Textroute, Screenreader, Alternativen zu visuellen Aufgaben.

Messgrößen: Abschlussquote, tatsächliche Dauer, Hinweisrate, falsche Antworten pro Station,
Verwirrungspunkte, Sicherheitsvorfälle, „Ich habe etwas Neues gesehen“ (1–5), „Ich würde es
weiterempfehlen“ (1–5).

### 9.4 Erfolgskriterien für den Pilot

- mindestens 70 Prozent der Testgruppen schließen die Route ab
- die tatsächliche Dauer liegt höchstens 25 Prozent über der Angabe
- weniger als 30 Prozent der Hauptstationen werden mit Hinweis 3 gelöst
- keine Sicherheitsvorfälle
- keine Station ist unauffindbar oder dauerhaft geschlossen
- Route 1 ist mit Kinderwagen und mit Hilfe einer Begleitperson bewältigbar
- die Textroute funktioniert ohne Kartenkacheln
- mindestens 80 Prozent sagen: „Ich habe etwas Neues über Stuttgart gelernt“

### 9.5 Pflege

- **Jährliche Routenkontrolle** im Frühjahr: alle Stationen gehen, fotografieren, Antworten prüfen,
  Quellen und Lizenzen aktualisieren.
- **Monatlicher Baustellencheck** gegen die vorhandenen Baustellendaten. Liegt eine Station in einer
  Sperrung, wird sie als „vorübergehend nicht erreichbar“ markiert und die App bietet eine Alternative.
- **Saisoncheck** vor Weihnachtsmarkt, Wasen, Weinlese und Sommerhitze.
- **Störungsmeldung** im Spiel: „Station nicht gefunden“, „Antwort hat sich geändert“, „Weg gesperrt“,
  „unsicher“. Ohne Konto, ohne Standort.
- **Änderungsprotokoll** pro Route: Version, Datum, geänderte Stationen, Grund.
- **Keine stillen Änderungen.** Wenn eine Antwort angepasst wird, steht das im Änderungsprotokoll.

---

## 10. Risiken und offene Fragen

| Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|
| Inschriften ändern sich durch Sanierung | Antwort falsch, Frust | stabile Merkmale wählen, Prüfdatum, Foto, Alternative |
| Baustelle oder Sperrung | Route unterbrochen | Baustellencheck, Umleitung, Station überspringen |
| Wetter | Route 4/5 unangenehm oder gefährlich | Wetterhinweis, Saison, Ausweichroute |
| Nachtroute im Sommer sehr spät | jüngere Zielgruppe fällt weg | Saisonfenster, Startzeit, kurze Variante |
| Route 5 zu anspruchsvoll | Abbruch, Erschöpfung | Ausstiegspunkte, klare Kommunikation, Alternativen |
| GPS ungenau im Kessel | „Ich bin da“ funktioniert nicht | Standort optional, Selbstbestätigung |
| Funkloch | Aufgabe nicht prüfbar | Offline-Hash, Textroute, Live-Aufgaben aussetzen |
| Barrierefreiheitsversprechen | Enttäuschung | ehrliche Etappenangaben, Tests mit Betroffenen |
| Inhalte veralten | Qualitätsverlust | jährliche Prüfung, Störungsmeldung, Versionierung |
| Über-Gamification | Spiel überlagert Stadt | keine Streaks, keine Pushs, ruhiger Ton |
| Bilderrechte | rechtliche Probleme | nur Commons mit Lizenz, eigene Fotos, Quellenangabe |
| Stadtwappen oder Hoheitszeichen | rechtliche Nähe | eigenes fiktives Kesselwappen, kein Stadtwappen |
| kommerzielle Begehrlichkeiten | Reihenfolge wird bezahlt | keine bezahlten Orte, keine Affiliate-Links |
| Wenig Zeit für Redaktion | nur 2 statt 5 Routen | MVP mit 2 Routen, Rest später |

### Offene Fragen und Empfehlungen

| Frage | Empfehlung |
|---|---|
| Name | **Kesselcode** als Arbeitstitel; Alternativen: Kesselchronik, Fünf Wege, Stadtspiel Stuttgart. „Kesseljagd“ nicht verwenden, das ist historisch eine Jagdform und klingt aggressiver. |
| Modul oder eigene App? | Modul in Open Stuttgart, plus Deep-Link und optionaler Vollbildmodus. Keine zweite App. |
| Start mit wie vielen Routen? | Zwei: Route 1 für den Einstieg, Route 4 als Kontrast. Dann monatlich erweitern. |
| Eintrittspreise? | Hauptstationen kostenlos. Wilhelma, Fernsehturm, Museen nur als freiwillige Bonusstationen. |
| Globale Bestenliste? | Nein. Nur lokale Zeiten und Abzeichen. |
| Physische Stempel? | Später, nur mit Partnern und ohne Abhängigkeit. Keine QR-Aufkleber im öffentlichen Raum. |
| Sprachen? | Deutsch zuerst; Englisch für Route 1 und 2, dann alle. |
| Gruppenmodus? | Später: ein Gerät als Routenbuch, optional mehrere Geräte über einen kurzen Code. Kein Konto. |
| Schulmodus? | Ja, als druckbarer Antwortbogen und Lehrkräfteleitfaden. Keine Schülerdaten. |
| Story-Tiefe? | Leicht und überspringbar. Die Stadt ist die Geschichte. |
| Lizenz der Inhalte? | Code EUPL-1.2; Routentexte und Fakten CC BY-SA 4.0; Antwortschlüssel nicht veröffentlichen. |
| Werbung oder Förderung? | Keine Werbung. Förderung nur, wenn sie die Unabhängigkeit nicht berührt und transparent genannt wird. |

---

## 11. Nächste Schritte

1. **Name und Umfang entscheiden.** „Kesselcode“ als Arbeitstitel bestätigen; Start mit zwei Routen.
2. **Papierprototyp Route 1 bauen.** Acht Stationskarten, eine Karte, ein Antwortbogen. Mit fünf
   Gruppen gehen. Beobachten, nicht erklären.
3. **Datenschema und Build-Skript anlegen.** `scripts/build-spiel.mjs`, YAML-Format, Validierung,
   öffentliche und private Daten trennen.
4. **Route 1 redaktionell fertigstellen.** Alle acht Stationen vor Ort prüfen, fotografieren, Quellen
   und Lizenzen eintragen, Hinweise schreiben.
5. **UI und Karte bauen.** Routenbuch, Station-Sheet, Suchraum, Stempel, Teilen-Bild, Textroute.
6. **Feldtest und Barrierefreiheit.** Route 1 mit Familien, Schulklasse, Kinderwagen und Screenreader.
7. **Route 4 ergänzen.** Andere Schwierigkeit, andere Landschaft, andere Zielgruppe. Damit ist der
   Beweis erbracht, dass das System trägt.
8. **Dann die restlichen drei Routen.** Route 2, 3 und 5 nacheinander, jede mit eigenem Testlauf.
9. **Öffentlich starten.** Mit einer ehrlichen „Beta“-Kennzeichnung, einem Störungsformular und einem
   Pflegeplan.

---

## Anhang: Quellen und Lizenzen

| Inhalt | Quelle | Lizenz |
|---|---|---|
| Orte, Fakten, Kurzbeschreibungen | Wikidata, Wikipedia, Stadt Stuttgart | CC0, CC BY-SA 4.0, CC BY 4.0 |
| Bilder | Wikimedia Commons, eigene Fotos | je Datei; Quellenangabe |
| Karte und Wege | OpenStreetMap, Geoserver Stuttgart | ODbL, CC BY 4.0 |
| Haltestellen und Abfahrten | VVS/EFA, GTFS | Quellenangabe Open Stuttgart |
| Wetter, Warnungen, Sonne | DWD, Bright Sky, eigene Berechnung | je Quelle |
| Baustellen | Stadt Stuttgart, MobiData BW | CC BY 4.0 |
| Trinkbrunnen, Toiletten | Stadt Stuttgart, OpenStreetMap | CC BY 4.0, ODbL |
| Spieltexte und Aufgaben | eigene Redaktion | CC BY-SA 4.0 (Vorschlag) |
| Code | Open Stuttgart | EUPL-1.2 |

**Grundsatz:** Keine Inhalte aus Google Maps, Geocaching.com oder kommerziellen Stadtführern. Keine
Logos oder geschützten Zeichen von Wilhelma, Mercedes-Benz, Porsche oder der Stadt Stuttgart ohne
Erlaubnis. Ortsnamen dürfen als Fakten genannt werden. Das Kesselwappen ist eine eigene Gestaltung.

---

### Kurzfassung für die erste Besprechung

> **Kesselcode** ist eine Schnitzeljagd durch Stuttgart, die auf den offenen Daten von Open Stuttgart
> aufbaut. Fünf Routen zwischen zwei und acht Stunden führen zu Orten, an denen die Antworten wirklich
> stehen: Jahreszahlen, Tiere, Stufen, Symbole. Man trägt sie in die App ein, bekommt ein Siegel und
> eine belegte Stadtwissen-Karte. Kein Konto, kein Tracking, kein Countdown. Am Ende stehen fünf
> Kapitel und ein eigenes Kesselwappen. Der Einstieg ist Route 1 in der Innenstadt; danach kommen der
> Neckar, die Nacht, die Weinberge und die fünf Gipfel.
