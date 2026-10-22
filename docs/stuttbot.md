# StuttBot: Entwurf und Umsetzung

Stand: 22.10.2026. StuttBot ist der Bürgeranliegen-Assistent von Open Stuttgart. Er beantwortet Fragen wie „Ich will einen Personalausweis beantragen“, fragt die fehlenden Angaben ab, findet das passende Bürgerbüro, rechnet Wartezeit und Fahrzeit zusammen und verlinkt die Terminbuchung.

## 1. Ziel und Abgrenzung

StuttBot soll den Weg von einer Alltagssprache-Frage zu einer belastbaren Handlung abkürzen:

1. Welche Leistung ist gemeint?
2. Welche Angaben braucht die Stadt dafür?
3. Welcher Ort ist jetzt am besten erreichbar?
4. Wie lange dauert Wartezeit plus Anfahrt?
5. Wo wird der Termin gebucht oder die Leistung online erledigt?

Nicht Teil des Bots:

- keine Terminbuchung und keine Reservierung (nur Link zur Buchung),
- keine Rechts- oder Sozialberatung,
- keine Auskunft über freie Termine (die Stadt stellt dafür keine offene API bereit),
- keine Speicherung von Chatverläufen,
- keine beliebigen Web-Abfragen oder Tool-Aufrufe des Modells.

## 2. Drei Grundentscheidungen

### Das Modell ist Sprachschicht, nicht Faktenquelle

Ein günstiges Flash-Lite-Modell entscheidet nicht selbst, welche Gebühr gilt oder welches Bürgerbüro offen ist. Es versteht Freitext, füllt Slot-Werte und formuliert die Antwort. Die Fakten kommen ausschließlich aus den vorhandenen Server-Werkzeugen:

- Verwaltungsdatensatz (`verwaltung.sqlite`, `verwaltung.json`),
- Live-Wartezeiten der Bürgerbüros,
- Öffnungszeiten und Feiertage,
- EFA-BW/Valhalla für die Anfahrt.

Das ist billiger, schneller und deutlich verlässlicher als ein Agent, der frei Werkzeuge auswählt. Es verhindert außerdem, dass das Modell erfundene URLs aufruft oder erfundene Gebühren nennt.

### Werkzeuge laufen serverseitig und deterministisch

Der Server entscheidet anhand des Katalogs und der Slot-Werte, welche Werkzeuge in welcher Reihenfolge laufen. Das Modell sieht nur das Ergebnis als kompaktes Fakten-JSON. Dadurch bleiben die Antworten reproduzierbar, und der API-Key wird nie an den Browser ausgeliefert.

### Ohne Key bleibt der Bot benutzbar

Fehlt der Gemini-Key, ist das Tagesbudget aufgebraucht oder antwortet Google mit 429/5xx, greift derselbe Werkzeugpfad mit einer deterministischen Antwort. Die Oberfläche kennzeichnet das mit „Regelbasiert beantwortet“. Ein budgetlimitierter Key macht den Bot also nicht unbrauchbar, sondern nur weniger flüssig.

## 3. Modell und Kosten

Standardmodell ist **Gemini 2.5 Flash-Lite**. Es ist das günstigste Modell der Gemini-Familie und für Intent-Erkennung, Slot-Extraktion und kurze deutsche Antworten ausreichend. Über `OS_BOT_MODEL` lässt sich ohne Codeänderung auf ein stärkeres Flash-Lite wechseln.

| Modell | Eingabe / 1 Mio. Token | Ausgabe / 1 Mio. Token | Einsatz |
|---|---:|---:|---|
| `gemini-2.5-flash-lite` | 0,10 USD | 0,40 USD | Standard, günstigster Pfad |
| `gemini-3.1-flash-lite` | 0,25 USD | 1,50 USD | mehr Sprachqualität |
| `gemini-3.5-flash-lite` | 0,15 USD | 1,25 USD | neuere Generation, gute Balance |
| `gemini-2.5-flash` | 0,30 USD | 2,50 USD | nur falls Flash-Lite zu schwach ist |

