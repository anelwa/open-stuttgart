import type { Facility } from './types';

export type Fuel = 'e5' | 'e10' | 'diesel';

export interface TankStation {
  id: string;
  name: string;
  brand: string | null;
  address: string | null;
  street: string | null;
  postCode: string | null;
  place: string | null;
  lat: number;
  lon: number;
  distKm: number | null;
  e5: number | null;
  e10: number | null;
  diesel: number | null;
  isOpen: boolean;
}

export interface TankResponse {
  provider: 'tankerkoenig' | 'infranode';
  source: string;
  stand: string;
  cachedAt: string;
  radiusKm: number;
  stale: boolean;
  error: string | null;
  fallback: string | null;
  license: string;
  licenseUrl: string;
  stations: TankStation[];
}

export const FUELS: { id: Fuel; label: string }[] = [
  { id: 'e10', label: 'E10' },
  { id: 'e5', label: 'E5' },
  { id: 'diesel', label: 'Diesel' },
];

export const fuelPrice = (s: TankStation, fuel: Fuel): number | null => s[fuel];

export const fmtPrice = (v: number | null | undefined) =>
  v == null ? '–' : `${v.toFixed(3).replace('.', ',')} €/l`;

export function priceLine(s: TankStation): string {
  const parts = FUELS.map((f) => {
    const v = s[f.id];
    return v == null ? null : `${f.label} ${fmtPrice(v)}`;
  }).filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Preise derzeit nicht gemeldet';
}

export function fmtStand(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

/** Tankstelle in das gemeinsame Einrichtungs-Schema für Karte und Detailblatt übersetzen. */
export function tankFacility(s: TankStation, stand: string, source: string): Facility {
  return {
    id: `tanken-${s.id}`,
    cat: 'tanken',
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    address: s.address,
    live: `${priceLine(s)} · ${s.isOpen ? 'geöffnet' : 'geschlossen'}`,
    info: [
      s.brand && s.brand !== s.name ? `Marke: ${s.brand}` : null,
      `Preisstand: ${fmtStand(stand)}`,
      'Preise ohne Gewähr; maßgeblich ist der Preis an der Zapfsäule.',
    ].filter(Boolean) as string[],
    source,
  };
}
