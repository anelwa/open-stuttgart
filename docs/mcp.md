# MCP-Server: Open Stuttgart für andere Agenten

Open Stuttgart stellt seine offenen Daten nicht nur im Browser, sondern auch als
**Model-Context-Protocol-Server** bereit. Der Server ist vollständig **read-only**, nennt an jeder
Antwort Quelle und Lizenz und kann sowohl lokal über **stdio** als auch öffentlich über
**Streamable HTTP** unter `/mcp` genutzt werden.

- **Endpoint (App):** `https://<deine-domain>/mcp` bzw. lokal `http://localhost:8787/mcp`
- **Endpoint (eigener Prozess):** `http://127.0.0.1:8788/mcp` (`npm run mcp:http`)
- **stdio:** `node server/mcp/stdio.mjs` (direkt, nicht über `npm run`, damit die JSON-RPC-Ausgabe sauber bleibt)
- **Health:** `GET /healthz` beim eigenen Prozess, `GET /api/health` bei der App
- **Protokoll:** MCP `2026-07-28` (modern, zustandslos) und abwärtskompatibel
  `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05` (initialize + Sitzung)
- **Werkzeuge:** 35 · **Ressourcen:** 4 + 6 Vorlagen · **Prompts:** 6
- **Lizenz:** EUPL-1.2; die Daten selbst stehen unter den Lizenzen der jeweiligen Quellen.

## Start

### In der bestehenden App

`npm start` (oder `npm run serve`) startet den Node-Server. Der MCP-Endpunkt ist automatisch unter
`http://localhost:8787/mcp` erreichbar. Es ist keine zusätzliche Abhängigkeit und kein API-Key nötig.

### Als eigener MCP-Prozess (HTTP)

```bash
npm run mcp:http          # http://127.0.0.1:8788/mcp
OS_MCP_PORT=9000 npm run mcp:http
OS_MCP_HOST=0.0.0.0 npm run mcp:http   # nur hinter Proxy/Container
```

Der eigene Prozess startet – wie die App – im Hintergrund den GTFS-RT-Abruf und die
Verlaufsaufzeichnung. Mit `OS_MCP_BACKGROUND=0` lässt sich das abschalten.

### Als stdio-Server (Claude Desktop, Cursor, …)

```bash
node server/mcp/stdio.mjs
# oder, wenn das Paket global/als bin installiert ist:
open-stuttgart-mcp
```

Auf **stdout** gehen ausschließlich JSON-RPC-Nachrichten (eine pro Zeile). Logs und Fehler gehen
nach **stderr**. `OS_MCP_LOG=1` schaltet zusätzliche Logs ein.

### Docker / Dokploy

Das bestehende `Dockerfile` kopiert `server/` vollständig, damit ist `/mcp` ohne Änderung im
Deployment enthalten. Der Health-Check bleibt `/api/health`. Für einen separaten MCP-Container
kann `node server/mcp/standalone.mjs` als Entrypoint dienen; Port `8788` veröffentlichen und
`OS_MCP_HOST=0.0.0.0` setzen. Der Endpunkt ist bewusst ohne Authentifizierung, aber mit
IP-Rate-Limit; für eine öffentliche Instanz sollte ein Reverse Proxy (TLS, Body-Limit, Logs)
davorstehen.

## Client-Konfiguration

### Claude Desktop (stdio, lokal)

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) bzw.
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "open-stuttgart": {
      "command": "node",
      "args": ["/absolute/path/to/stuttgart-app/server/mcp/stdio.mjs"],
      "env": {
        "OS_MCP_LOG": "0"
      }
    }
  }
}
```

`cwd` muss nicht gesetzt werden; die Daten werden relativ zum Modul gefunden. Wenn du eine `.env`
mit z. B. `OS_GANCIO_URL` nutzt, kann `"cwd": "/absolute/path/to/stuttgart-app"` helfen.

### Claude Desktop / Connectors (HTTP, öffentlich)

In neueren Versionen lässt sich ein HTTP-MCP-Server als Connector hinzufügen:

```text
https://<deine-domain>/mcp
```

Falls der Client nur stdio spricht, nimm den stdio-Eintrag oben oder einen generischen
stdio-zu-HTTP-Bridge-Prozess.

### Claude Code

```bash
# HTTP
claude mcp add --transport http open-stuttgart https://<deine-domain>/mcp

