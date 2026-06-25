# Stitch Prompt — Inventory

Design the inventory route for SERVIER Potion Lab.

**Purpose:** Manage stock quantities for all 14 potion ingredients. This route is the only stock-management role.

**Platform:** Web page, dense desktop grid with single-column mobile collapse.

**Required content and interaction model:**

1. **Compact route heading:** title “Inventaire des ingrédients.” No dashboard hero, no cauldron, no recipe codex.
2. **Inventory command header:** one randomized full-inventory action named “Nouvelle dotation”, with copy explaining it creates a new bounded allocation.
3. **Stock ledger grid:** fourteen ingredient rows/cards with index, display name, technical slug, quantity, five-step stock meter, focused state from query parameter, and depleted warning state.
4. **Per-item controls:** decrement and recharge buttons on each ingredient only in inventory mode.
5. **Inventory notice:** inline status feedback after recharge, decrement, or new allocation.

Use the design system from `DESIGN.md`. Communicate controlled stock and traceability, not playful shopping-cart inventory.
