import type { Facility } from '../../lib/types';

export interface FacilitiesResponse { cat: string; label: string; items: Facility[]; source: string }

/** Kategorien der Nähe-Suche, gruppiert; Schlüssel wie in server/sources/nearby.mjs */
export const CAT_GROUPS: { label: string; cats: { id: string; label: string }[] }[] = [
  { label: 'Familie und Bildung', cats: [
    { id: 'spielplatz', label: 'Spielplätze' }, { id: 'kita', label: 'Kitas' },
    { id: 'grundschule', label: 'Grundschulen' }, { id: 'gymnasium', label: 'Gymnasien' },
    { id: 'realschule', label: 'Realschulen' }, { id: 'werkrealschule', label: 'Werkrealschulen' },
    { id: 'gemeinschaftsschule', label: 'Gemeinschaftsschulen' }, { id: 'foerderschule', label: 'Förderschulen' },
    { id: 'berufsschule', label: 'Berufsschulen' }, { id: 'hochschule', label: 'Hochschulen' },
    { id: 'vhs', label: 'Volkshochschulen' }, { id: 'sonstige_bildung', label: 'Sonstige Bildung' },
    { id: 'bibliothek', label: 'Bibliotheken' }, { id: 'ferienprogramm', label: 'Ferienprogramm' },
    { id: 'digitale_teilhabe', label: 'Digitale Teilhabe' },
  ] },
  { label: 'Essen und Trinken', cats: [{ id: 'essen_restaurant', label: 'Restaurants' }, { id: 'essen_cafe', label: 'Cafés' }, { id: 'essen_imbiss', label: 'Imbisse' }, { id: 'essen_kneipe', label: 'Kneipen und Bars' }, { id: 'essen_biergarten', label: 'Biergärten' }, { id: 'essen_eis', label: 'Eiscafés' }, { id: 'hofladen', label: 'Hofläden' }] },
  { label: 'Einkaufen und Geld', cats: [
    { id: 'supermarkt', label: 'Supermärkte' }, { id: 'baeckerei', label: 'Bäckereien' },
    { id: 'kiosk', label: 'Kioske und Convenience' }, { id: 'metzgerei', label: 'Metzgereien' },
    { id: 'obst_gemuese', label: 'Obst und Gemüse' }, { id: 'tabak', label: 'Tabakläden' },
    { id: 'hofladen_osm', label: 'Hofläden (OSM)' }, { id: 'geschaeft', label: 'Alle Geschäfte' },
    { id: 'bank', label: 'Banken' }, { id: 'geldautomat', label: 'Geldautomaten' },
    { id: 'zigarettenautomat', label: 'Zigarettenautomaten' },
  ] },
  { label: 'Verwaltung', cats: [{ id: 'buergerbuero', label: 'Bürgerbüros' }, { id: 'wahllokal', label: 'Wahllokale' }] },
  { label: 'Unterwegs', cats: [{ id: 'toilette', label: 'Toiletten' }, { id: 'trinkbrunnen', label: 'Trinkbrunnen' }, { id: 'mineralbrunnen', label: 'Mineralquellen' }, { id: 'kuehl', label: 'Kühle Orte' }, { id: 'reparatur', label: 'Rad-Reparatur' }, { id: 'fahrradgarage', label: 'Rad-Abstellanlagen' }, { id: 'scooter_zone', label: 'Scooter-Abstellzonen' }, { id: 'behindertenparkplatz', label: 'Behindertenparkplätze' }] },
  { label: 'Freizeit', cats: [{ id: 'bad', label: 'Bäder' }, { id: 'sport', label: 'Sport im Park' }, { id: 'grillplatz', label: 'Grillplätze' }, { id: 'staeffele', label: 'Stäffele' }, { id: 'chillorte', label: 'Jugend-Chillorte' }, { id: 'obstgehoelze', label: 'Obst- und Nussbäume' }, { id: 'minigolf', label: 'Minigolf' }, { id: 'kunst', label: 'Kunst' }, { id: 'musik', label: 'Musik' }, { id: 'theater', label: 'Theater' }, { id: 'kino', label: 'Kinos' }] },
  { label: 'Vereine und Engagement', cats: [{ id: 'verein_sport', label: 'Sportvereine und -anlagen' }, { id: 'verein_kultur', label: 'Kultur und Musik' }, { id: 'verein_stadtteil', label: 'Stadtteil und Jugend' }, { id: 'verein_natur', label: 'Natur und Wald' }] },
  { label: 'Abfall und Mehrweg', cats: [{ id: 'wertstoffhof', label: 'Wertstoffhöfe' }, { id: 'altglas', label: 'Altglas' }, { id: 'altkleider', label: 'Altkleider' }, { id: 'umweltmobil', label: 'Schadstoffmobil' }, { id: 'gruengut', label: 'Grüngutannahme' }, { id: 'recup', label: 'Mehrweg (RECUP)' }] },
  { label: 'Notfall und Sicherheit', cats: [{ id: 'klinik', label: 'Kliniken' }, { id: 'polizei', label: 'Polizeireviere' }, { id: 'notfall', label: 'Notfall-Treffpunkte' }, { id: 'defibrillator', label: 'Defibrillatoren (AED)' }, { id: 'gutefee', label: 'Aktion Gute Fee' }] },
  { label: 'Versorgung und Alltag', cats: [
    { id: 'paketstation', label: 'Paketstationen' }, { id: 'briefkasten', label: 'Briefkästen' },
    { id: 'buecherschrank', label: 'Bücherschränke' }, { id: 'waschsalon', label: 'Waschsalons' },
    { id: 'hundepark', label: 'Hundeparks' }, { id: 'wickeltisch', label: 'Toiletten mit Wickeltisch' },
    { id: 'soziales', label: 'Tafeln und Sozialkaufhäuser' },
  ] },
];

