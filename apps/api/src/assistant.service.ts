import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { z } from "zod";
import { INGREDIENTS, RECIPES } from "@servier-potion-lab/domain";

const assistantRequestSchema = z.object({
  question: z.string().min(1).max(600),
  inventorySummary: z.string().max(600).optional()
});

type AssistantIntent = "recipe_help" | "inventory_help" | "architecture_help" | "general_help";

interface RagSnippet {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

interface AssistantGraphState {
  readonly question: string;
  readonly inventorySummary?: string;
  readonly intent?: AssistantIntent;
  readonly context?: readonly RagSnippet[];
  readonly answer?: AssistantResponse;
}

export interface AssistantResponse {
  readonly answer: string;
  readonly intent: AssistantIntent;
  readonly providerRoute: "local-rag" | "azure-openai-ready" | "mistral-ready" | "openai-ready";
  readonly citations: readonly string[];
  readonly liveProviderUsed: false;
}

const AssistantState = Annotation.Root({
  question: Annotation<string>(),
  inventorySummary: Annotation<string | undefined>(),
  intent: Annotation<AssistantIntent | undefined>(),
  context: Annotation<readonly RagSnippet[] | undefined>(),
  answer: Annotation<AssistantResponse | undefined>()
});

@Injectable()
export class AssistantService {
  private readonly graph = createAssistantGraph();

  async answer(rawRequest: unknown): Promise<AssistantResponse> {
    if (process.env.SERVIER_ASSISTANT_ENABLED !== "true") {
      throw new NotFoundException({
        code: "ASSISTANT_DISABLED",
        message: "LangGraph assistant is disabled unless SERVIER_ASSISTANT_ENABLED=true."
      });
    }

    const parsed = assistantRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "INVALID_ASSISTANT_REQUEST",
        message: "question is required and must be a non-empty string.",
        details: parsed.error.issues.map((issue) => issue.path.join("."))
      });
    }

    const result = await this.graph.invoke({
      question: parsed.data.question,
      inventorySummary: parsed.data.inventorySummary
    });

    if (!result.answer) {
      throw new Error("LangGraph assistant completed without an answer.");
    }

    return result.answer;
  }
}

function createAssistantGraph() {
  return new StateGraph(AssistantState)
    .addNode("classify", classifyIntent)
    .addNode("retrieve", retrieveContext)
    .addNode("compose", composeAnswer)
    .addEdge(START, "classify")
    .addEdge("classify", "retrieve")
    .addEdge("retrieve", "compose")
    .addEdge("compose", END)
    .compile();
}

function classifyIntent(state: AssistantGraphState): Partial<AssistantGraphState> {
  const normalized = normalize(state.question);

  if (matchesAny(normalized, ["inventory", "stock", "recharge", "quantity", "quantite"])) {
    return { intent: "inventory_help" };
  }
  if (matchesAny(normalized, ["azure", "openai", "rag", "langgraph", "architecture", "provider"])) {
    return { intent: "architecture_help" };
  }
  if (matchesAny(normalized, ["recipe", "potion", "ingredient", "combine", "recette"])) {
    return { intent: "recipe_help" };
  }

  return { intent: "general_help" };
}

function retrieveContext(state: AssistantGraphState): Partial<AssistantGraphState> {
  const intent = state.intent ?? "general_help";
  const snippets = createKnowledgeBase();
  const context = snippets.filter((snippet) => snippet.id.startsWith(intent));

  return {
    context: context.length > 0 ? context : snippets.filter((snippet) => snippet.id.startsWith("general_help"))
  };
}

function composeAnswer(state: AssistantGraphState): Partial<AssistantGraphState> {
  const intent = state.intent ?? "general_help";
  const context = state.context ?? [];
  const citations = context.map((snippet) => snippet.id);
  const providerRoute = selectProviderRoute();
  const contextText = context.map((snippet) => `${snippet.title}: ${snippet.text}`).join(" ");
  const inventorySentence = state.inventorySummary
    ? ` Current inventory signal: ${state.inventorySummary}.`
    : "";

  return {
    answer: {
      intent,
      providerRoute,
      citations,
      liveProviderUsed: false,
      answer: `${contextText}${inventorySentence} This response is generated locally by the LangGraph RAG path; live model calls stay disabled for mandatory verification.`
    }
  };
}

function createKnowledgeBase(): readonly RagSnippet[] {
  const ingredientNames = INGREDIENTS.map((ingredient) => ingredient.name).join(", ");
  const recipeNames = RECIPES.map((recipe) => recipe.name).join(", ");

  return [
    {
      id: "recipe_help:servier-rules",
      title: "SERVIER recipe rules",
      text: `A valid potion always uses exactly three known ingredients. The recipe grimoire contains ${RECIPES.length} recipes: ${recipeNames}.`
    },
    {
      id: "recipe_help:ingredient-catalog",
      title: "Ingredient catalog",
      text: `The lab tracks ${INGREDIENTS.length} ingredients: ${ingredientNames}.`
    },
    {
      id: "inventory_help:ledger",
      title: "Inventory ledger",
      text: "Every successful potion consumes one unit of each selected ingredient; recharge and randomize controls are explicit user actions."
    },
    {
      id: "architecture_help:provider-routing",
      title: "Provider routing",
      text: "The graph is provider-agnostic: local RAG is mandatory-test safe, Azure OpenAI is the SERVIER-aligned live route, and Mistral/OpenAI can be enabled later behind environment gates."
    },
    {
      id: "architecture_help:azure",
      title: "Azure alignment",
      text: "The assistant is designed as an API seam that can later connect to Azure OpenAI, Azure AI Search, and Application Insights without changing the deterministic game core."
    },
    {
      id: "general_help:game",
      title: "Potion lab guide",
      text: "Select three charged ingredients, combine them, review the result in potion history, and discover recipes progressively."
    }
  ];
}

function selectProviderRoute(): AssistantResponse["providerRoute"] {
  const requestedProvider = process.env.SERVIER_AI_PROVIDER?.toLowerCase();
  if (requestedProvider === "azure-openai") {
    return "azure-openai-ready";
  }
  if (requestedProvider === "mistral") {
    return "mistral-ready";
  }
  if (requestedProvider === "openai") {
    return "openai-ready";
  }

  return "local-rag";
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
