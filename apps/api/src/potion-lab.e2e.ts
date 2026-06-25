import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  createPrismaClient,
  PrismaPotionRepository
} from "@servier-potion-lab/db";
import { AppModule } from "./app.module.js";
import { configureOpenApi } from "./openapi.js";
import { configureValidation } from "./validation.js";

const RECIPES = [
  {
    id: "invisibilite",
    ingredients: ["noix-de-coco", "yttrium", "mandragore"]
  },
  {
    id: "amour",
    ingredients: ["bave-de-lama", "plume-de-griffon", "helium-liquide"]
  },
  {
    id: "jeunesse",
    ingredients: ["or", "crin-de-licorne", "azote-liquide"]
  },
  {
    id: "immortalite",
    ingredients: ["poil-de-yeti", "jus-de-horglup", "argent"]
  },
  {
    id: "clairvoyance",
    ingredients: ["epine-de-herisson", "jus-de-horglup", "noix-de-coco"]
  },
  {
    id: "force",
    ingredients: ["poil-de-yeti", "or", "argent"]
  },
  {
    id: "vitesse",
    ingredients: ["helium-liquide", "plume-de-griffon", "azote-liquide"]
  },
  {
    id: "guerison",
    ingredients: ["crin-de-licorne", "mandragore", "bave-de-lama"]
  },
  {
    id: "transformation",
    ingredients: ["queue-d-ecureuil", "yttrium", "epine-de-herisson"]
  }
] as const;

let prisma: ReturnType<typeof createPrismaClient>;
let repository: PrismaPotionRepository;

before(() => {
  execFileSync("pnpm", ["--filter", "@servier-potion-lab/db", "db:migrate"], {
    stdio: "inherit",
    env: process.env
  });
});

beforeEach(async () => {
  prisma ??= createPrismaClient();
  repository ??= new PrismaPotionRepository(prisma);
  await repository.resetLab();
});

after(async () => {
  await prisma?.$disconnect();
});

test("NestJS API exposes OpenAPI and PostgreSQL-backed lab state", async () => {
  await withApp(async (app) => {
    const server = app.getHttpServer();

    await request(server).get("/health").expect(200).expect({
      status: "ok",
      service: "servier-potion-lab-api"
    });

    const inventory = await request(server).get("/inventory").expect(200);
    assert.equal(inventory.body.length, 14);
    assert.equal(inventory.body.every((item: InventoryResponse) => item.quantity === 3), true);

    const recipes = await request(server).get("/recipes").expect(200);
    assert.equal(recipes.body.length, 9);

    const openApi = await request(server).get("/docs-json").expect(200);
    assert.equal(openApi.body.info.title, "SERVIER Potion Lab API");
    assert.ok(openApi.body.paths["/potions"]);
    assert.equal(openApi.body.paths["/potions"].post.responses["201"].description, "The created potion.");
    assert.ok(openApi.body.paths["/assistant/chat"]);
    assert.ok(openApi.body.paths["/assistant/chat/stream"]);
    assert.equal(
      openApi.body.paths["/assistant/chat"].post.responses["200"].description,
      "A structured create_potion tool-backed chat response."
    );
    assert.ok(openApi.body.components.schemas.PotionDto);
    assert.ok(openApi.body.components.schemas.AssistantChatRequestDto);
    assert.ok(openApi.body.components.schemas.AssistantChatStreamRequestDto);
    assert.ok(openApi.body.components.schemas.AssistantChatResponseDto);
    assert.ok(openApi.body.components.schemas.AssistantToolCallDto);
    assert.ok(openApi.body.servers.some((server: { readonly url: string }) => server.url === "http://localhost:3001"));
  });
});

test("NestJS API creates all 9 SERVIER recipes through PostgreSQL", async () => {
  await withApp(async (app) => {
    const server = app.getHttpServer();

    for (const recipe of RECIPES) {
      const response = await request(server)
        .post("/potions")
        .send({ ingredientIds: recipe.ingredients })
        .expect(201);

      assert.equal(response.body.recipeId, recipe.id);
    }

    const potions = await request(server).get("/potions").expect(200);
    assert.equal(potions.body.length, 9);

    const recipes = await request(server).get("/recipes").expect(200);
    assert.equal(recipes.body.every((recipe: RecipeResponse) => recipe.discovered), true);

    const inventory = await request(server).get("/inventory").expect(200);
    assert.equal(
      inventory.body.find((item: InventoryResponse) => item.ingredientId === "mandragore")
        ?.quantity,
      1
    );
  });
});

