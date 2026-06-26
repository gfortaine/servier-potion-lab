# SERVIER Potion Lab

Production-shaped TypeScript monorepo for the SERVIER potion technical test: a localized Next.js app, NestJS/OpenAPI API, PostgreSQL persistence, generated client boundary, optional MCP agent surface, and a real-model Potion assistant that can call one approved creation tool.

## Stack

| Surface | Choice |
|---|---|
| Web | Next.js App Router, React, TypeScript, next-intl localized SEO paths, persistent SERVIER lab shell, interactive discovery-lab UI, Potion assistant panel |
| API | NestJS service boundary with Swagger/OpenAPI, inventory, recipe, potion, health, readiness, and assistant endpoints |
| MCP | Optional stdio MCP app exposing agent tools over the same potion application layer |
| Domain | Pure TypeScript package with the required real `difa_` recipe function |
| Persistence | PostgreSQL through Prisma Client, Prisma migrations, and typed repository ports |
| Client | Kiota-generated API client wrapped by a stable first-party facade |
| Deployment posture | Vercel Services for reviewer demos, Azure Container Apps/AKS note for enterprise alignment; see `docs/vercel-deployment.md` and `docs/azure-deployment.md` |

## Commands

```bash
pnpm install
pnpm dev
pnpm verify
vercel dev -L
vercel deploy
pnpm start:api
pnpm start:web
```

The mandatory verification path is local and does not require live LLM, Azure OpenAI, image-generation, or Office credentials.

`pnpm dev` is the reviewer-friendly path: it starts or reuses a Docker-backed PostgreSQL container, runs Prisma migrate/seed, and launches API + web with the expected local URLs. Local CORS accepts both `http://localhost:3000` and `http://127.0.0.1:3000` for reviewer convenience. Build before production-style `start` with `pnpm build`.

The web app pins the patched stable Next.js 16 line for final handoff rather than a canary release.

## Documentation map

| Goal | Read |
|---|---|
| Run or review the project | This README |
| Understand the architecture and runtime boundaries | `docs/architecture.md` |
| Deploy or operate the Vercel demo | `docs/vercel-deployment.md` |
| Discuss an Azure enterprise trajectory | `docs/azure-deployment.md` |
| Review technical decisions | `docs/adr/` |
| Review design system and Stitch handoff | `docs/design/stitch/` |
| Read the Tech Lead IA delivery note | `docs/note-technique-servier-architecture-ia.md` |

## Vercel Services deployment

This repo includes a root `vercel.json` using Vercel Services:

| Service | Entrypoint | Route prefix |
|---|---|---|
| `web` | `apps/web` | `/` |
| `api` | `apps/api` | `/api` |

The Vercel project framework must be set to **Services**. The frontend prefers `NEXT_PUBLIC_API_BASE_URL`, then Vercel's generated `NEXT_PUBLIC_API_URL` (`/api`), then the local API fallback.

Use Prisma Postgres from the Vercel Marketplace for `DATABASE_URL`. During Vercel builds, `apps/api` runs Prisma migrations when `VERCEL=1`; preview deployments also run `db:seed`, while production does not auto-seed to avoid clearing demo history.

```bash
vercel dev -L
vercel deploy
vercel deploy --prod
```

## Stitch design workflow

The UI redesign source lives in `docs/design/stitch/`: `DESIGN.md` defines the SERVIER Potion Lab system, and `prompts/` contains Stitch-ready route prompts for dashboard, composer, recipes, inventory, assistant chat, and mobile.

Generate or refresh Stitch screens with:

```bash
STITCH_API_KEY=<secret> pnpm stitch:redesign
```

For local use, keep the key in ignored `.env.stitch.local` or another secret store and export it only for the command. Generated HTML/screenshots are written under ignored `.stitch/designs/`; commit only sanitized, intentional design evidence.

## Turborepo workspace layout

```text
apps/web          Next.js interface shell for the clinical lab and Potion assistant
apps/api          NestJS API shell with health/readiness, OpenAPI, and assistant routes
apps/mcp          Optional stdio MCP server for external agent tools
packages/domain  Recipe and ingredient domain rules
packages/db      Prisma schema, migrations, seed/reset, and PostgreSQL adapter
packages/potion-tools  Shared bounded tool layer used by API chat and MCP
packages/api-client    Kiota-generated OpenAPI client plus stable facade
packages/typescript-config  Shared strict TypeScript configs
docs/             Architecture and delivery notes
scripts/          Local proof scripts
```

`turbo.json` owns the task graph. Build tasks run dependency builds first, cache `dist/**` and `.next/**`, and keep `dev` plus future database migration/seed commands non-cacheable.

## API surface

Start the API with `pnpm --filter @servier-potion-lab/api start` after building, then use `/docs` for Swagger UI or `/docs-json` for the OpenAPI document.

