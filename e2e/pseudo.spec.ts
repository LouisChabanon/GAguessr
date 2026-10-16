import { expect, test, type Browser, type Page } from "@playwright/test";

// Pseudos live in the database: these tests need a Supabase project.

function pseudo(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

/** A visitor who chose `name`, the way a duel host does: typing it before creating the duel. */
async function namedPlayer(browser: Browser, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/duel");
  await page.getByLabel("Votre pseudo").fill(name);
  await page.getByRole("button", { name: "Créer le duel" }).click();
  await expect(page.getByTestId("duel-waiting")).toBeVisible();
  return page;
}

async function rename(page: Page, to: string, submit: "button" | "enter" = "button") {
  await page.getByTestId("pseudo-current").getByRole("button", { name: "Modifier" }).click();
  const form = page.getByTestId("pseudo-rename");
  const input = form.getByLabel("Nouveau pseudo");
  await input.fill(to);
  if (submit === "enter") await input.press("Enter");
  else await form.getByRole("button", { name: "Enregistrer" }).click();
}

test.describe("pseudo", () => {
  test.skip(({ isMobile }) => isMobile, "the form is the same on mobile");

  test("can be changed from the home page, and the change sticks", async ({ browser }) => {
    const page = await namedPlayer(browser, pseudo("Avant"));
    await page.goto("/");
    const current = page.getByTestId("pseudo-current");
    await expect(current).toContainText("Avant");

    const after = pseudo("Apres");
    await rename(page, after);
    await expect(current).toContainText(after);
    await page.reload();
    await expect(page.getByTestId("pseudo-current")).toContainText(after);
  });

  test("can be changed before creating a duel, without creating it", async ({ browser }) => {
    const page = await namedPlayer(browser, pseudo("Hote"));
    await page.goto("/duel");
    const after = pseudo("Renomme");
    // The editor sits inside the duel form: Enter must save the pseudo, not create the duel.
    await rename(page, after, "enter");
    await expect(page.getByTestId("pseudo-current")).toContainText(after);
    await expect(page).toHaveURL("/duel");
    await page.getByRole("button", { name: "Créer le duel" }).click();
    await expect(page.getByTestId("duel-players")).toContainText("Vous");
    await page.goto("/");
    await expect(page.getByTestId("pseudo-current")).toContainText(after);
  });

  test("cannot take someone else's, and cancelling keeps the old one", async ({ browser }) => {
    const taken = pseudo("Pris");
    await namedPlayer(browser, taken);
    const mine = pseudo("Moi");
    const page = await namedPlayer(browser, mine);
    await page.goto("/");

    await rename(page, taken.toUpperCase());
    await expect(page.getByRole("alert").filter({ hasText: "déjà pris" })).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByTestId("pseudo-current")).toContainText(mine);
  });
});
