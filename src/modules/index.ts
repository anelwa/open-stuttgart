import type { ModuleDef } from './types';
import { MobilityPanel } from './mobility/MobilityPanel';
import { EnvironmentPanel } from './environment/EnvironmentPanel';
import { CulturePanel } from './culture/CulturePanel';
import { SunPanel } from './sun/SunPanel';

export const MODULES: ModuleDef[] = [
  { id: 'mobility', label: 'Mobilität', icon: 'mobility', status: 'live', overlays: ['network', 'stops', 'parking', 'sharing', 'roadworks', 'bike'], Panel: MobilityPanel },
  { id: 'environment', label: 'Umwelt', icon: 'leaf', status: 'live', overlays: ['air', 'water'], Panel: EnvironmentPanel },
  { id: 'culture', label: 'Kultur', icon: 'culture', status: 'live', overlays: ['events', 'places'], Panel: CulturePanel },
  { id: 'sun', label: 'Sonne', icon: 'sunset', status: 'live', overlays: ['sun'], Panel: SunPanel },
];
