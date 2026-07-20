/**
 * Human-readable diff between the committed public/data snapshot and the
 * freshly generated one — printed into the weekly refresh PR body so the
 * reviewer sees "what changed" at a glance (ROADMAP §2.3).
 *
 * Usage: tsx pipeline/diff-report.ts <old-stocks.json> <new-stocks.json> [old-indices.json new-indices.json]
 */
import { readFileSync } from "node:fs";
import type { Company, IndexOut } from "./steps/build.ts";

const [oldStocksPath, newStocksPath, oldIndicesPath, newIndicesPath] = process.argv.slice(2);
if (!oldStocksPath || !newStocksPath) {
  console.error(
    "usage: tsx pipeline/diff-report.ts <old-stocks.json> <new-stocks.json> [old-indices.json new-indices.json]",
  );
  process.exit(2);
}

const load = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const oldStocks = load<{ snapshotVersion: string; companies: Company[] }>(oldStocksPath);
const newStocks = load<{ snapshotVersion: string; companies: Company[] }>(newStocksPath);

const oldById = new Map(oldStocks.companies.map((c) => [c.id, c]));
const newById = new Map(newStocks.companies.map((c) => [c.id, c]));

const added = newStocks.companies.filter((c) => !oldById.has(c.id));
const removed = oldStocks.companies.filter((c) => !newById.has(c.id));
const capMoves: string[] = [];
for (const c of newStocks.companies) {
  const prev = oldById.get(c.id);
  if (!prev) continue;
  const change = c.marketCapUSD / prev.marketCapUSD - 1;
  if (Math.abs(change) > 0.05) {
    capMoves.push(
      `${c.name}: ${(change * 100).toFixed(1)}% (${(prev.marketCapUSD / 1e9).toFixed(0)}B → ${(c.marketCapUSD / 1e9).toFixed(0)}B)`,
    );
  }
}

console.log(`# Data refresh: ${oldStocks.snapshotVersion} → ${newStocks.snapshotVersion}\n`);
console.log(`- Companies: ${oldStocks.companies.length} → ${newStocks.companies.length}`);
console.log(`- Caps moved >5%: ${capMoves.length}`);
console.log(
  `- Added: ${added.length}${
    added.length
      ? " — " +
        added
          .slice(0, 15)
          .map((c) => c.name)
          .join(", ") +
        (added.length > 15 ? "…" : "")
      : ""
  }`,
);
console.log(
  `- Removed: ${removed.length}${
    removed.length
      ? " — " +
        removed
          .slice(0, 15)
          .map((c) => c.name)
          .join(", ") +
        (removed.length > 15 ? "…" : "")
      : ""
  }`,
);

if (oldIndicesPath && newIndicesPath) {
  const oldIx = load<{ indices: IndexOut[] }>(oldIndicesPath).indices;
  const newIx = load<{ indices: IndexOut[] }>(newIndicesPath).indices;
  // Section only appears when something changed — the refresh workflow keys
  // auto-merge off its absence (membership changes wait for human review).
  const changes: string[] = [];
  for (const ix of newIx) {
    const prev = oldIx.find((i) => i.id === ix.id);
    if (!prev) {
      changes.push(`- ${ix.displayName}: NEW index (${ix.holdings.length} holdings)`);
      continue;
    }
    const prevIds = new Set(prev.holdings.map((h) => h.companyId));
    const currIds = new Set(ix.holdings.map((h) => h.companyId));
    const joined = [...currIds].filter((id) => !prevIds.has(id));
    const left = [...prevIds].filter((id) => !currIds.has(id));
    if (joined.length || left.length) {
      changes.push(
        `- ${ix.displayName}: ${joined.length ? `+${joined.join(", +")}` : ""}${joined.length && left.length ? "; " : ""}${left.length ? `-${left.join(", -")}` : ""}`,
      );
    }
  }
  if (changes.length > 0) {
    console.log(`\n## Index membership changes`);
    for (const line of changes) console.log(line);
    console.log(
      `\nRemoved companies still referenced by an active puzzle? Check puzzles/ before merging.`,
    );
  }
}
