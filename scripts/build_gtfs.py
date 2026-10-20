#!/usr/bin/env python3
"""Erzeugt aus dem VVS-Soll-Fahrplan (GTFS, CC BY 4.0) die statischen Kartendaten:

  public/data/network.geojson  Linienverlauf Stadtbahn, S-Bahn, Zacke, Seilbahn
  public/data/stops.geojson    Haltestellen (Stadt Stuttgart komplett, Region nur Schiene)

Aufruf:  python3 scripts/build_gtfs.py pfad/zu/gtfs.zip
Die ZIP gibt es unter https://download.vvs.de/gtfs_realtime.zip (statisch, ca. 120 MB).
Nur Standardbibliothek, liest die großen Dateien zeilenweise.
"""
import csv, io, json, sys, zipfile
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "data"
RAIL = {"402": "stadtbahn", "109": "sbahn", "1400": "zahnrad", "2": "regio"}
DRAW = {"402", "109", "1400"}
# Die GTFS-Datei färbt alle S-Bahnen gleich. Linienfarben angelehnt an den VVS-Netzplan.
SBAHN_COLORS = {"S1": "#6CB23F", "S2": "#E2001A", "S3": "#F39100", "S4": "#0069B4",
                "S5": "#00A5DB", "S6": "#83542D", "S60": "#8D8C1D", "S62": "#C26B1E"}
CITY = "de:08111:"
# Grobe Umgebung Stuttgarts (Region), damit Schienenhalte am Rand noch erscheinen
BBOX = (8.85, 48.55, 9.55, 49.0)


def rows(z, name):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, "utf-8-sig"))


def station_id(stop_id):
    return ":".join(stop_id.split(":")[:3])


def simplify(pts, tol=0.00003):
    """Douglas-Peucker, Toleranz in Grad (ca. 3 m)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, idx = 0.0, None
        for i in range(a + 1, b):
            x, y = pts[i]
            d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
            if d > best:
                best, idx = d, i
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def main(path):
    z = zipfile.ZipFile(path)
    routes = {r["route_id"]: r for r in rows(z, "routes.txt")}
    trip_route, shape_use = {}, defaultdict(Counter)
    for t in rows(z, "trips.txt"):
        trip_route[t["trip_id"]] = t["route_id"]
        if routes[t["route_id"]]["route_type"] in DRAW and t["shape_id"]:
            shape_use[(t["route_id"], t["direction_id"])][t["shape_id"]] += 1

    # Pro Linie und Richtung die häufigsten Varianten; Äste (S2 Filderstadt usw.) kommen
    # über die Abdeckungsprüfung weiter unten dazu, Dubletten fallen dort heraus.
    wanted, rank = {}, {}
    for (rid, _), cnt in shape_use.items():
        for i, (sid, n) in enumerate(cnt.most_common(25)):
            wanted[sid] = rid
            rank[sid] = (-n, i)
    print(f"{len(wanted)} Linienverläufe ausgewählt", file=sys.stderr)

    shapes = defaultdict(list)
    for s in rows(z, "shapes.txt"):
        if s["shape_id"] in wanted:
            shapes[s["shape_id"]].append((int(s["shape_pt_sequence"]), float(s["shape_pt_lon"]), float(s["shape_pt_lat"])))

    feats, covered = [], defaultdict(set)
    cell = lambda x, y: (round(x / 0.0006), round(y / 0.0004))
    for sid in sorted(shapes, key=lambda s: (wanted[s], -len(shapes[s]))):
        pts = sorted(shapes[sid])
        coords = simplify([(round(x, 5), round(y, 5)) for _, x, y in pts])
        cells = {cell(x, y) for _, x, y in pts}
        known = covered[wanted[sid]]
        near = lambda c: any((c[0] + a, c[1] + b) in known for a in (-1, 0, 1) for b in (-1, 0, 1))
        if known and sum(1 for c in cells if not near(c)) < 6:
            continue  # Verlauf ist schon gezeichnet
        known |= cells
        r = routes[wanted[sid]]
        name = r["route_short_name"]
        mode = RAIL[r["route_type"]]
        color = SBAHN_COLORS.get(name) if mode == "sbahn" else "#" + r["route_color"]
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                      "properties": {"line": name, "mode": mode, "color": color or "#83b23b",
                                     "text": "#" + r["route_text_color"], "name": r["route_long_name"]}})
    order = {"sbahn": 0, "stadtbahn": 1, "zahnrad": 2}
    # Innerhalb einer Gruppe liegt die niedrigste Liniennummer oben (wird zuletzt gezeichnet)
    num = lambda l: int("".join(c for c in l if c.isdigit()) or 0)
    feats.sort(key=lambda f: (order[f["properties"]["mode"]], -num(f["properties"]["line"])))
    (OUT / "network.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))
    print(f"network.geojson: {len(feats)} Linien", file=sys.stderr)

    # Haltestellen: Verkehrsmittel und Anzahl Fahrten je Station aus stop_times
    modes, deps, lines = defaultdict(set), Counter(), defaultdict(set)
    for st in rows(z, "stop_times.txt"):
        rid = trip_route.get(st["trip_id"])
        if not rid:
            continue
        r = routes[rid]
        sid = station_id(st["stop_id"])
        modes[sid].add(RAIL.get(r["route_type"], "bus"))
        deps[sid] += 1
        if len(lines[sid]) < 40:
            lines[sid].add(r["route_short_name"])

    pos = defaultdict(list)
    names = {}
    for s in rows(z, "stops.txt"):
        if not s["stop_lat"]:
            continue
        sid = station_id(s["stop_id"])
        pos[sid].append((float(s["stop_lon"]), float(s["stop_lat"])))
        names.setdefault(sid, s["stop_name"])

    out = []
    for sid, p in pos.items():
        if sid not in deps:
            continue
        lon = sum(x for x, _ in p) / len(p)
        lat = sum(y for _, y in p) / len(p)
        rail = modes[sid] & {"stadtbahn", "sbahn", "zahnrad", "regio"}
        in_city = sid.startswith(CITY)
        in_box = BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]
        if not (in_city or (rail and in_box)):
            continue
        kind = "sbahn" if {"sbahn", "regio"} & rail else "stadtbahn" if "stadtbahn" in rail else "zahnrad" if rail else "bus"

        def sort_key(l):
            return (not l.startswith("S"), not l.startswith("U"), len(l), l)
        out.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                    "properties": {"id": sid, "name": names[sid], "kind": kind, "city": in_city,
                                   "trips": deps[sid], "lines": sorted(lines[sid], key=sort_key)[:14]}})
    out.sort(key=lambda f: -f["properties"]["trips"])
    (OUT / "stops.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": out}, ensure_ascii=False, separators=(",", ":")))
    print(f"stops.geojson: {len(out)} Haltestellen", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
