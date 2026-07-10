/**
 * One-off capture of real yahoo-finance2 responses into /pipeline/fixtures
 * so parsers are written against actual payloads (ROADMAP §8.5).
 */
import { writeFileSync } from "node:fs";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const out = (name: string, data: unknown) =>
  writeFileSync(new URL(`./fixtures/${name}`, import.meta.url), JSON.stringify(data, null, 2));

// Mixed exchanges on purpose: US, XETRA, LSE (GBp pence trap), Tokyo, Hong Kong
const symbols = ["AAPL", "SAP.DE", "AZN.L", "7203.T", "0700.HK", "GOOG", "GOOGL"];

const quotes = await yf.quote(symbols);
out("yahoo-quote-batch.json", quotes);

const summary = await yf.quoteSummary("SAP.DE", {
  modules: ["assetProfile", "price", "summaryDetail"],
});
out("yahoo-quoteSummary-SAP.DE.json", summary);

const chart = await yf.chart("AAPL", {
  period1: "2021-07-10",
  period2: "2026-07-10",
  interval: "1wk",
});
out("yahoo-chart-AAPL-5y-weekly.json", chart);

console.log(
  "captured:",
  quotes.length,
  "quotes;",
  summary.price?.shortName,
  "summary;",
  chart.quotes.length,
  "weekly candles",
);
for (const q of quotes) {
  console.log(q.symbol, q.currency, q.marketCap, q.shortName);
}
