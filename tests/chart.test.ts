/** Chart Detective hint ladder + scoring (ROADMAP §1.5), tests first. */
import { describe, expect, it } from "vitest";
import { chartScore, HINT_LADDER, hintText } from "../src/game/chart.ts";
import type { CompanyRecord } from "../src/lib/data.ts";

const sap = {
  id: "sap",
  name: "SAP",
  sector: "Information Technology",
  industry: "Software",
  country: "DE",
  region: "Europe",
  marketCapUSD: 300e9,
  capBracket: "Mega",
  indexMemberships: ["dax"],
  aliases: [],
  listings: [{ ticker: "SAP.DE", exchange: "XETRA", primary: true }],
  currency: "EUR",
  ipoYear: 1988,
  tier: 1,
} as CompanyRecord;

describe("HINT_LADDER", () => {
  it("has exactly 5 hints in spec order", () => {
    expect(HINT_LADDER.map((h) => h.kind)).toEqual([
      "sector",
      "capBracket",
      "country",
      "ipoDecade",
      "firstLetter",
    ]);
  });
});

describe("hintText", () => {
  it.each([
    ["sector", "Information Technology"],
    ["capBracket", "Mega"],
    ["country", "🇩🇪"],
    ["ipoDecade", "1980s"],
    ["firstLetter", "S"],
  ] as const)("%s hint reveals %s", (kind, contains) => {
    expect(hintText(sap, kind)).toContain(contains);
  });
  it("never contains the company name or ticker", () => {
    for (const h of HINT_LADDER) {
      const text = hintText(sap, h.kind);
      expect(text).not.toMatch(/SAP/i);
    }
  });
  it("handles missing ipoYear gracefully", () => {
    expect(hintText({ ...sap, ipoYear: undefined }, "ipoDecade")).toContain("unknown");
  });
});

describe("chartScore", () => {
  it("no hints, first guess: full 1000", () => {
    expect(chartScore(0, 0, true)).toBe(1000);
  });
  it("each hint deducts its cost in ladder order", () => {
    const oneHint = chartScore(1, 0, true);
    const twoHints = chartScore(2, 0, true);
    expect(oneHint).toBe(1000 - HINT_LADDER[0].cost);
    expect(twoHints).toBe(1000 - HINT_LADDER[0].cost - HINT_LADDER[1].cost);
  });
  it("wrong guesses cost 75 each", () => {
    expect(chartScore(0, 2, true)).toBe(850);
  });
  it("a solve never scores below 100", () => {
    expect(chartScore(5, 10, true)).toBe(100);
  });
  it("giving up scores 0", () => {
    expect(chartScore(3, 1, false)).toBe(0);
  });
});
