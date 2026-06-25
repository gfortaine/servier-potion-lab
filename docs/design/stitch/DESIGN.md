# Design System: SERVIER Potion Lab

## 1. Visual theme and atmosphere

Create a corporate pharma lab interface with a controlled potion-game reward loop. The interface should feel like a premium SERVIER product demo: precise, confident, and playful through interaction, not through heavy fantasy language. The first viewport must deliver a sharp visual impact through composition, contrast, and proximity motifs while staying compact enough that the primary workflow is immediately reachable.

Density is balanced lab console: precise and information-rich, but never cramped. Variance is asymmetric and editorial: offset panels, instrument bands, formula strips, and clear spatial hierarchy instead of equal-card rows. Motion is expressive but safe: short reveal cascades, active formula focus, clipped success sparks, ingredient lift, and tactile button feedback that respect `prefers-reduced-motion`.

## 2. Color palette and roles

- **SERVIER Midnight** (`#12124F`) — primary stage and header depth.
- **SERVIER Blue** (`#24226A`) — branded surface depth, active navigation, cockpit panels.
- **Clinical White** (`#FFFFFF`) — clean card surfaces and high-contrast content.
- **Signal Coral** (`#EA5C47`) — the single warm accent for primary CTAs, alerts, and successful distillation.
- **Discovery Mist** (`#EEF3FB`) — secondary surface, pale data bands, inactive tokens.
- **Ink Blue** (`#171744`) — primary text on light surfaces.
- **Trace Line** (`rgba(16, 27, 46, 0.16)`) — structural borders and formula dividers.

No purple AI gradients, neon glows, fake glass overload, pure black, or unrelated fantasy colors. Any discovery-funnel number must come from the real domain: 14 ingredients, 364 possible triples, 9 canonical recipes. Avoid using implementation names such as `Codex` or raw tool names as primary product language.

## 3. Typography

- **Display and UI:** Poppins, matching SERVIER’s public brand direction already used in the app.
- **Body:** Poppins with relaxed leading and a 65-character readable measure.
- **Mono:** SFMono / IBM Plex Mono / JetBrains Mono stack only for small reagent IDs, slugs, counts, tool proof details, and formula labels.

Headlines should be controlled and confident, not oversized. Use uppercase micro-labels sparingly for lab instrumentation. Avoid generic corporate filler and invented claims.

## 4. Layout principles

- Dashboard: asymmetric SERVIER lab with logo/nav, compact cinematic hero, one primary composer CTA, formula launch cards, and deterministic discovery funnel.
- Composer: exact-three preparation surface. Three reagent sockets are the hero of the page; ingredients remain selectable but stock mutation controls are hidden.
- Recipes: collectible formula archive with all 9 canonical recipes and a created-potions ledger. Discovered states are clear; locked states still invite guided composition.
- Inventory: controlled reagent-vault ledger. It is the only place with per-item decrement/recharge and randomized full allocation.
- Assistant: compact potion-assistant panel with streaming conversation, one approved `create_potion` proof detail, and product-first action cards.
- Mobile: single-column surfaces, no horizontal overflow, sticky navigation remains usable, minimum 44px interactive targets.

Never use three equal marketing cards as the only structure. Prefer cockpit strips, staggered grids, split panels, and compact action rails.

## 5. Components

- **Brand header:** sticky, compact, SERVIER-first, with active route state and no redundant per-page hero on task routes.
- **Hero theatre:** dashboard-only, height below 72% of viewport, one CTA, no scroll hints.
- **Cauldron preparation:** three clear slots, formula status, selected ingredient removal, disabled distill until exactly 3.
- **Ingredient board:** 14 real ingredients, quantity state, depleted state, selected/focused state, stock meter.
- **Formula archive:** 9 recipes, discovered/created/focused state, preparation button, ingredient signature.
- **Potion ledger:** newest potion highlighted without blocking navigation.
- **Discovery funnel:** deterministic candidate context: 364 triples, 9 canonical successes, secret hypotheses isolated from canonical recipes.
- **Potion assistant:** streaming chat panel with clear empty state, human-readable action cards, and restrained technical proof metadata.

## 6. Motion and interaction

Use transform and opacity only. Dashboard panels may cascade in with short delays. Ingredient tokens lift on hover/focus. Active cauldron socket may pulse visibly but briefly. Created recipes and ledger rows may receive clipped success sparks inside their own surfaces. Buttons should compress on active state. Respect `prefers-reduced-motion`.

## 7. Anti-patterns

- No committed secrets, API keys, or MCP headers.
- No fake metrics, fake users, fake uptime, or invented business data.
- No childish wizard clipart, emojis, stock imagery, or fantasy parchment overload.
- No generic SaaS “three cards and a gradient” homepage.
- No oversized repeated hero on composer, recipes, or inventory.
- No stock mutation controls outside inventory.
- No hidden recipe guessing as the default path.
