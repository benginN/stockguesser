/**
 * Pipeline orchestrator (ROADMAP §2.3):
 *   universe → constituents → enrich → FX → build → validate → emit
 * Run: npm run pipeline          (full)
 *      npm run pipeline -- --skip-sparklines   (faster dev loop)
 * Exits non-zero on any critical validation error.
 */
import { readFileSync } from "node:fs";
import { INDICES } from "./config/indices.ts";
import { log } from "./lib/util.ts";
import { fetchConstituents, type RawConstituent } from "./steps/constituents.ts";
import { fetchEdgarUniverse } from "./steps/universe.ts";
import { getQuotes, getProfiles, getSparklines } from "./steps/enrich.ts";
import { fetchFx, toUSD } from "./steps/fx.ts";
import { buildDataset } from "./steps/build.ts";
import { validateDataset } from "./steps/validate.ts";
import { emitArtifacts } from "./steps/emit.ts";

const SKIP_SPARKLINES = process.argv.includes("--skip-sparklines");
const TIER1_TARGET = 2500;
const TOTAL_TARGET = 5000;
const EDGAR_LIMIT = 4800;

const dataFile = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), "utf8")) as T;

// ---- scrape all index constituents (fail fast on count drift) ----
const constituents: RawConstituent[] = [];
for (const cfg of INDICES) constituents.push(...(await fetchConstituents(cfg)));

// ---- apply symbol overrides from the human-maintained escape hatch ----
const overrides = dataFile<{
  symbolOverrides: Record<string, { use: string; _why: string }>;
  companyOverrides: Record<string, never>;
}>("overrides.json");
for (const c of constituents) {
  const o = overrides.symbolOverrides[c.yahooSymbol];
  if (o) {
    log("override", `${c.yahooSymbol} → ${o.use} (${c.name})`);
    c.yahooSymbol = o.use;
  }
}

// ---- US universe + quotes for everything ----
const edgar = await fetchEdgarUniverse(EDGAR_LIMIT);
const indexSymbols = [...new Set(constituents.map((c) => c.yahooSymbol))];
const edgarSymbols = edgar.map((e) => e.ticker).filter((t) => !indexSymbols.includes(t));
log("universe", `${indexSymbols.length} index symbols + ${edgarSymbols.length} EDGAR extras`);

const quotes = await getQuotes([...indexSymbols, ...edgarSymbols]);

// ---- profiles: only for symbols that can make the final pool ----
const fx = await fetchFx();
const capOf = (s: string) => {
  const q = quotes.get(s);
  return q?.marketCap ? (toUSD(q.marketCap, q.currency ?? "USD", fx) ?? 0) : 0;
};
const rankedExtras = edgarSymbols
  .filter((s) => capOf(s) > 500e6)
  .sort((a, b) => capOf(b) - capOf(a));
const poolSymbols = [
  ...indexSymbols,
  ...rankedExtras.slice(0, TOTAL_TARGET + 800 - indexSymbols.length),
];
log("universe", `pool for profiling: ${poolSymbols.length} symbols`);

const profiles = await getProfiles(poolSymbols.filter((s) => quotes.has(s)));

// ---- build canonical dataset ----
const aliasesRaw = dataFile<Record<string, string[] | string>>("aliases.json");
const manualAliases = Object.fromEntries(
  Object.entries(aliasesRaw).filter(([k, v]) => !k.startsWith("_") && Array.isArray(v)),
) as Record<string, string[]>;

const { companies, indices, problems, symbolToCompany } = buildDataset({
  constituents,
  extraSymbols: rankedExtras.slice(0, TOTAL_TARGET + 800 - indexSymbols.length),
  quotes,
  profiles,
  fx,
  manualAliases,
  companyOverrides: overrides.companyOverrides,
  tier1Target: TIER1_TARGET,
  totalTarget: TOTAL_TARGET,
});

// ---- sparklines for tier-1 primary listings ----
let sparklines = new Map<string, number[]>();
if (!SKIP_SPARKLINES) {
  const tier1Primaries = companies
    .filter((c) => c.tier === 1)
    .map((c) => c.listings.find((l) => l.primary)!.ticker);
  sparklines = await getSparklines(tier1Primaries);
}

// ---- validate, emit ----
const { criticals, warnings } = validateDataset(companies, indices, problems);
for (const w of warnings.slice(0, 30)) console.warn("  warn:", w);
if (warnings.length > 30) console.warn(`  … and ${warnings.length - 30} more warnings`);
if (criticals.length > 0) {
  console.error(`\n${criticals.length} CRITICAL error(s):`);
  for (const c of criticals) console.error("  ", c);
  process.exit(1);
}

const snapshotVersion = new Date().toISOString().slice(0, 10);
const stats = emitArtifacts(companies, indices, sparklines, symbolToCompany, snapshotVersion);

if (stats.searchIndexGzipKB > 300) {
  console.error(
    `search-index.json is ${stats.searchIndexGzipKB.toFixed(0)} KB gzipped (budget 300)`,
  );
  process.exit(1);
}
log("done", `snapshot ${snapshotVersion} emitted to public/data ✓`);