export const CAT_LABEL: Record<string, string> = Object.fromEntries([...CAT_GROUPS.flatMap((g) => g.cats.map((c) => [c.id, c.label])), ['laden', 'Ladepunkte'], ['tanken', 'Tankstellen']]);

export const CAT_COLOR: Record<string, string> = {
  spielplatz: '#2F8F5B', kita: '#E07A1F', grundschule: '#B85C00', gymnasium: '#8A4B08',
  realschule: '#A15C18', werkrealschule: '#8F5A00', gemeinschaftsschule: '#7A4A00',
  foerderschule: '#6B4F2A', berufsschule: '#8C3B00', hochschule: '#1B7F3B',
  vhs: '#00695C', sonstige_bildung: '#5D6D7E', bibliothek: '#6D4AA8',
  buergerbuero: '#26262C', wahllokal: '#5D5C62',
  verwaltung: '#1E3A5F', verwaltung_buergerbuero: '#26262C', verwaltung_amt: '#1E3A5F', verwaltung_bezirksamt: '#2E5B88',
  verwaltung_schule_bildung: '#B85C00', verwaltung_beratung_soziales: '#0E7C86', verwaltung_sonstige: '#6B7280',
  toilette: '#2C6FB7', trinkbrunnen: '#1E9BD7', mineralbrunnen: '#0277BD', kuehl: '#0E7C86', reparatur: '#4E7D2E',
  fahrradgarage: '#2E7D32', scooter_zone: '#5C6BC0', behindertenparkplatz: '#1565C0',
  bad: '#1E6FD9', sport: '#3C9A3C', grillplatz: '#C8102E', staeffele: '#8A6440', chillorte: '#7B1FA2', obstgehoelze: '#6B8E23',
  minigolf: '#2E7D32', kunst: '#AD1457', musik: '#6A1B9A', theater: '#A0522D', kino: '#283593', ferienprogramm: '#EF6C00', digitale_teilhabe: '#00838F',
  verein_sport: '#2E7D32', verein_kultur: '#6A1B9A', verein_stadtteil: '#B85C00', verein_natur: '#558B2F',
  wertstoffhof: '#5F7A2A', altglas: '#2E8B57', altkleider: '#7B5EA7', umweltmobil: '#BF360C', gruengut: '#33691E', recup: '#00796B',
  klinik: '#C8102E', polizei: '#1F4E9C', notfall: '#D35400', gutefee: '#B85C00', laden: '#00897B',
  essen_restaurant: '#A0522D', essen_cafe: '#8D6E63', essen_imbiss: '#D2691E', essen_kneipe: '#6A1B9A', essen_biergarten: '#558B2F', essen_eis: '#EC407A', hofladen: '#558B2F',
  supermarkt: '#C62828', baeckerei: '#B8860B', kiosk: '#EF6C00', metzgerei: '#8E2A2A', obst_gemuese: '#558B2F',
  tabak: '#6D4C41', hofladen_osm: '#33691E', geschaeft: '#546E7A',
  bank: '#1E3A5F', geldautomat: '#00838F', zigarettenautomat: '#5D4037',
  defibrillator: '#C8102E', paketstation: '#B8860B', briefkasten: '#D32F2F', buecherschrank: '#6A1B9A',
  waschsalon: '#0288D1', hundepark: '#558B2F', wickeltisch: '#EC407A', tanken: '#D97706', soziales: '#8E24AA',
};

