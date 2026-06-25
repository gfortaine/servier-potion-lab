export type IngredientId =
  | "argent"
  | "bave-de-lama"
  | "epine-de-herisson"
  | "plume-de-griffon"
  | "helium-liquide"
  | "poil-de-yeti"
  | "or"
  | "azote-liquide"
  | "queue-d-ecureuil"
  | "crin-de-licorne"
  | "jus-de-horglup"
  | "noix-de-coco"
  | "yttrium"
  | "mandragore";

export type RecipeId =
  | "invisibilite"
  | "amour"
  | "jeunesse"
  | "immortalite"
  | "clairvoyance"
  | "force"
  | "vitesse"
  | "guerison"
  | "transformation";

export interface Ingredient {
  readonly id: IngredientId;
  readonly name: string;
}

export interface Recipe {
  readonly id: RecipeId;
  readonly name: string;
  readonly ingredientIds: readonly [IngredientId, IngredientId, IngredientId];
}

export type RecipeValidationErrorCode =
  | "SELECTION_SIZE_INVALID"
  | "UNKNOWN_INGREDIENT"
  | "DUPLICATE_INGREDIENT"
  | "RECIPE_NOT_FOUND"
  | "INVALID_INVENTORY_QUANTITY"
  | "INSUFFICIENT_STOCK";

export interface RecipeValidationError {
  readonly code: RecipeValidationErrorCode;
  readonly message: string;
  readonly details?: readonly string[];
}

export type IngredientSelectionValidationResult =
  | {
      readonly ok: true;
      readonly ingredientIds: readonly [IngredientId, IngredientId, IngredientId];
    }
  | {
      readonly ok: false;
      readonly error: RecipeValidationError;
    };

export type RecipeMatchResult =
  | {
      readonly ok: true;
      readonly recipe: Recipe;
    }
  | {
      readonly ok: false;
      readonly error: RecipeValidationError;
    };

export interface InventoryItem {
  readonly ingredientId: IngredientId;
  readonly quantity: number;
}

export interface Potion {
  readonly id: string;
  readonly recipeId: RecipeId;
  readonly name: string;
  readonly ingredientIds: readonly [IngredientId, IngredientId, IngredientId];
  readonly createdAt: Date;
}

export type PotionCreationResult =
  | {
      readonly ok: true;
      readonly potion: Potion;
      readonly inventory: readonly InventoryItem[];
    }
  | {
      readonly ok: false;
      readonly error: RecipeValidationError;
    };
