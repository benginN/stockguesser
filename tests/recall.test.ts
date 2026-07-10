/** Index Recall engine rules (ROADMAP §1.2), written before implementation. */
import { describe, expect, it } from "vitest";
import { matchRemaining, recallScore, timeLimitFor } from "../src/game/recall.ts";
import type { Matchable } from "../src/game/matching.ts";

const pool: Matchable[] = [
  { id: "sap", name: "SAP", ticker: "SAP.DE", aliases: ["sap se", "sap"] },
  { id: "siemens", name: "Siemens", ticker: "SIE.DE", aliases: ["siemens", "sie"] },
  {
    id: "bayerische-motoren-werke",
    name: "Bayerische Motoren Werke",
    ticker: "BMW.DE",
    aliases: ["bmw", "bayerische motoren werke"],
  },
  {
    id: "siemens-energy",
    name: "Siemens Energy",
    ticker: "ENR.DE",
    aliases: ["siemens energy", "enr"],
  },
];

describe("matchRemaining", () => {
  it("matches by alias", () => {
    expect(matchRemaining("bmw", pool)?.id).toBe("bayerische-motoren-werke");
  });
  it("prefers exact name over prefix cousin (Siemens vs Siemens Energy)", () => {
    expect(matchRemaining("siemens", pool)?.id).toBe("siemens");
  });
  it("still finds the longer name explicitly", () => {
    expect(matchRemaining("siemens energy", pool)?.id).toBe("siemens-energy");
  });
  it("returns undefined for lazy 2-char guesses", () => {
    expect(matchRemaining("si", pool)).toBeUndefined();
  });
  it("returns undefined when the company was already revealed (not in remaining)", () => {
    const remaining = pool.filter((c) => c.id !== "sap");
    expect(matchRemaining("sap", remaining)).toBeUndefined();
  });
});

describe("timeLimitFor", () => {
  it("gives 5:00 for a 40-stock index (7.5s per stock)", () => {
    expect(timeLimitFor(40)).toBe(300);
  });
  it("clamps small indices up to at least 2 minutes", () => {
    expect(timeLimitFor(10)).toBe(120);
  });
  it("clamps huge indices to 30 minutes", () => {
    expect(timeLimitFor(500)).toBe(1800);
  });
});

describe("recallScore", () => {
  it("full recall with time left beats full recall at the buzzer", () => {
    const fast = recallScore(40, 40, 100, 300);
    const slow = recallScore(40, 40, 300, 300);
    expect(fast).toBeGreaterThan(slow);
  });
  it("naming more always beats naming fewer, regardless of time", () => {
    const more = recallScore(30, 40, 300, 300);
    const fewer = recallScore(20, 40, 1, 300);
    expect(more).toBeGreaterThan(fewer);
  });
  it("zen mode (no limit) scores on completion only", () => {
    expect(recallScore(20, 40, 9999, undefined)).toBe(500);
  });
  it("zero named is zero", () => {
    expect(recallScore(0, 40, 10, 300)).toBe(0);
  });
});
