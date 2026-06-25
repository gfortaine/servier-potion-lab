# ADR 0004: MCP agent surface implementation

## Status

Accepted

## Context

ADR 0003 identified MCP as the right future adapter for external AI agents, provided it reused the same application use cases and repository ports as the REST/browser path. The project now includes `apps/mcp`, and the in-product Potion assistant also uses a shared tool layer.

The browser assistant and MCP server serve different clients:

- the browser assistant exposes exactly one model-callable tool, `create_potion`, so product users see a safe, focused creation path;
- the MCP server exposes a broader stdio tool surface for external agents and evaluator workflows.

## Decision

Implement MCP as an optional stdio app in `apps/mcp`.

The MCP server wires `createPrismaClient -> PrismaPotionRepository -> PotionLabApplication -> PotionToolService` in-process. It does not call the REST API and does not access Prisma directly from tool handlers. Because it uses the PostgreSQL repository adapter, it requires `DATABASE_URL`.

The implemented MCP tools are:

| Tool | Mutates state | Application path |
|---|---:|---|
| `list_ingredients` | No | `PotionToolService.listIngredients` |
| `list_inventory` | No | `PotionToolService.listInventory` |
| `list_recipes` | No | `PotionToolService.listRecipes` |
| `list_potions` | No | `PotionToolService.listPotions` |
| `create_potion` | Yes | `PotionToolService.createPotionByRecipeName` or `createPotionByIngredientIds` |
| `recharge_inventory` | Yes | `PotionToolService.rechargeInventory` |
| `randomize_inventory` | Yes | `PotionToolService.randomizeInventory` |

## Consequences

- External agents can inspect and operate the lab without gaining raw database or filesystem access.
- Mutating MCP tools preserve the same domain validation and Prisma transaction path as browser/API mutations.
- The MCP server remains optional and separate from the Vercel/browser reviewer path.
- The browser assistant remains intentionally narrower: it exposes only `create_potion` to the live model.
