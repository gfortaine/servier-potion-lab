import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  jsonSchema,
  stepCountIs,
  streamText,
  tool
} from "ai";
import type { UIMessage, UIMessageChunk } from "ai";
import OpenAI from "openai";
import type {
  FunctionTool,
  ResponseFunctionToolCall
} from "openai/resources/responses/responses";
import { z } from "zod";
import { INGREDIENTS, RECIPES } from "@servier-potion-lab/domain";
import { PotionToolService } from "@servier-potion-lab/potion-tools";
import type {
  ChatToolResponse,
  PotionToolResult,
  ToolErrorView
} from "@servier-potion-lab/potion-tools";

type CodexProviderRoute = "local" | "openai";

export const OPENAI_CODEX_MODEL_ENV = "OPENAI_MODEL";

export interface CodexPlanner {
  readonly plan: (request: CodexPlanRequest) => Promise<unknown>;
}

export interface CodexPlanRequest {
  readonly message: string;
  readonly locale: "fr" | "en";
}

export interface OpenAiCodexConfig {
  readonly apiKey: string;
  readonly model: string;
}

const createPotionPlanShape = {
  mode: z.enum(["recipe", "ingredients"]),
  recipeName: z.string().min(1).optional(),
  ingredientIds: z.array(z.string().min(1)).length(3).optional()
};

const codexPlanSchema = z.object({
  name: z.literal("create_potion"),
  ...createPotionPlanShape
}).refine((plan) => plan.mode !== "recipe" || Boolean(plan.recipeName), {
  message: "create_potion recipe mode requires recipeName"
}).refine((plan) => plan.mode !== "ingredients" || Boolean(plan.ingredientIds), {
  message: "create_potion ingredients mode requires exactly three ingredientIds"
}).refine((plan) => !(plan.recipeName && plan.ingredientIds), {
  message: "create_potion must use recipeName or ingredientIds, not both"
});

type CodexToolPlan = z.infer<typeof codexPlanSchema>;

interface StrictCreatePotionToolInput {
  readonly mode: "recipe" | "ingredients";
  readonly recipeName: string | null;
  readonly ingredientIds: readonly string[] | null;
}

type StrictCreatePotionJsonSchema = Parameters<typeof jsonSchema<StrictCreatePotionToolInput>>[0];

const strictCreatePotionToolInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: {
      type: "string",
      enum: ["recipe", "ingredients"],
      description: "Use recipe when the user names a known potion; use ingredients when the user gives exactly three known ingredients."
    },
    recipeName: {
      type: ["string", "null"],
      description: "Known SERVIER potion recipe name when mode is recipe; null when mode is ingredients."
    },
    ingredientIds: {
      type: ["array", "null"],
      description: "Exactly three known SERVIER ingredient IDs when mode is ingredients; null when mode is recipe.",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3
    }
  },
  required: ["mode", "recipeName", "ingredientIds"]
} satisfies StrictCreatePotionJsonSchema;

@Injectable()
export class CodexChatService {
  constructor(
    private readonly tools: PotionToolService,
    private readonly planner?: CodexPlanner
  ) {}

  async answer(message: string, locale: "fr" | "en" = "fr"): Promise<ChatToolResponse> {
    if (readCodexProviderRoute() === "local") {
      return await this.tools.answerChat(message);
    }

    const preGateError = validateOpenAiCreateOnlyRequest(message);
    if (preGateError) {
      return {
        answer: preGateError,
        intent: "codex_plan",
        toolCalls: [createCodexError(preGateError, "CODEX_CREATE_ONLY_GUARDRAIL")],
        liveProviderUsed: false
      };
    }

    const planner = this.planner ?? createOpenAiPlannerFromEnv();
    try {
      const plan = readCodexToolPlan(await planner.plan({ message, locale }));
      return toChatResponse(await this.executePlan(plan), true);
    } catch (error) {
      return {
        answer: "Le codex live n'a pas produit de plan d'outil valide.",
        intent: "codex_plan",
        toolCalls: [
          createCodexError(error instanceof Error ? error.message : "OpenAI Codex planning failed.")
        ],
        liveProviderUsed: false
      };
    }
  }

  private async executePlan(plan: CodexToolPlan): Promise<PotionToolResult<unknown>> {
    if (plan.recipeName) {
      return await this.tools.createPotionByRecipeName(plan.recipeName);
    }
    if (!plan.ingredientIds) {
      throw new Error("create_potion requires recipeName or exactly three ingredientIds");
    }
    return await this.tools.createPotionByIngredientIds(plan.ingredientIds);
  }

