import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNow, usePolling, type Polled } from '../../lib/api';
import { berlinDate } from '../../lib/format';
import { noonOf, sunTimes } from '../../lib/sun';
import type { AnswerResult, ProgressMap, Route, RouteList, RouteProgress, RouteResponse, Station } from './types';

const STORAGE = 'kesselcode:v1';

function readProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as ProgressMap : {};
  } catch {
    return {};
  }
}

function emptyProgress(): RouteProgress {
  return { startedAt: new Date().toISOString(), solved: [], hints: {}, wrong: {}, pausedMs: 0 };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Fehler ${res.status}`);
  return data as T;
}

function normalizeTime(value: string): number | null {
  const m = /(\d{1,2})\s*[:.]\s*(\d{2})/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function liveCheck(station: Station, answer: string): boolean {
  if (station.live !== 'sunset') return false;
  const date = berlinDate();
  const { set } = sunTimes(noonOf(date), station.point[1], station.point[0]);
  if (!Number.isFinite(set)) return false;
  const local = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(set));
  const expected = normalizeTime(local);
  const input = normalizeTime(answer);
  if (expected == null || input == null) return false;
  const diff = Math.abs(((input - expected + 720) % 1440 + 1440) % 1440 - 720);
  return diff <= 5;
}

export interface SpielApi {
  list: Polled<RouteList>;
  route: Polled<RouteResponse>;
  activeId: string | null;
  routeData: Route | null;
  progress: ProgressMap;
  activeProgress: RouteProgress | null;
  solved: Set<string>;
  mainStations: Station[];
  bonusStations: Station[];
  currentStop: Station | null;
  station: Station | null;
  selectedStationId: string | null;
  allMainSolved: boolean;
  completed: boolean;
  elapsedMs: number;
  points: number;
  badge: string | null;
  startRoute: (id: string) => void;
  closeRoute: () => void;
  resumeRoute: (id: string) => void;
  selectStation: (id: string | null) => void;
  checkAnswer: (station: Station, answer: string) => Promise<{ correct: boolean; message: string }>;
  revealHint: (station: Station) => string | null;
  revealSolution: (station: Station) => string | null;
  finish: (word: string) => Promise<{ correct: boolean; message: string }>;
  togglePause: () => void;
  resetRoute: (id: string) => void;
  resetAll: () => void;
  exportProgress: () => void;
  hintsFor: (id: string) => number;
  wrongFor: (id: string) => number;
  progressFor: (id: string) => RouteProgress | null;
  isSolved: (id: string) => boolean;
  isPaused: boolean;
}

export function useSpiel(): SpielApi {
  const list = usePolling<RouteList>('/api/spiel/routen', 10 * 60_000);
  const [activeId, setActiveId] = useState<string | null>(null);
  const route = usePolling<RouteResponse>(activeId ? `/api/spiel/routen/${encodeURIComponent(activeId)}` : null, 10 * 60_000);
  const [progress, setProgress] = useState<ProgressMap>(readProgress);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const now = useNow(30_000);

  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(progress)); } catch { /* privat */ }
  }, [progress]);

  useEffect(() => {
    setSelectedStationId(null);
  }, [activeId]);

  const routeData = route.data?.route ?? null;
  const activeProgress = activeId ? progress[activeId] ?? null : null;
  const solved = useMemo(() => new Set(activeProgress?.solved ?? []), [activeProgress?.solved]);

  const mainStations = useMemo(
    () => (routeData?.stations ?? []).filter((s) => s.kind === 'main'),
    [routeData],
  );
  const bonusStations = useMemo(
    () => (routeData?.stations ?? []).filter((s) => s.kind === 'bonus'),
    [routeData],
  );
  const currentStop = useMemo(
    () => (routeData?.stations ?? [])
      .filter((s) => s.kind !== 'bonus')
      .sort((a, b) => a.no - b.no)
      .find((s) => !solved.has(s.id)) ?? null,
    [routeData, solved],
  );
  const station = useMemo(() => {
    if (!routeData) return null;
    if (selectedStationId) return routeData.stations.find((s) => s.id === selectedStationId) ?? null;
    return currentStop ?? null;
  }, [routeData, selectedStationId, currentStop, solved]);

  const allMainSolved = !!routeData
    && routeData.stations.some((s) => s.kind !== 'bonus')
    && routeData.stations.filter((s) => s.kind !== 'bonus').every((s) => solved.has(s.id));
  const completed = !!activeProgress?.completedAt;
  const isPaused = !!activeProgress?.pausedAt;

  const elapsedMs = useMemo(() => {
    if (!activeProgress) return 0;
    const end = activeProgress.completedAt
      ? Date.parse(activeProgress.completedAt)
      : activeProgress.pausedAt
        ? Date.parse(activeProgress.pausedAt)
        : now;
    return Math.max(0, end - Date.parse(activeProgress.startedAt) - (activeProgress.pausedMs ?? 0));
  }, [activeProgress, now]);

  const points = useMemo(() => {
    if (!routeData || !activeProgress) return 0;
    const main = mainStations.filter((s) => solved.has(s.id)).length;
    const side = routeData.stations.filter((s) => s.kind !== 'main' && solved.has(s.id)).length;
    let score = main * 100 + side * 50;
    if (activeProgress.completedAt) score += 200;
    for (const id of activeProgress.solved) {
      const n = activeProgress.hints[id] ?? 0;
      score -= (n * (n + 1) / 2) * 10;
      score -= Math.min(20, (activeProgress.wrong[id] ?? 0) * 5);
    }
    return Math.max(0, Math.round(score));
  }, [routeData, activeProgress, mainStations, solved]);

  const badge = useMemo(() => {
    if (!routeData || !activeProgress?.completedAt) return null;
    const hintSum = Object.values(activeProgress.hints).reduce((n, v) => n + v, 0);
    const allSolved = routeData.stations.every((s) => solved.has(s.id));
    if (allSolved && hintSum <= 1) return 'Kartograph';
    if (hintSum <= 2) return 'Kundig';
    return 'Spur';
  }, [routeData, activeProgress, solved]);

  const startRoute = useCallback((id: string) => {
    setProgress((p) => (p[id] ? p : { ...p, [id]: emptyProgress() }));
    setActiveId(id);
  }, []);

  const closeRoute = useCallback(() => {
    setActiveId(null);
    setSelectedStationId(null);
  }, []);

  const resumeRoute = useCallback((id: string) => {
    setProgress((p) => (p[id] ? p : { ...p, [id]: emptyProgress() }));
    setActiveId(id);
  }, []);

  const selectStation = useCallback((id: string | null) => setSelectedStationId(id), []);

  const isSolved = useCallback((id: string) => solved.has(id), [solved]);

  const update = useCallback((id: string, fn: (p: RouteProgress) => RouteProgress) => {
    setProgress((all) => ({ ...all, [id]: fn(all[id] ?? emptyProgress()) }));
  }, []);

  const checkAnswer = useCallback(async (s: Station, answer: string) => {
    if (!activeId) return { correct: false, message: 'Keine Route aktiv.' };
    if (!answer.trim()) return { correct: false, message: 'Bitte eine Antwort eingeben.' };
    if (s.answerType === 'live') {
      const ok = liveCheck(s, answer);
      if (ok) {
        update(activeId, (p) => ({ ...p, solved: [...new Set([...p.solved, s.id])] }));
        return { correct: true, message: 'Passt. Du bist da.' };
      }
      update(activeId, (p) => ({ ...p, wrong: { ...p.wrong, [s.id]: (p.wrong[s.id] ?? 0) + 1 } }));
      return { correct: false, message: 'Noch nicht. Die Zeit liegt etwas daneben – schau noch einmal in die App.' };
    }
    try {
      const result = await postJson<AnswerResult>('/api/spiel/pruefen', { routeId: activeId, stationId: s.id, answer });
      if (result.correct) {
        update(activeId, (p) => ({ ...p, solved: [...new Set([...p.solved, s.id])] }));
        return { correct: true, message: 'Richtig. Siegel gesetzt.' };
      }
      update(activeId, (p) => ({ ...p, wrong: { ...p.wrong, [s.id]: (p.wrong[s.id] ?? 0) + 1 } }));
      return { correct: false, message: 'Noch nicht. Schau noch einmal genau hin.' };
    } catch (err) {
      return { correct: false, message: (err as Error).message };
    }
  }, [activeId, update]);

  const revealSolution = useCallback((s: Station) => {
    if (!activeId) return null;
    update(activeId, (p) => ({ ...p, hints: { ...p.hints, [s.id]: 3 } }));
    return s.hints[2] ?? null;
  }, [activeId, update]);

  const revealHint = useCallback((s: Station) => {
    if (!activeId) return null;
    const current = activeProgress?.hints[s.id] ?? 0;
    if (current >= 3) return s.hints[2] ?? null;
    update(activeId, (p) => ({ ...p, hints: { ...p.hints, [s.id]: current + 1 } }));
    return s.hints[current] ?? null;
  }, [activeId, activeProgress?.hints, update]);

  const finish = useCallback(async (word: string) => {
    if (!activeId) return { correct: false, message: 'Keine Route aktiv.' };
    try {
      const result = await postJson<{ correct: boolean }>('/api/spiel/abschluss', { routeId: activeId, word });
      if (result.correct) {
        update(activeId, (p) => ({ ...p, completedAt: p.completedAt ?? new Date().toISOString(), pausedAt: undefined }));
        return { correct: true, message: 'Kapitel geschlossen.' };
      }
      return { correct: false, message: 'Das Wort passt noch nicht. Die Buchstaben der Hauptstationen ergeben es.' };
    } catch (err) {
      return { correct: false, message: (err as Error).message };
    }
  }, [activeId, update]);

  const togglePause = useCallback(() => {
    if (!activeId || !activeProgress || activeProgress.completedAt) return;
    update(activeId, (p) => {
      if (p.pausedAt) {
        return { ...p, pausedMs: (p.pausedMs ?? 0) + (Date.now() - Date.parse(p.pausedAt)), pausedAt: undefined };
      }
      return { ...p, pausedAt: new Date().toISOString() };
    });
  }, [activeId, activeProgress, update]);

  const resetRoute = useCallback((id: string) => {
    setProgress((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    if (activeId === id) {
      setActiveId(null);
      setSelectedStationId(null);
    }
  }, [activeId]);

  const resetAll = useCallback(() => {
    setProgress({});
    setActiveId(null);
    setSelectedStationId(null);
  }, []);

  const exportProgress = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), progress }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kesselcode-routenbuch.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [progress]);

  const hintsFor = useCallback((id: string) => activeProgress?.hints[id] ?? 0, [activeProgress]);
  const wrongFor = useCallback((id: string) => activeProgress?.wrong[id] ?? 0, [activeProgress]);
  const progressFor = useCallback((id: string) => progress[id] ?? null, [progress]);

  return {
    list, route, activeId, routeData, progress, activeProgress, solved, mainStations, bonusStations,
    currentStop, station, selectedStationId, allMainSolved, completed, elapsedMs, points, badge,
    startRoute, closeRoute, resumeRoute, selectStation, checkAnswer, revealHint, revealSolution, finish, togglePause,
    resetRoute, resetAll, exportProgress, hintsFor, wrongFor, progressFor, isSolved, isPaused,
  };
}
