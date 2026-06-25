# ADR 0002: Contract-generated client

## Status

Accepted

## Context

The web app currently uses a hand-written typed fetch boundary in `apps/web/app/potion-lab-api.ts`. That keeps the demo simple, but it duplicates response shapes already exposed by the NestJS OpenAPI document.

The OpenAPI contract has been hardened with response DTOs, runtime body validation, an explicit server URL, and e2e assertions on `/docs-json`.

## Decision

Treat OpenAPI as the source contract and use **Kiota** for a generated `packages/api-client` workspace package.

NestJS remains the implementation and OpenAPI source. The generated Kiota source lives behind a hand-written facade so the web app keeps a small, stable `potionLabApi` shape instead of depending directly on generated request-builder ergonomics.

## Spike result

Native Kiota `v1.32.2` from the macOS ARM64 release asset successfully generated a TypeScript client from the local OpenAPI artifact after response schemas were added.

Observed generated output:

- 14 files;
- about 84 KB;
- 1072 TypeScript lines;
- typed `PotionDto`, `RecipeDto`, `InventoryItemDto`, and `IngredientDto` models;
- typed `potions.post(...)` returning `Promise<PotionDto | undefined>`;
- base URL set from the OpenAPI `servers` entry;
- TypeScript target is still marked preview by Kiota;
- dependency hint is `@microsoft/kiota-bundle@1.0.0-preview.102`, with optional Azure authentication.

## Adopted package shape

- `packages/api-client/openapi/servier-openapi.json` stores the generated OpenAPI artifact consumed by Kiota.
- `packages/api-client/src/generated/` stores generated Kiota TypeScript source.
- `packages/api-client/src/index.ts` exposes the stable facade used by `apps/web/app/potion-lab-api.ts`.
- Generation is explicit through package scripts and is not part of normal `pnpm verify`.
- The Kiota binary/cache is not committed; generation can use `KIOTA_BINARY` or a `kiota` binary on `PATH`.

## Consequences

- The web app now consumes the API through a workspace client package.
- The facade preserves existing user-facing `ApiError` behavior and non-optional view models.
- Generated Kiota TypeScript is normalized after generation so it compiles under the repository's strict `exactOptionalPropertyTypes` setting.
- The project pays the generated-code and preview-dependency cost intentionally, isolated in one package.

## Lightweight alternative

`openapi-typescript` plus a typed fetch wrapper remains the lower-cost option if the only long-term consumer is the Next.js app. It is less strategic than Kiota because it generates types rather than a full request-builder SDK.
