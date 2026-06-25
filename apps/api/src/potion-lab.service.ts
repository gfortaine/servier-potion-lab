import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Ingredient,
  IngredientId,
  InventoryItem,
  Potion,
  Recipe
} from "@servier-potion-lab/domain";
import {
  INGREDIENTS,
  PotionLabApplication,
  PotionLabApplicationError
} from "@servier-potion-lab/domain";

export interface InventoryView {
  readonly ingredientId: IngredientId;
  readonly name: string;
  readonly quantity: number;
}

export interface RecipeView {
  readonly id: string;
  readonly name: string;
  readonly ingredientIds: readonly IngredientId[];
  readonly discovered: boolean;
}

export interface PotionView {
  readonly id: string;
  readonly recipeId: string;
  readonly name: string;
  readonly ingredientIds: readonly IngredientId[];
  readonly createdAt: string;
}

@Injectable()
export class PotionLabService {
  constructor(private readonly application: PotionLabApplication) {}

  listIngredients(): readonly Ingredient[] {
    return this.application.listIngredients();
  }

  async listInventory(): Promise<readonly InventoryView[]> {
    return (await this.application.listInventory()).map((item) => toInventoryView(item));
  }

  async setInventoryQuantity(ingredientId: string, quantity: unknown): Promise<InventoryView> {
    try {
      return toInventoryView(
        await this.application.setInventoryQuantity(ingredientId, quantity)
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }

  async recharge(ingredientId: string, amount: unknown = 1): Promise<InventoryView> {
    try {
      return toInventoryView(await this.application.recharge(ingredientId, amount));
    } catch (error) {
      throw toHttpException(error);
    }
  }

  async randomizeInventory(
    minimum: unknown = 1,
    maximum: unknown = 5
  ): Promise<readonly InventoryView[]> {
    try {
      return (await this.application.randomizeInventory(minimum, maximum)).map((item) =>
        toInventoryView(item)
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }

  async listRecipes(): Promise<readonly RecipeView[]> {
    return (await this.application.listRecipes()).map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      ingredientIds: recipe.ingredientIds,
      discovered: recipe.discovered
    }));
  }

  async listPotions(): Promise<readonly PotionView[]> {
    return (await this.application.listPotions()).map(toPotionView);
  }

  async createPotion(ingredientIds: unknown): Promise<PotionView> {
    try {
      return toPotionView(await this.application.createPotion(ingredientIds));
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function toInventoryView(item: InventoryItem): InventoryView {
  const ingredient = INGREDIENTS_BY_ID.get(item.ingredientId);
  if (!ingredient) {
    throw new NotFoundException({
      code: "INGREDIENT_NOT_FOUND",
      message: `Ingredient ${item.ingredientId} was not found.`
    });
  }

  return {
    ingredientId: item.ingredientId,
    name: ingredient.name,
    quantity: item.quantity
  };
}

function toPotionView(potion: Potion): PotionView {
  return {
    id: potion.id,
    recipeId: potion.recipeId,
    name: potion.name,
    ingredientIds: potion.ingredientIds,
    createdAt: potion.createdAt.toISOString()
  };
}

function toHttpException(error: unknown): Error {
  if (error instanceof PotionLabApplicationError) {
    if (error.error.code === "UNKNOWN_INGREDIENT") {
      return new NotFoundException(error.error);
    }

    return new BadRequestException(error.error);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unexpected potion lab error.");
}

const INGREDIENTS_BY_ID = new Map<IngredientId, Ingredient>(
  INGREDIENTS.map((ingredient) => [ingredient.id, ingredient])
);
