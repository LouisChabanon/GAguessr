import { expect, test, type Browser, type Page } from "@playwright/test";

// Duels live in the database: these tests need a Supabase project with the duels migration.
const MODE_TITLE = "Sites de recherche";
const ROUND_TIMEOUT_MS = 20_000;
/** What one player does reaches the others through Realtime, or the 5 s poll at worst. */
const SYNC_TIMEOUT_MS = 10_000;

async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

/** Unique per run: pseudos are unique across players. */
function pseudo(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

async function dropPinAndLock(page: Page, timeout = ROUND_TIMEOUT_MS) {
  const map = page.getByRole("application");
  // MapLibre only handles clicks once its style has loaded.
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout });
  await expect(map).toHaveAttribute("data-interactive", "true", { timeout });
  const box = await map.boundingBox();
  if (!box) throw new Error("map not rendered");
  await map.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await page.getByRole("button", { name: "Valider" }).click();
}

/** Opens a lobby, picking the room size (and round time) in the settings. Returns the host's page and the code. */
async function createLobby(browser: Browser, maxPlayers = 2, timings?: { round: number; grace: number }): Promise<{ host: Page; code: string }> {
  const host = await newPlayer(browser);
  await host.goto("/duel");
  await host.getByRole("radio", { name: new RegExp(MODE_TITLE) }).check({ force: true });
  if (maxPlayers !== 2) await host.getByRole("group", { name: "Joueurs" }).getByText(String(maxPlayers), { exact: true }).click();
  if (timings) {
    await host.getByRole("group", { name: "Temps par manche" }).getByText(`${timings.round} s`, { exact: true }).click();
    await host.getByRole("group", { name: "Après la première validation" }).getByText(`${timings.grace} s`, { exact: true }).click();
  }
  await host.getByLabel("Votre pseudo").fill(pseudo("Hote"));
  await host.getByRole("button", { name: "Créer le duel" }).click();
  await expect(host.getByTestId("duel-waiting")).toBeVisible();
  const code = (await host.getByTestId("duel-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  return { host, code };
}

async function joinLobby(browser: Browser, code: string, path = `/duel/${code}`): Promise<Page> {
  const guest = await newPlayer(browser);
  await guest.goto(path);
  await expect(guest.getByTestId("duel-join")).toContainText("vous défie");
  await guest.getByLabel("Votre pseudo").fill(pseudo("Invite"));
  await guest.getByRole("button", { name: "Accepter le duel" }).click();
  return guest;
}

/** The current round's site, once the round has started on `page`. */
async function currentSite(page: Page, timeout = ROUND_TIMEOUT_MS): Promise<string> {
  await expect(page.getByTestId("duel-scoreboard")).toBeVisible({ timeout });
  return (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
}

async function openDuel(browser: Browser): Promise<{ host: Page; guest: Page }> {
  const { host, code } = await createLobby(browser);
  const guest = await joinLobby(browser, code, `/duel/${code.toLowerCase()}`);
  await expect(guest).toHaveURL(`/duel/${code}`);
  return { host, guest };
}

test.describe("duel", () => {
  test.skip(({ isMobile }) => isMobile, "several players on desktop are enough");
  // Each test drives several browsers with a WebGL map: run them one after another, not side by side.
  test.describe.configure({ mode: "default", timeout: 90_000 });

  test("both players get the same site, and the round reveals both answers once both lock", async ({ browser }) => {
    const { host, guest } = await openDuel(browser);
    const site = await currentSite(host);
    expect(await currentSite(guest)).toBe(site);

    await dropPinAndLock(host);
    await expect(host.getByTestId("duel-locked")).toBeVisible();
    // The guest is told, and now races the grace period.
    await expect(guest.getByTestId("duel-hurry")).toBeVisible({ timeout: SYNC_TIMEOUT_MS });

    await dropPinAndLock(guest);
    for (const page of [host, guest]) {
      const reveal = page.getByTestId("duel-reveal");
      await expect(reveal).toBeVisible({ timeout: SYNC_TIMEOUT_MS });
      await expect(reveal.getByRole("listitem")).toHaveCount(2);
      await expect(page.getByTestId("marker-opponent")).toBeVisible();
    }
  });

  test("a player who does not lock in time scores nothing for the round", async ({ browser }) => {
    const { host, guest } = await openDuel(browser);
    await dropPinAndLock(host);
    await expect(guest.getByTestId("duel-hurry")).toBeVisible({ timeout: SYNC_TIMEOUT_MS });

    const reveal = guest.getByTestId("duel-reveal");
    await expect(reveal).toBeVisible({ timeout: ROUND_TIMEOUT_MS });
    await expect(reveal).toContainText("temps écoulé");
    await expect(reveal).toContainText("+0");
  });

  test("nobody can join once the game has started", async ({ browser }) => {
    const { host } = await openDuel(browser);
    const code = host.url().split("/").at(-1);
    const late = await newPlayer(browser);
    await late.goto(`/duel/${code}`);
    await expect(late.getByText("La partie a déjà commencé.")).toBeVisible();
  });

  test("a room of three starts once full, and everyone gets the same site and sees every answer", async ({ browser }) => {
    // Three WebGL maps at once load slowly on CI machines: long rounds and grace, so time never runs out mid-test.
    test.slow();
    const slow = 3 * ROUND_TIMEOUT_MS;
    const { host, code } = await createLobby(browser, 3, { round: 120, grace: 15 });
    const second = await joinLobby(browser, code);
    await expect(host.getByTestId("duel-seats")).toHaveText("2/3", { timeout: SYNC_TIMEOUT_MS });
    await expect(second.getByTestId("duel-waiting")).toContainText("Vous êtes dans la salle");
    const third = await joinLobby(browser, code);

    const players = [host, second, third];
    const site = await currentSite(host, slow);
    for (const page of players) expect(await currentSite(page, slow)).toBe(site);
    await expect(host.getByTestId("duel-scoreboard").getByRole("listitem")).toHaveCount(3);

    await dropPinAndLock(host, slow);
    await expect(third.getByTestId("duel-hurry")).toContainText("a validé", { timeout: slow });
    await dropPinAndLock(second, slow);
    await expect(third.getByTestId("duel-hurry")).toContainText("2 joueurs ont validé", { timeout: slow });
    await dropPinAndLock(third, slow);
    for (const page of players) {
      await expect(page.getByTestId("duel-reveal").getByRole("listitem")).toHaveCount(3, { timeout: slow });
      await expect(page.getByTestId("marker-opponent")).toHaveCount(2);
    }
  });

  test("the host can start early, after a player left", async ({ browser }) => {
    const { host, code } = await createLobby(browser, 4);
    const leaving = await joinLobby(browser, code);
    await leaving.getByRole("button", { name: "Quitter la salle" }).click();
    await expect(leaving).toHaveURL("/duel");
    await expect(host.getByTestId("duel-seats")).toHaveText("1/4", { timeout: SYNC_TIMEOUT_MS });
    await expect(host.getByRole("button", { name: "En attente de joueurs…" })).toBeDisabled();

    const staying = await joinLobby(browser, code);
    await host.getByRole("button", { name: "Lancer à 2" }).click();
    for (const page of [host, staying]) await expect(page.getByText("1/10")).toBeVisible({ timeout: ROUND_TIMEOUT_MS });
  });

  test("the host's settings reach the guest, and stay editable until they join", async ({ browser }) => {
    const host = await newPlayer(browser);
    await host.goto("/duel");
    await host.getByRole("radio", { name: new RegExp(MODE_TITLE) }).check({ force: true });
    const create = host.getByRole("form", { name: "Lancer un duel" });
    await create.getByRole("group", { name: "Manches" }).getByText("3", { exact: true }).click();
    await create.getByRole("group", { name: "Temps par manche" }).getByText("15 s").click();
    await create.getByRole("group", { name: "Après la première validation" }).getByText("3 s").click();
    await host.getByLabel("Votre pseudo").fill(pseudo("Hote"));
    await host.getByRole("button", { name: "Créer le duel" }).click();
    await expect(host.getByTestId("duel-rules")).toContainText(/Manches\s*3[\s\S]*Par manche\s*15\s*s[\s\S]*Ensuite\s*3\s*s/);
    const code = (await host.getByTestId("duel-code").textContent())?.trim();

    await host.getByRole("button", { name: "Modifier" }).click();
    await host.getByRole("group", { name: "Manches" }).getByText("5", { exact: true }).click();
    await expect(host.getByRole("group", { name: "Manches" }).getByRole("radio", { name: "5" })).toBeChecked();

    const guest = await newPlayer(browser);
    await guest.goto(`/duel/${code}`);
    await expect(guest.getByTestId("duel-rules")).toContainText(/Manches\s*5[\s\S]*Par manche\s*15\s*s/);
    await guest.getByLabel("Votre pseudo").fill(pseudo("Invite"));
    await guest.getByRole("button", { name: "Accepter le duel" }).click();
    await expect(guest.getByText("1/5")).toBeVisible({ timeout: ROUND_TIMEOUT_MS });
  });

  test("a mistyped code is caught before leaving the lobby", async ({ page }) => {
    await page.goto("/duel");
    await page.getByLabel("Code du duel").fill("ABC");
    await page.getByRole("button", { name: "Rejoindre" }).click();
    await expect(page.getByText("Un code de duel compte 6 lettres et chiffres.")).toBeVisible();
  });
});
