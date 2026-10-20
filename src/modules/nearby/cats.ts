import type { Facility } from '../../lib/types';

export interface FacilitiesResponse { cat: string; label: string; items: Facility[]; source: string }

/** Kategorien der Nähe-Suche, gruppiert; Schlüssel wie in server/sources/nearby.mjs */
export const CAT_GROUPS: { label: string; cats: { id: string; label: string }[] }[] = [
  { label: 'Familie und Bildung', cats: [{ id: 'spielplatz', label: 'Spielplätze' }, { id: 'kita', label: 'Kitas' }, { id: 'grundschule', label: 'Grundschulen' }, { id: 'gymnasium', label: 'Gymnasien' }, { id: 'bibliothek', label: 'Bibliotheken' }] },
  { label: 'Essen und Trinken', cats: [{ id: 'essen_restaurant', label: 'Restaurants' }, { id: 'essen_cafe', label: 'Cafés' }, { id: 'essen_imbiss', label: 'Imbisse' }, { id: 'essen_kneipe', label: 'Kneipen und Bars' }, { id: 'essen_biergarten', label: 'Biergärten' }, { id: 'essen_eis', label: 'Eiscafés' }] },
  { label: 'Verwaltung', cats: [{ id: 'buergerbuero', label: 'Bürgerbüros' }, { id: 'wahllokal', label: 'Wahllokale' }] },
  { label: 'Unterwegs', cats: [{ id: 'toilette', label: 'Toiletten' }, { id: 'trinkbrunnen', label: 'Trinkbrunnen' }, { id: 'kuehl', label: 'Kühle Orte' }, { id: 'reparatur', label: 'Rad-Reparatur' }] },
  { label: 'Freizeit', cats: [{ id: 'bad', label: 'Bäder' }, { id: 'sport', label: 'Sport im Park' }, { id: 'grillplatz', label: 'Grillplätze' }, { id: 'staeffele', label: 'Stäffele' }] },
  { label: 'Abfall', cats: [{ id: 'wertstoffhof', label: 'Wertstoffhöfe' }, { id: 'altglas', label: 'Altglas' }, { id: 'altkleider', label: 'Altkleider' }] },
  { label: 'Notfall und Sicherheit', cats: [{ id: 'klinik', label: 'Kliniken' }, { id: 'polizei', label: 'Polizei' }, { id: 'notfall', label: 'Notfall-Treffpunkte' }] },
];

export const CAT_LABEL: Record<string, string> = Object.fromEntries([...CAT_GROUPS.flatMap((g) => g.cats.map((c) => [c.id, c.label])), ['laden', 'Ladepunkte']]);

export const CAT_COLOR: Record<string, string> = {
  spielplatz: '#2F8F5B', kita: '#E07A1F', grundschule: '#B85C00', gymnasium: '#8A4B08', bibliothek: '#6D4AA8',
  buergerbuero: '#26262C', wahllokal: '#5D5C62',
  toilette: '#2C6FB7', trinkbrunnen: '#1E9BD7', kuehl: '#0E7C86', reparatur: '#4E7D2E',
  bad: '#1E6FD9', sport: '#3C9A3C', grillplatz: '#C8102E', staeffele: '#8A6440',
  wertstoffhof: '#5F7A2A', altglas: '#2E8B57', altkleider: '#7B5EA7',
  klinik: '#C8102E', polizei: '#1F4E9C', notfall: '#D35400', laden: '#00897B',
  essen_restaurant: '#A0522D', essen_cafe: '#8D6E63', essen_imbiss: '#D2691E', essen_kneipe: '#6A1B9A', essen_biergarten: '#558B2F', essen_eis: '#EC407A',
};
