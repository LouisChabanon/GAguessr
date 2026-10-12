import { expect, test, type Page } from "@playwright/test";

const MODES = [
  { id: "countries", title: "Countries" },
  { id: "cities", title: "Cities" },
  { id: "fr-nuclear-plants", title: "French nuclear plants" },
] as const;

async function dropPinAtMapCentre(page: Page) {
  const map = page.getByRole("application");
  const box = await map.boundingBox();
  if (!box) throw new Error("map not rendered");
  // Slightly below centre keeps clear of the top HUD on every viewport.
  await map.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await expect(page.getByTestId("marker-guess")).toBeVisible();
}

async function playRound(page: Page, isLast: boolean) {
  await dropPinAtMapCentre(page);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("round-result")).toBeVisible();
  await page.getByRole("button", { name: isLast ? "See results" : "Next round" }).click();
}

test("home lists every game mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Put the world");
  for (const mode of MODES) {
    await expect(page.getByRole("link", { name: new RegExp(mode.title) })).toHaveAttribute(
      "href",
      `/play/${mode.id}`,
    );
  }
});

for (const mode of MODES) {
  test(`${mode.title}: a round can be played`, async ({ page }) => {
    await page.goto(`/play/${mode.id}`);
    await expect(page.getByText("Find", { exact: true })).toBeVisible();
    const confirm = page.getByRole("button", { name: "Confirm" });
    await expect(confirm).toBeDisabled();

    await dropPinAtMapCentre(page);
    await confirm.click();

    await expect(page.getByTestId("round-result")).toBeVisible();
    await expect(page.getByTestId("round-score")).toHaveText(/^\+[\d,]+$/);
  });
}

test("a full game ends with a summary and saves the best score", async ({ page }) => {
  await page.goto("/play/cities");
  for (let round = 1; round <= 10; round++) {
    await expect(page.getByText(`${round}/10`)).toBeVisible();
    await playRound(page, round === 10);
  }

  const summary = page.getByTestId("game-summary");
  await expect(summary).toBeVisible();
  await expect(summary.getByRole("listitem")).toHaveCount(10);
  await expect(summary).toContainText("First score recorded");
  const total = (await summary.getByRole("heading").textContent())?.split("/")[0].trim();

  await summary.getByRole("link", { name: "All modes" }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  await expect(page.getByTestId("best-cities")).toHaveText(total ?? "");
});

test("the nuclear plants game covers all 18 plants, and play again restarts it", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/play/fr-nuclear-plants");
  for (let round = 1; round <= 18; round++) {
    await expect(page.getByText(`${round}/18`)).toBeVisible();
    await playRound(page, round === 18);
  }
  const summary = page.getByTestId("game-summary");
  await expect(summary.getByRole("listitem")).toHaveCount(18);
  await expect(summary).toContainText("90,000");
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByText("1/18")).toBeVisible();
  await expect(page.getByTestId("total-score")).toHaveText("0");
});

test("the map is keyboard playable", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is desktop-only");
  await page.goto("/play/countries");
  const map = page.getByRole("application");
  await map.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("marker-guess")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("round-result")).toBeVisible();
  // Focus moves to "Next round", so Enter advances.
  await page.keyboard.press("Enter");
  await expect(page.getByText("2/10")).toBeVisible();
});

// The play route streams behind Suspense, so the status is already 200 when
// notFound() fires (documented Next.js behaviour); the not-found UI still renders.
test("unknown modes render the not-found page", async ({ page }) => {
  await page.goto("/play/not-a-mode");
  await expect(page.getByText(/could not be found/i)).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
});

test("revealed answers stay on the map in later rounds", async ({ page }) => {
  await page.goto("/play/cities");
  await playRound(page, false);
  await expect(page.getByText("2/10")).toBeVisible();
  await expect(page.getByTestId("marker-past")).toHaveCount(1);
  await playRound(page, false);
  await expect(page.getByTestId("marker-past")).toHaveCount(2);
});

test("the French plants map draws rivers, regions and cities on canvas, without hints", async ({ page }) => {
  await page.goto("/play/fr-nuclear-plants");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-layers", "5");
  const banner = page.getByRole("heading", { level: 1 }).locator("..");
  await expect(banner.locator("p")).toHaveCount(1); // just the "Find" eyebrow, no hint line

  await dropPinAtMapCentre(page);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("round-result")).toContainText(/reactors/);
});
