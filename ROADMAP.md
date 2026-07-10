# Stock Guesser — Build Roadmap

A phased, Claude-Code-ready plan for a web-based stock guessing game. Work through it phase by phase; each phase has concrete acceptance criteria so "done" is unambiguous. Decisions are made opinionated on purpose so building can start immediately — every major one has an "alternatives" note if you disagree during review.

**How to use this document:** save it as `ROADMAP.md` in the repo root. Section 9 explains the recommended Claude Code workflow (one phase per session, a `PROGRESS.md` log, tests-first for game logic).

---

## 0. Vision

**One-liner:** Wordle × GeoGuessr for the stock market. Players deduce mystery stocks from attribute feedback, race to name index constituents, and test their market knowledge across countries — one shareable daily ritual plus endless practice modes.

**Audience:** retail investors, finance students, finance Twitter/Reddit/Discord communities. People who already know what the S&P 500 is; the game teaches them the rest.

**Core loop:** 2–5 minute sessions → result screen that teaches something ("today's stock card") → shareable emoji grid → streak pressure to return tomorrow.

**Design pillars**

1. Instant play — no login, no tutorial wall, first guess within 10 seconds of landing.
2. Genuinely educational — every loss ends with a fact-rich stock card, not a dead end.
3. Deterministic and fair — everyone gets the same daily puzzle; results are comparable.
4. Mobile-first — most Wordle-like traffic is phones via shared links.

### v1 scope box (what ships at launch)

| In v1                                                       | Deferred                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| 3 modes: Daily Ticker, Index Recall, Cap Battle             | Country Map, Chart Detective (Phase 4), logo/description modes (backlog) |
| ~2,500 guessable stocks, ~5,000 recognized as valid guesses | "All stocks" (50k+ global listings — bad for gameplay and data quality)  |
| 12–15 major indices                                         | Regional/exotic indices, sector indices                                  |
| Anonymous play, stats in localStorage                       | Accounts, cloud sync, leaderboards (Phase 5)                             |
| English UI                                                  | i18n                                                                     |
| Static weekly-refreshed dataset                             | Live/realtime market data (never needed for this game)                   |

---

## 1. Game modes — functional specs

Each spec below is written so it can be implemented directly: rules, states, feedback logic, scoring, share format, and edge cases. All modes share the game shell (header, mode switcher, stats, how-to-play modal).

### 1.1 Daily Ticker (flagship, Wordle-style)

- One mystery stock per day, identical for all players. Answer drawn from the curated Tier-1 pool (see §2.1), pinned to a data snapshot version so a mid-week data refresh can never change a live puzzle.
- Player gets **6 guesses**. Input is a fuzzy autocomplete over the full universe (ticker, company name, aliases). Invalid free text is rejected — only real stocks can be guessed, which keeps feedback meaningful.
- After each guess, render a feedback row comparing the guess to the answer across 5 attributes (exact rules in Appendix D):
  - **Sector** — green on exact match, gray otherwise.
  - **Industry** — green exact, yellow if same sector but different industry.
  - **HQ country** — green exact (show flag), yellow if same region (Europe, North America, Asia…).
  - **Market cap** — ↑ / ↓ arrow pointing toward the answer; green if within ±10%, yellow if same size bracket (Small/Mid/Large/Mega).
  - **Index overlap** — green if guess and answer share membership in at least one supported index ("both in S&P 500"), gray otherwise.
