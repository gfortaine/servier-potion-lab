import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const recipes = [
  {
    id: "invisibilite",
    name: "Potion d'invisibilité",
    ingredientIds: ["noix-de-coco", "yttrium", "mandragore"]
  },
  {
    id: "amour",
    name: "Potion d'amour",
    ingredientIds: ["bave-de-lama", "plume-de-griffon", "helium-liquide"]
  },
  {
    id: "jeunesse",
    name: "Potion de jeunesse",
    ingredientIds: ["or", "crin-de-licorne", "azote-liquide"]
  },
  {
    id: "immortalite",
    name: "Potion d'immortalité",
    ingredientIds: ["poil-de-yeti", "jus-de-horglup", "argent"]
  },
  {
    id: "clairvoyance",
    name: "Potion de Clairvoyance",
    ingredientIds: ["epine-de-herisson", "jus-de-horglup", "noix-de-coco"]
  },
  {
    id: "force",
    name: "Potion de Force",
    ingredientIds: ["poil-de-yeti", "or", "argent"]
  },
  {
    id: "vitesse",
    name: "Potion de Vitesse",
    ingredientIds: ["helium-liquide", "plume-de-griffon", "azote-liquide"]
  },
  {
    id: "guerison",
    name: "Potion de Guérison",
    ingredientIds: ["crin-de-licorne", "mandragore", "bave-de-lama"]
  },
  {
    id: "transformation",
    name: "Potion de Transformation",
    ingredientIds: ["queue-d-ecureuil", "yttrium", "epine-de-herisson"]
  }
] as const;

test("supports the alchemical theatre UX flow without visual collisions", async ({ page }) => {
  await page.goto("/fr");

  await expect(page.getByRole("heading", { name: "Laboratoire des potions SERVIER." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Composer une potion/ }).first()).toBeVisible();
  await page.locator(".hero-cta").click();
  await page.waitForURL("**/fr/composer-une-potion");

  await expect(page.getByTestId("atelier-stepper")).toContainText("Choisir");
  await page.goto("/fr/recettes");
  await page.getByTestId("recipe-force").getByRole("button", { name: "Préparer cette formule" }).click();
  await page.waitForURL("**/fr/composer-une-potion?recipe=force");
  await expect(page.getByTestId("target-chip-poil-de-yeti")).toBeVisible();
  await expect(page.getByTestId("target-chip-or")).toBeVisible();
  await expect(page.getByTestId("target-chip-argent")).toBeVisible();

  await selectIngredients(page, ["poil-de-yeti", "or"]);
  await expect(page.getByTestId("atelier-stepper")).toContainText("2/3 ingrédients");
  await expect(page.getByTestId("combine-button")).toBeDisabled();
  await page.getByRole("button", { name: "Or Retirer" }).click();
  await expect(page.getByTestId("atelier-stepper")).toContainText("1/3 ingrédients");
  await page.getByTestId("select-or").click();
  await page.getByTestId("select-argent").click();
  await expect(page.getByTestId("atelier-stepper")).toContainText("3/3 ingrédients");
  await expect(page.getByTestId("combine-button")).toBeEnabled();
  await expect(page.getByTestId("cauldron-panel")).toContainText("Potion de Force guide la préparation.");

  await page.getByTestId("combine-button").click();
  await page.waitForURL("**/fr/recettes?created=*&recipe=force");
  const forceRecipe = page.getByTestId("recipe-force");
  await expect(page.locator(".success-route-banner")).toContainText("Potion de Force vient d'être validée");
  await expect(forceRecipe).toContainText("Créée");
  await expect(page.getByTestId("potion-ledger")).toContainText("Potion de Force");
  await expect(page.getByTestId("cauldron-panel")).toHaveCount(0);
});