  async stream(messages: readonly UIMessage[], locale: "fr" | "en" = "fr"): Promise<ReadableStream<UIMessageChunk>> {
    if (readCodexProviderRoute() === "local") {
      return await this.createLocalUiMessageStream(messages);
    }

    const config = readOpenAiCodexConfig();
    const openAi = createOpenAI({ apiKey: config.apiKey });
    const createPotionTool = this.createStreamingCreatePotionTool();
    const tools = { create_potion: createPotionTool };
    const result = streamText({
      model: openAi.responses(config.model),
      system: createOpenAiStreamingInstructions(locale),
      messages: await convertToModelMessages([...messages], {
        tools,
        ignoreIncompleteToolCalls: true
      }),
      tools,
      toolChoice: "auto",
      stopWhen: stepCountIs(2),
      maxOutputTokens: 900,
      temperature: 0.2
    });

    return result.toUIMessageStream();
  }

  private createStreamingCreatePotionTool() {
    return tool({
      description: "Create exactly one SERVIER potion by known recipe name or by exactly three known ingredient IDs.",
      inputSchema: jsonSchema<StrictCreatePotionToolInput>(strictCreatePotionToolInputSchema),
      strict: true,
      execute: async (input) => {
        try {
          const plan = readCodexToolPlan(normalizeStrictCreatePotionToolInput(input));
          return await this.executePlan(plan);
        } catch (error) {
          return createCodexError(error instanceof Error ? error.message : "Codex streaming tool execution failed.");
        }
      }
    });
  }

  private async createLocalUiMessageStream(messages: readonly UIMessage[]): Promise<ReadableStream<UIMessageChunk>> {
    const message = readLastUserText(messages);
    const response = await this.tools.answerChat(message);

    return createUIMessageStream({
      originalMessages: [...messages],
      execute: ({ writer }) => {
        writeTextPart(writer.write, response.answer);
        for (const [index, toolCall] of response.toolCalls.entries()) {
          const toolCallId = `local-create-potion-${index}`;
          writer.write({
            type: "tool-input-available",
            toolCallId,
            toolName: toolCall.name,
            input: { message },
            title: toolCall.name
          });
          writer.write({
            type: "tool-output-available",
            toolCallId,
            output: toolCall
          });
        }
      }
    });
  }
}

export class OpenAiCodexPlanner implements CodexPlanner {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async plan(request: CodexPlanRequest): Promise<unknown> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: createOpenAiInstructions(request.locale),
      input: request.message,
      tools: OPENAI_CODEX_TOOLS,
      tool_choice: "required",
      parallel_tool_calls: false,
      max_output_tokens: 800,
      store: false
    });
    const functionCalls = response.output.filter(isOpenAiFunctionCall);
    const functionCall = functionCalls[0];
    if (functionCalls.length !== 1 || !functionCall) {
      throw new Error("OpenAI Codex must return exactly one bounded tool call.");
    }
    return {
      name: functionCall.name,
      ...parseJsonObject(functionCall.arguments)
    };
  }
}

function readCodexProviderRoute(): CodexProviderRoute {
  return process.env.SERVIER_CODEX_PROVIDER?.toLowerCase() === "local" ? "local" : "openai";
}

function createOpenAiPlannerFromEnv(): OpenAiCodexPlanner {
  const config = readOpenAiCodexConfig();
  return new OpenAiCodexPlanner(config.apiKey, config.model);
}

export function readOpenAiCodexConfig(env: NodeJS.ProcessEnv = process.env): OpenAiCodexConfig {
  const apiKey = env.OPENAI_API_KEY?.trim();
  const model = env[OPENAI_CODEX_MODEL_ENV]?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableException({
      code: "CODEX_PROVIDER_CONFIGURATION_ERROR",
      message: "Codex chat requires OPENAI_API_KEY for real-model runtime."
    });
  }
  if (!model) {
    throw new ServiceUnavailableException({
      code: "CODEX_PROVIDER_CONFIGURATION_ERROR",
      message: `Codex chat requires ${OPENAI_CODEX_MODEL_ENV} for real-model runtime.`
    });
  }
  return {
    apiKey,
    model
  };
}

