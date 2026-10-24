export interface Departure {
  line: string;
  kind: 'zug' | 'sbahn' | 'stadtbahn' | 'zahnrad' | 'bus' | 'rufbus';
  destination: string;
  planned: string;
  estimated: string | null;
  delayMin: number | null;
  realtime: boolean;
  cancelled: boolean;
  platform: string | null;
  notes: string[];
  trip?: { line: string; stop: string; tripCode: number; planned: string } | null;
}

export interface DeparturesResponse {
  stop: { id: string; name: string; fullName?: string };
  departures: Departure[];
  /** false, wenn EFA-BW für keine Abfahrt Ist-Zeiten liefert */
  realtimeAvailable?: boolean | null;
  /** Anzahl Abfahrten mit Verspätung aus dem Ersatzfeed (gtfs.de), wenn EFA-BW keine Ist-Zeiten liefert */
  ersatzEchtzeit?: number;
  fetchedAt: string;
}

export interface ParkingSite {
  id: number;
  name: string;
  address: string;
  operator: string;
  type: string;
  lat: number;
  lon: number;
  capacity: number | null;
  free: number | null;
  live: boolean;
  status: string | null;
  updatedAt: string | null;
  fee: string | null;
  maxHeight: number | null;
  openingHours: string | null;
  url: string | null;
  restrictions: { type: string; capacity: number }[];
}

export interface SharingItem {
  id: string;
  system: string;
  kind: 'car' | 'bike' | 'scooter';
  station: boolean;
  name?: string;
  lat: number;
  lon: number;
  available?: number;
  capacity?: number | null;
  range?: number | null;
}

export interface SharingResponse {
  items: SharingItem[];
  systems: { id: string; name: string; kind: string; count: number; ok: boolean }[];
  fetchedAt: string;
}

export interface Roadwork {
  id: string;
  street: string;
  where: string;
  from: string | null;
  to: string | null;
  work: string;
  impact: string;
  timing: string;
  status: 'active' | 'planned';
  lat: number;
  lon: number;
  /** Stadtbahn- und S-Bahn-Linien im Umkreis von 30 m */
  lines: { line: string; color: string; text: string }[];
}

export interface AirStation {
  id: string;
  code: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  index: number | null;
  label?: string | null;
  measuredAt: string | null;
  components: { id: number; name: string; value: number; index: number }[];
  history?: { t: string; index: number }[];
}

export interface Weather {
  temperature: number;
  condition: string;
  icon: string;
  humidity: number;
  wind: number;
  windDirection: number;
  gust: number;
  precipitation: number;
  cloud: number;
  pressure: number;
  measuredAt: string;
  station: string;
  visibility: number | null;
  hourly: { t: string; temperature: number; icon: string; precipitation: number; visibility: number | null; cloud: number | null }[];
  forecast: { t: string; temperature: number; icon: string; precipitation: number }[];
  alerts: { headline: string; severity: string; onset: string; expires: string; description: string }[];
}

export interface Water {
  station: string;
  value: number;
  unit: string;
  measuredAt: string;
  state: string;
  series: { t: string; v: number }[];
  lat: number;
  lon: number;
}

export interface StopProps {
  id: string;
  name: string;
  kind: 'sbahn' | 'stadtbahn' | 'zahnrad' | 'bus';
  city: boolean;
  trips: number;
  lines: string[];
}

export type Selection =
  | { type: 'stop'; id: string; name: string; lngLat: [number, number]; lines?: string[] }
  | { type: 'parking'; id: number }
  | { type: 'roadwork'; id: string }
  | { type: 'air'; id: string }
  | { type: 'sharing'; id: string }
  | { type: 'water' }
  | { type: 'event'; id: string }
  | { type: 'facility'; item: Facility }
  | { type: 'place'; id: string }
  | { type: 'verwaltung_gebaeude'; id: string; lngLat?: [number, number] }
  | { type: 'verwaltung_leistung'; url: string; lat?: number; lon?: number }
  | { type: 'wissen'; id: string; layer: string; layerTitle: string; name: string; lngLat: [number, number]; props: Record<string, unknown> }
  | { type: 'bartour-stop'; tourId: string; stopIndex: number; lngLat: [number, number] }
  | { type: 'umland'; id: string; lngLat: [number, number] };

