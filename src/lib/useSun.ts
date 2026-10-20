import { useEffect, useState } from 'react';
import { GRID } from './sun';
import type { SunIn, Viewpoint } from './sunWorker';

export interface SunPoint extends Viewpoint { set: number; rise: number; h: number }
export interface SunDay {
  date: string; rise: number; set: number; cols: number; rows: number;
  gridSet: Float64Array; gridRise: Float64Array; points: SunPoint[]; ms: number;
}

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, (p: { set: number; rise: number; h: number }) => void>();
const dayListeners = new Set<(d: SunDay | { error: string }) => void>();
const dayCache = new Map<string, SunDay>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./sunWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'point') { waiting.get(m.id)?.(m); waiting.delete(m.id); }
    else if (m.type === 'day') { dayCache.set(m.date, m); dayListeners.forEach((l) => l(m)); }
    else if (m.type === 'error') dayListeners.forEach((l) => l({ error: m.message }));
  };
  return worker;
}

/** Gelände-Sonnenzeiten für einen Tag (Gitter und Aussichtspunkte), im Web Worker gerechnet */
export function useSunDay(date: string, viewpoints: Viewpoint[] | null) {
  const [state, setState] = useState<{ day: SunDay | null; error: string | null }>(() => ({ day: dayCache.get(date) ?? null, error: null }));
  const key = viewpoints?.map((v) => v.id).join(',');
  useEffect(() => {
    if (!viewpoints) return;
    const cached = dayCache.get(date);
    if (cached && cached.points.length === viewpoints.length) { setState({ day: cached, error: null }); return; }
    setState({ day: null, error: null });
    const l = (d: SunDay | { error: string }) => {
      if ('error' in d) setState({ day: null, error: d.error });
      else if (d.date === date) setState({ day: d, error: null });
    };
    dayListeners.add(l);
    getWorker().postMessage({ type: 'day', date, viewpoints } satisfies SunIn);
    return () => { dayListeners.delete(l); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, key]);
  return state;
}

export function sunAt(date: string, lat: number, lon: number) {
  const id = ++seq;
  return new Promise<{ set: number; rise: number; h: number }>((resolve) => {
    waiting.set(id, resolve);
    getWorker().postMessage({ type: 'point', id, date, lat, lon } satisfies SunIn);
  });
}

/** Schattenbild für einen Zeitpunkt: Schatten blau, noch Sonne warm getönt */
export function shadeImage(day: SunDay, t: number, mode: 'abend' | 'morgen') {
  const c = document.createElement('canvas');
  c.width = day.cols;
  c.height = day.rows;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(day.cols, day.rows);
  const grid = mode === 'abend' ? day.gridSet : day.gridRise;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    const sunny = mode === 'abend' ? !Number.isNaN(v) && t <= v : !Number.isNaN(v) && t >= v;
    const o = i * 4;
    if (sunny) { img.data[o] = 255; img.data[o + 1] = 190; img.data[o + 2] = 40; img.data[o + 3] = 45; }
    else { img.data[o] = 22; img.data[o + 1] = 30; img.data[o + 2] = 78; img.data[o + 3] = 150; }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

export const SHADE_COORDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [GRID.w - GRID.dLon / 2, GRID.n + GRID.dLat / 2],
  [GRID.e + GRID.dLon / 2, GRID.n + GRID.dLat / 2],
  [GRID.e + GRID.dLon / 2, GRID.s - GRID.dLat / 2],
  [GRID.w - GRID.dLon / 2, GRID.s - GRID.dLat / 2],
];