function readCodexToolPlan(plan: unknown): CodexToolPlan {
  const parsed = codexPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error(`Invalid Codex tool plan: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
  }
  validateKnownPotionPlan(parsed.data);
  return parsed.data;
}

export function getStrictCreatePotionToolInputSchema(): unknown {
  return strictCreatePotionToolInputSchema;
}

function normalizeStrictCreatePotionToolInput(input: StrictCreatePotionToolInput): CodexToolPlan {
  return readCodexToolPlan({
    name: "create_potion",
    mode: input.mode,
    ...(input.recipeName === null ? {} : { recipeName: input.recipeName }),
    ...(input.ingredientIds === null ? {} : { ingredientIds: [...input.ingredientIds] })
  });
}

function validateKnownPotionPlan(plan: CodexToolPlan): void {
  if (plan.recipeName && !findRecipeByNameOrId(plan.recipeName)) {
    throw new Error(`Unknown Codex recipe name: ${plan.recipeName}`);
  }
  if (!plan.ingredientIds) {
    return;
  }
  const validIds = new Set<string>(INGREDIENTS.map((ingredient) => ingredient.id));
  const unknown = plan.ingredientIds.filter((ingredientId) => !validIds.has(ingredientId));
  if (unknown.length > 0) {
    throw new Error(`Unknown Codex ingredient IDs: ${unknown.join(", ")}`);
  }
}

function toChatResponse(result: PotionToolResult<unknown>, liveProviderUsed: boolean): ChatToolResponse {
  return {
    answer: result.message,
    intent: result.name,
    toolCalls: [result],
    liveProviderUsed
  };
}

function createCodexError(
  message: string,
  code: ToolErrorView["code"] = "CODEX_PROVIDER_PLAN_ERROR"
): PotionToolResult<ToolErrorView> {
  return {
    name: "codex_plan",
    status: "error",
    stateChanged: false,
    message,
    data: {
      code,
      message,
      details: ["codex_plan"]
    },
    ui: { type: "tool-error-card" }
  };
}

function createOpenAiInstructions(locale: "fr" | "en"): string {
  const recipeNames = RECIPES.map((recipe) => `${recipe.id}: ${recipe.name} = ${recipe.ingredientIds.join(", ")}`).join("; ");
  const ingredientIds = INGREDIENTS.map((ingredient) => `${ingredient.id}: ${ingredient.name}`).join("; ");
  const language = locale === "fr" ? "French" : "English";
  return [
    "ROLE: You are SERVIER Potion Lab Codex, a potion-creation planner.",
    "OBJECTIVE: Return exactly one create_potion function call when the user asks to create a potion.",
    "BOUNDARIES: The only allowed function is create_potion. Forbidden actions include listing inventory, listing recipes, listing potions, suggesting recipes, recharging stock, randomizing stock, explaining architecture, answering general questions, using web/file/MCP tools, and inventing recipes or ingredients.",
    "INPUT CONTRACT: Set mode='recipe' and recipeName only when the user names one known recipe. Set mode='ingredients' and ingredientIds only when the user gives exactly three known ingredient IDs or names. Never output both recipeName and ingredientIds.",
    `KNOWN RECIPES: ${recipeNames}.`,
    `KNOWN INGREDIENTS: ${ingredientIds}.`,
    "WHEN the request names a known potion recipe, THEN call create_potion with mode='recipe' and recipeName.",
    "WHEN the request gives exactly three known ingredients, THEN call create_potion with mode='ingredients' and ingredientIds.",
    `STOP: Produce no narrative text, no extra tool calls, and no read-only tool calls. Use ${language} only for internal interpretation of the user's message.`
  ].join(" ");
}

function createOpenAiStreamingInstructions(locale: "fr" | "en"): string {
  const recipeNames = RECIPES.map((recipe) => `${recipe.id}: ${recipe.name} = ${recipe.ingredientIds.join(", ")}`).join("; ");
  const ingredientIds = INGREDIENTS.map((ingredient) => `${ingredient.id}: ${ingredient.name}`).join("; ");
  const language = locale === "fr" ? "French" : "English";
  return [
    "ROLE: You are SERVIER Potion Lab Codex, a concise in-product lab assistant.",
    `LANGUAGE: Answer in ${language}.`,
    "CHAT: For greetings, orientation, or lightweight help, answer immediately in one or two short sentences.",
    "TOOL: Use create_potion only when the user clearly asks to prepare, create, brew, compose, or validate one known SERVIER potion.",
    "BOUNDARIES: The only executable tool is create_potion. You cannot list or mutate inventory, recharge stock, randomize stock, inspect databases, call MCP, browse files, or use the web.",
    "CREATE BY RECIPE: If the user names one known potion recipe, call create_potion with mode='recipe' and recipeName.",
    "CREATE BY INGREDIENTS: If the user gives exactly three known ingredients, call create_potion with mode='ingredients' and ingredientIds.",
    "SAFETY: Never invent recipes or ingredients. If the request is unsupported, explain what you can do instead.",
    `KNOWN RECIPES: ${recipeNames}.`,
    `KNOWN INGREDIENTS: ${ingredientIds}.`
  ].join(" ");
}

