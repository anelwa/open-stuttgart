import { useEffect, useRef, useState } from 'react';

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let msg = `Fehler ${res.status}`;
    try { msg = (await res.json()).error ?? msg; } catch { /* leer */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface Polled<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
  /** true, wenn der Abruf länger als acht Sekunden dauert. */
  slow?: boolean;
  reload: () => void;
}

/** Holt `url` sofort und danach alle `intervalMs`, pausiert bei verborgenem Tab. */
export function usePolling<T>(url: string | null, intervalMs: number): Polled<T> {
  const [state, setState] = useState<Omit<Polled<T>, 'reload'>>({ data: null, error: null, loading: !!url, updatedAt: null });
  const [slow, setSlow] = useState(false);
  const [tick, setTick] = useState(0);
  const urlRef = useRef(url);

  useEffect(() => {
    if (urlRef.current !== url) {
      urlRef.current = url;
      setState({ data: null, error: null, loading: !!url, updatedAt: null });
    }
    if (!url) return;
    const ctrl = new AbortController();
    const slowTimer = setTimeout(() => { if (!ctrl.signal.aborted) setSlow(true); }, 8000);
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (document.hidden) { timer = setTimeout(run, 5000); return; }
      setState((s) => ({ ...s, loading: true }));
      try {
        const data = await getJson<T>(url, ctrl.signal);
        setState({ data, error: null, loading: false, updatedAt: Date.now() });
        setSlow(false);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, error: (e as Error).message, loading: false }));
        setSlow(false);
      }
      timer = setTimeout(run, intervalMs);
    };
    run();
    return () => { ctrl.abort(); clearTimeout(timer); clearTimeout(slowTimer); };
  }, [url, intervalMs, tick]);

  return { ...state, slow, reload: () => setTick((t) => t + 1) };
}

/**
 * Holt `url` genau einmal (und erneut nur über `reload`). Für Quellen, deren
 * Bedingungen keinen automatischen Dauerabruf erlauben, z. B. Tankpreise.
 */
export function useOnDemand<T>(url: string | null): Polled<T> {
  const [state, setState] = useState<Omit<Polled<T>, 'reload'>>({ data: null, error: null, loading: !!url, updatedAt: null });
  const [slow, setSlow] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    getJson<T>(url, ctrl.signal)
      .then((data) => { if (!ctrl.signal.aborted) setState({ data, error: null, loading: false, updatedAt: Date.now() }); })
      .catch((e) => { if (!ctrl.signal.aborted) setState((s) => ({ ...s, error: (e as Error).message, loading: false })); });
    return () => ctrl.abort();
  }, [url, tick]);
  return { ...state, slow, reload: () => setTick((t) => t + 1) };
}

export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
