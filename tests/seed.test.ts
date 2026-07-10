import { describe, expect, it } from "vitest";
import {
  decodeAnswer,
  encodeAnswer,
  hashDate,
  puzzleNumber,
  resolveDailyAnswer,
  utcDateKey,
  type DailySchedule,
} from "../src/game/seed.ts";

describe("utcDateKey", () => {
  it.each([
    ["2026-08-01T00:00:00Z", "2026-08-01"],
    ["2026-08-01T23:59:59Z", "2026-08-01"],
    // 23:00 UTC on the 1st is already the 2nd in Istanbul — UTC key must not care
    ["2026-08-01T23:00:00Z", "2026-08-01"],
    ["2026-12-31T23:59:59Z", "2026-12-31"],
  ])("%s → %s", (iso, expected) => {
    expect(utcDateKey(new Date(iso))).toBe(expected);
  });
});

describe("puzzleNumber", () => {
  it.each([
    ["2026-07-10", 1], // epoch day is puzzle #1
    ["2026-07-11", 2],
    ["2026-08-08", 30],
    ["2027-07-10", 366], // one year later
    ["2026-07-09", 0], // before launch
    ["2020-01-01", 0],
  ])("%s → #%i", (dateKey, expected) => {
    expect(puzzleNumber(dateKey)).toBe(expected);
  });

  it("supports per-mode epochs", () => {
    expect(puzzleNumber("2026-09-11", "2026-09-01")).toBe(11);
  });
});

describe("answer obfuscation", () => {
  it("round-trips a company id", () => {
    expect(decodeAnswer(encodeAnswer("munchener-ruck"))).toBe("munchener-ruck");
  });
  it("encoded form does not contain the id in plaintext", () => {
    expect(encodeAnswer("alphabet")).not.toContain("alphabet");
  });
  it("rejects garbage", () => {
    expect(decodeAnswer("not-base64!!")).toBeUndefined();
    expect(decodeAnswer(btoa("v9:whatever"))).toBeUndefined();
  });
});

describe("resolveDailyAnswer", () => {
  const schedule: DailySchedule = {
    mode: "daily-ticker",
    epoch: "2026-07-10",
    snapshotVersion: "2026-07-10",
    days: { "2026-07-10": encodeAnswer("sap") },
  };
  const tier1 = ["a", "b", "c", "d", "e"];

  it("uses the scheduled answer when present", () => {
    expect(resolveDailyAnswer(schedule, "2026-07-10", tier1)).toEqual({
      answerId: "sap",
      number: 1,
      fromSchedule: true,
    });
  });
  it("falls back deterministically past the schedule", () => {
    const r1 = resolveDailyAnswer(schedule, "2027-12-31", tier1);
    const r2 = resolveDailyAnswer(schedule, "2027-12-31", tier1);
    expect(r1).toEqual(r2);
    expect(r1.fromSchedule).toBe(false);
    expect(tier1).toContain(r1.answerId);
  });
  it("different dates give different fallback answers (usually)", () => {
    const days = ["2028-01-01", "2028-01-02", "2028-01-03", "2028-01-04"];
    const ids = new Set(days.map((d) => resolveDailyAnswer(schedule, d, tier1).answerId));
    expect(ids.size).toBeGreaterThan(1);
  });
  it("hashDate is stable", () => {
    expect(hashDate("2026-07-10")).toBe(hashDate("2026-07-10"));
  });
});