const OPENAI_CODEX_TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "create_potion",
    description: "Plan creation of one potion by recipe name or exactly three ingredient IDs.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["recipe", "ingredients"],
          description: "Use recipe when the user names a known potion; use ingredients when the user gives exactly three known ingredients."
        },
        recipeName: { type: "string" },
        ingredientIds: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 3
        }
      },
      required: ["mode"],
      additionalProperties: false
    }
  }
];

function validateOpenAiCreateOnlyRequest(message: string): string | null {
  const normalized = normalize(message);
  if (!normalized) {
    return createOnlyGuidance();
  }
  if (matchesAny(normalized, OPENAI_FORBIDDEN_REQUEST_TERMS)) {
    return createOnlyGuidance();
  }
  if (matchesAny(normalized, OPENAI_CREATE_REQUEST_TERMS) || findRecipeByMessage(message) || findIngredientIdsByMessage(message).length >= 3) {
    return null;
  }
  return createOnlyGuidance();
}

function createOnlyGuidance(): string {
  return "Le codex live est limité à la création de potions : demande une potion connue ou donne exactement trois ingrédients SERVIER.";
}

function findRecipeByMessage(message: string): (typeof RECIPES)[number] | null {
  const normalized = normalize(message);
  return RECIPES.find((recipe) => normalized.includes(normalize(recipe.id)) || normalized.includes(normalize(recipe.name))) ?? null;
}

function findRecipeByNameOrId(recipeName: string): (typeof RECIPES)[number] | null {
  const normalized = normalize(recipeName);
  return RECIPES.find((recipe) => normalize(recipe.id) === normalized || normalize(recipe.name) === normalized || normalize(recipe.name).includes(normalized)) ?? null;
}

function findIngredientIdsByMessage(message: string): readonly string[] {
  const normalized = normalize(message);
  return INGREDIENTS.filter((ingredient) => normalized.includes(normalize(ingredient.id)) || normalized.includes(normalize(ingredient.name))).map((ingredient) => ingredient.id);
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

const OPENAI_CREATE_REQUEST_TERMS = [
  "prepare",
  "preparer",
  "cree",
  "creer",
  "creation",
  "fabrique",
  "fabriquer",
  "compose",
  "composer",
  "distille",
  "distiller",
  "concocte",
  "concocter",
  "valide",
  "valider",
  "combine",
  "combiner",
  "brew",
  "make",
  "create",
  "craft"
] as const;

const OPENAI_FORBIDDEN_REQUEST_TERMS = [
  "inventaire",
  "inventory",
  "stock",
  "liste",
  "lister",
  "affiche",
  "afficher",
  "montre",
  "montrer",
  "show",
  "list",
  "history",
  "historique",
  "registre",
  "suggest",
  "suggestion",
  "aide",
  "help",
  "architecture",
  "prisma",
  "sql",
  "mcp",
  "api",
  "recharge",
  "randomize",
  "randomise"
] as const;

function isOpenAiFunctionCall(value: unknown): value is ResponseFunctionToolCall {
  return Boolean(
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "function_call" &&
    "name" in value &&
    typeof value.name === "string" &&
    "arguments" in value &&
    typeof value.arguments === "string"
  );
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI tool arguments must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function readLastUserText(messages: readonly UIMessage[]): string {
  const userMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!userMessage) {
    return "";
  }
  return userMessage.parts
    .filter((part): part is { readonly type: "text"; readonly text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function writeTextPart(
  write: (chunk: UIMessageChunk) => void,
  text: string
): void {
  const id = "codex-text";
  write({ type: "text-start", id });
  write({ type: "text-delta", id, delta: text });
  write({ type: "text-end", id });
}
