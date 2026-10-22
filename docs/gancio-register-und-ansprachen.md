# Offenes Veranstaltungsregister Stuttgart (Gancio-Pilot): Konfiguration, Andock-Spezifikation und Entwürfe zur Partneransprache

Stand: 20.10.2026 · Status: Technisch in Open Stuttgart vorbereitet, Ansprachen nur als Entwurf

---

## 1. Ausgangslage und Ziel des Piloten

Für Stuttgart existiert bisher kein offenes, maschinenlesbares Register für Termine der freien Szene, der Clubs und der Jugendhäuser. Kommerzielle Plattformen (unter anderem Resident Advisor, rausgegangen.de, Shotgun, Eventim) sperren automatisierte Abrufe technisch und untersagen die Weiterverwendung in ihren Nutzungsbedingungen. Über die Hausseiten (Theaterhaus, Im Wizemann, Bix, Wagenhallen, LKA Longhorn), offene Ticketshops (`ticket.io`, Love Your Artist) und die Hochschulen lassen sich im Modul „Was geht“ zwar rund 450 Termine pro Monat zusammenführen, es bleiben jedoch zwei strukturelle Lücken:

1. **Clubnächte ohne eigenen offenen Ticketshop** (insbesondere Romantica, Kowalski, White Noise, Fridas Pier, Climax Institutes, Zollamt, Schräglage), deren Programm bisher fast ausschließlich auf Instagram oder Resident Advisor veröffentlicht wird.
2. **Jugendhäuser, Kollektive, Kulturvereine und Zwischennutzungen**, die keinen eigenen Kalender-Export (iCal oder schema.org) betreiben.

Der Pilot setzt dafür ein offenes Veranstaltungsregister auf Basis der freien Software **Gancio (Version 1.28.2, AGPL-3.0)** ein. Veranstalterinnen und Veranstalter tragen ihre Termine dort selbst ein oder binden vorhandene iCal-Kalender ein. Alle Terminfakten (Titel, Beginn, Ende, Ort, Eintritt, Altersangabe, Status und Verweis auf die Veranstalterseite) stehen unter **CC0 1.0 (Gemeinfreiheit)** offen zur Verfügung – sowohl für Open Stuttgart als auch für andere Stadtmagazine, Hochschulmedien und Bürgermedien.

---

## 2. Gancio-Konfiguration für Stuttgart

Die Konfigurationsdateien für den Pilotbetrieb liegen im Ordner [`gancio/`](../gancio/):

- [`gancio/config.json.example`](../gancio/config.json.example): Server-, Datenbank- und Pfadkonfiguration für Gancio 1.28.2
- [`gancio/docker-compose.yml`](../gancio/docker-compose.yml): Container-Konfiguration für lokalen Test und Serverbetrieb (`cisti/gancio:1.28.2`, Port `13120`)
- [`gancio/user_locale/de.json`](../gancio/user_locale/de.json): Angepasste deutsche Hinweistexte für Registrierung und Formulare (CC0-Hinweis und Schlagwort-Konventionen)
- [`gancio/seed-places.mjs`](../gancio/seed-places.mjs): Prüf- und Vorbereitungsskript für die 28 Stuttgarter Spielstätten aus [`server/data/venues.json`](../server/data/venues.json)

### 2.1 Grundeinstellungen in der Gancio-Verwaltung (`/admin`)

Nach dem ersten Start (`docker compose up -d`) werden in der Gancio-Verwaltung folgende Einstellungen für Stuttgart gesetzt:

| Einstellung | Wert | Begründung |
|---|---|---|
| `title` | Offenes Veranstaltungsregister Stuttgart | Sachliche Bezeichnung in Kopfzeile, RSS-/iCal-Feeds und ActivityPub |
| `description` | Offene Termindaten für Kultur, Clubs, Jugendhäuser und Hochschulen in Stuttgart (Fakten unter CC0 1.0) | Klare Lizenz- und Zweckangabe |
| `instance_timezone` | `Europe/Berlin` | Einheitliche Zeitzone für alle Eingaben und Serien |
| `default_locale` | `de` | Standardsprache für Oberfläche und Systemmeldungen |
| `allow_registration` | `true` (mit Freischaltung durch Moderation) | Feste Spielstätten und Kollektive erhalten eigene Konten |
| `allow_anon_event` | `true` | Einzelveranstalter können Termine ohne Konto vorschlagen; Veröffentlichung erst nach Freigabe |
| `allow_recurrent_event` | `true` | Regelmäßige Reihen (z. B. offene Bühnen, Kneipenabende, Hochschulsport/-kultur) |
| `allow_event_without_end_time` | `true` | Bei Konzerten und Clubnächten steht das Ende oft nicht exakt fest |
| `allow_geolocation` | `true` | Koordinaten je Spielstätte für die Kartendarstellung in Open Stuttgart |
| `enable_moderation` | `true` | Schutz vor Spam und unvollständigen Ortsangaben |
| `enable_federation` | `true` | Anbindung über ActivityPub (Mastodon, Mobilizon, weitere Gancio-Instanzen) |

