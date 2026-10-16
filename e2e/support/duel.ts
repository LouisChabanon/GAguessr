import { expect, type Browser, type Page } from "@playwright/test";

// Duels live in the database: these tests need a Supabase project with the duels migration.
export const MODE_TITLE = "Sites de recherche";
export const ROUND_TIMEOUT_MS = 20_000;
/** What one player does reaches the others through Realtime, or the 5 s poll at worst. */
export const SYNC_TIMEOUT_MS = 10_000;

export async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

/** Unique per run: pseudos are unique across players. */
export function pseudo(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

/** Clicks the map once it takes pins; `x` is where across the map, 0–1. */
export async function dropPin(page: Page, timeout = ROUND_TIMEOUT_MS, x = 0.5) {
  const map = page.getByRole("application");
  // MapLibre only handles clicks once its style has loaded.
  await expect(map).toHaveAttribute("data-map-ready", "true", { timeout });
  await expect(map).toHaveAttribute("data-interactive", "true", { timeout });
  const box = await map.boundingBox();
  if (!box) throw new Error("map not rendered");
  await map.click({ position: { x: box.width * x, y: box.height * 0.55 } });
}

export async function dropPinAndLock(page: Page, timeout = ROUND_TIMEOUT_MS) {
  await dropPin(page, timeout);
  await page.getByRole("button", { name: "Valider" }).click();
}

/** Opens a lobby, picking the room size (and round time) in the settings. Returns the host's page and the code. */
export async function createLobby(browser: Browser, maxPlayers = 2, timings?: { round: number; grace: number }): Promise<{ host: Page; code: string }> {
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

export async function joinLobby(browser: Browser, code: string, path = `/duel/${code}`): Promise<Page> {
  const guest = await newPlayer(browser);
  await guest.goto(path);
  await expect(guest.getByTestId("duel-join")).toContainText("vous défie");
  await guest.getByLabel("Votre pseudo").fill(pseudo("Invite"));
  await guest.getByRole("button", { name: "Accepter le duel" }).click();
  return guest;
}

/** The current round's site, once the round has started on `page`. */
export async function currentSite(page: Page, timeout = ROUND_TIMEOUT_MS): Promise<string> {
  await expect(page.getByTestId("duel-scoreboard")).toBeVisible({ timeout });
  return (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
}

export async function openDuel(browser: Browser): Promise<{ host: Page; guest: Page }> {
  const { host, code } = await createLobby(browser);
  const guest = await joinLobby(browser, code, `/duel/${code.toLowerCase()}`);
  await expect(guest).toHaveURL(`/duel/${code}`);
  return { host, guest };
}
