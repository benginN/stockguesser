import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 390, height: 844 }, // mobile-first, per ROADMAP §4
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    // iOS Safari proxy: WebKit engine with iPhone viewport/touch
    { name: "webkit", use: { ...devices["iPhone 13"] } },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    port: 4173,
    reuseExistingServer: true,
  },
});
