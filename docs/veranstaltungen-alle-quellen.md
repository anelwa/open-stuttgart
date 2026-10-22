# Alle Termine, die tatsächlich stattfinden: Quellenstrategie für „Was geht“

Stand: 21.10.2026 · Status: Strategie und erste Umsetzung im Repository

## 1. Ziel und Befund

„Was geht“ soll nicht nur den städtischen Kalender und ein paar große Häuser zeigen, sondern **alle öffentlichen
Termine in Stuttgart, die tatsächlich stattfinden** – von der Staatsoper über die freie Szene bis zur Clubnacht im
Kulturbunker. Der Anspruch „alle“ ist mit einer einzelnen Plattform nicht erreichbar:

- Der städtische Kalender ist breit, aber nicht vollständig. Viele Clubs, Kollektive und Jugendhäuser tragen dort
  nicht ein.
- Rausgegangen, Resident Advisor, Eventim, Shotgun und Instagram sind kommerzielle Plattformen. Ihre AGB verbieten
  automatisierte Abrufe oder die Weiterverwendung als Datenbank – RA und Rausgegangen zudem technisch (Bot-Schutz,
  DataDome). Ein Scraper wäre rechtlich und technisch fragil.
- Die verlässlichste Quelle ist der Veranstalter selbst: die Hausseite, der Haus-iCal, der WordPress-Kalender oder
  der Ticketshop, den das Haus ohnehin pflegt.

Die Strategie ist deshalb **venue-first**:

> Termine werden dort gelesen, wo sie stattfinden. Aggregatoren und Plattformen sind Ergänzung und Prüfinstanz,
> nicht die Grundlage. Wo eine Plattform nicht freigegeben ist, wird sie nicht abgerufen – sondern angesprochen.

## 2. Quellenmatrix (live geprüft am 21.10.2026)

