/**
 * Pure date→puzzle-number logic shared by all daily modes.
 * Day boundary is UTC (ROADMAP §7.5): everyone worldwide gets the same puzzle.
 */

/** Daily Ticker epoch: puzzle #1 is served on this UTC date. */
export const DAILY_TICKER_EPOCH = "2026-07-10";

/** UTC calendar date (YYYY-MM-DD) for a given instant. */
export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * 1-based puzzle number for a UTC date key, relative to an epoch date key.
 * Returns 0 for dates before the epoch (mode not yet live).
 */
export function puzzleNumber(dateKey: string, epoch: string = DAILY_TICKER_EPOCH): number {
  const days = (Date.parse(dateKey) - Date.parse(epoch)) / 86_400_000;
  return days < 0 ? 0 : Math.floor(days) + 1;
}

/**
 * Light obfuscation of the scheduled answer id (ROADMAP §3): base64 of a
 * reversed, versioned string. Keeps the answer out of casual greps of the
 * bundle/JSON; a determined user can still decode it — accepted for v1.
 */
export function encodeAnswer(companyId: string): string {
  return btoa(`v1:${[...companyId].reverse().join("")}`);
}

export function decodeAnswer(encoded: string): string | undefined {
  try {
    const raw = atob(encoded);
    if (!raw.startsWith("v1:")) return undefined;
    return [...raw.slice(3)].reverse().join("");
  } catch {
    return undefined;
  }
}

export interface DailySchedule {
  mode: "daily-ticker";
  epoch: string;
  snapshotVersion: string;
  /** dateKey → encoded answer id */
  days: Record<string, string>;
}

/**
 * Resolve today's answer: scheduled entry if present, else a deterministic
 * fallback from the Tier-1 pool so the game never breaks past the schedule.
 */
export function resolveDailyAnswer(
  schedule: DailySchedule,
  dateKey: string,
  tier1Ids: readonly string[],
): { answerId: string; number: number; fromSchedule: boolean } {
  const number = puzzleNumber(dateKey, schedule.epoch);
  const scheduled = schedule.days[dateKey];
  const decoded = scheduled ? decodeAnswer(scheduled) : undefined;
  if (decoded) return { answerId: decoded, number, fromSchedule: true };
  return { answerId: tier1Ids[hashDate(dateKey) % tier1Ids.length], number, fromSchedule: false };
}

/** FNV-1a over the date key — stable across platforms. */
export function hashDate(dateKey: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