# lokal per stdio
claude mcp add open-stuttgart -- node /absolute/path/to/stuttgart-app/server/mcp/stdio.mjs
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "open-stuttgart": {
      "url": "https://<deine-domain>/mcp"
    }
  }
}
```

### VS Code (GitHub Copilot / MCP)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "open-stuttgart": {
      "type": "http",
      "url": "https://<deine-domain>/mcp"
    }
  }
}
```

### Generisch

Jeder MCP-Client, der Streamable HTTP spricht, bekommt unter `/mcp`:

- `POST` für JSON-RPC-Anfragen (Antwort als JSON oder SSE),
- `GET` mit `Accept: text/event-stream` und `Mcp-Session-Id` für Legacy-Server-Push,
- `DELETE` mit `Mcp-Session-Id` zum Beenden einer Legacy-Sitzung.

Moderne Clients (ab `2026-07-28`) sind zustandslos und schicken die Version in `_meta` und in
`MCP-Protocol-Version`; sie brauchen keine Sitzung.

## Protokoll und Header

Der Server ist **dual-era**:

| Generation | Fassungen | Verhalten |
|---|---|---|
| modern | `2026-07-28` | zustandslos, `server/discover`, Version/Client-Infos je Anfrage in `_meta`, Pflichtheader |
| legacy | `2025-11-25` … `2024-11-05` | `initialize`, `Mcp-Session-Id`, optional GET-SSE, `logging/setLevel`, `ping` |

Moderne POST-Anfragen benötigen:

```http
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: departures
```

`Mcp-Name` ist bei `tools/call`, `resources/read` und `prompts/get` Pflicht. Der Header muss zum
Body passen (`params.name` bzw. `params.uri`); sonst antwortet der Server mit HTTP 400 und
`-32020` (`HeaderMismatch`). Eine nicht unterstützte Version ergibt `-32022`
(`UnsupportedProtocolVersion`) mit der Liste der unterstützten Fassungen.

`server/discover` ist der moderne Einstieg und liefert Versionen, Fähigkeiten und Identität:

```bash
curl -sS https://<deine-domain>/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: server/discover' \
  -d '{
    "jsonrpc": "2.0", "id": 1, "method": "server/discover",
    "params": { "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    } }
  }'
```

### Legacy-Beispiel

```bash
# 1. initialize; Antwort enthält Mcp-Session-Id
curl -sS -D - http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
        "protocolVersion":"2025-06-18","capabilities":{},
        "clientInfo":{"name":"curl","version":"1"}}}'

# 2. Anfragen mit Sitzung
curl -sS http://localhost:8787/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Session-Id: <ID>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

### Fehler

| Code | Bedeutung | HTTP |
|---|---|---|
| `-32700` | ungültiges JSON | 400 |
| `-32600` | ungültige JSON-RPC-Anfrage | 400 |
| `-32601` | unbekannte Methode | 404 |
| `-32602` | unbekanntes Werkzeug, ungültige Argumente, unbekannte Ressource | 200/400 |
| `-32603` | interner Fehler | 200 |
| `-32020` | HeaderMismatch | 400 |
| `-32022` | nicht unterstützte Protokollversion | 400 |
| `-32000` | Rate-Limit | 429 |

Werkzeugfehler (z. B. Quelle nicht erreichbar) sind **kein** JSON-RPC-Fehler, sondern ein
Ergebnis mit `"isError": true` und einer erklärenden Textantwort.

## Werkzeuge

Alle Werkzeuge sind `readOnlyHint: true`, `destructiveHint: false`. `cost` steuert das Rate-Limit:
1 = normal, 3 = teuer, 6 = sehr teuer. Eine ausführliche Beschreibung, Beispiele und die
JSON-Schemata stehen im laufenden Server unter `tools/list` und in `stuttgart://catalog`.

### Suche und Wissen

