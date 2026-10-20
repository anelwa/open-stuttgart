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
  | { type: 'place'; id: string };

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
