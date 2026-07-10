# Progress log

Append a dated summary at the end of every working session (ROADMAP.md §8.3).

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

**Open items (need the human)**

- [ ] Create the GitHub repo and push `main` (`gh repo create` or web UI), then enable
      Pages → Source: "GitHub Actions" in repo settings. First push should turn the
      Phase-0 box "hello world deploys to live Pages URL" green.
- [ ] Project name + domain: "Stock Guesser" is a working title — trademark sanity check
      before buying a domain (ROADMAP §7.4).
- [ ] Review the three locked aesthetic/mode decisions; all are cheap to change now,
      expensive after Phase 2.

**Next session:** Phase 1 — data pipeline. Day-1 task per ROADMAP §8.5: capture one real
response from each source (SEC EDGAR, a Wikipedia constituent list, an iShares holdings CSV,
yahoo-finance2, frankfurter.app) into `pipeline/fixtures/` before writing any parser.
