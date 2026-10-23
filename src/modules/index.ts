import type { ModuleDef } from './types';
import { MobilityPanel } from './mobility/MobilityPanel';
import { EnvironmentPanel } from './environment/EnvironmentPanel';
import { CulturePanel } from './culture/CulturePanel';
import { SunPanel } from './sun/SunPanel';
import { NearbyPanel } from './nearby/NearbyPanel';
import { VerwaltungPanel } from './verwaltung/VerwaltungPanel';
import { RoutePanel } from './route/RoutePanel';
import { WasGehtPanel } from './wasgeht/WasGehtPanel';
import { BartourenPanel } from './bartouren/BartourenPanel';
import { SchnittstellenPanel } from './schnittstellen/SchnittstellenPanel';
import { SpielPanel } from './spiel/SpielPanel';

export const MODULES: ModuleDef[] = [
  { id: 'nearby', label: 'Nähe', icon: 'pin', status: 'live', overlays: ['nearby'], Panel: NearbyPanel },
  { id: 'verwaltung', label: 'Verwaltung', icon: 'home', status: 'live', overlays: ['nearby', 'live'], Panel: VerwaltungPanel },
  { id: 'route', label: 'Weg', icon: 'route', status: 'live', overlays: ['route'], Panel: RoutePanel },
  { id: 'mobility', label: 'Mobilität', icon: 'mobility', status: 'live', overlays: ['network', 'stops', 'parking', 'sharing', 'roadworks', 'bike'], Panel: MobilityPanel },
  { id: 'environment', label: 'Umwelt', icon: 'leaf', status: 'live', overlays: ['air', 'water', 'warnung', 'flug', 'kaltluft'], Panel: EnvironmentPanel },
  { id: 'culture', label: 'Kultur', icon: 'culture', status: 'live', overlays: ['events', 'places'], Panel: CulturePanel },
  { id: 'wasgeht', label: 'Was geht', icon: 'ticket', status: 'live', overlays: ['nearby'], Panel: WasGehtPanel },
  { id: 'bartouren', label: 'Bar-Touren', icon: 'cocktail', status: 'live', overlays: ['bartouren'], Panel: BartourenPanel },
  { id: 'spiel', label: 'Stadtspiel', icon: 'compass', status: 'live', overlays: ['spiel'], Panel: SpielPanel },
  { id: 'sun', label: 'Sonne', icon: 'sunset', status: 'live', overlays: ['sun'], Panel: SunPanel },
  { id: 'wissen', label: 'Stadtwissen', icon: 'layers', status: 'live', overlays: ['wissen'], Panel: SchnittstellenPanel },
];
