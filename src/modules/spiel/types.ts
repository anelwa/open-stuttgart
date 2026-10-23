// Öffentliche Typen des Stadtspiels. Antworten und Aliase sind bewusst nicht enthalten;
// sie liegen nur im Serverdatensatz und werden über /api/spiel/pruefen geprüft.

export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type StationKind = 'prologue' | 'main' | 'bonus';
export type AnswerType = 'text' | 'number' | 'live';

export interface Station {
  id: string;
  no: number;
  name: string;
  kind: StationKind;
  point: [number, number];
  radiusM: number;
  prompt: string;
  answerType: AnswerType;
  live?: string;
  code?: string;
  ticket?: boolean;
  hints: string[];
  fact: string;
  source: string;
  license: string;
  verified: string;
}

export interface RouteSummary {
  id: string;
  chapter: number;
  title: string;
  subtitle: string;
  description: string;
  difficulty: Difficulty;
  durationMin: [number, number];
  distanceKm: number;
  ascentM: number;
  color: string;
  start: string;
  end: string;
  season: string;
  access: string;
  accessibility: string;
  safety: string[];
  stationCount: number;
  mainCount: number;
  bonusCount: number;
  wordLength: number;
}

export interface Route extends RouteSummary {
  line?: [number, number][];
  stations: Station[];
}

export interface RouteList {
  routes: RouteSummary[];
  stand: string | null;
  source: string | null;
  license: string | null;
  updated: string;
  hinweis: string;
}

export interface RouteResponse {
  route: Route;
  updated: string;
}

export interface RouteProgress {
  startedAt: string;
  solved: string[];
  hints: Record<string, number>;
  wrong: Record<string, number>;
  pausedMs: number;
  pausedAt?: string;
  completedAt?: string;
}

export type ProgressMap = Record<string, RouteProgress>;

export interface AnswerResult {
  correct: boolean | null;
  live?: string;
  stationId?: string;
  value?: number | null;
  note?: string;
  error?: string;
}
