/**
 * Pin-the-HQ geometry (ROADMAP §1.4) — pure math, no deps.
 * Precision note: company pins use COUNTRY centroids (the pipeline stores
 * HQ country, not city coordinates), so the game is country-level GeoGuessr.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6371; // km

export function haversineKm(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** 8-way compass arrow from guess toward the true location. */
export function bearingArrow(from: LatLon, to: LatLon): string {
  const rad = Math.PI / 180;
  const dLon = (to.lon - from.lon) * rad;
  const y = Math.sin(dLon) * Math.cos(to.lat * rad);
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
    Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos(dLon);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return arrows[Math.round(deg / 45) % 8];
}

/** GeoGuessr-style: 1000 at 0 km, ~500 at 2000 km, ~0 antipodal. */
export function proximityScore(km: number): number {
  return Math.round(1000 * Math.exp(-km / 2800));
}

/** equirectangular projection — must match pipeline/gen-world.ts */
export function project(p: LatLon, w: number, h: number): [number, number] {
  return [((p.lon + 180) / 360) * w, ((90 - p.lat) / 180) * h];
}

export function unproject(x: number, y: number, w: number, h: number): LatLon {
  return { lon: (x / w) * 360 - 180, lat: 90 - (y / h) * 180 };
}

/** Country recall: how many companies to name — scales with pool depth (US 25 … min 5). */
export function recallTarget(poolCount: number): number {
  return Math.min(25, Math.max(5, Math.round(poolCount / 4)));
}

/** Approximate country centroids for every ISO code the pipeline can emit. */
export const COUNTRY_CENTROIDS: Record<string, LatLon & { name: string }> = {
  US: { lat: 39.8, lon: -98.6, name: "United States" },
  CA: { lat: 56.1, lon: -106.3, name: "Canada" },
  MX: { lat: 23.6, lon: -102.6, name: "Mexico" },
  BM: { lat: 32.3, lon: -64.8, name: "Bermuda" },
  PR: { lat: 18.2, lon: -66.4, name: "Puerto Rico" },
  BR: { lat: -10.8, lon: -52.9, name: "Brazil" },
  CL: { lat: -35.7, lon: -71.5, name: "Chile" },
  AR: { lat: -34.0, lon: -64.7, name: "Argentina" },
  CO: { lat: 4.6, lon: -74.1, name: "Colombia" },
  PE: { lat: -9.2, lon: -75.0, name: "Peru" },
  PA: { lat: 8.5, lon: -80.1, name: "Panama" },
  UY: { lat: -32.8, lon: -56.0, name: "Uruguay" },
  KY: { lat: 19.3, lon: -81.3, name: "Cayman Islands" },
  GB: { lat: 54.0, lon: -2.5, name: "United Kingdom" },
  IE: { lat: 53.2, lon: -8.1, name: "Ireland" },
  DE: { lat: 51.1, lon: 10.4, name: "Germany" },
  FR: { lat: 46.6, lon: 2.5, name: "France" },
  NL: { lat: 52.2, lon: 5.6, name: "Netherlands" },
  CH: { lat: 46.8, lon: 8.2, name: "Switzerland" },
  ES: { lat: 40.2, lon: -3.6, name: "Spain" },
  IT: { lat: 42.8, lon: 12.1, name: "Italy" },
  SE: { lat: 62.8, lon: 16.7, name: "Sweden" },
  DK: { lat: 56.0, lon: 9.3, name: "Denmark" },
  NO: { lat: 61.2, lon: 8.8, name: "Norway" },
  FI: { lat: 64.5, lon: 26.3, name: "Finland" },
  BE: { lat: 50.6, lon: 4.7, name: "Belgium" },
  AT: { lat: 47.6, lon: 14.1, name: "Austria" },
  PT: { lat: 39.6, lon: -8.0, name: "Portugal" },
  LU: { lat: 49.8, lon: 6.1, name: "Luxembourg" },
  PL: { lat: 52.1, lon: 19.4, name: "Poland" },
  CZ: { lat: 49.8, lon: 15.3, name: "Czechia" },
  GR: { lat: 39.0, lon: 22.9, name: "Greece" },
  HU: { lat: 47.2, lon: 19.4, name: "Hungary" },
  IS: { lat: 64.9, lon: -18.6, name: "Iceland" },
  JE: { lat: 49.2, lon: -2.1, name: "Jersey" },
  GG: { lat: 49.5, lon: -2.6, name: "Guernsey" },
  IM: { lat: 54.2, lon: -4.5, name: "Isle of Man" },
  GI: { lat: 36.1, lon: -5.3, name: "Gibraltar" },
  MT: { lat: 35.9, lon: 14.4, name: "Malta" },
  CY: { lat: 35.0, lon: 33.2, name: "Cyprus" },
  MC: { lat: 43.7, lon: 7.4, name: "Monaco" },
  LI: { lat: 47.2, lon: 9.5, name: "Liechtenstein" },
  TR: { lat: 39.0, lon: 35.4, name: "Türkiye" },
  RU: { lat: 61.5, lon: 99.0, name: "Russia" },
  JP: { lat: 36.6, lon: 138.0, name: "Japan" },
  CN: { lat: 35.9, lon: 104.2, name: "China" },
  HK: { lat: 22.4, lon: 114.1, name: "Hong Kong" },
  TW: { lat: 23.7, lon: 121.0, name: "Taiwan" },
  KR: { lat: 36.4, lon: 127.9, name: "South Korea" },
  IN: { lat: 22.9, lon: 79.6, name: "India" },
  SG: { lat: 1.35, lon: 103.8, name: "Singapore" },
  ID: { lat: -2.2, lon: 117.4, name: "Indonesia" },
  TH: { lat: 15.1, lon: 101.0, name: "Thailand" },
  MY: { lat: 3.8, lon: 109.7, name: "Malaysia" },
  PH: { lat: 12.9, lon: 122.9, name: "Philippines" },
  VN: { lat: 16.6, lon: 106.3, name: "Vietnam" },
  MO: { lat: 22.2, lon: 113.5, name: "Macau" },
  KZ: { lat: 48.2, lon: 67.3, name: "Kazakhstan" },
  IL: { lat: 31.4, lon: 35.0, name: "Israel" },
  AE: { lat: 24.3, lon: 54.3, name: "United Arab Emirates" },
  SA: { lat: 24.0, lon: 45.1, name: "Saudi Arabia" },
  QA: { lat: 25.3, lon: 51.2, name: "Qatar" },
  KW: { lat: 29.3, lon: 47.6, name: "Kuwait" },
  ZA: { lat: -29.0, lon: 25.1, name: "South Africa" },
  EG: { lat: 26.6, lon: 29.8, name: "Egypt" },
  MA: { lat: 31.9, lon: -6.3, name: "Morocco" },
  NG: { lat: 9.6, lon: 8.1, name: "Nigeria" },
  AU: { lat: -25.7, lon: 134.5, name: "Australia" },
  NZ: { lat: -41.8, lon: 172.8, name: "New Zealand" },
  PG: { lat: -6.5, lon: 145.2, name: "Papua New Guinea" },
};