/** Eine kuratierte Bar- oder Drinking-Spot-Tour. */
export interface BartourStop {
  id: string;
  venueId: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lon: number;
  role: 'ankommen' | 'vertiefen' | 'wechseln' | 'saettigen' | 'finale' | string;
  stayMin: number;
  orderIdea: string;
  why: string;
  openingHours: string;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown' | string;
  walkToNextM: number;
  walkToNextMin: number;
  note: string;
  source: string;
  checkedAt: string;
  optional: boolean;
  /** 1-basierte Position in der Tour */
  index: number;
  nearestStops: {
    id: string; name: string; kind: string; lines: string[];
    lat: number; lon: number; dist: number; walkMin: number;
  }[];
}

export interface Bartour {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  themes: string[];
  district: string;
  audience: string;
  durationMin: number;
  distanceM: number;
  priceLevel: string;
  budget: string;
  bestDays: string;
  bestTime: string;
  season: string;
  reservation: string;
  accessibility: string;
  alcoholFree: string;
  weather: string;
  home: string;
  intro: string;
  dramaturgy: string;
  stops: BartourStop[];
  variants: string[];
  notes: string[];
  sources: string[];
  checkedAt: string;
  stopCount: number;
  bbox: [number, number, number, number];
  startStop: BartourStop['nearestStops'][number] | null;
  endStop: BartourStop['nearestStops'][number] | null;
}

export interface BartourenResponse {
  items: Bartour[];
  updated: string | null;
  stand: string | null;
  source: string;
  license: string | null;
  hinweis: string;
}

export interface CultureEvent {
  id: string;
  title: string;
  teaser: string;
  url: string;
  date: string;
  ready: boolean;
  start?: string | null;
  end?: string | null;
  allDay?: boolean;
  location?: string;
  category?: string;
  district?: string | null;
  tags?: string[];
  lat?: number;
  lon?: number;
  venue?: string | null;
  approx?: boolean;
  /** Herkunft; bei zusammengeführten Terminen mehrere Quellen */
  sources?: { name: string; url: string }[];
  free?: boolean | null;
  price?: string | null;
  audience?: string | null;
  status?: 'abgesagt' | 'verschoben' | null;
  /** weitere Beginnzeiten am selben Tag (Führungen, Zeitfenster) */
  times?: string[];
  endEstimated?: boolean;
  /** Quelle nennt keine Uhrzeit */
  noTime?: boolean;
  /** Wie gut der Termin bestätigt ist: Hausseite vor Register/Ticket vor Aggregator. */
  verified?: 'venue' | 'official' | 'ticket' | 'register' | 'aggregator' | null;
  /** Wann die Quelle den Termin zuletzt bestätigt hat. */
  lastSeen?: string | null;
}

export interface EventsResponse {
  date: string;
  days: { date: string; count: number }[];
  events: CultureEvent[];
  pending: number;
  source: string;
}

export type PlaceKind = 'museum' | 'buehne' | 'aussicht' | 'gruen' | 'kirche' | 'denkmal';

export interface Place {
  id: string;
  name: string;
  description: string | null;
  kind: PlaceKind;
  lat: number;
  lon: number;
  image: string | null;
  imagePage: string | null;
  wiki: string | null;
  rank: number;
}

export interface WikiSummary {
  title: string;
  extract: string;
  url: string | null;
  thumbnail: string | null;
}

/** Einrichtung aus der Nähe-Suche (Geoserver der Stadt) */
export interface Facility {
  id: string;
  cat: string;
  name: string;
  lat: number;
  lon: number;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  web?: string | null;
  booking?: string | null;
  hours?: string | null;
  closed?: boolean;
  info?: string[];
  /** zusätzliche Live-Angabe, z. B. Wartezeit oder Auslastung */
  live?: string | null;
  /** Rollstuhlangabe aus OpenStreetMap: yes, limited, no */
  wheelchair?: string | null;
  /** OpenStreetMap-Objekt, z. B. n29283708 */
  osm?: string | null;
  /** Direkter OpenStreetMap-Link, wenn kein Objekttyp bekannt ist (z. B. POI-Bestand) */
  osmUrl?: string | null;
  /** Quellenangabe für die Detailansicht, wenn keine OSM-/Stadt-Zuordnung möglich ist */
  source?: string | null;
  /** Erfasste Ernährungsangabe aus OpenStreetMap (diet:vegan / diet:vegetarian) */
  diet?: 'vegan-only' | 'vegan' | 'vegetarian-only' | 'vegetarian' | null;
}

