import { PrismaClient } from "@prisma/client";
import { createInventory, INGREDIENTS, RECIPES } from "@servier-potion-lab/domain";
import type {
  IngredientId,
  InventoryItem,
  Potion,
  RecipeId
} from "@servier-potion-lab/domain";

export interface DatabaseSettings {
  readonly databaseUrl: string;
}

interface PrismaOperationClient {
  readonly ingredient: {
    upsert(args: {
      readonly where: { readonly id: string };
      readonly update: { readonly name: string };
      readonly create: { readonly id: string; readonly name: string };
    }): Promise<unknown>;
  };
  readonly recipe: {
    upsert(args: {
      readonly where: { readonly id: string };
      readonly update: {
        readonly name: string;
        readonly ingredientIds: string[];
      };
      readonly create: {
        readonly id: string;
        readonly name: string;
        readonly ingredientIds: string[];
      };
    }): Promise<unknown>;
  };
  readonly inventoryItem: {
    upsert(args: {
      readonly where: { readonly ingredientId: string };
      readonly update: { readonly quantity: number };
      readonly create: { readonly ingredientId: string; readonly quantity: number };
    }): Promise<unknown>;
    update(args: {
      readonly where: { readonly ingredientId: string };
      readonly data: {
        readonly quantity: number | { readonly increment: number };
      };
    }): Promise<{ readonly ingredientId: string; readonly quantity: number }>;
    findMany(args: {
      readonly orderBy: { readonly ingredientId: "asc" };
    }): Promise<readonly { readonly ingredientId: string; readonly quantity: number }[]>;
    updateMany(args: {
      readonly where: {
        readonly ingredientId: string;
        readonly quantity?: { readonly gte: number };
      };
      readonly data: { readonly quantity: { readonly decrement: number } };
    }): Promise<{ readonly count: number }>;
  };
  readonly potion: {
    create(args: {
      readonly data: {
        readonly id: string;
        readonly recipeId: string;
        readonly name: string;
        readonly ingredientIds: string[];
        readonly createdAt: Date;
      };
    }): Promise<unknown>;
    deleteMany(): Promise<unknown>;
    findMany(args: {
      readonly orderBy: { readonly createdAt: "desc" };
    }): Promise<
      readonly {
        readonly id: string;
        readonly recipeId: string;
        readonly name: string;
        readonly ingredientIds: string[];
        readonly createdAt: Date;
      }[]
    >;
  };
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  $transaction<T>(operation: (tx: PrismaTransactionClient) => Promise<T>): Promise<T>;
}

type PrismaTransactionClient = Omit<PrismaOperationClient, "$transaction">;

export function readDatabaseSettings(
  env: NodeJS.ProcessEnv = process.env
): DatabaseSettings {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Run `pnpm dev` for a Docker-backed local stack or set DATABASE_URL before starting the API."
    );
  }

  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }

  return { databaseUrl };
}

export function createPrismaClient(
  settings: DatabaseSettings = readDatabaseSettings()
): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: settings.databaseUrl
      }
    }
  });
}

export class PrismaPotionRepository {
  constructor(private readonly prisma: PrismaOperationClient) {}

  async seedCatalog(): Promise<void> {
    await this.prisma.$transaction([
      ...INGREDIENTS.map((ingredient) =>
        this.prisma.ingredient.upsert({
          where: { id: ingredient.id },
          update: { name: ingredient.name },
          create: { id: ingredient.id, name: ingredient.name }
        })
      ),
      ...RECIPES.map((recipe) =>
        this.prisma.recipe.upsert({
          where: { id: recipe.id },
          update: {
            name: recipe.name,
            ingredientIds: [...recipe.ingredientIds]
          },
          create: {
            id: recipe.id,
            name: recipe.name,
            ingredientIds: [...recipe.ingredientIds]
          }
        })
      )
    ]);
  }

  async clearPotions(): Promise<void> {
    await this.prisma.potion.deleteMany();
  }

