import { test } from "node:test";
import assert from "node:assert/strict";
import { createInventory, difa_createPotionFromInventory } from "@servier-potion-lab/domain";
import { PrismaPotionRepository, readDatabaseSettings } from "./index.js";

interface RecordedOperation {
  readonly model: string;
  readonly action: string;
  readonly where?: unknown;
}

class RecordingPrisma {
  readonly operations: RecordedOperation[] = [];
  inventoryRows: readonly { readonly ingredientId: "argent"; readonly quantity: number }[] = [];
  potionRows: readonly {
    readonly id: string;
    readonly recipeId: "invisibilite";
    readonly name: string;
    readonly ingredientIds: string[];
    readonly createdAt: Date;
  }[] = [];

  readonly ingredient = {
    upsert: async (args: { readonly where: unknown }): Promise<unknown> => {
      this.operations.push({ model: "ingredient", action: "upsert", where: args.where });
      return {};
    }
  };

  readonly recipe = {
    upsert: async (args: { readonly where: unknown }): Promise<unknown> => {
      this.operations.push({ model: "recipe", action: "upsert", where: args.where });
      return {};
    }
  };

  readonly inventoryItem = {
    upsert: async (args: { readonly where: unknown }): Promise<unknown> => {
      this.operations.push({ model: "inventoryItem", action: "upsert", where: args.where });
      return {};
    },
    update: async (args: {
      readonly where: { readonly ingredientId: "argent" };
      readonly data: { readonly quantity: number | { readonly increment: number } };
    }): Promise<{ readonly ingredientId: "argent"; readonly quantity: number }> => {
      this.operations.push({ model: "inventoryItem", action: "update", where: args.where });
      const currentQuantity =
        this.inventoryRows.find((row) => row.ingredientId === args.where.ingredientId)?.quantity ?? 0;
      const nextQuantity =
        typeof args.data.quantity === "number"
          ? args.data.quantity
          : currentQuantity + args.data.quantity.increment;
      this.inventoryRows = [{ ingredientId: args.where.ingredientId, quantity: nextQuantity }];
      return this.inventoryRows[0]!;
    },
    findMany: async (): Promise<typeof this.inventoryRows> => {
      this.operations.push({ model: "inventoryItem", action: "findMany" });
      return this.inventoryRows;
    },
    updateMany: async (args: { readonly where: unknown }): Promise<{ readonly count: number }> => {
      this.operations.push({ model: "inventoryItem", action: "updateMany", where: args.where });
      return { count: 1 };
    }
  };

  readonly potion = {
    create: async (args: { readonly data: unknown }): Promise<unknown> => {
      this.operations.push({ model: "potion", action: "create", where: args.data });
      return {};
    },
    deleteMany: async (): Promise<unknown> => {
      this.operations.push({ model: "potion", action: "deleteMany" });
      return {};
    },
    findMany: async (): Promise<typeof this.potionRows> => {
      this.operations.push({ model: "potion", action: "findMany" });
      return this.potionRows;
    }
  };

  async $transaction<T>(
    operation: readonly Promise<T>[] | ((tx: this) => Promise<T>)
  ): Promise<T | T[]> {
    this.operations.push({ model: "transaction", action: "begin" });
    if (typeof operation === "function") {
      return await operation(this);
    }

    return await Promise.all(operation);
  }
}

test("readDatabaseSettings requires a PostgreSQL URL", () => {
  assert.deepEqual(
    readDatabaseSettings({
      DATABASE_URL: "postgresql://servier:servier@localhost:5432/servier"
    }),
    {
      databaseUrl: "postgresql://servier:servier@localhost:5432/servier"
    }
  );
  assert.throws(
    () => readDatabaseSettings({ DATABASE_URL: "sqlite://local.db" }),
    /PostgreSQL/
  );
});

