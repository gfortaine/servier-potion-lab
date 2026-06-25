import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { createInventory, PotionLabApplication } from "@servier-potion-lab/domain";
import type { InventoryItem, InventoryRepository, Potion, PotionRepository } from "@servier-potion-lab/domain";
import { PotionToolService } from "@servier-potion-lab/potion-tools";
import { CodexChatService, getStrictCreatePotionToolInputSchema, readOpenAiCodexConfig } from "./codex-chat.service.js";
import type { CodexPlanner } from "./codex-chat.service.js";

test("executes a fake live OpenAI plan through the application path", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  delete process.env.SERVIER_CODEX_PROVIDER;
  const repository = new InMemoryPotionRepository();
  const planner: CodexPlanner = {
    plan: async () => ({ name: "create_potion", mode: "recipe", recipeName: "invisibilite" })
  };
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)), planner);

  try {
    const result = await service.answer("Prépare une potion d'invisibilité", "fr");
    assert.equal(result.intent, "create_potion");
    assert.equal(result.liveProviderUsed, true);
    assert.equal(result.toolCalls[0]?.status, "success");
    assert.equal(repository.potions.length, 1);
    assert.equal(repository.inventory.find((item) => item.ingredientId === "noix-de-coco")?.quantity, 2);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("rejects unsafe live provider plans without mutating state", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  delete process.env.SERVIER_CODEX_PROVIDER;
  const repository = new InMemoryPotionRepository();
  const planner: CodexPlanner = {
    plan: async () => ({ name: "randomize_inventory" })
  };
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)), planner);

  try {
    const result = await service.answer("Prépare une potion d'invisibilité", "fr");
    assert.equal(result.intent, "codex_plan");
    assert.equal(result.liveProviderUsed, false);
    assert.equal(result.toolCalls[0]?.status, "error");
    assert.equal(repository.inventory.every((item) => item.quantity === 3), true);
    assert.equal(repository.potions.length, 0);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("blocks inventory-only live requests before calling the planner", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  process.env.SERVIER_CODEX_PROVIDER = "openai";
  const repository = new InMemoryPotionRepository();
  let plannerCalls = 0;
  const planner: CodexPlanner = {
    plan: async () => {
      plannerCalls += 1;
      return { name: "create_potion", mode: "recipe", recipeName: "invisibilite" };
    }
  };
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)), planner);

  try {
    const result = await service.answer("Montre l'inventaire du laboratoire", "fr");
    assert.equal(result.intent, "codex_plan");
    assert.equal(result.liveProviderUsed, false);
    assert.equal(result.toolCalls[0]?.status, "error");
    assert.equal(plannerCalls, 0);
    assert.equal(repository.potions.length, 0);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("rejects live create plans with unknown ingredient IDs", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  process.env.SERVIER_CODEX_PROVIDER = "openai";
  const repository = new InMemoryPotionRepository();
  const planner: CodexPlanner = {
    plan: async () => ({
      name: "create_potion",
      mode: "ingredients",
      ingredientIds: ["noix-de-coco", "yttrium", "poudre-de-dragon"]
    })
  };
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)), planner);

  try {
    const result = await service.answer("Prépare une potion avec trois ingrédients", "fr");
    assert.equal(result.intent, "codex_plan");
    assert.equal(result.liveProviderUsed, false);
    assert.equal(result.toolCalls[0]?.status, "error");
    assert.match(result.toolCalls[0]?.message ?? "", /Unknown Codex ingredient IDs/);
    assert.equal(repository.potions.length, 0);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("rejects live create plans that mix recipeName and ingredientIds", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  process.env.SERVIER_CODEX_PROVIDER = "openai";
  const repository = new InMemoryPotionRepository();
  const planner: CodexPlanner = {
    plan: async () => ({
      name: "create_potion",
      mode: "recipe",
      recipeName: "invisibilite",
      ingredientIds: ["noix-de-coco", "yttrium", "mandragore"]
    })
  };
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)), planner);

  try {
    const result = await service.answer("Prépare une potion d'invisibilité", "fr");
    assert.equal(result.intent, "codex_plan");
    assert.equal(result.liveProviderUsed, false);
    assert.equal(result.toolCalls[0]?.status, "error");
    assert.match(result.toolCalls[0]?.message ?? "", /not both/);
    assert.equal(repository.potions.length, 0);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("rejects live create plans without create arguments", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  process.env.SERVIER_CODEX_PROVIDER = "openai";
  const repository = new InMemoryPotionRepository();
  const planner: CodexPlanner = {
    plan: async () => ({ name: "create_potion", mode: "recipe" })
  };
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)), planner);

  try {
    const result = await service.answer("Prépare une potion d'invisibilité", "fr");
    assert.equal(result.intent, "codex_plan");
    assert.equal(result.liveProviderUsed, false);
    assert.equal(result.toolCalls[0]?.status, "error");
    assert.match(result.toolCalls[0]?.message ?? "", /requires recipeName/);
    assert.equal(repository.potions.length, 0);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("fails explicitly when default real-model runtime has no credentials", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  const previousApiKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  delete process.env.SERVIER_CODEX_PROVIDER;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  const repository = new InMemoryPotionRepository();
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)));

  try {
    await assert.rejects(service.answer("Prépare une potion d'invisibilité", "fr"), ServiceUnavailableException);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
    restoreEnv("OPENAI_API_KEY", previousApiKey);
    restoreEnv("OPENAI_MODEL", previousModel);
  }
});

