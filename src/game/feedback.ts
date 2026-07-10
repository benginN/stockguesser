/**
 * Daily Ticker feedback calculator — ROADMAP Appendix D, implemented as a pure
 * function over company records from the pinned snapshot.
 */

export interface GameCompany {
  id: string;
  name: string;
  sector: string;
  industry: string;
  country: string; // ISO-3166 alpha-2
  region: string;
  marketCapUSD: number;
  capBracket: "Small" | "Mid" | "Large" | "Mega";
  indexMemberships: string[];
}

export type TileState = "green" | "yellow" | "gray";

export interface Feedback {
  isCorrect: boolean;
  sector: { state: TileState };
  industry: { state: TileState };
  country: { state: TileState };
  cap: { state: TileState; direction: "up" | "down" | null };
  indexOverlap: { state: TileState; shared: string[] };
}

export function compareGuess(guess: GameCompany, answer: GameCompany): Feedback {
  const sector: TileState = guess.sector === answer.sector ? "green" : "gray";

  const industry: TileState =
    guess.industry === answer.industry ? "green" : sector === "green" ? "yellow" : "gray";

  const country: TileState =
    guess.country === answer.country ? "green" : guess.region === answer.region ? "yellow" : "gray";

  // within ±10% of the answer's cap → green; ratio per Appendix D is guess/answer
  const withinTen = Math.abs(guess.marketCapUSD - answer.marketCapUSD) <= 0.1 * answer.marketCapUSD;
  const capState: TileState = withinTen
    ? "green"
    : guess.capBracket === answer.capBracket
      ? "yellow"
      : "gray";
  const direction: "up" | "down" | null = withinTen
    ? null
    : answer.marketCapUSD > guess.marketCapUSD
      ? "up"
      : "down";

  const shared = guess.indexMemberships.filter((i) => answer.indexMemberships.includes(i)).sort();

  return {
    isCorrect: guess.id === answer.id,
    sector: { state: sector },
    industry: { state: industry },
    country: { state: country },
    cap: { state: capState, direction },
    indexOverlap: { state: shared.length > 0 ? "green" : "gray", shared },
  };
}
