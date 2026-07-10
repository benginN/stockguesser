/**
 * Pipeline parser tests against REAL captured fixtures (ROADMAP §8.5) —
 * parsers are coded against actual payloads, not guesses.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseGenericTable,
  parseNikkeiList,
  toYahooSymbol,
} from "../pipeline/steps/constituents.ts";
import { INDICES } from "../pipeline/config/indices.ts";
import { normalizeName, slugify } from "../pipeline/lib/util.ts";
import { toUSD } from "../pipeline/steps/fx.ts";

const fixture = (name: string) =>
  gunzipSync(readFileSync(new URL(`../pipeline/fixtures/${name}`, import.meta.url))).toString(
    "utf8",
  );

describe("toYahooSymbol", () => {
  it.each([
    // [raw, suffix, expected]
    ["MMM", undefined, "MMM"],
    ["BRK.B", undefined, "BRK-B"], // US class shares: dot → dash
    ["BF.B", undefined, "BF-B"],
    ["BT.A", ".L", "BT-A.L"], // LSE class shares
    ["III", ".L", "III.L"],
    ["ADS.DE", ".DE", "ADS.DE"], // already qualified
    ["AIR.PA", ".DE", "AIR.PA"], // DAX lists Airbus on Paris — keep foreign suffix
    ["ATCO A", ".ST", "ATCO-A.ST"], // Swedish share classes use spaces
    ["SEHK: 5", ".HK", "0005.HK"], // Hong Kong: strip prefix, pad to 4
    ["388", ".HK", "0388.HK"],
    ["7203", ".T", "7203.T"], // Tokyo codes are numeric
    ["NOVN", ".SW", "NOVN.SW"],
  ])("%s + %s → %s", (raw, suffix, expected) => {
    expect(toYahooSymbol(raw, suffix)).toBe(expected);
  });
});

describe("normalizeName", () => {
  it.each([
    ["SAP SE", "sap"],
    ["Apple Inc.", "apple"],
    ["Toyota Motor Corp", "toyota motor"],
    ["Münchener Rück AG", "munchener ruck"], // umlaut folding
    ["ASTRAZENECA PLC", "astrazeneca"],
    ["Alphabet Inc. (Class A)", "alphabet inc class a"], // parenthetical stripped by displayName before this
    ["L'Oréal", "loreal"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });
});

describe("slugify", () => {
  it.each([
    ["Münchener Rück", "munchener-ruck"],
    ["AT&T", "at-and-t"],
    ["Berkshire Hathaway", "berkshire-hathaway"],
    ["L'Oréal", "l-oreal"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("toUSD", () => {
  const fx = { date: "2026-07-10", rates: { USD: 1, EUR: 0.87489, GBP: 0.74501, JPY: 161.87 } };
  it("USD passes through", () => expect(toUSD(100, "USD", fx)).toBe(100));
  it("EUR converts", () => expect(toUSD(87.489, "EUR", fx)).toBeCloseTo(100));
  it("GBp caps are already in GBP (Yahoo quirk)", () =>
    // AstraZeneca-style: cap reported ~£199B under currency "GBp"
    expect(toUSD(199_628_881_920, "GBp", fx)! / 1e9).toBeCloseTo(267.95, 1));
  it("unknown currency → undefined", () => expect(toUSD(1, "XXX", fx)).toBeUndefined());
});

describe("parseGenericTable against captured S&P 500 page", () => {
  const cfg = INDICES.find((i) => i.id === "sp500")!;
  const rows = parseGenericTable(fixture("wiki-sp500.html.gz"), cfg);

  it("finds ~503 constituents", () => {
    expect(rows.length).toBeGreaterThanOrEqual(499);
    expect(rows.length).toBeLessThanOrEqual(507);
  });
  it("parses 3M with GICS sector", () => {
    const mmm = rows.find((r) => r.yahooSymbol === "MMM")!;
    expect(mmm.name).toBe("3M");
    expect(mmm.sector).toBe("Industrials");
    expect(mmm.industry).toBe("Industrial Conglomerates");
  });
  it("maps Berkshire's class-B ticker for Yahoo", () => {
    expect(rows.some((r) => r.yahooSymbol === "BRK-B")).toBe(true);
  });
  it("keeps both Alphabet share classes (merged later in build)", () => {
    expect(rows.filter((r) => r.name.startsWith("Alphabet")).length).toBe(2);
  });
});

describe("parseNikkeiList against captured Nikkei 225 page", () => {
  const cfg = INDICES.find((i) => i.id === "nikkei225")!;
  const rows = parseNikkeiList(fixture("wiki-nikkei225.html.gz"), cfg);

  it("finds ~225 constituents", () => {
    expect(rows.length).toBeGreaterThanOrEqual(220);
    expect(rows.length).toBeLessThanOrEqual(228);
  });
  it("parses Toyota as 7203.T", () => {
    const toyota = rows.find((r) => r.rawTicker === "7203")!;
    expect(toyota.yahooSymbol).toBe("7203.T");
    expect(toyota.name).toMatch(/Toyota/);
  });
  it("has no duplicate codes", () => {
    expect(new Set(rows.map((r) => r.rawTicker)).size).toBe(rows.length);
  });
});

describe("displayName strips ADR/registry-share suffixes (ASML regression)", async () => {
  const { displayName } = await import("../pipeline/steps/build.ts");
  it.each([
    ["ASML Holding N.V. New York Registry Shares", "ASML Holding"],
    ["SAP SE", "SAP"],
    ["Toyota Motor Corporation Sponsored ADR", "Toyota Motor"],
    ["Apple Inc.", "Apple"],
    ["Merck KGaA", "Merck"],
  ])("%s → %s", (input, expected) => {
    expect(displayName(input)).toBe(expected);
  });
});