test("allows explicit local route only when requested", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  process.env.SERVIER_CODEX_PROVIDER = "local";
  const repository = new InMemoryPotionRepository();
  const service = new CodexChatService(new PotionToolService(new PotionLabApplication(repository, repository)));

  try {
    const result = await service.answer("Prépare une potion d'invisibilité", "fr");
    assert.equal(result.intent, "create_potion");
    assert.equal(result.liveProviderUsed, false);
    assert.equal(repository.potions.length, 1);
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("uses OPENAI_MODEL as the live-model configuration", () => {
  const config = readOpenAiCodexConfig({
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_MODEL: "gpt-5.5"
  });

  assert.equal(config.apiKey, "test-openai-key");
  assert.equal(config.model, "gpt-5.5");
});

test("exposes an OpenAI strict-compatible create_potion tool schema", () => {
  const schema = getStrictCreatePotionToolInputSchema() as {
    readonly additionalProperties?: boolean;
    readonly required?: readonly string[];
    readonly properties?: {
      readonly recipeName?: { readonly type?: readonly string[] };
      readonly ingredientIds?: { readonly type?: readonly string[] };
    };
  };

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["mode", "recipeName", "ingredientIds"]);
  assert.deepEqual(schema.properties?.recipeName?.type, ["string", "null"]);
  assert.deepEqual(schema.properties?.ingredientIds?.type, ["array", "null"]);
});

test("requires an OpenAI API key and model", () => {
  assert.throws(
    () => readOpenAiCodexConfig({ OPENAI_MODEL: "gpt-5.5" }),
    ServiceUnavailableException
  );
  assert.throws(
    () => readOpenAiCodexConfig({ OPENAI_API_KEY: "test-openai-key", OPENAI_MODEL: "" }),
    ServiceUnavailableException
  );
});

class InMemoryPotionRepository implements InventoryRepository, PotionRepository {
  inventory: InventoryItem[] = [...createInventory({}, 3)];
  readonly potions: Potion[] = [];

  async listInventory(): Promise<readonly InventoryItem[]> {
    return this.inventory;
  }

  async replaceInventory(inventory: readonly InventoryItem[]): Promise<void> {
    this.inventory = [...inventory];
  }

  async setInventoryQuantity(ingredientId: InventoryItem["ingredientId"], quantity: number): Promise<InventoryItem> {
    const nextItem = { ingredientId, quantity };
    this.inventory = this.inventory.map((item) => item.ingredientId === ingredientId ? nextItem : item);
    return nextItem;
  }

  async rechargeIngredient(ingredientId: InventoryItem["ingredientId"], amount: number): Promise<InventoryItem> {
    const current = this.inventory.find((item) => item.ingredientId === ingredientId);
    return await this.setInventoryQuantity(ingredientId, (current?.quantity ?? 0) + amount);
  }

  async listPotions(): Promise<readonly Potion[]> {
    return this.potions;
  }

  async recordPotion(potion: Potion): Promise<boolean> {
    if (potion.ingredientIds.some((ingredientId) => (this.inventory.find((item) => item.ingredientId === ingredientId)?.quantity ?? 0) < 1)) {
      return false;
    }
    for (const ingredientId of potion.ingredientIds) {
      const current = this.inventory.find((item) => item.ingredientId === ingredientId);
      await this.setInventoryQuantity(ingredientId, (current?.quantity ?? 0) - 1);
    }
    this.potions.unshift(potion);
    return true;
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
