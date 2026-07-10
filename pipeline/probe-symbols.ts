/** Dev probe: check individual Yahoo symbols. Usage: tsx pipeline/probe-symbols.ts SYM [SYM…] */
import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
for (const s of process.argv.slice(2)) {
  try {
    const q = await yf.quote(s);
    console.log(s, "OK", q.currency, q.marketCap, q.longName ?? q.shortName);
  } catch (e) {
    console.log(s, "FAIL", (e as Error).message.slice(0, 140));
  }
}
