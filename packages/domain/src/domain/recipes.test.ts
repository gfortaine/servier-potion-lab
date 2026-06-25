import {
  INGREDIENTS,
  RECIPES,
  createInventory,
  difa_createPotionFromInventory,
  difa_findRecipeByIngredients,
  rechargeIngredient,
  validateIngredientSelection
} from "../index.js";

type TestCase = {
  readonly name: string;
  readonly run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

test("fixtures include exactly 14 ingredients and nine recipes", () => {
  assertEqual(INGREDIENTS.length, 14, "ingredient fixture count");
  assertEqual(RECIPES.length, 9, "recipe fixture count");
});

test("every recipe uses exactly three unique known ingredients", () => {
  const knownIngredientIds = new Set(INGREDIENTS.map((ingredient) => ingredient.id));

  for (const recipe of RECIPES) {
    assertEqual(recipe.ingredientIds.length, 3, `${recipe.id} ingredient count`);
    assertEqual(
      new Set(recipe.ingredientIds).size,
      3,
      `${recipe.id} should not contain duplicate ingredients`
    );
    for (const ingredientId of recipe.ingredientIds) {
      assert(
        knownIngredientIds.has(ingredientId),
        `${recipe.id} references unknown ingredient ${ingredientId}`
      );
    }
  }
});

test("difa_findRecipeByIngredients matches every valid recipe", () => {
  for (const recipe of RECIPES) {
    const result = difa_findRecipeByIngredients(recipe.ingredientIds);

    assert(result.ok, `${recipe.id} should match`);
    assertEqual(result.recipe.id, recipe.id, `${recipe.id} match id`);
  }
});

test("recipe matching is order independent", () => {
  for (const recipe of RECIPES) {
    const reversedIngredients = [...recipe.ingredientIds].reverse();
    const result = difa_findRecipeByIngredients(reversedIngredients);

    assert(result.ok, `${recipe.id} should match in reverse order`);
    assertEqual(result.recipe.id, recipe.id, `${recipe.id} reverse match id`);
  }
});

test("selection with fewer than three ingredients is rejected", () => {
  const result = validateIngredientSelection(["argent", "or"]);

  assert(!result.ok, "short selection should fail");
  assertEqual(result.error.code, "SELECTION_SIZE_INVALID", "short selection error");
});

test("selection with more than three ingredients is rejected", () => {
  const result = validateIngredientSelection([
    "argent",
    "or",
    "poil-de-yeti",
    "mandragore"
  ]);

  assert(!result.ok, "long selection should fail");
  assertEqual(result.error.code, "SELECTION_SIZE_INVALID", "long selection error");
});

test("selection with an unknown ingredient is rejected", () => {
  const result = difa_findRecipeByIngredients([
    "argent",
    "or",
    "unknown-ingredient"
  ]);

  assert(!result.ok, "unknown ingredient selection should fail");
  assertEqual(result.error.code, "UNKNOWN_INGREDIENT", "unknown ingredient error");
});

test("selection with a duplicate ingredient is rejected", () => {
  const result = difa_findRecipeByIngredients(["argent", "argent", "or"]);

  assert(!result.ok, "duplicate ingredient selection should fail");
  assertEqual(result.error.code, "DUPLICATE_INGREDIENT", "duplicate ingredient error");
});

test("valid unique ingredients that do not form a recipe are rejected", () => {
  const result = difa_findRecipeByIngredients(["argent", "bave-de-lama", "or"]);

  assert(!result.ok, "unknown recipe should fail");
  assertEqual(result.error.code, "RECIPE_NOT_FOUND", "unknown recipe error");
});

test("difa_createPotionFromInventory creates a potion and decrements stock", () => {
  const inventory = createInventory({ "noix-de-coco": 2, yttrium: 2, mandragore: 2 }, 1);
  const result = difa_createPotionFromInventory(
    ["noix-de-coco", "yttrium", "mandragore"],
    inventory,
    {
      potionId: "potion-test-1",
      createdAt: new Date("2026-06-20T12:00:00.000Z")
    }
  );

  assert(result.ok, "potion creation should succeed");
  assertEqual(result.potion.recipeId, "invisibilite", "created potion recipe");
  assertEqual(result.potion.id, "potion-test-1", "created potion id");
  assertEqual(
    result.inventory.find((item) => item.ingredientId === "noix-de-coco")?.quantity,
    1,
    "noix stock after potion"
  );
  assertEqual(
    result.inventory.find((item) => item.ingredientId === "yttrium")?.quantity,
    1,
    "yttrium stock after potion"
  );
  assertEqual(
    result.inventory.find((item) => item.ingredientId === "mandragore")?.quantity,
    1,
    "mandragore stock after potion"
  );
});

test("potion creation rejects insufficient inventory without decrementing", () => {
  const inventory = createInventory({ "noix-de-coco": 0, yttrium: 1, mandragore: 1 }, 1);
  const result = difa_createPotionFromInventory(
    ["noix-de-coco", "yttrium", "mandragore"],
    inventory
  );

  assert(!result.ok, "potion creation should fail without stock");
  assertEqual(result.error.code, "INSUFFICIENT_STOCK", "insufficient stock error");
});

test("default potion ids are PostgreSQL uuid compatible", () => {
  const result = difa_createPotionFromInventory(
    ["noix-de-coco", "yttrium", "mandragore"],
    createInventory({}, 2)
  );

  assert(result.ok, "potion creation should succeed");
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      result.potion.id
    ),
    `default potion id should be a v4 uuid, got ${result.potion.id}`
  );
});

test("rechargeIngredient increments one inventory item", () => {
  const inventory = createInventory({}, 0);
  const recharged = rechargeIngredient(inventory, "argent", 4);

  assertEqual(
    recharged.find((item) => item.ingredientId === "argent")?.quantity,
    4,
    "recharged argent quantity"
  );
  assertEqual(
    recharged.find((item) => item.ingredientId === "or")?.quantity,
    0,
    "unrelated ingredient quantity"
  );
});

for (const { name, run } of tests) {
  run();
  console.log(`✓ ${name}`);
}

console.log(`${tests.length} domain tests passed`);
