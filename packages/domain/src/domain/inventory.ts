import { INGREDIENTS } from "./fixtures.js";
import { difa_findRecipeByIngredients } from "./recipeMatching.js";
import type {
  IngredientId,
  InventoryItem,
  Potion,
  PotionCreationResult,
  RecipeValidationError
} from "./types.js";

export function createInventory(
  quantities: Partial<Record<IngredientId, number>> = {},
  defaultQuantity = 3
): readonly InventoryItem[] {
  assertNonNegativeInteger(defaultQuantity, "default inventory quantity");

  return INGREDIENTS.map((ingredient) => {
    const quantity = quantities[ingredient.id] ?? defaultQuantity;
    assertNonNegativeInteger(quantity, `${ingredient.id} quantity`);

    return {
      ingredientId: ingredient.id,
      quantity
    };
  });
}

export function createRandomInventory(
  minimum = 1,
  maximum = 5,
  random: () => number = Math.random
): readonly InventoryItem[] {
  assertNonNegativeInteger(minimum, "minimum inventory quantity");
  assertNonNegativeInteger(maximum, "maximum inventory quantity");
  if (maximum < minimum) {
    throw new Error("maximum inventory quantity must be greater than or equal to minimum.");
  }

  return INGREDIENTS.map((ingredient) => ({
    ingredientId: ingredient.id,
    quantity: minimum + Math.floor(random() * (maximum - minimum + 1))
  }));
}

export function rechargeIngredient(
  inventory: readonly InventoryItem[],
  ingredientId: IngredientId,
  amount: number
): readonly InventoryItem[] {
  assertNonNegativeInteger(amount, "recharge amount");

  return inventory.map((item) =>
    item.ingredientId === ingredientId
      ? { ...item, quantity: item.quantity + amount }
      : item
  );
}

export function difa_createPotionFromInventory(
  selectedIngredientIds: readonly string[],
  inventory: readonly InventoryItem[],
  options: {
    readonly potionId?: string;
    readonly createdAt?: Date;
  } = {}
): PotionCreationResult {
  const match = difa_findRecipeByIngredients(selectedIngredientIds);
  if (!match.ok) {
    return match;
  }

  const stockError = findStockError(match.recipe.ingredientIds, inventory);
  if (stockError) {
    return { ok: false, error: stockError };
  }

  const consumedIds = new Set<IngredientId>(match.recipe.ingredientIds);
  const nextInventory = inventory.map((item) =>
    consumedIds.has(item.ingredientId)
      ? { ...item, quantity: item.quantity - 1 }
      : item
  );

  const potion: Potion = {
    id: options.potionId ?? createPotionId(match.recipe.id),
    recipeId: match.recipe.id,
    name: match.recipe.name,
    ingredientIds: match.recipe.ingredientIds,
    createdAt: options.createdAt ?? new Date()
  };

  return {
    ok: true,
    potion,
    inventory: nextInventory
  };
}

function findStockError(
  requiredIngredientIds: readonly IngredientId[],
  inventory: readonly InventoryItem[]
): RecipeValidationError | undefined {
  const inventoryById = new Map(
    inventory.map((item) => [item.ingredientId, item.quantity])
  );

  const missingIngredientIds = requiredIngredientIds.filter(
    (ingredientId) => (inventoryById.get(ingredientId) ?? 0) < 1
  );

  if (missingIngredientIds.length === 0) {
    return undefined;
  }

  return {
    code: "INSUFFICIENT_STOCK",
    message: "Inventory does not contain enough stock for the selected potion.",
    details: missingIngredientIds
  };
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function createPotionId(recipeId: string): string {
  void recipeId;
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return [
    `${randomHex(4)}${randomHex(4)}`,
    randomHex(4),
    `4${randomHex(3)}`,
    `${randomVariantNibble()}${randomHex(3)}`,
    `${randomHex(4)}${randomHex(4)}${randomHex(4)}`
  ].join("-");
}

function randomHex(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += Math.floor(Math.random() * 16).toString(16);
  }

  return value;
}

function randomVariantNibble(): string {
  return (8 + Math.floor(Math.random() * 4)).toString(16);
}
