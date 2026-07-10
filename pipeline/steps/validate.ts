/**
 * Validation IS the pipeline's test suite (ROADMAP §6): Zod schemas, referential
 * integrity, sanity ranges, per-index counts. Criticals fail the run loudly.
 */
import { z } from "zod";
import type { Company, IndexOut, BuildProblem } from "./build.ts";
import { INDICES } from "../config/indices.ts";
import { SECTORS } from "../config/taxonomy.ts";
import { log } from "../lib/util.ts";

const RegionSchema = z.enum([
  "North America",
  "Latin America",
  "Europe",
  "Middle East & Africa",
  "Asia",
  "Oceania",
]);

export const CompanySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  listings: z
    .array(z.object({ ticker: z.string().min(1), exchange: z.string(), primary: z.boolean() }))
    .min(1)
    .refine((l) => l.filter((x) => x.primary).length === 1, "exactly one primary listing"),
  country: z.string().length(2),
  region: RegionSchema,
  sector: z.enum(SECTORS),
  industry: z.string().min(1),
  marketCapUSD: z
    .number()
    .min(50e6, "cap under $50M — junk or parse error")
    .max(10e12, "cap over $10T — currency conversion bug"),
  capBracket: z.enum(["Small", "Mid", "Large", "Mega"]),
  currency: z.string().min(3),
  ipoYear: z.number().min(1780).max(2026).optional(),
  employees: z.number().positive().optional(),
  website: z.string().optional(),
  indexMemberships: z.array(z.string()),
  tier: z.union([z.literal(1), z.literal(2)]),
  updatedAt: z.string(),
});

export const IndexSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  provider: z.string(),
  region: z.union([RegionSchema, z.literal("Global")]),
  holdings: z.array(z.object({ companyId: z.string(), weight: z.number().optional() })).min(10),
  source: z.string().url(),
  updatedAt: z.string(),
});

export function validateDataset(
  companies: Company[],
  indices: IndexOut[],
  buildProblems: BuildProblem[],
): { criticals: string[]; warnings: string[] } {
  const criticals: string[] = buildProblems
    .filter((p) => p.level === "critical")
    .map((p) => `[build] ${p.symbol}: ${p.message}`);
  const warnings: string[] = buildProblems
    .filter((p) => p.level === "warn")
    .map((p) => `[build] ${p.symbol}: ${p.message}`);

  // schema
  for (const c of companies) {
    const r = CompanySchema.safeParse(c);
    if (!r.success)
      criticals.push(
        `[schema] ${c.id}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
  }
  for (const ix of indices) {
    const r = IndexSchema.safeParse(ix);
    if (!r.success)
      criticals.push(
        `[schema] ${ix.id}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
  }

  // uniqueness + referential integrity
  const ids = new Set<string>();
  for (const c of companies) {
    if (ids.has(c.id)) criticals.push(`[integrity] duplicate company id: ${c.id}`);
    ids.add(c.id);
  }
  for (const ix of indices) {
    for (const h of ix.holdings) {
      if (!ids.has(h.companyId))
        criticals.push(`[integrity] ${ix.id} holds unknown company ${h.companyId}`);
    }
    const cfg = INDICES.find((i) => i.id === ix.id)!;
    // holdings are companies (dual classes merged), so allow undershoot slightly beyond tolerance
    const merged = 3;
    if (
      ix.holdings.length > cfg.expectedCount + cfg.countTolerance ||
      ix.holdings.length < cfg.expectedCount - cfg.countTolerance - merged
    ) {
      criticals.push(
        `[counts] ${ix.id}: ${ix.holdings.length} holdings vs expected ${cfg.expectedCount}±${cfg.countTolerance}(+${merged} class merges)`,
      );
    }
    const weightSum = ix.holdings.reduce((s, h) => s + (h.weight ?? 0), 0);
    if (Math.abs(weightSum - 100) > 1.5)
      warnings.push(`[weights] ${ix.id}: weights sum to ${weightSum.toFixed(1)}%`);
    // memberships backlink
    for (const h of ix.holdings) {
      const c = companies.find((c) => c.id === h.companyId);
      if (c && !c.indexMemberships.includes(ix.id))
        criticals.push(`[integrity] ${h.companyId} in ${ix.id} holdings but missing backlink`);
    }
  }

  // pool sizes (Phase 1 acceptance)
  const tier1 = companies.filter((c) => c.tier === 1).length;
  if (tier1 < 2000) criticals.push(`[pools] tier-1 pool ${tier1} < 2000`);
  if (companies.length < 4000) criticals.push(`[pools] total pool ${companies.length} < 4000`);

  log("validate", `${criticals.length} criticals, ${warnings.length} warnings`);
  return { criticals, warnings };
}
