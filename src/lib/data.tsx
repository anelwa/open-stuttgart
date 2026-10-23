import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePolling, type Polled } from './api';
import type { Radar } from './rain';
import type { Kessel } from '../components/Kessel';
import type { AirStation, BartourenResponse, EventsResponse, FlugDaten, KaltluftDaten, NinaWarnung, ParkingSite, Place, Roadwork, SharingResponse, TrafficItem, UnfallAntwort, WanderwegeAntwort, Water, Weather } from './types';

export interface AppData {
  parking: Polled<{ sites: ParkingSite[]; fetchedAt: string; source: string }>;
  sharing: Polled<SharingResponse>;
  roadworks: Polled<{ items: Roadwork[]; fetchedAt: string; source: string }>;
  traffic: Polled<{ items: TrafficItem[]; publiziert: string | null; lmsVerfuegbar: boolean; quelle: string }>;
  air: Polled<{ stations: AirStation[]; fetchedAt: string; source: string }>;
  weather: Polled<Weather & { fetchedAt: string }>;
  water: Polled<Water & { fetchedAt: string }>;
  bike: Polled<GeoJSON.FeatureCollection>;
  places: Polled<{ places: Place[]; source: string }>;
  events: Polled<EventsResponse>;
  radar: Polled<Radar>;
  kessel: Polled<Kessel>;
  warnungen: Polled<{ items: NinaWarnung[]; activeCount: number; fetchedAt: string; source: string }>;
  flug: Polled<FlugDaten>;
  kaltluft: Polled<KaltluftDaten>;
  unfaelle: Polled<UnfallAntwort>;
  wanderwege: Polled<WanderwegeAntwort>;
  bartouren: Polled<BartourenResponse>;
  eventDate: string | null;
  setEventDate: (d: string | null) => void;
}

const Ctx = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [eventDate, setEventDate] = useState<string | null>(null);
  const [eventsPending, setEventsPending] = useState(true);
  const events = usePolling<EventsResponse>(`/api/events${eventDate ? `?date=${eventDate}` : ''}`, eventsPending ? 6_000 : 10 * 60_000);
  // Solange der Server Termine noch anreichert, öfter nachfragen
  const pendingNow = (events.data?.pending ?? 1) > 0;
  if (pendingNow !== eventsPending) setEventsPending(pendingNow);
  const value: AppData = {
    events,
    eventDate,
    setEventDate,
    places: usePolling('/api/places', 24 * 3600_000),
    parking: usePolling('/api/parking', 60_000),
    sharing: usePolling('/api/sharing', 60_000),
    roadworks: usePolling('/api/roadworks', 15 * 60_000),
    traffic: usePolling('/api/traffic', 2 * 60_000),
    air: usePolling('/api/air', 15 * 60_000),
    weather: usePolling('/api/weather', 10 * 60_000),
    water: usePolling('/api/water', 15 * 60_000),
    bike: usePolling('/api/bikeroutes', 24 * 3600_000),
    radar: usePolling('/api/radar', 5 * 60_000),
    kessel: usePolling('/api/kessel', 10 * 60_000),
    warnungen: usePolling('/api/warnungen', 2 * 60_000),
    flug: usePolling('/api/flug', 60_000),
    kaltluft: usePolling('/api/kaltluft', 24 * 3600_000),
    unfaelle: usePolling('/api/unfaelle', 24 * 3600_000),
    wanderwege: usePolling('/api/wanderwege', 24 * 3600_000),
    bartouren: usePolling('/api/bartouren', 30 * 60_000),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('DataProvider fehlt');
  return v;
}
