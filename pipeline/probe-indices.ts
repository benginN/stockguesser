/** Dev probe: try every index config against live Wikipedia, print counts + samples. */
import { INDICES } from "./config/indices.ts";
import { fetchConstituents } from "./steps/constituents.ts";

for (const cfg of INDICES) {
  try {
    const rows = await fetchConstituents(cfg);
    const sample = rows
      .slice(0, 3)
      .map((r) => `${r.rawTicker}→${r.yahooSymbol} "${r.name}"${r.sector ? ` [${r.sector}]` : ""}`)
      .join(" | ");
    console.log(`  OK  ${cfg.id}: ${sample}`);
  } catch (err) {
    console.log(`  FAIL ${cfg.id}: ${(err as Error).message}`);
  }
}