test("exposes the spec-mapped pages as focused App Router routes", async ({ page, request }) => {
  await page.goto("/fr/composer-une-potion");
  await expectServierShell(page);
  await expect(pageNav(page).getByRole("link", { name: /Composer/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Composer une potion." })).toBeVisible();
  await expect(page.getByTestId("cauldron-panel")).toBeVisible();
  await expect(page.getByTestId("inventory-panel")).toBeVisible();
  await expect(page.getByTestId("decrement-argent")).toHaveCount(0);
  await expect(page.getByTestId("recharge-argent")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nouvelle dotation" })).toHaveCount(0);
  await expect(page.getByTestId("inventory-notice")).toHaveCount(0);
  await expect(page.locator(".hero-theatre")).toHaveCount(0);
  await expect(page.getByTestId("discovery-panel")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Prochaine étape" })).toHaveCount(0);
  await expect(page.getByText("Détails techniques")).toHaveCount(0);
  await expect(page.getByTestId("select-argent")).toBeVisible();
  await expect(page.getByTestId("codex-panel")).toHaveCount(0);
  await expect(page.getByTestId("ledger-panel")).toHaveCount(0);

  const depletedResponse = await request.put("http://127.0.0.1:3001/inventory/argent", {
    data: { quantity: 0 }
  });
  expect(depletedResponse.ok(), "deplete Argent before composer stock recovery smoke").toBe(true);
  await page.reload();
  const depletedArgent = page.getByTestId("ingredient-argent");
  await expect(depletedArgent.getByTestId("select-argent")).toBeDisabled();
  await expect(depletedArgent.getByRole("link", { name: "Gérer" })).toHaveAttribute(
    "href",
    "/fr/inventaire?ingredient=argent"
  );

  await page.goto("/fr/recettes");
  await expectServierShell(page);
  await expect(pageNav(page).getByRole("link", { name: /Recettes & potions/ })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByTestId("codex-panel")).toBeVisible();
  await expect(page.getByTestId("ledger-panel")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Recettes & potions." })).toBeVisible();
  await expect(page.locator(".hero-theatre")).toHaveCount(0);
  await expect(page.getByTestId("discovery-panel")).toHaveCount(0);
  await expect(page.getByTestId("cauldron-panel")).toHaveCount(0);
  await expect(page.getByTestId("inventory-panel")).toHaveCount(0);

  const response = await request.put("http://127.0.0.1:3001/inventory/argent", {
    data: { quantity: 2 }
  });
  expect(response.ok(), "seed Argent stock before inventory control smoke").toBe(true);

  await page.goto("/fr/inventaire");
  await expectServierShell(page);
  await expect(pageNav(page).getByRole("link", { name: /Inventaire/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Inventaire des ingrédients." })).toBeVisible();
  await expect(page.getByTestId("inventory-panel")).toBeVisible();
  await expect(page.locator(".hero-theatre")).toHaveCount(0);
  await expect(page.getByTestId("discovery-panel")).toHaveCount(0);
  await expect(page.getByTestId("cauldron-panel")).toHaveCount(0);
  await expect(page.getByTestId("codex-panel")).toHaveCount(0);

  const argent = page.getByTestId("ingredient-argent");
  const beforeText = await argent.textContent();
  await expect(page.getByTestId("select-argent")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nouvelle dotation" })).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle dotation" }).click();
  await expect(page.getByTestId("inventory-notice")).toContainText("Nouvelle dotation aléatoire prête.");
  await expect(page.getByTestId("recharge-argent")).toBeVisible();
  await page.getByTestId("decrement-argent").click();
  await expect(argent).not.toHaveText(beforeText ?? "");
});

test("supports English localized SEO routes and legacy French redirects", async ({ page }) => {
  await page.goto("/en/composer");
  await expectServierShell(page);
  await expect(page.getByRole("heading", { level: 1, name: "Compose a potion." })).toBeVisible();
  await expect(page.locator(".hero-theatre")).toHaveCount(0);
  await expect(pageNav(page).getByRole("link", { name: /Composer/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("cauldron-panel")).toContainText("Three ingredients, one decision.");

  await page.goto("/recipes");
  await page.waitForURL("**/fr/recettes");
  await expect(pageNav(page).getByRole("link", { name: /Recettes & potions/ })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("supports the full localized reviewer journey across routes", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.getByRole("heading", { name: "Laboratoire des potions SERVIER." })).toBeVisible();
  await page.getByRole("link", { name: /Consulter les recettes/ }).click();
  await page.waitForURL("**/fr/recettes");

  await page.getByTestId("recipe-vitesse").getByRole("button", { name: /Préparer cette formule|Formule sélectionnée/ }).click();
  await page.waitForURL("**/fr/composer-une-potion?recipe=vitesse");
  await expect(page.getByTestId("target-chip-helium-liquide")).toBeVisible();
  await expect(page.getByTestId("target-chip-plume-de-griffon")).toBeVisible();
  await expect(page.getByTestId("target-chip-azote-liquide")).toBeVisible();

  await selectIngredients(page, ["helium-liquide", "plume-de-griffon", "azote-liquide"]);
  await page.getByTestId("combine-button").click();
  await page.waitForURL("**/fr/recettes?created=*&recipe=vitesse");
  await expect(page.locator(".success-route-banner")).toContainText("Potion de Vitesse vient d'être validée");
  await expect(page.getByTestId("recipe-vitesse")).toContainText("Créée");
  await expect(page.getByTestId("potion-ledger")).toContainText("Potion de Vitesse");

  await page.goto("/fr/inventaire?ingredient=helium-liquide");
  await expect(page.getByTestId("ingredient-helium-liquide")).toBeVisible();
  await expect(page.getByTestId("ingredient-helium-liquide")).toHaveClass(/is-focused/);
  await pageNav(page).getByRole("link", { name: /Composer/ }).click();
  await page.waitForURL("**/fr/composer-une-potion");
  await expect(page.getByTestId("cauldron-panel")).toBeVisible();
});

test("keeps the formula archive usable and clear of the cauldron at desktop and mobile widths", async ({
  page
}) => {
  await page.goto("/fr/recettes");
  await assertCodexDoesNotCollide(page);

  await page.setViewportSize({ width: 390, height: 860 });
  await page.reload();
  await assertCodexDoesNotCollide(page);
});

test("keeps the visual journey compact, readable, and screenshot-reviewable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [name, path] of [
    ["fr-dashboard", "/fr"],
    ["fr-composer", "/fr/composer-une-potion"],
    ["fr-recipes", "/fr/recettes"],
    ["fr-inventory", "/fr/inventaire"],
    ["en-composer", "/en/composer"]
  ] as const) {
    await page.goto(path);
    await assertNoHorizontalOverflow(page);
    await assertPrimarySurfaceVisible(page);
    await attachScreenshot(page, name);
  }

  await page.setViewportSize({ width: 390, height: 860 });
  for (const [name, path] of [
    ["mobile-fr-dashboard", "/fr"],
    ["mobile-fr-composer", "/fr/composer-une-potion"]
  ] as const) {
    await page.goto(path);
    await assertNoHorizontalOverflow(page);
    await assertPrimarySurfaceVisible(page);
    await attachScreenshot(page, name);
  }
});

test("creates all SERVIER recipes through the PostgreSQL-backed UI", async ({ page, request }) => {
  for (const ingredientId of [...new Set(recipes.flatMap((recipe) => recipe.ingredientIds))]) {
    const response = await request.put(`http://127.0.0.1:3001/inventory/${ingredientId}`, {
      data: { quantity: 9 }
    });
    expect(response.ok(), `reset ${ingredientId} stock before all-recipe proof`).toBe(true);
  }

  await page.goto("/fr/recettes");

  await expect(page.getByRole("heading", { level: 1, name: "Recettes & potions." })).toBeVisible();
  await expect(page.getByTestId("recipe-invisibilite")).toContainText(
    "Noix de coco + Yttrium + Mandragore"
  );
  const initialLedgerCount = await page.getByTestId("potion-ledger").locator("li").count();

  await page.goto("/fr/composer-une-potion");
  await selectIngredients(page, ["argent", "or", "bave-de-lama"]);
  await page.getByTestId("combine-button").click();
  await expect(page.getByTestId("notice")).toContainText(
    "Aucune recette ne correspond à ces trois ingrédients."
  );
  await page.getByRole("button", { name: "Effacer" }).click();

  for (const recipe of recipes) {
    await page.goto("/fr/composer-une-potion");
    await selectIngredients(page, recipe.ingredientIds);
    await page.getByTestId("combine-button").click();
    await page.waitForURL(`**/fr/recettes?created=*&recipe=${recipe.id}`);
    await expect(page.locator(".success-route-banner")).toContainText(recipe.name);
    await expect(page.getByTestId(`recipe-${recipe.id}`)).toContainText("Créée");
  }

  await page.goto("/fr/recettes");
  const ledger = page.getByTestId("potion-ledger");
  await expect(ledger.locator("li")).toHaveCount(initialLedgerCount + 9);
  for (const recipe of recipes) {
    await expect(ledger).toContainText(recipe.name);
  }
});

async function selectIngredients(
  page: Page,
  ingredientIds: readonly string[]
): Promise<void> {
  for (const ingredientId of ingredientIds) {
    await page.getByTestId(`select-${ingredientId}`).click();
  }
}

async function expectServierShell(page: Page): Promise<void> {
  await expect(page.getByRole("complementary", { name: /Laboratoire SERVIER|SERVIER lab/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /SERVIER.*moved by you/i })).toBeVisible();
  await expect(page.locator(".servier-logo")).toBeVisible();
  await expect(page.locator('link[rel~="icon"][href="/brand/servier-favicon-32.png"]')).toHaveCount(1);
}

function pageNav(page: Page) {
  return page.getByRole("navigation", { name: /Pages du test technique|Technical test pages/ });
}

async function assertCodexDoesNotCollide(page: Page): Promise<void> {
  const cauldron = page.getByTestId("cauldron-panel");
  const codex = page.getByTestId("codex-panel");
  const recipe = page.getByTestId("recipe-invisibilite");

  await codex.scrollIntoViewIfNeeded();
  await expect(recipe).toBeVisible();
  await expect(recipe.getByRole("button", { name: /Préparer cette formule|Formule sélectionnée/ })).toBeEnabled();
  await expect(cauldron).toHaveCount(0);
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page must not create horizontal overflow").toBeLessThanOrEqual(1);
}

async function assertPrimarySurfaceVisible(page: Page): Promise<void> {
  await expect(page.getByRole("navigation", { name: /Pages du test technique|Technical test pages/ })).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport, "viewport must be available").not.toBeNull();

  const hero = page.locator(".hero-theatre");
  if ((await hero.count()) > 0) {
    const heroBox = await hero.boundingBox();
    expect(heroBox, "hero has a rendered bounding box").not.toBeNull();
    expect(heroBox!.height, "hero should not consume the full first viewport").toBeLessThanOrEqual(
      viewport!.height * 0.72
    );
    await expect(page.locator(".hero-cta")).toBeInViewport();
  }

  const firstPrimarySurface = page
    .locator('.dashboard-launchpad, [data-testid="cauldron-panel"], [data-testid="codex-panel"], [data-testid="inventory-panel"]')
    .first();
  await expect(firstPrimarySurface).toBeVisible();
}

async function attachScreenshot(page: Page, name: string): Promise<void> {
  const screenshot = await page.screenshot({ fullPage: true });
  await test.info().attach(`${name}.png`, {
    body: screenshot,
    contentType: "image/png"
  });
}
