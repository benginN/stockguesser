# Stock Guesser — project conventions

Wordle × GeoGuessr for the stock market. Full plan lives in `ROADMAP.md` (read it first);
session history lives in `PROGRESS.md` (append a dated summary at the end of every session).

## Locked Phase-0 decisions

| Decision        | Choice                                                         | Notes                                                      |
| --------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| Aesthetic       | **Trading terminal** (ROADMAP §4 option 1)                     | near-black, hairlines, mono data, one amber accent         |
| v1 modes        | Daily Ticker, Index Recall, Cap Battle                         | Country/Chart modes in Phase 4                             |
| Routing         | `?mode=` URL param, zero routing deps                          | revisit only if deep links demand it                       |
| Daily reset     | UTC midnight                                                   | see `src/game/seed.ts`                                     |
| Package manager | **npm** (roadmap said pnpm; this machine has no pnpm/corepack) | scripts: `npm run dev/test/lint/build/pipeline`            |
| Name            | "Stock Guesser" — working title                                | trademark/domain check pending, see PROGRESS.md open items |

## Stack

- Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 (`@theme` tokens in `src/index.css`, no `tailwind.config`)
- Vitest for unit tests, ESLint (flat config) + Prettier, `tsx` for pipeline scripts
- Fully static site — **no backend, no runtime API calls, no secrets in the client, ever.**
  Data is build-time JSON in `/public/data` produced by `/pipeline`.
- Deploys to GitHub Pages via `.github/workflows/deploy.yml`; CI (lint+format+test+build) on every PR.
- **Dependency budget: ≤ 10 runtime dependencies.** Every new package gets a one-line justification here:
  - `react`, `react-dom` — the UI framework.
- Pipeline-only devDependencies (never shipped to the client):
  - `zod` — pipeline validation is the data test suite.
  - `yahoo-finance2` — build-time company profiles/caps/prices (the one unofficial source).
  - `cheerio` — Wikipedia constituent-table parsing.

## Layout

```
/src/modes       one folder per game mode (daily-ticker/, recall/, cap-battle/)
/src/game        PURE framework-free logic (feedback, seed, scoring, matching) — tests first, no React imports
/src/components  shared UI (GuessInput, AttributeRow, StockCard, ShareButton, StatsModal)
/src/lib         search.ts (MiniSearch wrapper), storage.ts (versioned localStorage wrapper)
/pipeline        build-time data scripts; fixtures/ holds real captured API responses
/public/data     committed JSON artifacts (stocks, indices, sparklines, search-index, meta)
/puzzles         curated daily schedules
/tests           vitest suites
```

## Design tokens (Trading terminal)

Defined once in `src/index.css` under `@theme` — never hardcode hex values in components.

| Token            | Value     | Use                                            |
| ---------------- | --------- | ---------------------------------------------- |
| `terminal-bg`    | `#0a0e14` | page background                                |
| `terminal-panel` | `#111722` | cards, tiles, inputs                           |
| `terminal-line`  | `#1e2735` | hairline borders                               |
| `terminal-text`  | `#d5dde9` | primary text                                   |
| `terminal-dim`   | `#8a94a6` | secondary text, labels                         |
| `accent`         | `#ffb02e` | ONE hot accent: brand mark, CTAs, streak flame |
| `feedback-hit`   | `#2bd576` | green feedback state                           |
| `feedback-near`  | `#e8c547` | yellow feedback state                          |
| `feedback-miss`  | `#3a4250` | gray feedback state                            |

Fonts: `font-display` (Archivo stack) for headings/UI, `font-data` (IBM Plex Mono stack) for
tickers, numbers, and labels. Numerals are always tabular.

**Signature element:** the staggered flip-reveal of feedback tiles — the one orchestrated
animation per game. Respect `prefers-reduced-motion` (global rule already in `index.css`).

Feedback never relies on color alone — always pair with icons (✓ ~ ↑ ↓). Contrast ≥ 4.5:1,
touch targets ≥ 44px, mobile-first (attribute grid stacks under ~400px).

## Coding conventions

- `/src/game` is sacred: pure functions, no React/DOM/browser imports, table-driven tests
  written **before** implementation.
- localStorage only through `src/lib/storage.ts` (schema-versioned).
- Pipeline: cache HTTP responses to `pipeline/.cache/`, throttle external calls, validate with
  Zod, fail loudly on missing fields (`overrides.json` is the escape hatch).
- Never republish third-party descriptive text; generate facts from structured fields.
- No logos — two-letter monogram avatars (trademark risk, ROADMAP §2.6).
- Commit per acceptance criterion; tag `v0.N` when a phase completes.
