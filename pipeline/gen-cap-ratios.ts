/**
 * Regenerate pipeline/data/cap-ratios.json from the local quote cache.
 *
 * Yahoo strips marketCap (all endpoints) for a subset of symbols on most
 * datacenter IPs while prices keep flowing, so CI recovers caps as
 * ratio × fresh price. The ratio is marketCap/price — the share count for
 * most symbols, shares/100 for GBp listings (price in pence, cap in pounds) —
 * and it drifts only with buybacks/dilution, so a months-old value is fine.
 *
 * Usage: tsx pipeline/gen-cap-ratios.ts  (after a complete local pipeline run)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, ".cache");
const OUT = join(HERE, "data", "cap-ratios.json");

// oldest first, so the newest cache entry for a symbol wins
const files = readdirSync(CACHE_DIR)
  .map((f) => join(CACHE_DIR, f))
  .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);

const ratios: Record<string, number> = {};
for (const f of files) {
  try {
    const { v } = JSON.parse(readFileSync(f, "utf8")) as {
      v?: { symbol?: unknown; marketCap?: unknown; price?: unknown };
    };
    if (
      v &&
      typeof v.symbol === "string" &&
      typeof v.marketCap === "number" &&
      typeof v.price === "number" &&
      v.price > 0
    )
      ratios[v.symbol] = Math.round(v.marketCap / v.price);
  } catch {
    /* not a memo file */
  }
}

const sorted = Object.fromEntries(Object.entries(ratios).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`${Object.keys(sorted).length} symbols → ${OUT}`);