Preise Stand 10/2026, maßgeblich ist die [Gemini-Preisseite](https://ai.google.dev/gemini-api/docs/pricing).

Eine Runde besteht aus höchstens zwei Modellaufrufen:

- **Verstehen**: Intent + Slots + optional Ortsangabe, etwa 0,8–1,2k Eingabe-Token und 100 Ausgabe-Token.
- **Formulieren**: Fakten-JSON + Regeln, etwa 1,3–1,8k Eingabe-Token und 150–250 Ausgabe-Token.

Damit kostet eine Runde mit 2.5 Flash-Lite rund **0,03 bis 0,05 US-Cent**. Ein Gespräch mit drei Runden liegt bei etwa 0,1 US-Cent; 1.000 solcher Gespräche kosten rund 1 US-Dollar. Das Standard-Tagesbudget von 0,50 USD reicht damit für etwa 1.500 Runden pro Tag. Der echte Verbrauch wird aus `usageMetadata` der Gemini-Antwort berechnet und in `server/.cache/bot-budget.json` tagesgenau (Europe/Berlin) fortgeschrieben.

Der Key sollte auf Google-Seite zusätzlich ein hartes Tageslimit haben. Das lokale Budget ist der zweite Schutz, nicht der einzige.

## 4. Gesprächsablauf

```text
Nutzertext
   │
   ├─ Reset / Smalltalk / letzte Nachfrage?  → direkte Antwort
   │
   ├─ Anliegen im Katalog? ──nein──> Gemini „Verstehen“ ──> Katalog
   │                                      │
   │                                      └─ kein Treffer → Verwaltungssuche
   │
   ├─ fehlende Slot-Frage?  → eine Frage + Antwortchips
   │
   ├─ Standort fehlt?       → Adresse, PLZ oder „Standort freigeben“
   │
   ├─ Leistung laden        → verwaltungLeistung(url)
   ├─ Orte + Wartezeit      → verwaltungWo(url, lat, lon)
   ├─ Anfahrt               → route(von, nach, modus)
   ├─ Fakten bauen          → Gebühr, Unterlagen, Terminlink, bester Ort
   └─ Antwort               → Gemini „Formulieren“ oder deterministischer Text
```

### Beispiel: Personalausweis

| Schritt | Nutzer | StuttBot |
|---|---|---|
| 1 | „Ich will einen Personalausweis beantragen“ | „Worum geht es beim Personalausweis?“ (Erstmalig/abgelaufen, verloren, Kind unter 16, Adresse ändern) |
| 2 | „abgelaufen“ | „Wie alt bist du? Das entscheidet über die Gebühr.“ |
| 3 | „34“ | „Wo startest du? Adresse, PLZ oder Standort.“ |
| 4 | Standort Möhringen | „Bürgerbüro Vaihingen: nur mit Termin, mit Bahn/Bus 24 Minuten. Gebühr 46 Euro. Termin buchen …“ |

Die Reihenfolge ist bewusst: erst die fachliche Einordnung, dann die Gebühr, dann der Ort. So muss der Bot nicht alle 23 Bürgerbüros anfragen, bevor klar ist, welche Leistung überhaupt gebraucht wird.

## 5. Werkzeuge und Daten

| Werkzeug | Eingabe | Ausgabe | Verwendung |
|---|---|---|---|
| Katalog / `detectIntent` | Freitext | Anliegen-ID | schnelle, kostenlose Ersterkennung |
| Gemini `understand` | Freitext + Katalog | Intent, Slots, Ortsangabe | Paraphrasen und unklare Formulierungen |
| `verwaltungSuche` | Freitext | Leistungen, Einheiten, Gebäude | Fallback für nicht kuratierte Anliegen |
| `verwaltungLeistung` | URL | Abschnitte, Gebühren, Unterlagen, Online-Angebote, Terminlink | Faktenbasis |
| `verwaltungWo` | Leistungs-URL + Koordinate | Orte mit Entfernung, „jetzt geöffnet“, Wartezeit, Terminlink | Ortsauswahl |
| `buergerbueros` | – | Live-Ampel aller Bürgerbüros | Wartezeit |
| `route` | von, nach, Modus | Varianten mit Dauer, Umstiegen, Echtzeit | Anfahrt |
| `ortSuche` / `adresse` | Adresse oder PLZ | Koordinate + Label | Standort auflösen |

### Ortsauswahl

Für Bürgerbüro-Leistungen werden nur echte Bürgerbüros betrachtet, nicht das fachlich zuständige Referat. Ausgabe- und Ausbildungstheken fliegen raus. Dann gilt:

```text
score = (offen ? 0 : nur mit Termin ? 45 : 80)
      + (geschlossen ? 40 : 0)
      + (keine Wartemarken ? 120 : 0)
      + Wartezeit * 0,6
      + Luftlinie / 250
```

Der beste Treffer bekommt eine echte EFA-Route (ÖPNV) bzw. Valhalla-Route (zu Fuß). Alternativen werden aus der Luftlinie geschätzt, damit nicht für jedes der 23 Bürgerbüros eine externe Anfrage nötig ist. Bei einer Wartezeit von 150 Minuten verliert ein Büro gegen ein näheres mit 15 Minuten; bei „nur mit Termin“ wird der Terminlink wichtiger als die Live-Wartezeit.

## 6. Prompting und Erdung

Der Systemprompt für die Antwort enthält nur wenige Regeln:

- Deutsch, per „du“, 2 bis 4 Sätze,
- ausschließlich Fakten aus dem JSON,
- keine erfundenen Gebühren, Fristen, Adressen oder Öffnungszeiten,
- keine Behauptung, einen Termin gebucht zu haben,
- höchstens ein Terminlink und ein Leistungslink,
- bei Notfällen 112, keine Rechtsberatung.

Nach der Modellantwort prüft der Server hart:

- jede Zahl mit „Euro“/„€“ muss im Fakten-JSON vorkommen,
- jeder genannte Bürgerbüro-Name muss im Fakten-JSON vorkommen,
- jede URL muss im Fakten-JSON vorkommen,
- Formulierungen wie „gebucht“ oder „reserviert“ führen zur Verwerfung.

Wenn eine Prüfung fehlschlägt, wird die deterministische Antwort verwendet. Das Modell kann damit im schlechtesten Fall schlechter formulieren, aber keine falschen Fakten in die Welt setzen.

## 7. Budget, Missbrauch und Betrieb

| Schutz | Standard | Variable |
|---|---|---|
| Tagesbudget | 0,50 USD | `OS_BOT_DAILY_USD` |
| Rate-Limit pro IP | 40 Anfragen/Stunde | `OS_BOT_RATE` |
| Max. Runden pro Session | 24 | im Code |
| Session-TTL | 45 Minuten | im Code |
| Modell-Timeout | 12 Sekunden | im Code |
| Kill-Switch | – | `OS_BOT=0` |

Weitere Schutzmaßnahmen:

- Request-Body maximal 32 KB,
- Nachricht maximal 1.200 Zeichen,
- Session-IDs nur `[a-zA-Z0-9-]{8,80}`,
- keine Chattexte in Logs; `OS_BOT_LOG=1` loggt nur Intent, Fallback, Dauer, Turn,
- bei 429 wird das Modell 5 Minuten pausiert, bei ungültigem Key 10 Minuten,
- der Key wird nur über `GEMINI_API_KEY` oder `GOOGLE_API_KEY` gelesen.

Hinter Dokploy/nginx muss `OS_TRUST_PROXY=1` gesetzt sein, damit das Rate-Limit die echte Client-IP sieht.

## 8. Datenschutz

- Der Gemini-Key liegt ausschließlich auf dem Server und wird nie in das Vite-Bundle geschrieben.
- Sessions liegen nur im Arbeitsspeicher und verfallen nach 45 Minuten. Es gibt keine Chatdatenbank.
- Der Standort wird serverseitig aufgelöst. An Gemini geht nur „Standort vorhanden“ bzw. ein grober Label, keine Koordinate und keine Adresse.
- Der Nutzertext wird für das Verstehen an Gemini geschickt. Die Oberfläche sagt deshalb: keine sensiblen Daten eingeben.
- Für Produktion ist der bezahlte Gemini-Tier zu empfehlen. Im Free Tier kann Google die Daten laut Preisseite zur Produktverbesserung nutzen; das ist für eine Stadt-Anwendung nicht der richtige Standard.
- Der Bot fragt nie nach Ausweisnummer, IBAN, Gesundheitsdaten oder ähnlichem. Das steht auch im Systemprompt.

## 9. Oberfläche und Maskottchen

Einstieg ist eine amberfarbene **StuttBot**-Pille ganz links in den Schnellaktionen. Auf Desktop öffnet sich rechts ein Chat-Panel, auf Mobil ein Vollbild-Blatt. Die Karte rückt auf Desktop um die Panelbreite zur Seite; Suche und Kartensteuerung bleiben erreichbar.

Das Panel enthält:

- Einstieg mit Maskottchen und vier Beispielen,
- Blasen für Nutzer und Bot,
- Antwortkarten für das empfohlene Bürgerbüro mit Wartezeit, Anfahrt und Gesamtzeit,
- Aktionen „Termin buchen“, „Online erledigen“, „Route öffnen“, „Auf Karte“,
- Nachfrage-Chips („Welche Unterlagen brauche ich?“, „Kann ich das online erledigen?“),
- Hinweis „Regelbasiert beantwortet“, wenn der Fallback greift,
- Fußzeile mit Modellhinweis und „Keine Rechtsberatung“.

### Das Maskottchen: Fernsehtürmli

`src/components/StuttBotMark.tsx` zeichnet ein **schwarzes Fernsehtürmli auf Gold**: Turmkorb mit Gesicht, schlanker Schaft, Sockel, Antenne. Es ist eine reduzierende Kurzform des Stuttgarter Fernsehturms und gleichzeitig ein kleiner Roboter. Die schwarze Fläche bleibt ruhig; nur Augen, Mund und Aussichtsplattform sind gold. Die Form funktioniert von 18 px (Pille) bis 92 px (Einstieg) und vermeidet bewusst ein großes Gesicht im Nahformat.

## 10. Ausfälle und Fallbacks

| Situation | Verhalten |
|---|---|
| kein Key | deterministische Antwort, Fußzeile „Regelmodus“ |
| 429 / Quota | 5 Minuten kein Modellaufruf, danach erneut |
| ungültiger Key | 10 Minuten kein Modellaufruf, Warnung im Serverlog |
| Timeout | deterministische Antwort |
| Budget erschöpft | deterministische Antwort bis zum nächsten Tag |
| Modell liefert ungültiges JSON | Katalog/Slot-Parser bleibt zuständig |
| Modell erfindet Zahl/URL/Name | Antwort wird verworfen, Fallback |
| kein passender Suchtreffer | Bot fragt nach, statt falsch zu antworten |
| EFA/Route nicht erreichbar | Schätzung aus Luftlinie, als „geschätzt“ markiert |

## 11. Tests

`npm run check:bot` startet sechs Gespräche direkt gegen `server/sources/bot.mjs`:

1. Personalausweis mit zwei Rückfragen, Standort und Büro-Empfehlung,
2. Wohnsitz anmelden mit Adresse,
3. Führungszeugnis mit Online-Dienst,
4. Kita-Platz,
5. unbekanntes Anliegen (darf nicht falsch antworten),
6. Terminwunsch ohne Leistung.

Die Fälle laufen ohne Gemini-Key und prüfen damit den wichtigsten Pfad: Der Bot muss auch dann funktionieren, wenn das Budget oder der Key nicht verfügbar ist. Für den Modellpfad sollte vor dem Produktivstart eine Golden-Liste mit 30–50 echten Formulierungen dazukommen; gemessen werden Intent-Treffer, Slot-Füllung, Ortswahl, Faktenfehler, Latenz und Kosten pro Runde.

## 12. Dateien und Konfiguration

| Datei | Zweck |
|---|---|
| `server/sources/bot.mjs` | Session, Budget, Gemini-Client, Werkzeugkette, Fallback |
| `server/sources/bot-katalog.mjs` | kuratierte Anliegen, Slots, Synonyme, Leistungs-URLs |
| `server/index.mjs` | `POST /api/bot`, `GET /api/bot/health` |
| `src/components/StuttBot.tsx` | Chat-Panel, Aktionen, Standort, Karten-/Routen-Übergabe |
| `src/components/StuttBotMark.tsx` | Fernsehtürmli-Maskottchen |
| `src/styles/stuttbot.css` | Panel, Karten, Mobil-Layout, Maskottchen-Umfeld |
| `scripts/bot-eval.mjs` | deterministische Gesprächsprüfung |

Umgebungsvariablen:

```bash
GEMINI_API_KEY=...              # Pflicht für den Modellpfad
OS_BOT_MODEL=gemini-2.5-flash-lite
OS_BOT_MODEL_FALLBACK=          # optional, z. B. gemini-3.5-flash-lite
OS_BOT_DAILY_USD=0.50
OS_BOT_RATE=40
OS_BOT_STATE=server/.cache/     # Budgetdatei
OS_BOT_API_BASE=https://generativelanguage.googleapis.com/v1beta   # für Tests/Proxy
OS_BOT=1                        # 0 = Kill-Switch
OS_BOT_LOG=0                    # 1 = Intent/Latenz/Fehler loggen
OS_TRUST_PROXY=1                # hinter Dokploy/nginx
```

Die Werte können in einer `.env` im Projektordner liegen; `server/env.mjs` lädt sie beim Start. Vorhandene Umgebungsvariablen (Docker, Dokploy, Shell) haben Vorrang. `.env` ist in `.gitignore` und wird nicht mitgeliefert.

```bash
printf 'GEMINI_API_KEY=dein-key\nOS_BOT_DAILY_USD=0.50\n' > .env
npm start
```

Ohne Key startet der Server trotzdem und nutzt den Regelmodus. Mit Key zeigt `GET /api/bot/health` `"llm": true` und den aktuellen Tagesverbrauch.

## 13. Offene Punkte

- **Terminverfügbarkeit:** Es gibt keine offene API für freie Slots. Der Bot verlinkt nur die Buchung und behauptet keine Verfügbarkeit.
- **Weitere Anliegen:** Wohngeld, Hundesteuer, Sperrmüll und viele Spezialfälle fehlen im kuratierten Katalog. Sie laufen über die Suche, sind aber noch nicht so gut wie die zehn Kernanliegen.
- **Mehrsprachigkeit:** Die Oberfläche hat Sprachumschaltung; der Bot promptet derzeit fest auf Deutsch.
- **„Sie“ statt „du“:** Die App duzt. Für eine Stadt-Anwendung sollte man das bewusst entscheiden und ggf. einen Ton-Schalter anbieten.
- **Modellpreise:** Die Preise und Modellnamen ändern sich. Vor dem Produktivbetrieb die Gemini-Preisseite prüfen und `OS_BOT_MODEL` bzw. das Budget anpassen.
- **Evaluation:** Die sechs Fälle sind ein Rauchtest, keine Qualitätsmessung. Vor dem Rollout eine Golden-Liste mit echten Bürgerformulierungen und ein Feedback-Thumbs aufbauen.
