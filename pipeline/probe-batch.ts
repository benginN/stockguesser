/**
 * Dev probe: does the shape of a session's Yahoo calls decide whether caps
 * are served? Runs #9–#12 saw the same ~750 symbols come back capless
 * (price/name but no marketCap) from every batch AND from singles in the
 * same process, while a fresh probe process got full data minutes later.
 * Usage: tsx pipeline/probe-batch.ts [batch-first|single-first]
 */
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  validation: { logErrors: false, logOptionsErrors: false },
});

// 50 symbols that were capless in runs #9–#12
const SYMS = (
  "ABT ACA.PA ADI ADM ADS.DE AEE AFL AGN.AS AIG AIZ AJG ALV.DE ALW.L AMD AMP " +
  "AMP.MI ANA.MC APA APD APH ARE ASSA-B.ST AVB AVY AWK AXISBANK.NS AZN.ST AZO " +
  "BAC BARC.L BAS.DE BBY BDX BEI.DE BG BLK BLND.L BNP.PA BNZL.L BOL.ST BPE.MI " +
  "BR BVI.PA BZU.MI CAT CCI CDW CHD CL CLX"
).split(" ");

const mode = process.argv[2] ?? "batch-first";
console.log(`mode: ${mode}`);

if (mode === "single-first") {
  const w = await yf.quote("AAPL");
  console.log(`warmup single AAPL: cap=${w?.marketCap}`);
}

const batch = await yf.quote(SYMS);
const withCap = batch.filter((q) => q?.marketCap).length;
const abt = batch.find((q) => q.symbol === "ABT");
console.log(
  `batch of ${SYMS.length}: got ${batch.length} quotes, ${withCap} with cap; ABT price=${abt?.regularMarketPrice} cap=${abt?.marketCap}`,
);

const single = await yf.quote("ABT");
console.log(`single ABT after batch: price=${single?.regularMarketPrice} cap=${single?.marketCap}`);
