/**
 * Cap Battle pair selection (ROADMAP §1.3) — pure, seeded RNG for testability.
 * Pairs bias toward "interesting": same sector, or caps within 3× of each
 * other, and avoid recently shown companies so long runs don't feel stale.
 */
import type { GameCompany } from "./feedback.ts";

/** Tiny deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickFrom = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

/** Next opponent for a fixed anchor (the running champion in a streak). */
export function pickChallenger<T extends GameCompany>(
  anchor: T,
  pool: T[],
  rng: () => number,
  recentIds: ReadonlySet<string>,
): T {
  const interesting = (c: T) => {
    if (c.id === anchor.id) return false;
    const ratio =
      Math.max(c.marketCapUSD, anchor.marketCapUSD) / Math.min(c.marketCapUSD, anchor.marketCapUSD);
    return c.sector === anchor.sector || ratio <= 3;
  };
  // prefer interesting AND fresh, then interesting, then anything else
  const tiers = [
    pool.filter((c) => interesting(c) && !recentIds.has(c.id)),
    pool.filter(interesting),
    pool.filter((c) => c.id !== anchor.id),
  ];
  return pickFrom(
    tiers.find((t) => t.length > 0)!,
    rng,
  );
}

export function pickPair<T extends GameCompany>(
  pool: T[],
  rng: () => number,
  recentIds: ReadonlySet<string>,
): [T, T] {
  const fresh = pool.filter((c) => !recentIds.has(c.id));
  const anchor = pickFrom(fresh.length >= 2 ? fresh : pool, rng);
  const challenger = pickChallenger(anchor, pool, rng, recentIds);
  return rng() < 0.5 ? [anchor, challenger] : [challenger, anchor];
}
