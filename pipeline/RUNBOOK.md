# Data pipeline runbook

## What it does

`npm run pipeline` regenerates every artifact in `/public/data` from scratch:

1. **Constituents** — scrapes 15 index pages (Wikipedia; NASDAQ-100 from Nasdaq's JSON API),
   validates counts against `pipeline/config/indices.ts` (drift beyond tolerance = hard fail).
2. **Symbol overrides** — applies `pipeline/data/overrides.json` `symbolOverrides`
   (source data errors, e.g. Wikipedia listing Roche as ROP instead of ROG).
3. **Universe** — index members + top US listings from SEC EDGAR (ordered ~by cap).
4. **Enrichment** — Yahoo Finance quotes (batch), assetProfiles (per symbol), all
   memoized in `pipeline/.cache/` (TTL 72h) and throttled. Delete `.cache/` for a true cold run.
5. **FX** — one daily ECB snapshot (frankfurter.dev); all caps converted to USD with it.
   GBp quirk: Yahoo reports LSE caps in **pounds** while flagging currency as pence — handled in `fx.ts`.
6. **Build** — canonical companies (dual listings/share classes merged by normalized
   name, caps must agree within 40% or the group splits), tiers (index members = Tier 1,
   topped up to 2,500 by cap; total pool ~5,000), computed index weights
   (cap-weighted from USD caps; Dow & Nikkei price-weighted from prices — approximation,
   since ETF holdings CSVs turned out to be bot-blocked).
7. **Validate** — Zod schemas, referential integrity, sanity ranges, pool sizes.
   **Any critical ⇒ exit 1 and nothing is emitted.**
8. **Emit** — `stocks.json`, `indices.json`, `sparklines.json` (Tier 1, 5Y weekly,
   indexed to 100), `search-index.json` (<300 KB gz, enforced), `meta.json`.

Flags: `npm run pipeline -- --skip-sparklines` for a faster dev loop.
Full cold run takes roughly 30–60 min (throttled Yahoo calls); warm re-run minutes.

## Weekly refresh flow

- `.github/workflows/data-refresh.yml` runs Mondays 05:30 UTC (or manually via
  workflow_dispatch), regenerates data, and opens a **PR on branch `data-refresh`**
  whose body is the diff report (companies added/removed, caps moved >5%, index
  membership changes).
- **Review checklist before merging:**
  1. Do the index membership changes match reality (check a news source for real
     index rebalances)? Wikipedia edits are occasionally wrong or vandalized —
     count validation catches size changes but not swaps.
  2. Any removed company still referenced in `puzzles/*.json`? (A puzzle-integrity
     check lands in Phase 2 and will run in CI.)
  3. Do the biggest cap moves look like market moves, not currency bugs?
- Live daily puzzles pin their `snapshotVersion`, so merging a refresh never changes
  an already-scheduled answer.

## When the pipeline fails

- **Count drift on an index** — the Wikipedia page structure changed or a real
  rebalance happened. Open the page, compare, then either fix the parser config in
  `pipeline/config/indices.ts` or update `expectedCount`.
- **Critical: constituent has no quote/cap** — the scraped ticker doesn't resolve on
  Yahoo. Find the right symbol (search finance.yahoo.com) and add a `symbolOverrides`
  entry with a `_why`.
- **Critical: index member missing sector/country** — Yahoo has no assetProfile for
  it. Add a `companyOverrides` entry (keyed by company id) filling the fields, with a `_why`.
- **Caps missing en masse (prices/names fine)** — Yahoo serves capless responses
  to most datacenter IPs for a subset of symbols, on every endpoint (v7 quote,
  quoteSummary, all modules) — landing a clean Actions runner is luck
  (`probe.yml` / `pipeline/probe-batch.ts` demonstrate this). The pipeline
  recovers cap = remembered cap/price ratio × fresh price (`capratio:` memos,
  90d TTL, seeded from `pipeline/data/cap-ratios.json`). After a complete local
  run, refresh the seed with `tsx pipeline/gen-cap-ratios.ts` and commit it.
- **Yahoo starts erroring en masse** — the unofficial API changed. Check for a
  yahoo-finance2 update first (`npm outdated yahoo-finance2`); this dependency is the
  most likely long-term breakage (ROADMAP §3 longevity notes).

## Source inventory (and fallbacks)

| Data                 | Source                                                 | Fallback                            |
| -------------------- | ------------------------------------------------------ | ----------------------------------- |
| US universe          | SEC EDGAR company_tickers.json (official, no key)      | —                                   |
| Constituents         | Wikipedia pages; Nasdaq API for NDX                    | paid: FMP/EODHD                     |
| Profiles/caps/prices | Yahoo via yahoo-finance2 (unofficial, build-time only) | paid: FMP/EODHD/Finnhub             |
| FX                   | frankfurter.dev (ECB reference rates)                  | exchangerate.host                   |
| Weights              | computed (cap- or price-based)                         | ETF holdings CSVs if access returns |
