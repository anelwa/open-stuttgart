# StuttBot (StuggiAI): Entwurf und Umsetzung

Stand: 23.10.2026. StuttBot ist der Bürgeranliegen-Assistent von Open Stuttgart. In der Oberfläche heißt er seit dem Redesign **StuggiAI**.

> Weiterentwicklung: [`docs/stuttbot-2-konzept.md`](stuttbot-2-konzept.md) beschreibt StuttBot 2.0 als
> Kommandoschicht über der Karte – mit Voice Mode, typisierten UI-Aktionen, Tool-Gateway und MCP-Anbindung.

Er beantwortet Fragen wie „Ich will einen Personalausweis beantragen“, fragt die fehlenden Angaben ab, findet das passende Bürgerbüro, rechnet Wartezeit und Fahrzeit zusammen und verlinkt die Terminbuchung.

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

### Das Modell ruft Werkzeuge selbst auf (Function Calling)

Ist ein Modell konfiguriert, arbeitet StuttBot als Tool-Calling-Agent: Das Modell entscheidet pro Runde selbst, ob es
`suche_leistung`, `leistung_details`, `buergerbuero`, `route` oder `ort_suchen` aufruft, und formuliert die Antwort aus
den Ergebnissen. Der Server führt die Werkzeuge aus, begrenzt die Schleife auf fünf Runden und erdet die Antwort
anschließend hart. Ohne Key oder bei Modellfehlern greift der deterministische Regelpfad (Katalog, Slots, feste
Reihenfolge). Der API-Key bleibt in beiden Fällen serverseitig.

### Ohne Key bleibt der Bot benutzbar

Fehlt der Gemini-Key, ist das Tagesbudget aufgebraucht oder antwortet der Anbieter mit 429/5xx, greift der
deterministische Regelpfad mit einer festen Antwort. Die Oberfläche kennzeichnet das mit „Regelbasiert beantwortet“.
Ein budgetlimitierter Key macht den Bot also nicht unbrauchbar, sondern nur weniger flüssig.

## 3. Modell und Kosten

Im Betrieb läuft StuttBot über Atlas Cloud mit **`google/gemini-3.1-flash-lite`** (0,25 / 1,50 USD pro 1 Mio. Token,
Prepaid). Ohne Provider-Präfix gilt Googles Standardmodell **Gemini 2.5 Flash-Lite**; über `OS_BOT_MODEL` lässt sich
jedes kompatible Modell einsetzen, `OS_BOT_MODEL_FALLBACK` fängt Fehler des Hauptmodells ab.

| Modell | Eingabe / 1 Mio. Token | Ausgabe / 1 Mio. Token | Einsatz |
|---|---:|---:|---|
| `gemini-2.5-flash-lite` | 0,10 USD | 0,40 USD | günstigster Pfad |
| `gemini-3.1-flash-lite` | 0,25 USD | 1,50 USD | Standard im Betrieb (Atlas) |
| `gemini-3.5-flash-lite` | 0,15 USD | 1,25 USD | neuere Generation, gute Balance |
| `gemini-2.5-flash` | 0,30 USD | 2,50 USD | nur falls Flash-Lite zu schwach ist |

Preise Stand 10/2026, maßgeblich sind die Preislisten von Google bzw. Atlas Cloud.

Je nach Anliegen braucht eine Runde **1–5 Modellaufrufe**: Eine reine Wegefrage ist nach einem Werkzeugaufruf
beantwortet, ein Personalausweis-Anliegen typischerweise nach drei (Suche → Details → Bürgerbüro).

