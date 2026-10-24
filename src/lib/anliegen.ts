import type { OverlayKey } from '../map/overlays';

/**
 * Ein Anliegen ist das, was Menschen tun wollen — nicht die Datenquelle, die es liefert.
 *
 * Die bisherige Themenstruktur sortierte nach Datenkategorien („Mobilität", „Umwelt").
 * Ein Anliegen bündelt stattdessen die Abschnitte, die zu einer echten Aufgabe gehören,
 * und legt eine Primäraktion fest. Die Module bleiben als Datenlieferanten erhalten;
 * `focus` entscheidet, welche Abschnitte im Panel zuerst offen sind.
 */
export interface Anliegen {
  id: string;
  label: string;
  /** Kurzform für die Pills über der Karte — dort ist Platz knapp */
  short: string;
  /** Kurzbeschreibung unter dem Titel — beantwortet „Ist das mein Anliegen?" */
  hint: string;
  icon: string;
  /** Modul, dessen Panel die Inhalte liefert */
  module: string;
  /** Modulinterne Kennung für die Reihenfolge und Sichtbarkeit der Abschnitte */
  focus: string;
  /** Ebenen, die beim Öffnen sinnvoll sind */
  layers: OverlayKey[];
  /** Primäraktion — der eine nächste Schritt */
  primary: string;
}

export const ANLIEGEN: Anliegen[] = [
  {
    id: 'anreise',
    short: 'Anreise',
    label: 'Anreise & Umstieg',
    hint: 'Verbindung, Abfahrten, Umstieg am Hauptbahnhof',
    icon: 'route',
    module: 'route',
    focus: 'route',
    layers: ['network', 'stops', 'vehicles'],
    primary: 'Verbindung suchen',
  },
  {
    id: 'parken',
    short: 'Parken & Rad',
    label: 'Parken & Rad',
    hint: 'Parkhäuser, Park+Ride, Fahrrad, Sharing',
    icon: 'parking',
    module: 'mobility',
    focus: 'parken',
    layers: ['parking', 'bike', 'sharing'],
    primary: 'Freie Plätze ansehen',
  },
  {
    id: 'verkehr',
    short: 'Verkehr',
    label: 'Verkehr & Bahn',
    hint: 'Baustellen, Sperrungen, Verspätung, Bahn am Hauptbahnhof',
    icon: 'cone',
    module: 'mobility',
    focus: 'verkehr',
    layers: ['roadworks', 'traffic', 'unfall', 'network'],
    primary: 'Lage auf der Karte',
  },
  {
    id: 'amt',
    short: 'Service',
    label: 'Amt & Service',
    hint: 'Leistungen, Bürgerbüros, Abfuhrtermine, Zuständigkeit',
    icon: 'home',
    module: 'verwaltung',
    focus: 'leistung',
    layers: ['nearby', 'live'],
    primary: 'Zuständige Stelle finden',
  },
  {
    id: 'freizeit',
    short: 'Freizeit',
    label: 'Freizeit & Kultur',
    hint: 'Termine, Sehenswürdigkeiten, Aussichtspunkte, Natur',
    icon: 'ticket',
    module: 'wasgeht',
    focus: 'freizeit',
    layers: ['events', 'places', 'hike'],
    primary: 'Was geht heute',
  },
  {
    id: 'ausgehen',
    short: 'Ausgehen',
    label: 'Ausgehen & Bar-Touren',
    hint: 'Sieben kuratierte Touren durch Bars, Wein und Clubs',
    icon: 'cocktail',
    module: 'bartouren',
    focus: 'touren',
    layers: ['bartouren'],
    primary: 'Tour wählen',
  },
  {
    id: 'umland',
    short: 'Umland',
    label: 'Ausflüge ins Umland',
    hint: 'Schlösser, Seen, Altstädte und Natur in der Region Stuttgart',
    icon: 'tree',
    module: 'umland',
    focus: 'ziele',
    layers: ['umland'],
    primary: 'Ausflugsziel wählen',
  },
  {
    id: 'spiel',
    short: 'Stadtspiel',
    label: 'Stadtspiel & Schnitzeljagd',
    hint: 'Fünf Routen durch Stuttgart, Antworten vor Ort, ein Routenbuch',
    icon: 'compass',
    module: 'spiel',
    focus: 'routen',
    layers: ['spiel'],
    primary: 'Route wählen',
  },
  {
    id: 'wetter',
    short: 'Wetter & Luft',
    label: 'Wetter & Luft',
    hint: 'Wetter, Regenradar, Luftqualität, Hitze, Wasserstände',
    icon: 'leaf',
    module: 'environment',
    focus: 'wetter',
    layers: ['air', 'radar', 'warnung', 'water'],
    primary: 'Jetzt ansehen',
  },
  {
    id: 'wissen',
    short: 'Stadtwissen',
    label: 'Stadtwissen & Transparenz',
    hint: 'Stadt-Layer, amtliche Statistik, IFG-Anfragen, Fairteiler, Arten, Feeds',
    icon: 'layers',
    module: 'wissen',
    focus: 'karte',
    layers: [],
    primary: 'Layer und Quellen öffnen',
  },
];

/** Themenreiter als Rückfall, damit kein Inhalt unerreichbar wird. */
export const ALLE_THEMEN = [
  { id: 'nearby', label: 'Nähe', icon: 'pin', hint: 'Einrichtungen, Bäder, Mensen, Geocaching' },
  { id: 'verwaltung', label: 'Verwaltung', icon: 'home', hint: 'Leistungen, Dienststellen, Gebäude' },
  { id: 'route', label: 'Weg', icon: 'route', hint: 'Fuß, Rad, ÖPNV, Auto, Wanderwege' },
  { id: 'mobility', label: 'Mobilität', icon: 'mobility', hint: 'Haltestellen, Parken, Baustellen, Bahn' },
  { id: 'environment', label: 'Umwelt', icon: 'leaf', hint: 'Wetter, Luft, Radar, Neckar, Hitze' },
  { id: 'culture', label: 'Kultur', icon: 'culture', hint: 'Veranstaltungen, Sehenswürdigkeiten' },
  { id: 'wasgeht', label: 'Was geht', icon: 'ticket', hint: 'Termine heute Abend, Neu in der Stadt' },
  { id: 'bartouren', label: 'Bar-Touren', icon: 'cocktail', hint: 'Sieben Touren durch Bars, Wein und Clubs' },
  { id: 'umland', label: 'Umland', icon: 'tree', hint: 'Ausflugsziele in der Region Stuttgart' },
  { id: 'spiel', label: 'Stadtspiel', icon: 'compass', hint: 'Fünf Routen, Antworten vor Ort, ein Routenbuch' },
  { id: 'sun', label: 'Sonne', icon: 'sunset', hint: 'Verschattung, Höhenlagen, Aussicht' },
  { id: 'wissen', label: 'Stadtwissen', icon: 'layers', hint: 'WFS-Layer, Statistik, Transparenz, Feeds, Standards' },
];
