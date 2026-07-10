# Progress log

Append a dated summary at the end of every working session (ROADMAP.md §8.3).

## 2026-07-10 (session 4) — Phase 3: Index Recall + Cap Battle ✅ → tagged v0.3

**All acceptance boxes checked:**

- [x] 15 indices playable in Recall (10 full-recall ≤60 stocks, 5 as Top-10) with
      pipeline-validated counts and computed weights shown on tiles
- [x] Alias acceptance + sub-3-char lazy-guess rejection covered by matching tests;
      exact-name pass beats fuzzy cousins ("Siemens" ≠ "Siemens Energy")
- [x] Imposter structurally unambiguous: imposter drawn only from companies whose
      validated indexMemberships exclude the index (30-seed property test)
- [x] Cap Battle: interesting pairs (same sector or caps within 3×), 24-company
      recent-window against staleness (50-round test), personal best persists

**Shipped:** recall engine (type-to-reveal, progress ring, 7.5s/stock timer with zen
toggle, sector-grouped end screen with weights), Top-10 and Imposter variants,
higher/lower Cap Battle with monogram avatars (no logos — §2.6), per-index personal
bests, 130 unit + 5 e2e tests.

**Deferred from §1.2:** Top-10 drag-into-weight-order bonus round (backlog).

**Next:** Phase 4 — Country mode (pin-the-HQ map), Chart Detective, polish pass.
Needs a mapping dep decision (react-simple-maps vs d3-geo, ROADMAP §5 Phase 4).

## 2026-07-10 (session 3) — Phase 2: core engine + Daily Ticker ✅ → tagged v0.2

**All acceptance boxes checked:**

- [x] 52 table-driven tests on feedback (Appendix D) + matching (target ≥25), incl.
      dual-listing (GOOG/GOOGL→one company) and ±10% cap-edge cases; 110 unit tests total
- [x] Full play-through verified by 3 Playwright smoke specs (win, loss, mid-game
      persistence, no-replay) — also wired into CI
- [x] Same-answer determinism: UTC-dated curated schedule (`puzzles/daily.json`,
      365 days, difficulty-banded Mon-easy→Sat-hard, no repeats in 180 days)
- [x] Answer not plaintext-greppable: base64+reversed ids in `daily-schedule.json`
      (accepted v1 tradeoff per ROADMAP §3)
- [x] Lighthouse mobile: **Performance 91, Accessibility 100** (targets 90/95).
      Wins: static pre-shell in index.html (LCP), data preloads, dim-token contrast
      raised to 5.8:1

**Shipped UI:** keyboard-first MiniSearch autocomplete (ticker+name+alias, typo-tolerant),
flip-reveal feedback grid (the signature animation), stock card with SVG sparkline +
facts generated from structured fields, Appendix-E emoji share (navigator.share/clipboard),
stats modal (streak, distribution), first-visit how-to modal. Runtime deps now 3/10
(react, react-dom, minisearch).

**Epoch decision:** Daily Ticker #1 = 2026-07-10 (today) so live testing starts immediately.

**Next:** Phase 3 — Index Recall + Cap Battle (mode framework, recall engine + variants,
weighted pair selection).

## 2026-07-10 (session 2) — Phase 1: data pipeline ✅ → tagged v0.1

**All acceptance boxes checked:**

- [x] `npm run pipeline` completes cold-cache, no manual steps (first run: 5,495 quotes +
      4,549 profiles + 2,383 sparklines fetched, ~7 min; warm re-runs ~2 min)
- [x] `stocks.json`: **4,433 companies, 2,500 Tier-1** (targets: ≥4,000 / ≥2,000)
- [x] 100% of S&P 500 (500 companies/503 listings), DAX 40, FTSE 100, Nikkei 225 (223 —
      Wikipedia's current list) present with sector, country, USD cap — verified 0 broken
- [x] Validation: **0 criticals**; `overrides.json` documents every manual fix with a `_why`
- [x] `search-index.json` 113 KB gzipped (budget 300)
- [x] Runbook: `pipeline/RUNBOOK.md`; weekly refresh Action opens a diff-report PR

**Shape of the thing:** 15 indices scraped (Wikipedia + Nasdaq's JSON API for NDX since
Wikipedia dropped that list), SEC EDGAR US universe, Yahoo enrichment memoized per symbol
in `pipeline/.cache/`, ECB FX snapshot, union-find dedup (symbols ∪ normalized names) with
cap-clustering to split same-name companies (Merck & Co ≠ Merck KGaA, SoftBank Group ≠
SoftBank Corp), computed index weights (cap-based; price-based for Dow/Nikkei — iShares
blocks bot CSV downloads, so ETF cross-check was dropped, noted in RUNBOOK).

**Landmines actually hit (all handled + regression-tested):** Yahoo reports LSE caps in
GBP under currency "GBp"; Michelin's quote has marketCap 0 (recovered via shares×price);
Wikipedia's SMI table has a wrong Roche ticker (ROP → RO.SW override); DAX lists Airbus
under its Paris ticker; Nasdaq API names carry "Common Stock (DE)"-style suffixes.

**Known cosmetic wart:** stale-priced foreign ADRs can survive as a duplicate company
(seen once: "Nippon Express Holdings" ADR next to the Tokyo listing). Harmless for
gameplay; revisit if playtesting surfaces more.

**Next session:** Phase 2 — core engine + Daily Ticker MVP. Tests FIRST on
`/src/game/feedback.ts` + `matching.ts` (Appendix D rules), then autocomplete, attribute
grid, stock card, share text, localStorage stats.

## 2026-07-10 — Phase 0: decisions & scaffold

**Done**

- Repo initialized; roadmap committed as `ROADMAP.md`; folder layout per ROADMAP §3.
- Scaffold: Vite 8 + React 19 + TS strict + Tailwind v4, ESLint (flat) + Prettier, Vitest.
- Phase-0 decisions locked in `CLAUDE.md`: trading-terminal aesthetic (+ design tokens in
  `src/index.css`), v1 modes = Daily Ticker / Index Recall / Cap Battle, `?mode=` routing,
  UTC daily reset, npm as package manager (no pnpm on this machine).
- First pure game module `src/game/seed.ts` (UTC date key + puzzle numbering) with
  table-driven tests — establishes the tests-first convention for `/src/game`.
- GitHub Actions: `ci.yml` (lint + format + test + build on PRs and main) and `deploy.yml`
  (Pages deploy with repo-name BASE_PATH).
- Hello-world mode list renders with the token palette; `npm run lint/test/build` all green.

**Deployed**

- [x] Public repo: https://github.com/benginN/stockguesser — CI and Pages-deploy
      workflows both green on first push.
- [x] Live site: https://benginn.github.io/stockguesser/ (Pages via Actions,
      BASE_PATH asset URLs verified). **All Phase-0 boxes checked → tagged `v0.0`.**

**Open items (need the human)**

- [ ] Project name + domain: "Stock Guesser" is a working title. Decision 2026-07-10:
      no domain purchase for now — the free github.io URL is the home. Trademark check
      (ROADMAP §7.4) only becomes relevant if/when a domain is bought.
- [ ] Review the three locked aesthetic/mode decisions; all are cheap to change now,
      expensive after Phase 2.

**Next session:** Phase 1 — data pipeline. Day-1 task per ROADMAP §8.5: capture one real
response from each source (SEC EDGAR, a Wikipedia constituent list, an iShares holdings CSV,
yahoo-finance2, frankfurter.app) into `pipeline/fixtures/` before writing any parser.