| Quelle | Zugang | Abdeckung | Recht / Lizenz | Urteil |
|---|---|---|---|---|
| **Hausseiten der Veranstalter** | iCal, JSON-LD/schema.org, WordPress-REST, HTML | vollständig je Haus, hohe Aktualität | Fakten + Deep-Link; keine Beschreibungen/Bilder | **Tragende Quelle.** Ausbauen. |
| **EINTOPF / LAUTI** (`eintopf.info`) | Tageslisten `/?date=YYYY-MM-DD` mit schema.org-Mikrodaten; REST (`/api/v1/events`); `robots.txt` sperrt `/ical` und `/rss` | 92 Termine im 21-Tage-Fenster nach Stuttgart-Filter (21.10.2026) | keine Datenlizenz angegeben; Fakten + Link | **Sehr guter Long-Tail** für Politik, Kultur, Initiativen. |
| **Gancio-Register** (eigenes) | `GET /api/events`, CC0 1.0 | Szene, Clubs, Jugendhäuser – wenn eingetragen | CC0 | **Zentrale Ergänzung**, braucht Redaktion/Ansprache. |
| **evensos** (`evensos.de`) | JSON-LD (`/events/stuttgart.json`) und iCal; ohne Schlüssel | 74 Termine im Stuttgarter Feed, 24 im 21-Tage-Fenster; vor allem große Häuser/Ticketmaster | Daten dürfen mit Quellenangabe und Link auf die Detailseite weiterverwendet werden | **Guter offener Zusatz**, keine Club-Abdeckung. |
| **KUlturBUnker / Nische** (`ku-bu.de`) | HTML-Terminliste | 10 kommende Termine, inkl. „nische“ | keine Datenlizenz; Fakten + Link | **Hausquelle**, jetzt angebunden. |
| **Fridas Pier** (`fridaspier.de`) | HTML-Terminliste `/event/` | 6 kommende Termine | keine Datenlizenz; Fakten + Link | **Hausquelle**, jetzt angebunden. |
| **Climax Institutes** | HTML-Terminliste `/events/` | 7 kommende Termine | keine Datenlizenz; Fakten + Link | **Hausquelle**, jetzt angebunden. |
| **Kowalski** | WordPress-REST `/wp-json/wp/v2/posts` | 5 kommende Termine | keine Datenlizenz; Fakten + Link | **Hausquelle**, jetzt angebunden. |
| **Weitere Clubbetreiber** (Romantica, White Noise, Zollamt, Schräglage …) | teils eigene Seite, teils nur Instagram/RA | unterschiedlich | Fakten + Link; keine AGB-Verstöße | Nächste Ausbaustufe; siehe Abschnitt 7. |
| **Eventfrog** | Public API mit Key, Filter nach Region/Datum | viele kleine Veranstalter, Vereine, Chöre | API-Bedingungen; Key nötig | **Sinnvolle nächste Quelle** für Kleinträger. |
| **Ticketmaster Discovery** | REST, API-Key | große Häuser (Porsche Arena, Schleyer-Halle …) | proprietär, Attribution + Ticketmaster-Link | Nur Ergänzung für große Häuser. |
| **Reservix** | Partner-API mit Key | Theater, Comedy, Vorverkaufsstellen | Vertragsbedingungen | Anfragen, wenn Theater-/Comedy-Lücke bleibt. |
| **Rausgegangen** | interner JSON-Endpunkt technisch erreichbar; AGB verbieten automatisierte Erfassung ausdrücklich | sehr gute Club-/Szene-Abdeckung | **keine Nutzung ohne schriftliche Freigabe** | **Nur Partnerschaft/Export.** Kein Scraper. |
| **Resident Advisor** | keine offizielle API; inoffizielles GraphQL; Website mit DataDome geschützt; `robots.txt` sperrt `/api/` | elektronische Musik, Clubs | AGB/robots; keine offene Lizenz | **Nur Partnerschaft.** Über Hausseiten indirekt abgedeckt. |
| **VIVA Stuttgart** (`vivastuttgart.de`) | Blog/Instagram, kein Kalender, kein JSON-LD, kein Feed | redaktionelle Eventartikel, keine strukturierten Termine | redaktionell | **Keine Datenquelle.** Nur Inspiration/Ansprache. |
| **LIFT, Prinz, Mit Vergnügen, Coolibri** | redaktionelle Magazine, keine offenen Feeds | Szene-/Kulturwerbung | redaktionell | Nicht automatisierbar; nur verlinken. |
| **Instagram / Facebook** | keine öffentliche API für fremde Inhalte | viele Clubs posten nur dort | Meta-Bedingungen | **Nicht scrapebar.** Lösung: Hausseite/Gancio/Register. |
| **Stadtkalender, Stuttgart-Marketing, Stadtbibliothek, StadtPalais** | RSS, iCal, schema.org | breite städtische Abdeckung | städtische Quellen | **Bereits angebunden.** |

### Technische Befunde zu den beiden genannten Plattformen

**Rausgegangen:** Der interne Endpunkt `https://api.rausgegangen.de/rausgegangen/api/v2` ist ohne Login
erreichbar. `GET /search?city=stuttgart&start_date=2026-10-21&end_date=2026-10-22&limit=100` liefert Subevents mit
`state` (`takes_place`, `canceled`, `sold_out`), Preis, Ort und Koordinaten. Genau dieser `state` wäre für
„tatsächlich stattfindend“ ideal. Die AGB sagen aber u. a.:

> „Die automatisierte Erfassung, Extraktion oder anderweitige Nutzung von Inhalten dieser Website durch Web Scraping,
> Crawler, Bots und/oder ähnliche Technologien ist ausdrücklich untersagt.“

Deshalb gibt es in `venuefeeds.mjs` **keinen Rausgegangen-Standardabruf**. Der Adapter verarbeitet nur einen
Partner-Export über `OS_RAUSGEGANGEN_FILE` oder `OS_RAUSGEGANGEN_URL`. Das ist die technisch saubere Vorbereitung
für eine Kooperation, kein Scraper.

