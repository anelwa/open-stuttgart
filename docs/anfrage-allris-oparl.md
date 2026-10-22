# Anfrage ALLRIS / OParl an die Landeshauptstadt Stuttgart: Entwürfe und Vorbereitung

Stand: 22.10.2026 · Status: **Entwurf zur Abstimmung – es wurden keine Nachrichten versendet.**
Platzhalter in eckigen Klammern (`[...]`) sind vor dem Versand auszufüllen.

Zugehörige Recherche: [`api-recherche-2026-10-ergaenzungen.md`](api-recherche-2026-10-ergaenzungen.md) (Abschnitt 2.4)

---

## 1. Ausgangslage und Ziel

Das Ratsinformationssystem **ALLRIS** (`https://allris.stuttgart.de/`) der Landeshauptstadt Stuttgart
führt seit 2024 Sitzungen, Tagesordnungen, Vorlagen, Anträge, Anfragen und Protokolle des
Gemeinderats, der Ausschüsse und der Bezirksbeiräte. Es ist damit die zentrale Quelle für alles,
was in der Stadt politisch verhandelt wird – und die größte bisher unerschlossene Datenquelle
für das Modul „Verwaltung/Beteiligungen“ von Open Stuttgart.

Ein automatisierter Zugriff scheidet derzeit aus: Die `robots.txt` von `allris.stuttgart.de`
verbietet das Crawling vollständig (`Disallow: /`), dokumentiert in
[`neue-module-2026-10.md`](neue-module-2026-10.md). **Wir crawlen ALLRIS daher nicht** und
werden dies ohne schriftliche Freigabe auch nicht tun.

**Ziel der Anfrage (Rangfolge):**

