import { expect, test } from "@playwright/test";
import { createLobby, currentSite, dropPinAndLock, joinLobby, newPlayer, openDuel, pseudo, MODE_TITLE, ROUND_TIMEOUT_MS, SYNC_TIMEOUT_MS } from "./support/duel";

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
    // Rounds are 15 s here: a slow map may already show round 2, so only the round count is checked.
    await expect(guest.getByText(/^\d\/5$/)).toBeVisible({ timeout: ROUND_TIMEOUT_MS });
  });

  test("a mistyped code is caught before leaving the lobby", async ({ page }) => {
    await page.goto("/duel");
    await page.getByLabel("Code du duel").fill("ABC");
    await page.getByRole("button", { name: "Rejoindre" }).click();
    await expect(page.getByText("Un code de duel compte 6 lettres et chiffres.")).toBeVisible();
  });
});
