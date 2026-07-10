/**
 * Chart Detective (ROADMAP §1.5): 5 progressive hints, each costing points;
 * guess anytime. Pure logic — the UI just walks the ladder.
 */
import type { GameCompany } from "./feedback.ts";

export type HintKind = "sector" | "capBracket" | "country" | "ipoDecade" | "firstLetter";

export const HINT_LADDER: { kind: HintKind; label: string; cost: number }[] = [
  { kind: "sector", label: "Sector", cost: 100 },
  { kind: "capBracket", label: "Size", cost: 125 },
  { kind: "country", label: "Country", cost: 150 },
  { kind: "ipoDecade", label: "Listed since", cost: 175 },
  { kind: "firstLetter", label: "First letter", cost: 200 },
];

const WRONG_GUESS_COST = 75;

interface HintSource extends GameCompany {
  ipoYear?: number;
}

export function hintText(c: HintSource, kind: HintKind): string {
  switch (kind) {
    case "sector":
      return c.sector;
    case "capBracket":
      return `${c.capBracket} cap`;
    case "country": {
      const flag =
        /^[A-Z]{2}$/.test(c.country) &&
        String.fromCodePoint(
          0x1f1e6 - 65 + c.country.charCodeAt(0),
          0x1f1e6 - 65 + c.country.charCodeAt(1),
        );
      return flag || c.country;
    }
    case "ipoDecade":
      return c.ipoYear ? `${Math.floor(c.ipoYear / 10) * 10}s` : "IPO year unknown";
    case "firstLetter":
      return c.name[0].toUpperCase();
  }
}

/** 1000 minus ladder costs for hints taken (in order) and 75 per wrong guess; solves floor at 100. */
export function chartScore(hintsUsed: number, wrongGuesses: number, solved: boolean): number {
  if (!solved) return 0;
  const hintCost = HINT_LADDER.slice(0, hintsUsed).reduce((s, h) => s + h.cost, 0);
  return Math.max(100, 1000 - hintCost - wrongGuesses * WRONG_GUESS_COST);
}
