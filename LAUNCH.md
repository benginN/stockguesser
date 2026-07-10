# Launch checklist (ROADMAP §5 Phase 6)

Permanent-home decision (2026-07-10): the game lives on GitHub Pages at
https://benginn.github.io/stockguesser/ — no custom domain, no external services,
ever. Phase 5 (accounts/leaderboards) is permanently skipped: it would require a
backend service, and anonymous localStorage play is first-class by design.

## Checklist

- [x] SEO: title/description/canonical/OG/twitter meta, `robots.txt`, `sitemap.xml`
- [x] Per-mode landing copy — the static pre-shell describes the game before JS loads;
      all modes reachable via `?mode=` URLs listed in the sitemap
- [x] Analytics: **deliberately none** (GitHub-only decision; nothing external, nothing
      collected — see privacy page)
- [x] Privacy page (`privacy.html`) + feedback link (GitHub issues) in the footer
- [x] 404 page (`404.html`, served by GitHub Pages for unknown paths)
- [x] Favicon (SVG) + PWA manifest + icons (512/192/apple-touch-180) + theme-color
- [x] Cross-browser QA: full e2e suite green on Chromium, WebKit (iPhone 13 profile —
      iOS Safari proxy), and Firefox (24 specs)
- [x] Lighthouse mobile: Performance 91 · Accessibility 100 · (SEO/best-practices spot-checked)
- [ ] Data refresh Action has run end-to-end at least twice unattended
      — run 1: manually dispatched 2026-07-10 (verify the diff PR it opens)
      — run 2: first Monday cron (2026-07-13 05:30 UTC)
      → check `gh run list --workflow=data-refresh.yml` and review/merge the PR per
      `pipeline/RUNBOOK.md`
- [ ] Soft launch to 2–3 communities (human task: finance Twitter/Reddit/Discord;
      the share grid + OG card are the growth loop)
- [~] "Error rate < 1% of sessions in week 1" — not measurable without analytics
  (deliberate). Proxy: GitHub issues stay empty of crash reports; e2e suite guards
  every release.

## Release ritual

1. CI green on `main` (lint, format, 160 unit tests, 24 e2e across 3 engines, build).
2. Merge the weekly data PR only after reading its diff report (RUNBOOK).
3. Tag `v0.N` at every phase/feature milestone; GitHub Pages redeploys on every push.
