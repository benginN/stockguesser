/**
 * The one Playwright smoke spec that earns its keep (ROADMAP §3):
 * win path, loss path, mid-game persistence, no-replay after finish.
 * Today's answer is read from the human-readable schedule (not the app bundle).
 */
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const schedule = JSON.parse(
  readFileSync(new URL("../../puzzles/daily.json", import.meta.url), "utf8"),
) as {
  days: Record<string, { id: string; name: string }>;
};
const todayKey = new Date().toISOString().slice(0, 10);
const answer = schedule.days[todayKey];

async function dismissHowTo(page: Page) {
  const close = page.getByRole("button", { name: "Close" });
  if (await close.isVisible().catch(() => false)) await close.click();
}

async function guessCompany(page: Page, text: string) {
  const input = page.getByRole("combobox");
  await input.fill(text);
  await page.getByRole("option").first().click();
}

test("win path: guessing today's answer flips all tiles green and shows the card", async ({
  page,
}) => {
  test.skip(!answer, "no scheduled answer for today");
  await page.goto("/");
  await dismissHowTo(page);
  await guessCompany(page, answer.name);
  await expect(page.getByRole("status")).toContainText(answer.name);
  await expect(page.getByRole("button", { name: /share/i })).toBeVisible();
  // completed day can't be replayed
  await expect(page.getByRole("combobox")).toBeDisabled();
  // refresh keeps the finished state
  await page.reload();
  await dismissHowTo(page);
  await expect(page.getByRole("combobox")).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(answer.name);
});

test("mid-game persistence: a wrong guess survives reload", async ({ page }) => {
  test.skip(!answer, "no scheduled answer for today");
  const wrong = answer.id === "apple" ? "Microsoft" : "Apple";
  await page.goto("/");
  await dismissHowTo(page);
  await guessCompany(page, wrong);
  await expect(page.getByText("1/6")).toBeVisible();
  await page.reload();
  await dismissHowTo(page);
  await expect(page.getByText("1/6")).toBeVisible();
  await expect(page.getByRole("combobox")).toBeEnabled();
});

test("loss path: six wrong guesses reveal the answer", async ({ page }) => {
  test.skip(!answer, "no scheduled answer for today");
  const decoys = ["Apple", "Microsoft", "Toyota Motor", "SAP", "AstraZeneca", "Allianz", "Nestlé"]
    .filter((n) => n.toLowerCase() !== answer.name.toLowerCase())
    .slice(0, 6);
  await page.goto("/");
  await dismissHowTo(page);
  for (const name of decoys) await guessCompany(page, name);
  await expect(page.getByRole("status")).toContainText(answer.name);
  await expect(page.getByRole("combobox")).toBeDisabled();
});

test("recall: a Dow 30 session accepts a constituent and ends via give-up", async ({ page }) => {
  await page.goto("/?mode=recall");
  await dismissHowTo(page);
  await page.getByRole("button", { name: /Dow Jones 30/ }).click();
  await page.getByRole("button", { name: "Start" }).click();
  const input = page.getByLabel(/Name a constituent/);
  await input.fill("Apple");
  await input.press("Enter");
  await expect(page.getByText("1/30").first()).toBeVisible();
  await page.getByRole("button", { name: /Give up/ }).click();
  await expect(page.getByRole("status")).toContainText("1/30");
  // end screen groups by sector and marks misses
  await expect(page.getByText("✗ Microsoft")).toBeVisible();
});

test("cap battle: one call reveals the challenger's cap and updates the run", async ({ page }) => {
  await page.goto("/?mode=cap-battle");
  await dismissHowTo(page);
  await expect(page.getByText("???")).toBeVisible();
  await page.getByRole("button", { name: /Higher/ }).click();
  await expect(page.getByText("???")).not.toBeVisible();
  // either the streak advanced or the run ended — both are valid outcomes
  await expect(page.getByText(/streak|Run over/).first()).toBeVisible();
});

test("keyboard-only daily ticker: type, arrow, enter", async ({ page }) => {
  test.skip(!answer, "no scheduled answer for today");
  await page.goto("/");
  // dismiss how-to with Escape (keyboard-only path)
  await page.keyboard.press("Escape");
  const input = page.getByRole("combobox");
  await input.focus();
  await page.keyboard.type("Microsoft");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/1\/6|the answer was/).first()).toBeVisible();
});

test("pin the HQ: click map, confirm, get distance feedback", async ({ page }) => {
  await page.goto("/?mode=country");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Pin the HQ" }).click();
  const map = page.getByRole("application");
  await expect(map).toBeVisible();
  await map.click({ position: { x: 200, y: 100 } });
  await page.getByRole("button", { name: "Confirm pin" }).click();
  await expect(page.getByRole("status")).toContainText("km");
});

test("chart detective: hints deduct, give up reveals the card", async ({ page }) => {
  await page.goto("/?mode=chart");
  await page.keyboard.press("Escape");
  await expect(page.getByText(/worth 1000/)).toBeVisible();
  await page.getByRole("button", { name: /Sector \(/ }).click();
  await expect(page.getByText(/worth 900/)).toBeVisible();
  await page.getByRole("button", { name: /Give up/ }).click();
  await expect(page.getByRole("status")).toContainText("It was");
});