**Resident Advisor:** Es gibt keine offizielle offene API. Die inoffizielle GraphQL-Schnittstelle wird von der
Website genutzt, ist aber nicht dokumentiert und wird von DataDome geschützt; `robots.txt` sperrt `/api/`.
Die Club-Termine von RA lassen sich rechtssicher über die Hausseiten der Clubs erfassen, die ohnehin auf RA verlinken
(Fridas Pier, Climax, Kowalski, Kulturbunker). Genau das macht die neue Venue-Schicht.

**VIVA Stuttgart:** Die Seite ist ein redaktionelles Stadtmagazin (Next.js) mit Blogartikeln und Instagram-Verweisen.
Es gibt keinen strukturierten Kalender, kein JSON-LD und keinen Feed mit Terminen. VIVA ist damit keine
automatisierbare Quelle – allenfalls ein Hinweisgeber für die Redaktion.

## 3. Architektur: vier Schichten plus Prüfung

```
Hausseiten / Haus-Feeds ─┐
Offene Register (Gancio,  ├─→ Normalisieren ─→ Abgleichen ─→ Prüfen ─→ /api/wasgeht + iCal
EINTOPF)                 │     (Titel, Zeit,     (Datum, Ort,    (Status,
Freigegebene Aggregatoren┘      Ort, Preis,       Titel,          lastSeen,
                                Status)           Künstler)       Quelle)
```

### Schicht 1: Hausseiten und Haus-Feeds (tragend)

Jede Spielstätte bekommt einen Adapter nach einem von fünf Typen:

| Typ | Erkennungsmerkmal | Aufwand |
|---|---|---|
| `ical` | `<link rel="alternate" type="text/calendar">` oder `/events.ics`, `/ical` | sehr gering |
| `jsonld` | `application/ld+json` mit `@type: Event` auf der Terminseite | gering |
| `wordpress` | `/wp-json/wp/v2/posts` oder The Events Calendar `/wp-json/tribe/events/v1/events` | gering |
| `html` | feste Terminliste ohne strukturierte Daten | mittel, parserje Haus |
| `partner` | freigegebener JSON-/CSV-Export | gering |

Die Adapter liefern nur **Fakten**: Titel, Beginn, Ende, Ort, Preis, Status, Ticketlink, Quellenlink. Keine
Beschreibungstexte, keine Bilder, keine Künstler-Biografien. Das hält die Nutzung auch bei Häusern ohne offene
Lizenz im Rahmen von Faktenübernahme und verlinkter Quelle.

### Schicht 2: Offene Register

- **Gancio** (CC0) für die Szene, Clubs, Jugendhäuser und Kollektive. Bleibt der wichtigste Hebel für alles, was
  keine eigene Website pflegt.
- **EINTOPF/LAUTI** für politische, kulturelle und nachbarschaftliche Termine. `robots.txt` sperrt `/ical` und
  `/rss`; gelesen werden deshalb die öffentlichen Tageslisten `/?date=YYYY-MM-DD` (schema.org-Mikrodaten je Termin),
  höchstens alle 12 Stunden und gefiltert auf Stuttgart (70xxx bzw. bekannte Stuttgarter Orte).

### Schicht 3: Freigegebene Aggregatoren

- **evensos** ist ausdrücklich zur Weiterverwendung freigegeben und wird als JSON-LD gelesen.
- **Eventfrog** und **Ticketmaster** folgen optional mit Key, sobald der Nutzen die Pflege rechtfertigt.
- **Rausgegangen** und **RA** nur nach schriftlicher Freigabe. Der Rausgegangen-Adapter ist vorbereitet, aber
  standardmäßig inaktiv.

### Schicht 4: Abgleich und Prüfung

Der vorhandene Abgleich in `termine.mjs` führt Dubletten zusammen (Datum, Ort bis 150 m, Zeit ±30 min,
Titelähnlichkeit oder gleicher Hauptkünstler). Neu hinzu kommen zwei Felder:

