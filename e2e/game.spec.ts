import { expect, test, type Page } from "@playwright/test";

const MODES = [
  { id: "fr-nuclear-plants", title: "Centrales nucléaires", sites: 18 },
  { id: "fr-nuclear-research", title: "Recherche et réacteurs", sites: 10 },
  { id: "fr-military-nuclear", title: "Sites militaires", sites: 18 },
] as const;
const PLANTS = MODES[0];
const RESEARCH = MODES[1];
const WORLD = { id: "world-nuclear-plants", title: "Centrales du monde", sites: 173, rounds: 10 } as const;

/** French number formatting groups thousands with a narrow no-break space. */
const points = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

async function dropPinAtMapCentre(page: Page) {
  const map = page.getByRole("application");
  // MapLibre only handles clicks once its style has loaded.
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 });
  const box = await map.boundingBox();
  if (!box) throw new Error("map not rendered");
  // Slightly below centre keeps clear of the top HUD on every viewport.
  await map.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await expect(page.getByTestId("marker-guess")).toBeVisible();
}

async function playRound(page: Page, isLast: boolean) {
  await dropPinAtMapCentre(page);
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByTestId("round-result")).toBeVisible();
  await page.getByRole("button", { name: isLast ? "Voir les résultats" : "Manche suivante" }).click();
}

async function playFullGame(page: Page, rounds: number) {
  for (let round = 1; round <= rounds; round++) {
    await expect(page.getByText(`${round}/${rounds}`)).toBeVisible();
    await playRound(page, round === rounds);
  }
  const summary = page.getByTestId("game-summary");
  await expect(summary).toBeVisible();
  return summary;
}

test("home lists the French modes and the world mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Placez les centrales nucléaires");
  for (const mode of [...MODES, WORLD]) {
    await expect(page.getByRole("link", { name: new RegExp(`${mode.title}.*${mode.sites} sites`) })).toHaveAttribute(
      "href",
      `/play/${mode.id}`,
    );
  }
});

test("/play defaults to the power plants", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(`/play/${PLANTS.id}`);
});

for (const mode of MODES) {
  test(`${mode.title}: a round reveals the site's role, without hints`, async ({ page }) => {
    await page.goto(`/play/${mode.id}`);
    await expect(page.getByText(`1/${mode.sites}`)).toBeVisible();
    await expect(page.getByRole("application")).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 });
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    const banner = page.getByRole("heading", { level: 1 }).locator("..");
    await expect(banner.locator("p")).toHaveCount(1); // just the "Trouvez" eyebrow, no hint line
    const confirm = page.getByRole("button", { name: "Valider" });
    await expect(confirm).toBeDisabled();

    await dropPinAtMapCentre(page);
    await confirm.click();
    await expect(page.getByTestId("round-result")).toContainText("·");
    await expect(page.getByTestId("round-score")).toHaveText(/^\+[\d\u202f]+$/);
  });
}

test("world mode: 10 stations on the world map, the country as a hint, a photo or its placeholder", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/play/${WORLD.id}`);
  await expect(page.getByRole("application", { name: "Carte : monde" })).toBeVisible();
  await expect(page.getByText(`1/${WORLD.rounds}`)).toBeVisible();
  const banner = page.getByRole("heading", { level: 1 }).locator("..");
  await expect(banner.locator("p")).toHaveCount(2); // "Trouvez", then the country
  await expect(page.getByTestId("site-photo").or(page.getByTestId("site-photo-missing"))).toBeVisible();

  await dropPinAtMapCentre(page);
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByTestId("round-result")).toContainText(/réacteurs? · .* MW · depuis \d{4}/);
  await page.getByRole("button", { name: "Manche suivante" }).click();

  for (let round = 2; round <= WORLD.rounds; round++) {
    await expect(page.getByText(`${round}/${WORLD.rounds}`)).toBeVisible();
    await playRound(page, round === WORLD.rounds);
  }
  await expect(page.getByTestId("game-summary").getByRole("listitem")).toHaveCount(WORLD.rounds);
});

test("the stopwatch runs while guessing, pauses on the answer, and the summary shows the total", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/play/${RESEARCH.id}`);
  const stopwatch = page.getByTestId("stopwatch");
  await expect(stopwatch).toHaveText(/^0:0\d$/);
  // The clock waits for the map, then ticks within a couple of seconds (polling, no fixed wait).
  await expect(page.getByRole("application")).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 });
  await expect(stopwatch).not.toHaveText("0:00", { timeout: 5_000 });

  await dropPinAtMapCentre(page);
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByTestId("round-result")).toBeVisible();
  const frozen = await stopwatch.textContent();
  await page.waitForTimeout(1_500); // the one fixed wait: proving that nothing happens
  await expect(stopwatch).toHaveText(frozen ?? "");
  await page.getByRole("button", { name: "Manche suivante" }).click();

  for (let round = 2; round <= RESEARCH.sites; round++) await playRound(page, round === RESEARCH.sites);
  await expect(page.getByTestId("game-time")).toHaveText(/^\d+\u00a0(min|s)/);
});

