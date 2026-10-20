import type { PlaceKind } from '../../lib/types';

/** Darstellung der Ortsarten: Farbe auf der Karte, Symbol, Bezeichnung. */
export const PLACE_KINDS: Record<PlaceKind, { label: string; plural: string; color: string; icon: string }> = {
  museum: { label: 'Museum', plural: 'Museen', color: '#6D4AA8', icon: 'culture' },
  buehne: { label: 'Bühne', plural: 'Bühnen', color: '#C8102E', icon: 'mask' },
  aussicht: { label: 'Aussicht', plural: 'Aussichtspunkte', color: '#B87900', icon: 'view' },
  gruen: { label: 'Park und Garten', plural: 'Parks und Gärten', color: '#2F8F5B', icon: 'tree' },
  denkmal: { label: 'Denkmal', plural: 'Denkmäler und Bauten', color: '#8A6440', icon: 'monument' },
  kirche: { label: 'Kirche', plural: 'Kirchen', color: '#5D5C62', icon: 'church' },
};

export const PLACE_ORDER: PlaceKind[] = ['museum', 'buehne', 'aussicht', 'gruen', 'denkmal', 'kirche'];

export const EVENT_COLOR = '#FFB300';

import type { CultureEvent } from '../../lib/types';

/** Grobe Gruppen über den feinen Kategorien des Stadtkalenders, für Filter und Tipps. */
export type EventGroup = 'buehne' | 'musik' | 'ausstellung' | 'kinder' | 'wissen' | 'sport' | 'fest' | 'kirche' | 'film' | 'sonst';

export const EVENT_GROUPS: Record<EventGroup, string> = {
  buehne: 'Bühne', musik: 'Musik', ausstellung: 'Ausstellung', kinder: 'Kinder', wissen: 'Vortrag und Bildung',
  sport: 'Sport', fest: 'Feste', kirche: 'Gottesdienst', film: 'Kino', sonst: 'Sonstiges',
};

const RULES: [EventGroup, RegExp][] = [
  ['kinder', /kinder|jugendlich|familie/i],
  ['sport', /sport|fußball|ballsport|lauf|turnier/i],
  ['buehne', /theater|oper|tanz|ballett|kabarett|comedy|variet|musical|zauber|bühne|aufführung/i],
  ['musik', /musik|konzert|jazz|klassik|rock|pop|chor|folk|hip ?hop|ethno|elektro|orgel/i],
  ['film', /kino|film/i],
  ['ausstellung', /ausstellung|galerie|kunst|design|museum|fotografie/i],
  ['kirche', /kirche|gottesdienst|eucharist|andacht|messe$/i],
  ['fest', /fest|festival|markt|event|party/i],
  ['wissen', /bildung|vortrag|lesung|literatur|seminar|workshop|wissenschaft|geschichte|führung|medien|stadtentwicklung|diskussion|technik|beratung/i],
];

export function eventGroup(e: CultureEvent): EventGroup {
  const text = [e.category, ...(e.tags ?? []), e.title].join(' | ');
  for (const [g, re] of RULES) if (re.test(text)) return g;
  return 'sonst';
}

/** Gruppen, die drinnen stattfinden (Tipp bei Regen) */
export const INDOOR: EventGroup[] = ['buehne', 'musik', 'ausstellung', 'film', 'wissen'];
