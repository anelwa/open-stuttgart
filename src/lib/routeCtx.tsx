import { createContext, useContext, type ReactNode } from 'react';

export type Place = { lat: number; lon: number; label: string; id?: string };

/** Ein Routenwunsch kann Start, Modus und Profil schon mitbringen (z. B. aus dem Bot). */
export type RouteRequest = Place & {
  from?: Place;
  mode?: 'oepnv' | 'rad' | 'fuss' | 'auto';
  profile?: 'standard' | 'rollstuhl' | 'kinderwagen';
  fit?: boolean;
};

const Ctx = createContext<(nach: RouteRequest) => void>(() => {});
export const RouteProvider = ({ plan, children }: { plan: (nach: RouteRequest) => void; children: ReactNode }) => <Ctx.Provider value={plan}>{children}</Ctx.Provider>;
export const usePlanRoute = () => useContext(Ctx);

/** Übergabe an Navigations-Apps. Start ist jeweils der aktuelle Standort der App, sofern nicht angegeben. */
export function handoffLinks(nach: Place, von?: Place | null) {
  const d = `${nach.lat},${nach.lon}`;
  const o = von ? `${von.lat},${von.lon}` : '';
  return [
    { name: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1${o ? `&origin=${o}` : ''}&destination=${d}&travelmode=transit` },
    { name: 'Apple Karten', url: `https://maps.apple.com/?${o ? `saddr=${o}&` : ''}daddr=${d}&dirflg=r` },
    { name: 'OpenStreetMap', url: `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${o ? encodeURIComponent(o) : ''}%3B${encodeURIComponent(d)}#map=16/${nach.lat}/${nach.lon}` },
    { name: 'Andere App (geo-Link)', url: `geo:${d}?q=${d}(${encodeURIComponent(nach.label)})` },
  ];
}
