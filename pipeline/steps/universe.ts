/**
 * US listing universe from SEC EDGAR. The file is ordered ~by market cap,
 * one entry per (CIK, ticker) — we keep the first ticker per CIK (primary
 * listing / senior share class) and skip obvious non-companies (ETFs).
 */
import { cachedJson } from "../lib/http.ts";
import { log } from "../lib/util.ts";

export interface EdgarEntry {
  cik: number;
  ticker: string;
  title: string;
}

const FUND_PATTERN =
  /\betfs?\b|ishares|vanguard\s|proshares|spdr|direxion|graniteshares|wisdomtree/i;

export async function fetchEdgarUniverse(limit: number): Promise<EdgarEntry[]> {
  const raw = await cachedJson<Record<string, { cik_str: number; ticker: string; title: string }>>(
    "https://www.sec.gov/files/company_tickers.json",
  );
  const seenCik = new Set<number>();
  const entries: EdgarEntry[] = [];
  for (const row of Object.values(raw)) {
    if (seenCik.has(row.cik_str)) continue; // later rows are junior share classes
    if (FUND_PATTERN.test(row.title)) continue;
    if (/[-.](WS|WT|U|UN|R)$/i.test(row.ticker)) continue; // warrants/units/rights
    seenCik.add(row.cik_str);
    entries.push({ cik: row.cik_str, ticker: row.ticker.toUpperCase(), title: row.title });
    if (entries.length >= limit) break;
  }
  log("universe", `EDGAR: kept ${entries.length} of ${Object.keys(raw).length} listings`);
  return entries;
}
