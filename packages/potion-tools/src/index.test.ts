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
import { PotionToolService } from "./index.js";

test("creates a potion by recipe chat through the application path", async () => {
  const repository = new InMemoryPotionRepository();
  const service = new PotionToolService(new PotionLabApplication(repository, repository));

  const result = await service.answerChat("Prépare une potion d'invisibilité");

  assert.equal(result.intent, "create_potion");
  assert.equal(result.toolCalls[0]?.status, "success");
  assert.equal(repository.potions.length, 1);
  assert.equal(repository.inventory.find((item) => item.ingredientId === "noix-de-coco")?.quantity, 2);
});

test("returns structured insufficient-stock errors without mutating state", async () => {
  const repository = new InMemoryPotionRepository(0);
  const service = new PotionToolService(new PotionLabApplication(repository, repository));

  const result = await service.createPotionByRecipeName("invisibilite");

  assert.equal(result.status, "error");
  assert.equal(result.stateChanged, false);
  assert.deepEqual(repository.potions, []);
  assert.equal(result.ui.type, "insufficient-stock-card");
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
