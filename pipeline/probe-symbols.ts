/**
 * Dev probe: check what Yahoo serves for individual symbols, per endpoint.
 * Usage: tsx pipeline/probe-symbols.ts SYM [SYM…]
 * Also runs on demand in CI (.github/workflows/probe.yml) — datacenter IPs
 * get served different field sets than residential ones (e.g. 2026-07: v7
 * quote and quoteSummary price both lost marketCap on Actions runners).
 */
import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false, logOptionsErrors: false },
});
for (const s of process.argv.slice(2)) {
  try {
    const q = await yf.quote(s);
    console.log(
      `${s} v7quote: price=${q?.regularMarketPrice} cap=${q?.marketCap} shares=${q?.sharesOutstanding} name=${q?.shortName ?? q?.longName}`,
    );
  } catch (e) {
    console.log(`${s} v7quote: FAIL ${(e as Error).message.slice(0, 140)}`);
  }
  try {
    const qs = await yf.quoteSummary(s, {
      modules: ["price", "summaryDetail", "defaultKeyStatistics", "quoteType"],
    });
    console.log(
      `${s} summary: price.cap=${qs.price?.marketCap} detail.cap=${qs.summaryDetail?.marketCap} stats.shares=${qs.defaultKeyStatistics?.sharesOutstanding} price.price=${qs.price?.regularMarketPrice} firstTrade=${qs.quoteType?.firstTradeDateEpochUtc?.toISOString?.().slice(0, 10)}`,
    );
  } catch (e) {
    console.log(`${s} summary: FAIL ${(e as Error).message.slice(0, 140)}`);
  }
}
