import {
  ApiError,
  createPotionLabApi,
  type IngredientView,
  type InventoryView,
  type PotionChatResponse,
  type PotionChatToolCall,
  type PotionView,
  type RecipeView
} from "@servier-potion-lab/api-client";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

export { ApiError };
export type {
  IngredientView,
  InventoryView,
  PotionChatResponse,
  PotionChatToolCall,
  PotionView,
  RecipeView
};

export const potionLabApi = createPotionLabApi({
  baseUrl: API_BASE_URL
});
