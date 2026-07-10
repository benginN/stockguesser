/**
 * One daily FX snapshot (ECB reference rates via frankfurter.dev) so every
 * market cap converts to USD with the same rates (ROADMAP §2.5.4).
 */
import { cachedJson } from "../lib/http.ts";
import { log } from "../lib/util.ts";

export interface FxSnapshot {
  date: string;
  /** units of CCY per 1 USD, plus USD:1 */
  rates: Record<string, number>;
}

export async function fetchFx(): Promise<FxSnapshot> {
  const data = await cachedJson<{ date: string; rates: Record<string, number> }>(
    "https://api.frankfurter.dev/v1/latest?base=USD",
    24,
  );
  const rates: Record<string, number> = { ...data.rates, USD: 1 };
  log("fx", `${Object.keys(rates).length} rates as of ${data.date}`);
  return { date: data.date, rates };
}

/** Convert a market cap in `currency` to USD. GBp (pence): Yahoo already reports caps in GBP. */
export function toUSD(amount: number, currency: string, fx: FxSnapshot): number | undefined {
  const ccy = currency === "GBp" ? "GBP" : currency === "ZAc" ? "ZAR" : currency;
  const rate = fx.rates[ccy];
  if (!rate) return undefined;
  const usd = amount / rate;
  return ccy === "ZAR" && currency === "ZAc" ? usd / 100 : usd;
}
