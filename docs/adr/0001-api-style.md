# ADR 0001: API style

## Status

Accepted

## Context

The potion lab is a browser-first technical-test application with a small command-oriented API:

- list ingredients, inventory, recipes, and potion history;
- set, recharge, and randomize inventory;
- create a potion from exactly three ingredients;
- expose health/readiness and an env-gated assistant seam.

The application already separates transport, domain, and persistence:

```text
Next.js UI
  -> NestJS REST/OpenAPI adapter
  -> PotionLabApplication
  -> repository ports
  -> Prisma/PostgreSQL adapter
```

## Decision

Keep **REST over HTTP with OpenAPI** as the primary public API style.

OpenAPI is the contract for reviewer docs, runtime documentation, generated-client experiments, and API drift tests. Prisma remains an implementation detail behind repository ports and must not leak through DTOs or generated clients.

## Consequences

- The reviewer can inspect `/docs` and `/docs-json` without extra tooling.
- The Next.js app keeps a browser-native transport.
- Contract generation can be added without changing the public API style.
- Runtime validation must stay aligned with the OpenAPI DTOs.

## Alternatives considered

| Option | Decision | Reason |
|---|---|---|
| GraphQL | Defer | Useful for complex composed reads, but the current API is small, command-heavy, and first-party. |
| gRPC / gRPC-Web | Defer | Strong for internal polyglot service-to-service APIs, but adds protobuf/proxy/client-generation complexity with little reviewer value here. |
| MCP as primary API | Reject | MCP is for agent/tool integration, not the browser product transport. |