export interface TrafficItem {
  id: string;
  quelle: string;
  typ: 'Unfall' | 'Stau' | 'Sperrung' | 'Baustelle' | 'Straßenzustand' | 'Veranstaltung' | 'Sonstiges';
  rang: number;
  text: string;
  lat: number;
  lon: number;
  linie: [number, number][] | null;
  geschwindigkeit?: number | null;
  zeitverlust?: number | null;
  seit: string | null;
  bis: string | null;
}

/** Amtliche Warnmeldung (BBK NINA / MoWaS) mit Warngebiets-Polygon und Ausweich-Orten */
export interface NinaWarnung {
  id: string;
  title: string;
  severity: string;
  msgType: string;
  provider: string;
  sent: string | null;
  onset: string | null;
  expires: string | null;
  description: string | null;
  instruction: string | null;
  area: string;
  /** GeoJSON-Koordinaten [lon, lat] des Warngebiets, sofern die Meldung eines ausweist */
  polygon: [number, number][] | null;
  notfall: { treffpunkt: (Facility & { dist: number }) | null; leuchtturm: (Facility & { dist: number }) | null } | null;
}

/** Luftfahrzeug im Umkreis (adsb.lol) */
export interface Flugzeug {
  hex: string;
  callsign: string | null;
  reg: string | null;
  type: string | null;
  lat: number;
  lon: number;
  dist: number;
  altFt: number | null;
  gsKt: number | null;
  track: number | null;
  rate: number | null;
  heli: boolean;
  niedrig: boolean;
  gesehenVor: number | null;
}

export interface Wetterballon {
  id: string;
  type: string | null;
  serial: string;
  lat: number;
  lon: number;
  altM: number | null;
  tempC: number | null;
  velV: number | null;
  heading: number | null;
  distance: number;
  seen: string | null;
}

export interface IssPosition {
  lat: number;
  lon: number;
  altKm: number | null;
  velocityKmh: number | null;
  visibility: string | null;
  footprintKm: number | null;
  distance: number;
  seen: string | null;
}

export interface FlugDaten {
  aircraft: Flugzeug[];
  hubschrauber: Flugzeug[];
  anflug: Flugzeug[];
  sonden?: Wetterballon[];
  iss?: IssPosition | null;
  mond?: { phase: number; illumination: number; name: string };
  edds: {
    metar: string | null;
    gemessen: string | null;
    windDir: number | null;
    windKt: number | null;
    betriebsrichtung: '07' | '25' | null;
    hinweis: string;
  };
  count: number;
  fetchedAt: string;
  source: string;
}

/** Punktgenauer Unfall mit Personenschaden aus dem Unfallatlas (dl-de/by-2-0) */
export interface Unfall {
  id: string;
  lat: number;
  lon: number;
  jahr: number;
  monat: number | null;
  stunde: number | null;
  wochentag: number | null;
  /** 1 = getötet, 2 = schwer verletzt, 3 = leicht verletzt */
  kategorie: 1 | 2 | 3;
  art: number | null;
  typ: number | null;
  licht: number | null;
  rad: boolean;
  fuss: boolean;
  pkw: boolean;
  krad: boolean;
  gkfz: boolean;
  sonstige: boolean;
  plst: number | null;
  dist?: number;
}

export interface UnfallAntwort {
  stand: string;
  items: Unfall[];
  total: number;
  stats: { gesamt: number; tote: number; schwer: number; leicht: number; rad: number; fuss: number; pkw: number };
  schwerpunkte: { lat: number; lon: number; anzahl: number; rad: number; fuss: number; tote: number }[];
  kodierung?: {
    kategorie?: Record<string, string>;
    art?: Record<string, string>;
    licht?: Record<string, string>;
    wochentag?: Record<string, string>;
  };
  hinweis: string;
  source: string;
  url: string;
}

