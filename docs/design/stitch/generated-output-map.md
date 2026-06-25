# Generated Stitch Output Map

This file distills the generated Stitch outputs in ignored `.stitch/designs/` into tracked implementation guidance. It deliberately does **not** commit raw Stitch HTML/screenshots or secrets.

## Source screens

Generated with `pnpm stitch:redesign` from project `8965010233920469135`. The assistant screen can be generated independently with `STITCH_SCREEN_SLUGS=chat pnpm stitch:redesign` after loading `STITCH_API_KEY`.

| App route | Generated file | Stitch role | React surface |
|---|---|---|---|
| `/fr`, `/en` | `.stitch/designs/dashboard.html` | SERVIER command cockpit with sticky shell, search/action rail, asymmetric KPI + mini-ledger dashboard | `AppShell`, `HeroTheatre`, `DashboardLaunchpad`, `DiscoveryPanel` |
| `/fr/composer-une-potion`, `/en/composer` | `.stitch/designs/composer.html` | Protocol de fusion with pinned recipe, three-stage flow, reagent library | `AtelierStepper`, `CauldronComposer`, `IngredientTokenBoard(mode="compose")` |
| `/fr/recettes`, `/en/recipes` | `.stitch/designs/recipes.html` | Archives de formulation, formula cards, potion ledger | `RecipeCodex`, `PotionLedger`, `success-route-banner` |
| `/fr/inventaire`, `/en/inventory` | `.stitch/designs/inventory.html` | Dense stock ledger with remove/add controls and randomized allocation | `IngredientTokenBoard(mode="manage")` |
| Assistant panel | `.stitch/designs/chat.html` | Potion assistant panel with streaming messages and a product-first action card | `CodexChat` rendered with visible `Assistant potion` copy |
| Mobile | `.stitch/designs/mobile.html` | Single-column cockpit and compact mobile cards | mobile media queries in `styles.css` |

## Token vocabulary to port

The generated output consistently uses a light clinical surface system over SERVIER colors:

- **Brand surfaces:** `servier-midnight`, `servier-blue`, `signal-coral`, `discovery-mist`, `surface`, `surface-container-low`, `surface-container-high`.
- **Structural classes:** `trace-line`, `trace-line-b`, `trace-line-t`, `grid-cols-12`, `col-span-*`.
- **Interaction classes:** `active-press`, `interactive-press`, hover-to-surface states.
- **Typography classes:** `font-display-lg`, `font-headline-md`, `font-headline-sm`, `font-label-caps`, `font-data-mono`, `font-body-lg`, `font-body-sm`.
- **Iconography:** Material Symbols words such as `search`, `notifications`, `settings`, `close`, `remove`, `add`, `autorenew`.

The React app should not copy Tailwind utility strings verbatim. Instead, it should expose equivalent semantic classes and CSS custom properties while preserving existing `data-testid` hooks and route behavior.

## Component translation

### AppShell

Generated dashboard/inventory/recipes screens use a flat clinical shell. For the live React port, the shell is intentionally simplified to **one primary navigation model**:

- SERVIER Discovery lockup;
- persistent `Laboratoire SERVIER` / `SERVIER lab` sidebar navigation on desktop;
- compact sidebar rail on smaller screens;
- page-local headers inside the content canvas, not duplicated global top navigation.

React port:

- keep the real SERVIER logo inside the sidebar shell;
- keep active route links and `aria-current` on the sidebar navigation;
- remove duplicate desktop top navigation/header chrome;
- keep navigation accessible and route-bound through the same `copy.nav.aria` landmark used by browser tests.

### Dashboard

Generated dashboard uses:

- a 12-column layout;
- trace-line dividers;
- “Aperçu de Composition” and “Mini-Ledger: Inventaire Actif” cockpit cards;
- asymmetric launch areas instead of equal cards;
- deterministic discovery funnel.

React port:

- keep `hero-theatre`, `dashboard-launchpad`, and `discovery-panel`;
- style dashboard panels as a controlled alchemical quest lobby rather than a passive KPI dashboard;
- make the first dashboard card dominant and use real-derived quest states, trace lines, and clipped orbit motifs;
- keep real metrics only: completion ratio, potion count, depleted count, 364 candidates, 9 recipes.

### Composer

Generated composer uses:

- formula preparation language;
- a pinned recipe panel;
- visible reagent library;
- compact stage cards and close/remove iconography.

React port:

- keep exact-three sockets and dynamic pinned target chips;
- make the cauldron panel the gameplay loop with three reagent sockets, readiness pulse, and no stock mutation controls;
- show ingredient cards as reagent rows/cards with trace lines and active press states;
- do not add stock mutation controls in composer.

### Recipes

Generated recipes uses:

- formula archive / portfolio language;
- dense formula cards;
- `interactive-press` card behavior;
- potion ledger strip.

React port:

- keep all 9 canonical recipe cards and the dynamic potion ledger;
- style canonical recipes as equal-weight collectible codex entries with 1px trace gutters, sigils, and square cards;
- reserve wide/highlight treatment only for meaningful active states such as newly created or targeted recipes, not for the first recipe by position;
- preserve guide buttons and URL-backed success banner, adding only clipped reward effects on created states.

### Inventory

Generated inventory uses:

- dense 12-column stock ledger;
- small mono quantity/status data;
- explicit `remove`, `add`, and `autorenew` icon actions;
- randomized allocation command.

React port:

- keep inventory as the only mutation surface;
- style stock cards as a dense reagent-vault ledger on the inventory route and as reagent tiles only on composer;
- use `-1`, `+1`, and “Nouvelle dotation” actions with active press behavior;
- preserve focused/depleted/selected states.

### Assistant

The assistant screen is the design reference for the in-product chat panel. It should refine, not replace, the existing AI SDK streaming implementation.

React port:

- keep existing `useChat`, `DefaultChatTransport`, `/assistant/chat/stream`, and `stateChanged` refresh behavior;
- keep internal `data-testid` hooks stable, including `codex-chat`, while changing visible copy to `Assistant potion`;
- title tool results as human actions first, such as `Action exécutée : potion créée`;
- show raw `create_potion` only as restrained proof metadata;
- keep the panel clear of primary composer/inventory controls on desktop and usable as a drawer on mobile.

### Mobile

Generated mobile uses:

- single-column surfaces;
- compact cards;
- no horizontal overflow;
- minimum touchable controls.

React port:

- keep existing media queries but align them to generated single-column surfaces;
- avoid sticky elements hiding content;
- preserve first primary surface visibility.
