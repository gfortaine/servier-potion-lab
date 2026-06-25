# ADR 0003: Agent adapter and MCP

## Status

Superseded by [ADR 0004: MCP agent surface implementation](0004-mcp-agent-surface-implementation.md)

## Context

The product already includes an env-gated assistant endpoint, and the broader loop-engineering goal includes agent interoperability. MCP is useful for exposing application capabilities as tools to AI agents, but it should not replace the public REST API.

## Decision

MCP is an optional future adapter over `PotionLabApplication`.

If implemented, MCP tools must call the same application use cases and repository ports as REST. In particular, a `create_potion` tool must reuse the same atomic `PrismaPotionRepository.recordPotion` path rather than mutating Prisma directly.

## Proposed tool boundary

| Tool | Application use case |
|---|---|
| `list_ingredients` | `PotionLabApplication.listIngredients` |
| `list_inventory` | `PotionLabApplication.listInventory` |
| `list_recipes` | `PotionLabApplication.listRecipes` |
| `create_potion` | `PotionLabApplication.createPotion` |
| `recharge_inventory` | `PotionLabApplication.recharge` |
| `randomize_inventory` | `PotionLabApplication.randomizeInventory` |

## Consequences

- Agent access stays consistent with browser/API behavior.
- MCP can be hosted as `apps/mcp`, `packages/mcp-server`, or an API-side optional process later.
- The adapter must be env-gated and excluded from the required reviewer path unless explicitly enabled.
