import { expect, test, type Page } from "@playwright/test";
import { createLobby, currentSite, dropPin, dropPinAndLock, joinLobby, SYNC_TIMEOUT_MS } from "./support/duel";

// Duels live in the database: these tests need a Supabase project with the duel migrations.
// Bad connections are simulated on one player's duel requests only, so maps still load quickly.

const DUEL_API = "**/api/duel/**";

/** Holds every duel request of `page` for `delayMs`, or only those `match` picks. */
async function delayDuelRequests(page: Page, delayMs: number, match: (url: string) => boolean = () => true) {
  await page.route(DUEL_API, async (route) => {
    if (match(route.request().url())) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

/** Two players in a started round, with a short grace so late locks are easy to provoke. */
async function startedDuel(browser: Parameters<typeof createLobby>[0]) {
  const { host, code } = await createLobby(browser, 2, { round: 45, grace: 3 });
  const guest = await joinLobby(browser, code);
  for (const page of [host, guest]) await currentSite(page);
  return { host, guest };
}

test.describe("duel on a bad connection", () => {
  test.skip(({ isMobile }) => isMobile, "the network, not the screen, is under test");
  test.describe.configure({ mode: "default", timeout: 90_000 });

  test("a lock over a slow link counts, and shows as sent at once", async ({ browser }) => {
    const { host, guest } = await startedDuel(browser);
    // Every duel request of the guest, polls included, takes 2.5 s.
    await delayDuelRequests(guest, 2_500);

    await dropPinAndLock(guest);
    await expect(guest.getByTestId("duel-locked")).toContainText("Envoi de votre épingle");
    await expect(guest.getByTestId("duel-locked")).toContainText("Épingle validée", { timeout: SYNC_TIMEOUT_MS });
    await expect(host.getByTestId("duel-hurry")).toBeVisible({ timeout: SYNC_TIMEOUT_MS });

    await dropPinAndLock(host);
    const reveal = guest.getByTestId("duel-reveal");
    await expect(reveal).toBeVisible({ timeout: 2 * SYNC_TIMEOUT_MS });
    await expect(reveal).not.toContainText("non validée");
  });

  test("a lock that arrives too late still scores the last pin, and says so", async ({ browser }) => {
    const { host, guest } = await startedDuel(browser);
    // The guest's pins go through; their lock is held past the 3 s grace and the server's slack.
    await delayDuelRequests(guest, 7_000, (url) => url.endsWith("/lock"));

    await dropPinAndLock(host);
    await expect(guest.getByTestId("duel-hurry")).toBeVisible({ timeout: SYNC_TIMEOUT_MS });
    await dropPin(guest, undefined, 0.4);
    // Long enough for the pin to be saved.
    await guest.waitForTimeout(1_000);
    await guest.getByRole("button", { name: "Valider" }).click();
    await expect(guest.getByTestId("duel-locked")).toContainText("Envoi de votre épingle");

    const reveal = guest.getByTestId("duel-reveal");
    await expect(reveal).toBeVisible({ timeout: 2 * SYNC_TIMEOUT_MS });
    await expect(guest.getByTestId("duel-late-lock")).toBeVisible({ timeout: SYNC_TIMEOUT_MS });
    await expect(reveal).toContainText("non validée");
    await expect(reveal).not.toContainText("temps écoulé");
  });

  test("when nothing gets through in time, the player is told why they scored nothing", async ({ browser }) => {
    const { host, guest } = await startedDuel(browser);
    await delayDuelRequests(guest, 7_000, (url) => url.endsWith("/lock") || url.endsWith("/pin"));

    await dropPinAndLock(host);
    await expect(guest.getByTestId("duel-hurry")).toBeVisible({ timeout: SYNC_TIMEOUT_MS });
    await dropPinAndLock(guest);

    const reveal = guest.getByTestId("duel-reveal");
    await expect(reveal).toBeVisible({ timeout: 2 * SYNC_TIMEOUT_MS });
    await expect(guest.getByTestId("duel-late-lock")).toContainText("ni aucune épingle");
    await expect(reveal).toContainText("temps écoulé");
  });

  test("the player is told when the connection drops, and the duel picks up again", async ({ browser }) => {
    const { guest } = await startedDuel(browser);
    await guest.context().setOffline(true);
    await expect(guest.getByTestId("duel-connection")).toBeVisible();
    await guest.context().setOffline(false);
    await expect(guest.getByTestId("duel-connection")).toBeHidden({ timeout: SYNC_TIMEOUT_MS });
    await expect(guest.getByTestId("duel-scoreboard")).toBeVisible();
  });
});
