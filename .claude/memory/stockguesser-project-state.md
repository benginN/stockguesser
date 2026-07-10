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

Status as of 2026-07-10: Phases 0–4 + 6 complete (tags v0.0–v0.5). Roadmap in `ROADMAP.md`, session log in `PROGRESS.md`, launch checklist in `LAUNCH.md`, pipeline ops in `pipeline/RUNBOOK.md`. Matching handles core names (trailing generic words) + curated aliases in pipeline/data/aliases.json; recall has a ticker-hint mode (names-only acceptance), a sticky search bar, and a Custom tab (user-built indices parsed from free text, saved in localStorage). Weekly refresh gained a puzzle-integrity gate (pipeline/check-puzzles.ts). Project declared DONE by user (2026-07-10, tagged v1.0): future work is ad-hoc collaborative sessions, not phases. Remaining standing duties: review/merge the weekly Monday data PR; grow aliases.json when a guess fails. Ads stance (corrected 2026-07-10 after reading GitHub AUP with user): GitHub does NOT prohibit ads on a hobby Pages site (only "primarily commercial" sites are banned). Real blockers: AdSense rejects github.io subdomains (needs own domain — user wants none), and index-trademark/unofficial-data risk grows with monetization (ROADMAP §2.6). USER DECIDED (2026-07-10): he WANTS ads. Agreed plan: after setup completes he soft-launches, applies to EthicalAds (cookie-free, github.io-compatible; AdSense impossible without a domain), then hands over the publisher embed snippet; assistant integrates one unobtrusive unit below the game area + updates privacy.html honestly. Do not re-litigate whether to run ads — only how.

Gotchas that cost time (avoid re-deriving): Yahoo throttles GitHub-Actions IPs hard — enrichment must retry transients and never tombstone them; Playwright `reuseExistingServer` can run e2e against a stale build (kill port 4173); the fictional-2026 dataset has SpaceX publicly traded (SPCX, NASDAQ-100). See [[bengin-preferences]].
