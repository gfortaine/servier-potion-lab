import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PotionToolService } from "@servier-potion-lab/potion-tools";
import type { PotionToolResult } from "@servier-potion-lab/potion-tools";

export interface PotionMcpToolHandlers {
  readonly listIngredients: () => PotionMcpToolResult;
  readonly listInventory: () => Promise<PotionMcpToolResult>;
  readonly listRecipes: () => Promise<PotionMcpToolResult>;
  readonly listPotions: () => Promise<PotionMcpToolResult>;
  readonly createPotion: (args: CreatePotionArgs) => Promise<PotionMcpToolResult>;
  readonly rechargeInventory: (args: RechargeInventoryArgs) => Promise<PotionMcpToolResult>;
  readonly randomizeInventory: (args: RandomizeInventoryArgs) => Promise<PotionMcpToolResult>;
}

export type PotionMcpToolResult = CallToolResult & {
  readonly structuredContent: Record<string, unknown>;
};

interface CreatePotionArgs {
  readonly recipeName?: string | undefined;
  readonly ingredientIds?: readonly string[] | undefined;
}

interface RechargeInventoryArgs {
  readonly ingredientId: string;
  readonly amount?: number | undefined;
}

interface RandomizeInventoryArgs {
  readonly minimum?: number | undefined;
  readonly maximum?: number | undefined;
}

export function createPotionMcpServer(service: PotionToolService): McpServer {
  const server = new McpServer({
    name: "servier-potion-lab",
    version: "0.1.0"
  });

  const handlers = createPotionMcpToolHandlers(service);

  server.registerTool(
    "list_ingredients",
    {
      title: "List SERVIER ingredients",
      description: "Return the 14 canonical SERVIER potion ingredients."
    },
    () => handlers.listIngredients()
  );

  server.registerTool(
    "list_inventory",
    {
      title: "List inventory",
      description: "Return current stock quantities for every ingredient."
    },
    () => handlers.listInventory()
  );

  server.registerTool(
    "list_recipes",
    {
      title: "List recipes",
      description: "Return the 9 canonical recipes and whether each has been discovered."
    },
    () => handlers.listRecipes()
  );

  server.registerTool(
    "list_potions",
    {
      title: "List potions",
      description: "Return the potion ledger."
    },
    () => handlers.listPotions()
  );

  server.registerTool(
    "create_potion",
    {
      title: "Create potion",
      description: "Create a potion by recipe name or exactly three ingredient IDs. Mutates inventory and potion history when successful.",
      inputSchema: {
        recipeName: z.string().min(1).optional(),
        ingredientIds: z.array(z.string().min(1)).min(3).max(3).optional()
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false
      }
    },
    (args) => handlers.createPotion(args)
  );

  server.registerTool(
    "recharge_inventory",
    {
      title: "Recharge inventory",
      description: "Increase one ingredient stock quantity by a non-negative amount.",
      inputSchema: {
        ingredientId: z.string().min(1),
        amount: z.number().int().min(0).optional()
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false
      }
    },
    (args) => handlers.rechargeInventory(args)
  );

  server.registerTool(
    "randomize_inventory",
    {
      title: "Randomize inventory",
      description: "Redistribute inventory quantities between minimum and maximum for replayable lab demos.",
      inputSchema: {
        minimum: z.number().int().min(0).optional(),
        maximum: z.number().int().min(0).optional()
      },
      annotations: {
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false
      }
    },
    (args) => handlers.randomizeInventory(args)
  );

  return server;
}

export function createPotionMcpToolHandlers(service: PotionToolService): PotionMcpToolHandlers {
  return {
    listIngredients: () => toMcpResult(service.listIngredients()),
    listInventory: async () => toMcpResult(await service.listInventory()),
    listRecipes: async () => toMcpResult(await service.listRecipes()),
    listPotions: async () => toMcpResult(await service.listPotions()),
    createPotion: async (args) => {
      if (args.recipeName) {
        return toMcpResult(await service.createPotionByRecipeName(args.recipeName));
      }
      if (args.ingredientIds) {
        return toMcpResult(await service.createPotionByIngredientIds(args.ingredientIds));
      }
      return toMcpResult({
        name: "create_potion",
        status: "error",
        stateChanged: false,
        message: "Provide either recipeName or exactly three ingredientIds.",
        data: {
          code: "CHAT_INTENT_NOT_UNDERSTOOD",
          message: "Provide either recipeName or exactly three ingredientIds.",
          details: ["recipeName", "ingredientIds"]
        },
        ui: { type: "tool-error-card" }
      });
    },
    rechargeInventory: async (args) =>
      toMcpResult(await service.rechargeInventory(args.ingredientId, args.amount ?? 1)),
    randomizeInventory: async (args) =>
      toMcpResult(await service.randomizeInventory(args.minimum ?? 1, args.maximum ?? 5))
  };
}

function toMcpResult(result: PotionToolResult<unknown>): PotionMcpToolResult {
  const structuredContent = {
    ...result,
    protocol: "servier-potion-lab-tool-result"
  };

  return {
    structuredContent,
    isError: result.status === "error",
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent, null, 2)
      }
    ]
  };
}
