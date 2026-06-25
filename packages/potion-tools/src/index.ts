import {
  INGREDIENTS,
  PotionLabApplication,
  PotionLabApplicationError,
  RECIPES
} from "@servier-potion-lab/domain";
import type {
  Ingredient,
  IngredientId,
  InventoryItem,
  Potion,
  Recipe,
  RecipeValidationError
} from "@servier-potion-lab/domain";

export type PotionToolName =
  | "list_ingredients"
  | "list_inventory"
  | "list_recipes"
  | "list_potions"
  | "create_potion"
  | "recharge_inventory"
  | "randomize_inventory"
  | "suggest_recipes"
  | "codex_plan";

export type PotionToolUiType =
  | "ingredient-catalog-card"
  | "inventory-ledger-card"
  | "recipe-codex-card"
  | "potion-ledger-card"
  | "potion-created-card"
  | "inventory-delta-card"
  | "recipe-suggestion-card"
  | "insufficient-stock-card"
  | "tool-error-card";

export interface InventoryView {
  readonly ingredientId: IngredientId;
  readonly name: string;
  readonly quantity: number;
}

export interface RecipeView {
  readonly id: string;
  readonly name: string;
  readonly ingredientIds: readonly IngredientId[];
  readonly ingredientNames: readonly string[];
  readonly discovered: boolean;
}

export interface PotionView {
  readonly id: string;
  readonly recipeId: string;
  readonly name: string;
  readonly ingredientIds: readonly IngredientId[];
  readonly ingredientNames: readonly string[];
  readonly createdAt: string;
}

export interface InventoryDelta {
  readonly ingredientId: IngredientId;
  readonly name: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface ToolErrorView {
  readonly code:
    | RecipeValidationError["code"]
    | "CHAT_INTENT_NOT_UNDERSTOOD"
    | "CODEX_PROVIDER_PLAN_ERROR"
    | "CODEX_CREATE_ONLY_GUARDRAIL";
  readonly message: string;
  readonly details: readonly string[];
}

export interface PotionToolResult<TData> {
  readonly name: PotionToolName;
  readonly status: "success" | "error";
  readonly stateChanged: boolean;
  readonly message: string;
  readonly data: TData;
  readonly ui: {
    readonly type: PotionToolUiType;
  };
}

export interface PotionCreationData {
  readonly potion: PotionView;
  readonly inventoryDelta: readonly InventoryDelta[];
}

export interface RecipeSuggestionData {
  readonly recipes: readonly RecipeView[];
}

export interface ChatToolResponse {
  readonly answer: string;
  readonly intent:
    | PotionToolName
    | "unknown";
  readonly toolCalls: readonly PotionToolResult<unknown>[];
  readonly liveProviderUsed: boolean;
}

export class PotionToolService {
  constructor(private readonly application: PotionLabApplication) {}

  listIngredients(): PotionToolResult<readonly Ingredient[]> {
    return {
      name: "list_ingredients",
      status: "success",
      stateChanged: false,
      message: `Catalogue prêt: ${INGREDIENTS.length} ingrédients SERVIER.`,
      data: this.application.listIngredients(),
      ui: { type: "ingredient-catalog-card" }
    };
  }

  async listInventory(): Promise<PotionToolResult<readonly InventoryView[]>> {
    const inventory = await this.application.listInventory();
    return {
      name: "list_inventory",
      status: "success",
      stateChanged: false,
      message: "Inventaire actuel du laboratoire.",
      data: inventory.map(toInventoryView),
      ui: { type: "inventory-ledger-card" }
    };
  }

  async listRecipes(): Promise<PotionToolResult<readonly RecipeView[]>> {
    const recipes = await this.application.listRecipes();
    return {
      name: "list_recipes",
      status: "success",
      stateChanged: false,
      message: "Codex des recettes avec état de découverte.",
      data: recipes.map(toRecipeView),
      ui: { type: "recipe-codex-card" }
    };
  }

  async listPotions(): Promise<PotionToolResult<readonly PotionView[]>> {
    const potions = await this.application.listPotions();
    return {
      name: "list_potions",
      status: "success",
      stateChanged: false,
      message: "Registre des potions créées.",
      data: potions.map(toPotionView),
      ui: { type: "potion-ledger-card" }
    };
  }

