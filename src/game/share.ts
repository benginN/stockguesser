/**
 * Spoiler-free share text (ROADMAP Appendix E). Pure and testable.
 * Column order matches Appendix D; cap column shows an arrow when not green.
 * Never includes the answer, guessed names, or anything date-derivable.
 */
import type { Feedback, TileState } from "./feedback.ts";

const EMOJI: Record<TileState, string> = { green: "🟩", yellow: "🟨", gray: "⬜" };

export function shareRow(f: Feedback): string {
  const cap = f.cap.state === "green" ? "🟩" : f.cap.direction === "up" ? "⬆️" : "⬇️";
  return (
    EMOJI[f.sector.state] +
    EMOJI[f.industry.state] +
    EMOJI[f.country.state] +
    cap +
    EMOJI[f.indexOverlap.state]
  );
}

export function buildShareText(opts: {
  puzzleNumber: number;
  won: boolean;
  guessCount: number;
  maxGuesses: number;
  streak: number;
  feedbacks: Feedback[];
  url: string;
}): string {
  const score = opts.won ? `${opts.guessCount}/${opts.maxGuesses}` : `X/${opts.maxGuesses}`;
  const flame = opts.won && opts.streak > 1 ? ` 🔥${opts.streak}` : "";
  const header = `Daily Ticker #${opts.puzzleNumber} ${score}${flame}`;
  const grid = opts.feedbacks.map(shareRow).join("\n");
  return `${header}\n${grid}\n${opts.url}`;
}
