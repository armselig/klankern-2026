# Documentation of the meal planner

Guidance for reading and writing the files in this folder. The rules for all documentation are in [`README.md`](../../README.md) one level up from `features/` and are not repeated here; the rules for the code are in [`rules/`](../../rules/README.md). The current state of the planner is in [`progress.md`](../../progress.md).

## Where things are

Read the design first, then the file of the slice you are about to touch.

- [`design.md`](./design.md): why the planner exists, how it was split into slices, what was left out on purpose, and the glossary.
- [`slice-1a.md`](./slice-1a.md): slice 1a, built and released: the plan table (0018), the store, the Tonight tile, `/meals` with dinners, its tests and limits, and the owner trying it.
- [`slice-1b.md`](./slice-1b.md): slice 1b, built and released (1.11.1): the other slots, the move dialog, a trip's view, the shopping run, "Make a recipe from this", and the removal of the old trip meals with migration 0020 (applied 2026-10-15).
- [`slice-2.md`](./slice-2.md): slice 2, the kids, built and released (1.12.0): children on the dashboard, "How did the kids eat?" in a dinner's menu, the page `/kids`, the demotion on the Tonight tile, the kids' version of a recipe, and migration 0021 (applied 2026-10-15).
- [`slice-3.md`](./slice-3.md): slice 3, "Fill my week", built and released (1.13.0): the draft proposal of dinners for the open days, lock and re-roll, the `MealSuggester` interface, the Tonight tile's line and button. No migration.
- [`week-layout.md`](./week-layout.md): the redesign of the week on `/meals` for "the week at a glance", decided and built 2026-10-16, not released: a row per day, one add per day, the earlier days folded, today's tint.
- [`measuring.md`](./measuring.md): the kill condition for slices 2 and 3 and the query that counts planned days.
- [`ci-clock-failure.md`](./ci-clock-failure.md): the e2e tests of the plan that failed on CI because Playwright's clock was pinned ahead of the session.

## Writing here

- **A slice gets a file of its own when it is built.** What changes after a slice is built goes into its file as a dated section at the end; once the file passes about 2,500 words, the changes get a file beside it.
- **The list above is part of the change**: a new or renamed file gets its line here in the same commit. The list in the documentation's `README.md` has one line for the folder.
- **A reference to a file of this folder is shown as its path from `docs/`**: `features/meal-planner/slice-1a.md`.
