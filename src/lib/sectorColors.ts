/**
 * Muted per-sector hues for recall tiles and end-screen grouping. Data-viz
 * colors, distinct from the 3 feedback states; desaturated to sit on the
 * terminal palette. Text on these chips is always near-black for contrast.
 */
export const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#6aa9e8",
  "Health Care": "#67d1b1",
  Financials: "#c9a86a",
  "Consumer Discretionary": "#d98cb3",
  "Consumer Staples": "#a8c76e",
  Industrials: "#9a9fb5",
  Energy: "#e09a66",
  Materials: "#b08f7a",
  Utilities: "#8fc7d6",
  "Real Estate": "#c7b7e0",
  "Communication Services": "#e8d06a",
};

export const INDEX_NAMES: Record<string, string> = {
  sp500: "S&P 500",
  nasdaq100: "NASDAQ-100",
  dow30: "Dow Jones 30",
  ftse100: "FTSE 100",
  dax: "DAX 40",
  cac40: "CAC 40",
  eurostoxx50: "EURO STOXX 50",
  aex: "AEX 25",
  smi: "SMI 20",
  ibex35: "IBEX 35",
  ftsemib: "FTSE MIB",
  omxs30: "OMX Stockholm 30",
  nikkei225: "Nikkei 225",
  hangseng: "Hang Seng",
  nifty50: "NIFTY 50",
};