1. **Bevorzugt:** Die Stadt stellt eine **OParl-1.1-Schnittstelle** zum ALLRIS bereit
   (offener Standard für Ratsinformationssysteme, JSON, entwickelt von der Open Knowledge
   Foundation Deutschland, Spezifikation unter <https://oparl.org/spezifikation/online-ansicht/>).
2. **Alternative:** Eine **schriftliche Freigabe** für einen definiert schonenden, regelmäßigen
   Abruf der öffentlichen Tagesordnungen und Vorlagen-Metadaten.
3. **Notlösung:** Ein manueller Export (z. B. monatlicher CSV-/PDF-Export der Sitzungstermine),
   den wir als statische Daten einbinden.

### Was ist OParl? (Kurzfassung für die Anfrage)

OParl ist der in Deutschland etablierte Standard für den offenen Zugang auf Daten aus
Ratsinformationssystemen (Version 1.1). Er stellt Sitzungen (`Meeting`), Vorlagen (`Paper`),
Beratungspunkte (`Consultation`), Personen, Gremien, Termine und Dokumente als JSON-Objekte
bereit und bringt einen Delta-Update-Mechanismus mit, der einen sparsamen, regelmäßigen
Abgleich ermöglicht. OParl wird von mehreren Ratsinformationssystem-Herstellern unterstützt;
zahlreiche Kommunen (u. a. Bonn, Köln) betreiben produktiv eine OParl-Schnittstelle.

### Technische Option: `oparl-bridge` (Open Source)

Für ALLRIS-Installationen des Anbieters cc-eGov/Somacos existiert die quelloffene Brücke
**`oparl-bridge`** (<https://github.com/Aeroid/oparl-bridge>), die eine OParl-1.1-konforme
Schnittstelle bereitstellt. Sie ist kein Drittzugriff, sondern müsste von der Stadt bzw. vom
Anbieter betrieben werden – ist aber ein konkretes, erprobtes Angebot, das den Aufwand einer
Nachrüstung deutlich senkt. Wir führen sie in der Anfrage als Option an, ohne die Stadt unter
Zeitdruck zu setzen.

---

## 2. Adressaten und Zuständigkeit

| Rolle | Empfänger | Anmerkung |
|---|---|---|
| Hauptempfänger | Amt für Organisation und Statistik (bzw. die für den Betrieb des Ratsinformationssystems zuständige Stelle der Landeshauptstadt Stuttgart) | *Zuständigkeit vor Versand prüfen/im Impressum von `allris.stuttgart.de` nachlesen* |
| Kopie | `poststelle.12-opendata@stuttgart.de` | Open-Data-Kontakt laut `opendata.stuttgart.de` |
| Optional Kopie | Stabsstelle/Redaktion Open Data bzw. Digitale Verwaltung | falls abweichend vom oben genannten Kontakt |
| Optional extern | Hersteller des ALLRIS (cc-eGov/Somacos) | nur wenn die Stadt den Wunsch äußert |

---

## 3. Entwurf: Erstkontakt per E-Mail

**Betreff:** Anfrage: Offene Schnittstelle (OParl) zum Ratsinformationssystem ALLRIS für das nicht kommerzielle Projekt „Open Stuttgart“

Sehr geehrte Damen und Herren,

im Rahmen des nicht kommerziellen Open-Source-Projekts „Open Stuttgart“ (Quellcode öffentlich unter EUPL-1.2, werbefrei, ohne Tracking, ohne Nutzerkonten) stellen wir offene Daten der Landeshauptstadt Stuttgart auf einer Stadtkarte zusammen: Geodaten des Geoservers, Echtzeit-Abfahrten des ÖPNV, Umwelt- und Wetterdaten, Veranstaltungstermine sowie die Dienstleistungen der Verwaltung. Jede Aussage in der Anwendung ist mit ihrer Quelle verlinkt.

Seit Einführung von ALLRIS bündelt das Ratsinformationssystem die öffentliche Arbeit des Gemeinderats, der Ausschüsse und der Bezirksbeiräte: Sitzungstermine, Tagesordnungen, Vorlagen, Anträge und Protokolle. Für Bürgerinnen und Bürger ist damit ein Datensatz entstanden, der für Fragen wie „Was wird in meinem Bezirksbeirat beraten?“, „Welche Vorlage betrifft mein Quartier?“ oder „Wo kann ich mich zu einem Verfahren äußern?“ die maßgebliche Quelle darstellt.

Wir haben festgestellt, dass der automatisierte Zugriff auf ALLRIS in der `robots.txt` ausdrücklich ausgeschlossen ist (`Disallow: /`). Diesen Hinweis respektieren wir selbstverständlich; unser Server hat `allris.stuttgart.de` bisher nicht und wird es ohne Ihre ausdrückliche Zustimmung auch nicht abrufen.

Daher möchten wir Sie um die Klärung der folgenden Punkte bitten:

1. **Bevorzugt:** Besteht die Möglichkeit, für ALLRIS eine offene Schnittstelle nach dem Standard **OParl 1.1** bereitzustellen? OParl ist der etablierte Standard für den maschinellen Zugang zu Ratsinformationssystemen und wird von mehreren Anbietern unterstützt. Für ALLRIS-Installationen existiert mit dem quelloffenen Projekt `oparl-bridge` eine erprobte Nachrüstung, die wir gerne näher erläutern würden.
2. **Alternativ:** Wären Sie mit einem regelmäßigen, abgestimmten Abruf der öffentlichen Sitzungs- und Vorlagendaten durch unser Projekt einverstanden? Wir würden hierzu transparente technische Eckdaten festhalten (siehe Anhang) und jede gewünschte Einschränkung übernehmen.
3. **Ergänzend:** Gibt es bereits Überlegungen der Verwaltung, Ratsdaten über das städtische Open-Data-Portal (`opendata.stuttgart.de`) als strukturierten Datensatz bereitzustellen?

Unser Beitrag zur Gegenleistung: Die Anwendung weist die Landeshauptstadt Stuttgart bei jeder Nutzung der Ratsdaten als Quelle aus, verlinkt direkt auf die originale Vorlage bzw. Sitzung in ALLRIS und stellt keine veränderten oder wertenden Darstellungen her. Auf Wunsch zeigen wir Ihnen die geplante Darstellung vorab in einer kurzen Vorführung (15 Minuten per Video oder Telefon).

Über eine Rückmeldung – auch eine grundsätzliche, dass die Anfrage zur Kenntnis genommen wurde – würden wir uns sehr freuen.

Mit freundlichen Grüßen
[Name / Kontakt Open Stuttgart]

**Anlage:** Technische Eckdaten (siehe Abschnitt 5)

---

## 4. Entwurf: Alternative – Anfrage um schriftliche Freigabe für einen Abruf

*(Diesen Text nur senden, wenn auf Entwurf 3.1/3.2 mit „keine Schnittstelle, kein Export“ geantwortet wurde.)*

**Betreff:** Schriftliche Freigabe für den abgestimmten Abruf öffentlicher Sitzungsdaten aus ALLRIS

Sehr geehrte Damen und Herren,

vielen Dank für Ihre Rückmeldung, dass derzeit keine OParl-Schnittstelle und kein strukturierter Export bereitstehen.

Damit die öffentliche Gremienarbeit in „Open Stuttgart“ dennoch sichtbar werden kann, bitten wir um eine schriftliche Freigabe für den folgenden, eng begrenzten Abruf von `allris.stuttgart.de`:

- **Inhalte:** ausschließlich öffentliche Metadaten der Sitzungen und Vorlagen (Gremium, Datum, Tagesordnungspunkt, Vorlagentitel, Status, Link auf die originale Seite in ALLRIS). Volltexte und Anlagen werden nicht gespiegelt, sondern nur verlinkt.
- **Intervall:** ein Abruf je Werktag (abends, außerhalb der Geschäftszeiten), maximal 200 Seiten je Abruf, Gesamtvolumen unter 1.000 Seiten/Tag.
- **Technik:** eigener User-Agent `open-stuttgart/0.x (https://[Projekt-URL])` mit Kontaktangabe, Einhaltung der Krawl-Verzögerung von mindestens 5 Sekunden je Anfrage, sofortiges Abbrechen bei Serverfehlern (429/5xx), keine Speicherung personenbezogener Daten über die öffentlichen Amtsangaben hinaus.
- **Zweck:** nicht kommerziell, werbefrei, Quellenverweis mit Direktlink auf ALLRIS bei jeder Anzeige.
- **Widerruf:** Die Freigabe kann jederzeit formlos widerrufen werden; wir stellen den Abruf unverzüglich ein und löschen den Bestand.

Alternativ sind wir auch mit einem gänzlich manuellen Weg einverstanden (z. B. monatlicher Export der Sitzungstermine als CSV/PDF, den wir als statische Daten einbinden).

Mit freundlichen Grüßen
[Name / Kontakt Open Stuttgart]

---

## 5. Anhang: Technische Eckdaten (Entwurf)

Dieser Abschnitt ist als Anlage zu Entwurf 3 gedacht und beantwortet vorweg, was eine
Verwaltung oder eine IT-Abteilung typischerweise wissen möchte.

| Thema | Zusage |
|---|---|
| Projektkennung | „Open Stuttgart“, Quellcode öffentlich unter EUPL-1.2, Betrieb nicht kommerziell, keine Werbung, kein Tracking, keine Nutzerkonten |
| User-Agent | `open-stuttgart/0.x (https://[Projekt-URL]; kontakt@[domain])` |
| Abfragemuster (OParl-Fall) | Delta-Abruf (`modifiedSince`) stündlich, vollständiger Abgleich wöchentlich; geschätzt < 5.000 API-Abrufe/Tag, davon > 95 % leere Deltas |
| Abfragemuster (Freigabe-Fall) | 1 Abruf je Werktag, ≤ 200 Seiten/Abruf, ≥ 5 s Seitenabstand |
| Übernommene Objekte (OParl) | `Body`, `Meeting`, `AgendaItem`, `Consultation`, `Paper`, `Person`, `Location`, `File` (nur Metadaten + Link) |
| Nicht übernommen | Volltexte von Anlagen, personenbezogene Angaben über öffentliche Amtsangaben hinaus, keine Spiegelung der PDF-Dateien |
| Darstellung | Angabe der Quelle bei jeder Anzeige, Direktlink auf `allris.stuttgart.de`, keine wertenden oder veränderten Zusammenfassungen ohne Kennzeichnung |
| Ausfallverhalten | Serverseitiger Cache mit „letztem guten Wert“, keine automatisierten Wiederholungsschleifen, Abschaltmöglichkeit über Umgebungsvariable |
| Datenschutz | Es werden keine Daten von Nutzerinnen und Nutzern an die Stadt übertragen; die Anwendung kennt keine Nutzerkonten |
| Kontakt | [Name / Kontakt Open Stuttgart], [E-Mail], ggf. [Telefon] |

---

## 6. Geplante Nutzung der Daten (für Rückfragen)

Konkret möchten wir die Ratsdaten in drei Funktionen zeigen:

1. **Sitzungskalender im Modul „Verwaltung“:** Nächste Sitzungen von Gemeinderat, Ausschüssen
   und *meinem* Bezirksbeirat, mit Tagesordnung und Direktlink zur Vorlage.
2. **Vorlagen mit Raumbezug:** Abgleich von Vorlagen-Ortsangaben (Straße, Quartier, Baugebiet)
   mit der gewählten Adresse im Adressprofil – z. B. „Diese Vorlage betrifft Ihren Bezirk“.
3. **Volltextsuche:** Erweiterung der bestehenden Dokumentensuche (`/api/suche`, FTS5) um
   öffentliche Ratsdokumente, damit Verwaltungssuche und Politiksuche in einem Tool landen.

---

## 7. Nächste Schritte

- [ ] Zuständige Stelle verifizieren (Impressum `allris.stuttgart.de`, ggf. Amt für Organisation und Statistik)
- [ ] Absender/Signatur ergänzen, Projektkontakt und URL eintragen
- [ ] Entwurf intern abstimmen (Ton, Umfang, ggf. zweite Ansprache an den ALLRIS-Hersteller)
- [ ] Versand, Eingang im Projekt-Ablageort dokumentieren
- [ ] Bei Rückfragen: Anhang (Abschnitt 5) und Demo-Angebot (Abschnitt 3) nachreichen
- [ ] Ergebnis in `api-recherche-2026-10-ergaenzungen.md` (Abschnitt 2.4) aktualisieren
