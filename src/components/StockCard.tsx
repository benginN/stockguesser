/**
 * The teaching moment (ROADMAP §1.1): every game ends on a fact-rich card.
 * Facts are GENERATED from structured fields — never third-party text (§2.6).
 */
import type { CompanyRecord } from "../lib/data.ts";
import { flagEmoji, formatCap } from "../lib/format.ts";
import { generateFacts } from "../lib/facts.ts";
import Sparkline from "./Sparkline.tsx";

interface Props {
  company: CompanyRecord;
  allCompanies: CompanyRecord[];
  sparkline?: number[];
  indexNames: (id: string) => string;
}

export default function StockCard({ company: c, allCompanies, sparkline, indexNames }: Props) {
  const ticker = c.listings.find((l) => l.primary)?.ticker ?? c.listings[0].ticker;
  return (
    <div className="border-terminal-line bg-terminal-panel space-y-3 rounded-md border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-accent min-w-0 truncate text-xl font-bold">
          <span aria-hidden>{flagEmoji(c.country)}</span> {c.name}
        </p>
        <p className="font-data text-terminal-dim shrink-0 text-sm">{ticker}</p>
      </div>
      <p className="font-data text-terminal-dim text-xs">
        {c.sector} · {c.industry} · {formatCap(c.marketCapUSD)} ({c.capBracket})
      </p>
      {sparkline && (
        <div>
          <Sparkline series={sparkline} className="h-16 w-full" />
          <p className="text-terminal-dim mt-0.5 text-right text-[9px] tracking-wider uppercase">
            5y · weekly · indexed
          </p>
        </div>
      )}
      <ul className="space-y-1 text-sm">
        {generateFacts(c, allCompanies, indexNames).map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-accent" aria-hidden>
              ▸
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
