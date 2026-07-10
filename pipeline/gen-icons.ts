/**
 * Render PWA icons (512/192/180) to /public with the Playwright chromium we
 * already ship as a devDependency — same pattern as gen-og.ts.
 */
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const html = `<!doctype html><html><body style="margin:0">
<div style="width:512px;height:512px;background:#0a0e14;display:flex;align-items:center;
  justify-content:center;border-radius:0">
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:210px;
    letter-spacing:-8px;color:#d5dde9">S<span style="color:#ffb02e">G</span></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(html);
const out = (p: string) => new URL(`../public/${p}`, import.meta.url).pathname;
await page.screenshot({ path: out("icon-512.png") });
await browser.close();

// macOS sips for downscales (CI runs Linux but icons are committed, not rebuilt there)
execFileSync("sips", ["-z", "192", "192", out("icon-512.png"), "--out", out("icon-192.png")]);
execFileSync("sips", [
  "-z",
  "180",
  "180",
  out("icon-512.png"),
  "--out",
  out("apple-touch-icon.png"),
]);
console.log("icons rendered: 512, 192, 180");
