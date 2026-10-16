# Meal planner, the week at a glance

The redesign of the week on `/meals`, decided in a design consultation on 2026-10-16 and not built yet. The slices are in [`features/meal-planner/CLAUDE.md`](./CLAUDE.md); the colors and their contrast are in [`ui/theme-and-contrast.md`](../../ui/theme-and-contrast.md).

## The week at a glance: design (decided 2026-10-16)

The owner found the planner's look and handling poor. Screenshots of the week at 375x667, with six entries in it, showed why:

- **Most of the page was add buttons.** Every day had "+ Add dinner" and a line of "+ Breakfast", "+ Lunch" and "+ Snack", also when its dinner was planned: 14 rows of buttons for 7 days. Two days fitted on the first screen, and the whole week was 1,494 px high.
- **The other slots stood under the dinner** and only had a label when something was planned, so a Saturday read "Fish fingers, Breakfast: Pancakes".
- **Past days looked like coming ones**, and an open day like a planned one; on a Friday the member scrolled past four days to reach today.
- **Recipe names were in the browser's own link blue with an underline**, a color of no token, next to entries written as text in grey.
- "Put N ingredients on the shopping list" stood under the whole week.

### What the week is for

The owner's answer to "what should a member remember after the first look": **the week at a glance**, what is planned, what is open and where today is. "What's for dinner tonight" was not chosen, because the dashboard's Tonight tile answers it. Every decision below is checked against that. Competitors were not researched (owner's choice); the layout comes from the screenshots, the theme and the earlier decisions.

### Decisions

- **The theme and the font stay.** The Catppuccin tokens of `theme.css` and Roboto; nothing in this redesign is a new color but the tint for today.
- **An agenda list, one bordered list with a row per day**, not a grid of seven columns, which leaves no room for names at 375 px. A row has two columns: a date column of 3.5rem ("Fri" over "16") and the day's entries.
- **The dinner is always the first entry and has no label**, as slice 1b had it: the eye runs down one column of dinners. Breakfast, lunch and snack follow in the day's order, each with its slot's name in front in `text-muted` ("Lunch Sandwiches").
- **One add per day.** An open dinner is a button with a dashed edge, "Add dinner", in the dinner's place. The date column is the day's add button (a small + under the date, named "Add to Saturday 17 Oct"), and the add dialog gets radios for the slot with the dinner chosen. This replaces "+ Add dinner" on planned days and the line of "+ Breakfast", "+ Lunch" and "+ Snack" of slice 1b. Adding a lunch takes one press more than before.
- **The days before yesterday fold** into a native `<details>`, "Earlier this week · Mon to Wed", in the week of today only. Yesterday stays open, because "How did the kids eat?" is mostly asked the day after. Recording Monday's reactions on a Thursday takes one press more.
- **Today** has a tint behind its row, mauve at 8% over the page (Latte `#e7e2f5`, Mocha `#2c293e`), and "Today" in bold in the text's color under the date. On the tint the text is at 6.31:1 (light) and 9.72:1 (dark), `text-muted` at 4.94:1 and 6.31:1; mauve text is at 4.28:1 in light mode, so the primary color is never text on the tint. Calculated from `@catppuccin/palette`, not measured by axe. No colored edge on the row.
- **A recipe's name** is in the text's color with an underline in `--theme-outline`, 3 px below the text; a name written as text has none. The browser's link blue is gone.
- **Not planned yet has a dashed edge**: an open dinner and a dinner "Fill my week" proposes. A proposal no longer says "Proposed" or "Kept"; the lock says kept (`aria-pressed`), and the line above the week says "Lock the ones to keep". The proposal's name is no longer italic.
- **The week's actions stand under its heading**: "Fill my week" and "Put N on the shopping list" side by side. The heading is "Week of 12 Oct" with the previous and next week as icon buttons on its line; the button back to this week reads and is named "This week" (it read "Today" and was named "This week", against WCAG 2.5.3).
- **"Planned meals appear here." is dropped**: the open dinners say it.

The mockup of the week in both modes, with all seven days open, is about 800 px high, and with the earlier days folded the days from yesterday on fit on one screen.

### What stays

Every entry keeps its one menu (`MealEntry.vue`), the move dialog and the reactions dialog are unchanged, and the kinds of `TEST_IDS.meals.*` stay, with new ids for the date column's button, the slot radios and the fold. The trip's view (`?trip=`) shares the day list and gets the same rows, without the fold.

### Not designed yet

Three states have no design yet and are settled while building: an open dinner on a past day, a day with two dinners, and the note "Got it" that "Fill my week" shows when there are few recipes.

### Found, not part of the layout

"Fill my week" proposed pancakes, a breakfast, for a Sunday's dinner: the suggester knows recipes, not slots.
