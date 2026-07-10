/**
 * Index Recall engine (ROADMAP §1.2) — pure functions.
 * Acceptance uses matching.ts; exact normalized hits win over fuzzy cousins
 * so "Siemens" never accidentally reveals "Siemens Energy".
 */
import { matchesCompany, normalizeGuess, type Matchable } from "./matching.ts";

/** Find which still-hidden constituent a guess reveals, if any. */
export function matchRemaining<T extends Matchable>(input: string, remaining: T[]): T | undefined {
  const q = normalizeGuess(input);
  if (!q) return undefined;
  // pass 1: exact normalized name/ticker/alias
  for (const c of remaining) {
    if (
      normalizeGuess(c.name) === q ||
      normalizeGuess(c.ticker.split(".")[0]) === q ||
      c.aliases.map(normalizeGuess).includes(q)
    ) {
      return c;
    }
  }
  // pass 2: fuzzy/prefix — smallest name first so prefixes hit the shortest match
  const fuzzy = remaining
    .filter((c) => matchesCompany(input, c))
    .sort((a, b) => a.name.length - b.name.length);
  return fuzzy[0];
}

/** 7.5s per constituent, clamped to [2min, 30min] (5:00 for a 40-stock index). */
export function timeLimitFor(constituentCount: number): number {
  return Math.min(1800, Math.max(120, Math.round(constituentCount * 7.5)));
}

/**
 * Score: completion is worth 1000 base × fraction named; a time bonus of up to
 * +50% scales with time remaining. Zen mode (no limit) has no bonus.
 */
export function recallScore(
  named: number,
  total: number,
  elapsedSec: number,
  timeLimitSec: number | undefined,
): number {
  if (total === 0 || named === 0) return 0;
  const base = (named / total) * 1000;
  if (timeLimitSec === undefined) return Math.round(base);
  const timeLeftFrac = Math.max(0, (timeLimitSec - elapsedSec) / timeLimitSec);
  return Math.round(base * (1 + 0.5 * timeLeftFrac));
}
