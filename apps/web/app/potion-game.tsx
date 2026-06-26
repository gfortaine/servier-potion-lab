"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ApiError,
  API_BASE_URL,
  potionLabApi,
  type IngredientView,
  type InventoryView,
  type PotionChatToolCall,
  type PotionView,
  type RecipeView
} from "./potion-lab-api";
import { formatCopy, potionCopy, type PotionCopy } from "./potion-copy";
import { Link, useRouter } from "../i18n/navigation";
import type { Locale } from "../i18n/routing";

type NoticeTone = "quiet" | "success" | "warning";
type AtelierStage = "choose" | "compose" | "distill";
export type PotionGameView = "dashboard" | "composer" | "recipes" | "inventory";

interface Notice {
  readonly tone: NoticeTone;
  readonly text: string;
}

interface LabSnapshot {
  readonly ingredients: readonly IngredientView[];
  readonly inventory: readonly InventoryView[];
  readonly recipes: readonly RecipeView[];
  readonly potions: readonly PotionView[];
}

interface ComposerDraft {
  readonly targetRecipeId: string | null;
  readonly selectedIngredientIds: readonly string[];
}

const EMPTY_SNAPSHOT: LabSnapshot = {
  ingredients: [],
  inventory: [],
  recipes: [],
  potions: []
};
export function PotionGame({
  focusedIngredientId,
  initialCreatedPotionId,
  initialCreatedRecipeId,
  initialTargetRecipeId,
  locale = "fr",
  view = "dashboard"
}: {
  readonly focusedIngredientId?: string | undefined;
  readonly initialCreatedPotionId?: string | undefined;
  readonly initialCreatedRecipeId?: string | undefined;
  readonly initialTargetRecipeId?: string | undefined;
  readonly locale?: Locale;
  readonly view?: PotionGameView;
}): React.ReactElement {
  const copy = potionCopy[locale];
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<LabSnapshot>(EMPTY_SNAPSHOT);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<readonly string[]>([]);
  const [targetRecipeId, setTargetRecipeId] = useState<string | null>(initialTargetRecipeId ?? null);
  const [lastCreatedPotionId, setLastCreatedPotionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>({
    tone: "quiet",
    text: copy.notices.loading
  });
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshLab().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialTargetRecipeId) {
      setTargetRecipeId(initialTargetRecipeId);
    }
  }, [initialTargetRecipeId]);

  useEffect(() => {
    if (draftHydrated || snapshot.recipes.length === 0 || snapshot.inventory.length === 0) {
      return;
    }

    const draft = readComposerDraft(locale);
    const queryTarget = initialTargetRecipeId && snapshot.recipes.some((recipe) => recipe.id === initialTargetRecipeId)
      ? initialTargetRecipeId
      : null;
    const storedTarget = draft?.targetRecipeId && snapshot.recipes.some((recipe) => recipe.id === draft.targetRecipeId)
      ? draft.targetRecipeId
      : null;
    const hydratedTarget = queryTarget ?? storedTarget;

    if (hydratedTarget) {
      setTargetRecipeId(hydratedTarget);
    }

    if (view === "composer" && draft?.selectedIngredientIds) {
      const liveInventory = new Map(snapshot.inventory.map((item) => [item.ingredientId, item.quantity]));
      const validSelection = draft.selectedIngredientIds
        .filter((ingredientId) => (liveInventory.get(ingredientId) ?? 0) > 0)
        .slice(0, 3);
      setSelectedIngredientIds(validSelection);
    }

    setDraftHydrated(true);
  }, [draftHydrated, initialTargetRecipeId, locale, snapshot.inventory, snapshot.recipes, view]);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }
    writeComposerDraft(locale, { targetRecipeId, selectedIngredientIds });
  }, [draftHydrated, locale, selectedIngredientIds, targetRecipeId]);

  const inventoryById = useMemo(
    () => new Map(snapshot.inventory.map((item) => [item.ingredientId, item])),
    [snapshot.inventory]
  );
  const ingredientNamesById = useMemo(
    () => new Map(snapshot.ingredients.map((ingredient) => [ingredient.id, ingredient.name])),
    [snapshot.ingredients]
  );
  const targetRecipe =
    snapshot.recipes.find((recipe) => recipe.id === targetRecipeId) ??
    snapshot.recipes.find((recipe) => !recipe.discovered) ??
    null;
  const selectedNames = selectedIngredientIds.map(
    (ingredientId) => ingredientNamesById.get(ingredientId) ?? ingredientId
  );
  const discoveredCount = snapshot.recipes.filter((recipe) => recipe.discovered).length;
  const completionRatio =
    snapshot.recipes.length === 0
      ? 0
      : Math.round((discoveredCount / snapshot.recipes.length) * 100);
  const depletedCount = snapshot.inventory.filter((item) => item.quantity === 0).length;
  const createdRecipe = snapshot.recipes.find((recipe) => recipe.id === initialCreatedRecipeId) ?? null;
  const activeStage = getActiveStage(selectedIngredientIds.length);
  const [atelierTitle, atelierBody] = copy.atelier.viewIntro[view];

  async function refreshLab(): Promise<void> {
    const [ingredients, inventory, recipes, potions] = await Promise.all([
      potionLabApi.listIngredients(),
      potionLabApi.listInventory(),
      potionLabApi.listRecipes(),
      potionLabApi.listPotions()
    ]);
    setSnapshot({ ingredients, inventory, recipes, potions });
  }

  function selectTarget(recipeId: string): void {
    writeComposerDraft(locale, { targetRecipeId: recipeId, selectedIngredientIds });
    if (view === "recipes") {
      router.push({ pathname: "/composer", query: { recipe: recipeId } });
      return;
    }

    setTargetRecipeId(recipeId);
    const recipe = snapshot.recipes.find((candidate) => candidate.id === recipeId);
    setNotice({
      tone: "quiet",
      text: recipe
        ? formatCopy(copy.notices.recipePinned, { recipe: recipe.name })
        : copy.recipes.guided
    });
  }

  function toggleSelection(ingredientId: string): void {
    if (selectedIngredientIds.includes(ingredientId)) {
      setSelectedIngredientIds((current) => current.filter((id) => id !== ingredientId));
      setNotice({ tone: "quiet", text: copy.notices.ingredientRemoved });
      return;
    }

    const inventoryItem = inventoryById.get(ingredientId);
    if (!inventoryItem || inventoryItem.quantity < 1) {
      setNotice({ tone: "warning", text: copy.notices.depleted });
      return;
    }

    if (selectedIngredientIds.length >= 3) {
      setNotice({ tone: "warning", text: copy.notices.cap });
      return;
    }

    const nextSelection = [...selectedIngredientIds, ingredientId];
    setSelectedIngredientIds(nextSelection);
    setNotice({
      tone: "quiet",
      text:
        nextSelection.length === 3
          ? copy.notices.ready
          : formatCopy(copy.notices.remaining, { count: 3 - nextSelection.length })
    });
  }

  async function combineSelection(): Promise<void> {
    if (selectedIngredientIds.length !== 3) {
      setNotice({ tone: "warning", text: copy.notices.fillSlots });
      return;
    }

    await runApiAction(async () => {
      const potion = await potionLabApi.createPotion(selectedIngredientIds);
      setSelectedIngredientIds([]);
      setTargetRecipeId(null);
      clearComposerDraft(locale);
      setLastCreatedPotionId(potion.id);
      await refreshLab();
      setNotice({
        tone: "success",
        text: formatCopy(copy.notices.recorded, { potion: potion.name })
      });
      router.push({ pathname: "/recipes", query: { created: potion.id, recipe: potion.recipeId } });
    });
  }

  async function setInventoryQuantity(ingredientId: string, quantity: number): Promise<void> {
    await runApiAction(async () => {
      const nextQuantity = Math.max(0, quantity);
      const updated = await potionLabApi.setInventoryQuantity(ingredientId, nextQuantity);
      if (nextQuantity === 0) {
        setSelectedIngredientIds((current) => current.filter((id) => id !== ingredientId));
      }
      await refreshLab();
      setNotice({
        tone: "success",
        text: formatCopy(copy.notices.adjusted, { ingredient: updated.name, quantity: updated.quantity })
      });
    });
  }

  async function randomizeInventory(): Promise<void> {
    await runApiAction(async () => {
      await potionLabApi.randomizeInventory();
      setSelectedIngredientIds([]);
      clearComposerDraft(locale);
      await refreshLab();
      setNotice({ tone: "success", text: copy.notices.randomized });
    });
  }

  async function runApiAction(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setNotice({
        tone: "warning",
        text: error instanceof ApiError ? toProductMessage(error.message, copy) : copy.notices.unavailable
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lab-shell">
      {view === "dashboard" ? (
        <HeroTheatre
          completionRatio={completionRatio}
          copy={copy}
          depletedCount={depletedCount}
          loading={loading}
          locale={locale}
        />
      ) : null}

      <section className="atelier-stage" aria-labelledby={view === "dashboard" ? "atelier-title" : "page-title"}>
        <div className="atelier-heading">
          <p className="eyebrow">{copy.atelier.eyebrow}</p>
          {view === "dashboard" ? (
            <h2 id="atelier-title">{atelierTitle}</h2>
          ) : (
            <h1 id="page-title">{atelierTitle}</h1>
          )}
          <p>{atelierBody}</p>
        </div>

        {view === "dashboard" ? (
          <DashboardLaunchpad
            completionRatio={completionRatio}
            copy={copy}
            depletedCount={depletedCount}
            discoveredCount={discoveredCount}
            potionCount={snapshot.potions.length}
          />
        ) : null}

        {view === "composer" ? (
          <AtelierStepper activeStage={activeStage} copy={copy} selectedCount={selectedIngredientIds.length} />
        ) : null}

        {view !== "dashboard" ? (
          <div className={`atelier-grid atelier-grid-${view}`}>
            {view === "composer" ? (
            <CauldronComposer
              busy={busy}
              loading={loading}
              notice={notice}
              onClear={() => {
                setSelectedIngredientIds([]);
                writeComposerDraft(locale, { targetRecipeId, selectedIngredientIds: [] });
                setNotice({ tone: "quiet", text: copy.notices.cleared });
              }}
              onCombine={() => void combineSelection()}
              copy={copy}
              onRemoveIngredient={toggleSelection}
              selectedIngredientIds={selectedIngredientIds}
              selectedNames={selectedNames}
              targetRecipe={targetRecipe}
            />
            ) : null}

            {view === "composer" || view === "inventory" ? (
            <IngredientTokenBoard
              busy={busy}
              copy={copy}
              focusedIngredientId={focusedIngredientId}
              ingredients={snapshot.ingredients}
              inventoryById={inventoryById}
              locale={locale}
              mode={view === "composer" ? "compose" : "manage"}
              notice={notice}
              onRestockInventory={() => void randomizeInventory()}
              onSetQuantity={(ingredientId, quantity) => void setInventoryQuantity(ingredientId, quantity)}
              onToggleIngredient={toggleSelection}
              selectedIngredientIds={selectedIngredientIds}
              targetRecipe={targetRecipe}
            />
            ) : null}

            {view === "recipes" ? (
            <RecipeCodex
              completionRatio={completionRatio}
              createdRecipeId={initialCreatedRecipeId ?? null}
              copy={copy}
              ingredientNamesById={ingredientNamesById}
              onSelectTarget={selectTarget}
              recipes={snapshot.recipes}
              targetRecipeId={targetRecipeId}
            />
            ) : null}

            {view === "recipes" ? (
            <PotionLedger
              ingredientNamesById={ingredientNamesById}
              copy={copy}
              lastCreatedPotionId={initialCreatedPotionId ?? lastCreatedPotionId}
              potions={snapshot.potions}
            />
            ) : null}
          </div>
        ) : null}

        {view === "recipes" && createdRecipe ? (
          <div className="success-route-banner" role="status">
            <span className="success-sparks" aria-hidden="true" />
            {formatCopy(copy.recipes.success, { recipe: createdRecipe.name })}
            <Link href="/composer">{copy.recipes.composeAgain}</Link>
          </div>
        ) : null}
      </section>

      {view === "dashboard" ? (
        <>
          <DiscoveryPanel
            ingredientCount={snapshot.ingredients.length}
            locale={locale}
            recipeCount={snapshot.recipes.length}
            selectedIngredientIds={selectedIngredientIds}
            selectedNames={selectedNames}
            selectedRecipe={findRecipeByIngredientSet(snapshot.recipes, selectedIngredientIds)}
          />
          <details className="technical-note">
            <summary>{copy.technical.summary}</summary>
            <p>{copy.technical.body}</p>
          </details>
        </>
      ) : null}

      <CodexChat
        locale={locale}
        onStateChanged={async (message) => {
          await refreshLab();
          setNotice({ tone: "success", text: message });
        }}
      />
    </main>
  );
}

function CodexChat({
  locale,
  onStateChanged
}: {
  readonly locale: Locale;
  readonly onStateChanged: (message: string) => Promise<void>;
}): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE_URL}/assistant/chat/stream`,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            locale
          }
        })
      }),
    [locale]
  );
  const { messages, sendMessage, status, error } = useChat({
    messages: createInitialCodexMessages(locale),
    transport,
    onFinish: ({ message }) => {
      const stateChanged = readStateChangedToolCall(message);
      if (stateChanged) {
        void onStateChanged(stateChanged.message);
      }
    }
  });
  const busy = status === "submitted" || status === "streaming";
  const conversationMessages =
    messages.length > 1 ? messages.filter((message) => message.id !== "codex-wake") : messages;
  const visibleMessages = conversationMessages.slice(-4);
  const lastMessage = messages[messages.length - 1];
  const activeAssistantMessageId =
    busy && lastMessage?.role === "assistant" && lastMessage.id !== "codex-wake" ? lastMessage.id : undefined;
  const showPendingAssistantMessage = busy && lastMessage?.role === "user";

  useEffect(() => {
    const logEnd = logEndRef.current;
    if (!collapsed && logEnd && typeof logEnd.scrollIntoView === "function") {
      logEnd.scrollIntoView({ block: "end" });
    }
  }, [collapsed, messages, status, error]);

  async function submitMessage(): Promise<void> {
    const message = input.trim();
    if (!message || busy) {
      return;
    }
    setInput("");
    await sendMessage({ text: message });
  }

  return (
    <aside
      className={`codex-chat trace-line ${collapsed ? "is-collapsed" : ""}`}
      aria-label={locale === "fr" ? "Assistant potion" : "Potion assistant"}
      aria-labelledby="codex-chat-title"
      data-testid="codex-chat"
    >
      {collapsed ? (
        <button
          aria-expanded="false"
          className="codex-chat-bubble active-press"
          onClick={() => setCollapsed(false)}
          type="button"
        >
          <span className="potion-glyph" aria-hidden="true" />
          {locale === "fr" ? "Assistant potion" : "Potion assistant"}
        </button>
      ) : null}
      <div className="codex-chat-header">
        <span className="potion-glyph" aria-hidden="true" />
        <div>
          <p className="eyebrow">{locale === "fr" ? "Assistant en direct" : "Live assistant"}</p>
          <h2 id="codex-chat-title">{locale === "fr" ? "Assistant potion" : "Potion assistant"}</h2>
          <span>{locale === "fr" ? "Une formule à la fois, stock réel" : "One formula at a time, real stock"}</span>
        </div>
        <button
          aria-expanded="true"
          aria-label={locale === "fr" ? "Réduire l'assistant potion" : "Collapse potion assistant"}
          className="codex-chat-collapse active-press"
          onClick={() => setCollapsed(true)}
          type="button"
        >
          —
        </button>
      </div>
      <div className="codex-chat-log" aria-live="polite">
        {visibleMessages.map((message) => {
          const textParts = readTextParts(message);
          const showWritingState = message.role === "assistant" && message.id === activeAssistantMessageId;
          const showWritingCue = showWritingState && textParts.length === 0;
          const showWritingCaret = showWritingState && textParts.length > 0;

          return (
            <article
              className={`codex-message codex-message-${message.role}`}
              key={showWritingState ? "active-assistant" : message.id}
            >
              <span className="codex-message-role">
                {message.role === "user"
                  ? locale === "fr"
                    ? "Vous"
                    : "You"
                  : locale === "fr"
                    ? "Assistant"
                    : "Assistant"}
              </span>
              {textParts.map((text, index) => (
                <p key={`${message.id}-text-${index}`}>
                  {text}
                  {showWritingCaret && index === textParts.length - 1 ? (
                    <span className="codex-stream-caret" aria-hidden="true" />
                  ) : null}
                </p>
              ))}
              {showWritingCue ? <CodexWritingCue locale={locale} status={status} /> : null}
              {readToolCalls(message).map((toolCall, index) => (
                <CodexToolCard key={`${message.id}-${toolCall.name}-${index}`} locale={locale} toolCall={toolCall} />
              ))}
            </article>
          );
        })}
        {showPendingAssistantMessage ? (
          <article
            className="codex-message codex-message-assistant"
            data-testid="codex-chat-pending-message"
            key="active-assistant"
          >
            <span className="codex-message-role">{locale === "fr" ? "Assistant" : "Assistant"}</span>
            <CodexWritingCue locale={locale} status={status} />
          </article>
        ) : null}
        {error ? (
          <article className="codex-message codex-message-assistant">
            <p>{error.message}</p>
          </article>
        ) : null}
        <div ref={logEndRef} aria-hidden="true" />
      </div>
      <form
        className="codex-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitMessage();
        }}
      >
        <label htmlFor="codex-chat-input">
          {locale === "fr" ? "Décrire la potion à préparer" : "Describe the potion to prepare"}
        </label>
        <div>
          <input
            id="codex-chat-input"
            data-testid="codex-chat-input"
            disabled={busy}
            onChange={(event) => setInput(event.target.value)}
            placeholder={locale === "fr" ? "Prépare une potion d'invisibilité" : "Prepare an invisibility potion"}
            value={input}
          />
          <button className="active-press" data-testid="codex-chat-submit" disabled={busy || !input.trim()} type="submit">
            {busy ? "..." : "Envoyer"}
          </button>
        </div>
        <small className="codex-chat-safety">
          {locale === "fr"
            ? "Seule l'action approuvée de création de potion peut modifier le stock."
            : "Only the approved potion creation action can change stock."}
        </small>
      </form>
    </aside>
  );
}

function CodexWritingCue({
  locale,
  status
}: {
  readonly locale: Locale;
  readonly status: "submitted" | "streaming" | "ready" | "error";
}): React.ReactElement {
  const label =
    status === "submitted"
      ? locale === "fr"
        ? "Analyse de la demande"
        : "Reading the request"
      : locale === "fr"
        ? "Réponse en cours"
        : "Writing the response";
  const detail =
    status === "submitted"
      ? locale === "fr"
        ? "L'assistant vérifie la formule et le stock."
        : "The assistant is checking the formula and stock."
      : locale === "fr"
        ? "Le texte et les cartes d'action arrivent en direct."
        : "Text and action cards are streaming live.";

  return (
    <div
      aria-label={label}
      className="codex-writing-row"
      data-testid="codex-chat-streaming"
      role="status"
    >
      <span className="codex-writing-vials" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function createInitialCodexMessages(locale: Locale): UIMessage[] {
  return [
    {
      id: "codex-wake",
      role: "assistant",
      parts: [
        {
          type: "text",
          text:
            locale === "fr"
              ? "Assistant potion prêt. Demandez une formule par son nom ou décrivez trois ingrédients."
              : "Potion assistant ready. Ask for a formula by name or describe three ingredients."
        }
      ]
    }
  ];
}

function readTextParts(message: UIMessage): string[] {
  return message.parts
    .filter((part): part is { readonly type: "text"; readonly text: string } => part.type === "text")
    .map((part) => part.text)
    .filter((text) => text.length > 0);
}

function readToolCalls(message: UIMessage): PotionChatToolCall[] {
  return message.parts
    .filter((part) => part.type === "tool-create_potion")
    .map((part) => (part as { readonly output?: unknown }).output)
    .filter(isPotionChatToolCall);
}

function readStateChangedToolCall(message: UIMessage): PotionChatToolCall | null {
  return readToolCalls(message).find((toolCall) => toolCall.stateChanged) ?? null;
}

function isPotionChatToolCall(value: unknown): value is PotionChatToolCall {
  return Boolean(
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string" &&
    "status" in value &&
    (value.status === "success" || value.status === "error") &&
    "stateChanged" in value &&
    typeof value.stateChanged === "boolean" &&
    "message" in value &&
    typeof value.message === "string" &&
    "ui" in value &&
    value.ui &&
    typeof value.ui === "object" &&
    "type" in value.ui &&
    typeof value.ui.type === "string"
  );
}

function CodexToolCard({
  locale,
  toolCall
}: {
  readonly locale: Locale;
  readonly toolCall: PotionChatToolCall;
}): React.ReactElement {
  const data = toolCall.data as {
    readonly potion?: { readonly name?: string; readonly recipeId?: string };
    readonly inventoryDelta?: readonly {
      readonly name?: string;
      readonly before?: number;
      readonly after?: number;
      readonly delta?: number;
    }[];
    readonly recipes?: readonly { readonly name?: string; readonly ingredientNames?: readonly string[] }[];
    readonly code?: string;
  };

  return (
    <div className={`codex-tool-card codex-tool-card-${toolCall.status}`} data-testid={`codex-tool-${toolCall.name}`}>
      <span className="codex-tool-status">
        {toolCall.status === "success"
          ? locale === "fr"
            ? "Action exécutée : potion créée"
            : "Action completed: potion created"
          : locale === "fr"
            ? "Action non exécutée"
            : "Action not completed"}
      </span>
      <strong>{data.potion?.name ?? toolCall.message}</strong>
      {data.inventoryDelta ? (
        <ul>
          {data.inventoryDelta.map((delta) => (
            <li key={delta.name}>
              {delta.name}: {delta.before} → {delta.after} ({delta.delta})
            </li>
          ))}
        </ul>
      ) : null}
      {data.recipes ? (
        <ul>
          {data.recipes.map((recipe) => (
            <li key={recipe.name}>
              {recipe.name} · {recipe.ingredientNames?.join(" + ")}
            </li>
          ))}
        </ul>
      ) : null}
      <small className="codex-tool-proof">
        {locale === "fr" ? "Outil approuvé" : "Approved tool"}: {toolCall.name}
        {data.code ? ` · ${data.code}` : ""}
      </small>
    </div>
  );
}

function DashboardLaunchpad({
  completionRatio,
  copy,
  depletedCount,
  discoveredCount,
  potionCount
}: {
  readonly completionRatio: number;
  readonly copy: PotionCopy;
  readonly depletedCount: number;
  readonly discoveredCount: number;
  readonly potionCount: number;
}): React.ReactElement {
  const cards = [
    { href: "/recipes" as const, copy: copy.dashboard.cards.recipes, state: `${discoveredCount}/9` },
    { href: "/composer" as const, copy: copy.dashboard.cards.composer, state: copy.dashboard.quest.active },
    { href: "/inventory" as const, copy: copy.dashboard.cards.inventory, state: depletedCount === 0 ? "OK" : `${depletedCount}` }
  ];

  return (
    <section className="dashboard-launchpad stitch-grid-12" aria-label={copy.atelier.viewIntro.dashboard[0]}>
      <div className="dashboard-kpis trace-line" aria-label={copy.dashboard.quest.title}>
        <p className="quest-label">{copy.dashboard.quest.title}</p>
        <article>
          <span>{copy.dashboard.quest.codexProgress}</span>
          <strong>{completionRatio}%</strong>
        </article>
        <article>
          <span>{copy.dashboard.quest.trial}</span>
          <strong>{potionCount}</strong>
        </article>
        <article>
          <span>{copy.dashboard.quest.vaultAlert}</span>
          <strong>{depletedCount}</strong>
        </article>
      </div>
      <div className="dashboard-cards">
        {cards.map((card) => (
          <Link className="dashboard-card interactive-press trace-line" href={card.href} key={card.href}>
            <span className="quest-status">{card.copy[0]} / {card.state}</span>
            <strong>{card.copy[1]}</strong>
            <small>{card.copy[2]}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroTheatre({
  completionRatio,
  copy,
  depletedCount,
  locale,
  loading
}: {
  readonly completionRatio: number;
  readonly copy: PotionCopy;
  readonly depletedCount: number;
  readonly locale: Locale;
  readonly loading: boolean;
}): React.ReactElement {
  return (
    <section className="hero-theatre stitch-grid-12" aria-labelledby="page-title">
      <div className="hero-copy-block">
        <div className="lab-mark">{copy.hero.mark}</div>
        <p className="eyebrow">{copy.hero.eyebrow}</p>
        <h1 id="page-title">{copy.hero.title}</h1>
        <p className="hero-copy">{copy.hero.body}</p>
        <Link className="hero-cta active-press" href="/composer">
          {copy.hero.cta}
        </Link>
        <div className="hero-trial-strip" aria-label={copy.dashboard.quest.rank}>
          <span>{copy.dashboard.quest.rank}</span>
          <strong>{completionRatio}%</strong>
          <small>{copy.dashboard.quest.codexProgress}</small>
        </div>
      </div>

      <div className="servier-motif" aria-hidden="true">
        <div className="servier-proximity-ring servier-proximity-ring-one" />
        <div className="servier-proximity-ring servier-proximity-ring-two" />
        <div className="servier-motif-star" />
        <div className="servier-motif-smile" />
      </div>

      <div className="hero-metrics trace-line" aria-label="État de l'atelier">
        <article>
          <span>{copy.hero.sync}</span>
          <strong>{loading ? "..." : "API"}</strong>
        </article>
        <article>
          <span>{copy.hero.codex}</span>
          <strong>{completionRatio}%</strong>
        </article>
        <article>
          <span>{copy.hero.criticalStock}</span>
          <strong>{depletedCount}</strong>
        </article>
      </div>
    </section>
  );
}

function AtelierStepper({
  activeStage,
  copy,
  selectedCount
}: {
  readonly activeStage: AtelierStage;
  readonly copy: PotionCopy;
  readonly selectedCount: number;
}): React.ReactElement {
  const steps: ReadonlyArray<{
    readonly id: AtelierStage;
    readonly label: string;
    readonly detail: string;
  }> = [
    { id: "choose", label: copy.atelier.steps[0], detail: copy.atelier.stepDetails[0] },
    { id: "compose", label: copy.atelier.steps[1], detail: `${selectedCount}/3 ${copy.atelier.stepDetails[1]}` },
    { id: "distill", label: copy.atelier.steps[2], detail: copy.atelier.stepDetails[2] }
  ];

  return (
    <ol className="atelier-stepper trace-line" aria-label="Étapes de composition" data-testid="atelier-stepper">
      {steps.map((step) => (
        <li className={step.id === activeStage ? "is-active" : ""} key={step.id}>
          <span aria-current={step.id === activeStage ? "step" : undefined}>{step.label}</span>
          <strong>{step.detail}</strong>
        </li>
      ))}
    </ol>
  );
}

function CauldronComposer({
  busy,
  copy,
  loading,
  notice,
  onClear,
  onCombine,
  onRemoveIngredient,
  selectedIngredientIds,
  selectedNames,
  targetRecipe
}: {
  readonly busy: boolean;
  readonly copy: PotionCopy;
  readonly loading: boolean;
  readonly notice: Notice;
  readonly onClear: () => void;
  readonly onCombine: () => void;
  readonly onRemoveIngredient: (ingredientId: string) => void;
  readonly selectedIngredientIds: readonly string[];
  readonly selectedNames: readonly string[];
  readonly targetRecipe: RecipeView | null;
}): React.ReactElement {
  return (
    <section
      className={`cauldron-panel trace-line ${selectedIngredientIds.length === 3 ? "is-ready" : ""}`}
      aria-labelledby="composer-title"
      data-testid="cauldron-panel"
    >
      <div className="cauldron-visual" aria-hidden="true">
        <span />
      </div>
      <div className="composer-copy">
        <p className="eyebrow">{copy.composer.eyebrow}</p>
        <h2 id="composer-title">{copy.composer.title}</h2>
        <p>
          {targetRecipe
            ? formatCopy(copy.composer.guided, { recipe: targetRecipe.name })
            : copy.composer.free}
        </p>
      </div>

      <div className="selection-tray" aria-label="Ingrédients dans le chaudron">
        {[0, 1, 2].map((slot) => {
          const ingredientId = selectedIngredientIds[slot];
          const name = selectedNames[slot];

          return (
            <div
              className={[
                "selection-slot trace-line",
                ingredientId ? "is-filled" : "",
                selectedIngredientIds.length === slot ? "is-next" : ""
              ].join(" ")}
              key={slot}
            >
              <span>{copy.composer.sockets[slot]}</span>
              {ingredientId ? (
                <button onClick={() => onRemoveIngredient(ingredientId)} type="button">
                  <strong>{name}</strong>
                  <small>{copy.composer.remove}</small>
                </button>
              ) : (
                <strong>{copy.composer.emptySlot}</strong>
              )}
            </div>
          );
        })}
      </div>

      <div className={`notice notice-${notice.tone}`} data-testid="notice" role="status">
        {loading ? copy.notices.loading : notice.text}
      </div>

      <div className="control-row">
        <button
          className="primary-action active-press"
          data-testid="combine-button"
          disabled={busy || selectedIngredientIds.length !== 3}
          onClick={onCombine}
          type="button"
        >
          {copy.composer.combine}
        </button>
        <button
          className="ghost-action active-press"
          disabled={busy || selectedIngredientIds.length === 0}
          onClick={onClear}
          type="button"
        >
          {copy.composer.clear}
        </button>
      </div>
    </section>
  );
}

function IngredientTokenBoard({
  busy,
  copy,
  focusedIngredientId,
  ingredients,
  inventoryById,
  locale,
  mode,
  notice,
  onRestockInventory,
  onSetQuantity,
  onToggleIngredient,
  selectedIngredientIds,
  targetRecipe
}: {
  readonly busy: boolean;
  readonly copy: PotionCopy;
  readonly focusedIngredientId?: string | undefined;
  readonly ingredients: readonly IngredientView[];
  readonly inventoryById: ReadonlyMap<string, InventoryView>;
  readonly locale: Locale;
  readonly mode: "compose" | "manage";
  readonly notice: Notice;
  readonly onRestockInventory: () => void;
  readonly onSetQuantity: (ingredientId: string, quantity: number) => void;
  readonly onToggleIngredient: (ingredientId: string) => void;
  readonly selectedIngredientIds: readonly string[];
  readonly targetRecipe: RecipeView | null;
}): React.ReactElement {
  const isComposeMode = mode === "compose";
  const ledgerColumns =
    locale === "fr" ? ["Index", "Réactif", "Quantité", "Actions"] : ["Index", "Reagent", "Quantity", "Actions"];

  return (
    <section className="inventory-panel trace-line" aria-labelledby="inventory-title" data-testid="inventory-panel">
      <PanelHeader
        actions={
          <p>{isComposeMode ? formatCopy(copy.inventory.selected, { count: selectedIngredientIds.length }) : copy.inventory.management}</p>
        }
        eyebrow={copy.inventory.eyebrow}
        title={copy.inventory.title}
        titleId="inventory-title"
      >
        {!isComposeMode ? (
          <ActionButton
            className="inventory-restock-action active-press"
            data-testid="inventory-restock-button"
            disabled={busy}
            onClick={onRestockInventory}
            type="button"
          >
            {copy.inventory.restock}
          </ActionButton>
        ) : null}
      </PanelHeader>
      {!isComposeMode ? (
        <p className={`inventory-notice inventory-notice-${notice.tone}`} data-testid="inventory-notice" role="status">
          {notice.text}
        </p>
      ) : null}
      {!isComposeMode ? (
        <div className="stock-ledger-header" aria-hidden="true">
          {ledgerColumns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
      ) : null}
      <div className="inventory-grid">
        {ingredients.map((ingredient, index) => {
          const inventoryItem = inventoryById.get(ingredient.id);
          const quantity = inventoryItem?.quantity ?? 0;
          const selected = selectedIngredientIds.includes(ingredient.id);
          const guided = targetRecipe?.ingredientIds.includes(ingredient.id) ?? false;
          const focused = focusedIngredientId === ingredient.id;
          const cannotSelect = busy || (quantity === 0 && !selected);

          return (
            <StockIngredientCard
              busy={busy}
              cannotSelect={cannotSelect}
              copy={copy}
              focused={focused}
              guided={guided}
              ingredient={ingredient}
              index={index}
              isComposeMode={isComposeMode}
              key={ingredient.id}
              mode={mode}
              onSetQuantity={onSetQuantity}
              onToggleIngredient={onToggleIngredient}
              quantity={quantity}
              selected={selected}
            />
          );
        })}
      </div>
    </section>
  );
}

function RecipeCodex({
  completionRatio,
  createdRecipeId,
  copy,
  ingredientNamesById,
  onSelectTarget,
  recipes,
  targetRecipeId
}: {
  readonly completionRatio: number;
  readonly createdRecipeId: string | null;
  readonly copy: PotionCopy;
  readonly ingredientNamesById: ReadonlyMap<string, string>;
  readonly onSelectTarget: (recipeId: string) => void;
  readonly recipes: readonly RecipeView[];
  readonly targetRecipeId: string | null;
}): React.ReactElement {
  return (
    <section className="codex-panel trace-line" aria-labelledby="recipes-title" data-testid="codex-panel">
      <PanelHeader
        actions={
          <div className="completion-gauge" aria-label={`${completionRatio}% recettes découvertes`}>
            <span style={{ inlineSize: `${completionRatio}%` }} />
          </div>
        }
        eyebrow={copy.recipes.eyebrow}
        title={copy.recipes.title}
        titleId="recipes-title"
      />
      <div className="recipe-grid">
        {recipes.map((recipe, index) => (
          <FormulaCard
            copy={copy}
            created={recipe.id === createdRecipeId}
            formulaNumber={index + 1}
            ingredientNamesById={ingredientNamesById}
            key={recipe.id}
            onSelectTarget={onSelectTarget}
            recipe={recipe}
            targeted={recipe.id === targetRecipeId}
          />
        ))}
      </div>
    </section>
  );
}

function PanelHeader({
  actions,
  children,
  eyebrow,
  title,
  titleId
}: {
  readonly actions?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly eyebrow: string;
  readonly title: string;
  readonly titleId: string;
}): React.ReactElement {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </div>
      {actions || children ? (
        <div className="inventory-header-actions">
          {actions}
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>): React.ReactElement {
  return <button className={className.includes("active-press") ? className : `active-press ${className}`.trim()} {...props} />;
}

function StockIngredientCard({
  busy,
  cannotSelect,
  copy,
  focused,
  guided,
  ingredient,
  index,
  isComposeMode,
  mode,
  onSetQuantity,
  onToggleIngredient,
  quantity,
  selected
}: {
  readonly busy: boolean;
  readonly cannotSelect: boolean;
  readonly copy: PotionCopy;
  readonly focused: boolean;
  readonly guided: boolean;
  readonly ingredient: IngredientView;
  readonly index: number;
  readonly isComposeMode: boolean;
  readonly mode: "compose" | "manage";
  readonly onSetQuantity: (ingredientId: string, quantity: number) => void;
  readonly onToggleIngredient: (ingredientId: string) => void;
  readonly quantity: number;
  readonly selected: boolean;
}): React.ReactElement {
  return (
    <article
      className={[
        "ingredient-card trace-line interactive-press",
        selected ? "is-selected" : "",
        guided ? "is-guided" : "",
        focused ? "is-focused" : "",
        quantity === 0 ? "is-depleted" : ""
      ].join(" ")}
      data-testid={`ingredient-${ingredient.id}`}
    >
      <span className="ingredient-index">{String(index + 1).padStart(2, "0")}</span>
      {isComposeMode && guided ? (
        <span className="target-chip" data-testid={`target-chip-${ingredient.id}`}>
          {copy.inventory.protocolChip}
        </span>
      ) : null}
      <div className="ingredient-identity">
        <h3>{ingredient.name}</h3>
        <small className="reagent-state">
          {isComposeMode && selected
            ? copy.composer.socketReady
            : isComposeMode && guided
              ? copy.recipes.guided
              : copy.inventory.management}
        </small>
      </div>
      {!isComposeMode ? (
        <>
          <div className={`card-actions card-actions-${mode}`}>
            <StockStepper
              busy={busy}
              ingredient={ingredient}
              onSetQuantity={onSetQuantity}
              quantity={quantity}
            />
          </div>
          <div className="inventory-stock-rack">
            <p className="ingredient-stock-copy">{formatCopy(copy.inventory.stock, { quantity })}</p>
            <StockMeter quantity={quantity} />
          </div>
        </>
      ) : (
        <>
          <p className="ingredient-stock-copy">{formatCopy(copy.inventory.stock, { quantity })}</p>
          <StockMeter quantity={quantity} />
        </>
      )}
      {isComposeMode ? (
        <div className={`card-actions card-actions-${mode}`}>
          <ActionButton
            aria-pressed={selected}
            data-testid={`select-${ingredient.id}`}
            disabled={cannotSelect}
            onClick={() => onToggleIngredient(ingredient.id)}
            type="button"
          >
            {selected ? copy.inventory.remove : copy.inventory.choose}
          </ActionButton>
          {quantity === 0 ? (
          <Link className="manage-stock-link active-press" href={{ pathname: "/inventory", query: { ingredient: ingredient.id } }}>
            {copy.inventory.manage}
          </Link>
        ) : null}
      </div>
      ) : null}
    </article>
  );
}

function StockStepper({
  busy,
  ingredient,
  onSetQuantity,
  quantity
}: {
  readonly busy: boolean;
  readonly ingredient: IngredientView;
  readonly onSetQuantity: (ingredientId: string, quantity: number) => void;
  readonly quantity: number;
}): React.ReactElement {
  return (
    <div className="stock-stepper" aria-label={`Ajuster le stock de ${ingredient.name}`}>
      <ActionButton
        aria-label={`Retirer une unité de ${ingredient.name}`}
        data-testid={`decrement-${ingredient.id}`}
        disabled={busy || quantity === 0}
        onClick={() => onSetQuantity(ingredient.id, quantity - 1)}
        type="button"
      >
        −
      </ActionButton>
      <span aria-label={`Quantité actuelle ${quantity}`}>{quantity}</span>
      <ActionButton
        aria-label={`Ajouter une unité de ${ingredient.name}`}
        data-testid={`recharge-${ingredient.id}`}
        disabled={busy}
        onClick={() => onSetQuantity(ingredient.id, quantity + 1)}
        type="button"
      >
        +
      </ActionButton>
    </div>
  );
}

function FormulaCard({
  copy,
  created,
  formulaNumber,
  ingredientNamesById,
  onSelectTarget,
  recipe,
  targeted
}: {
  readonly copy: PotionCopy;
  readonly created: boolean;
  readonly formulaNumber: number;
  readonly ingredientNamesById: ReadonlyMap<string, string>;
  readonly onSelectTarget: (recipeId: string) => void;
  readonly recipe: RecipeView;
  readonly targeted: boolean;
}): React.ReactElement {
  return (
    <article
      className={[
        "recipe-card trace-line interactive-press",
        recipe.discovered ? "is-discovered" : "",
        targeted ? "is-targeted" : "",
        created ? "is-new" : ""
      ].join(" ")}
      data-testid={`recipe-${recipe.id}`}
    >
      <span className="formula-kicker">
        <span>Formula #{String(formulaNumber).padStart(3, "0")}</span>
        <span>{created ? copy.dashboard.quest.active : recipe.discovered ? copy.recipes.created : copy.recipes.pending}</span>
      </span>
      <div className="formula-body">
        <span className="formula-sigil" aria-hidden="true" />
        <h3>{recipe.name}</h3>
        <small>{copy.recipes.collection}</small>
        <p className="formula-reagents">
          {recipe.ingredientIds.map((id, index) => (
            <span key={id}>
              {index > 0 ? " + " : ""}
              <span className="formula-chip">{ingredientNamesById.get(id) ?? id}</span>
            </span>
          ))}
        </p>
      </div>
      <div className="formula-action-row">
        <span>{targeted ? copy.recipes.guided : recipe.discovered ? copy.recipes.created : copy.recipes.pending}</span>
        <ActionButton onClick={() => onSelectTarget(recipe.id)} type="button">
          {targeted ? copy.recipes.guided : copy.recipes.guide}
        </ActionButton>
      </div>
    </article>
  );
}

function PotionLedger({
  copy,
  ingredientNamesById,
  lastCreatedPotionId,
  potions
}: {
  readonly copy: PotionCopy;
  readonly ingredientNamesById: ReadonlyMap<string, string>;
  readonly lastCreatedPotionId: string | null;
  readonly potions: readonly PotionView[];
}): React.ReactElement {
  return (
    <section className="ledger-panel trace-line" aria-labelledby="history-title" data-testid="ledger-panel">
      <p className="eyebrow">{copy.ledger.eyebrow}</p>
      <h2 id="history-title">{copy.ledger.title}</h2>
      {potions.length === 0 ? (
        <p className="empty-state">{copy.ledger.empty}</p>
      ) : (
        <ol data-testid="potion-ledger">
          {potions.map((potion) => (
            <li className={`trace-line ${potion.id === lastCreatedPotionId ? "is-new" : ""}`} key={potion.id}>
              <span className="ledger-sigil" aria-hidden="true" />
              <strong>{potion.name}</strong>
              <span>{potion.ingredientIds.map((id) => ingredientNamesById.get(id) ?? id).join(" / ")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StockMeter({ quantity }: { readonly quantity: number }): React.ReactElement {
  return (
    <div className="stock-meter" aria-label={`Stock ${quantity}`}>
      {Array.from({ length: 5 }, (_, dotIndex) => (
        <span className={dotIndex < Math.min(quantity, 5) ? "is-lit" : ""} key={dotIndex} />
      ))}
    </div>
  );
}

function DiscoveryPanel({
  ingredientCount,
  locale,
  recipeCount,
  selectedIngredientIds,
  selectedNames,
  selectedRecipe
}: {
  readonly ingredientCount: number;
  readonly locale: Locale;
  readonly recipeCount: number;
  readonly selectedIngredientIds: readonly string[];
  readonly selectedNames: readonly string[];
  readonly selectedRecipe: RecipeView | undefined;
}): React.ReactElement {
  const totalCandidates = ingredientCount < 3 ? 0 : (ingredientCount * (ingredientCount - 1) * (ingredientCount - 2)) / 6;
  const gameSuccessRate = totalCandidates === 0 ? 0 : (recipeCount / totalCandidates) * 100;
  const rejectedRatio = Math.max(0, 100 - gameSuccessRate);
  const hasCandidate = selectedIngredientIds.length === 3;
  const copy =
    locale === "fr"
      ? {
          eyebrow: "Épreuve IA",
          title: "Réveiller le grimoire sans financer le bruit.",
          body: "Chaque triple d'ingrédients devient une hypothèse jouable : le cockpit révèle les rares formules SERVIER sans inventer de faux scores.",
          candidates: "candidats possibles",
          validated: "recettes validées",
          business: "bruit écarté",
          verdict: selectedRecipe
            ? `${selectedRecipe.name} est une découverte validée.`
            : hasCandidate
              ? `${selectedNames.join(" + ")} reste une hypothèse expérimentale, non canonique.`
              : "Sélectionnez trois ingrédients pour réveiller une hypothèse.",
          secretTitle: "Recettes secrètes (bonus)",
          secretBody: "Ces pistes restent hors contrat canonique : elles stimulent l'exploration sans modifier les 9 recettes SERVIER validées."
        }
      : {
          eyebrow: "AI trial",
          title: "Awaken the codex without funding noise.",
          body: "Every ingredient triple becomes a playable hypothesis: the cockpit reveals rare SERVIER formulas without inventing fake scores.",
          candidates: "possible candidates",
          validated: "validated recipes",
          business: "noise rejected",
          verdict: selectedRecipe
            ? `${selectedRecipe.name} is a validated discovery.`
            : hasCandidate
              ? `${selectedNames.join(" + ")} remains an experimental, non-canonical hypothesis.`
              : "Select three ingredients to awaken a hypothesis.",
          secretTitle: "Secret recipes (bonus)",
          secretBody: "These leads stay outside the canonical contract: they encourage exploration without changing the 9 validated SERVIER recipes."
        };
  const secretRecipes = [
    "Neuro-protection",
    "Cardio-résilience",
    "Onco-signal faible"
  ];

  return (
    <section className="discovery-panel stitch-grid-12 trace-line" aria-labelledby="discovery-title" data-testid="discovery-panel">
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 id="discovery-title">{copy.title}</h2>
        <p>{copy.body}</p>
      </div>
      <div className="discovery-metrics">
        <article>
          <span>{copy.candidates}</span>
          <strong>{totalCandidates}</strong>
        </article>
        <article>
          <span>{copy.validated}</span>
          <strong>{recipeCount}</strong>
          <small>{gameSuccessRate.toFixed(1)}%</small>
        </article>
        <article>
          <span>{copy.business}</span>
          <strong>{rejectedRatio.toFixed(1)}%</strong>
          <small>{gameSuccessRate.toFixed(1)}% signal</small>
        </article>
      </div>
      <div className="candidate-verdict" data-testid="candidate-verdict">
        {copy.verdict}
      </div>
      <div className="secret-recipes" aria-label={copy.secretTitle}>
        <strong>{copy.secretTitle}</strong>
        <p>{copy.secretBody}</p>
        <div>
          {secretRecipes.map((secretRecipe) => (
            <span key={secretRecipe}>{secretRecipe}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function findRecipeByIngredientSet(
  recipes: readonly RecipeView[],
  selectedIngredientIds: readonly string[]
): RecipeView | undefined {
  if (selectedIngredientIds.length !== 3) {
    return undefined;
  }

  const selected = new Set(selectedIngredientIds);
  return recipes.find(
    (recipe) =>
      recipe.ingredientIds.length === selected.size &&
      recipe.ingredientIds.every((ingredientId) => selected.has(ingredientId))
  );
}

function getActiveStage(selectedCount: number): AtelierStage {
  if (selectedCount === 0) {
    return "choose";
  }
  if (selectedCount < 3) {
    return "compose";
  }
  return "distill";
}
function composerDraftKey(locale: Locale): string {
  return `servier-potion-lab:${locale}:composer-draft`;
}

function readComposerDraft(locale: Locale): ComposerDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawDraft = window.localStorage.getItem(composerDraftKey(locale));
  if (!rawDraft) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawDraft) as Partial<ComposerDraft>;
    if (
      typeof parsed !== "object" ||
      !parsed ||
      (parsed.targetRecipeId !== undefined &&
        parsed.targetRecipeId !== null &&
        typeof parsed.targetRecipeId !== "string") ||
      !Array.isArray(parsed.selectedIngredientIds)
    ) {
      return null;
    }

    return {
      targetRecipeId: parsed.targetRecipeId ?? null,
      selectedIngredientIds: parsed.selectedIngredientIds.filter(
        (ingredientId): ingredientId is string => typeof ingredientId === "string"
      )
    };
  } catch {
    return null;
  }
}

function writeComposerDraft(locale: Locale, draft: ComposerDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!draft.targetRecipeId && draft.selectedIngredientIds.length === 0) {
    clearComposerDraft(locale);
    return;
  }

  window.localStorage.setItem(composerDraftKey(locale), JSON.stringify(draft));
}

function clearComposerDraft(locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(composerDraftKey(locale));
}

function toProductMessage(message: string, copy: PotionCopy): string {
  if (message.includes("No potion recipe matches")) {
    return copy.notices.invalidRecipe;
  }
  if (message.toLowerCase().includes("stock")) {
    return copy.notices.insufficient;
  }
  return message;
}