test("NestJS API rejects invalid recipe and insufficient stock paths", async () => {
  await withApp(async (app) => {
    const server = app.getHttpServer();

    await request(server)
      .post("/potions")
      .send({ ingredientIds: ["argent", "or", "bave-de-lama"] })
      .expect(400);

    await request(server).put("/inventory/noix-de-coco").send({ quantity: 0 }).expect(200);

    await request(server)
      .post("/potions")
      .send({ ingredientIds: ["noix-de-coco", "yttrium", "mandragore"] })
      .expect(400);
  });
});

test("NestJS API rejects invalid request bodies at the HTTP boundary", async () => {
  await withApp(async (app) => {
    const server = app.getHttpServer();

    await request(server)
      .put("/inventory/argent")
      .send({ quantity: -1 })
      .expect(400);

    await request(server)
      .put("/inventory/argent")
      .send({ quantity: 1, unexpected: true })
      .expect(400);

    await request(server)
      .post("/potions")
      .send({ ingredientIds: ["argent", "or"] })
      .expect(400);

    await request(server)
      .post("/potions")
      .send({ ingredientIds: ["argent", "or", 42] })
      .expect(400);
  });
});

test("NestJS API manages inventory set, recharge, and randomize bounds", async () => {
  await withApp(async (app) => {
    const server = app.getHttpServer();

    const set = await request(server).put("/inventory/argent").send({ quantity: 4 }).expect(200);
    assert.equal(set.body.quantity, 4);

    const recharged = await request(server)
      .post("/inventory/argent/recharge")
      .send({ amount: 2 })
      .expect(200);
    assert.equal(recharged.body.quantity, 6);

    const randomized = await request(server)
      .post("/inventory/randomize")
      .send({ minimum: 2, maximum: 2 })
      .expect(200);
    assert.equal(randomized.body.length, 14);
    assert.equal(randomized.body.every((item: InventoryResponse) => item.quantity === 2), true);
  });
});

test("NestJS API creates potions through the structured assistant chat tools", async () => {
  const previousProvider = process.env.SERVIER_CODEX_PROVIDER;
  process.env.SERVIER_CODEX_PROVIDER = "local";
  try {
    await withApp(async (app) => {
      const server = app.getHttpServer();

      const chat = await request(server)
        .post("/assistant/chat")
        .send({ message: "Prépare une potion d'invisibilité" })
        .expect(200);

      assert.equal(chat.body.intent, "create_potion");
      assert.equal(chat.body.liveProviderUsed, false);
      assert.equal(chat.body.toolCalls[0].name, "create_potion");
      assert.equal(chat.body.toolCalls[0].status, "success");
      assert.equal(chat.body.toolCalls[0].stateChanged, true);
      assert.equal(chat.body.toolCalls[0].data.potion.recipeId, "invisibilite");

      const potions = await request(server).get("/potions").expect(200);
      assert.equal(potions.body.length, 1);
      assert.equal(potions.body[0].recipeId, "invisibilite");

      const inventory = await request(server).get("/inventory").expect(200);
      assert.equal(
        inventory.body.find((item: InventoryResponse) => item.ingredientId === "noix-de-coco")
          ?.quantity,
        2
      );
    });
  } finally {
    restoreEnv("SERVIER_CODEX_PROVIDER", previousProvider);
  }
});

test("NestJS API rejects invalid assistant chat requests", async () => {
  await withApp(async (app) => {
    await request(app.getHttpServer()).post("/assistant/chat").send({ message: "" }).expect(400);
  });
});

test("NestJS API records potion creation atomically under concurrent requests", async () => {
  await withApp(async (app) => {
    const server = app.getHttpServer();
    const forceIngredients = ["poil-de-yeti", "or", "argent"] as const;

    for (const ingredientId of forceIngredients) {
      await request(server).put(`/inventory/${ingredientId}`).send({ quantity: 1 }).expect(200);
    }

    const attempts = await Promise.all(
      [0, 1, 2, 3].map(() =>
        request(server).post("/potions").send({ ingredientIds: forceIngredients })
      )
    );
    const successes = attempts.filter((response) => response.status === 201);
    const stockFailures = attempts.filter((response) => response.status === 400);

    assert.equal(successes.length, 1);
    assert.equal(stockFailures.length, 3);

    const potions = await request(server).get("/potions").expect(200);
    assert.equal(potions.body.length, 1);

    const inventory = await request(server).get("/inventory").expect(200);
    for (const ingredientId of forceIngredients) {
      assert.equal(
        inventory.body.find((item: InventoryResponse) => item.ingredientId === ingredientId)
          ?.quantity,
        0
      );
    }
  });
});

async function withApp(run: (app: INestApplication) => Promise<void>): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  try {
    configureValidation(app);
    configureOpenApi(app);
    await app.init();
    await run(app);
  } finally {
    await app.close();
  }
}

interface InventoryResponse {
  readonly ingredientId: string;
  readonly quantity: number;
}

interface RecipeResponse {
  readonly discovered: boolean;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