### 2.2 Zweistufiges Moderationsmodell

1. **Bekannte Veranstalter (Konto mit Direktfreigabe):** Spielstätten, Jugendhäuser, Hochschulgruppen und dem Clubkollektiv angeschlossene Betriebe erhalten ein bestätigtes Konto (`role: editor` oder bestätigter `user`). Ihre Einträge sind sofort unter `/api/events` sichtbar (`is_visible: true`).
2. **Offene Einreichung ohne Konto:** Jede Person kann über das Formular „Termin eintragen“ eine Veranstaltung vorschlagen. Der Eintrag erhält zunächst `is_visible: false` und erscheint nur in `/api/events/unconfirmed`, bis die Redaktion Ort und Pflichtangaben geprüft und freigeschaltet hat.

### 2.3 Schlagwort-Konventionen (Tags)

Da Gancio im Standard-Datenmodell keine eigenen Datenbankfelder für Eintrittspreis, Einlasszeit und Altersfreigabe führt, nutzt das Stuttgarter Register feste, sprechende Schlagworte (`tags`), die der Adapter in Open Stuttgart maschinell auswertet:

| Bedeutung | Schlagworte in Gancio (Groß-/Kleinschreibung beliebig) | Abbildung in Open Stuttgart (`WgEvent`) |
|---|---|---|
| **Szene: Konzert** | `konzert`, `live`, `musik`, `jazz`, `rock`, `indie`, `punk`, `metal`, `hiphop`, `rap`, `singer-songwriter`, `klassik` | `scene: ['konzert']` |
| **Szene: Party / Club** | `party`, `clubnacht`, `rave`, `techno`, `house`, `trance`, `dnb`, `drum-and-bass`, `dj`, `dj-set`, `elektro` | `scene: ['party']` |
| **Szene: Comedy** | `comedy`, `kabarett`, `stand-up`, `slam`, `poetry-slam`, `impro`, `kleinkunst` | `scene: ['comedy']` |
| **Szene: Hochschule** | `hochschule`, `uni`, `campus`, `studierende`, `fachschaft`, `stuvus` | `scene: ['hochschule']` |
| **Szene: Flohmarkt** | `flohmarkt`, `trödel`, `kleidertausch`, `markt`, `basar` | `scene: ['flohmarkt']` |
| **Szene: Bühne** | `bühne`, `buehne`, `theater`, `lesung`, `tanz`, `performance`, `vortrag`, `diskussion`, `kino`, `ausstellung` | `scene: ['buehne']` |
| **Szene: Kneipe / Bar** | `kneipe`, `bar`, `quiz`, `kneipenquiz`, `pubquiz`, `jam`, `jamsession`, `karaoke`, `stammtisch` | `scene: ['kneipe']` |
| **Szene: Pop-up** | `popup`, `pop-up`, `zwischennutzung`, `daydrinking`, `open-air` | `scene: ['popup']` |
| **Eintritt frei** | `eintritt-frei`, `kostenlos`, `frei`, `spende`, `hutkasse` | `free: true`, `priceMin: 0`, `price: 'Eintritt frei'` |
| **Eintrittspreis** | `ab-12-euro`, `preis-10`, `vvk-15`, `ak-18`, `12-euro` | `priceMin: 12`, `price: 'ab 12 Euro'` |
| **Einlasszeit** | `einlass-20-00`, `einlass-23` | `doors` (ISO-Zeitstempel am Veranstaltungstag) |
| **Mindestalter** | `ab-18`, `18+`, `ab-16`, `16+` | `minAge: 18` bzw. `16` |
| **Status** | `abgesagt`, `verschoben`, `ausverkauft` (zusätzlich zum Gancio-Feld `status`) | `status: 'abgesagt' \| 'verschoben'`, `soldOut: true` |
| **Genre / Zusatz** | alle übrigen Schlagworte (außer `stuttgart`) | `genre` (bis zu 3 Schlagworte) |