  async replaceInventory(inventory: readonly InventoryItem[]): Promise<void> {
    await this.prisma.$transaction(
      inventory.map((item) =>
        this.prisma.inventoryItem.upsert({
          where: { ingredientId: item.ingredientId },
          update: { quantity: item.quantity },
          create: {
            ingredientId: item.ingredientId,
            quantity: item.quantity
          }
        })
      )
    );
  }

  async setInventoryQuantity(
    ingredientId: IngredientId,
    quantity: number
  ): Promise<InventoryItem> {
    const row = await this.prisma.inventoryItem.update({
      where: { ingredientId },
      data: { quantity }
    });

    return {
      ingredientId: toIngredientId(row.ingredientId),
      quantity: row.quantity
    };
  }

  async rechargeIngredient(
    ingredientId: IngredientId,
    amount: number
  ): Promise<InventoryItem> {
    const row = await this.prisma.inventoryItem.update({
      where: { ingredientId },
      data: { quantity: { increment: amount } }
    });

    return {
      ingredientId: toIngredientId(row.ingredientId),
      quantity: row.quantity
    };
  }

  async resetLab(defaultQuantity = 3): Promise<void> {
    await this.seedCatalog();
    await this.clearPotions();
    await this.replaceInventory(createInventory({}, defaultQuantity));
  }

  async listInventory(): Promise<readonly InventoryItem[]> {
    const rows = await this.prisma.inventoryItem.findMany({
      orderBy: { ingredientId: "asc" }
    });

    return rows.map((row) => ({
      ingredientId: toIngredientId(row.ingredientId),
      quantity: row.quantity
    }));
  }

  async recordPotion(potion: Potion): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const ingredientId of potion.ingredientIds) {
          const update = await tx.inventoryItem.updateMany({
            where: {
              ingredientId,
              quantity: { gte: 1 }
            },
            data: {
              quantity: { decrement: 1 }
            }
          });

          if (update.count !== 1) {
            throw new InsufficientInventoryForPotionError();
          }
        }

        await tx.potion.create({
          data: {
            id: potion.id,
            recipeId: potion.recipeId,
            name: potion.name,
            ingredientIds: [...potion.ingredientIds],
            createdAt: potion.createdAt
          }
        });
      });
      return true;
    } catch (error) {
      if (error instanceof InsufficientInventoryForPotionError) {
        return false;
      }
      throw error;
    }
  }

  async insertPotion(potion: Potion): Promise<void> {
    await this.prisma.potion.create({
      data: {
        id: potion.id,
        recipeId: potion.recipeId,
        name: potion.name,
        ingredientIds: [...potion.ingredientIds],
        createdAt: potion.createdAt
      }
    });
  }

  async listPotions(): Promise<readonly Potion[]> {
    const rows = await this.prisma.potion.findMany({
      orderBy: { createdAt: "desc" }
    });

    return rows.map((row) => ({
      id: row.id,
      recipeId: toRecipeId(row.recipeId),
      name: row.name,
      ingredientIds: toIngredientTuple(row.ingredientIds),
      createdAt: row.createdAt
    }));
  }

}

class InsufficientInventoryForPotionError extends Error {
  constructor() {
    super("Inventory does not contain enough stock for the selected potion.");
    this.name = "InsufficientInventoryForPotionError";
  }
}

function toIngredientId(value: string): IngredientId {
  if (INGREDIENTS.some((ingredient) => ingredient.id === value)) {
    return value as IngredientId;
  }

  throw new Error(`Persisted row references unknown ingredient ${value}.`);
}

function toRecipeId(value: string): RecipeId {
  if (RECIPES.some((recipe) => recipe.id === value)) {
    return value as RecipeId;
  }

  throw new Error(`Persisted row references unknown recipe ${value}.`);
}

function toIngredientTuple(
  ingredientIds: readonly string[]
): readonly [IngredientId, IngredientId, IngredientId] {
  if (ingredientIds.length !== 3) {
    throw new Error("Persisted potion rows must contain exactly three ingredients.");
  }

  const [first, second, third] = ingredientIds.map(toIngredientId);
  if (!first || !second || !third) {
    throw new Error("Persisted potion row contains an empty ingredient slot.");
  }

  return [first, second, third];
}
