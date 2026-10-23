import wichtige from '../data/kontakte-wichtig.json';

export type KontaktPhone = { label: string; number: string; tel?: string };
export type KontaktHoursRow = { day: string; times: string; note?: string | null };
export type KontaktHoursGroup = { label: string; rows: KontaktHoursRow[] };
export type KontaktService = { name: string; url: string; online: boolean; documentId: number | null };

export type Kontakt = {
  id: string;
  documentId: number | null;
  kind: string;
  kindLabel: string;
  name: string;
  organization: string | null;
  category: string | null;
  description: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  buildingId: string | null;
  phones: KontaktPhone[];
  email: string | null;
  url: string | null;
  booking: string | null;
  hours: KontaktHoursGroup[];
  hoursText: string | null;
  availability: string | null;
  priority: number;
  emergency: boolean;
  source: string;
  sourceUrl: string | null;
  checkedAt: string | null;
  confidence: string;
  services: KontaktService[];
  gruppe?: string;
};

export type KontaktSearchResponse = {
  q: string;
  total: number;
  limit: number;
  offset: number;
  items: Kontakt[];
  gruppen: { id: string; label: string; count: number }[];
  source: string;
  hinweis: string;
};

export type KontaktStats = {
  contacts: number;
  with_phone: number;
  with_email: number;
  with_hours: number;
  services: number;
  stand: string | null;
  builtAt: string | null;
  gruppen: { id: string; label: string; count: number }[];
  source: string;
  hinweis: string;
};

export const KONTAKT_GRUPPEN = [
  { id: 'notfall', label: 'Notfall & Gesundheit' },
  { id: 'aemter', label: 'Ämter & Behörden' },
  { id: 'beratung', label: 'Beratung & Hilfe' },
  { id: 'alltag', label: 'Technik & Tiere' },
];

export const KONTAKT_GRUPPE_KINDS: Record<string, string[]> = {
  notfall: ['notruf', 'notdienst'],
  aemter: ['behoerde', 'buergerbuero', 'dienststelle', 'bildung'],
  beratung: ['beratung'],
  alltag: ['technik', 'tier'],
};

export const KIND_ICON: Record<string, string> = {
  notruf: 'warn',
  notdienst: 'health',
  beratung: 'contact',
  technik: 'home',
  tier: 'leaf',
  behoerde: 'contact',
  buergerbuero: 'contact',
  bildung: 'book',
  dienststelle: 'pin',
};

/** Sofort verfügbar, ohne Netz: die wichtigsten Nummern stehen im App-Bundle. */
export function wichtigeKontakte(): Kontakt[] {
  const items = (wichtige.items ?? []) as unknown as Array<Record<string, unknown>>;
  return items.map((raw) => {
    const phones = (raw.phones as KontaktPhone[] | undefined) ?? [];
    return {
      id: String(raw.id),
      documentId: null,
      kind: String(raw.kind ?? 'notruf'),
      kindLabel: String(raw.category ?? 'Notruf'),
      name: String(raw.name),
      organization: (raw.organization as string | null) ?? null,
      category: (raw.category as string | null) ?? null,
      description: (raw.description as string | null) ?? null,
      street: (raw.street as string | null) ?? null,
      postalCode: (raw.postalCode as string | null) ?? null,
      city: (raw.city as string | null) ?? null,
      district: null,
      address: [raw.street, [raw.postalCode, raw.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
      lat: (raw.lat as number | null) ?? null,
      lon: (raw.lon as number | null) ?? null,
      buildingId: null,
      phones,
      email: null,
      url: (raw.url as string | null) ?? null,
      booking: null,
      hours: [],
      hoursText: null,
      availability: (raw.availability as string | null) ?? null,
      priority: Number(raw.priority) || 0,
      emergency: !!raw.emergency,
      source: String(raw.source ?? 'Open Stuttgart – Kontaktregister'),
      sourceUrl: (raw.sourceUrl as string | null) ?? null,
      checkedAt: (raw.checked as string | null) ?? null,
      confidence: String(raw.confidence ?? 'redaktionell geprüft'),
      services: [],
    };
  }).sort((a, b) => b.priority - a.priority);
}

export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

export function heuteName(): string {
  try {
    return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date());
  } catch {
    return ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'][new Date().getDay()];
  }
}

const RANGE = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/g;

/**
 * „Jetzt geöffnet“ aus den Öffnungszeiten-Zeilen. Bewusst tolerant: Was sich nicht
 * lesen lässt, bleibt als Text stehen; es wird nichts geraten.
 */
export function jetztStatus(hours: KontaktHoursGroup[]): { state: 'offen' | 'geschlossen' | 'pause' | 'unbekannt'; text: string } {
  if (!hours.length) return { state: 'unbekannt', text: '' };
  const day = heuteName();
  const group = hours.find((g) => !/telefon|erreichbarkeit/i.test(g.label)) ?? hours[0];
  const rows = group.rows.filter((r) => r.day.toLowerCase() === day.toLowerCase());
  if (!rows.length) return { state: 'geschlossen', text: `Heute (${day}) geschlossen` };
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const ranges: { from: number; to: number; label: string }[] = [];
  for (const row of rows) {
    if (!row.times) continue;
    for (const m of row.times.matchAll(RANGE)) {
      const from = Number(m[1]) * 60 + Number(m[2]);
      const to = Number(m[3]) * 60 + Number(m[4]);
      ranges.push({ from, to, label: m[0] });
    }
  }
  if (!ranges.length) return { state: 'unbekannt', text: rows.map((r) => r.times).filter(Boolean).join(' · ') };
  const active = ranges.find((r) => minutes >= r.from && minutes < r.to);
  if (active) return { state: 'offen', text: `Jetzt geöffnet bis ${String(Math.floor(active.to / 60)).padStart(2, '0')}:${String(active.to % 60).padStart(2, '0')}` };
  const next = ranges.filter((r) => r.from > minutes).sort((a, b) => a.from - b.from)[0];
  if (next) {
    const time = `${String(Math.floor(next.from / 60)).padStart(2, '0')}:${String(next.from % 60).padStart(2, '0')}`;
    const paused = ranges.some((r) => minutes >= r.to && minutes < next.from);
    return { state: paused ? 'pause' : 'geschlossen', text: paused ? `Pause bis ${time}` : `Heute ab ${time} geöffnet` };
  }
  return { state: 'geschlossen', text: 'Heute geschlossen' };
}

export function standText(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('de-DE');
  } catch {
    return value;
  }
}
