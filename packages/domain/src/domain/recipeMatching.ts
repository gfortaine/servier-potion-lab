import { INGREDIENTS, RECIPES } from "./fixtures.js";
import type {
  IngredientId,
  IngredientSelectionValidationResult,
  Recipe,
  RecipeMatchResult
} from "./types.js";

const REQUIRED_INGREDIENT_COUNT = 3;
const KNOWN_INGREDIENT_IDS = new Set<IngredientId>(
  INGREDIENTS.map((ingredient) => ingredient.id)
);

export function validateIngredientSelection(
  selectedIngredientIds: readonly string[]
): IngredientSelectionValidationResult {
  if (selectedIngredientIds.length !== REQUIRED_INGREDIENT_COUNT) {
    return {
      ok: false,
      error: {
        code: "SELECTION_SIZE_INVALID",
        message: "A potion recipe must use exactly three ingredients.",
        details: [String(selectedIngredientIds.length)]
      }
    };
  }

  const unknownIngredientIds = selectedIngredientIds.filter(
    (ingredientId) => !isIngredientId(ingredientId)
  );

  if (unknownIngredientIds.length > 0) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_INGREDIENT",
        message: "Selection contains unknown ingredients.",
        details: unknownIngredientIds
      }
    };
  }

  const duplicateIngredientIds = findDuplicateIds(selectedIngredientIds);
  if (duplicateIngredientIds.length > 0) {
    return {
      ok: false,
      error: {
        code: "DUPLICATE_INGREDIENT",
        message: "A potion recipe cannot use the same ingredient twice.",
        details: duplicateIngredientIds
      }
    };
  }

  return {
    ok: true,
    ingredientIds: selectedIngredientIds as readonly [
      IngredientId,
      IngredientId,
      IngredientId
    ]
  };
}

export function difa_findRecipeByIngredients(
  selectedIngredientIds: readonly string[],
  recipes: readonly Recipe[] = RECIPES
): RecipeMatchResult {
  const validation = validateIngredientSelection(selectedIngredientIds);
  if (!validation.ok) {
    return validation;
  }

  const selectedRecipeKey = toRecipeKey(validation.ingredientIds);
  const matchedRecipe = recipes.find(
    (recipe) => toRecipeKey(recipe.ingredientIds) === selectedRecipeKey
  );

  if (!matchedRecipe) {
    return {
      ok: false,
      error: {
        code: "RECIPE_NOT_FOUND",
        message: "No potion recipe matches the selected ingredients.",
        details: [...validation.ingredientIds]
      }
    };
  }

  return { ok: true, recipe: matchedRecipe };
}

function isIngredientId(ingredientId: string): ingredientId is IngredientId {
  return KNOWN_INGREDIENT_IDS.has(ingredientId as IngredientId);
}

function findDuplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }

  return [...duplicates];
}

function toRecipeKey(ingredientIds: readonly IngredientId[]): string {
  return [...ingredientIds].sort().join("|");
}

