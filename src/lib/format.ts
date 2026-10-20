const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
const numFmt = new Intl.NumberFormat('de-DE');

export const fmtTime = (iso: string | number) => timeFmt.format(new Date(iso));
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtNum = (n: number) => numFmt.format(n);
export const fmtDec = (n: number, d = 1) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

export function ago(ts: number | string | null, now = Date.now()) {
  if (ts == null) return '';
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'gerade eben';
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} min`;
  const h = Math.round(m / 60);
  return `vor ${h} h`;
}

/** UBA-Zeitstempel sind lokale Zeit (MEZ/MESZ) ohne Zone, Format "2026-10-20 10:00:00". */
export const ubaHour = (s: string) => s.slice(11, 16);

export const WEATHER_LABEL: Record<string, string> = {
  'clear-day': 'Klar', 'clear-night': 'Klar', 'partly-cloudy-day': 'Leicht bewölkt', 'partly-cloudy-night': 'Leicht bewölkt',
  cloudy: 'Bedeckt', fog: 'Nebel', wind: 'Windig', rain: 'Regen', sleet: 'Schneeregen', snow: 'Schnee', hail: 'Hagel', thunderstorm: 'Gewitter',
};

export const AIR_LABEL = ['sehr gut', 'gut', 'mäßig', 'schlecht', 'sehr schlecht'];
export const AIR_COLOR = ['#2F8F5B', '#7DAE3B', '#E2A600', '#E0631A', '#C62828'];

export function compass(deg: number) {
  return ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(((deg % 360) / 45)) % 8];
}

export function occupancy(free: number | null, cap: number | null): 'ok' | 'mid' | 'full' | 'none' {
  if (free == null || !cap) return 'none';
  const r = free / cap;
  if (free <= 5 || r < 0.05) return 'full';
  if (r < 0.2) return 'mid';
  return 'ok';
}

/** OSM-Öffnungszeiten lesbarer machen: "Mo-Sa 07:30-20:30; Su off" -> "Mo–Sa 07:30–20:30, So geschlossen" */
export function openingHours(s: string) {
  if (s === '24/7') return 'rund um die Uhr';
  const days: Record<string, string> = { Mo: 'Mo', Tu: 'Di', We: 'Mi', Th: 'Do', Fr: 'Fr', Sa: 'Sa', Su: 'So', PH: 'Feiertag' };
  return s
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => days[d])
    .replace(/\boff\b/g, 'geschlossen')
    .replace(/(\d)-(\d)/g, '$1–$2')
    .replace(/([A-Za-z])-([A-Z])/g, '$1–$2')
    .replace(/;\s*/g, ', ');
}

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
const wdFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' });
export const berlinDate = (t: number | string | Date = Date.now()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(t));
export const fmtDay = (t: string | number) => dayFmt.format(new Date(t));

/** "Heute", "Morgen" oder "Do 23." für einen Kalendertag JJJJ-MM-TT */
export function dayLabel(date: string, now = Date.now()) {
  const today = berlinDate(now);
  const tomorrow = berlinDate(now + 86400_000);
  if (date === today) return 'Heute';
  if (date === tomorrow) return 'Morgen';
  const d = new Date(`${date}T12:00:00`);
  return `${wdFmt.format(d).replace('.', '')} ${d.getDate()}.`;
}