---

## 3. Andock-Spezifikation für Open Stuttgart

Die Anbindung ist in [`server/sources/wasgeht/termine.mjs`](../server/sources/wasgeht/termine.mjs) (`gancioEvents`, `gancio`) umgesetzt und über Umgebungsvariablen steuerbar.

### 3.1 Konfiguration am Open-Stuttgart-Server

| Umgebungsvariable | Beschreibung | Standard |
|---|---|---|
| `OS_GANCIO_URL` | Basisadresse der Gancio-Instanz (z. B. `http://localhost:13120` oder `https://register.open-stuttgart.de`) | leer (vorbereitet) |
| `OS_GANCIO_FILE` | Optionaler Dateipfad zu einem lokalen JSON-Abzug im Format von `/api/events` für Offline-Tests | leer |
| `OS_SCENE_GANCIO` | Mit `0` lässt sich die Register-Quelle im laufenden Betrieb einzeln abschalten | `1` |

Solange weder `OS_GANCIO_URL` noch `OS_GANCIO_FILE` gesetzt ist, erscheint das Register unter `/api/partner` mit dem Status `vorbereitet`, ohne dass Fehlermeldungen in der Oberfläche entstehen.

### 3.2 Abruf und Feldabbildung

- **Endpunkt:** `GET ${OS_GANCIO_URL}/api/events?start=<unix_s>&end=<unix_s>&show_recurrent=true&show_multidate=true&max=500`
- **Zeitfenster:** Vortag `00:00 UTC` bis 21 Tage im Voraus (`HORIZON_DAYS = 21`), damit laufende Clubnächte nach Mitternacht zuverlässig dem Vorabend zugeordnet werden (`sceneDay`).
- **Abrufintervall:** Höchstens alle 15 Minuten für alle Nutzer gemeinsam, mit Platten-Zwischenspeicher (`wasgeht-v1`).
- **Feldabbildung (`gancioEvents`):**
  - `id` → `gancio-${r.id}`
  - `title` → `r.title` (HTML-bereinigt)
  - `start_datetime` (Sekunden) → `start` (ISO 8601 UTC)
  - `end_datetime` (Sekunden, optional) → `end` (ISO 8601 UTC)
  - `slug` → `url: ${baseUrl}/event/${r.slug}`
  - `online_locations[]` → erster HTTP(S)-Link (ohne Eventim) als `ticketUrl`
  - `place` (`name`, `address`, `latitude`, `longitude`) → Abgleich gegen die 28 Spielstätten in [`server/data/venues.json`](../server/data/venues.json) über Aliasliste (`venueOf`) oder Umkreis $\le 80\,\text{m}$. Bei unbekannten Orten Übernahme der Gancio-Koordinaten bzw. einmalige Verortung über Nominatim (`geocode`).
  - `status` (`EventScheduled`, `EventCancelled`, `EventPostponed`, `EventRescheduled`) → `status: null | 'abgesagt' | 'verschoben'`
  - `description` / `media` → werden gemäß den Grundsätzen des Moduls „Was geht“ nicht kopiert; es werden ausschließlich Fakten und der Link zur Quelle übernommen.

### 3.3 Vorrang im Dubletten-Abgleich

In `activeSources()` steht Gancio (`group: 'register'`) an erster Stelle vor den Hausquellen (`group: 'haus'`), Ticketshops (`group: 'ticket'`) und Hochschulen (`group: 'hochschule'`):

1. Trägt ein Veranstalter einen Termin im offenen Register ein und existiert derselbe Termin auch im Stadtkalender oder in einem Ticketshop (gleicher Tag, gleicher Ort bis 150 m, Zeitabweichung $\le 30$ Minuten, Titelähnlichkeit $\ge 0{,}6$ oder gleicher Hauptkünstler), werden die Einträge zusammengeführt (`mergeInto`).
2. Preis-, Genre-, Einlass- und Statusangaben aus dem Register haben Vorrang vor geschätzten Angaben; Ticketlinks aus `ticket.io` oder Love Your Artist ergänzen den Eintrag, falls im Register kein eigener Ticketlink hinterlegt wurde.
3. Alle gefundenen Quellen bleiben im Feld `sources[]` mit Link erhalten.