- **`verified`**: `venue` (Haus hat selbst angekündigt) → `official` (städtische Quelle) → `ticket`/`register`
  (TicketShop/offenes Register) → `aggregator` (nur aggregiert). Beim Zusammenführen gewinnt die stärkere Stufe.
- **`lastSeen`**: Zeitpunkt, zu dem die Quelle den Termin zuletzt bestätigt hat.

Damit lässt sich in der Oberfläche später eine ruhige, ehrliche Kennzeichnung zeigen: „vom Veranstalter bestätigt“
vs. „nur gelistet“. Für „tatsächlich passieren“ gilt:

1. Nur Termine mit Datum im Fenster (heute −1 bis +21 Tage); mehrtägige Ausstellungen am ersten Tag.
2. `state`/`status` der Quelle auswerten: `canceled` → „abgesagt“, `sold_out` → „ausverkauft“, `postponed` →
   „verschoben“. Abgesagte Termine werden nicht gelöscht, sondern gekennzeichnet.
3. Hausseite schlägt Aggregator: verschwindet ein Termin von der Hausseite, bleibt der Aggregator-Eintrag als
   „unbestätigt“ sichtbar, bis die Quelle ihn bestätigt oder der Termin vorbei ist.
4. `lastSeen` älter als 7 Tage → Hinweis „zuletzt bestätigt am …“.
5. Keine Termine ohne Datum/Uhrzeit (Dauerausstellungen, „jederzeit verfügbar“) in der Tagesliste; sie gehören in
   eine eigene Ansicht.

### Schicht 5: Betrieb und Monitoring

- `npm run check:wasgeht` prüft alle Quellen und zeigt Anzahl, Alter und Fehler.
- Jede Quelle hat einen eigenen Schalter `OS_SCENE_<ID>=0`.
- Jede Quelle hat einen eigenen Platten-Cache; ein Parserfehler betrifft nur diese Quelle.
- Neue Häuser werden zuerst mit `check:wasgeht` geprüft, dann in die Quellenliste aufgenommen.
- Parser werden mit einem Datum in der Zukunft getestet, damit leere Listen nicht als Erfolg durchgehen.

## 4. Was jetzt im Repository steckt

Neu: [`server/sources/wasgeht/venuefeeds.mjs`](../server/sources/wasgeht/venuefeeds.mjs)

| Quelle | ID | Typ | Turnus |
|---|---|---|---|
| EINTOPF/LAUTI | `eintopf` | HTML-Tageslisten mit schema.org-Mikrodaten | 12 h |
| KUlturBUnker/Nische | `kubu` | HTML | 6 h |
| Fridas Pier | `fridaspier` | HTML | 6 h |
| Climax Institutes | `climax` | HTML | 6 h |
| Kowalski | `kowalski` | WordPress-REST | 6 h |
| evensos | `evensos` | JSON-LD | 6 h |
| Rausgegangen | `rausgegangen` | Partner-Export | 6 h, nur mit Freigabe |

Die Quellen werden in [`termine.mjs`](../server/sources/wasgeht/termine.mjs) vor den bestehenden Haus- und
Ticketshop-Quellen eingespeist. Die neue Ortsliste enthält den Kulturbunker als `kubu`.
Die Detailansicht in `WasGehtPanel.tsx` zeigt jetzt zusätzlich, wie ein Termin bestätigt ist (Hausquelle,
städtische Quelle, Ticketanbieter, offenes Register oder nur Aggregator) und wann die Quelle ihn zuletzt
bestätigt hat.

### Konfiguration

