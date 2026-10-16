import { expect, test, type Browser, type Page } from "@playwright/test";

// Duels live in the database: these tests need a Supabase project with the duels migration.
const MODE_TITLE = "Sites de recherche";
const ROUND_TIMEOUT_MS = 20_000;

async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

/** Unique per run: pseudos are unique across players. */
function pseudo(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

async function dropPinAndLock(page: Page) {
  const map = page.getByRole("application");
  await expect(map).toHaveAttribute("data-interactive", "true", { timeout: ROUND_TIMEOUT_MS });
  const box = await map.boundingBox();
  if (!box) throw new Error("map not rendered");
  await map.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await page.getByRole("button", { name: "Valider" }).click();
}

async function openDuel(browser: Browser): Promise<{ host: Page; guest: Page }> {
  const host = await newPlayer(browser);
  await host.goto("/duel");
  await host.getByRole("radio", { name: new RegExp(MODE_TITLE) }).check({ force: true });
  await host.getByLabel("Votre pseudo").fill(pseudo("Hote"));
  await host.getByRole("button", { name: "Créer le duel" }).click();
  await expect(host.getByTestId("duel-waiting")).toBeVisible();
  const code = (await host.getByTestId("duel-code").textContent())?.trim();
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);

  const guest = await newPlayer(browser);
  await guest.goto(`/duel/${code!.toLowerCase()}`);
  await expect(guest).toHaveURL(`/duel/${code}`);
  await expect(guest.getByTestId("duel-join")).toContainText("vous défie");
  await guest.getByLabel("Votre pseudo").fill(pseudo("Invite"));
  await guest.getByRole("button", { name: "Accepter le duel" }).click();
  return { host, guest };
}

test.describe("duel", () => {
  test.skip(({ isMobile }) => isMobile, "two players on desktop are enough");

  test("both players get the same site, and the round reveals both answers once both lock", async ({ browser }) => {
    const { host, guest } = await openDuel(browser);
    for (const page of [host, guest]) await expect(page.getByTestId("duel-countdown")).toBeVisible();

    const hostTarget = host.getByRole("heading", { level: 1 });
    await expect(hostTarget).toBeVisible({ timeout: ROUND_TIMEOUT_MS });
    await expect(guest.getByRole("heading", { level: 1 })).toHaveText((await hostTarget.textContent()) ?? "");

    await dropPinAndLock(host);
    await expect(host.getByTestId("duel-locked")).toBeVisible();
    // The guest is told, and now races the grace period.
    await expect(guest.getByTestId("duel-hurry")).toBeVisible();

    await dropPinAndLock(guest);
    for (const page of [host, guest]) {
      const reveal = page.getByTestId("duel-reveal");
      await expect(reveal).toBeVisible();
      await expect(reveal.getByRole("listitem")).toHaveCount(2);
      await expect(page.getByTestId("marker-opponent")).toBeVisible();
    }
  });

  test("a player who does not lock in time scores nothing for the round", async ({ browser }) => {
    const { host, guest } = await openDuel(browser);
    await dropPinAndLock(host);
    await expect(guest.getByTestId("duel-hurry")).toBeVisible();

    const reveal = guest.getByTestId("duel-reveal");
    await expect(reveal).toBeVisible({ timeout: ROUND_TIMEOUT_MS });
    await expect(reveal).toContainText("temps écoulé");
    await expect(reveal).toContainText("+0");
  });

  test("a third player cannot take a seat", async ({ browser }) => {
    const { host } = await openDuel(browser);
    const code = host.url().split("/").at(-1);
    const third = await newPlayer(browser);
    await third.goto(`/duel/${code}`);
    await expect(third.getByText("Ce duel a déjà ses deux joueurs.")).toBeVisible();
  });

  test("a mistyped code is caught before leaving the lobby", async ({ page }) => {
    await page.goto("/duel");
    await page.getByLabel("Code du duel").fill("ABC");
    await page.getByRole("button", { name: "Rejoindre" }).click();
    await expect(page.getByText("Un code de duel compte 6 lettres et chiffres.")).toBeVisible();
  });
});