| Werkzeug | Zweck |
|---|---|
| `search_stuttgart` | Volltext über Seiten, Leistungen, Dienststellen, Dokumente und Kontakte (SQLite/FTS5, ca. 10.300 Einträge); `mode="suggest"` für Titelvorschläge |
| `get_document` | Dokument/Leistungsseite mit Ablauf, Unterlagen, Gebühren, Quellen, Backlinks und verwandten Seiten |
| `contacts` | Kontaktregister (ca. 5.400 Stellen, Notdienste, Beratung) mit Telefon, E-Mail, Zeiten; `id` für Details |
| `datasets` | GovData, OpenData@Stuttgart (CKAN), KOMUNIS, Wikidata-Lücken, K10plus, FragDenStaat |
| `participation` | Bebauungspläne und Planauslegung am Ort, Wahlergebnisse je Bezirk, Beteiligungsangebote |

### Weg und Verkehr

| Werkzeug | Zweck |
|---|---|
| `geocode` | Adresse, Ort oder Haltestelle verorten (gis6, EFA) |
| `plan_route` | Route mit ÖPNV/Rad/Auto/zu Fuß, Profil, Zeit, Ankunft |
| `departures` | Nächste Abfahrten mit Echtzeit, Verspätung, Steig, Ausfällen |
| `transit` | Pünktlichkeit, Bahn am Hbf, Anschlussprüfung, Aufzugsstatus |
| `traffic` | Verkehrsmeldungen, Baustellen, Hauptradrouten |
| `accidents` | Unfallatlas 2025 im Umkreis, nach Beteiligung/Schwere, oder Statistik |
| `parking` | Parkhäuser, P+R, Bike+Ride, Sharing, Fahrradzählstellen, Ladepunkte, Kraftstoffpreise |

### Adresse und Verwaltung

| Werkzeug | Zweck |
|---|---|
| `address_profile` | Adressprofil: Bezirk, Wahllokal, Starkregen, Lärm, Solar, Gründach, Wohnlage, Klima, Bäume, nächste Stellen |
| `waste` | Abfuhrtermine für Straße und Hausnummer |
| `school_district` | Grundschulbezirk und zugehörige Schule |
| `services` | Leistung suchen, Details laden, zuständige Stellen finden |
| `offices` | Bürgerbüros mit Live-Wartezeit, „üblich um diese Zeit“, Entfernung |
| `nearby` | Einrichtungen in der Nähe (Gastro, Kitas, Schulen, Toiletten, Brunnen, Bäder, Läden …) |

### Termine, Kultur, Freizeit

| Werkzeug | Zweck |
|---|---|
| `events` | Städtischer Kulturkalender und/oder „Was geht“-Szene; Tag, Abend, Wochenende, Szene, Publikum, Preis |
| `places` | Sehenswürdigkeiten aus Wikidata mit Bild, Kurztext und Artikel |
| `umland` | Ausflugsziele in der Region Stuttgart mit Filtern, nächster Haltestelle, Wetter und Wikipedia-Kurztext |
| `wiki` | Wikipedia-Kurztext zu einem Titel |
| `mensa` | Tagesgerichte der Stuttgarter Mensen |
| `news` | Meldungen aus offenen Feeds und/oder Stadtgedächtnis |
| `leisure` | Wanderwege, Freizeitrouten, Bar-Touren, Geocaches, Bäder, Flugverkehr/ISS, StadtPalais, Stadtspiel, Veranstaltungsorte |

### Umwelt und Gesundheit

| Werkzeug | Zweck |
|---|---|
| `weather` | Wetter, Vorhersage, optional BBK-Warnungen und Regenradar |
| `air_quality` | UBA-Luftqualität der vier Stuttgarter Messstationen |
| `water` | Neckarpegel Cannstatt mit Verlauf |
| `climate` | Luftaustausch im Talkessel, Kaltluftleitbahnen |
| `nature` | iNaturalist, GBIF, OSM-Hinweise, foodsharing, Gieß-Radar, Pollen-Hotspots |
| `health` | Pollen, UV, Hitze/Biowetter, Stromnetz, Grünstrom |

### Offene Daten und Metadaten

| Werkzeug | Zweck |
|---|---|
| `wfs_catalog` | WFS-Katalog der Stadt (458 Layer) mit Freigabestatus |
| `wfs_features` | Freigegebenen Layer als GeoJSON im Umkreis laden |
| `wfs_feed` | RSS-Feed für einen Layer |
| `about` | Werkzeugkatalog, Abdeckung, Lizenzen, Grenzen |

