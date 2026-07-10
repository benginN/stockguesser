/**
 * Appendix D feedback rules, table-driven. Written BEFORE the implementation
 * (ROADMAP §8.4). Companies are minimal fixtures; only game-relevant fields.
 */
import { describe, expect, it } from "vitest";
import { compareGuess, type GameCompany } from "../src/game/feedback.ts";

const co = (partial: Partial<GameCompany> & { id: string }): GameCompany => ({
  name: partial.id,
  sector: "Information Technology",
  industry: "Software",
  country: "US",
  region: "North America",
  marketCapUSD: 100e9,
  capBracket: "Large",
  indexMemberships: [],
  ...partial,
});

// answer fixture: SAP-like company
const sap = co({
  id: "sap",
  sector: "Information Technology",
  industry: "Software",
  country: "DE",
  region: "Europe",
  marketCapUSD: 300e9,
  capBracket: "Mega",
  indexMemberships: ["dax", "eurostoxx50"],
});

describe("sector feedback (green/gray only)", () => {
  it("green on exact sector", () => {
    const f = compareGuess(co({ id: "x", sector: "Information Technology" }), sap);
    expect(f.sector.state).toBe("green");
  });
  it("gray on different sector — no yellow exists for sector", () => {
    const f = compareGuess(co({ id: "x", sector: "Energy" }), sap);
    expect(f.sector.state).toBe("gray");
  });
});

describe("industry feedback", () => {
  it("green on exact industry", () => {
    const f = compareGuess(co({ id: "x", industry: "Software" }), sap);
    expect(f.industry.state).toBe("green");
  });
  it("yellow when same sector, different industry", () => {
    const f = compareGuess(
      co({ id: "x", sector: "Information Technology", industry: "Semiconductors" }),
      sap,
    );
    expect(f.industry.state).toBe("yellow");
  });
  it("gray when different sector and industry", () => {
    const f = compareGuess(co({ id: "x", sector: "Energy", industry: "Oil & Gas" }), sap);
    expect(f.industry.state).toBe("gray");
  });
  it("same industry name under different sector is still green (industry equality wins)", () => {
    const f = compareGuess(co({ id: "x", sector: "Financials", industry: "Software" }), sap);
    expect(f.industry.state).toBe("green");
  });
});

describe("country feedback", () => {
  it("green on exact country", () => {
    const f = compareGuess(co({ id: "x", country: "DE", region: "Europe" }), sap);
    expect(f.country.state).toBe("green");
  });
  it("yellow on same region", () => {
    const f = compareGuess(co({ id: "x", country: "FR", region: "Europe" }), sap);
    expect(f.country.state).toBe("yellow");
  });
  it("gray on different region", () => {
    const f = compareGuess(co({ id: "x", country: "JP", region: "Asia" }), sap);
    expect(f.country.state).toBe("gray");
  });
});

describe("market cap feedback", () => {
  it("green within +10% of answer", () => {
    const f = compareGuess(co({ id: "x", marketCapUSD: 330e9 }), sap);
    expect(f.cap.state).toBe("green");
    expect(f.cap.direction).toBeNull(); // arrow hidden when green
  });
  it("green within -10% of answer", () => {
    const f = compareGuess(co({ id: "x", marketCapUSD: 272e9 }), sap);
    expect(f.cap.state).toBe("green");
  });
  it("edge: exactly +10% is green", () => {
    const f = compareGuess(co({ id: "x", marketCapUSD: 330e9 }), sap);
    expect(f.cap.state).toBe("green");
  });
  it("edge: 10.5% over is NOT green but same bracket → yellow, arrow down", () => {
    const f = compareGuess(co({ id: "x", marketCapUSD: 331.5e9, capBracket: "Mega" }), sap);
    expect(f.cap.state).toBe("yellow");
    expect(f.cap.direction).toBe("down"); // answer is smaller than guess
  });
  it("same bracket, far off → yellow with arrow up", () => {
    const f = compareGuess(co({ id: "x", marketCapUSD: 210e9, capBracket: "Mega" }), sap);
    expect(f.cap.state).toBe("yellow");
    expect(f.cap.direction).toBe("up"); // answer is larger than guess
  });
  it("different bracket → gray with arrow up", () => {
    const f = compareGuess(co({ id: "x", marketCapUSD: 5e9, capBracket: "Mid" }), sap);
    expect(f.cap.state).toBe("gray");
    expect(f.cap.direction).toBe("up");
  });
  it("identical caps → green, no arrow", () => {
    const f = compareGuess(co({ id: "x", marketCapUSD: 300e9 }), sap);
    expect(f.cap.state).toBe("green");
    expect(f.cap.direction).toBeNull();
  });
});

describe("index overlap feedback", () => {
  it("green when sharing at least one index, lists shared", () => {
    const f = compareGuess(co({ id: "x", indexMemberships: ["dax", "sp500"] }), sap);
    expect(f.indexOverlap.state).toBe("green");
    expect(f.indexOverlap.shared).toEqual(["dax"]);
  });
  it("green with multiple shared indices", () => {
    const f = compareGuess(co({ id: "x", indexMemberships: ["eurostoxx50", "dax"] }), sap);
    expect(f.indexOverlap.shared).toEqual(["dax", "eurostoxx50"]);
  });
  it("gray when no overlap", () => {
    const f = compareGuess(co({ id: "x", indexMemberships: ["sp500"] }), sap);
    expect(f.indexOverlap.state).toBe("gray");
    expect(f.indexOverlap.shared).toEqual([]);
  });
  it("gray when both have no memberships (no vacuous green)", () => {
    const answerNoIdx = co({ id: "a", indexMemberships: [] });
    const f = compareGuess(co({ id: "x", indexMemberships: [] }), answerNoIdx);
    expect(f.indexOverlap.state).toBe("gray");
  });
});

describe("whole-row: exact company", () => {
  it("guessing the answer itself is all green + isCorrect", () => {
    const f = compareGuess(sap, sap);
    expect(f.isCorrect).toBe(true);
    expect([f.sector, f.industry, f.country].every((a) => a.state === "green")).toBe(true);
    expect(f.cap.state).toBe("green");
    expect(f.indexOverlap.state).toBe("green");
  });
  it("dual-listing scenario: same company id means correct regardless of typed listing", () => {
    // GOOG vs GOOGL both resolve to company id "alphabet" upstream — feedback
    // only ever sees company records, so identical ids must be correct.
    const alphabet = co({ id: "alphabet", indexMemberships: ["sp500", "nasdaq100"] });
    expect(compareGuess(alphabet, alphabet).isCorrect).toBe(true);
  });
});
