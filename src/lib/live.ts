// Live-Zustände städtischer Einrichtungen für die Kartenebene: Bäder (Besucherzahl) und Bürgerbüros (Wartezeit).
import { useMemo } from 'react';
import { usePolling } from './api';
import type { Facility } from './types';

type Usual = { value: number; n: number } | null | undefined;
type Bb = { id: number; label: string; text: string; status: number; lat?: number; lon?: number; name?: string; address?: string; booking?: string; url: string; notes: string[]; usual?: Usual };
type Bad = { id: number; name: string; count: number; max: number; lat?: number; lon?: number; address?: string; usual?: Usual };
export type LiveItem = Facility & { level: string; short: string };

const bbUsual = (u: Usual) => (u ? `üblich um diese Zeit: etwa ${u.value >= 10 ? '150 Minuten oder mehr' : `${Math.round(u.value) * 15} Minuten`}` : null);

export function useLive(enabled: boolean): LiveItem[] | null {
  const bb = usePolling<{ items: Bb[] }>(enabled ? '/api/nearby/buergerbueros' : null, 60_000);
  const bad = usePolling<{ items: Bad[] }>(enabled ? '/api/nearby/baeder' : null, 60_000);
  return useMemo(() => {
    if (!enabled) return null;
    const out: LiveItem[] = [];
    for (const b of bb.data?.items ?? []) {
      if (b.lat == null || b.lon == null) continue;
      const level = b.status === 0 ? 'zu' : b.status >= 11 || b.status >= 6 ? 'hoch' : b.status >= 3 ? 'mittel' : 'ok';
      const short = b.status === 0 ? 'geschlossen' : b.status >= 11 ? 'keine Marken' : b.status >= 10 ? '150+ min' : `ca. ${b.status * 15} min`;
      out.push({ id: `bb-${b.id}`, cat: 'buergerbuero', name: b.name ?? `Bürgerbüro ${b.label}`, lat: b.lat, lon: b.lon, address: b.address, booking: b.booking, web: b.url,
        info: [...(b.notes ?? []), bbUsual(b.usual)].filter(Boolean) as string[], live: b.text, level, short });
    }
    for (const x of bad.data?.items ?? []) {
      if (x.lat == null || x.lon == null || !x.max) continue;
      const pct = Math.round((x.count / x.max) * 100);
      const level = x.count === 0 ? 'zu' : pct >= 85 ? 'hoch' : pct >= 60 ? 'mittel' : 'ok';
      out.push({ id: `bad-${x.id}`, cat: 'bad', name: x.name, lat: x.lat, lon: x.lon, address: x.address,
        info: [x.usual ? `üblich um diese Zeit: ${Math.round(x.usual.value)} Personen` : null].filter(Boolean) as string[],
        live: `${x.count} von ${x.max} Personen (${pct} %)`, level, short: x.count === 0 ? '0 Personen' : `${pct} %` });
    }
    return out;
  }, [enabled, bb.data, bad.data]);
}
