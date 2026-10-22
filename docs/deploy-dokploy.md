# Live auf Dokploy

Anleitung, um Open Stuttgart als Docker-App auf einer Dokploy-Instanz (hier: `https://deploy.stawa-studio.com`) zu
betreiben. Grundlage sind das [`Dockerfile`](../Dockerfile) im Wurzelverzeichnis (Build der Oberfläche + schlankes
Laufzeit-Image) und eine Datenstrategie „Volume + rsync": Die großen Datenbestände (`server/data/`, rund 140 MB)
stehen bewusst nicht im Git und werden direkt auf den Server gespielt.

## Voraussetzungen

- Server (VPS) mit Docker und einer laufenden Dokploy-Instanz
- Domain (z. B. `open-stuttgart.example.de`) mit **A-Record auf die VPS-IP** — muss vor dem Deploy gesetzt sein,
  sonst kann Let's Encrypt kein Zertifikat ausstellen. Ein proxied Record bei Cloudflare (orange Cloud) funktioniert:
  die HTTP-01-Challenges laufen durch den Proxy durch, die SSL-Stufe sollte „Full (strict)" sein
- SSH-Zugang zum VPS für die Daten (tar- oder rsync-Transfer)
- Ein GitHub-Push auf `main` löst später das Build aus

## Was wohin kommt

| Datei | Ort im Container | Herkunft |
|---|---|---|
| `dist/` (gebaute Oberfläche) | `/app/dist` | wird im Docker-Build erzeugt |
| `server/` (API-Server, Node ≥ 22.5) | `/app/server` | aus dem Git |
| `server/data/` (Verwaltung, Suche, GeoJSON) | `/app/server/data` | **Volume**, per rsync vom Entwicklungsrechner |
| `server/.cache/` (Tagesarchive, Snapshots) | `/app/server/.cache` | **Volume**, schreibt der Server selbst |

Der Server braucht zur Laufzeit keine `node_modules` (nur Node-Builtins). `sqlite-vec` wird ausschließlich lokal für
`npm run data:search` gebraucht.

## Schritt 1: Ordner und Daten auf den VPS

```bash
ssh user@vps
sudo mkdir -p /opt/open-stuttgart/data /opt/open-stuttgart/cache
sudo chown -R 1000:1000 /opt/open-stuttgart   # UID des Container-Nutzers „node“
```

Die kleinen Grunddaten (`venues.json`, `iris-codes.json`, `feste-maerkte.json`, …) legt der Container beim ersten
Start selbst im Volume nach (`docker-entrypoint.sh`); rsync muss nur die erzeugten Datenbestände liefern.

Daten aus dem Entwicklungsverzeichnis hochladen (Datenbestände, die vor Ort erzeugt wurden). Da auf dem Server
oft kein `rsync` installiert ist, geht der Transfer auch als `tar`-Pipe ohne Zusatzsoftware:

```bash
# vorher sicherstellen, dass die Bestände aktuell sind:
npm run data:verwaltung && npm run data:search   # verwaltung.sqlite + suche.sqlite

cd server && tar czf - --exclude='*-wal' --exclude='*-shm' data \
  | ssh root@vps 'tar xzf - -C /opt/open-stuttgart && chown -R 1000:1000 /opt/open-stuttgart'
# Alternative mit rsync (braucht rsync auf beiden Seiten):
# rsync -av --exclude='*-wal' --exclude='*-shm' server/data/ root@vps:/opt/open-stuttgart/data/
```

Die Suchdatenbank `suche.sqlite` liegt in `server/data/` und wird mitgespielt. Alternativ kann sie auf dem Server
mit den dorthin kopierten Crawl-Dateien neu erzeugt werden (`npm run data:search` bei vorhandenem
`node_modules`).

## Schritt 2: Application in Dokploy anlegen

1. **Projekt anlegen:** Dashboard → *Projects* → *New Project* (z. B. `open-stuttgart`).
2. **Application anlegen:** *Create Service* → *Application*, Name z. B. `app`.
3. **Quelle:** *GitHub* und das Repository `anelwa/open-stuttgart`, Branch `main`. (Privates Repo? Dann vorher unter
   *Settings → Git* die GitHub-App verbinden bzw. als Deploy-Key einrichten.)
4. **Build:** *Build Type* → `Dockerfile`, *Dockerfile Path* → `Dockerfile`. Der Build-Kontext ist das
   Repository-Wurzelverzeichnis.
5. **Port:** `8787` (der Server lauscht auf `PORT`, Vorgabe 8787).
6. **Domain:** unter *Domains* die gewünschte Domain eintragen, z. B. `open-stuttgart.example.de`, Port `8787`,
   HTTPS mit Let's Encrypt aktivieren (*HTTPS* → *Let's Encrypt*).
