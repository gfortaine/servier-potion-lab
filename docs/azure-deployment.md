# Azure deployment note

This package is intentionally local-first for the technical test, but the boundaries map cleanly to Azure.

## Recommended reviewer path

| Concern | Azure target |
|---|---|
| Web runtime | Azure Container Apps service for `apps/web` |
| API runtime | Azure Container Apps service for `apps/api` |
| Database | Azure Database for PostgreSQL Flexible Server |
| Data access | Prisma Client and Prisma migrations |
| Secrets | Container Apps secrets or Key Vault references |
| Observability | Azure Monitor and Application Insights |
| GenAI provider | Azure OpenAI or OpenAI-compatible runtime for the Potion assistant; `SERVIER_AI_PROVIDER=azure-openai` remains the `/assistant/ask` routing hint |
| Agent adapter | Optional stdio MCP app for external agents, not required for browser deployment |

## Runtime configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the API/database package. |
| `WEB_ORIGIN` | CORS origin for the NestJS API. |
| `API_PORT` | API port, default `3001`. |
| `OPENAI_API_KEY` | Required by `/assistant/chat` and `/assistant/chat/stream` real-model runtime. Store in Key Vault or Container Apps secrets. |
| `OPENAI_MODEL` | Required model slug for the Potion assistant planner, for example `gpt-5.5`. |
| `SERVIER_ASSISTANT_ENABLED` | Enables `POST /assistant/ask` when set to `true`. |
| `SERVIER_AI_PROVIDER` | Records intended model route: `azure-openai`, `mistral`, `openai`, or local default. |

## Container shape

Build the monorepo once with `pnpm build`, then run:

```bash
DATABASE_URL=<postgresql-url> pnpm db:migrate
DATABASE_URL=<postgresql-url> pnpm db:seed
DATABASE_URL=<postgresql-url> pnpm --filter @servier-potion-lab/api start
NEXT_PUBLIC_API_BASE_URL=<api-origin> pnpm --filter @servier-potion-lab/web start
```

For an enterprise deployment, publish separate web/API images, attach managed identity, inject secrets via Key Vault references, and keep database migrations as an explicit release step. AKS remains a valid mission-aligned alternative when Kubernetes-native service discovery or platform policy requires it.

`/assistant/ask` and `/assistant/chat[/stream]` are distinct seams. The former is the optional LangGraph/local-RAG route; the latter is the in-product Potion assistant and fails clearly if `OPENAI_API_KEY` or `OPENAI_MODEL` is missing.

## Test and release gates

The customer-grade gate is `pnpm verify`. It includes static checks, package tests, Prisma migration/seed paths, PostgreSQL API e2e, and Playwright browser e2e that creates all nine SERVIER recipes through the UI. In CI, `.github/workflows/ci.yml` uses a PostgreSQL service; `scripts/with-postgres.mjs` skips Docker when `DATABASE_URL` or `TEST_DATABASE_URL` is already set.
