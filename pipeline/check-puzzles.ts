/**
 * Puzzle-integrity gate (ROADMAP §6 refresh safety): every daily answer
 * scheduled for the next 90 days must still exist — and stay Tier 1 — in the
 * freshly generated snapshot. Runs in the weekly refresh workflow so a
 * delisting/M&A can never silently break an upcoming puzzle; the app's
 * deterministic fallback remains the last-resort safety net.
 */
import { readFileSync } from "node:fs";

const HORIZON_DAYS = 90;
const ROOT = new URL("..", import.meta.url);

const schedule = JSON.parse(readFileSync(new URL("./puzzles/daily.json", ROOT), "utf8")) as {
  days: Record<string, { id: string; name: string }>;
};
const { companies } = JSON.parse(
  readFileSync(new URL("./public/data/stocks.json", ROOT), "utf8"),
) as { companies: { id: string; tier: number }[] };

const tierOf = new Map(companies.map((c) => [c.id, c.tier]));
const today = Date.now();
const problems: string[] = [];

for (const [date, entry] of Object.entries(schedule.days)) {
  const dayOffset = (Date.parse(date) - today) / 86_400_000;
  if (dayOffset < -1 || dayOffset > HORIZON_DAYS) continue;
  const tier = tierOf.get(entry.id);
  if (tier === undefined) {
    problems.push(`${date}: scheduled answer "${entry.name}" (${entry.id}) vanished from the snapshot`);
  } else if (tier !== 1) {
    problems.push(`${date}: scheduled answer "${entry.name}" (${entry.id}) dropped to tier ${tier}`);
  }
}

if (problems.length > 0) {
  console.error(`PUZZLE INTEGRITY: ${problems.length} problem(s) in the next ${HORIZON_DAYS} days:`);
  for (const p of problems) console.error("  " + p);
  console.error("Fix: edit puzzles/daily.json (swap the affected days), then `tsx puzzles/generate-daily.ts --emit-only`.");
  process.exit(1);
}
console.log(`puzzle integrity OK: next ${HORIZON_DAYS} days of answers exist in the snapshot`);