| Variable | Bedeutung | Standard |
|---|---|---|
| `OS_SCENE_EINTOPF=0` | EINTOPF abschalten | an |
| `OS_SCENE_KUBU=0` | Kulturbunker abschalten | an |
| `OS_SCENE_FRIDASPIER=0` | Fridas Pier abschalten | an |
| `OS_SCENE_CLIMAX=0` | Climax abschalten | an |
| `OS_SCENE_KOWALSKI=0` | Kowalski abschalten | an |
| `OS_SCENE_EVENSOS=0` | evensos abschalten | an |
| `OS_RAUSGEGANGEN_FILE` | lokaler Partner-Export (JSON) | leer |
| `OS_RAUSGEGANGEN_URL` | freigegebener Partner-Endpunkt | leer |

Ohne `OS_RAUSGEGANGEN_*` wird die Quelle gar nicht registriert; es gibt keinen automatischen Abruf der Plattform.

## 5. Warum das „tatsächlich stattfinden“ besser trifft als ein Plattform-Scraper

- **Hausseiten sind die Quelle der Wahrheit.** Ein Club, der eine Nacht absagt, ändert zuerst die eigene Seite und
  den Ticketshop – nicht zwingend die Aggregatoren.
- **Status ist maschinenlesbar.** Rausgegangen liefert `state`, RA nicht; Hausseiten nennen „abgesagt“,
  „ausverkauft“, „verschoben“ oft im Titel oder Text. Der Adapter wertet das aus.
- **Keine veralteten Karteileichen.** Jede Quelle wird regelmäßig neu gelesen; `lastSeen` macht sichtbar, wann
  zuletzt bestätigt wurde. Der Abgleich führt Dubletten zusammen, statt sie doppelt anzuzeigen.
- **Rechtlich belastbar.** Keine Umgehung von Bot-Schutz oder AGB. Die Quellen bleiben benannt und verlinkt.

## 6. Rechtliche Leitlinien

1. **Vorrang:** CC0/CC BY/ODbL und ausdrücklich freigegebene Feeds (Gancio, evensos). EINTOPF hat keine
   ausdrückliche Datenlizenz; dort werden nur Fakten und der Link übernommen.
2. **Fakten + Link:** Bei Häusern ohne offene Lizenz werden nur Terminfakten und der Deep-Link übernommen, keine
   Beschreibungstexte, keine Bilder, keine Datenbankkopie.
3. **Keine Umgehung:** Rausgegangen, RA, Eventim, Instagram, Facebook und andere Plattformen mit AGB-Verbot werden
   nicht automatisiert abgerufen. Auch nicht „nur zum Testen“.
4. **robots.txt und Mindestabstände:** Jede Quelle wird höchstens so oft gelesen, wie fachlich nötig; pro Host gilt
   ein Mindestabstand. Neue Hosts werden in `server/cache.mjs` eingetragen.
5. **Partnerschaft vor Technik:** Wo die Abdeckung fehlt, wird angefragt – nicht gescrapt.

## 7. Nächste Schritte (priorisiert)

1. **Weitere Clubbetreiber anschließen.** Kandidaten mit eigener Seite: Romantica (Events-Seite derzeit 404,
   Programm nur über RA/Instagram → Ansprache), White Noise (`white-noise.eu`, ein kommender Termin im
   Startseiten-Teaser), Zollamt (Seite lebt nur noch als Erinnerung), Schräglage (Club-Seite prüfen). Jeweils
   zuerst `robots.txt`, dann Parser, dann `check:wasgeht`.
2. **Eventfrog-Public-API beantragen** und als optionalen Adapter für Vereine, Chöre und Stadtteilinitiativen
   anbinden. Filter: Region Stuttgart, nur öffentliche Termine, max. 1 Abruf/Stunde.
3. **Gancio-Ausbau** mit der Adressliste aus `IP_2_01_11_KINDER_JUGENDTREFFS` (57), `IP_STADTTEILKULTUR` (44) und
   `IP_2_15_06_BUERGERHAUS` (33). Der Kulturbunker zeigt, wie gut ein einzelnes Haus den Anfang machen kann.
