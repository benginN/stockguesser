# StockGuesser 📈

**Play it now → https://benginn.github.io/stockguesser/**

Wordle × GeoGuessr for the stock market. One shareable daily puzzle plus endless
practice modes — no login, no ads, no tracking, everything runs in your browser.

## Game modes

| Mode                | The idea                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Daily Ticker**    | One mystery stock per day (same for everyone, UTC). 6 guesses; each compares sector · industry · country · market cap · index overlap. Share your spoiler-free emoji grid.                                          |
| **Index Recall**    | Name every constituent of an index (or its Top 10 by weight) against the clock — S&P 500, DAX, Nikkei 225 and 12 more. **Imposter**: spot the stock that doesn't belong. **Custom**: build and play your own index. |
| **Cap Battle**      | Higher or lower? One mistake ends the streak.                                                                                                                                                                       |
| **Country**         | Name a country's biggest listed companies, or pin a company's HQ on the world map.                                                                                                                                  |
| **Chart Detective** | A naked 5-year price curve. Buy hints (sector → size → country → IPO decade → first letter), guess anytime.                                                                                                         |

## How it works

Fully static site — no backend, ever. A weekly pipeline compiles ~4,400 companies
across 15 major indices from public sources (SEC EDGAR, Wikipedia constituent lists,
Yahoo Finance at build time, ECB FX rates) into validated JSON that GitHub Pages
serves. A GitHub Action refreshes the data every Monday and opens a reviewable PR
with a diff report. Your stats live in localStorage and never leave your device
([privacy](https://benginn.github.io/stockguesser/privacy.html)).

Stack: Vite · React · TypeScript · Tailwind. Game logic is pure, framework-free
TypeScript under `src/game/` with table-driven tests (182 unit + 24 e2e across
Chromium/WebKit/Firefox).

- Full build plan: [`ROADMAP.md`](ROADMAP.md) · session history: [`PROGRESS.md`](PROGRESS.md)
- Data pipeline ops: [`pipeline/RUNBOOK.md`](pipeline/RUNBOOK.md)

## Develop

```bash
npm ci
npm run dev        # local dev server
npm test           # unit tests
npm run test:e2e   # Playwright smoke suite
npm run pipeline   # regenerate /public/data from sources (slow, cached)
```

Found a company the game should recognize by another name? Open an issue or PR
against [`pipeline/data/aliases.json`](pipeline/data/aliases.json) — one line fixes it.

---

_Market data is a weekly static snapshot compiled from public sources. Nothing here
is investment advice. Index names are trademarks of their respective owners._