7. **Volumes** (unter *Advanced → Volumes*, Typ *Bind*):

   | Host-Pfad | Mount-Pfad |
   |---|---|
   | `/opt/open-stuttgart/data` | `/app/server/data` |
   | `/opt/open-stuttgart/cache` | `/app/server/.cache` |

8. **Umgebungsvariabeln** (unter *Environment*) eintragen, soweit gewünscht:

   | Variable | Wirkung |
   |---|---|
   | `LOG=1` | Antwortzeiten der Quellen ins Container-Log |
   | `OS_MARKETING=0` | Hintergrundabruf der Stuttgart-Marketing-Termine aus |
   | `OS_GANCIO_URL` | eigenes Veranstaltungsregister (Gancio), z. B. `https://termine.example.de` |
   | `OS_DB_CLIENT_ID` / `OS_DB_API_KEY` | DB Timetables-API statt IRIS-Übergang |
   | `OS_TICKETMASTER_KEY` | Ticketmaster Discovery API (große Häuser) |
   | `OS_SCENE_JUGENDAGENTUR=1` | Jugendagentur-Termine dazu |
   | `OS_OPENINGS=1` | OSM-Auswertung neu erfasster Orte (nicht im Dauerbetrieb geprüft) |
   | `OS_VEHICLES=0`, `OS_GTFSRT=0`, `OS_VERLAUF=0` | rechenintensive Hintergrunddienste abschalten |

9. **Deploy** klicken. Der Build läuft durch zwei Stages (`npm ci` + `vite build`, dann Runtime-Image) und startet
   `node server/index.mjs`. Die `HEALTHCHECK`-Zeile im Dockerfile prüft `/api/health`.

## Schritt 3: Prüfen

```bash
curl -s https://open-stuttgart.example.de/api/health
# {"ok":true,"time":"..."}

curl -s https://open-stuttgart.example.de/api/search/stats | head -c 300   # Suchdatenbank vorhanden?
```

Im Browser öffnen. Fehlt die Suchdatenbank, antwortet `/api/search` mit `503` und dem Hinweis
„Suchdatenbank fehlt" — dann Schritt 1 (rsync) wiederholen.

## Aktualisieren

- **Code:** `git push` auf `main`, danach in Dokploy *Deploy* (oder Auto-Deploy aktivieren). Der Build ist reproduzierbar,
  die Datenbestände bleiben unangetastet.
- **Daten:** erneut `rsync` (Schritt 1). Ein Neustart des Containers ist nur nötig, wenn die Suchdatenbank gerade
  ersetzt wurde (sie wird schreibgeschützt geöffnet); ansonsten liest der Server die Dateien bei Bedarf neu.
- **Zwischenstände:** `server/.cache/` überlebt Deploys (Tagesarchive der Bäder/Bürgerbüros, Pünktlichkeits-Archiv,
  Stadtgedächtnis-Snapshot), weil es ein Volume ist.

## Optional: Gancio (offenes Veranstaltungsregister)

Gancio läuft als eigener Dienst (siehe [`gancio/`](../gancio/)):

1. In Dokploy eine *Compose*-Service anlegen und `gancio/docker-compose.yml` verwenden (Image `cisti/gancio:1.28.2`),
   oder den Container manuell auf dem VPS starten: `cd gancio && cp config.json.example config.json && docker compose up -d`.
2. Volume für `gancio/data` anlegen, damit Einträge den Neustart überleben.
3. Domain für Gancio eintragen (z. B. `termine.example.de`, interner Port `13120`).
4. In der App setzen: `OS_GANCIO_URL=https://termine.example.de` und erneut deployen.

## Betrieb und Fehlersuche

| Symptom | Ursache / Fix |
|---|---|
| `502 Bad Gateway` von Traefik | Container nicht gestartet; Logs in Dokploy prüfen, oft Build-Fehler (Node-Version) |
| Zertifikat wird nicht ausgestellt | A-Record der Domain zeigt nicht auf die VPS-IP |
| `/api/search` liefert `503` | `suche.sqlite` fehlt im Volume; rsync aus Schritt 1 |
| `/app/server/.cache` nicht schreibbar | Host-Ordner gehört nicht UID 1000; `sudo chown -R 1000:1000 /opt/open-stuttgart` |
| Container-Logs: Quellenfehler | einzelne Quellen sind abschaltbar (`OS_SCENE_<KEY>=0`, `OS_GTFSRT=0`, …) |
| Datenaktualisierung | lokal `npm run data:*` ausführen und erneut rsync; `npm run check:wasgeht` prüft die Event-Quellen |
