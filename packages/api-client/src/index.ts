import type {
  AssistantChatRequestDto,
  AssistantChatResponseDto,
  IngredientDto,
  InventoryItemDto,
  PotionDto,
  RecipeDto
} from "./generated/models/index.js";
import type { WithIngredientPutRequestBody } from "./generated/inventory/item/index.js";
import type { RechargePostRequestBody } from "./generated/inventory/item/recharge/index.js";
import type { RandomizePostRequestBody } from "./generated/inventory/randomize/index.js";
import type { PotionsPostRequestBody } from "./generated/potions/index.js";

export interface IngredientView {
  readonly id: string;
  readonly name: string;
}

export interface InventoryView {
  readonly ingredientId: string;
  readonly name: string;
  readonly quantity: number;
}

export interface RecipeView {
  readonly id: string;
  readonly name: string;
  readonly ingredientIds: readonly string[];
  readonly discovered: boolean;
}

export interface PotionView {
  readonly id: string;
  readonly recipeId: string;
  readonly name: string;
  readonly ingredientIds: readonly string[];
  readonly createdAt: string;
}

export interface PotionChatToolCall {
  readonly name: string;
  readonly status: "success" | "error";
  readonly stateChanged: boolean;
  readonly message: string;
  readonly data: unknown;
  readonly ui: {
    readonly type: string;
  };
}

export interface PotionChatResponse {
  readonly answer: string;
  readonly intent:
    | "list_ingredients"
    | "list_inventory"
    | "list_recipes"
    | "list_potions"
    | "create_potion"
    | "recharge_inventory"
    | "randomize_inventory"
    | "suggest_recipes"
    | "codex_plan"
    | "unknown";
  readonly toolCalls: readonly PotionChatToolCall[];
  readonly liveProviderUsed: boolean;
}