  async suggestRecipes(): Promise<PotionToolResult<RecipeSuggestionData>> {
    const recipes = (await this.application.listRecipes())
      .filter((recipe) => !recipe.discovered)
      .slice(0, 3)
      .map(toRecipeView);

    return {
      name: "suggest_recipes",
      status: "success",
      stateChanged: false,
      message: recipes.length > 0
        ? "Le codex propose ces recettes encore à révéler."
        : "Toutes les recettes SERVIER ont déjà été révélées.",
      data: { recipes },
      ui: { type: "recipe-suggestion-card" }
    };
  }

  async createPotionByRecipeName(recipeName: string): Promise<PotionToolResult<PotionCreationData | ToolErrorView>> {
    const recipe = findRecipeByNameOrId(recipeName);
    if (!recipe) {
      return toolError("create_potion", {
        code: "RECIPE_NOT_FOUND",
        message: `Aucune recette ne correspond à "${recipeName}".`,
        details: [recipeName]
      });
    }

    return await this.createPotionByIngredientIds(recipe.ingredientIds);
  }

  async createPotionByIngredientIds(
    ingredientIds: readonly string[]
  ): Promise<PotionToolResult<PotionCreationData | ToolErrorView>> {
    const beforeInventory = await this.application.listInventory();

    try {
      const potion = await this.application.createPotion(ingredientIds);
      const afterInventory = await this.application.listInventory();
      const delta = createInventoryDelta(beforeInventory, afterInventory, potion.ingredientIds);
      return {
        name: "create_potion",
        status: "success",
        stateChanged: true,
        message: `${potion.name} validée et ajoutée au registre.`,
        data: {
          potion: toPotionView(potion),
          inventoryDelta: delta
        },
        ui: { type: "potion-created-card" }
      };
    } catch (error) {
      return toolError("create_potion", toToolError(error));
    }
  }

  async rechargeInventory(
    ingredientId: string,
    amount = 1
  ): Promise<PotionToolResult<InventoryView | ToolErrorView>> {
    try {
      return {
        name: "recharge_inventory",
        status: "success",
        stateChanged: true,
        message: "Stock rechargé.",
        data: toInventoryView(await this.application.recharge(ingredientId, amount)),
        ui: { type: "inventory-delta-card" }
      };
    } catch (error) {
      return toolError("recharge_inventory", toToolError(error));
    }
  }

  async randomizeInventory(
    minimum = 1,
    maximum = 5
  ): Promise<PotionToolResult<readonly InventoryView[] | ToolErrorView>> {
    try {
      return {
        name: "randomize_inventory",
        status: "success",
        stateChanged: true,
        message: "Inventaire redistribué pour rejouer le laboratoire.",
        data: (await this.application.randomizeInventory(minimum, maximum)).map(toInventoryView),
        ui: { type: "inventory-ledger-card" }
      };
    } catch (error) {
      return toolError("randomize_inventory", toToolError(error));
    }
  }

