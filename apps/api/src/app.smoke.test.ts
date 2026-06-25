import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { AppController } from "./app.controller.js";
import { AssistantService } from "./assistant.service.js";

test("AppController exposes health and readiness metadata", () => {
  const controller = new AppController();

  assert.deepEqual(controller.health(), {
    status: "ok",
    service: "servier-potion-lab-api"
  });

  test("Vercel Express entrypoint accepts the /api service prefix", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = previousDatabaseUrl ?? "postgresql://servier:servier@127.0.0.1:54322/servier";

    const { default: vercelServer } = await import("./index.js");

    await request(vercelServer)
      .get("/api/health")
      .expect(200)
      .expect({
        status: "ok",
        service: "servier-potion-lab-api"
      });

    restoreEnv("DATABASE_URL", previousDatabaseUrl);
  });
  assert.deepEqual(controller.ready(), {
    status: "ready",
    dependencies: ["domain", "postgresql"]
  });
});

test("LangGraph assistant answers locally when explicitly enabled", async () => {
  const previousEnabled = process.env.SERVIER_ASSISTANT_ENABLED;
  const previousProvider = process.env.SERVIER_AI_PROVIDER;
  process.env.SERVIER_ASSISTANT_ENABLED = "true";
  process.env.SERVIER_AI_PROVIDER = "azure-openai";

  try {
    const assistant = await new AssistantService().answer({
      question: "How does LangGraph route Azure OpenAI for this potion lab?",
      inventorySummary: "Noix de coco, Yttrium, Mandragore are stocked."
    });

    assert.equal(assistant.intent, "architecture_help");
    assert.equal(assistant.providerRoute, "azure-openai-ready");
    assert.equal(assistant.liveProviderUsed, false);
    assert.ok(assistant.answer.includes("LangGraph RAG path"));
    assert.ok(assistant.citations.includes("architecture_help:provider-routing"));
  } finally {
    restoreEnv("SERVIER_ASSISTANT_ENABLED", previousEnabled);
    restoreEnv("SERVIER_AI_PROVIDER", previousProvider);
  }
}
);

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
