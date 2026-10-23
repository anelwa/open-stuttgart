// Sprachwahl Deutsch/Englisch für Bedienelemente, Überschriften und die Grundsätze.
// Inhalte der Quellen (Termintexte, Haltestellennamen, Hinweise der Verkehrsunternehmen) bleiben in der Originalsprache.
// Weitere Sprachen: Wörterbuch ergänzen und in LANGS eintragen.
import { useSyncExternalStore } from 'react';

export type Lang = 'de' | 'en';
export const LANGS: { id: Lang; label: string }[] = [{ id: 'de', label: 'Deutsch' }, { id: 'en', label: 'English' }];

const EN: Record<string, string> = {
  // Kopf und Bereiche
  'Offene Daten der Landeshauptstadt auf einer Karte': 'Open data of the City of Stuttgart on one map',
  'Haltestelle suchen': 'Search stop', Weg: 'Route', Verbindungen: 'Connections', Verlauf: 'Itinerary', 'Weg öffnen in': 'Open route in', Nähe: 'Nearby', Mobilität: 'Mobility', Umwelt: 'Environment', Kultur: 'Culture', Sonne: 'Sun', 'Was geht': "What's on",
  'Bar-Touren': 'Bar tours', Ausgehen: 'Going out', 'Ausgehen & Bar-Touren': 'Going out & bar tours',
  Alle: 'All', Touren: 'Tours', Klassisch: 'Classic', Cocktails: 'Cocktails', Wein: 'Wine', Wohnzimmer: 'Living room', Draußen: 'Outdoors', Clubs: 'Clubs',
  'Für wen': 'For whom', 'Beste Zeit': 'Best time', Budget: 'Budget', Reservierung: 'Reservation', Regen: 'Rain', Heimweg: 'Getting home',
  Dramaturgie: 'Dramaturgy', 'Varianten und Hinweise': 'Variants and notes', 'Auf der Karte zeigen': 'Show on map',
  'GPX der Stationen': 'GPX of stops', 'GPX der Tour': 'GPX of tour', 'Nächster Stopp': 'Next stop', 'Nächste Haltestelle': 'Nearest stop',
  Aufenthalt: 'Stay', Bestellung: 'Order', Öffnungszeiten: 'Opening hours',
  'Zum Inhalt springen': 'Skip to content',
  // Über die Anwendung
  Grundsätze: 'Principles', 'Wie entstehen die Werte?': 'How values are produced', 'Offene Daten': 'Open data', 'Daten der Stadt': 'City data',
  Barrierefreiheit: 'Accessibility', 'Leichte Sprache': 'Easy German', 'Über Open Stuttgart': 'About Open Stuttgart',
  // Überschriften
  Abfuhrtermine: 'Waste collection', Anreise: 'Getting there', 'Auf der Karte': 'On the map', 'Aussichtspunkte und Höhenlagen': 'Viewpoints and hillsides',
  Aussichtspunkte: 'Viewpoints', Baustellen: 'Roadworks', 'Bäder, aktuelle Besucherzahl': 'Swimming pools, current visitors',
  'Bürgerbüros, aktuelle Wartezeit': 'Citizen offices, current waiting time', 'Einrichtungen der gewählten Kategorie': 'Facilities of the selected category',
  'Einrichtungen in der Nähe': 'Facilities nearby', 'Gesundheit, Hitze und Stromnetz': 'Health, heat and power grid', 'Haltestelle wählen': 'Choose a stop',
  Haltestellen: 'Stops', Hauptradrouten: 'Main cycle routes', 'In Gehweite': 'Within walking distance', 'Ladepunkte im Umkreis von 1 km': 'Charging points within 1 km',
  'Live-Zustände der Stadt': 'Live status of city facilities', 'Luftaustausch im Talkessel': 'Air exchange in the valley basin', Luftbilder: 'Aerial images',
  Luftmessstellen: 'Air monitoring stations', Luftqualität: 'Air quality', Neckar: 'Neckar river', 'Niederschlagsradar': 'Precipitation radar', Parkhäuser: 'Car parks',
  'Parkhäuser, aktuelle Belegung': 'Car parks, current occupancy', 'Planung und Beteiligung': 'Planning and participation', Rückfahrt: 'Return trip',
  'Sehenswürdigkeiten in der Umgebung': 'Sights nearby', Sehenswürdigkeiten: 'Sights', Sharing: 'Sharing', 'Stadtbahn und S-Bahn': 'Light rail and S-Bahn',
  Veranstaltungen: 'Events', 'Verschattung durch das Gelände': 'Terrain shading', Vorsorge: 'Preparedness', 'Weitere Veranstaltungen am selben Ort': 'More events at this venue',
  'Wetter, aktuelle Messung': 'Weather, current measurement', 'Zuständig für diesen Ort': 'Responsible for this location', Alternativen: 'Alternatives',
  'Verbindung suchen': 'Find a connection', Bezugspunkt: 'Reference point', 'Eigener Standort': 'My location',
  'Kartenmitte verwenden': 'Use map centre', 'Angaben für die Kartenmitte': 'Details for map centre',
  // Kategorien
  'Familie und Bildung': 'Family and education', Verwaltung: 'Administration', Unterwegs: 'On the go', Freizeit: 'Leisure', Abfall: 'Waste',
  'Notfall und Sicherheit': 'Emergency and safety', 'Essen und Trinken': 'Food and drink', Spielplätze: 'Playgrounds', Kitas: 'Day care', Grundschulen: 'Primary schools',
  'Einkaufen und Geld': 'Shopping and money', Supermärkte: 'Supermarkets', Bäckereien: 'Bakeries', 'Kioske und Convenience': 'Kiosks and convenience stores',
  Metzgereien: 'Butchers', 'Obst und Gemüse': 'Fruit and vegetables', Tabakläden: 'Tobacco shops', 'Hofläden (OSM)': 'Farm shops (OSM)',
  'Alle Geschäfte': 'All shops', Banken: 'Banks', Geldautomaten: 'Cash machines', Zigarettenautomaten: 'Cigarette machines', Hofläden: 'Farm shops',
  'Versorgung und Alltag': 'Everyday services', Paketstationen: 'Parcel lockers', Briefkästen: 'Post boxes', Bücherschränke: 'Public bookcases',
  Waschsalons: 'Laundrettes', Hundeparks: 'Dog parks', 'Toiletten mit Wickeltisch': 'Toilets with changing table',
  'Tafeln und Sozialkaufhäuser': 'Food banks and charity shops',
  Defibrillatoren: 'Defibrillators (AED)', 'Defibrillatoren (AED)': 'Defibrillators (AED)', Tanken: 'Fuel', Tankstellen: 'Petrol stations',
  'Günstigste zuerst': 'Cheapest first', 'Nächste zuerst': 'Nearest first', 'Preise aktualisieren': 'Refresh prices',
  'Günstigste Tankstelle auf der Route': 'Cheapest petrol station on the route',
  'Tankpreise derzeit nicht abrufbar.': 'Fuel prices are currently unavailable.',
  'Derzeit sind keine Tankstellen mit Preisen gemeldet.': 'No petrol stations with prices are currently reported.',
  'Tankstellen auf der Karte': 'Petrol stations on the map',
  Gymnasien: 'Grammar schools', Realschulen: 'Secondary modern schools', Werkrealschulen: 'Basic secondary schools',
  Gemeinschaftsschulen: 'Community schools', Förderschulen: 'Special needs schools', Berufsschulen: 'Vocational schools',
  Hochschulen: 'Universities and colleges', Volkshochschulen: 'Adult education centres', 'Sonstige Bildung': 'Other education providers',
  Bibliotheken: 'Libraries', Bürgerbüros: 'Citizen offices', Wahllokale: 'Polling stations', Toiletten: 'Toilets',
  Trinkbrunnen: 'Drinking fountains', 'Kühle Orte': 'Cool places', 'Rad-Reparatur': 'Bike repair', Bäder: 'Swimming pools', 'Sport im Park': 'Sport in the park',
  Grillplätze: 'Barbecue areas', Stäffele: 'Public stairways', Wertstoffhöfe: 'Recycling centres', Altglas: 'Glass recycling', Altkleider: 'Clothes recycling',
  Kliniken: 'Hospitals', Polizei: 'Police', 'Notfall-Treffpunkte': 'Emergency meeting points', Restaurants: 'Restaurants', Cafés: 'Cafés', Imbisse: 'Snack bars',
  'Kneipen und Bars': 'Pubs and bars', Biergärten: 'Beer gardens', Eiscafés: 'Ice cream', 'Jetzt geöffnet': 'Open now', 'Stufenlos zugänglich': 'Step-free',
  'Aktion Gute Fee': 'Safe places for children (Gute Fee)', 'Obst- und Nussbäume': 'Fruit and nut trees', 'Jugend-Chillorte': 'Youth hangouts',
  'Essbare Stadt: Obst- und Nussbäume': 'Edible city: fruit and nut trees', 'Mineralquellen': 'Mineral springs', 'Mehrweg (RECUP)': 'Reusable cups (RECUP)',
  // Natur, Flugverkehr, Mensen, Grünstrom
  'Himmel über Stuttgart': 'Skies over Stuttgart', 'Abendspaziergang in der kühlen Brise': 'Evening stroll in the cool breeze',
  'Stadt-Natur in der Nähe': 'Urban nature nearby', 'Stadt-Natur hier': 'Urban nature here',
  'Pollen-Hotspots aus dem Baumkataster': 'Pollen hotspots from the tree register', 'Gieß-Radar für junge Bäume': 'Watering radar for young trees',
  'Unterwegs am Abend': 'Out and about in the evening', 'Mensen und Hochschulgastronomie': 'University canteens',
  'Warngebiete (NINA / MoWaS)': 'Warning areas (NINA / MoWaS)', 'Flugverkehr (ADS-B)': 'Air traffic (ADS-B)',
  'Kaltluftabfluss (Klimaatlas)': 'Cold air flow (climate atlas)', 'Wohnlage & Satzung': 'Housing area & ordinances',
};

const KEY = 'os-sprache';
let lang: Lang = (() => { try { return (localStorage.getItem(KEY) as Lang) || 'de'; } catch { return 'de'; } })();
const subs = new Set<() => void>();
const apply = () => { document.documentElement.lang = lang; };
apply();

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* egal */ }
  apply();
  subs.forEach((f) => f());
}
export const useLang = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => lang);

/** Übersetzt einen festen deutschen Text der Oberfläche; unbekannte Texte bleiben deutsch. */
export function tr(de: string, l: Lang = lang): string {
  return l === 'en' ? EN[de] ?? de : de;
}
