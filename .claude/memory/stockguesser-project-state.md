---
name: stockguesser-project-state
description: "Stock Guesser game — permanent GitHub-Pages home, phase status, key repo facts"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4d8a7ce1-90f3-43ff-a312-29df9926d782
---

Stock Guesser (Wordle × GeoGuessr for stocks) lives at https://github.com/benginN/stockguesser, deployed to https://benginn.github.io/stockguesser/ — **permanent home per user decision (2026-07-10): GitHub Pages forever, no domain, no external services**. Phase 5 (Supabase accounts/leaderboards) permanently skipped; no analytics ever (privacy page says "collects nothing").

**Why:** user explicitly said the game stays fully on GitHub.
**How to apply:** never suggest external hosting/services/analytics; anything needing a backend is out of scope.

Status as of 2026-07-10: Phases 0–4 + 6 complete (tags v0.0–v0.5). Roadmap in `ROADMAP.md`, session log in `PROGRESS.md`, launch checklist in `LAUNCH.md`, pipeline ops in `pipeline/RUNBOOK.md`. Matching handles core names (trailing generic words) + curated aliases in pipeline/data/aliases.json; recall has a ticker-hint mode (names-only acceptance). Weekly refresh gained a puzzle-integrity gate (pipeline/check-puzzles.ts). Remaining: soft launch (user's task), 2nd unattended data-refresh run (Monday 05:30 UTC cron), Phase 7 backlog (archive mode, difficulty tuning, i18n…).

Gotchas that cost time (avoid re-deriving): Yahoo throttles GitHub-Actions IPs hard — enrichment must retry transients and never tombstone them; Playwright `reuseExistingServer` can run e2e against a stale build (kill port 4173); the fictional-2026 dataset has SpaceX publicly traded (SPCX, NASDAQ-100). See [[bengin-preferences]].
