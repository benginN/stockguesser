/**
 * Guess-matching rules (ROADMAP §2.5.7), table-driven, written before the
 * implementation. Must accept aliases/umlaut-folded/typo'd names, reject
 * lazy short prefixes.
 */
import { describe, expect, it } from "vitest";
import { matchesCompany, normalizeGuess, type Matchable } from "../src/game/matching.ts";

const bmw: Matchable = {
  id: "bayerische-motoren-werke",
  name: "Bayerische Motoren Werke",
  ticker: "BMW.DE",
  aliases: ["bmw", "bayerische motoren werke"],
};
const munichRe: Matchable = {
  id: "munchener-ruck",
  name: "Münchener Rück",
  ticker: "MUV2.DE",
  aliases: ["munich re", "muenchener rueck", "munchener ruck", "muv2"],
};
const meta: Matchable = {
  id: "meta-platforms",
  name: "Meta Platforms",
  ticker: "META",
  aliases: ["facebook", "fb", "meta platforms", "meta"],
};
const sap: Matchable = { id: "sap", name: "SAP", ticker: "SAP.DE", aliases: ["sap se", "sap"] };
const astra: Matchable = {
  id: "astrazeneca",
  name: "AstraZeneca",
  ticker: "AZN.L",
  aliases: ["astrazeneca", "azn"],
};

describe("normalizeGuess", () => {
  it.each([
    ["  BMW  ", "bmw"],
    ["Münchener Rück", "munchener ruck"],
    ["L'Oréal", "loreal"],
    ["meta-platforms", "meta platforms"],
    ["AT&T", "at t"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeGuess(input)).toBe(expected);
  });
});

describe("accepts", () => {
  it.each([
    ["BMW", bmw, "ticker-style alias"],
    ["Bayerische Motoren Werke", bmw, "full legal name"],
    ["bayerische motoren", bmw, "long prefix of full name"],
    ["Münchener Rück", munichRe, "exact with umlauts"],
    ["Muenchener Rueck", munichRe, "German transliteration alias"],
    ["munich re", munichRe, "English alias"],
    ["facebook", meta, "pre-rename alias"],
    ["FB", meta, "old ticker alias"],
    ["Meta", meta, "current short name"],
    ["SAP", sap, "3-letter ticker exact"],
    ["sap se", sap, "legal-suffix variant"],
    ["astrazenica", astra, "one-letter typo in long name"],
    ["AZN", astra, "LSE ticker without suffix"],
  ])("%s → %s (%s)", (input, company) => {
    expect(matchesCompany(input, company)).toBe(true);
  });
});

describe("rejects", () => {
  it.each([
    ["mu", munichRe, "2-letter lazy prefix"],
    ["ba", bmw, "2-letter lazy prefix"],
    ["bay", bmw, "3-letter prefix is still too lazy for a long name"],
    ["xyz corp", sap, "unrelated"],
    ["", sap, "empty"],
    ["  ", sap, "whitespace"],
    ["metal", meta, "prefix of a different word, not the company"],
    ["sab", sap, "typo in a 3-letter name must not fuzzy-match"],
  ])("%s ↛ %s (%s)", (input, company) => {
    expect(matchesCompany(input, company)).toBe(false);
  });
});

describe("share classes / dual listings resolve by ticker alias", () => {
  const alphabet: Matchable = {
    id: "alphabet",
    name: "Alphabet",
    ticker: "GOOGL",
    aliases: ["google", "goog", "googl", "alphabet"],
  };
  it.each(["GOOG", "GOOGL", "google", "Alphabet"])("%s → alphabet", (input) => {
    expect(matchesCompany(input, alphabet)).toBe(true);
  });
});
