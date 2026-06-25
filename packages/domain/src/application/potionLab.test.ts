import { test } from "node:test";
import assert from "node:assert/strict";
import { createInventory, createRandomInventory } from "../domain/inventory.js";
import type { InventoryItem, Potion } from "../domain/types.js";
import {
  PotionLabApplication,
  PotionLabApplicationError,
  type InventoryRepository,
  type PotionRepository
} from "./potionLab.js";

test("PotionLabApplication creates every SERVIER recipe and persists history", async () => {
  const repository = new InMemoryLabRepository(createInventory({}, 3));
  const app = new PotionLabApplication(repository, repository);

  for (const recipe of [
    ["noix-de-coco", "yttrium", "mandragore"],
    ["bave-de-lama", "plume-de-griffon", "helium-liquide"],
    ["or", "crin-de-licorne", "azote-liquide"],
    ["poil-de-yeti", "jus-de-horglup", "argent"],
    ["epine-de-herisson", "jus-de-horglup", "noix-de-coco"],
    ["poil-de-yeti", "or", "argent"],
    ["helium-liquide", "plume-de-griffon", "azote-liquide"],
    ["crin-de-licorne", "mandragore", "bave-de-lama"],
    ["queue-d-ecureuil", "yttrium", "epine-de-herisson"]
  ]) {
    await app.createPotion(recipe);
  }

  const potions = await app.listPotions();
  const recipes = await app.listRecipes();

  assert.equal(potions.length, 9);
  assert.equal(recipes.every((recipe) => recipe.discovered), true);
});

test("PotionLabApplication rejects invalid recipes without changing persisted state", async () => {
  const repository = new InMemoryLabRepository(createInventory({}, 3));
  const app = new PotionLabApplication(repository, repository);

  await assert.rejects(
    () => app.createPotion(["argent", "or", "bave-de-lama"]),
    (error) =>
      error instanceof PotionLabApplicationError &&
      error.error.code === "RECIPE_NOT_FOUND"
  );

  assert.equal((await app.listPotions()).length, 0);
  assert.equal((await app.listInventory()).find((item) => item.ingredientId === "argent")?.quantity, 3);
});

test("PotionLabApplication rejects insufficient stock", async () => {
  const repository = new InMemoryLabRepository(
    createInventory({ "noix-de-coco": 0, yttrium: 1, mandragore: 1 }, 3)
  );
  const app = new PotionLabApplication(repository, repository);

  await assert.rejects(
    () => app.createPotion(["noix-de-coco", "yttrium", "mandragore"]),
    (error) =>
      error instanceof PotionLabApplicationError &&
      error.error.code === "INSUFFICIENT_STOCK"
  );
});

test("PotionLabApplication records a potion through one atomic persistence command", async () => {
  const repository = new InMemoryLabRepository(createInventory({}, 3));
  const app = new PotionLabApplication(repository, repository);

  await app.createPotion(["noix-de-coco", "yttrium", "mandragore"]);

  assert.equal(repository.recordedPotionCount, 1);
  assert.equal(repository.replacedInventoryCount, 0);
  assert.equal((await app.listPotions()).length, 1);
  assert.equal(
    (await app.listInventory()).find((item) => item.ingredientId === "mandragore")?.quantity,
    2
  );
});

test("PotionLabApplication maps atomic persistence stock conflicts to domain errors", async () => {
  const repository = new InMemoryLabRepository(createInventory({}, 3));
  repository.rejectNextRecord = true;
  const app = new PotionLabApplication(repository, repository);

  await assert.rejects(
    () => app.createPotion(["noix-de-coco", "yttrium", "mandragore"]),
    (error) =>
      error instanceof PotionLabApplicationError &&
      error.error.code === "INSUFFICIENT_STOCK"
  );

  assert.equal((await app.listPotions()).length, 0);
  assert.equal(
    (await app.listInventory()).find((item) => item.ingredientId === "mandragore")?.quantity,
    3
  );
});

test("PotionLabApplication updates inventory commands", async () => {
  const repository = new InMemoryLabRepository(createInventory({}, 0));
  const app = new PotionLabApplication(repository, repository);

  await app.setInventoryQuantity("argent", 4);
  const recharged = await app.recharge("argent", 2);
  const randomized = await app.randomizeInventory(1, 1);

  assert.equal(recharged.quantity, 6);
  assert.equal(repository.targetedInventoryUpdateCount, 2);
  assert.equal(repository.replacedInventoryCount, 1);
  assert.equal(randomized.length, 14);
  assert.equal(randomized.every((item) => item.quantity === 1), true);
});

test("createRandomInventory creates bounded quantities for every SERVIER ingredient", () => {
  const inventory = createRandomInventory(2, 4, () => 0.99);

  assert.equal(inventory.length, 14);
  assert.equal(inventory.every((item) => item.quantity >= 2 && item.quantity <= 4), true);
  assert.equal(inventory.every((item) => item.quantity === 4), true);
});

class InMemoryLabRepository implements InventoryRepository, PotionRepository {
  private inventory: readonly InventoryItem[];
  private readonly potions: Potion[] = [];
  recordedPotionCount = 0;
  replacedInventoryCount = 0;
  targetedInventoryUpdateCount = 0;
  rejectNextRecord = false;

  constructor(inventory: readonly InventoryItem[]) {
    this.inventory = inventory;
  }

  async listInventory(): Promise<readonly InventoryItem[]> {
    return this.inventory;
  }

  async replaceInventory(inventory: readonly InventoryItem[]): Promise<void> {
    this.replacedInventoryCount += 1;
    this.inventory = inventory;
  }

  async setInventoryQuantity(
    ingredientId: InventoryItem["ingredientId"],
    quantity: number
  ): Promise<InventoryItem> {
    this.targetedInventoryUpdateCount += 1;
    this.inventory = this.inventory.map((item) =>
      item.ingredientId === ingredientId ? { ...item, quantity } : item
    );
    return this.findInventoryItem(ingredientId);
  }

  async rechargeIngredient(
    ingredientId: InventoryItem["ingredientId"],
    amount: number
  ): Promise<InventoryItem> {
    this.targetedInventoryUpdateCount += 1;
    this.inventory = this.inventory.map((item) =>
      item.ingredientId === ingredientId ? { ...item, quantity: item.quantity + amount } : item
    );
    return this.findInventoryItem(ingredientId);
  }

  async listPotions(): Promise<readonly Potion[]> {
    return [...this.potions].reverse();
  }

  async recordPotion(potion: Potion): Promise<boolean> {
    this.recordedPotionCount += 1;
    if (this.rejectNextRecord) {
      this.rejectNextRecord = false;
      return false;
    }

    const requiredIds = new Set(potion.ingredientIds);
    if (this.inventory.some((item) => requiredIds.has(item.ingredientId) && item.quantity < 1)) {
      return false;
    }

    this.inventory = this.inventory.map((item) =>
      requiredIds.has(item.ingredientId) ? { ...item, quantity: item.quantity - 1 } : item
    );
    this.potions.push(potion);
    return true;
  }

  private findInventoryItem(ingredientId: InventoryItem["ingredientId"]): InventoryItem {
    const item = this.inventory.find((candidate) => candidate.ingredientId === ingredientId);
    assert.ok(item, `expected inventory item ${ingredientId}`);
    return item;
  }
}