| Endpoint | Purpose |
|---|---|
| `GET /health`, `GET /ready` | Runtime health/readiness checks. |
| `GET /ingredients` | Lists the 14 SERVIER ingredients. |
| `GET /inventory` | Lists current inventory quantities. |
| `PUT /inventory/:ingredientId` | Sets one ingredient quantity. |
| `POST /inventory/:ingredientId/recharge` | Recharges one ingredient. |
| `POST /inventory/randomize` | Randomizes inventory quantities for replay. |
| `GET /recipes` | Lists the 9 recipes and discovery state. |
| `GET /potions`, `POST /potions` | Lists potion history and creates a potion from exactly three ingredient IDs. |
| `POST /assistant/ask` | Env-gated LangGraph local RAG assistant; disabled unless `SERVIER_ASSISTANT_ENABLED=true`. |
| `POST /assistant/chat` | JSON proof endpoint for the Potion assistant, exposing only the bounded `create_potion` tool. |
| `POST /assistant/chat/stream` | AI SDK `useChat` streaming Potion assistant conversation with the same `create_potion` tool. |

## Frontend surface

The Next.js UI is a SERVIER lab with:

| Area | Purpose |
|---|---|
| `/fr`, `/en` | Mission launchpad with progress KPIs and three spec-mapped actions. |
| `/fr/composer-une-potion`, `/en/composer` | Focused page for selecting exactly three ingredients and validating a potion. |
| `/fr/recettes`, `/en/recipes` | Focused page for discovered recipes plus the created-potion register; successful composer validation routes here with URL-backed highlight state. |
| `/fr/inventaire`, `/en/inventory` | Focused page for ingredient quantities, decrement, recharge, and stock management. |
| Three-slot cauldron | Shows the exact-three selection tray, combine action, clear action, and validation notices. |
| Ingredient ledger | Displays all 14 ingredients with stock meters, select/remove controls, decrement, and recharge controls. |
| Formula archive | Tracks discovery state for all 9 recipes and reveals ingredient signatures after creation. |
| Potion history | Lists created potions and consumed ingredient signatures. |
| Discovery funnel | Shows deterministic candidate triage: 364 possible triples, 9 canonical recipes, and isolated secret-recipe hypotheses. |
| Potion assistant | Streams conversation through `/assistant/chat/stream`, can create a potion through one approved tool, and refreshes inventory/ledger state after success. |

Legacy unprefixed routes redirect to the French canonical routes for reviewer continuity. A persistent localized shell makes page switching explicit across Accueil/Home, Composer, Recettes/Recipes, and Inventaire/Inventory. The shell vendors the public SERVIER SVG logo and favicon assets locally under `apps/web/public/brand/`, uses Poppins to match the public SERVIER site font stack, and keeps the public “moved by you” identity as contextual copy. UI state and browser tests cover the localized pages, active navigation, dashboard launchpad, selection caps, route-based successful potion creation, invalid recipes, recharge, randomize, inventory decrement, discovery progress, tray clearing, favicon/logo presence, and all 9 recipe creations.

## LangGraph bonus

`apps/api` includes a provider-safe LangGraph assistant endpoint:

```bash
SERVIER_ASSISTANT_ENABLED=true SERVIER_AI_PROVIDER=azure-openai pnpm --filter @servier-potion-lab/api start
```

The mandatory verification path uses local RAG only and never calls a live model. `SERVIER_AI_PROVIDER` records the intended route (`azure-openai`, `mistral`, `openai`, or local default) so Azure OpenAI alignment and Mistral/OpenAI comparisons can be enabled later without changing the deterministic graph contract.

## Potion assistant real-model mode

The in-app Potion assistant is real-model-backed by default in local runtime and deployment. The browser uses AI SDK `useChat` against `/assistant/chat/stream`, while `/assistant/chat` remains a JSON proof endpoint. Configure OpenAI before using either route:

```bash
OPENAI_API_KEY=<secret> OPENAI_MODEL=gpt-5.5 pnpm --filter @servier-potion-lab/api start
```

For local development, put those values in the ignored root `.env.local`; the Nest API runtime loads root `.env.local` / `.env` without overriding exported shell variables.

Missing `OPENAI_API_KEY` or `OPENAI_MODEL` is a configuration error for runtime assistant chat rather than a silent deterministic fallback. `pnpm verify` stays offline by using explicit test seams, not by changing local/deployment defaults.

The streaming chat is conversational, so greetings like "hi" produce a normal streamed answer. The model still sees exactly one executable tool, `create_potion`, and can call it from a known recipe name or exactly three known SERVIER ingredients. Inventory, history, recharge, randomize, MCP, file, web, and database tools are not exposed. NestJS validates and executes potion mutations through `PotionLabApplication`. Mistral is the planned second provider behind the same planner contract.

Use the runtime proof when OpenAI credentials are available:

```bash
OPENAI_API_KEY=<secret> OPENAI_MODEL=gpt-5.5 pnpm test:codex:runtime
```

## Architecture decision

The persistence default is PostgreSQL, not SQLite, because the mission context values production readiness, Azure alignment, and future service growth. Prisma now owns the executable schema and client generation, while the domain still depends only on repository ports and remains Prisma-free.

## MCP agent surface

`apps/mcp` is a separate stdio MCP server for external agents. It is not required for the browser reviewer path and does not change the one-tool in-app assistant boundary. The MCP server exposes seven bounded tools over `PotionToolService` and `PotionLabApplication`: `list_ingredients`, `list_inventory`, `list_recipes`, `list_potions`, `create_potion`, `recharge_inventory`, and `randomize_inventory`.

Run it after building with a PostgreSQL URL:

```bash
DATABASE_URL=<postgresql-url> pnpm --filter @servier-potion-lab/mcp start
```
