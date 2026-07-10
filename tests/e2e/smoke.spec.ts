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
