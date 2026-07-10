/**
 * Scrape index constituents from Wikipedia.
 * Generic path: find the wikitable whose header row matches the configured
 * ticker+name headers (preferring the #constituents table), then map rows.
 * Nikkei is a list, not a table → dedicated parser keyed on JPX search links.
 */
import * as cheerio from "cheerio";
import type { IndexConfig } from "../config/indices.ts";
import { GICS_SECTOR_ALIASES } from "../config/taxonomy.ts";
import { cachedText } from "../lib/http.ts";
import { cleanCell, log } from "../lib/util.ts";

export interface RawConstituent {
  indexId: string;
  /** ticker exactly as scraped, e.g. "BRK.B", "BT.A", "005" */
  rawTicker: string;
  /** Yahoo Finance symbol, e.g. "BRK-B", "BT-A.L", "0005.HK" */
  yahooSymbol: string;
  name: string;
  /** GICS sector when the table provides one (S&P 500 does) */
  sector?: string;
  industry?: string;
}

/** Exchange suffixes that may already appear in scraped tickers (kept verbatim). */
const KNOWN_SUFFIX = /\.(DE|PA|AS|L|MC|MI|ST|SW|BR|LS|HE|CO|OL|VI|IR|F|T|HK|NS|TO|AX|SS|SZ|KS|TW)$/;

/** Convert a scraped ticker to a Yahoo symbol per exchange conventions. */
export function toYahooSymbol(rawTicker: string, suffix: string | undefined): string {
  let t = cleanCell(rawTicker).toUpperCase();
  // strip exchange prefixes some tables use ("ETR: ADS", "SEHK: 5")
  t = t.replace(/^[A-Z]+:\s*/, "");
  if (suffix === ".HK") return t.padStart(4, "0") + suffix;
  if (suffix === ".T") return t + suffix;
  // ticker is already exchange-qualified (DAX lists Airbus as AIR.PA; EURO STOXX mixes all)
  if (KNOWN_SUFFIX.test(t)) return t;
  // class shares: BRK.B → BRK-B, BT.A → BT-A; spaces too: ATCO A → ATCO-A
  return t.replace(/[.\s]+/g, "-").replace(/-+$/, "") + (suffix ?? "");
}

export function parseGenericTable(html: string, cfg: IndexConfig): RawConstituent[] {
  const $ = cheerio.load(html);
  const tables = $("table.wikitable").toArray();
  // prefer the table explicitly marked as constituents
  tables.sort(
    (a, b) =>
      Number($(b).attr("id") === "constituents") - Number($(a).attr("id") === "constituents"),
  );

  for (const table of tables) {
    const headers = $(table)
      .find("tr")
      .first()
      .find("th, td")
      .toArray()
      .map((h) => cleanCell($(h).text()));
    const tickerCol = headers.findIndex((h) => cfg.tickerHeader.test(h));
    const nameCol = headers.findIndex((h) => cfg.nameHeader.test(h));
    if (tickerCol < 0 || nameCol < 0 || tickerCol === nameCol) continue;
    const sectorCol = headers.findIndex((h) => /sector/i.test(h));
    const industryCol = headers.findIndex((h) => /sub-industry|industry/i.test(h));

    const rows: RawConstituent[] = [];
    for (const tr of $(table).find("tr").toArray().slice(1)) {
      const cells = $(tr)
        .find("td, th")
        .toArray()
        .map((c) => cleanCell($(c).text()));
      if (cells.length <= Math.max(tickerCol, nameCol)) continue;
      const rawTicker = cells[tickerCol];
      const name = cells[nameCol];
      if (!rawTicker || !name || rawTicker.length > 12) continue;
      const sector = sectorCol >= 0 ? GICS_SECTOR_ALIASES[cells[sectorCol]] : undefined;
      rows.push({
        indexId: cfg.id,
        rawTicker,
        yahooSymbol: toYahooSymbol(rawTicker, cfg.yahooSuffix),
        name,
        sector,
        industry: industryCol >= 0 && industryCol !== sectorCol ? cells[industryCol] : undefined,
      });
    }
    if (rows.length >= cfg.expectedCount - cfg.countTolerance) return rows;
  }
  return [];
}

/** Nikkei components: list items "<a>Name</a> … topSearchStr=NNNN" in #Components section. */
export function parseNikkeiList(html: string, cfg: IndexConfig): RawConstituent[] {
  const start = html.indexOf('id="Components"');
  const end = html.indexOf("<h2", start + 100);
  const section = html.slice(start, end > 0 ? end : undefined);
  const $ = cheerio.load(section);
  const seen = new Set<string>();
  const rows: RawConstituent[] = [];
  for (const li of $("li").toArray()) {
    const link = $(li).find('a[href*="topSearchStr="]').first();
    const code = link.attr("href")?.match(/topSearchStr=(\d{4})/)?.[1];
    if (!code || seen.has(code)) continue;
    // company name = first wikilink in the item that isn't the exchange link
    const name = $(li)
      .find("a")
      .toArray()
      .map((a) => cleanCell($(a).text()))
      .find((t) => t && t !== "TYO" && !/^\d+$/.test(t));
    if (!name) continue;
    seen.add(code);
    rows.push({
      indexId: cfg.id,
      rawTicker: code,
      yahooSymbol: toYahooSymbol(code, cfg.yahooSuffix),
      name,
    });
  }
  return rows;
}

/** NASDAQ-100 comes from Nasdaq's own JSON API (Wikipedia no longer lists components). */
async function fetchNasdaq100(cfg: IndexConfig): Promise<RawConstituent[]> {
  const body = await cachedText("https://api.nasdaq.com/api/quote/list-type/nasdaq100", undefined, {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    Accept: "application/json",
  });
  const rows = (
    JSON.parse(body) as { data: { data: { rows: { symbol: string; companyName: string }[] } } }
  ).data.data.rows;
  return rows.map((r) => ({
    indexId: cfg.id,
    rawTicker: r.symbol,
    yahooSymbol: toYahooSymbol(r.symbol, undefined),
    name: cleanCell(r.companyName).replace(
      / (Class [A-C] )?(Common|Ordinary) (Stock|Shares?)$/i,
      "",
    ),
  }));
}

export async function fetchConstituents(cfg: IndexConfig): Promise<RawConstituent[]> {
  if (cfg.parser === "nasdaq-api") {
    const rows = await fetchNasdaq100(cfg);
    if (Math.abs(rows.length - cfg.expectedCount) > cfg.countTolerance) {
      throw new Error(
        `${cfg.id}: got ${rows.length}, expected ${cfg.expectedCount}±${cfg.countTolerance}`,
      );
    }
    log(
      "scrape",
      `${cfg.id.padEnd(12)} ${rows.length} constituents (expected ${cfg.expectedCount})`,
    );
    return rows;
  }
  const html = await cachedText(`https://en.wikipedia.org/wiki/${cfg.wikiPage}`);
  const rows =
    cfg.parser === "nikkei-list" ? parseNikkeiList(html, cfg) : parseGenericTable(html, cfg);
  const drift = Math.abs(rows.length - cfg.expectedCount);
  if (drift > cfg.countTolerance) {
    throw new Error(
      `${cfg.id}: got ${rows.length} constituents, expected ${cfg.expectedCount}±${cfg.countTolerance}`,
    );
  }
  log("scrape", `${cfg.id.padEnd(12)} ${rows.length} constituents (expected ${cfg.expectedCount})`);
  return rows;
}
