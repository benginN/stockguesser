/**
 * Daily Ticker schedule generator (ROADMAP §2.7). Proposes 365 days of answers:
 *   - difficulty score from cap rank, index-membership count, alias count
 *   - no repeats within 180 days
 *   - weekly rhythm: Mon easiest → Fri/Sat hardest, Sun medium
 * Writes:
 *   puzzles/daily.json              — human-readable, hand-editable (review this)
 *   public/data/daily-schedule.json — encoded artifact the app fetches
 * Re-run after editing puzzles/daily.json by hand: tsx puzzles/generate-daily.ts --emit-only
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { DAILY_TICKER_EPOCH, encodeAnswer, hashDate } from "../src/game/seed.ts";

const DAYS = 365;
const NO_REPEAT_WINDOW = 180;
const ROOT = new URL("..", import.meta.url);
const readablePath = new URL("./puzzles/daily.json", ROOT);
const artifactPath = new URL("./public/data/daily-schedule.json", ROOT);

interface Co {
  id: string;
  name: string;
  tier: 1 | 2;
  marketCapUSD: number;
  aliases: string[];
  indexMemberships: string[];
  country: string;
}
const { snapshotVersion, companies } = JSON.parse(
  readFileSync(new URL("./public/data/stocks.json", ROOT), "utf8"),
) as { snapshotVersion: string; companies: Co[] };

interface ReadableSchedule {
  mode: "daily-ticker";
  epoch: string;
  snapshotVersion: string;
  days: Record<string, { id: string; name: string; difficulty: number }>;
}

function emitArtifact(readable: ReadableSchedule): void {
  const days: Record<string, string> = {};
  for (const [date, entry] of Object.entries(readable.days)) days[date] = encodeAnswer(entry.id);
  writeFileSync(
    artifactPath,
    JSON.stringify({
      mode: "daily-ticker",
      epoch: readable.epoch,
      snapshotVersion: readable.snapshotVersion,
      days,
    }),
  );
  console.log(`emitted ${Object.keys(days).length} days → public/data/daily-schedule.json`);
}

if (process.argv.includes("--emit-only")) {
  emitArtifact(JSON.parse(readFileSync(readablePath, "utf8")) as ReadableSchedule);
  process.exit(0);
}

// ---- difficulty scoring over the Tier-1 answer pool ----
const pool = companies.filter((c) => c.tier === 1).sort((a, b) => b.marketCapUSD - a.marketCapUSD);
const scored = pool.map((c, capRank) => {
  // 0 = trivially famous, 1 = obscure
  const rankScore = capRank / pool.length; // big caps are easier
  const idxScore = 1 - Math.min(c.indexMemberships.length, 3) / 3; // multi-index = famous
  const aliasScore = 1 - Math.min(c.aliases.length - 2, 4) / 4; // nicknames = famous
  return {
    ...c,
    difficulty: Math.round((0.6 * rankScore + 0.25 * idxScore + 0.15 * aliasScore) * 100) / 100,
  };
});

// weekly rhythm: target difficulty band per UTC weekday (0=Sun)
const BAND: Record<number, [number, number]> = {
  1: [0.0, 0.15], // Mon: gimme
  2: [0.1, 0.3],
  3: [0.2, 0.45],
  4: [0.3, 0.6],
  5: [0.45, 0.8], // Fri: hard
  6: [0.5, 0.9], // Sat: hardest
  0: [0.15, 0.4], // Sun: comfortable
};

// keep existing hand-curated entries if the file exists (idempotent regen)
const existing: ReadableSchedule = existsSync(readablePath)
  ? (JSON.parse(readFileSync(readablePath, "utf8")) as ReadableSchedule)
  : { mode: "daily-ticker", epoch: DAILY_TICKER_EPOCH, snapshotVersion, days: {} };

const byId = new Map(scored.map((c) => [c.id, c]));
const recentlyUsed = new Map<string, number>(); // id → day index last used
const days: ReadableSchedule["days"] = {};

for (let d = 0; d < DAYS; d++) {
  const date = new Date(Date.parse(existing.epoch) + d * 86_400_000).toISOString().slice(0, 10);
  const prior = existing.days[date];
  if (prior && byId.has(prior.id)) {
    days[date] = prior; // hand-curated day survives regeneration
    recentlyUsed.set(prior.id, d);
    continue;
  }
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  const [lo, hi] = BAND[weekday];
  // widen the band progressively if the no-repeat window exhausted it
  let candidates: typeof scored = [];
  for (let widen = 0; candidates.length === 0 && widen <= 10; widen++) {
    const wLo = Math.max(0, lo - widen * 0.05);
    const wHi = Math.min(1, hi + widen * 0.05);
    candidates = scored.filter((c) => {
      const last = recentlyUsed.get(c.id);
      return (
        c.difficulty >= wLo &&
        c.difficulty <= wHi &&
        (last === undefined || d - last > NO_REPEAT_WINDOW)
      );
    });
  }
  const pick = candidates[hashDate(date) % candidates.length];
  days[date] = { id: pick.id, name: pick.name, difficulty: pick.difficulty };
  recentlyUsed.set(pick.id, d);
}

const readable: ReadableSchedule = {
  mode: "daily-ticker",
  epoch: existing.epoch,
  snapshotVersion,
  days,
};
writeFileSync(readablePath, JSON.stringify(readable, null, 2));
console.log(
  `proposed ${DAYS} days from ${existing.epoch} → puzzles/daily.json (review/edit, then --emit-only)`,
);
emitArtifact(readable);
