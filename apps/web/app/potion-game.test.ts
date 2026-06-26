import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessageChunk, type UIMessage } from "ai";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("../i18n/navigation", async () => {
  const ReactModule = await import("react");

  function Link({
    children,
    href,
    ...props
  }: Readonly<{
    children: React.ReactNode;
    href: string | { readonly pathname: string; readonly query?: Record<string, string> };
  }>): React.ReactElement {
    const normalizedHref =
      typeof href === "string"
        ? href
        : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ""}`;

    return ReactModule.createElement("a", { href: normalizedHref, ...props }, children);
  }

  return {
    Link,
    useRouter: () => ({ push: routerPushMock })
  };
});

import { PotionGame } from "./potion-game";

const ingredients = [
  { id: "argent", name: "Argent" },
  { id: "bave-de-lama", name: "Bave de lama" },
  { id: "epine-de-herisson", name: "Épine de hérisson" },
  { id: "plume-de-griffon", name: "Plume de griffon" },
  { id: "helium-liquide", name: "Hélium liquide" },
  { id: "poil-de-yeti", name: "Poil de yéti" },
  { id: "or", name: "Or" },
  { id: "azote-liquide", name: "Azote liquide" },
  { id: "queue-d-ecureuil", name: "Queue d'écureuil" },
  { id: "crin-de-licorne", name: "Crin de licorne" },
  { id: "jus-de-horglup", name: "Jus de Horglup" },
  { id: "noix-de-coco", name: "Noix de coco" },
  { id: "yttrium", name: "Yttrium" },
  { id: "mandragore", name: "Mandragore" }
];

const recipes = [
  {
    id: "invisibilite",
    name: "Potion d'invisibilité",
    ingredientIds: ["noix-de-coco", "yttrium", "mandragore"],
    discovered: false
  },
  {
    id: "force",
    name: "Potion de Force",
    ingredientIds: ["poil-de-yeti", "or", "argent"],
    discovered: false
  }
];

let inventory = ingredients.map((ingredient) => ({
  ingredientId: ingredient.id,
  name: ingredient.name,
  quantity: 3
}));
let potions: unknown[] = [];

beforeEach(() => {
  inventory = ingredients.map((ingredient) => ({
    ingredientId: ingredient.id,
    name: ingredient.name,
    quantity: 3
  }));
  potions = [];
  vi.stubGlobal("fetch", vi.fn(handleFetch));
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  routerPushMock.mockClear();
  vi.unstubAllGlobals();
});

test("renders visible recipe combinations from the API", async () => {
  render(React.createElement(PotionGame, { view: "recipes" }));

  const invisibility = await screen.findByTestId("recipe-invisibilite");
  const force = await screen.findByTestId("recipe-force");
  expect(invisibility.textContent).toContain("Noix de coco + Yttrium + Mandragore");
  expect(force.textContent).toContain("Poil de yéti + Or + Argent");
});

test("creates a potion through the API-backed composer and routes to recipes", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("select-noix-de-coco");
  await user.click(screen.getByTestId("select-noix-de-coco"));
  await user.click(screen.getByTestId("select-yttrium"));
  await user.click(screen.getByTestId("select-mandragore"));
  await user.click(screen.getByTestId("combine-button"));

  await waitFor(() => {
    expect(routerPushMock).toHaveBeenCalledWith({
      pathname: "/recipes",
      query: { created: "potion-test", recipe: "invisibilite" }
    });
  });
});

test("opens a recipe formula in composer and restores the selected recipe from storage", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "recipes" }));

  const recipe = await screen.findByTestId("recipe-invisibilite");
  await user.click(within(recipe).getByRole("button", { name: "Préparer cette formule" }));

  await waitFor(() => {
    expect(routerPushMock).toHaveBeenCalledWith({
      pathname: "/composer",
      query: { recipe: "invisibilite" }
    });
  });
  expect(window.localStorage.getItem("servier-potion-lab:fr:composer-draft")).toContain(
    '"targetRecipeId":"invisibilite"'
  );

  cleanup();
  render(React.createElement(PotionGame, { view: "composer" }));

  await waitFor(() => {
    expect(screen.getByTestId("cauldron-panel").textContent).toContain(
      "Potion d'invisibilité guide la préparation."
    );
  });
  expect(screen.getByTestId("target-chip-noix-de-coco").textContent).toContain("Formule");
});

test("restores composer draft ingredients and clears them after validation", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("select-noix-de-coco");
  await user.click(screen.getByTestId("select-noix-de-coco"));
  await user.click(screen.getByTestId("select-yttrium"));

  await waitFor(() => {
    expect(window.localStorage.getItem("servier-potion-lab:fr:composer-draft")).toContain(
      '"selectedIngredientIds":["noix-de-coco","yttrium"]'
    );
  });

  cleanup();
  render(React.createElement(PotionGame, { view: "composer" }));

  await waitFor(() => {
    expect(screen.getByTestId("atelier-stepper").textContent).toContain("2/3 ingrédients");
  });

  await user.click(screen.getByTestId("select-mandragore"));
  await user.click(screen.getByTestId("combine-button"));

  await waitFor(() => {
    expect(routerPushMock).toHaveBeenCalledWith({
      pathname: "/recipes",
      query: { created: "potion-test", recipe: "invisibilite" }
    });
  });
  expect(window.localStorage.getItem("servier-potion-lab:fr:composer-draft")).toBeNull();
});

test("keeps composer selection draft-only until potion validation", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "composer" }));

  const noix = await screen.findByTestId("ingredient-noix-de-coco");
  expect(noix.textContent).toContain("Stock disponible : 3");

  await user.click(screen.getByTestId("select-noix-de-coco"));
  await user.click(screen.getByTestId("select-yttrium"));
  await user.click(screen.getByTestId("select-mandragore"));
  expect(screen.getByTestId("ingredient-noix-de-coco").textContent).toContain("Stock disponible : 3");

  await user.click(screen.getByTestId("combine-button"));
  await waitFor(() => {
    expect(inventory.find((item) => item.ingredientId === "noix-de-coco")?.quantity).toBe(2);
  });
});

test("creates a potion through the assistant chat and refreshes inventory", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "composer" }));

  const noix = await screen.findByTestId("ingredient-noix-de-coco");
  expect(noix.textContent).toContain("Stock disponible : 3");

  await user.type(screen.getByTestId("codex-chat-input"), "Prépare une potion d'invisibilité");
  await user.click(screen.getByTestId("codex-chat-submit"));

  await screen.findByTestId("codex-tool-create_potion");
  await waitFor(() => {
    expect(screen.getByTestId("ingredient-noix-de-coco").textContent).toContain("Stock disponible : 2");
  });
  expect(screen.getByTestId("codex-chat").textContent).toContain("Potion d'invisibilité");
});

test("streams regular assistant chat replies without forcing a potion tool", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("ingredient-noix-de-coco");
  await user.type(screen.getByTestId("codex-chat-input"), "hi");
  await user.click(screen.getByTestId("codex-chat-submit"));

  await screen.findByText("Bonjour, je suis l'assistant potion SERVIER. Je peux discuter et créer une potion connue.");
  expect(screen.queryByTestId("codex-tool-create_potion")).toBeNull();
  expect(screen.getByTestId("ingredient-noix-de-coco").textContent).toContain("Stock disponible : 3");
});

test("shows a live writing state while waiting for the assistant stream", async () => {
  const user = userEvent.setup();
  let resolveChat: ((response: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.pathname === "/assistant/chat/stream" && init?.method === "POST") {
        return new Promise<Response>((resolve) => {
          resolveChat = resolve;
        });
      }

      return handleFetch(input, init);
    })
  );

  render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("ingredient-noix-de-coco");
  await user.type(screen.getByTestId("codex-chat-input"), "hi");
  await user.click(screen.getByTestId("codex-chat-submit"));

  expect((await screen.findByTestId("codex-chat-streaming")).textContent).toContain("Analyse de la demande");
  expect((screen.getByTestId("codex-chat-submit") as HTMLButtonElement).disabled).toBe(true);

  resolveChat?.(
    uiMessageResponse((write) => {
      writeTextPart(write, "Réponse en direct.");
    })
  );

  await screen.findByText("Réponse en direct.");
  await waitFor(() => {
    expect(screen.queryByTestId("codex-chat-streaming")).toBeNull();
  });
});

test("keeps the writing state on the current assistant turn after a previous reply", async () => {
  const user = userEvent.setup();
  let chatRequestCount = 0;
  let resolveSecondChat: ((response: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input.toString());
      if (url.pathname === "/assistant/chat/stream" && init?.method === "POST") {
        chatRequestCount += 1;
        if (chatRequestCount === 1) {
          return uiMessageResponse((write) => {
            writeTextPart(write, "Première réponse.");
          });
        }

        return new Promise<Response>((resolve) => {
          resolveSecondChat = resolve;
        });
      }

      return handleFetch(input, init);
    })
  );

  render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("ingredient-noix-de-coco");
  await user.type(screen.getByTestId("codex-chat-input"), "hi");
  await user.click(screen.getByTestId("codex-chat-submit"));
  await screen.findByText("Première réponse.");

  await user.type(screen.getByTestId("codex-chat-input"), "encore");
  await user.click(screen.getByTestId("codex-chat-submit"));

  const pendingMessage = await screen.findByTestId("codex-chat-pending-message");
  expect(pendingMessage.textContent).toContain("Analyse de la demande");
  expect(screen.getByText("Première réponse.").closest("article")?.textContent).not.toContain("Analyse de la demande");

  resolveSecondChat?.(
    uiMessageResponse((write) => {
      writeTextPart(write, "Deuxième réponse en direct.");
    })
  );

  await screen.findByText("Deuxième réponse en direct.");
  await waitFor(() => {
    expect(screen.queryByTestId("codex-chat-streaming")).toBeNull();
  });
});

test("lets the assistant chat collapse to a bubble and reopen", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("ingredient-noix-de-coco");
  await user.click(screen.getByRole("button", { name: "Réduire l'assistant potion" }));

  expect(screen.getByTestId("codex-chat").className).toContain("is-collapsed");
  await user.click(screen.getByRole("button", { name: "Assistant potion" }));

  expect(screen.getByTestId("codex-chat").className).not.toContain("is-collapsed");
});

test("renders the spec-mapped pages as focused Next.js views", async () => {
  const { rerender } = render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("cauldron-panel");
  expect(screen.queryByTestId("codex-panel")).toBeNull();
  expect(screen.queryByTestId("ledger-panel")).toBeNull();

  rerender(React.createElement(PotionGame, { view: "recipes" }));
  await screen.findByTestId("codex-panel");
  expect(screen.queryByTestId("inventory-panel")).toBeNull();
  expect(screen.queryByTestId("cauldron-panel")).toBeNull();

  rerender(React.createElement(PotionGame, { view: "inventory" }));
  await screen.findByTestId("inventory-panel");
  expect(screen.queryByTestId("codex-panel")).toBeNull();
  expect(screen.queryByTestId("cauldron-panel")).toBeNull();
});

test("prevents invalid composition, enforces the three-slot cap, and clears the tray", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("combine-button");
  expect(screen.getByTestId("combine-button").hasAttribute("disabled")).toBe(true);

  await user.click(screen.getByTestId("select-argent"));
  await user.click(screen.getByTestId("select-or"));
  await user.click(screen.getByTestId("select-bave-de-lama"));
  await user.click(screen.getByTestId("select-noix-de-coco"));

  expect(screen.getByTestId("notice").textContent).toContain("exactement trois ingrédients");
  expect(screen.getByTestId("atelier-stepper").textContent).toContain("3/3 ingrédients");

  await user.click(screen.getByTestId("combine-button"));
  await waitFor(() => {
    expect(screen.getByTestId("notice").textContent).toContain(
      "Aucune recette ne correspond à ces trois ingrédients"
    );
  });

  await user.click(screen.getByRole("button", { name: "Effacer" }));
  expect(screen.getByTestId("atelier-stepper").textContent).toContain("0/3 ingrédients");
  expect(screen.getByTestId("combine-button").hasAttribute("disabled")).toBe(true);
});

test("supports inventory decrement, recharge, and page-level randomized restock controls", async () => {
  const user = userEvent.setup();
  render(React.createElement(PotionGame, { view: "inventory" }));

  const argent = await screen.findByTestId("ingredient-argent");
  expect(within(argent).getByRole("button", { name: "Retirer une unité de Argent" }).textContent).toBe("−");
  expect(within(argent).getByLabelText("Quantité actuelle 3").textContent).toBe("3");
  expect(within(argent).getByRole("button", { name: "Ajouter une unité de Argent" }).textContent).toBe("+");

  await user.click(screen.getByTestId("decrement-argent"));
  await waitFor(() => {
    expect(screen.getByTestId("ingredient-argent").textContent).toContain("Stock disponible : 2");
  });

  await user.click(
    within(screen.getByTestId("ingredient-argent")).getByRole("button", {
      name: "Ajouter une unité de Argent"
    })
  );
  await waitFor(() => {
    expect(screen.getByTestId("ingredient-argent").textContent).toContain("Stock disponible : 3");
  });

  await user.click(screen.getByRole("button", { name: "Nouvelle dotation" }));
  await waitFor(() => {
    expect(inventory.every((item) => item.quantity >= 1 && item.quantity <= 5)).toBe(true);
  });
});

test("keeps stock mutation controls dedicated to the inventory page", async () => {
  const { rerender } = render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByTestId("ingredient-argent");
  expect(screen.queryByTestId("decrement-argent")).toBeNull();
  expect(screen.queryByTestId("recharge-argent")).toBeNull();
  expect(screen.queryByRole("button", { name: "Nouvelle dotation" })).toBeNull();
  expect(screen.getByTestId("select-argent")).toBeTruthy();

  rerender(React.createElement(PotionGame, { view: "inventory" }));
  await screen.findByTestId("ingredient-argent");
  expect(screen.queryByTestId("select-argent")).toBeNull();
  expect(screen.getByTestId("decrement-argent")).toBeTruthy();
  expect(screen.getByTestId("recharge-argent")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Nouvelle dotation" })).toBeTruthy();
});

test("keeps recipe quest hints out of inventory stock management", async () => {
  const { rerender } = render(
    React.createElement(PotionGame, {
      initialTargetRecipeId: "force",
      view: "composer"
    })
  );

  await screen.findByTestId("target-chip-argent");

  rerender(
    React.createElement(PotionGame, {
      initialTargetRecipeId: "force",
      view: "inventory"
    })
  );

  await screen.findByTestId("ingredient-argent");
  expect(screen.queryByTestId("target-chip-argent")).toBeNull();
  expect(screen.getByTestId("inventory-panel").textContent).not.toContain("Codex");
  expect(screen.getByTestId("inventory-panel").textContent).not.toContain("Quête");
  expect(screen.getByTestId("inventory-panel").textContent).not.toContain("Formule");
});

test("links depleted composer ingredients to the dedicated inventory route", async () => {
  inventory = inventory.map((item) =>
    item.ingredientId === "argent" ? { ...item, quantity: 0 } : item
  );

  render(React.createElement(PotionGame, { view: "composer" }));

  const argent = await screen.findByTestId("ingredient-argent");
  expect(within(argent).getByTestId("select-argent").hasAttribute("disabled")).toBe(true);
  expect(within(argent).getByRole("link", { name: "Gérer" }).getAttribute("href")).toBe(
    "/inventory?ingredient=argent"
  );
});

test("renders English localized navigation and deterministic discovery funnel", async () => {
  render(React.createElement(PotionGame, { locale: "en" }));

  await screen.findByRole("heading", { name: "SERVIER Potion Discovery Lab." });
  expect(screen.getByTestId("discovery-panel").textContent).toContain("possible candidates");
  expect(screen.getByTestId("discovery-panel").textContent).toContain("364");
  expect(screen.getByTestId("discovery-panel").textContent).toContain("Secret recipes");
  expect(screen.queryByRole("complementary", { name: "Next step" })).toBeNull();
});

test("renders the dashboard as a three-page mission launchpad", async () => {
  render(React.createElement(PotionGame));

  await screen.findByRole("heading", { name: "Laboratoire des potions SERVIER." });
  expect(
    Array.from(document.querySelectorAll(".dashboard-cards a")).map((link) => link.getAttribute("href"))
  ).toEqual(["/recipes", "/composer", "/inventory"]);
  expect(screen.getAllByRole("link", { name: /Composer une potion/ }).some((link) => link.getAttribute("href") === "/composer")).toBe(true);
  expect(screen.getByRole("link", { name: /Consulter les recettes/ }).getAttribute("href")).toBe("/recipes");
  expect(screen.getByRole("link", { name: /Gérer l'inventaire/ }).getAttribute("href")).toBe("/inventory");
  expect(screen.queryByTestId("cauldron-panel")).toBeNull();
  expect(screen.queryByTestId("codex-panel")).toBeNull();
});

test("keeps hero, discovery, journey rail, and technical proof off task pages", async () => {
  const { rerender } = render(React.createElement(PotionGame, { view: "composer" }));

  await screen.findByRole("heading", { level: 1, name: "Composer une potion." });
  expect(screen.queryByRole("link", { name: /Composer une potion/ })).toBeNull();
  expect(screen.queryByTestId("discovery-panel")).toBeNull();
  expect(screen.queryByRole("complementary", { name: "Prochaine étape" })).toBeNull();
  expect(screen.queryByText("Détails techniques")).toBeNull();

  rerender(React.createElement(PotionGame, { view: "recipes" }));
  await screen.findByRole("heading", { level: 1, name: "Recettes & potions." });
  expect(screen.queryByRole("link", { name: /Composer une potion/ })).toBeNull();
  expect(screen.queryByTestId("discovery-panel")).toBeNull();

  rerender(React.createElement(PotionGame, { view: "inventory" }));
  await screen.findByRole("heading", { level: 1, name: "Inventaire des ingrédients." });
  expect(screen.queryByRole("link", { name: /Composer une potion/ })).toBeNull();
  expect(screen.queryByTestId("discovery-panel")).toBeNull();
});

test("highlights a created recipe and potion from recipes route props", async () => {
  potions = [
    {
      id: "potion-test",
      recipeId: "invisibilite",
      name: "Potion d'invisibilité",
      ingredientIds: ["noix-de-coco", "yttrium", "mandragore"],
      createdAt: "2026-06-21T00:00:00.000Z"
    }
  ];
  render(
    React.createElement(PotionGame, {
      initialCreatedPotionId: "potion-test",
      initialCreatedRecipeId: "invisibilite",
      view: "recipes"
    })
  );

  await screen.findByText("Potion d'invisibilité vient d'être validée et ajoutée au registre.");
  expect(screen.getByTestId("recipe-invisibilite").className).toContain("is-new");
  expect(screen.getByTestId("potion-ledger").querySelector(".is-new")?.textContent).toContain(
    "Potion d'invisibilité"
  );
});

async function handleFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(input.toString());

  if (url.pathname === "/ingredients") {
    return jsonResponse(ingredients);
  }
  if (url.pathname === "/inventory") {
    return jsonResponse(inventory);
  }
  if (url.pathname === "/recipes") {
    return jsonResponse(
      recipes.map((recipe) => ({
        ...recipe,
        discovered: potions.some(
          (potion) => (potion as { recipeId: string }).recipeId === recipe.id
        )
      }))
    );
  }
  if (url.pathname === "/potions" && (init?.method ?? "GET") === "GET") {
    return jsonResponse(potions);
  }
  if (url.pathname === "/assistant/chat/stream" && init?.method === "POST") {
    const payload = JSON.parse(String(init.body)) as { readonly messages: readonly UIMessage[] };
    const message = readLastUserText(payload.messages);
    if (!message.toLocaleLowerCase("fr").includes("invisibilité")) {
      return uiMessageResponse((write) => {
        writeTextPart(write, "Bonjour, je suis l'assistant potion SERVIER. Je peux discuter et créer une potion connue.");
      });
    }
    const ingredientIds = ["noix-de-coco", "yttrium", "mandragore"];
    const before = inventory.filter((item) => ingredientIds.includes(item.ingredientId));
    const potion = {
      id: "potion-chat-test",
      recipeId: "invisibilite",
      name: "Potion d'invisibilité",
      ingredientIds,
      createdAt: "2026-06-21T00:00:00.000Z"
    };
    potions = [potion, ...potions];
    inventory = inventory.map((item) =>
      ingredientIds.includes(item.ingredientId) ? { ...item, quantity: item.quantity - 1 } : item
    );
    const inventoryDelta = before.map((item) => ({
      ingredientId: item.ingredientId,
      name: item.name,
      before: item.quantity,
      after: item.quantity - 1,
      delta: -1
    }));

    return uiMessageResponse((write) => {
      writeTextPart(write, "Potion d'invisibilité validée par l'assistant potion.");
      write({
        type: "tool-input-available",
        toolCallId: "tool-chat-test",
        toolName: "create_potion",
        input: { mode: "recipe", recipeName: "invisibilite" },
        title: "create_potion"
      });
      write({
        type: "tool-output-available",
        toolCallId: "tool-chat-test",
        output: {
          name: "create_potion",
          status: "success",
          stateChanged: true,
          message: "Potion d'invisibilité validée par l'assistant potion.",
          data: { potion, inventoryDelta },
          ui: { type: "potion-created-card" }
        }
      });
    });
  }
  if (url.pathname === "/assistant/chat" && init?.method === "POST") {
    const payload = JSON.parse(String(init.body)) as { readonly message: string };
    if (!payload.message.toLocaleLowerCase("fr").includes("invisibilité")) {
      return jsonResponse({
        answer: "L'assistant potion ne reconnaît pas encore cette demande.",
        intent: "unknown",
        toolCalls: [],
        liveProviderUsed: false
      });
    }
    const ingredientIds = ["noix-de-coco", "yttrium", "mandragore"];
    const before = inventory.filter((item) => ingredientIds.includes(item.ingredientId));
    const potion = {
      id: "potion-chat-test",
      recipeId: "invisibilite",
      name: "Potion d'invisibilité",
      ingredientIds,
      createdAt: "2026-06-21T00:00:00.000Z"
    };
    potions = [potion, ...potions];
    inventory = inventory.map((item) =>
      ingredientIds.includes(item.ingredientId) ? { ...item, quantity: item.quantity - 1 } : item
    );
    const inventoryDelta = before.map((item) => ({
      ingredientId: item.ingredientId,
      name: item.name,
      before: item.quantity,
      after: item.quantity - 1,
      delta: -1
    }));

    return jsonResponse({
      answer: "Potion d'invisibilité validée par l'assistant potion.",
      intent: "create_potion",
      toolCalls: [
        {
          name: "create_potion",
          status: "success",
          stateChanged: true,
          message: "Potion d'invisibilité validée par l'assistant potion.",
          data: { potion, inventoryDelta },
          ui: { type: "potion-created-card" }
        }
      ],
      liveProviderUsed: false
    });
  }
  if (url.pathname === "/potions" && init?.method === "POST") {
    const payload = JSON.parse(String(init.body)) as { readonly ingredientIds: readonly string[] };
    const key = [...payload.ingredientIds].sort().join("|");
    if (key !== ["mandragore", "noix-de-coco", "yttrium"].sort().join("|")) {
      return jsonResponse({ message: "No potion recipe matches these ingredients." }, 400);
    }
    const potion = {
      id: "potion-test",
      recipeId: "invisibilite",
      name: "Potion d'invisibilité",
      ingredientIds: payload.ingredientIds,
      createdAt: "2026-06-21T00:00:00.000Z"
    };
    potions = [potion, ...potions];
    inventory = inventory.map((item) =>
      payload.ingredientIds.includes(item.ingredientId)
        ? { ...item, quantity: item.quantity - 1 }
        : item
    );
    return jsonResponse(potion, 201);
  }
  if (url.pathname.startsWith("/inventory/") && init?.method === "PUT") {
    const ingredientId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
    const payload = JSON.parse(String(init.body)) as { readonly quantity: number };
    inventory = inventory.map((item) =>
      item.ingredientId === ingredientId ? { ...item, quantity: payload.quantity } : item
    );
    const updated = inventory.find((item) => item.ingredientId === ingredientId);
    return updated ? jsonResponse(updated) : jsonResponse({ message: "Not found" }, 404);
  }
  if (url.pathname.endsWith("/recharge") && init?.method === "POST") {
    const ingredientId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
    const payload = JSON.parse(String(init.body)) as { readonly amount: number };
    inventory = inventory.map((item) =>
      item.ingredientId === ingredientId
        ? { ...item, quantity: item.quantity + payload.amount }
        : item
    );
    const updated = inventory.find((item) => item.ingredientId === ingredientId);
    return updated ? jsonResponse(updated) : jsonResponse({ message: "Not found" }, 404);
  }
  if (url.pathname === "/inventory/randomize" && init?.method === "POST") {
    inventory = inventory.map((item, index) => ({
      ...item,
      quantity: (index % 5) + 1
    }));
    return jsonResponse(inventory);
  }

  return jsonResponse({ message: "Not found" }, 404);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function uiMessageResponse(execute: (write: (chunk: UIMessageChunk) => void) => void): Response {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => execute(writer.write)
    })
  });
}

function readLastUserText(messages: readonly UIMessage[]): string {
  const message = [...messages].reverse().find((candidate) => candidate.role === "user");
  return message?.parts
    .filter((part): part is { readonly type: "text"; readonly text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ") ?? "";
}

function writeTextPart(write: (chunk: UIMessageChunk) => void, text: string): void {
  const id = "test-text";
  write({ type: "text-start", id });
  write({ type: "text-delta", id, delta: text });
  write({ type: "text-end", id });
}
