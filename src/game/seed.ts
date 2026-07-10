/**
 * Pure date→puzzle-number logic shared by all daily modes.
 * Day boundary is UTC (ROADMAP §7.5): everyone worldwide gets the same puzzle.
 */

/** Daily Ticker epoch: puzzle #1 is served on this UTC date. */
export const DAILY_TICKER_EPOCH = "2026-08-01";

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
