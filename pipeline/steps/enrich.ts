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

const toQuoteLite = (q: Awaited<ReturnType<typeof yf.quote>>[number]): QuoteLite => ({
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
});

/**
 * The v7 batch quote endpoint serves crumb-gated thin responses (no marketCap)
 * to datacenter IPs — runs #9/#10 lost ~250 index constituents to it on CI
 * while quoteSummary and chart kept answering in full. So quoteSummary is the
 * fallback for batch misses. Returns the quote, null for a confirmed unknown
 * symbol, or undefined when Yahoo answered but without usable cap data.
 */
async function quoteViaSummary(symbol: string): Promise<QuoteLite | null | undefined> {
  try {
    const qs = await yf.quoteSummary(symbol, { modules: ["price", "quoteType"] });
    const p = qs.price;
    if (!p?.marketCap || !p.regularMarketPrice) return undefined;
    const firstTrade = qs.quoteType?.firstTradeDateEpochUtc;
    return {
      symbol,
      currency: p.currency,
      marketCap: p.marketCap,
      price: p.regularMarketPrice,
      longName: p.longName ?? undefined,
      shortName: p.shortName ?? undefined,
      exchange: p.exchangeName,
      firstTradeYear: firstTrade ? new Date(firstTrade).getUTCFullYear() : undefined,
    };
  } catch (err) {
    if (isPermanentMiss(err)) return null;
    throw err;
  }
}

/** Batch-fetch quotes with per-symbol disk memoization. */
export async function getQuotes(symbols: string[]): Promise<Map<string, QuoteLite>> {
  const result = new Map<string, QuoteLite>();
  const missing: string[] = [];
  for (const s of symbols) {
    // quote4: quote3 tombstones were poisoned by a throttled run (2026-07-20) — never reuse them
    const peek = peekMemo<QuoteLite | null>(`quote4:${s}`);
    if (!peek.hit) missing.push(s);
    else if (peek.value) result.set(s, peek.value);
    // cached null = known-dead symbol, skip silently
  }
  log("enrich", `quotes: ${result.size} cached, ${missing.length} to fetch`);

  // Pass 1: cheap 50-symbol batches. Only complete answers are cached; anything
  // else (batch error, throttled/thin response) falls through to the singles pass.
  const leftovers: string[] = [];
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const got = new Set<string>();
    try {
      for (const q of await yf.quote(batch)) {
        const lite = toQuoteLite(q);
        if (!lite.marketCap) continue;
        got.add(q.symbol);
        result.set(q.symbol, lite);
        await memo(`quote4:${q.symbol}`, async () => lite);
      }
    } catch {
      /* whole batch failed — every symbol gets a second chance below */
    }
    leftovers.push(...batch.filter((s) => !got.has(s)));
    if (i % 500 === 0)
      log("enrich", `quotes: fetched ${Math.min(i + 50, missing.length)}/${missing.length}`);
    await sleep(400);
  }

  // Pass 2: verify leftovers one by one, falling back to quoteSummary for the
  // datacenter-thin v7 responses. Tombstone only a confirmed "no such symbol" —
  // a thin batch response must never brand a live symbol as dead (run #9
  // tombstoned 259 index constituents during a Yahoo throttling spell).
  if (leftovers.length > 0) log("enrich", `quotes: verifying ${leftovers.length} batch misses`);
  let streak = 0; // consecutive transient failures = Yahoo is throttling across the board
  let tombstoned = 0;
  const sampleErrors: string[] = []; // first few real messages — throttling looks different every year
  await pMap(
    leftovers,
    async (s) => {
      if (streak >= 10) return; // stop hammering; uncached symbols retry next run
      try {
        const lite = await withRetries(async () => {
          const q = await yf.quote(s); // undefined = Yahoo answered: no such symbol
          if (q) {
            const l = toQuoteLite(q);
            if (l.marketCap) return l;
          }
          const viaSummary = await quoteViaSummary(s);
          if (viaSummary) return viaSummary;
          if (viaSummary === null && !q) return null; // both endpoints: no such symbol
          // answered but capless — say what we did get, so CI logs show the shape
          throw new Error(
            `thin quote for ${s} (price=${q?.regularMarketPrice}, name=${q?.shortName ?? q?.longName}, summary=${viaSummary === null ? "not-found" : "capless"})`,
          );
        });
        if (lite === null) {
          tombstoned++;
          await memo(`quote4:${s}`, async () => null); // confirmed dead/unknown symbol
        } else {
          result.set(s, lite);
          await memo(`quote4:${s}`, async () => lite);
        }
        streak = 0;
      } catch (err) {
        streak++; // transient after retries — leave uncached so the next run retries
        if (sampleErrors.length < 3)
          sampleErrors.push(`${s}: ${((err as Error).message ?? String(err)).slice(0, 160)}`);
      }
      await sleep(PACE_MS);
    },
    CONCURRENCY,
  );
  if (leftovers.length > 0) {
    const unresolved = leftovers.filter((s) => !result.has(s)).length - tombstoned;
    log("enrich", `quotes: ${tombstoned} tombstoned, ${unresolved} left for next run`);
    for (const m of sampleErrors) log("enrich", `quotes: sample failure — ${m}`);
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
