export { INGREDIENTS, RECIPES } from "./domain/fixtures.js";
export {
  difa_findRecipeByIngredients,
  validateIngredientSelection
} from "./domain/recipeMatching.js";
export {
  createInventory,
  createRandomInventory,
  difa_createPotionFromInventory,
  rechargeIngredient
} from "./domain/inventory.js";
export {
  PotionLabApplication,
  PotionLabApplicationError
} from "./application/potionLab.js";
export type {
  InventoryRepository,
  PotionRepository,
  RecipeWithDiscovery
} from "./application/potionLab.js";
export type {
  Ingredient,
  IngredientId,
  IngredientSelectionValidationResult,
  InventoryItem,
  Potion,
  PotionCreationResult,
  Recipe,
  RecipeId,
  RecipeMatchResult,
  RecipeValidationError,
  RecipeValidationErrorCode
} from "./domain/types.js";
