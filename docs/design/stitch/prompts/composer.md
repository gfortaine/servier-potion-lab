# Stitch Prompt — Composer

Design the composer route for SERVIER Potion Lab.

**Purpose:** Help the user compose exactly three ingredients and validate them against server-side canonical recipes.

**Platform:** Web component/page, responsive.

**Required content and interaction model:**

1. **Compact route heading:** no repeated dashboard hero. Title: “Composer une potion.”
2. **Atelier stepper:** Choisir, Composer, Distiller with visible `0/3`, `1/3`, `2/3`, `3/3` progress.
3. **Cauldron protocol panel:** three sockets as the primary visual object; selected ingredients can be removed; distill action is disabled until exactly three ingredients are selected; clear action resets selection.
4. **Guided recipe state:** if a recipe is pinned, show target ingredient chips and a short protocol line.
5. **Ingredient selection board:** all 14 ingredients, name, quantity, depleted state, selected state, select/remove button. Composer must not expose decrement, recharge, or randomized inventory allocation controls.
6. **Notice area:** clear inline feedback for ready, missing ingredients, depleted stock, invalid recipe, and success navigation.

Use the design system from `DESIGN.md`. The page should feel like a clinical protocol cockpit, not a form wizard and not a fantasy spellbook.
