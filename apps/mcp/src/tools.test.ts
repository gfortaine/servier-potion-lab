import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventory,
  PotionLabApplication
} from "@servier-potion-lab/domain";
import type {
  InventoryItem,
  InventoryRepository,
  Potion,
  PotionRepository
} from "@servier-potion-lab/domain";
import { PotionToolService } from "@servier-potion-lab/potion-tools";
import { createPotionMcpToolHandlers } from "./tools.js";

test("MCP create_potion tool mutates potion history and inventory through application service", async () => {
  const repository = new InMemoryPotionRepository();
  const handlers = createPotionMcpToolHandlers(
    new PotionToolService(new PotionLabApplication(repository, repository))
  );

  const result = await handlers.createPotion({ recipeName: "Potion d'invisibilité" });

  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.stateChanged, true);
  assert.equal(repository.potions.length, 1);
  assert.equal(repository.inventory.find((item) => item.ingredientId === "noix-de-coco")?.quantity, 2);
});

test("MCP create_potion tool returns structured errors for invalid input", async () => {
  const repository = new InMemoryPotionRepository();
  const handlers = createPotionMcpToolHandlers(
    new PotionToolService(new PotionLabApplication(repository, repository))
  );

  const result = await handlers.createPotion({});

  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.stateChanged, false);
  const firstContent = result.content[0];
  assert.equal(firstContent?.type, "text");
  assert.match(firstContent.text, /recipeName/);
});

class InMemoryPotionRepository implements InventoryRepository, PotionRepository {
  inventory: InventoryItem[];
  readonly potions: Potion[] = [];

  constructor(defaultQuantity = 3) {
    this.inventory = [...createInventory({}, defaultQuantity)];
  }

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