- Win → animated reveal + **stock card**: name, ticker, flag, sector, market cap, 5Y sparkline, 2–3 generated fact lines ("added to the DAX in 2021", "largest of 43 Industrials in this pool"). Loss after 6 → same card, softer framing.
- **Share:** spoiler-free emoji grid (Appendix E) + result line `Daily Ticker #128 — 3/6 🔥12` with streak.
- States: `idle → playing → won | lost` (persisted per-day in localStorage so refresh can't reset or replay).
- Edge cases: dual listings and share classes resolve to one canonical company (guessing GOOG or GOOGL both mean Alphabet); aliases accepted ("Facebook" → Meta); an exact-company guess wins regardless of which listing was typed.

### 1.2 Index Recall (Sporcle-style)

- Player picks an index → type-to-reveal as many constituents as possible. Optional timer (default 5:00 for a 40-stock index, scaled by constituent count; untimed "zen" toggle).
- Each reveal shows the company tile with sector color and index weight; a progress ring shows `34/40`; missed names are revealed at the end, grouped by sector — that's the learning moment.
- Fuzzy acceptance: "BMW", "Bayerische Motoren Werke", and the ticker all count; matching rules in §2.5.
- **Variants** (same engine, different config):
  1. **Full recall** — small indices only (Dow 30, DAX 40, EURO STOXX 50).
  2. **Top 10 by weight** — for big indices (S&P 500, Nikkei 225): name the top 10, then bonus round to drag them into weight order.
  3. **Imposter** — 4 tickers shown, one is _not_ in the index; 10 rapid rounds. Cheap to build, very replayable.
- Scoring: % named × time bonus; per-index personal bests stored locally; per-index leaderboards arrive in Phase 5.

### 1.3 Cap Battle (Higher/Lower)

- Two companies shown; guess which has the larger market cap → the loser card slides away, a new challenger appears, streak counter climbs. One mistake ends the run.
- Pull pairs weighted toward "interesting" matchups (same sector, or caps within 3× of each other) so it isn't trivial.
- Fastest mode to implement, highest "one more round" retention — ship it early as the arcade counterpart to the daily puzzle.

### 1.4 Country Mode (Phase 4)

1. **Country recall** — pick a country, name its X largest listed companies (X scales with market size: US 25, Germany 15, Austria 5).
2. **Pin the HQ** — shown a company, click the world map; feedback is distance + direction arrow, GeoGuessr-style; 4 rounds per day, score by proximity.

- Only stocks with verified country data participate (validation gate in the pipeline).

### 1.5 Chart Detective (Phase 4)

- A normalized 5Y weekly price line is shown with no labels that give the answer away (indexed to 100, no absolute prices, no company events).
- 5 progressive hints, each costing points: sector → market-cap bracket → country → IPO decade → first letter. Guess anytime via the same autocomplete.
- Requires per-stock sparkline data (~260 weekly closes), generated at build time (§2.3).

### 1.6 Backlog (v2+ candidates, do not build yet)

Logo mode (needs a trademark review first — see §2.6), guess-from-description (use _generated_ blurbs from structured fields, never republished third-party text), sector-sort puzzles, revenue-mix pie guessing, head-to-head realtime duels, "time machine" (guess the year from a chart window), themed weekly packs (EV week, dividend aristocrats).

---

## 2. Data strategy (do this before any UI exists)

The data layer is the hardest and most differentiating part of this project. Get it right first; every mode is a thin UI over it.

### 2.1 Define the universe (don't literally do "all stocks")

- **Tier 1 — answer pool (~2,500 companies):** every constituent of the supported indices (§ Appendix C) plus the global top ~1,500 by market cap. Puzzles only ever pick answers from Tier 1, so answers are always recognizable.
- **Tier 2 — guess pool (~5,000 companies):** Tier 1 plus the next few thousand by cap, so the autocomplete almost never says "not found" for a stock a player knows.
- Store a `tier` field per company; the pipeline enforces pool sizes and logs the cut lines.

### 2.2 Data sources (free-first, verify current terms before Phase 1)

| Need                                                   | Primary source                                                                                      | Notes                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| US listings master list                                | SEC EDGAR `company_tickers.json`                                                                    | Free, official, no key                                                                      |
| Index constituents                                     | Wikipedia constituent lists, scraped at build time                                                  | Maintained for all Appendix C indices; validate counts (S&P 500 = ~503 listings, DAX = 40…) |
| Constituent cross-check + weights                      | Public ETF holdings CSVs from providers (e.g., iShares publishes daily holdings for its index ETFs) | Good source for index weights used in Index Recall                                          |
| Company profile: sector, industry, country, market cap | Yahoo Finance via `yahoo-finance2` (npm) — or Python `yfinance` if you prefer a Python pipeline     | Unofficial; use only at build time with caching + throttling, never at runtime              |
| Historical prices (sparklines)                         | Same as above, 5Y weekly closes                                                                     | Only for Tier 1                                                                             |
| FX rates (normalize caps to USD)                       | ECB reference rates (e.g., via the free frankfurter.app API)                                        | One daily snapshot is enough                                                                |
| Optional paid upgrade later                            | Financial Modeling Prep / EODHD / Finnhub                                                           | Cleaner constituents + fundamentals; check current free-tier limits, they change often      |

### 2.3 Pipeline architecture — build-time, not runtime

A game does not need live data. A static snapshot refreshed weekly means zero runtime API costs, no rate limits, no keys in the browser, and instant page loads.

- Location: `/pipeline` in the repo, TypeScript run with `tsx` (keeps one language across the project; Python + yfinance + pandas is a fine alternative if you'd rather).
- Steps: fetch universe → fetch index constituent lists → enrich each company profile (batched, throttled, cached to `.cache/` so re-runs are cheap) → fetch FX snapshot → compute derived fields (region, bracket, tier, aliases) → **validate with Zod** → emit artifacts.
- Artifacts committed to the repo, served statically from `/public/data`:
  - `data/stocks.json` — full records for the app.
  - `data/indices.json` — index metadata + holdings with weights.
  - `data/sparklines.json` — packed weekly closes for Tier 1 only.
  - `data/search-index.json` — slim `{id, ticker, name, aliases}` list for the client autocomplete (target < 300 KB gzipped).
  - `data/meta.json` — `snapshotVersion`, generation date, source stats.
- Refresh: weekly GitHub Action opens a PR with a **diff report** ("41 caps changed >5%, 2 additions to CAC 40, 1 delisting"). Human merges. Live daily puzzles pin their `snapshotVersion`, so refreshes never change an active answer.

### 2.4 Data schema

Full TypeScript types in Appendix A. Core entities:

- **Company** — `id`, `name`, `aliases[]`, canonical `ticker`, `listings[] {ticker, exchange, suffix}`, `country` (ISO-3166), `region`, `sector` (fixed 11-sector taxonomy), `industry`, `marketCapUSD`, `capBracket`, `currency`, `ipoYear?`, `employees?`, `website?`, `indexMemberships[]`, `tier`, `sparkline?`, `updatedAt`.
- **Index** — `id`, `displayName`, `provider`, `region`, `holdings[] {companyId, weight?}`, `source`, `updatedAt`.
- **Puzzle** — `id`, `date`, `mode`, `answerCompanyId`, `snapshotVersion` (answers curated per §2.7).

### 2.5 Known data landmines (handle explicitly, don't discover in production)

1. **Dual listings, ADRs, share classes** — model a canonical _Company_ with multiple _Listings_; all guesses resolve to the company. (Alphabet A/C, Shell London/Amsterdam history, SAP Frankfurt + NYSE ADR.)
2. **Name normalization** — aliases file for renames (Facebook→Meta), abbreviations (BMW), umlauts/accents (fold to ASCII for matching, display original), and legal-suffix stripping (AG, SE, PLC, Inc., NV, SpA).
3. **Ticker suffixes** — `.DE`, `.L`, `.PA`, `.T` conventions vary by source; store exchange separately and normalize on ingest.
4. **Market cap currency** — convert everything to USD with the same daily FX snapshot; never compare caps across mixed currencies.
5. **Missing fields** — some non-US names lack sector or employees; validation must fail loudly, with a small human-maintained `overrides.json` as the escape hatch.
6. **Corporate actions between refreshes** — delistings and M&A are absorbed at the next snapshot; active puzzles are pinned (§2.3).
7. **Recall answer matching** — normalized Levenshtein/token match with per-name thresholds; must accept "Muenchener Rueck" for Münchener Rück but reject lazy 2-letter prefixes. Table-driven tests for this exact function.

### 2.6 Licensing and legal flags (review before launch — this is a checklist, not legal advice)

- Index names (S&P 500, FTSE 100, DAX…) are trademarks and index providers license constituent data commercially. Free hobby quizzes referencing publicly available lists are common practice, but the risk profile changes if you monetize — decide your comfort level now, revisit before adding ads/payments.
- Company **logos** are trademarked — v1 uses generated two-letter monogram avatars instead; a logo mode needs its own review.
- Don't republish third-party descriptive text (e.g., Yahoo company summaries) verbatim; generate hint/fact text from structured fields instead.
- Check the terms of every data source actually used; keep attribution where required.
- Site basics: privacy policy, and an imprint/contact page where local law requires one.

### 2.7 Puzzle curation

Don't pick daily answers uniformly at random: a generator script proposes a schedule (difficulty-scored by cap rank, index membership count, and name recognizability), enforcing no repeats within 180 days and a rough easy→hard weekly rhythm, and writes `puzzles/daily.json`. You can hand-edit before merging. Difficulty tuning later uses real guess-distribution data (Phase 7).

---

## 3. Architecture & stack (minimal by design)

Guiding rule: **a fully static site — zero backend, zero runtime services, and the smallest dependency set that stays testable.** The build output is plain HTML/JS/JSON files, which is what makes it cheap to host, trivial to move between hosts, and durable over time.

- **Framework:** Vite + React + TypeScript + Tailwind CSS. One single-page app, no server anywhere. (Next.js in static-export mode is the fallback if you ever genuinely need server features; nothing in this game requires them.)
- **Repo & hosting:** the code lives on GitHub; one GitHub Action builds and deploys to **GitHub Pages** on every push to `main`. Custom domains are supported. Note: on GitHub's free plan, Pages requires a public repo — if you want the source private, deploy the same static build to Cloudflare Pages, Netlify, or Vercel (all free-tier) instead; nothing else changes.
- **Data at runtime:** the static JSON artifacts from §2.3, served from `/public/data`; only the slim search index loads eagerly, everything else lazily per mode.
- **Search/autocomplete:** MiniSearch client-side — one tiny dependency, no service.
- **State:** plain React hooks plus one small context. No state-management library. Persistence via a thin `storage.ts` wrapper over localStorage (stats, streaks, per-day completion) with a schema version field for future migrations.
- **Routing:** one micro-router (e.g., wouter) — or zero routing deps by keying off a `?mode=` URL param. Pick one in Phase 0 and stay.
- **Daily answer:** resolved client-side from the curated schedule seeded by the UTC date, stored lightly obfuscated (e.g., base64 ids) so it isn't a casual spoiler. A determined user can extract it from the bundle — the standard Wordle-clone tradeoff, accepted for v1. Because the game logic is pure (below), a server-side check could be bolted on later without rearchitecting.
- **Accounts/leaderboards (Phase 5, optional):** Supabase is called straight from the client, so it attaches to a static site later with no hosting change.
- **Quality tooling:** Zod for pipeline validation, Vitest for logic tests. Playwright optional — a single smoke spec earns its keep; a large E2E suite doesn't.
- **Analytics/monitoring:** optional; at most one cookieless script (Plausible/Umami). No error-tracking service — a static site at this scale has very few ways to fail.
- **Dependency budget:** target ≤ 10 runtime dependencies; every new package needs a one-line justification logged in `CLAUDE.md`.

**Longevity notes — what makes this future-proof, and what doesn't:** static files outlive frameworks; the deployed site keeps working untouched for years. The two moving parts are deliberately isolated: (1) external data sources exist only inside `/pipeline`, so when an unofficial API eventually breaks — the most likely failure — you replace one fetcher and nothing else is affected; (2) `/src/game` is pure, framework-free TypeScript, portable to any future UI. The one real maintenance commitment is the weekly data refresh: skip it and the game still runs, just on aging data. Pin dependency versions and upgrade deliberately, not automatically.

### Proposed repo layout

```
/src
  /modes            # daily-ticker/, recall/, cap-battle/  (one folder per mode)
  /game             # PURE functions: feedback.ts, seed.ts, scoring.ts, matching.ts
  /components       # GuessInput, AttributeRow, StockCard, ShareButton, StatsModal
  /lib              # search.ts, storage.ts
/pipeline           # fetchers, enrichment, validation, emit (Node scripts run with tsx)
  /fixtures         # real captured API responses for tests
/public/data        # committed artifacts (stocks.json, indices.json, ...)
/puzzles            # curated daily schedules per mode
/tests              # vitest (+ one optional playwright smoke spec)
ROADMAP.md  CLAUDE.md  PROGRESS.md
```

Everything in `/src/game` must be pure and framework-free — it's where correctness matters and where tests are written first.

---

## 4. UX & design direction

- **Commit to one distinctive aesthetic in Phase 0** and write it into `CLAUDE.md` so every screen follows it. Three candidate directions — pick one, don't blend:
  1. **Trading terminal** — near-black, dense grid, tabular numerals, monospace data, one hot accent for feedback states.
  2. **Ledger / editorial** — paper-light, characterful serif display face, hairline rules, feels like the FT built a game.
  3. **Arcade brutalist** — chunky borders, oversized type, saturated feedback colors, playful motion.
     Whichever you choose: a characterful display typeface used with restraint + a utility/mono face for data; a 4–6 color token palette defined once; and **one signature element** the game is remembered by (e.g., the flip-reveal of feedback tiles, or the ticker-tape marquee of past answers). Avoid the generic AI-site look (cream + terracotta serif, or black + acid green) unless deliberately chosen.
- **The autocomplete is the make-or-break interaction.** Instant results, keyboard-first (↑/↓/Enter), each row shows ticker + name + country flag + tiny cap figure, tolerant of typos and aliases. Budget real time on this in Phase 2.
- **Feedback must not rely on color alone:** pair green/yellow/gray with icons (✓ ~ ↑ ↓) — colorblind-safe by construction; verify with a simulator.
- Mobile-first layouts: the attribute grid becomes stacked cards under ~400 px; touch targets ≥ 44 px; the share sheet uses `navigator.share` with clipboard fallback.
- Motion: one orchestrated moment per game (staggered tile flip on guess reveal; count-up on the stock card). Respect `prefers-reduced-motion`.
- Every ending teaches: win or lose, the stock card appears with sparkline and generated facts. Empty states invite action ("Pick an index to start"), errors say what happened and what to do.
- How-to-play modal auto-opens on first visit per mode (localStorage flag); rules stay one tap away.
- Accessibility floor: visible focus states, `aria-live="polite"` on feedback rows, semantic buttons, contrast ≥ 4.5:1, full keyboard play.
- Share cards: emoji grid for messengers, plus one static OG image so pasted links render a preview. Per-puzzle OG images (pre-generated by the pipeline for scheduled days) are backlog — never include the answer in any preview.

---

## 5. Phased build plan with acceptance criteria

Do not start a phase until the previous phase's boxes are checked.

### Phase 0 — Decisions & scaffold

Lock: aesthetic direction (§4), v1 modes (recommended: Daily Ticker + Index Recall + Cap Battle), universe cut lines (§2.1), project name + domain (check for trademark collisions before buying).
Build: GitHub repo init, Vite + React + TS + Tailwind scaffold, ESLint/Prettier, Vitest wiring, one GitHub Action for CI + Pages deploy, `CLAUDE.md` with conventions and design tokens.

- [ ] "Hello world" deploys to the live GitHub Pages URL from `main`
- [ ] CI runs lint + unit tests on every PR
- [ ] `CLAUDE.md` documents stack, folder layout, design tokens, and coding conventions

### Phase 1 — Data pipeline

Build fetchers with caching + throttling, Wikipedia constituent scrapers with count validation, ETF-holdings cross-check for weights, profile enrichment, FX normalization, alias/overrides files, Zod validation, artifact emit, diff report script.

- [ ] `pnpm pipeline` completes from a cold cache without manual steps
- [ ] `stocks.json` contains ≥ 2,000 Tier-1 and ≥ 4,000 total companies
- [ ] 100% of S&P 500, DAX, FTSE 100, and Nikkei 225 constituents present with sector, country, and USD market cap
- [ ] Validation reports 0 critical errors; overrides file documents every manual fix
- [ ] `search-index.json` < 300 KB gzipped
- [ ] Refresh runbook written (how to run, review the diff PR, merge)

### Phase 2 — Core engine + Daily Ticker MVP

Tests-first on `/src/game`: feedback calculator (Appendix D), seed/schedule resolution, matching. Then UI: autocomplete input, attribute grid with reveal animation, win/loss flow, stock card, localStorage stats (played, win %, streak, guess distribution), share text, how-to-play modal.

- [ ] ≥ 25 table-driven unit tests green on feedback + matching logic, including dual-listing and cap-edge cases
- [ ] Full play-through works on the production URL; refresh mid-game restores state; completed day can't be replayed
- [ ] Same answer appears in two different browsers on the same UTC day; different answer next day
- [ ] Daily answer is not plaintext-greppable in the built bundle (obfuscation applied)
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95

### Phase 3 — Index Recall + Cap Battle

Mode framework under `/src/modes`, index picker with search, recall engine (fuzzy accept, reveal tiles, progress ring, timer, end-screen reveal by sector), Top-10 and Imposter variants, Cap Battle with weighted pair selection and streak records.

- [ ] ≥ 12 indices fully playable in Recall with correct constituent counts and weights
- [ ] Recall accepts defined aliases and rejects sub-3-character lazy guesses (tested)
- [ ] Imposter never shows a stock that is genuinely ambiguous (constituent data validated per round)
- [ ] Cap Battle runs 50+ rounds without repeats feeling stale; personal best persists

### Phase 4 — Country + Chart modes, polish pass

Pin-the-HQ world map (e.g., react-simple-maps or d3-geo) with distance scoring, country recall lists, Chart Detective with sparkline rendering + hint ladder, site OG image, stats dashboard, animation/empty-state/error polish, full a11y audit.

- [ ] 5 modes live behind the mode switcher
- [ ] Sparklines render without answer-revealing labels; hint ladder deducts points correctly
- [ ] Pasting a result link in a chat app shows the OG card
- [ ] Keyboard-only and screen-reader play-through of Daily Ticker verified

### Phase 5 — Accounts & leaderboards (optional)

Supabase magic-link auth called directly from the static client, stat sync (local merges to cloud on first login), daily + all-time leaderboards, result validation in a Supabase edge function (only validated results rank), basic abuse controls.

- [ ] Anonymous play remains fully functional and first-class
- [ ] Local streak survives login (merge, not overwrite)
- [ ] Leaderboard accepts only edge-function-validated results

### Phase 6 — Launch prep

SEO (metadata, sitemap, per-mode landing copy), optional cookieless analytics, privacy/imprint pages, 404 page, favicon + PWA manifest, cross-browser QA (iOS Safari especially), a feedback link, soft launch to 2–3 communities.

- [ ] Launch checklist (this list) fully checked in a `LAUNCH.md`
- [ ] Error rate < 1% of sessions in the first soft-launch week
- [ ] Data refresh Action has run end-to-end at least twice unattended

### Phase 7 — Post-launch iteration (ongoing)

Archive mode ("play yesterday's"), difficulty tuning from real guess distributions, new backlog modes, more indices, i18n if traction warrants, monetization decision (which reopens §2.6).

---

## 6. Testing & quality strategy

- **Game logic:** table-driven Vitest suites for `feedback.ts`, `matching.ts`, `scoring.ts`, `seed.ts` — written _before_ implementation. Edge cases: identical caps, cross-region same-sector guesses, alias collisions, class-share guesses.
- **Pipeline:** validation _is_ the test suite — schema (Zod), referential integrity (every index holding resolves to a company), sanity ranges (no $0 or $10T caps), count checks per index. Fixtures in `/pipeline/fixtures` are real captured responses so parsers are coded against reality.
- **E2E (Playwright):** win path and loss path for Daily Ticker, one Recall session, localStorage persistence across reload, mobile viewport run.
- **Refresh safety:** diff report reviewed on every data PR; a puzzle-integrity check asserts scheduled answers still exist in the pinned snapshot.

## 7. Risks & open questions (decide during your review)

1. **Licensing comfort level** (§2.6) — the only risk that grows with success; decide the monetization stance early because it shapes data sourcing.
2. **Cheating tolerance** — fully static means the daily answer is technically extractable from the bundle; fine for casual play, revisit only if leaderboards ever make it matter.
3. **Mode cut for v1** — 3 recommended; shipping 5 delays launch by roughly a week.
4. **Name & domain** — needs a trademark sanity check before buying merch^H^H domains.
5. **Daily reset time** — UTC is simplest and recommended; a local-midnight reset fragments the shared-puzzle feeling.
6. **Data refresh ownership** — who reviews the weekly diff PR (you, or auto-merge with alerts)?

## 8. Working with Claude Code on this roadmap

1. Create the repo, commit this file as `ROADMAP.md`, and have Claude Code generate `CLAUDE.md` from §3–4 (stack, layout, tokens, conventions).
2. Work **one phase per session**. Session opener prompt: _"Read ROADMAP.md and PROGRESS.md. We're on Phase N. Propose a task list mapped to the acceptance criteria, then implement task by task."_
3. Have Claude Code append a dated summary to `PROGRESS.md` at the end of every session — this is what keeps multi-session context coherent.
4. For anything in `/src/game`: ask for the test file first, review the cases, then ask for the implementation.
5. Capture one real response from each external source into `/pipeline/fixtures` early (Phase 1, day 1) so parsing code is written against actual payloads, not guesses.
6. Commit per acceptance criterion; keep PRs small enough that you can actually review them.
7. When a phase's boxes are all checked, tag a release (`v0.N`) before starting the next phase.

---

## 9. Appendices

### A. Core TypeScript types

```ts
type Region =
  "North America" | "Latin America" | "Europe" | "Middle East & Africa" | "Asia" | "Oceania";
type CapBracket = "Small" | "Mid" | "Large" | "Mega"; // <2B, 2–10B, 10–200B, >200B USD
type Tier = 1 | 2;

interface Listing {
  ticker: string;
  exchange: string;
  mic?: string;
  primary: boolean;
}

interface Company {
  id: string; // stable slug, e.g. "alphabet"
  name: string; // display name
  aliases: string[]; // ["google", "goog", "googl", "alphabet inc"]
  listings: Listing[];
  country: string; // ISO-3166 alpha-2
  region: Region;
  sector: string; // fixed 11-sector taxonomy
  industry: string;
  marketCapUSD: number;
  capBracket: CapBracket;
  currency: string; // reporting currency of primary listing
  ipoYear?: number;
  employees?: number;
  website?: string;
  indexMemberships: string[]; // index ids
  tier: Tier;
  sparkline?: number[]; // ~260 weekly closes, indexed to 100 (Tier 1 only)
  updatedAt: string; // ISO date
}

interface IndexDef {
  id: string; // "sp500"
  displayName: string; // "S&P 500"
  provider: string;
  region: Region | "Global";
  holdings: { companyId: string; weight?: number }[];
  source: string; // provenance URL/type
  updatedAt: string;
}

interface DailyPuzzle {
  number: number;
  date: string;
  mode: "daily-ticker";
  answerCompanyId: string;
  snapshotVersion: string;
}
```

### B. Example company record

```json
{
  "id": "sap",
  "name": "SAP",
  "aliases": ["sap se"],
  "listings": [
    { "ticker": "SAP", "exchange": "XETRA", "primary": true },
    { "ticker": "SAP", "exchange": "NYSE", "primary": false }
  ],
  "country": "DE",
  "region": "Europe",
  "sector": "Information Technology",
  "industry": "Software",
  "marketCapUSD": 280000000000,
  "capBracket": "Mega",
  "currency": "EUR",
  "ipoYear": 1988,
  "indexMemberships": ["dax", "eurostoxx50"],
  "tier": 1,
  "updatedAt": "2026-07-06"
}
```

### C. v1 index list (~15; ✚ = stretch)

S&P 500, NASDAQ-100, Dow Jones 30, FTSE 100, DAX 40, MDAX ✚, CAC 40, EURO STOXX 50, IBEX 35 ✚, FTSE MIB ✚, AEX 25, SMI 20, OMXS30 ✚, Nikkei 225, Hang Seng, S&P/ASX 200 ✚, TSX 60 ✚, NIFTY 50 ✚. (CSI 300 and Bovespa deferred — constituent data is harder to source reliably.)

### D. Daily Ticker feedback rules (deterministic spec)

| Attribute     | 🟩 Green              | 🟨 Yellow       | ⬜ Gray   | Extra                                                        |
| ------------- | --------------------- | --------------- | --------- | ------------------------------------------------------------ |
| Sector        | equal                 | —               | different | —                                                            |
| Industry      | equal                 | same sector     | different | —                                                            |
| Country       | equal                 | same region     | different | show flag                                                    |
| Market cap    | within ±10% of answer | same capBracket | otherwise | ↑ if answer larger, ↓ if smaller (always shown unless green) |
| Index overlap | ≥1 shared index       | —               | none      | tooltip lists shared indices                                 |

Comparisons run on the pinned snapshot; ratios computed as `guessCap / answerCap`.

### E. Share format spec

```
Daily Ticker #128 3/6 🔥12
⬜🟨⬜⬇️⬜
🟩🟨🟨⬆️⬜
🟩🟩🟩🟩🟩
<site-url>
```

Column order matches Appendix D. Cap column shows the arrow emoji when not green. Never include the answer, guessed names, or the date-derived stock in any share output.

---

_End of roadmap. Suggested first action after review: Phase 0, starting with the aesthetic decision and `CLAUDE.md`._
