import { createContext, useContext, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { ERKLAERUNGEN } from './erklaerungen';

export type InfoPage = 'grundsaetze' | 'werte' | 'barrierefreiheit' | 'leicht' | 'daten' | 'stadt';

const Ctx = createContext<(page: InfoPage, anchor?: string) => void>(() => {});
export const InfoProvider = ({ open, children }: { open: (page: InfoPage, anchor?: string) => void; children: ReactNode }) =>
  <Ctx.Provider value={open}>{children}</Ctx.Provider>;
export const useInfo = () => useContext(Ctx);

/** Kleiner Knopf neben einem Wert: öffnet die Erklärung, wie der Wert entsteht. */
export function Explain({ id }: { id: keyof typeof ERKLAERUNGEN | string }) {
  const open = useInfo();
  const e = ERKLAERUNGEN[id];
  if (!e) return null;
  return (
    <button type="button" className="explain" onClick={() => open('werte', id)} aria-label={`Wie entsteht dieser Wert: ${e.titel}`} title="Wie entsteht dieser Wert?">
      <Icon name="info" size={14} />
    </button>
  );
}
