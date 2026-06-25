import "reflect-metadata";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  createPrismaClient,
  PrismaPotionRepository
} from "@servier-potion-lab/db";
import { AppModule } from "./app.module.js";
import { loadLocalEnv } from "./local-env.js";
import { configureOpenApi } from "./openapi.js";
import { configureValidation } from "./validation.js";

loadLocalEnv();
assertRuntimeCodexEnv();

execFileSync("pnpm", ["--filter", "@servier-potion-lab/db", "db:migrate"], {
  stdio: "inherit",
  env: process.env
});

const prisma = createPrismaClient();
const repository = new PrismaPotionRepository(prisma);

try {
  await repository.resetLab();
} finally {
  await prisma.$disconnect();
}

await withApp(async (app) => {
  const server = app.getHttpServer();

  const chat = await request(server)
    .post("/assistant/chat")
    .send({ message: "Prépare une potion d'invisibilité", locale: "fr" })
    .expect(200);

  assert.equal(chat.body.liveProviderUsed, true);
  assert.equal(chat.body.intent, "create_potion");
  assert.equal(chat.body.toolCalls[0]?.name, "create_potion");
  assert.equal(chat.body.toolCalls[0]?.status, "success");
  assert.equal(chat.body.toolCalls[0]?.stateChanged, true);
  assert.equal(chat.body.toolCalls[0]?.data?.potion?.recipeId, "invisibilite");

  const potions = await request(server).get("/potions").expect(200);
  assert.equal(potions.body.length, 1);
  assert.equal(potions.body[0]?.recipeId, "invisibilite");

  const inventory = await request(server).get("/inventory").expect(200);
  assert.equal(
    inventory.body.find((item: { readonly ingredientId: string }) => item.ingredientId === "noix-de-coco")
      ?.quantity,
    2
  );
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

function assertRuntimeCodexEnv(): void {
  if (process.env.SERVIER_CODEX_PROVIDER?.toLowerCase() === "local") {
    throw new Error("Codex runtime proof requires real-model routing; unset SERVIER_CODEX_PROVIDER=local.");
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("Codex runtime proof requires OPENAI_API_KEY.");
  }
  if (!process.env.OPENAI_MODEL?.trim()) {
    throw new Error("Codex runtime proof requires OPENAI_MODEL.");
  }
}
