/**
 * The only module allowed to touch localStorage (CLAUDE.md). Schema-versioned
 * keys so future migrations can rewrite old data instead of corrupting it.
 */

const VERSION = 1;
const PREFIX = `sg:v${VERSION}:`;

export function loadJSON<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined; // private mode / quota / corrupt entry — treat as absent
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or blocked; the game stays playable, just unpersisted
  }
}

// ---- Daily Ticker game state (per UTC day) ----

export type DailyStatus = "playing" | "won" | "lost";

export interface DailyState {
  guessIds: string[];
  status: DailyStatus;
}

export function loadDailyState(dateKey: string): DailyState | undefined {
  return loadJSON<DailyState>(`daily:${dateKey}`);
}

export function saveDailyState(dateKey: string, state: DailyState): void {
  saveJSON(`daily:${dateKey}`, state);
}

// ---- Daily Ticker aggregate stats ----

export interface DailyStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  /** dateKey of the last finished game (streak bookkeeping) */
  lastFinished?: string;
  /** guess-count distribution, index 0 = won in 1 */
  dist: [number, number, number, number, number, number];
}

export const EMPTY_STATS: DailyStats = {
  played: 0,
  won: 0,
  streak: 0,
  maxStreak: 0,
  dist: [0, 0, 0, 0, 0, 0],
};

export function loadDailyStats(): DailyStats {
  return loadJSON<DailyStats>("stats:daily") ?? { ...EMPTY_STATS, dist: [0, 0, 0, 0, 0, 0] };
}

/** Record a finished game. `dateKey` guards double counting on refresh. */
export function recordDailyResult(dateKey: string, won: boolean, guessCount: number): DailyStats {
  const stats = loadDailyStats();
  if (stats.lastFinished === dateKey) return stats; // already counted
  const yesterday = new Date(Date.parse(dateKey) - 86_400_000).toISOString().slice(0, 10);
  const continues = stats.lastFinished === yesterday;
  const next: DailyStats = {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak: won ? (continues ? stats.streak + 1 : 1) : 0,
    maxStreak: 0,
    lastFinished: dateKey,
    dist: [...stats.dist],
  };
  next.maxStreak = Math.max(stats.maxStreak, next.streak);
  if (won && guessCount >= 1 && guessCount <= 6) next.dist[guessCount - 1]++;
  saveJSON("stats:daily", next);
  return next;
}

// ---- misc flags ----

export function onceFlag(name: string): boolean {
  const key = `flag:${name}`;
  if (loadJSON<boolean>(key)) return false;
  saveJSON(key, true);
  return true; // first time
}
