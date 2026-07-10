/** Custom index parser: free text (spaces/commas/newlines) → resolved companies. */
import { describe, expect, it } from "vitest";
import { parseCustomList, type ResolveTarget } from "../src/game/customIndex.ts";

const pool: ResolveTarget[] = [
  { id: "apple", name: "Apple", tickers: ["AAPL"], aliases: ["apple", "aapl"] },
  { id: "microsoft", name: "Microsoft", tickers: ["MSFT"], aliases: ["microsoft", "msft"] },
  {
    id: "bank-of-america",
    name: "Bank of America",
    tickers: ["BAC"],
    aliases: ["bank of america", "bac"],
  },
  { id: "sap", name: "SAP", tickers: ["SAP.DE", "SAP"], aliases: ["sap", "sap se"] },
  {
    id: "palantir-technologies",
    name: "Palantir Technologies",
    tickers: ["PLTR"],
    aliases: ["palantir technologies", "pltr", "palantir"],
  },
  {
    id: "meta-platforms",
    name: "Meta Platforms",
    tickers: ["META"],
    aliases: ["meta platforms", "meta", "facebook", "fb"],
  },
];

describe("parseCustomList", () => {
  it("resolves comma-separated tickers", () => {
    const r = parseCustomList("AAPL, MSFT, PLTR", pool);
    expect(r.resolved).toEqual(["apple", "microsoft", "palantir-technologies"]);
    expect(r.unresolved).toEqual([]);
  });
  it("resolves newline-separated names including multiword", () => {
    const r = parseCustomList("Apple\nBank of America\nPalantir", pool);
    expect(r.resolved).toEqual(["apple", "bank-of-america", "palantir-technologies"]);
  });
  it("space-separated tickers fall back to token-by-token", () => {
    const r = parseCustomList("AAPL MSFT SAP", pool);
    expect(r.resolved).toEqual(["apple", "microsoft", "sap"]);
  });
  it("mixed separators and aliases work", () => {
    const r = parseCustomList("facebook, AAPL\nbank of america; sap", pool);
    expect(r.resolved).toEqual(["meta-platforms", "apple", "bank-of-america", "sap"]);
  });
  it("reports unresolved tokens instead of guessing wildly", () => {
    const r = parseCustomList("AAPL, NOTACOMPANY, MSFT", pool);
    expect(r.resolved).toEqual(["apple", "microsoft"]);
    expect(r.unresolved).toEqual(["NOTACOMPANY"]);
  });
  it("dedupes (GOOG-style double entry counts once)", () => {
    const r = parseCustomList("apple AAPL aapl", pool);
    expect(r.resolved).toEqual(["apple"]);
  });
  it("empty input → empty result", () => {
    expect(parseCustomList("  \n ", pool)).toEqual({ resolved: [], unresolved: [] });
  });
});
