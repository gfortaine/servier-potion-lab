import { INGREDIENTS, RECIPES } from "../domain/fixtures.js";
import { createRandomInventory, difa_createPotionFromInventory } from "../domain/inventory.js";
import type {
  Ingredient,
  IngredientId,
  InventoryItem,
  Potion,
  Recipe,
  RecipeValidationError
} from "../domain/types.js";

export interface InventoryRepository {
  listInventory(): Promise<readonly InventoryItem[]>;
  replaceInventory(inventory: readonly InventoryItem[]): Promise<void>;
  setInventoryQuantity(ingredientId: IngredientId, quantity: number): Promise<InventoryItem>;
  rechargeIngredient(ingredientId: IngredientId, amount: number): Promise<InventoryItem>;
}

export interface PotionRepository {
  listPotions(): Promise<readonly Potion[]>;
  recordPotion(potion: Potion): Promise<boolean>;
}

export interface RecipeWithDiscovery extends Recipe {
  readonly discovered: boolean;
}

export class PotionLabApplicationError extends Error {
  constructor(readonly error: RecipeValidationError) {
    super(error.message);
    this.name = "PotionLabApplicationError";
  }
}

export class PotionLabApplication {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly potionRepository: PotionRepository
  ) {}

  listIngredients(): readonly Ingredient[] {
    return INGREDIENTS;
  }

  async listInventory(): Promise<readonly InventoryItem[]> {
    return await this.inventoryRepository.listInventory();
  }

  async setInventoryQuantity(
    ingredientId: string,
    quantity: unknown
  ): Promise<InventoryItem> {
    const ingredient = findIngredient(ingredientId);
    const nextQuantity = readNonNegativeInteger(quantity, "quantity");

    return await this.inventoryRepository.setInventoryQuantity(ingredient.id, nextQuantity);
  }

  async recharge(ingredientId: string, amount: unknown = 1): Promise<InventoryItem> {
    const ingredient = findIngredient(ingredientId);
    const rechargeAmount = readNonNegativeInteger(amount, "amount");

    return await this.inventoryRepository.rechargeIngredient(ingredient.id, rechargeAmount);
  }

  async randomizeInventory(
    minimum: unknown = 1,
    maximum: unknown = 5
  ): Promise<readonly InventoryItem[]> {
    const min = readNonNegativeInteger(minimum, "minimum");
    const max = readNonNegativeInteger(maximum, "maximum");
    if (max < min) {
      throw new PotionLabApplicationError({
        code: "INVALID_INVENTORY_QUANTITY",
        message: "maximum must be greater than or equal to minimum.",
        details: ["maximum"]
      });
    }

    const nextInventory = createRandomInventory(min, max);

    await this.inventoryRepository.replaceInventory(nextInventory);
    return nextInventory;
  }

  async listRecipes(): Promise<readonly RecipeWithDiscovery[]> {
    const discoveredRecipeIds = new Set(
      (await this.potionRepository.listPotions()).map((potion) => potion.recipeId)
    );

    return RECIPES.map((recipe) => ({
      ...recipe,
      discovered: discoveredRecipeIds.has(recipe.id)
    }));
  }

  async listPotions(): Promise<readonly Potion[]> {
    return await this.potionRepository.listPotions();
  }

  async createPotion(ingredientIds: unknown): Promise<Potion> {
    if (!Array.isArray(ingredientIds) || !ingredientIds.every((id) => typeof id === "string")) {
      throw new PotionLabApplicationError({
        code: "UNKNOWN_INGREDIENT",
        message: "ingredientIds must be an array of ingredient identifiers.",
        details: ["ingredientIds"]
      });
    }

    const result = difa_createPotionFromInventory(
      ingredientIds,
      await this.inventoryRepository.listInventory()
    );

    if (!result.ok) {
      throw new PotionLabApplicationError(result.error);
    }

    const recorded = await this.potionRepository.recordPotion(result.potion);
    if (!recorded) {
      throw new PotionLabApplicationError({
        code: "INSUFFICIENT_STOCK",
        message: "Inventory does not contain enough stock for the selected potion.",
        details: [...result.potion.ingredientIds]
      });
    }

    return result.potion;
  }
}

function findIngredient(ingredientId: string): Ingredient {
  const ingredient = INGREDIENTS.find((candidate) => candidate.id === ingredientId);
  if (!ingredient) {
    throw new PotionLabApplicationError({
      code: "UNKNOWN_INGREDIENT",
      message: `Ingredient ${ingredientId} was not found.`,
      details: [ingredientId]
    });
  }

  return ingredient;
}

function readNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new PotionLabApplicationError({
      code: "INVALID_INVENTORY_QUANTITY",
      message: `${label} must be a non-negative integer.`,
      details: [label]
    });
  }

  return value;
}