Ein Modellaufruf liegt bei etwa 1,5–3k Eingabe- und 100–250 Ausgabe-Token, mit `gemini-3.1-flash-lite` also rund
0,04–0,11 US-Cent. Eine Agentenrunde mit drei Aufrufen kostet damit **0,15–0,35 US-Cent**; 1.000 Gespräche mit je drei
Runden liegen bei etwa 5–10 US-Dollar. Das Standard-Tagesbudget von 0,50 USD reicht für etwa 150–300 Runden pro Tag.
Der echte Verbrauch wird aus `usageMetadata` der Antwort berechnet und in `server/.cache/bot-budget.json` tagesgenau
(Europe/Berlin) fortgeschrieben — die Preise stehen in der `PRICES`-Tabelle in `server/sources/bot.mjs`.

Der Key sollte auf Google-Seite zusätzlich ein hartes Tageslimit haben. Das lokale Budget ist der zweite Schutz, nicht der einzige.

## 4. Gesprächsablauf

```text
Nutzertext
   │
   ├─ Reset / Smalltalk?                    → direkte Antwort
   │
   ├─ Modell verfügbar? ──ja──> Tool-Calling-Agent (max. 5 Runden)
   │                             ├─ suche_leistung
   │                             ├─ leistung_details
   │                             ├─ buergerbuero (Wartezeit + Anfahrt)
   │                             ├─ route (Wegefragen)
   │                             └─ ort_suchen
   │                             └─ Erdung: Beträge/Büronamen/URLs nur aus Werkzeugen
   │
   └─ sonst / Modellfehler / Erdung fehlgeschlagen → deterministischer Regelpfad
                                 ├─ Katalog + Slots
                                 ├─ verwaltungLeistung / verwaltungWo
                                 └─ route
```

### Beispiel: Personalausweis

| Schritt | Nutzer | StuttBot |
|---|---|---|
| 1 | „Ich brauche einen neuen Personalausweis“ | Agent ruft `suche_leistung` und `leistung_details` auf, findet den Terminlink |
| 2 | (Standort fehlt) | „Wo startest du? Adresse, PLZ oder Standort.“ |
| 3 | Standort Möhringen | Agent ruft `buergerbuero` auf: „Bürgerbüro Vaihingen, mit Bahn/Bus 24 Minuten — Termin buchen …“ |

Der Agent entscheidet selbst, in welcher Reihenfolge er sucht, Details lädt und den Ort auswertet. Beim reinen
Personenausweis reicht oft ein Schritt; bei Sonderfällen (verloren, Kind unter 16) fragt das Modell nach.

## 5. Werkzeuge und Daten

| Werkzeug | Eingabe | Ausgabe | Verwendung |
|---|---|---|---|
| `suche_leistung` | Freitext | Leistungen mit URL | Agent: Einstieg in ein Anliegen |
| `leistung_details` | URL | Unterlagen, Gebühren, Terminlink, Online-Dienst | Agent: Faktenbasis |
| `buergerbuero` | Leistungs-URL | bestes Bürgerbüro, Wartezeit, Anfahrt, Alternativen | Agent: Ortswahl (intern `verwaltungWo` + `route`) |
| `route` | Ziel, Modus | Varianten mit Dauer und Umstiegen | Agent: reine Wegefragen |
| `ort_suchen` | Adresse, PLZ oder Ortsname | Koordinate + Label | Agent: Standort auflösen |
| `detectIntent` / `understand` | Freitext + Katalog | Anliegen-ID, Slots | Regelpfad (Fallback) |
| `verwaltungSuche` | Freitext | Leistungen, Einheiten, Gebäude | Regelpfad und `suche_leistung` |
| `verwaltungLeistung` | URL | Abschnitte, Gebühren, Unterlagen, Online-Angebote, Terminlink | Regelpfad und `leistung_details` |
| `verwaltungWo` | Leistungs-URL + Koordinate | Orte mit Entfernung, „jetzt geöffnet“, Wartezeit, Terminlink | Regelpfad und `buergerbuero` |
| `buergerbueros` | – | Live-Ampel aller Bürgerbüros | Wartezeit |
| `route` (intern) | von, nach, Modus | Varianten mit Dauer, Umstiegen, Echtzeit | Anfahrt |
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

