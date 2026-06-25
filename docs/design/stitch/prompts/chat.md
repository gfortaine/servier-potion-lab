# Potion assistant panel

Design the in-product assistant panel for SERVIER Potion Lab. The panel helps a reviewer create a potion conversationally while making the bounded tool action understandable without exposing implementation jargon as the main label.

**PLATFORM:** Web, desktop-first with a compact responsive drawer variant

**PAGE STRUCTURE:**

1. **Container placement:** A right-side assistant panel that can live beside the composer or inventory content without hiding primary controls. Include a collapsed floating launcher state and an expanded panel state.
2. **Header:** SERVIER lab context, title "Assistant potion", short status text showing the assistant can prepare one formula at a time, and a close/collapse control.
3. **Conversation area:** A short welcome message, user message bubbles, assistant streaming response rows, and clear empty/error states. Keep message density readable for a live demo.
4. **Action card:** A structured "Action executed: potion created" card with the selected formula, three ingredient rows, inventory deltas, and a small proof detail row for the approved tool name. The card must read as a product result first and a technical proof second.
5. **Input area:** Single-line prompt field with an example placeholder, send button, disabled state when empty, and a short privacy/safety note that only approved lab actions can change stock.
6. **Responsive behavior:** On smaller screens the panel becomes a bottom sheet or full-width drawer with the input always reachable and the action card still legible.