### 3.4 Offener Rückkanal (`/api/wasgeht.ics`)

Open Stuttgart gibt den zusammengeführten und bereinigten Terminbestand unter `GET /api/wasgeht.ics` (mit denselben Filterparametern `date`, `span`, `scene`, `jung`, `free`, `maxPrice` wie `/api/wasgeht`) als standardkonforme iCal-Datei (`text/calendar`) zurück. Jeder Eintrag enthält Beginn, Ort, Status und die vollständige Quellenangabe.

---

## 4. Entwürfe zur Partneransprache

> **Hinweis:** Alle nachfolgenden Schreiben sind **Entwürfe** zur Abstimmung. Es wurden keine Nachrichten versendet. Platzhalter in eckigen Klammern (`[...]`) sind vor dem Versand auszufüllen.

### 4.1 Entwurf: Stuttgarter Jugendhaus gGmbH (Jugendhäuser, Club Zentral, clubCANN, JuHa Hallschlag)

**Empfänger:** Geschäftsführung / Öffentlichkeitsarbeit der Stuttgarter Jugendhaus gGmbH  
**Betreff:** Offene Darstellung der Veranstaltungstermine der Stuttgarter Jugendhäuser in „Open Stuttgart“

Sehr geehrte Damen und Herren,

im Rahmen des nicht kommerziellen Open-Source-Projekts „Open Stuttgart“ bündeln wir offene Daten der Landeshauptstadt Stuttgart auf einer werbefreien Stadtkarte mit Echtzeit-ÖPNV, Umweltdaten und einem Veranstaltungsüberblick für junges Publikum („Was geht“).

Die Konzerte im Club Zentral und im clubCANN sind über die jeweiligen Ticketprofile bereits sichtbar. Viele offene Angebote, Konzerte, Workshops und Stadtteiltermine der 41 Einrichtungen der Stuttgarter Jugendhaus gGmbH – etwa im Jugendhaus Hallschlag, im Jugendhaus Heslach (Sunny High) oder im Werkstatthaus – fehlen jedoch bisher in offenen Kalendern, weil dafür keine maschinenlesbare Gesamtschnittstelle besteht.

Wir richten derzeit ein offenes, werbefreies Veranstaltungsregister für Stuttgart auf Basis der freien Kalendersoftware Gancio ein. Alle dort eingetragenen Terminfakten (Titel, Zeit, Ort, Eintritt, Link zur Einrichtung) stehen unter gemeinfreier Lizenz (CC0 1.0) bereit und werden in Open Stuttgart direkt mit der nächsten Haltestelle, den letzten Bahnen für den Heimweg und Barrierefreiheitsangaben verknüpft.

Für die Einbindung der Jugendhäuser bieten wir zwei einfache Wege an:
1. **Automatische Übernahme:** Falls in Ihrem Redaktionssystem bereits ein iCal- oder JSON-Export je Haus oder für alle Einrichtungen besteht, binden wir diesen automatisiert und schonend ein.
2. **Direktzugang zum offenen Register:** Ihre Einrichtungen erhalten freigeschaltete Konten, über die Termine in weniger als einer Minute eingetragen oder per iCal-Link importiert werden können.

Besteht auf Ihrer Seite Interesse an einem kurzen Austausch (15 Minuten per Telefon oder Videokonferenz), um den geringsten Aufwand für Ihre Häuser zu klären?

Mit freundlichen Grüßen  
[Name / Kontakt Open Stuttgart]

---

### 4.2 Entwurf: Clubkollektiv Stuttgart e. V. und Clubbetreiber

**Empfänger:** Vorstand Clubkollektiv Stuttgart e. V. (sowie Betreiberinnen und Betreiber u. a. von Romantica, Kowalski, White Noise, Fridas Pier, Climax Institutes, Zollamt, Schräglage)  
**Betreff:** Offenes Veranstaltungsregister für Stuttgarter Clubs und Kollektive – Pilotbetrieb ohne Plattformgebühren

Hallo zusammen / Sehr geehrte Damen und Herren,

