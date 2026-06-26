# Architecture

## Current scaffold

This scaffold deliberately separates the SERVIER test into Turborepo-managed deployable or reusable boundaries:

| Boundary | Responsibility |
|---|---|
| `apps/web` | Customer-facing Next.js App Router experience with a persistent localized app shell, next-intl SEO paths for `/fr/composer-une-potion`, `/fr/recettes`, `/fr/inventaire` and `/en/composer`, `/en/recipes`, `/en/inventory`, covering ingredient selection, discovered recipes/potions, stock management, and the Potion assistant through the API. |
| `apps/api` | NestJS HTTP adapter for inventory CRUD, recipe validation, potion creation, health/readiness, OpenAPI, and assistant chat routes. |
| `apps/mcp` | Optional stdio MCP adapter for external agents. It exposes bounded tools over the same application layer and requires `DATABASE_URL`. |
| `packages/domain` | Pure deterministic domain and application layer: `difa_` recipe rules, inventory rules, repository ports, and use cases without web/API/database/LLM dependencies. |
| `packages/db` | Prisma schema, Prisma migrations, seed/reset commands, and the PostgreSQL repository adapter used by the API runtime. |
| `packages/potion-tools` | Shared tool service used by API assistant chat and the MCP adapter. It maps bounded tool requests to `PotionLabApplication`. |
| `packages/api-client` | Kiota-generated OpenAPI client wrapped by a stable facade for the Next.js app. |
| `packages/typescript-config` | Shared strict TypeScript settings for Next.js, NestJS, and compiled library packages. |

The repo uses pnpm 10 and Turborepo so Next.js, NestJS, Prisma, and shared packages run through one task graph without mixing package managers. The Next.js app calls the NestJS API for the main demo path, so customer-visible behavior exercises the same application use cases and Prisma/PostgreSQL adapter that would run in production. The domain package remains pure: it owns the `difa_` rules, application ports, and use cases; NestJS only adapts HTTP requests and maps domain/application errors to HTTP responses. The Next.js package is pinned to the patched stable 16 line for final handoff instead of a canary release. next-intl is used for always-prefixed French/English routing, localized metadata, hreflang alternates, typed client-side navigation, and the persistent `[locale]` app shell.

## Web layout and SERVIER identity

`apps/web/app/[locale]/layout.tsx` validates the locale, loads next-intl messages, and wraps every localized page with `AppShell`. The shell owns the persistent page-switching chrome: local SERVIER logo asset, “moved by you / discovery” signature, stakeholder-proximity promise, and active navigation for dashboard, composer, recipes, and inventory. Internal route transitions use the typed helpers from `apps/web/i18n/navigation.ts`, so the shell remains stable while pages change.

The UI vendors the public SERVIER header SVG logo and favicon PNGs locally under `apps/web/public/brand/` for the interview demo, avoiding hotlinks to `servier.com` during tests. Typography uses Poppins via Fontsource because SERVIER’s public theme declares `Poppins, sans-serif`; the palette remains the established SERVIER blue/coral/white clinical system. Live lab metrics remain inside the client `PotionGame` because they depend on API state; the layout shell only owns route-stable chrome.

The route journey mirrors the technical-test flow: the dashboard is a launchpad with KPIs, `/composer` owns exact-three composition, `/recipes` owns discovered recipes and created potions, and `/inventory` owns quantities/recharge. Successful potion validation navigates from composer to recipes with `created` and `recipe` search params so the success banner, highlighted recipe, and highlighted ledger entry survive the App Router remount.

## Hexagonal runtime flow

```text
Next.js UI
  -> packages/api-client facade
  -> NestJS controller / DTO boundary
  -> PotionLabApplication use cases
  -> InventoryRepository / PotionRepository ports
  -> PrismaPotionRepository adapter
  -> Prisma Client
  -> PostgreSQL
```

The reviewer path is `pnpm dev`: it checks ports, starts a Docker-backed PostgreSQL container, runs Prisma migrations/seed, then starts the API on `3001` and web app on `3000`. Manual production-like startup remains explicit:

```bash
pnpm dev

# or manually:
pnpm db:migrate
pnpm db:seed
DATABASE_URL=<postgresql-url> pnpm start:api
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 pnpm start:web
```

In-memory state is no longer the demo source of truth. Tests may use small fakes for isolated application-unit coverage, while API and browser e2e use PostgreSQL.

## Production posture

- **Runtime:** containerized web and API services.
- **Simple Azure path:** Azure Container Apps, managed identities, Key Vault references, Azure Monitor/Application Insights, and Azure Database for PostgreSQL Flexible Server.
- **Mission-aligned path:** AKS can host the web/API services behind internal service discovery when the broader platform requires Kubernetes-native operations.
- **Secrets:** environment variables and platform secret stores only; no committed credentials.
- **Observability:** structured API logs, `/health`, `/ready`, and Azure Monitor/App Insights integration in the deployment slice.

## Database decision

PostgreSQL is the required runtime persistence layer, accessed through Prisma. Prisma owns executable migrations and client generation; the domain still depends only on repository ports, not Prisma types. Reviewer startup seeds bounded randomized initial inventory quantities, while e2e reset paths keep deterministic stock levels so all 9 recipe proofs remain stable. Potion creation uses a single Prisma transaction/repository command so guarded stock decrements and potion-history insertion commit or roll back together.

## Verification posture

`pnpm verify` runs the normal Turborepo lint/typecheck/test/build graph, scaffold checks, and the e2e gates:

- domain/application unit tests, including all 9 recipe combinations;
- Prisma repository tests and real migration/seed scripts;
- NestJS unit smoke tests;
- NestJS e2e with `@nestjs/testing` and `supertest` against Docker-backed Prisma/PostgreSQL;
- frontend component tests with Vitest, jsdom, and Testing Library;
- Playwright Chromium e2e that creates all 9 recipes through the real browser UI, verifies persistent shell navigation, and captures compact visual journey screenshots.

## Assistant and agent tool seams

The mandatory product is deterministic and PostgreSQL-backed. The UI includes a local Discovery Funnel showing 364 possible ingredient triples, 9 canonical SERVIER recipes, and isolated secret-recipe hypotheses that never mutate the protected recipe fixture.

There are two separate assistant seams:

- `POST /assistant/ask` is the env-gated LangGraph/local-RAG architecture endpoint. `SERVIER_ASSISTANT_ENABLED=true` enables the route, while `SERVIER_AI_PROVIDER` records the intended provider route (`azure-openai`, `mistral`, `openai`, or local default).
- `POST /assistant/chat` and `POST /assistant/chat/stream` power the in-product Potion assistant. Runtime chat is real-model-backed when `OPENAI_API_KEY` and `OPENAI_MODEL` are configured. The browser model sees exactly one executable tool, `create_potion`; the API validates the plan and executes through `PotionToolService -> PotionLabApplication -> PrismaPotionRepository`.

`apps/mcp` is a third, external-agent adapter rather than a browser dependency. It uses stdio transport and exposes seven bounded tools through the same `PotionToolService` and application/repository path: `list_ingredients`, `list_inventory`, `list_recipes`, `list_potions`, `create_potion`, `recharge_inventory`, and `randomize_inventory`.
