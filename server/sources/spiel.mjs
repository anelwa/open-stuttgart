// Stadtspiel „Kesselcode“: öffentliche Routendaten und Antwortprüfung.
//
// Die redaktionellen Daten liegen in server/data/spiel/routen.json. Antworten und
// Aliase werden nie an den Browser ausgeliefert; die Prüfung ist zustandslos und
// speichert weder Person noch Fortschritt. Der Fortschritt lebt im localStorage
// der Spielerinnen und Spieler.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(new URL('../data/spiel/routen.json', import.meta.url));

let raw = null;
let rawAt = null;

function read() {
  if (raw) return raw;
  raw = JSON.parse(readFileSync(FILE, 'utf8'));
  rawAt = statSync(FILE).mtime.toISOString();
  return raw;
}

const norm = (value) => String(value ?? '')
  .toLocaleLowerCase('de-DE')
  .replace(/ä/g, 'ae')
  .replace(/ö/g, 'oe')
  .replace(/ü/g, 'ue')
  .replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '')
  .trim();

const numberIn = (value) => {
  const m = String(value ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

const summary = (r) => ({
  id: r.id,
  chapter: r.chapter,
  title: r.title,
  subtitle: r.subtitle,
  description: r.description,
  difficulty: r.difficulty,
  durationMin: r.durationMin,
  distanceKm: r.distanceKm,
  ascentM: r.ascentM,
  color: r.color,
  start: r.start,
  end: r.end,
  season: r.season,
  access: r.access,
  accessibility: r.accessibility,
  safety: r.safety,
  stationCount: r.stations.length,
  mainCount: r.stations.filter((s) => s.kind === 'main').length,
  bonusCount: r.stations.filter((s) => s.kind === 'bonus').length,
  wordLength: [...r.word].length,
});

const publicStation = (s) => {
  const { answer, aliases, ...rest } = s;
  return {
    ...rest,
    answerType: answer.type,
    ...(answer.type === 'live' ? { live: answer.value } : {}),
  };
};

const publicRoute = (r) => {
  const { word, stations, ...rest } = r;
  return { ...summary(r), stations: stations.map(publicStation) };
};

export function spielRouten() {
  const data = read();
  return {
    routes: data.routes.map(summary),
    stand: data.stand ?? null,
    source: data.source ?? null,
    license: data.license ?? null,
    updated: rawAt,
    hinweis:
      'Die Routen sind kuratierte Spaziergänge, keine Navigation. Antworten werden serverseitig geprüft; der Fortschritt bleibt lokal. Koordinaten aus OpenStreetMap (ODbL), Fakten mit Quelle je Station.',
  };
}

export function spielRoute(id) {
  const r = read().routes.find((x) => x.id === id);
  if (!r) throw Object.assign(new Error('Spielroute nicht gefunden'), { status: 404 });
  return { route: publicRoute(r), updated: rawAt };
}

export function spielPruefen({ routeId, stationId, answer } = {}) {
  const route = read().routes.find((r) => r.id === routeId);
  if (!route) throw Object.assign(new Error('Spielroute nicht gefunden'), { status: 404 });
  const station = route.stations.find((s) => s.id === stationId);
  if (!station) throw Object.assign(new Error('Station nicht gefunden'), { status: 404 });
  if (station.answer.type === 'live') {
    return { correct: null, live: station.answer.value, stationId, note: 'Live-Aufgabe: wird im Browser geprüft.' };
  }
  if (station.answer.type === 'number') {
    const value = numberIn(answer);
    const tolerance = Number(station.answer.tolerance ?? 0);
    return {
      correct: Number.isFinite(value) && Math.abs(value - station.answer.value) <= tolerance,
      value: Number.isFinite(value) ? value : null,
      stationId,
    };
  }
  const input = norm(answer);
  const accepted = [station.answer.value, ...(station.aliases ?? [])].map(norm).filter(Boolean);
  return {
    correct: accepted.some((a) =>
      a === input
      || (input.length >= 3 && input.includes(a))
      || (a.length >= 4 && input.length >= 4 && a.includes(input)),
    ),
    stationId,
  };
}

export function spielAbschluss({ routeId, word } = {}) {
  const route = read().routes.find((r) => r.id === routeId);
  if (!route) throw Object.assign(new Error('Spielroute nicht gefunden'), { status: 404 });
  return { correct: norm(word) === norm(route.word), routeId };
}