## Ressourcen

| URI | Inhalt |
|---|---|
| `stuttgart://catalog` | Vollständiger Werkzeug-, Ressourcen- und Prompt-Katalog mit JSON-Schemata |
| `stuttgart://coverage` | Live / cached / gemischt / nur verlinkt / fehlt – je Domäne |
| `stuttgart://licenses` | Quellen- und Lizenzregister |
| `stuttgart://layers` | Vollständiger WFS-Layer-Katalog |
| `stuttgart://layer/{name}` | Metadaten eines Layers |
| `stuttgart://service/{id}` | Verwaltungsleistung |
| `stuttgart://event/{id}` | Termin (aus dem Zwischenspeicher oder den nächsten 14 Tagen) |
| `stuttgart://contact/{id}` | Kontakt |
| `stuttgart://document/{id}` | Dokument/Seite |
| `stuttgart://stop/{id}` | Haltestelle mit Abfahrten |

## Prompts

| Prompt | Argumente | Zweck |
|---|---|---|
| `stadt-check` | `adresse`, `anliegen?` | Adresse prüfen: Bezirk, Wahllokal, Starkregen, Lärm, Solar, Schulbezirk, Abfall |
| `route-planen` | `von`, `nach`, `modus?` | Route inkl. Barrierefreiheit und Hinweisen |
| `verwaltungsweg` | `anliegen`, `adresse?` | Leistung, Unterlagen, Gebühren, schnellstes Bürgerbüro |
| `abendplan` | `datum?`, `szene?`, `publikum?` | Termine, Wetter, Gastro, Heimweg |
| `wochenendplan` | `interessen?`, `stadtbezirk?` | Wochenende mit Terminen, Natur und Wegen |
| `datenquellen` | `thema` | Quelle, Lizenz, Zeitstand und Grenzen erklären |

## Betrieb und Grenzen

### Umgebungsvariablen

| Variable | Standard | Bedeutung |
|---|---|---|
| `OS_MCP` | `1` | `0` schaltet den MCP-Endpunkt ab (HTTP 503) |
| `OS_MCP_RATE` | `120` | gewichtete Anfragen pro Minute und IP |
| `OS_MCP_HEAVY_RATE` | `20` | Anfragen pro Minute und IP für ein einzelnes teures Werkzeug |
| `OS_MCP_MAX_BODY` | `262144` | maximale Body-Größe in Bytes |
| `OS_MCP_ORIGINS` | `*` | erlaubte Origins, kommasepariert; `*` für öffentlich |
| `OS_MCP_LEGACY_SSE` | `1` | `0` deaktiviert GET-SSE für Legacy-Clients |
| `OS_MCP_PORT` | `8788` | Port des eigenen HTTP-Prozesses |
| `OS_MCP_HOST` | `127.0.0.1` | Bind-Adresse; für Container `0.0.0.0` |
| `OS_MCP_BACKGROUND` | `1` | `0` verhindert GTFS-RT/Verlauf im eigenen Prozess |
| `OS_MCP_LOG` | `0` | `1` loggt auf stderr |
| `OS_TRUST_PROXY` | `0` | `1` nutzt `X-Forwarded-For` für das Rate-Limit |

Datenquellen haben eigene Schalter (`OS_GTFSRT=0`, `OS_VERLAUF=0`, `OS_GANCIO_URL`, …); sie gelten
für MCP genauso wie für die App.

### Read-only und Datenschutz

- Keine Schreibzugriffe, keine Buchungen, keine Anträge, keine Zahlungen.
- Keine Standortabfrage: Koordinaten nur, wenn der Aufrufer sie übergibt.
- Keine Cookies, keine Sitzungsprofile; Legacy-Sitzungen liegen nur im Arbeitsspeicher.
- Keine Weitergabe von IP-Adressen an Datenquellen; der Server ruft selbst ab.
- Keine Volltexte von Presseartikeln; Meldungen nur mit Titel, Link und ggf. Anreißer.

### Lizenzen und Quellen