Der Systemprompt des Agenten enthält nur wenige Regeln:

- Deutsch, 2 bis 4 Sätze, keine Aufzählungen,
- Werkzeuge nutzen statt raten,
- ausschließlich Fakten aus den Werkzeugergebnissen,
- fehlende Felder offen benennen (kein Allgemeinwissen zu Unterlagen, Preisen, Fristen),
- keine erfundenen Gebühren, Fristen, Adressen oder Öffnungszeiten,
- keine Behauptung, einen Termin gebucht zu haben,
- keine URLs im Text (Links nur über Schaltflächen),
- bei Notfällen 112, keine Rechtsberatung.

Nach der Modellantwort prüft der Server hart gegen die Werkzeugergebnisse:

- jede Zahl mit „Euro“/„€“ muss in den Werkzeugergebnissen vorkommen,
- jeder genannte Bürgerbüro-Name muss dort vorkommen,
- URLs im Fließtext führen zur Verwerfung (Links gehören in die Aktionen),
- Formulierungen wie „gebucht“ oder „reserviert“ führen zur Verwerfung.

Wenn eine Prüfung fehlschlägt, greift der deterministische Regelpfad. Das Modell kann damit im schlechtesten Fall
schlechter formulieren, aber keine falschen Fakten in die Welt setzen.

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

## 9. Oberfläche, Name und Zeichen

Einstieg ist eine amberfarbene **StuggiAI**-Pille ganz links in den Schnellaktionen. Auf Desktop öffnet sich rechts die Gesprächsschiene, auf Mobil ein Blatt. Die Karte rückt auf Desktop um die Panelbreite zur Seite; Suche und Kartensteuerung bleiben erreichbar.

Das Panel enthält:

- Einstieg mit dem StuggiAI-Zeichen und vier Beispielen,
- Blasen für Nutzer und Bot, Antwortkarten für Bürgerbüro, Route, Termine, Wetter, Parken und Wissen,
- Aktionen „Termin buchen“, „Online erledigen“, „Route öffnen“, „Auf Karte“,
- Voice Mode mit Push-to-Talk, Freihändig, Vorlesen und Untertiteln,
- Quittungen für Kartenaktionen mit „Rückgängig“,
- Nachfrage-Chips („Welche Unterlagen brauche ich?“, „Kann ich das online erledigen?“),
- Hinweis „Regelbasiert beantwortet“, wenn der Fallback greift,
- Quellen und Grenzen an jeder Antwort,
- Fußzeile mit Modellhinweis und „Keine Rechtsberatung“.

### Das Zeichen: Büste mit leuchtenden Augen

`src/components/StuggiMark.tsx` zeichnet eine **stilisierte Büste im Anzug** als schwarze Silhouette auf
gelber Kachel, mit Hemd, Krawatte und zwei leuchtenden Augen. Das Zeichen ist als SVG skalierbar und
funktioniert von 18 px (Pille) bis 92 px (Einstieg); bei `badge={false}` übernimmt die Büste die Textfarbe.
Der Kompatibilitätsname `StuttBotMark` bleibt für ältere Importe erhalten.

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
| `src/components/StuggiMark.tsx` | Büste mit leuchtenden Augen, gelbe oder dunkle Kachel |
| `src/components/StuttBotMark.tsx` | Kompatibilitätsname für ältere Importe |
| `src/styles/stuttbot.css` | Panel, Karten, Voice Mode, Quittungen, Mobil-Layout |
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
# Alternativ Atlas Cloud (Prepaid, ein Key für viele Modelle):
# GEMINI_API_KEY=apikey-…
# OS_BOT_API_BASE=https://api.atlascloud.ai/v1
# OS_BOT_MODEL=google/gemini-3.1-flash-lite        # Provider-Präfix gehört zur ID
# OS_BOT_MODEL_FALLBACK=google/gemini-2.5-flash-lite
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
