import { describe, expect, it } from "vitest";
import { buildShareText, shareRow } from "../src/game/share.ts";
import type { Feedback } from "../src/game/feedback.ts";

const fb = (over: Partial<Feedback> = {}): Feedback => ({
  isCorrect: false,
  sector: { state: "gray" },
  industry: { state: "yellow" },
  country: { state: "gray" },
  cap: { state: "gray", direction: "down" },
  indexOverlap: { state: "gray", shared: [] },
  ...over,
});

describe("shareRow", () => {
  it("renders Appendix-E column order with cap arrow", () => {
    expect(shareRow(fb())).toBe("⬜🟨⬜⬇️⬜");
  });
  it("all-green winning row uses 🟩 in the cap column (no arrow)", () => {
    const win = fb({
      isCorrect: true,
      sector: { state: "green" },
      industry: { state: "green" },
      country: { state: "green" },
      cap: { state: "green", direction: null },
      indexOverlap: { state: "green", shared: ["dax"] },
    });
    expect(shareRow(win)).toBe("🟩🟩🟩🟩🟩");
  });
  it("yellow cap still shows the direction arrow", () => {
    expect(shareRow(fb({ cap: { state: "yellow", direction: "up" } }))).toContain("⬆️");
  });
});

describe("buildShareText", () => {
  const rows = [fb(), fb({ cap: { state: "yellow", direction: "up" } })];

  it("matches the Appendix E format for a win with streak", () => {
    const text = buildShareText({
      puzzleNumber: 128,
      won: true,
      guessCount: 3,
      maxGuesses: 6,
      streak: 12,
      feedbacks: rows,
      url: "https://example.com",
    });
    expect(text.split("\n")[0]).toBe("Daily Ticker #128 3/6 🔥12");
    expect(text.endsWith("https://example.com")).toBe(true);
  });
  it("loss shows X/6 and no flame", () => {
    const text = buildShareText({
      puzzleNumber: 5,
      won: false,
      guessCount: 6,
      maxGuesses: 6,
      streak: 0,
      feedbacks: rows,
      url: "u",
    });
    expect(text.split("\n")[0]).toBe("Daily Ticker #5 X/6");
  });
  it("never leaks an answer-shaped string", () => {
    const text = buildShareText({
      puzzleNumber: 1,
      won: true,
      guessCount: 1,
      maxGuesses: 6,
      streak: 1,
      feedbacks: [fb()],
      url: "u",
    });
    expect(text).not.toMatch(/[a-z]{3,}-[a-z]{3,}/); // no company slugs
  });
});