test("seedCatalog upserts all ingredients and recipes through Prisma", async () => {
  const prisma = new RecordingPrisma();
  const repository = new PrismaPotionRepository(prisma);

  await repository.seedCatalog();

  assert.equal(
    prisma.operations.filter((operation) => operation.model === "ingredient").length,
    14
  );
  assert.equal(
    prisma.operations.filter((operation) => operation.model === "recipe").length,
    9
  );
});

test("replaceInventory and listInventory map Prisma rows", async () => {
  const prisma = new RecordingPrisma();
  prisma.inventoryRows = [{ ingredientId: "argent", quantity: 7 }];
  const repository = new PrismaPotionRepository(prisma);

  await repository.replaceInventory(createInventory({ argent: 7 }, 0));
  const inventory = await repository.listInventory();

  assert.equal(prisma.operations[0]?.model, "inventoryItem");
  assert.deepEqual(inventory, [{ ingredientId: "argent", quantity: 7 }]);
});

test("single-item inventory commands use targeted Prisma updates", async () => {
  const prisma = new RecordingPrisma();
  prisma.inventoryRows = [{ ingredientId: "argent", quantity: 2 }];
  const repository = new PrismaPotionRepository(prisma);

  const set = await repository.setInventoryQuantity("argent", 4);
  const recharged = await repository.rechargeIngredient("argent", 2);

  assert.deepEqual(set, { ingredientId: "argent", quantity: 4 });
  assert.deepEqual(recharged, { ingredientId: "argent", quantity: 6 });
  assert.deepEqual(
    prisma.operations
      .filter((operation) => operation.model === "inventoryItem")
      .map((operation) => operation.action),
    ["update", "update"]
  );
});

test("insertPotion and listPotions persist created potion shape", async () => {
  const prisma = new RecordingPrisma();
  const repository = new PrismaPotionRepository(prisma);
  const created = difa_createPotionFromInventory(
    ["noix-de-coco", "yttrium", "mandragore"],
    createInventory({}, 2),
    {
      potionId: "00000000-0000-4000-8000-000000000001",
      createdAt: new Date("2026-06-20T12:00:00.000Z")
    }
  );

  assert.equal(created.ok, true);
  await repository.insertPotion(created.potion);
  prisma.potionRows = [
    {
      id: created.potion.id,
      recipeId: "invisibilite",
      name: created.potion.name,
      ingredientIds: ["noix-de-coco", "yttrium", "mandragore"],
      createdAt: new Date("2026-06-20T12:00:00.000Z")
    }
  ];

  const potions = await repository.listPotions();

  assert.equal(prisma.operations[0]?.model, "potion");
  assert.equal(potions[0]?.recipeId, "invisibilite");
  assert.deepEqual(potions[0]?.ingredientIds, [
    "noix-de-coco",
    "yttrium",
    "mandragore"
  ]);
});

test("recordPotion decrements only consumed ingredients and inserts the potion atomically", async () => {
  const prisma = new RecordingPrisma();
  const repository = new PrismaPotionRepository(prisma);
  const created = difa_createPotionFromInventory(
    ["noix-de-coco", "yttrium", "mandragore"],
    createInventory({}, 2),
    {
      potionId: "00000000-0000-4000-8000-000000000002",
      createdAt: new Date("2026-06-20T12:00:00.000Z")
    }
  );

  assert.equal(created.ok, true);
  const recorded = await repository.recordPotion(created.potion);

  assert.equal(recorded, true);
  assert.equal(prisma.operations[0]?.model, "transaction");
  assert.deepEqual(
    prisma.operations
      .filter((operation) => operation.model === "inventoryItem" && operation.action === "updateMany")
      .map((operation) => operation.where),
    [
      { ingredientId: "noix-de-coco", quantity: { gte: 1 } },
      { ingredientId: "yttrium", quantity: { gte: 1 } },
      { ingredientId: "mandragore", quantity: { gte: 1 } }
    ]
  );
  assert.equal(
    prisma.operations.some((operation) => operation.model === "potion" && operation.action === "create"),
    true
  );
});
