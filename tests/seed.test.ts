import { describe, expect, it } from "vitest";
import { puzzleNumber, utcDateKey } from "../src/game/seed.ts";

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
    ["2026-08-01", 1], // epoch day is puzzle #1
    ["2026-08-02", 2],
    ["2026-08-31", 31],
    ["2027-08-01", 366], // one year later (2026 is not a leap year boundary here)
    ["2026-07-31", 0], // before launch
    ["2020-01-01", 0],
  ])("%s → #%i", (dateKey, expected) => {
    expect(puzzleNumber(dateKey)).toBe(expected);
  });

  it("supports per-mode epochs", () => {
    expect(puzzleNumber("2026-09-11", "2026-09-01")).toBe(11);
  });
});