  async answerChat(message: string): Promise<ChatToolResponse> {
    const directRecipe = findRecipeByMessage(message);
    if (directRecipe) {
      const result = await this.createPotionByIngredientIds(directRecipe.ingredientIds);
      return {
        answer: result.message,
        intent: "create_potion",
        toolCalls: [result],
        liveProviderUsed: false
      };
    }

    const ingredientIds = findIngredientIdsByMessage(message);
    if (ingredientIds.length >= 3) {
      const result = await this.createPotionByIngredientIds(ingredientIds.slice(0, 3));
      return {
        answer: result.message,
        intent: "create_potion",
        toolCalls: [result],
        liveProviderUsed: false
      };
    }

    if (matchesAny(normalize(message), ["inventaire", "inventory", "stock"])) {
      const result = await this.listInventory();
      return {
        answer: result.message,
        intent: "list_inventory",
        toolCalls: [result],
        liveProviderUsed: false
      };
    }

    const suggestions = await this.suggestRecipes();
    return {
      answer: "Je peux créer une potion si tu me donnes une recette ou trois ingrédients. Voici des pistes du codex.",
      intent: "suggest_recipes",
      toolCalls: [suggestions],
      liveProviderUsed: false
    };
  }
}

export function toInventoryView(item: InventoryItem): InventoryView {
  const ingredient = INGREDIENTS_BY_ID.get(item.ingredientId);
  return {
    ingredientId: item.ingredientId,
    name: ingredient?.name ?? item.ingredientId,
    quantity: item.quantity
  };
}

export function toRecipeView(recipe: Recipe & { readonly discovered?: boolean }): RecipeView {
  return {
    id: recipe.id,
    name: recipe.name,
    ingredientIds: recipe.ingredientIds,
    ingredientNames: recipe.ingredientIds.map((ingredientId) => INGREDIENTS_BY_ID.get(ingredientId)?.name ?? ingredientId),
    discovered: recipe.discovered ?? false
  };
}

export function toPotionView(potion: Potion): PotionView {
  return {
    id: potion.id,
    recipeId: potion.recipeId,
    name: potion.name,
    ingredientIds: potion.ingredientIds,
    ingredientNames: potion.ingredientIds.map((ingredientId) => INGREDIENTS_BY_ID.get(ingredientId)?.name ?? ingredientId),
    createdAt: potion.createdAt.toISOString()
  };
}

function createInventoryDelta(
  beforeInventory: readonly InventoryItem[],
  afterInventory: readonly InventoryItem[],
  touchedIngredientIds: readonly IngredientId[]
): readonly InventoryDelta[] {
  const beforeById = new Map(beforeInventory.map((item) => [item.ingredientId, item.quantity]));
  const afterById = new Map(afterInventory.map((item) => [item.ingredientId, item.quantity]));

  return touchedIngredientIds.map((ingredientId) => {
    const before = beforeById.get(ingredientId) ?? 0;
    const after = afterById.get(ingredientId) ?? 0;
    return {
      ingredientId,
      name: INGREDIENTS_BY_ID.get(ingredientId)?.name ?? ingredientId,
      before,
      after,
      delta: after - before
    };
  });
}

function findRecipeByMessage(message: string): Recipe | null {
  const normalized = normalize(message);
  return RECIPES.find((recipe) => normalized.includes(normalize(recipe.id)) || normalized.includes(normalize(recipe.name))) ?? null;
}

function findRecipeByNameOrId(recipeName: string): Recipe | null {
  const normalized = normalize(recipeName);
  return RECIPES.find((recipe) => normalize(recipe.id) === normalized || normalize(recipe.name) === normalized || normalize(recipe.name).includes(normalized)) ?? null;
}

function findIngredientIdsByMessage(message: string): readonly IngredientId[] {
  const normalized = normalize(message);
  return INGREDIENTS.filter((ingredient) => normalized.includes(normalize(ingredient.id)) || normalized.includes(normalize(ingredient.name))).map((ingredient) => ingredient.id);
}

function toolError<TName extends PotionToolName>(
  name: TName,
  error: ToolErrorView
): PotionToolResult<ToolErrorView> {
  return {
    name,
    status: "error",
    stateChanged: false,
    message: error.message,
    data: error,
    ui: { type: error.code === "INSUFFICIENT_STOCK" ? "insufficient-stock-card" : "tool-error-card" }
  };
}

function toToolError(error: unknown): ToolErrorView {
  if (error instanceof PotionLabApplicationError) {
    return {
      code: error.error.code,
      message: error.error.message,
      details: error.error.details ?? []
    };
  }
  if (error instanceof Error) {
    return {
      code: "CHAT_INTENT_NOT_UNDERSTOOD",
      message: error.message,
      details: []
    };
  }
  return {
    code: "CHAT_INTENT_NOT_UNDERSTOOD",
    message: "L'outil du laboratoire a échoué sans détail exploitable.",
    details: []
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

const INGREDIENTS_BY_ID = new Map<IngredientId, Ingredient>(
  INGREDIENTS.map((ingredient) => [ingredient.id, ingredient])
);
