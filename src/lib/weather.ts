import type { Weather } from './types';

type Hour = Weather['hourly'][number];
const berlinHour = (t: string | number) => parseInt(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false }).format(new Date(t)), 10);
const berlinDay = (t: string | number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(t));

/** Stundenwert, der einem Zeitpunkt am nächsten liegt (höchstens 90 Minuten daneben) */
export function weatherAt(w: Weather | null | undefined, iso: string | number): Hour | null {
  if (!w?.hourly?.length) return null;
  const t = new Date(iso).getTime();
  let best: Hour | null = null;
  let bestD = Infinity;
  for (const h of w.hourly) {
    const d = Math.abs(Date.parse(h.t) - t);
    if (d < bestD) { best = h; bestD = d; }
  }
  return bestD <= 90 * 60_000 ? best : null;
}

export const isRainy = (h: Hour | null) => !!h && (h.precipitation >= 0.2 || /rain|sleet|hail|thunder/.test(h.icon));

/** Abend heute: ab wann Regen, wie warm um 20 Uhr */
export function eveningOutlook(w: Weather | null | undefined, now = Date.now()) {
  if (!w?.hourly?.length) return null;
  const today = berlinDay(now);
  const rest = w.hourly.filter((h) => Date.parse(h.t) >= now - 30 * 60_000 && berlinDay(h.t) === today);
  const evening = rest.filter((h) => berlinHour(h.t) >= 17);
  if (!evening.length) return null;
  const rain = evening.find(isRainy) ?? null;
  const at20 = evening.find((h) => berlinHour(h.t) === 20) ?? evening[evening.length - 1];
  const total = evening.reduce((s, h) => s + h.precipitation, 0);
  return { rainFrom: rain ? rain.t : null, total, at20 };
}

/** Fernsicht aus Sichtweite (m) und Bewölkung (%) */
export function fernsicht(visibility: number | null | undefined, cloud: number | null | undefined) {
  if (visibility == null) return null;
  const km = Math.round(visibility / 1000);
  const c = cloud ?? 50;
  let level: 0 | 1 | 2 | 3;
  if (km >= 40 && c < 70) level = 3;
  else if (km >= 20) level = 2;
  else if (km >= 8) level = 1;
  else level = 0;
  const label = ['geringe Fernsicht', 'mäßige Fernsicht', 'gute Fernsicht', 'sehr gute Fernsicht'][level];
  const hint = [
    'Dunst oder Nebel, Sicht von Aussichtspunkten eingeschränkt.',
    'Sicht über das Stadtgebiet, entfernte Höhenzüge eingeschränkt.',
    'Sicht über den Talkessel bis zu den Fildern.',
    'Sicht von den Höhenlagen bis zur Schwäbischen Alb möglich.',
  ][level];
  return { km, level, label, hint };
}
