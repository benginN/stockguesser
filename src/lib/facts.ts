/**
 * Stock-card fact lines, GENERATED from structured fields — never third-party
 * text (ROADMAP §2.6). Pure so it can be tested and reused by future modes.
 */
import type { CompanyRecord } from "./data.ts";
import { formatNumber } from "./format.ts";

export function generateFacts(
  c: CompanyRecord,
  pool: CompanyRecord[],
  indexNames: (id: string) => string,
): string[] {
  const facts: string[] = [];

  const sectorPeers = pool.filter((x) => x.sector === c.sector);
  const rank = sectorPeers.filter((x) => x.marketCapUSD > c.marketCapUSD).length + 1;
  facts.push(
    rank === 1
      ? `The largest of ${formatNumber(sectorPeers.length)} ${c.sector} companies in this pool`
      : `#${rank} of ${formatNumber(sectorPeers.length)} ${c.sector} companies in this pool by market cap`,
  );

  if (c.indexMemberships.length > 0) {
    facts.push(`Member of ${c.indexMemberships.map(indexNames).join(" & ")}`);
  }
  if (c.ipoYear) facts.push(`Publicly traded since ${c.ipoYear}`);
  if (c.employees) facts.push(`≈${formatNumber(c.employees)} employees`);
  return facts.slice(0, 3);
}