test("revealed answers stay on the map in later rounds", async ({ page }) => {
  await page.goto(`/play/${PLANTS.id}`);
  await playRound(page, false);
  await expect(page.getByText(`2/${PLANTS.sites}`)).toBeVisible();
  await expect(page.getByTestId("marker-past")).toHaveCount(1);
  await playRound(page, false);
  await expect(page.getByTestId("marker-past")).toHaveCount(2);
});

test("the map is keyboard playable", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is desktop-only");
  await page.goto(`/play/${PLANTS.id}`);
  const map = page.getByRole("application");
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 });
  await map.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("marker-guess")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("round-result")).toBeVisible();
  // Focus moves to "Manche suivante", so Enter advances.
  await page.keyboard.press("Enter");
  await expect(page.getByText(`2/${PLANTS.sites}`)).toBeVisible();
});

test("a full game saves the local best, shown on the home page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/play/${PLANTS.id}`);
  const summary = await playFullGame(page, PLANTS.sites);
  await expect(summary.getByRole("listitem")).toHaveCount(PLANTS.sites);
  await expect(summary).toContainText(points(90_000));
  await expect(summary).toContainText("Premier score enregistré");
  const total = (await summary.getByRole("heading").textContent())?.split("/")[0].trim() ?? "";

  await summary.getByRole("link", { name: "Accueil" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId(`best-${PLANTS.id}`)).toHaveText(total);
});

test("play again restarts the game", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/play/${RESEARCH.id}`);
  await playFullGame(page, RESEARCH.sites);
  await page.getByRole("button", { name: "Rejouer" }).click();
  await expect(page.getByText(`1/${RESEARCH.sites}`)).toBeVisible();
  await expect(page.getByTestId("total-score")).toHaveText("0");
});

test("unknown modes render the not-found page", async ({ page }) => {
  await page.goto("/play/countries");
  await expect(page.getByText("Page introuvable")).toBeVisible();
});

test("each plant shows its photo, which opens with its credits", async ({ page }) => {
  await page.goto(`/play/${PLANTS.id}`);
  const thumbnail = page.getByTestId("site-photo");
  await expect(thumbnail).toBeVisible();
  await expect(thumbnail.locator("img")).toHaveJSProperty("complete", true);

  await thumbnail.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Wikimedia Commons");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // The photo stays while the answer is revealed.
  await dropPinAtMapCentre(page);
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByTestId("site-photo")).toBeVisible();
});

test("the credits page lists every site, with a placeholder where no free photo exists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Crédits photos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Crédits photos" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(MODES.reduce<number>((sum, mode) => sum + mode.sites, WORLD.sites));
  await expect(page.getByText("Aucune photo libre de droits de ce site.")).toHaveCount(18);
});

test("the map credits OpenFreeMap and OpenStreetMap", async ({ page }) => {
  await page.goto(`/play/${PLANTS.id}`);
  await expect(page.getByRole("application")).toHaveAttribute("data-map-ready", "true", { timeout: 20_000 });
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenStreetMap");
  await expect(page.locator(".maplibregl-ctrl-attrib")).toContainText("OpenFreeMap");
});
