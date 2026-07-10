/**
 * Yahoo Finance enrichment — the only unofficial source, so everything is
 * memoized per symbol on disk and throttled hard. Three call shapes:
 *   quotes:   batch price/cap/currency/name (cheap, 50 symbols per request)
 *   profiles: per-symbol sector/industry/country (expensive, one request each)
 *   sparklines: per-symbol 5Y weekly closes indexed to 100 (Tier 1 only)
 */
import YahooFinance from "yahoo-finance2";
import { memo, peekMemo, pMap } from "../lib/http.ts";
import { log } from "../lib/util.ts";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false, logOptionsErrors: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface QuoteLite {
  symbol: string;
  currency?: string;
  marketCap?: number;
  price?: number;
  longName?: string;
  shortName?: string;
  exchange?: string;
  firstTradeYear?: number;
}

export interface ProfileLite {
  sector?: string;
  industry?: string;
  country?: string;
  employees?: number;
  website?: string;
}

/** Batch-fetch quotes with per-symbol disk memoization. */
export async function getQuotes(symbols: string[]): Promise<Map<string, QuoteLite>> {
  const result = new Map<string, QuoteLite>();
  const missing: string[] = [];
  for (const s of symbols) {
    const peek = peekMemo<QuoteLite | null>(`quote3:${s}`);
    if (!peek.hit) missing.push(s);
    else if (peek.value) result.set(s, peek.value);
    // cached null = known-dead symbol, skip silently
  }
  log("enrich", `quotes: ${result.size} cached, ${missing.length} to fetch`);

  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    let quotes: Awaited<ReturnType<typeof yf.quote>> = [];
    try {
      quotes = await yf.quote(batch);
    } catch (err) {
      // one bad symbol can fail a batch — fall back to singles
      for (const s of batch) {
        try {
          quotes.push(await yf.quote(s));
        } catch {
          void err;
        }
        await sleep(120);
      }
    }
    const got = new Set<string>();
    for (const q of quotes) {
      const lite: QuoteLite = {
        symbol: q.symbol,
        currency: q.currency,
        // some quotes (e.g. Michelin ML.PA) report no marketCap; shares × price recovers it
        marketCap:
          q.marketCap ||
          (q.sharesOutstanding && q.regularMarketPrice
            ? Math.round(q.sharesOutstanding * q.regularMarketPrice)
            : undefined),
        price: q.regularMarketPrice,
        longName: q.longName,
        shortName: q.shortName,
        exchange: q.fullExchangeName,
        firstTradeYear: q.firstTradeDateMilliseconds
          ? new Date(q.firstTradeDateMilliseconds).getUTCFullYear()
          : undefined,
      };
      got.add(q.symbol);
      result.set(q.symbol, lite);
      await memo(`quote3:${q.symbol}`, async () => lite);
    }
    for (const s of batch.filter((s) => !got.has(s))) {
      await memo(`quote3:${s}`, async () => null); // tombstone: dead/unknown symbol
    }
    if (i % 500 === 0)
      log("enrich", `quotes: fetched ${Math.min(i + 50, missing.length)}/${missing.length}`);
    await sleep(400);
  }
  return result;
}

/** Per-symbol assetProfile (sector/industry/country) with memoization. */
export async function getProfiles(symbols: string[]): Promise<Map<string, ProfileLite>> {
  const result = new Map<string, ProfileLite>();
  let fetched = 0;
  await pMap(
    symbols,
    async (symbol) => {
      const profile = await memo<ProfileLite | null>(`profile:${symbol}`, async () => {
        fetched++;
        try {
          const qs = await yf.quoteSummary(symbol, { modules: ["assetProfile"] });
          const p = qs.assetProfile;
          if (!p) return null;
          return {
            sector: p.sector,
            industry: p.industry,
            country: p.country,
            employees: p.fullTimeEmployees,
            website: p.website,
          };
        } catch {
          return null;
        } finally {
          await sleep(150);
          if (fetched % 250 === 0) log("enrich", `profiles: ${fetched} fetched from network…`);
        }
      });
      if (profile) result.set(symbol, profile);
    },
    4,
  );
  log("enrich", `profiles: ${result.size}/${symbols.length} resolved`);
  return result;
}

/** 5Y weekly close series, indexed to 100 at the first point (Tier 1 only). */
export async function getSparklines(symbols: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const period1 = new Date(Date.now() - 5 * 365.25 * 86_400_000).toISOString().slice(0, 10);
  let fetched = 0;
  await pMap(
    symbols,
    async (symbol) => {
      const spark = await memo<number[] | null>(`spark:${symbol}`, async () => {
        fetched++;
        try {
          const chart = await yf.chart(symbol, { period1, interval: "1wk" });
          const closes = chart.quotes
            .map((q) => q.adjclose ?? q.close)
            .filter((c): c is number => c != null);
          if (closes.length < 100) return null;
          const base = closes[0];
          return closes.map((c) => Math.round((c / base) * 1000) / 10);
        } catch {
          return null;
        } finally {
          await sleep(150);
          if (fetched % 250 === 0) log("enrich", `sparklines: ${fetched} fetched from network…`);
        }
      });
      if (spark) result.set(symbol, spark);
    },
    4,
  );
  log("enrich", `sparklines: ${result.size}/${symbols.length} resolved`);
  return result;
}