/** Ausgeschilderter Wander-/Rundweg oder Downhill-Strecke aus dem Geoserver der Stadt */
export interface Wanderweg {
  id: string;
  art: 'wein' | 'innenstadt' | 'downhill' | 'osm';
  artLabel: string;
  farbe: string;
  name: string;
  beschreibung: string | null;
  laengeKm: number;
  aufstiegM: number | null;
  abstiegM: number | null;
  start: string | null;
  ziel: string | null;
  startStop: { id: string; name: string; lines: string[]; dist: number; lat: number; lon: number } | null;
  endStop: { id: string; name: string; lines: string[]; dist: number; lat: number; lon: number } | null;
  naechsteHaltestellen: { id: string; name: string; lines: string[]; dist: number; lat: number; lon: number }[];
  brunnen: number;
  toiletten: number;
  geometrie: GeoJSON.Geometry;
  bbox: [number, number, number, number];
}

export interface WanderwegeAntwort {
  items: Wanderweg[];
  brunnen: number;
  toiletten: number;
  fetchedAt: string;
  source: string;
  hinweis: string;
}

/** Kaltluft-Vektor des Klimaatlas (Richtung in Grad, Geschwindigkeit m/s) */
export interface KaltluftPunkt { lon: number; lat: number; ri: number; ge: number | null; vo: number | null }

export interface KaltluftDaten {
  punkte: KaltluftPunkt[];
  anzahl: number;
  fetchedAt: string;
  source: string;
}

/** Kategorie eines Ausflugsziels im Umland. */
export type UmlandKategorie = 'schloss' | 'kloster' | 'museum' | 'stadt' | 'natur' | 'see' | 'wein' | 'therme';

export interface UmlandHaltestelle {
  id: string;
  name: string;
  kind: string;
  lines: string[];
  lat: number;
  lon: number;
  dist: number;
  walkMin: number;
}

/** Ein kuratiertes Ausflugsziel in der Region Stuttgart. */
export interface UmlandZiel {
  id: string;
  name: string;
  kategorie: UmlandKategorie;
  kategorieLabel: string;
  kategorieKurz: string;
  farbe: string;
  icon: string;
  kreis: string;
  kreisLabel: string;
  gemeinde: string;
  lat: number;
  lon: number;
  kurz: string;
  beschreibung: string;
  highlights: string[];
  dauerMin: number;
  preis: string;
  saison: string;
  familie: boolean;
  website: string | null;
  wikipedia: string | null;
  image: string | null;
  imagePage: string | null;
  stand: string;
  quelle: string;
  naechsteHaltestellen: UmlandHaltestelle[];
  naechsteHaltestelle: UmlandHaltestelle | null;
  entfernungM?: number;
  wiki?: WikiSummary | null;
  wetter?: UmlandWetter | null;
  wetterFehler?: string | null;
  source?: string;
  lizenz?: string | null;
  hinweis?: string | null;
}

export interface UmlandKategorieInfo {
  id: string;
  label: string;
  kurz: string;
  farbe: string;
  icon: string;
  anzahl: number;
}

export interface UmlandKreisInfo {
  id: string;
  label: string;
  lat: number;
  lon: number;
  anzahl: number;
}

export interface UmlandAntwort {
  items: UmlandZiel[];
  total: number;
  kategorien: UmlandKategorieInfo[];
  kreise: UmlandKreisInfo[];
  stand: string | null;
  source: string;
  lizenz: string | null;
  hinweis: string | null;
}

export interface UmlandWetter {
  ort: string | null;
  aktuell: {
    t: string | null;
    temperature: number | null;
    apparent: number | null;
    precipitation: number | null;
    wind: number | null;
    code: number | null;
    text: string;
    icon: string;
  } | null;
  tage: {
    date: string;
    code: number | null;
    min: number | null;
    max: number | null;
    regen: number | null;
    text: string;
    icon: string;
  }[];
  fetchedAt: string;
  fresh?: boolean;
  error?: string;
  source: string;
}