im Projekt „Open Stuttgart“ bauen wir eine freie, werbefreie Anwendung für Stuttgart, die Veranstaltungen direkt mit Echtzeit-Abfahrten, Nachtbussen und Stadtteilinformationen verbindet.

Bei der Auswertung der offenen Datenquellen in Stuttgart hat sich gezeigt: Während Konzerthäuser und Clubs mit offenen Ticketshops (`ticket.io`, Love Your Artist) gut abbildbar sind, fehlen ausgerechnet Clubnächte und Veranstaltungen von Kollektiven fast vollständig in offenen Stadtkalendern. Der Grund ist bekannt: Plattformen wie Resident Advisor, Instagram oder rausgegangen.de geben Termindaten technisch nicht offen weiter.

Um diese Lücke unabhängig von kommerziellen Plattformen zu schließen, starten wir als Pilot ein **offenes Veranstaltungsregister für Stuttgart** (auf Basis von Gancio, ähnlich wie `kulturdaten.berlin`):
- **Kein kommerzieller Zwischenhändler:** Keine Werbung, kein Tracking, keine bezahlte Reihung.
- **Minimaler Aufwand:** Clubs und Kollektive bekommen ein direkt freigeschaltetes Konto. Ein Eintrag braucht nur Titel, Datum/Uhrzeit, Ort (die Stuttgarter Clubs sind mit Koordinaten bereits hinterlegt), kurze Schlagworte (z. B. `party`, `techno`, `ab-18`, `ab-12-euro`) und den Link zu eurer Seite oder eurem Vorverkauf.
- **Offene Weiterverwendung (CC0):** Die eingetragenen Terminfakten stehen offen über eine Schnittstelle und als iCal-Feed bereit, sodass auch andere lokale Medien, Studierendenvertretungen und Kalender sie ohne erneutes Abtippen übernehmen können.

Wir würden den Pilotbetrieb gerne mit drei bis fünf Stuttgarter Clubs bzw. Kollektiven testen und laden das Clubkollektiv herzlich ein, die Struktur mitzugestalten. Hättet ihr Zeit für ein kurzes Gespräch in den nächsten zwei Wochen?

Viele Grüße  
[Name / Kontakt Open Stuttgart]

---

### 4.3 Entwurf: Theaterhaus Stuttgart (Abstimmung zur bestehenden Schnittstelle)

**Empfänger:** Öffentlichkeitsarbeit / Webredaktion Theaterhaus Stuttgart  
**Betreff:** Nutzung der Terminfakten des Theaterhauses in „Open Stuttgart“ (nicht kommerzielles Open-Data-Projekt)

Sehr geehrte Damen und Herren,

mit „Open Stuttgart“ entsteht derzeit eine quelloffene, werbefreie Informationsanwendung für Stuttgart, die öffentliche Daten der Stadt, Echtzeit-Abfahrten des ÖPNV und kulturelle Termine zusammenführt.

Für die Darstellung der Veranstaltungen im Theaterhaus Stuttgart liest unser Server derzeit schonend (höchstens alle sechs Stunden, für alle Nutzerinnen und Nutzer gemeinsam zwischengespeichert) die öffentlich abrufbaren Strukturdaten Ihrer Programmseite (`/de/api/bookings/`) aus. Übernommen werden ausschließlich die reinen Terminfakten (Titel, Beginn, Saal, Genre, Mindestpreis, Status) sowie der direkte Link auf Ihre Produktionsseite (`theaterhaus.com/de/produktion/...`) und Ihren Vorverkauf. Beschreibungstexte und Bilder werden nicht kopiert.

Da diese Schnittstelle auf Ihrer Website nicht gesondert als offene API dokumentiert ist, möchten wir Sie transparent über diese Nutzung informieren und anfragen:
1. Ist der Abruf in dieser schonenden Form (1 Abruf alle 6 Stunden, eigener User-Agent) für Ihre Technik unbedenklich, oder bevorzugen Sie einen anderen Exportweg?
2. Dürfen wir das Theaterhaus Stuttgart in der Quellenübersicht als abgestimmte Programmquelle aufführen?

Für Rückfragen Ihrer technischen Betreuung stehen wir jederzeit gerne bereit.

Mit freundlichen Grüßen  
[Name / Kontakt Open Stuttgart]