Jede Werkzeugantwort enthält `sources` mit Name, URL und Lizenz. Das vollständige Register steht
unter `stuttgart://licenses` und im Werkzeug `about`. Wichtige Quellen:

- Stadt Stuttgart / Geoserver: CC BY 4.0 bzw. Nutzungsbedingungen, je Layer
- EFA-BW / NVBW: Datenlizenz Deutschland – Namensnennung 2.0
- MobiData BW (ParkAPI, GBFS, OCPDB): dl-de/by-2-0, je Datensatz
- DWD/Bright Sky: GeoNutzV / CC BY 4.0
- UBA/LUBW: dl-de/by-2-0
- Wikidata: CC0; Wikipedia: CC BY-SA 4.0; Commons: je Bild
- OpenStreetMap: ODbL 1.0
- Unfallatlas: dl-de/by-2-0
- iNaturalist/GBIF: je Beobachtung/Datensatz

Bei der Weiterverwendung müssen Quelle und Lizenz genannt werden. Maßgeblich sind die
Originalquellen; der MCP-Server ist kein amtlicher Auskunftsdienst und ersetzt keine Rechts-,
Medizin- oder Finanzberatung.

### Caching

Die Quellen werden im Server zwischengespeichert (Wetter 10 min, Abfahrten 20 s, Parken 60 s,
Adressprofil 30 Tage usw.). MCP-Listen und statische Ressourcen tragen `ttlMs`/`cacheScope` für
moderne Clients. Live-Werte können sich trotzdem minütlich ändern.

## Tests

```bash
npm run check:mcp
```

Der Rauchtest prüft:

- Katalog (35 Werkzeuge, eindeutige Namen, read-only, Schemata),
- Legacy: `initialize`, `tools/list`, `tools/call`, Ressourcen, Prompts, Completion, Fehler,
- modern: `server/discover`, `tools/list`, `tools/call`, Cache-Felder,
- HTTP: CORS, Session, SSE, DELETE, Header-Pflicht, Versionsfehler,
- stdio: Handshake, Werkzeugliste, saubere stdout-Ausgabe.

Der Test braucht **kein Netzwerk** und keine Datenbank-Schreibrechte; er nutzt nur lokale
Werkzeuge (`about`, `search_stuttgart`, `get_document`, Ressourcen, Prompts).

## Aufbau

```text
server/mcp/
  index.mjs        Einstieg, Singleton, /mcp-Handler
  http.mjs         Streamable HTTP, CORS, Sessions, SSE, Header
  stdio.mjs        stdio-Transport und CLI
  standalone.mjs   eigener HTTP-Prozess (Port 8788)
  server.mjs       JSON-RPC-Dispatcher, Tools/Resources/Prompts
  protocol.mjs     Versionen, Header, JSON-RPC, Pagination, Cache
  catalog.mjs      Zusammenbau des Katalogs
  resources.mjs    Ressourcen und Vorlagen
  prompts.mjs      kuratierte Prompts
  sessions.mjs     Legacy-Sitzungen und SSE-Ströme
  sources.mjs     Quellen- und Lizenzregister
  coverage.mjs     Abdeckung und Grenzen
  util.mjs         Validierung, Fristen, Ergebnisse, Rate-Limit
  tools/           35 Werkzeuge nach Domäne
```

## Bekannte Grenzen

- **Keine Buchung:** Terminbuchung ist nur als Link enthalten; freie Slots gibt es nicht offen.
- **Keine Anträge/Zahlungen:** keine Authentifizierung, keine Übermittlung.
- **Beteiligungsportal:** kein offener Feed; nur Verweise und amtliche Dateien.
- **Aufzüge:** nur DB-Anlagen mit offener Sicht; SSB-Stadtbahnaufzüge haben keine offene
  Live-Quelle.
- **Live-Werte:** Wartezeiten, Parken, Sharing und Abfahrten sind Momentaufnahmen.
- **WFS:** Nur freigegebene Layer dürfen geladen werden; die übrigen bleiben im Katalog sichtbar.
- **Große Antworten:** Der Server kürzt Textantworten und begrenzt Listen; für vollständige
  GeoJSON-Daten `wfs_features` mit engerem Radius/limit nutzen.
