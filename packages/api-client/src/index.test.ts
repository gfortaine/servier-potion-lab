import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createPotionLabApi } from "./index.js";

test("facade maps generated contract responses to stable view models", async () => {
  const requests: Array<{
    readonly input: string | URL | Request;
    readonly init: RequestInit | undefined;
  }> = [];
  const api = createPotionLabApi({
    baseUrl: "http://api.test/",
    fetch: async (input, init) => {
      requests.push({ input, init });
      return jsonResponse([
        {
          id: "invisibilite",
          recipeId: "invisibilite",
          name: "Potion d'invisibilité",
          ingredientIds: ["noix-de-coco", "yttrium", "mandragore"],
          createdAt: "2026-06-21T00:00:00.000Z"
        }
      ]);
    }
  });

  const potions = await api.listPotions();

  assert.deepEqual(potions, [
    {
      id: "invisibilite",
      recipeId: "invisibilite",
      name: "Potion d'invisibilité",
      ingredientIds: ["noix-de-coco", "yttrium", "mandragore"],
      createdAt: "2026-06-21T00:00:00.000Z"
    }
  ]);
  assert.equal(requests[0]?.input, "http://api.test/potions");
  assert.equal(requests[0]?.init?.method, "GET");
});

test("facade serializes generated request body shapes", async () => {
  let capturedBody: unknown;
  const api = createPotionLabApi({
    baseUrl: "http://api.test",
    fetch: async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse({
        id: "created-id",
        recipeId: "invisibilite",
        name: "Potion d'invisibilité",
        ingredientIds: ["noix-de-coco", "yttrium", "mandragore"],
        createdAt: "2026-06-21T00:00:00.000Z"
      });
    }
  });

  await api.createPotion(["noix-de-coco", "yttrium", "mandragore"]);

  assert.deepEqual(capturedBody, {
    ingredientIds: ["noix-de-coco", "yttrium", "mandragore"]
  });
});

test("facade preserves API error messages and status codes", async () => {
  const api = createPotionLabApi({
    baseUrl: "http://api.test",
    fetch: async () => jsonResponse({ message: "Stock insuffisant." }, 400)
  });

  await assert.rejects(api.createPotion(["a", "b", "c"]), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, "Stock insuffisant.");
    assert.equal(error.status, 400);
    return true;
  });
});

test("facade posts Codex chat messages to the assistant endpoint", async () => {
  let capturedPath: string | URL | Request | undefined;
  let capturedBody: unknown;
  const api = createPotionLabApi({
    baseUrl: "http://api.test",
    fetch: async (input, init) => {
      capturedPath = input;
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse({
        answer: "Potion d'invisibilité validée.",
        intent: "create_potion",
        toolCalls: [
          {
            name: "create_potion",
            status: "success",
            stateChanged: true,
            message: "Potion d'invisibilité validée.",
            data: {
              potion: { name: "Potion d'invisibilité" }
            },
            ui: { type: "potion-created-card" }
          }
        ],
        liveProviderUsed: false
      });
    }
  });

  const response = await api.chat("Prépare une potion d'invisibilité", "fr");

  assert.equal(capturedPath, "http://api.test/assistant/chat");
  assert.deepEqual(capturedBody, {
    message: "Prépare une potion d'invisibilité",
    locale: "fr"
  });
  assert.equal(response.toolCalls[0]?.name, "create_potion");
  assert.equal(response.liveProviderUsed, false);
});

test("facade rejects incomplete Codex chat responses", async () => {
  const api = createPotionLabApi({
    baseUrl: "http://api.test",
    fetch: async () => jsonResponse({
      answer: "Potion validée.",
      intent: "create_potion",
      toolCalls: [],
    })
  });

  await assert.rejects(
    api.chat("Prépare une potion d'invisibilité", "fr"),
    /AssistantChatResponseDto.liveProviderUsed/
  );
});

test("facade rejects incomplete generated responses", async () => {
  const api = createPotionLabApi({
    baseUrl: "http://api.test",
    fetch: async () => jsonResponse({ id: "argent", name: "Argent" })
  });

  await assert.rejects(
    api.listInventory(),
    /API response expected an array/
  );
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}
