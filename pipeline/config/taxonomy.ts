/**
 * Fixed taxonomies: the 11 GICS sectors, Yahoo→GICS sector mapping,
 * country-name→ISO+region mapping, and market-cap brackets (ROADMAP Appendix A).
 */

export type Region =
  "North America" | "Latin America" | "Europe" | "Middle East & Africa" | "Asia" | "Oceania";

export const SECTORS = [
  "Information Technology",
  "Health Care",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Energy",
  "Materials",
  "Utilities",
  "Real Estate",
  "Communication Services",
] as const;
export type Sector = (typeof SECTORS)[number];

/** Yahoo Finance sector names → GICS-style sector. */
export const YAHOO_SECTOR_MAP: Record<string, Sector> = {
  Technology: "Information Technology",
  "Financial Services": "Financials",
  Healthcare: "Health Care",
  "Consumer Cyclical": "Consumer Discretionary",
  "Consumer Defensive": "Consumer Staples",
  "Communication Services": "Communication Services",
  Industrials: "Industrials",
  Energy: "Energy",
  "Basic Materials": "Materials",
  Utilities: "Utilities",
  "Real Estate": "Real Estate",
};

/** Some Wikipedia tables use slight GICS variants; normalize them. */
export const GICS_SECTOR_ALIASES: Record<string, Sector> = Object.fromEntries([
  ...SECTORS.map((s) => [s, s]),
  ["Health care", "Health Care"],
  ["Healthcare", "Health Care"],
  ["Information technology", "Information Technology"],
  ["Consumer discretionary", "Consumer Discretionary"],
  ["Consumer staples", "Consumer Staples"],
  ["Communication services", "Communication Services"],
  ["Real estate", "Real Estate"],
  ["Telecommunications", "Communication Services"],
  ["Telecommunication", "Communication Services"],
]) as Record<string, Sector>;

/** Yahoo assetProfile.country (plain names) → ISO alpha-2 + region. */
export const COUNTRY_MAP: Record<string, { iso: string; region: Region }> = {
  "United States": { iso: "US", region: "North America" },
  Canada: { iso: "CA", region: "North America" },
  Mexico: { iso: "MX", region: "North America" },
  Bermuda: { iso: "BM", region: "North America" },
  "Puerto Rico": { iso: "PR", region: "North America" },
  Brazil: { iso: "BR", region: "Latin America" },
  Chile: { iso: "CL", region: "Latin America" },
  Argentina: { iso: "AR", region: "Latin America" },
  Colombia: { iso: "CO", region: "Latin America" },
  Peru: { iso: "PE", region: "Latin America" },
  Panama: { iso: "PA", region: "Latin America" },
  Uruguay: { iso: "UY", region: "Latin America" },
  "Cayman Islands": { iso: "KY", region: "Latin America" },
  "United Kingdom": { iso: "GB", region: "Europe" },
  Ireland: { iso: "IE", region: "Europe" },
  Germany: { iso: "DE", region: "Europe" },
  France: { iso: "FR", region: "Europe" },
  Netherlands: { iso: "NL", region: "Europe" },
  Switzerland: { iso: "CH", region: "Europe" },
  Spain: { iso: "ES", region: "Europe" },
  Italy: { iso: "IT", region: "Europe" },
  Sweden: { iso: "SE", region: "Europe" },
  Denmark: { iso: "DK", region: "Europe" },
  Norway: { iso: "NO", region: "Europe" },
  Finland: { iso: "FI", region: "Europe" },
  Belgium: { iso: "BE", region: "Europe" },
  Austria: { iso: "AT", region: "Europe" },
  Portugal: { iso: "PT", region: "Europe" },
  Luxembourg: { iso: "LU", region: "Europe" },
  Poland: { iso: "PL", region: "Europe" },
  "Czech Republic": { iso: "CZ", region: "Europe" },
  Czechia: { iso: "CZ", region: "Europe" },
  Greece: { iso: "GR", region: "Europe" },
  Hungary: { iso: "HU", region: "Europe" },
  Iceland: { iso: "IS", region: "Europe" },
  Jersey: { iso: "JE", region: "Europe" },
  Guernsey: { iso: "GG", region: "Europe" },
  "Isle of Man": { iso: "IM", region: "Europe" },
  Gibraltar: { iso: "GI", region: "Europe" },
  Malta: { iso: "MT", region: "Europe" },
  Cyprus: { iso: "CY", region: "Europe" },
  Monaco: { iso: "MC", region: "Europe" },
  Liechtenstein: { iso: "LI", region: "Europe" },
  Turkey: { iso: "TR", region: "Europe" },
  Russia: { iso: "RU", region: "Europe" },
  Japan: { iso: "JP", region: "Asia" },
  China: { iso: "CN", region: "Asia" },
  "Hong Kong": { iso: "HK", region: "Asia" },
  Taiwan: { iso: "TW", region: "Asia" },
  "South Korea": { iso: "KR", region: "Asia" },
  India: { iso: "IN", region: "Asia" },
  Singapore: { iso: "SG", region: "Asia" },
  Indonesia: { iso: "ID", region: "Asia" },
  Thailand: { iso: "TH", region: "Asia" },
  Malaysia: { iso: "MY", region: "Asia" },
  Philippines: { iso: "PH", region: "Asia" },
  Vietnam: { iso: "VN", region: "Asia" },
  Macau: { iso: "MO", region: "Asia" },
  Macao: { iso: "MO", region: "Asia" },
  Kazakhstan: { iso: "KZ", region: "Asia" },
  Israel: { iso: "IL", region: "Middle East & Africa" },
  "United Arab Emirates": { iso: "AE", region: "Middle East & Africa" },
  "Saudi Arabia": { iso: "SA", region: "Middle East & Africa" },
  Qatar: { iso: "QA", region: "Middle East & Africa" },
  Kuwait: { iso: "KW", region: "Middle East & Africa" },
  "South Africa": { iso: "ZA", region: "Middle East & Africa" },
  Egypt: { iso: "EG", region: "Middle East & Africa" },
  Morocco: { iso: "MA", region: "Middle East & Africa" },
  Nigeria: { iso: "NG", region: "Middle East & Africa" },
  Australia: { iso: "AU", region: "Oceania" },
  "New Zealand": { iso: "NZ", region: "Oceania" },
  "Papua New Guinea": { iso: "PG", region: "Oceania" },
};

export type CapBracket = "Small" | "Mid" | "Large" | "Mega";

export function capBracket(marketCapUSD: number): CapBracket {
  if (marketCapUSD >= 200e9) return "Mega";
  if (marketCapUSD >= 10e9) return "Large";
  if (marketCapUSD >= 2e9) return "Mid";
  return "Small";
}
