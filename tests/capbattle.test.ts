/** Cap Battle pair selection + Imposter round generation (ROADMAP §1.2–1.3). */
import { describe, expect, it } from "vitest";
import { mulberry32, pickPair } from "../src/game/capbattle.ts";
import { generateImposterRound } from "../src/game/imposter.ts";
import type { GameCompany } from "../src/game/feedback.ts";

const co = (
  id: string,
  cap: number,
  sector = "Industrials",
  indices: string[] = [],
): GameCompany => ({
  id,
  name: id,
  sector,
  industry: "x",
  country: "US",
  region: "North America",
  marketCapUSD: cap,
  capBracket: cap >= 200e9 ? "Mega" : cap >= 10e9 ? "Large" : "Mid",
  indexMemberships: indices,
});

describe("mulberry32", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("pickPair", () => {
  const pool = [
    co("a", 100e9, "Tech"),
    co("b", 150e9, "Tech"),
    co("c", 5e9, "Energy"),
    co("d", 8e9, "Energy"),
    co("e", 900e9, "Health"),
    co("f", 12e9, "Tech"),
    co("g", 45e9, "Health"),
    co("h", 30e9, "Energy"),
  ];

  it("returns two distinct companies", () => {
    const rng = mulberry32(1);
    const [x, y] = pickPair(pool, rng, new Set());
    expect(x.id).not.toBe(y.id);
  });
  it("pairs are 'interesting': same sector or caps within 3×", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const [x, y] = pickPair(pool, rng, new Set());
      const ratio =
        Math.max(x.marketCapUSD, y.marketCapUSD) / Math.min(x.marketCapUSD, y.marketCapUSD);
      expect(x.sector === y.sector || ratio <= 3).toBe(true);
    }
  });
  it("avoids recently shown companies when possible", () => {
    const rng = mulberry32(3);
    const recent = new Set(["a", "b", "c", "d"]);
    for (let i = 0; i < 20; i++) {
      const [x, y] = pickPair(pool, rng, recent);
      expect(recent.has(x.id) && recent.has(y.id)).toBe(false);
    }
  });
  it("50 rounds without identical consecutive pairs", () => {
    const rng = mulberry32(11);
    const recent = new Set<string>();
    let prevKey = "";
    for (let i = 0; i < 50; i++) {
      const [x, y] = pickPair(pool, rng, recent);
      const key = [x.id, y.id].sort().join("|");
      expect(key).not.toBe(prevKey);
      prevKey = key;
      recent.add(x.id);
      recent.add(y.id);
      if (recent.size > 4) {
        for (const id of [...recent].slice(0, recent.size - 4)) recent.delete(id);
      }
    }
  });
});

describe("generateImposterRound", () => {
  const members = [
    co("m1", 50e9, "Tech", ["dax"]),
    co("m2", 60e9, "Tech", ["dax"]),
    co("m3", 70e9, "Health", ["dax"]),
    co("m4", 80e9, "Health", ["dax"]),
    co("m5", 90e9, "Energy", ["dax"]),
  ];
  const outsiders = [
    co("o1", 55e9, "Tech", ["sp500"]),
    co("o2", 65e9, "Health", []),
    co("o3", 5e9, "Energy", ["ftse100"]),
  ];

  it("returns 3 members + 1 imposter, shuffled", () => {
    const round = generateImposterRound("dax", members, outsiders, mulberry32(5));
    expect(round).not.toBeNull();
    expect(round!.options).toHaveLength(4);
    const inIdx = round!.options.filter((o) => o.indexMemberships.includes("dax"));
    expect(inIdx).toHaveLength(3);
    expect(round!.options.find((o) => o.id === round!.imposterId)!.indexMemberships).not.toContain(
      "dax",
    );
  });
  it("imposter is NEVER ambiguous: guaranteed absent from the index", () => {
    for (let seed = 0; seed < 30; seed++) {
      const round = generateImposterRound("dax", members, outsiders, mulberry32(seed));
      const imposter = round!.options.find((o) => o.id === round!.imposterId)!;
      expect(imposter.indexMemberships.includes("dax")).toBe(false);
    }
  });
  it("returns null when there aren't enough plausible outsiders", () => {
    expect(generateImposterRound("dax", members, [], mulberry32(1))).toBeNull();
  });
});