4. **Rausgegangen-Partnerschaft** anfragen: Kooperation, offizieller Export oder gemeinsames Register. Argument:
   nicht-kommerziell, quellenverlinkt, keine Bilder/Texte, nur Fakten, Rückkanal für Veranstalter.
5. **RA-Ansprache** (Presse/Partnerschaft) für einen offiziellen Venue-/Event-Feed. Bis dahin über die Hausseiten.
6. **VIVA Stuttgart** als Redaktionskontakt ansprechen, nicht als Datenquelle: gemeinsame Event-Recherche,
   Verlinkung, ggf. Verweis auf Gancio.
7. **Verifikationsanzeige** in der Oberfläche: `verified`/`lastSeen` als dezenter Hinweis („vom Veranstalter
   bestätigt“, „zuletzt bestätigt am …“), nicht als technisches Feld.
8. **Wöchentlicher Abgleich** der Quellenabdeckung: Wie viele Termine liefert jede Quelle, wie viele davon sind
   Dubletten, wie viele bleiben unbestätigt? `check:wasgeht` ist der Anfang.

## 8. Ansprache-Entwurf für Rausgegangen (Kurzfassung)

> **Betreff:** Offene Terminfakten für „Open Stuttgart“ – Kooperation statt Scraping
>
> Sehr geehrte Damen und Herren,
>
> „Open Stuttgart“ ist ein nicht kommerzielles Open-Source-Projekt (EUPL-1.2), das Termine mit ÖPNV, Wetter und
> Stadtteildaten verbindet. Wir respektieren Ihre AGB und rufen Ihre Plattform nicht automatisiert ab.
>
> Für die Abdeckung der Stuttgarter Club- und Kulturszene würden wir uns über einen offiziellen Export oder eine
> Kooperation freuen: Terminfakten (Titel, Zeit, Ort, Preis, Status, Link), keine Bilder, keine Beschreibungstexte,
> Quellenangabe und Rücklink auf Rausgegangen. Denkbar sind ein täglicher JSON-/iCal-Export oder ein gemeinsames
> offenes Register.
>
> Der technische Adapter ist bei uns vorbereitet und wird erst nach Ihrer Freigabe aktiviert.
>
> Mit freundlichen Grüßen
> [Name / Kontakt Open Stuttgart]

## 9. Anhang: geprüfte Endpunkte

```
# EINTOPF / LAUTI (robots.txt sperrt /ical und /rss)
https://eintopf.info/?date=2026-10-23
https://eintopf.info/api/v1/events?limit=10

# KUlturBUnker
https://ku-bu.de/veranstaltungen/

# Fridas Pier
https://www.fridaspier.de/event/

# Climax Institutes
https://climax-institutes.de/events/

# Kowalski
https://kowalskistuttgart.de/wp-json/wp/v2/posts?per_page=100&categories=8

# evensos
https://www.evensos.de/events/stuttgart.json
https://www.evensos.de/events/stuttgart.ics

# Rausgegangen (nur nach Freigabe)
https://api.rausgegangen.de/rausgegangen/api/v2/search?city=stuttgart&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&limit=100

# Resident Advisor (nicht verwenden)
https://ra.co/graphql
https://ra.co/robots.txt
```

### Live-Messungen vom 21.10.2026

| Quelle | Ergebnis |
|---|---|
| EINTOPF-Tageslisten | 92 Termine nach Stuttgart-Filter im 21-Tage-Fenster; 23 Seiten à ca. 40 KB statt 6,2 MB iCal |
| KUlturBUnker | 10 kommende Termine |
| Fridas Pier | 6 kommende Termine |
| Climax | 7 kommende Termine |
| Kowalski | 5 kommende Termine |
| evensos | 74 Termine im Stuttgart-Feed, 24 im 21-Tage-Fenster |
| Rausgegangen-Suche | 28 Subevents am 21.10.2026; `state` u. a. `takes_place`, `canceled`, `sold_out` |

Die Zahlen sind Momentaufnahmen und ändern sich mit dem Programm.

