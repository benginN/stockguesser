/**
 * Render the static 1200×630 OG share card to public/og.png using the
 * Playwright chromium we already have (no extra deps). Spoiler-free by
 * construction — pure branding, never an answer (ROADMAP §4).
 */
import { chromium } from "@playwright/test";

const html = `<!doctype html><html><body style="margin:0">
<div style="width:1200px;height:630px;background:#0a0e14;color:#d5dde9;
  font-family:'Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:28px">
  <div style="font-size:88px;font-weight:800;letter-spacing:-2px">
    Stock<span style="color:#ffb02e">Guesser</span>
  </div>
  <div style="display:flex;gap:10px;font-size:56px">
    <span>🟩</span><span>🟨</span><span>⬜</span><span>⬆️</span><span>🟩</span>
  </div>
  <div style="font-size:30px;color:#8a94a6;max-width:820px;text-align:center;line-height:1.4">
    Guess the mystery stock of the day — sector, country, market cap &amp; index clues.
  </div>
  <div style="font-family:Menlo,monospace;font-size:22px;color:#8a94a6">
    daily puzzle · index recall · cap battle · pin the HQ · chart detective
  </div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: new URL("../public/og.png", import.meta.url).pathname });
await browser.close();
console.log("public/og.png rendered (1200×630)");