export interface PotionLabApi {
  readonly listIngredients: () => Promise<readonly IngredientView[]>;
  readonly listInventory: () => Promise<readonly InventoryView[]>;
  readonly listRecipes: () => Promise<readonly RecipeView[]>;
  readonly listPotions: () => Promise<readonly PotionView[]>;
  readonly setInventoryQuantity: (ingredientId: string, quantity: number) => Promise<InventoryView>;
  readonly createPotion: (ingredientIds: readonly string[]) => Promise<PotionView>;
  readonly rechargeIngredient: (ingredientId: string) => Promise<InventoryView>;
  readonly randomizeInventory: (minimum?: number, maximum?: number) => Promise<readonly InventoryView[]>;
  readonly chat: (message: string, locale?: "fr" | "en") => Promise<PotionChatResponse>;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface PotionLabApiOptions {
  readonly baseUrl: string;
  readonly fetch?: FetchLike;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createPotionLabApi(options: PotionLabApiOptions): PotionLabApi {
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  const requestJson = <T>(
    path: string,
    requestOptions: {
      readonly method?: "GET" | "POST" | "PUT";
      readonly body?: unknown;
    } = {}
  ): Promise<T> => requestJsonFrom(readFetch(options), baseUrl, path, requestOptions);

  return {
    listIngredients: async () =>
      mapArray(await requestJson<readonly IngredientDto[]>("/ingredients"), mapIngredient),
    listInventory: async () =>
      mapArray(await requestJson<readonly InventoryItemDto[]>("/inventory"), mapInventoryItem),
    listRecipes: async () => mapArray(await requestJson<readonly RecipeDto[]>("/recipes"), mapRecipe),
    listPotions: async () => mapArray(await requestJson<readonly PotionDto[]>("/potions"), mapPotion),
    setInventoryQuantity: async (ingredientId, quantity) => {
      const body = { quantity } satisfies Pick<WithIngredientPutRequestBody, "quantity">;
      return mapInventoryItem(
        await requestJson<InventoryItemDto>(`/inventory/${encodeURIComponent(ingredientId)}`, {
          method: "PUT",
          body
        })
      );
    },
    createPotion: async (ingredientIds) => {
      const body = {
        ingredientIds: [...ingredientIds]
      } satisfies Pick<PotionsPostRequestBody, "ingredientIds">;
      return mapPotion(
        await requestJson<PotionDto>("/potions", {
          method: "POST",
          body
        })
      );
    },
    rechargeIngredient: async (ingredientId) => {
      const body = { amount: 1 } satisfies Pick<RechargePostRequestBody, "amount">;
      return mapInventoryItem(
        await requestJson<InventoryItemDto>(
          `/inventory/${encodeURIComponent(ingredientId)}/recharge`,
          {
            method: "POST",
            body
          }
        )
      );
    },
    randomizeInventory: async (minimum = 1, maximum = 5) => {
      const body = { minimum, maximum } satisfies Pick<
        RandomizePostRequestBody,
        "minimum" | "maximum"
      >;
      return mapArray(
        await requestJson<readonly InventoryItemDto[]>("/inventory/randomize", {
          method: "POST",
          body
        }),
        mapInventoryItem
      );
    },
    chat: async (message, locale = "fr") => {
      const body = { message, locale } satisfies Pick<AssistantChatRequestDto, "message" | "locale">;
      return mapChatResponse(
        await requestJson<AssistantChatResponseDto>("/assistant/chat", {
          method: "POST",
          body
        })
      );
    }
  };
}

function readFetch(options: PotionLabApiOptions): FetchLike {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  if (!fetchImplementation) {
    throw new Error("A fetch implementation is required to create the SERVIER Potion Lab API client.");
  }
  return fetchImplementation;
}

async function requestJsonFrom<T>(
  fetchImplementation: FetchLike,
  baseUrl: string,
  path: string,
  options: {
    readonly method?: "GET" | "POST" | "PUT";
    readonly body?: unknown;
  }
): Promise<T> {
  const requestInit: RequestInit = { method: options.method ?? "GET" };
  if (options.body !== undefined) {
    requestInit.headers = { "content-type": "application/json" };
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetchImplementation(`${baseUrl}${path}`, requestInit);
  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `API request failed with HTTP ${response.status}.`;
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return fallback;
  }

  const payload = (await response.json()) as {
    readonly message?: string;
    readonly error?: {
      readonly message?: string;
    };
  };

  return payload.message ?? payload.error?.message ?? fallback;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/$/, "");
  if (!normalized) {
    throw new Error("SERVIER Potion Lab API baseUrl cannot be empty.");
  }
  return normalized;
}

function mapArray<TInput, TOutput>(
  input: readonly TInput[] | null | undefined,
  mapper: (input: TInput) => TOutput
): readonly TOutput[] {
  if (!Array.isArray(input)) {
    throw new Error("API response expected an array.");
  }
  return input.map(mapper);
}

function mapIngredient(input: IngredientDto): IngredientView {
  return {
    id: requiredString(input.id, "IngredientDto.id"),
    name: requiredString(input.name, "IngredientDto.name")
  };
}

function mapInventoryItem(input: InventoryItemDto): InventoryView {
  return {
    ingredientId: requiredString(input.ingredientId, "InventoryItemDto.ingredientId"),
    name: requiredString(input.name, "InventoryItemDto.name"),
    quantity: requiredNumber(input.quantity, "InventoryItemDto.quantity")
  };
}

function mapRecipe(input: RecipeDto): RecipeView {
  return {
    id: requiredString(input.id, "RecipeDto.id"),
    name: requiredString(input.name, "RecipeDto.name"),
    ingredientIds: requiredStringArray(input.ingredientIds, "RecipeDto.ingredientIds"),
    discovered: requiredBoolean(input.discovered, "RecipeDto.discovered")
  };
}

function mapPotion(input: PotionDto): PotionView {
  return {
    id: requiredString(input.id, "PotionDto.id"),
    recipeId: requiredString(input.recipeId, "PotionDto.recipeId"),
    name: requiredString(input.name, "PotionDto.name"),
    ingredientIds: requiredStringArray(input.ingredientIds, "PotionDto.ingredientIds"),
    createdAt: requiredIsoDate(input.createdAt, "PotionDto.createdAt")
  };
}

function mapChatResponse(input: AssistantChatResponseDto): PotionChatResponse {
  return {
    answer: requiredString(input.answer, "AssistantChatResponseDto.answer"),
    intent: mapChatIntent(requiredString(input.intent, "AssistantChatResponseDto.intent")),
    toolCalls: mapArray(input.toolCalls, mapChatToolCall),
    liveProviderUsed: requiredBoolean(input.liveProviderUsed, "AssistantChatResponseDto.liveProviderUsed")
  };
}

function mapChatToolCall(input: NonNullable<AssistantChatResponseDto["toolCalls"]>[number]): PotionChatToolCall {
  const status = input.status;
  if (status !== "success" && status !== "error") {
    throw new Error("API response missing required chat tool status.");
  }

  return {
    name: requiredString(input.name, "AssistantToolCallDto.name"),
    status,
    stateChanged: requiredBoolean(input.stateChanged, "AssistantToolCallDto.stateChanged"),
    message: requiredString(input.message, "AssistantToolCallDto.message"),
    data: input.data ?? {},
    ui: {
      type: requiredString(input.ui?.type, "AssistantToolUiDto.type")
    }
  };
}

function mapChatIntent(intent: string): PotionChatResponse["intent"] {
  if (
    intent === "list_ingredients" ||
    intent === "list_inventory" ||
    intent === "list_recipes" ||
    intent === "list_potions" ||
    intent === "create_potion" ||
    intent === "recharge_inventory" ||
    intent === "randomize_inventory" ||
    intent === "suggest_recipes" ||
    intent === "codex_plan" ||
    intent === "unknown"
  ) {
    return intent;
  }
  throw new Error(`API response contained unknown chat intent: ${intent}.`);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(`API response missing required string field: ${field}.`);
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`API response missing required number field: ${field}.`);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error(`API response missing required boolean field: ${field}.`);
}

function requiredStringArray(value: unknown, field: string): readonly string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  throw new Error(`API response missing required string array field: ${field}.`);
}

function requiredIsoDate(value: unknown, field: string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  throw new Error(`API response missing required date field: ${field}.`);
}