## 10. Nachtrag 22.10.2026: Ferienprogramm als amtliche Quelle, geprüfte Club-Seiten

### Ferienprogramm der Landeshauptstadt (neu, in Betrieb)

Die fünf WFS-Ebenen `A51_ALG_FP_PUNKTE_*` (Ausfluege_Wissenswertes, Kreatives_Kultur, Natur_Tiere,
Sport_Spiel_Action, Vermischtes) enthalten die amtlichen Ferienangebote mit `DATUM_VON`, `DATUM_BIS`,
`ALTER_VON`/`ALTER_BIS`, `GEBUEHR_TXT`, `ANMELDUNG`, `BARRIEREFREI`, `TREFFPUNKT` und `WEBLINK`.
Sie sind als Quelle `ferienprogramm` in `server/sources/wasgeht/ferienprogramm.mjs` angebunden:

- Szene `jugend`, `verified: official` – amtlich angekündigt, der Termin findet statt.
- Die UTM-Attributkoordinaten `X`/`Y` (EPSG:25832) werden nach WGS84 umgerechnet; wo sie fehlen,
  bleibt der Treffpunkt als Text stehen (Ortsname, Stadtbezirk) und der Termin erscheint ohne Kartenpunkt.
- Übernommen werden nur Fakten und der Link auf unser-ferienprogramm.de, keine Beschreibungstexte.
- Abruf alle 12 Stunden, abschaltbar mit `OS_SCENE_FERIENPROGRAMM=0`.
- Live geprüft am 22.10.2026: 14 Termine im 21-Tage-Fenster, davon 9 mit Koordinaten im Stadtgebiet.

### Geprüfte Club-Seiten (Stand 22.10.2026): was geht und was nicht

| Ort/Plattform | Befund | Entscheidung |
|---|---|---|
| Jugendagentur Stuttgart | `wp-json/tribe/events/v1/events` und `?ical=1` antworten von hier aus nicht (Timeout) | Adapter steht (`OS_SCENE_JUGENDAGENTUR=1` schaltet ihn ein) und ist per `npm run check:wasgeht` lokal prüfbar |
| Romantica | Eigene WordPress-Seite, aber keine Events-CPT, kein The Events Calendar, nur ein Testbeitrag | Keine Hausquelle möglich; Abdeckung über evensos/Rausgegangen-Partnerexport/Club-Angaben |
| White Noise | `white-noise.eu/programm/` ist ausdrücklich als **Archiv** beschriftet, neueste Einträge Ende 2025 | Keine kommenden Termine veröffentlicht – kein Abruf eingerichtet; sobald dort Termine stehen, ist ein Parser in einer halben Stunde ergänzt |
| Schräglage | schraeglage.de ist ein Anbieter von Motorrad-Trackdays (Rijeka, Salzburgring u. a.), kein Stuttgarter Club | Keine Quelle; die Annahme aus der Recherche trifft nicht zu |
| Zollamt | Keine eigene Seite mit Terminen auffindbar | Nicht als Quelle; Nennung nur über Veranstalterangaben |
| Resident Advisor, Rausgegangen, VIVA | unverändert: RA ohne offene Schnittstelle und robots-gesperrt, Rausgegangen nur Partner-Export, VIVA ohne strukturierten Kalender | siehe Abschnitt 2 |

Damit besteht „Was geht“ aus: 1 Hausquellen (Theaterhaus, Im Wizemann, Bix, Wagenhallen, KUlturBUnker,
Fridas Pier, Climax, Kowalski), 2. Hochschulen, 3. offene Register (Gancio, EINTOPF/LAUTI, Ferienprogramm),
4. Ticketshops (ticket.io, Love Your Artist) und 5. freigegebene Aggregatoren (evensos, Rausgegangen-Export,
optional Ticketmaster über `OS_TICKETMASTER_KEY`) – jeder Termin mit `verified`, `lastSeen` und Quellenliste.
