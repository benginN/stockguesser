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

// CI runners hit Yahoo from datacenter IPs and get throttled harder — go gentler there
const ON_CI = !!process.env.CI;
const PACE_MS = ON_CI ? 300 : 150;
const CONCURRENCY = ON_CI ? 3 : 4;
// profiles/sparklines change slowly; long TTLs let the Actions cache carry them week to week
const PROFILE_TTL_H = 24 * 30;
const SPARK_TTL_H = 24 * 10;

/** "no such data" (cache a tombstone) vs transient throttle (retry, never cache). */
const isPermanentMiss = (err: unknown): boolean =>
  /not found|no fundamentals|404|cannot read properties of undefined/i.test(
    (err as Error).message ?? "",
  );

/** Retry transient failures with growing backoff; permanent misses return null. */
async function withRetries<T>(fn: () => Promise<T>): Promise<T | null> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isPermanentMiss(err)) return null;
      lastErr = err;
      await sleep(1000 * attempt * attempt); // 1s, 4s, 9s
    }
  }
  throw lastErr; // stays uncached → next run retries instead of trusting a bad tombstone
}

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
    } catch {
      // one bad symbol can fail a batch — fall back to singles (retry transient throttling)
      for (const s of batch) {
        try {
          const q = await withRetries(() => yf.quote(s));
          if (q) quotes.push(q);
        } catch {
          /* transient after retries — leave uncached so the next run retries */
        }
        await sleep(PACE_MS);
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
      if (!lite.marketCap) continue; // throttled/thin response — leave for retried verification below
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
  const failed: string[] = [];
  let fetched = 0;
  await pMap(
    symbols,
    async (symbol) => {
      try {
        const profile = await memo<ProfileLite | null>(
          `profile:${symbol}`,
          async () => {
            fetched++;
            if (fetched % 250 === 0) log("enrich", `profiles: ${fetched} fetched from network…`);
            const value = await withRetries(async () => {
              const qs = await yf.quoteSummary(symbol, { modules: ["assetProfile"] });
              const p = qs.assetProfile;
              if (!p) return null;
              return {
                sector: p.sector,
                industry: p.industry,
                country: p.country,
                employees: p.fullTimeEmployees,
                website: p.website,
              } as ProfileLite | null;
            });
            await sleep(PACE_MS);
            return value;
          },
          PROFILE_TTL_H,
        );
        if (profile) result.set(symbol, profile);
      } catch {
        failed.push(symbol); // transient after retries — report, don't tombstone
      }
    },
    CONCURRENCY,
  );
  if (failed.length > 0)
    log("enrich", `profiles: ${failed.length} transient failures (will retry next run)`);
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
      try {
        const spark = await memo<number[] | null>(
          `spark:${symbol}`,
          async () => {
            fetched++;
            if (fetched % 250 === 0) log("enrich", `sparklines: ${fetched} fetched from network…`);
            const value = await withRetries(async () => {
              const chart = await yf.chart(symbol, { period1, interval: "1wk" });
              const closes = chart.quotes
                .map((q) => q.adjclose ?? q.close)
                .filter((c): c is number => c != null);
              if (closes.length < 100) return null;
              const base = closes[0];
              return closes.map((c) => Math.round((c / base) * 1000) / 10);
            });
            await sleep(PACE_MS);
            return value;
          },
          SPARK_TTL_H,
        );
        if (spark) result.set(symbol, spark);
      } catch {
        /* transient after retries — sparkline is optional, skip silently */
      }
    },
    CONCURRENCY,
  );
  log("enrich", `sparklines: ${result.size}/${symbols.length} resolved`);
  return result;
}
