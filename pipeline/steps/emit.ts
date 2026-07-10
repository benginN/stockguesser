/**
 * Emit the static artifacts the app serves (ROADMAP §2.3), plus size checks.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Company, IndexOut } from "./build.ts";
import { log } from "../lib/util.ts";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "data");

export interface EmitStats {
  files: Record<string, { bytes: number; gzipBytes: number }>;
  searchIndexGzipKB: number;
}

export function emitArtifacts(
  companies: Company[],
  indices: IndexOut[],
  sparklines: Map<string, number[]>,
  symbolToCompany: Map<string, Company>,
  snapshotVersion: string,
): EmitStats {
  mkdirSync(OUT_DIR, { recursive: true });
  const stats: EmitStats = { files: {}, searchIndexGzipKB: 0 };

  const write = (name: string, data: unknown) => {
    const json = JSON.stringify(data);
    writeFileSync(join(OUT_DIR, name), json);
    const gz = gzipSync(json).length;
    stats.files[name] = { bytes: json.length, gzipBytes: gz };
    log(
      "emit",
      `${name.padEnd(20)} ${(json.length / 1024).toFixed(0).padStart(6)} KB  (${(gz / 1024).toFixed(0)} KB gz)`,
    );
  };

  write("stocks.json", { snapshotVersion, companies });
  write("indices.json", { snapshotVersion, indices });

  // sparklines keyed by company id (primary listing's series)
  const sparkById: Record<string, number[]> = {};
  for (const [symbol, series] of sparklines) {
    const company = symbolToCompany.get(symbol);
    if (company?.tier === 1 && !sparkById[company.id]) sparkById[company.id] = series;
  }
  write("sparklines.json", { snapshotVersion, sparklines: sparkById });

  // slim search index for the client autocomplete
  const searchIndex = companies.map((c) => ({
    id: c.id,
    ticker: c.listings.find((l) => l.primary)!.ticker,
    name: c.name,
    aliases: c.aliases,
    tier: c.tier,
  }));
  write("search-index.json", { snapshotVersion, entries: searchIndex });
  stats.searchIndexGzipKB = stats.files["search-index.json"].gzipBytes / 1024;

  write("meta.json", {
    snapshotVersion,
    generatedAt: new Date().toISOString(),
    counts: {
      companies: companies.length,
      tier1: companies.filter((c) => c.tier === 1).length,
      indices: indices.length,
      sparklines: Object.keys(sparkById).length,
    },
  });

  return stats;
}
