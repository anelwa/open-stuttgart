# Stadtlabor-API: Quellen, Werkzeuge und Verbesserungen

Alle Endpunkte sind lesend, ohne Schlüssel und ohne Anmeldung erreichbar. Jede Antwort nennt Quelle, Lizenz, Abrufzeit und Grenzen. Die Daten werden serverseitig zwischengespeichert.

## Übersicht

`GET /api/labor`

```json
{
  "program": "Open Stuttgart – mindestens 100 Schnittstellen, 100 Werkzeuge",
  "sources": { "count": 101, "live": 101, "planned": 0, "key": 0 },
  "features": { "count": 100, "live": 100, "planned": 0 },
  "improvements": { "count": 100, "done": 20, "open": 80 }
}
```

## Quellen

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/labor/quellen` | vollständiger Quellenkatalog mit Typ, Lizenz, Attribution, Status und Cache-TTL |
| GET | `/api/labor/quelle?id=<id>` | eine Quelle abrufen; liefert Tabelle, GeoJSON, Punkte oder JSON |

Beispiele:

```bash
curl 'http://localhost:8787/api/labor/quelle?id=ckan-einwohner-altersgruppen&limit=5'
curl 'http://localhost:8787/api/labor/quelle?id=lubw-naturschutzgebiet&lat=48.7758&lon=9.1829&r=10'
curl 'http://localhost:8787/api/labor/quelle?id=api-emsc-erdbeben&limit=10'
```

Unbekannte IDs liefern `404`, Quellen mit nötigem Schlüssel `501`. Geo-Quellen akzeptieren `lat`, `lon`, `r` (Kilometer) und `limit`.

## Werkzeuge

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/labor/werkzeuge` | Katalog der 100 Werkzeuge mit Eingaben und Status |
| GET | `/api/labor/werkzeug?id=<id>&…` | ein Werkzeug ausführen |

Beispiele:

```bash
curl 'http://localhost:8787/api/labor/werkzeug?id=kiez-steckbrief&bezirk=Mitte'
curl 'http://localhost:8787/api/labor/werkzeug?id=familien-check&ort=Charlottenplatz'
curl 'http://localhost:8787/api/labor/werkzeug?id=erdbeben-check'
curl 'http://localhost:8787/api/labor/werkzeug?id=qr-schild&ort=Charlottenplatz'
```

Antwortformat:

```json
{
  "id": "kiez-steckbrief",
  "title": "Kiez-Steckbrief: Mitte",
  "summary": "…",
  "facts": [{ "label": "Einwohner", "value": "…" }],
  "blocks": [{ "type": "table", "columns": ["…"], "rows": [["…"]] }],
  "points": [{ "lat": 48.77, "lon": 9.18, "label": "…" }],
  "geojson": null,
  "sources": [{ "name": "…", "url": "…", "license": "…" }],
  "limits": ["…"],
  "speech": "…",
  "updated": "2026-10-24T…"
}
```

Blocktypen: `text`, `facts`, `list`, `table`, `chart`, `links`, `image`. `points` und `geojson` können direkt auf der Karte gezeigt werden. `speech` ist für die Browser-Sprachausgabe aufbereitet.

## Verbesserungen

`GET /api/labor/verbesserungen` liefert die 100 Verbesserungen mit Kategorie, Status und Fortschritt. Die Liste ist bewusst statisch im Code gepflegt, damit der Fortschritt nicht von einer Datenquelle abhängt.

## Fehler

| Status | Bedeutung |
|---:|---|
| 400 | Pflichtfeld fehlt oder ungültig |
| 404 | unbekannte Quelle/Werkzeug |
| 501 | Werkzeug/Quelle noch nicht live |
| 502 | Upstream nicht erreichbar |

## Grenzen

- Keine Schreibzugriffe, keine Buchungen, keine personenbezogenen Daten.
- Externe Quellen können ausfallen; der letzte gute Stand bleibt mit Hinweis sichtbar.
- Lizenz und Quellenangabe stehen an jeder Antwort. Die Rechte liegen bei den jeweiligen Anbietern.