---

### 4.4 Entwurf: Stuttgart-Marketing GmbH (Offizieller Datenexport)

**Empfänger:** Geschäftsführung / Digitalredaktion Stuttgart-Marketing GmbH  
**Betreff:** Anfrage nach einer strukturierten Datenschnittstelle für Veranstaltungstermine (`stuttgart-tourist.de`)

Sehr geehrte Damen und Herren,

die Anwendung „Open Stuttgart“ verbindet offene Daten der Landeshauptstadt Stuttgart (Geodaten, Bürgerbüro-Wartezeiten, Bäder-Auslastung, Umweltdaten, VVS/DB-Echtzeit) mit dem kulturellen Angebot der Stadt. Zu jedem Termin zeigt die Anwendung unmittelbar die nächsten Haltestellen, die ersten echten Abfahrten für den Heimweg nach Veranstaltungsende sowie freie Plätze in den umliegenden Parkhäusern.

Neben dem RSS-Feed des städtischen Veranstaltungskalenders (`stuttgart.de`) enthält `stuttgart-tourist.de` den umfangreichsten Terminbestand für Stuttgart. Da hierfür derzeit kein offener Gesamtexport (API oder Feed) bereitsteht, liest unser Server übergangsweise die öffentlich eingebetteten `schema.org`-Strukturdaten der Veranstaltungsseiten im Hintergrund mit großem zeitlichem Abstand (eine Seite alle 5 Sekunden, jede Seite höchstens einmal in 7 Tagen) aus und verlinkt jeden Eintrag zurück auf `stuttgart-tourist.de`.

Um Ihren Webserver zu entlasten und den Datenbestand sauber abzugleichen, möchten wir anfragen:
1. Besteht die Möglichkeit, für „Open Stuttgart“ einen regulären strukturierten Export (z. B. JSON-, XML- oder iCal-Feed bzw. Zugang zum verwendeten Redaktions-/Destination-System) bereitzustellen?
2. Alternativ oder ergänzend: Wie steht die Stuttgart-Marketing GmbH zu einer Anbindung an den Open-Data-Pool der Tourismus Marketing GmbH Baden-Württemberg (TMBW)?

Über einen kurzen fachlichen Austausch würden wir uns freuen.

Mit freundlichen Grüßen  
[Name / Kontakt Open Stuttgart]

---

### 4.5 Entwurf: Eventfrog (API-Zugang für Stuttgarter Kleinveranstalter)

**Empfänger:** Support / API-Team Eventfrog (`eventfrog.de`)  
**Betreff:** Anfrage API-Schlüssel für nicht kommerzielles Stadtdaten-Projekt „Open Stuttgart“

Sehr geehrtes Eventfrog-Team,

für das nicht kommerzielle Open-Source-Projekt „Open Stuttgart“ (Lizenz EUPL-1.2, werbefrei, ohne Tracking) führen wir öffentliche Veranstaltungstermine im Stadtgebiet Stuttgart mit Echtzeitdaten des öffentlichen Nahverkehrs zusammen. Jeder angezeigte Termin verweist für den Ticketkauf und die Veranstaltungsbeschreibung direkt auf die jeweilige Quellplattform.

Zahlreiche kleinere Kulturvereine, Chöre, Stadtteilinitiativen und freie Bühnen in Stuttgart veröffentlichen ihre Termine über Eventfrog. Um diese Veranstaltungen automatisiert (Abruf höchstens alle 6 Stunden für das Postleitzahlgebiet `70xxx` / Raum Stuttgart, nur öffentliche Termine, nur Fakten + Direktlink zu Eventfrog) einbinden zu können, bitten wir um die Bereitstellung eines API-Schlüssels für die Eventfrog-Schnittstelle.

Eckdaten des Einsatzes:
- **Projekt:** Open Stuttgart (Quellcode öffentlich unter EUPL-1.2)
- **Abrufvolumen:** maximal 4 Abrufe pro Tag (serverseitig zwischengespeichert)
- **Angezeigte Felder:** Titel, Beginn/Ende, Veranstaltungsort in Stuttgart, Preisangabe und direkter Link zur Eventfrog-Seite

Vielen Dank für Ihre Prüfung und Rückmeldung.

Mit freundlichen Grüßen  
[Name / Kontakt Open Stuttgart]
