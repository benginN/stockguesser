/** Pin-the-HQ geometry + scoring (ROADMAP §1.4), written before implementation. */
import { describe, expect, it } from "vitest";
import {
  bearingArrow,
  COUNTRY_CENTROIDS,
  haversineKm,
  project,
  proximityScore,
  unproject,
} from "../src/game/geo.ts";

describe("haversineKm", () => {
  it("zero distance to itself", () => {
    expect(haversineKm({ lat: 52, lon: 13 }, { lat: 52, lon: 13 })).toBe(0);
  });
  it("Berlin→Paris is ~880 km", () => {
    const km = haversineKm({ lat: 52.52, lon: 13.4 }, { lat: 48.86, lon: 2.35 });
    expect(km).toBeGreaterThan(830);
    expect(km).toBeLessThan(930);
  });
  it("NYC→Tokyo is ~10,850 km", () => {
    const km = haversineKm({ lat: 40.71, lon: -74.01 }, { lat: 35.68, lon: 139.69 });
    expect(km).toBeGreaterThan(10500);
    expect(km).toBeLessThan(11200);
  });
});

describe("bearingArrow", () => {
  it("points east from Paris to Berlin", () => {
    expect(bearingArrow({ lat: 48.86, lon: 2.35 }, { lat: 52.52, lon: 13.4 })).toBe("↗");
  });
  it("points west from Berlin to New York", () => {
    expect(["←", "↖"]).toContain(
      bearingArrow({ lat: 52.52, lon: 13.4 }, { lat: 40.71, lon: -74.01 }),
    );
  });
  it("points south from Oslo to Cape Town", () => {
    expect(bearingArrow({ lat: 59.9, lon: 10.75 }, { lat: -33.9, lon: 18.4 })).toBe("↓");
  });
});

describe("proximityScore", () => {
  it("bullseye = 1000", () => expect(proximityScore(0)).toBe(1000));
  it("monotonically decreasing", () => {
    expect(proximityScore(100)).toBeGreaterThan(proximityScore(500));
    expect(proximityScore(500)).toBeGreaterThan(proximityScore(3000));
    expect(proximityScore(3000)).toBeGreaterThan(proximityScore(12000));
  });
  it("same-country miss (≈300 km) still scores well", () => {
    expect(proximityScore(300)).toBeGreaterThanOrEqual(850);
  });
  it("antipodal ≈ 0", () => expect(proximityScore(20000)).toBeLessThanOrEqual(5));
});

describe("projection round-trip", () => {
  it("unproject(project(p)) ≈ p", () => {
    const p = { lat: 37.77, lon: -122.42 };
    const [x, y] = project(p, 800, 400);
    const back = unproject(x, y, 800, 400);
    expect(back.lat).toBeCloseTo(p.lat, 5);
    expect(back.lon).toBeCloseTo(p.lon, 5);
  });
});

describe("COUNTRY_CENTROIDS", () => {
  it("covers every country the dataset can produce", async () => {
    const { readFileSync } = await import("node:fs");
    const stocks = JSON.parse(
      readFileSync(new URL("../public/data/stocks.json", import.meta.url), "utf8"),
    ) as { companies: { country: string; tier: number }[] };
    const countries = new Set(stocks.companies.map((c) => c.country));
    const missing = [...countries].filter((c) => !COUNTRY_CENTROIDS[c]);
    expect(missing).toEqual([]);
  });
  it("Germany's centroid is inside Germany-ish bounds", () => {
    const de = COUNTRY_CENTROIDS.DE;
    expect(de.lat).toBeGreaterThan(47);
    expect(de.lat).toBeLessThan(55);
    expect(de.lon).toBeGreaterThan(5);
    expect(de.lon).toBeLessThan(15);
  });
});
