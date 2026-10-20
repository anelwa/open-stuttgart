import type { ModuleDef } from './types';
import { MobilityPanel } from './mobility/MobilityPanel';
import { EnvironmentPanel } from './environment/EnvironmentPanel';
import { CulturePanel } from './culture/CulturePanel';
import { SunPanel } from './sun/SunPanel';
import { NearbyPanel } from './nearby/NearbyPanel';
import { RoutePanel } from './route/RoutePanel';
import { WasGehtPanel } from './wasgeht/WasGehtPanel';

export const MODULES: ModuleDef[] = [
  { id: 'nearby', label: 'Nähe', icon: 'pin', status: 'live', overlays: ['nearby'], Panel: NearbyPanel },
  { id: 'route', label: 'Weg', icon: 'route', status: 'live', overlays: ['route'], Panel: RoutePanel },
  { id: 'mobility', label: 'Mobilität', icon: 'mobility', status: 'live', overlays: ['network', 'stops', 'parking', 'sharing', 'roadworks', 'bike'], Panel: MobilityPanel },
  { id: 'environment', label: 'Umwelt', icon: 'leaf', status: 'live', overlays: ['air', 'water'], Panel: EnvironmentPanel },
  { id: 'culture', label: 'Kultur', icon: 'culture', status: 'live', overlays: ['events', 'places'], Panel: CulturePanel },
  { id: 'wasgeht', label: 'Was geht', icon: 'ticket', status: 'live', overlays: ['nearby'], Panel: WasGehtPanel },
  { id: 'sun', label: 'Sonne', icon: 'sunset', status: 'live', overlays: ['sun'], Panel: SunPanel },
];
