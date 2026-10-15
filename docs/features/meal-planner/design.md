# Meal planner: why it exists and the slices

The household's meal plan: what is cooked on which day, and the Tonight tile on the dashboard that proposes a dinner. It is built in slices; each has a file in this folder, listed in [`CLAUDE.md`](./CLAUDE.md). The state is in [`progress.md`](../../progress.md).

## Why it exists, and the slices (decided 2026-10-15)

Every day the parents ask "what shall we eat today or tomorrow". The household settles on one of about five dishes, or on toast and pasta for the two small children while the adults eat something else. The load is the daily deciding, so the app proposes and the parents veto. **The Tonight tile on the dashboard is the product; the week page is its supporting tool.** The children (4 and 6) are not users.

The work was reviewed before it was built and split into slices:

- **Slice 1, in two releases.** 1a is the plan table, the store, a list of dinners on `/meals` and the Tonight tile. 1b is the full week with all four slots, a move dialog, a trip's view and the shopping run from the plan.
- **Slice 2**: a kids' version text on a recipe, children as household records, recording what a child refused (exceptions only), and a visible effect on the suggestion. Its screens are to be approved before it is built.
- **Slice 3**: "Fill my week" with a lock and a re-roll per slot, the proposer behind a typed interface, and the tile showing the week's proposal.

Slices 2 and 3 are not designed further than that here. Left out on purpose, so that nobody builds them unasked: copying last week, theme nights, who eats on which day, a share link for a day, a fixed weekly template, retiring `vacation_meals` and its pages, reordering inside a slot, and "exclude this recipe".

## Glossary

The words are fixed so that code, screens and these docs say the same. A **dinner** is an entry in the slot `dinner`. An **entry** is one row of `meal_plan_entries`: a recipe or a title on a day and in a slot. **Kids** means the two small children. The slots are called breakfast, lunch, dinner and snack.
