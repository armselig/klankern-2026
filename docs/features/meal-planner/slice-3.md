# Meal planner, slice 3: Fill my week

How slice 3 was built: a proposal of dinners for the open days of the week, with a lock and a re-roll per day, behind a typed interface. Earlier slices are in [`features/meal-planner/slice-1a.md`](./slice-1a.md), [`features/meal-planner/slice-1b.md`](./slice-1b.md) and [`features/meal-planner/slice-2.md`](./slice-2.md).

## Slice 3: Fill my week (built 2026-10-15)

Built on `develop`, not committed and not released when this was written. Like slice 2 it was started before the kill condition's date (2026-10-29), at the owner's request ("Implement meal planner slice 3"); the call of `count_planned_dinner_days` on that day stays, see [`features/meal-planner/measuring.md`](./measuring.md). No migration.

### Screens chosen before building (2026-10-15)

The owner chose each from proposed options.

- **The proposal is a draft held on the device**, in the page, until "Plan these N" saves it. Rejected: saving at once. Unreviewed proposals would count in `count_planned_dinner_days`, they would reach the other parent's devices over Realtime, and a lock would mean nothing.
- **Dinners only.** The build spec's rotating breakfast and snack defaults and its "new but close" idea list are not built. They are deferred; where the ideas would come from stays open.
- **The Tonight tile** gets a muted line "N dinners not planned this week" ("next week" after the Sunday 17:00 switch) and a "Fill my week" button to `/meals?week=<Monday>&fill=1`. Both show only when a day besides the tile's own is open and the household has a recipe. Rejected: listing the week's dinners on the tile, and nothing on the tile.
- **Which days:** the shown week's days from the Tonight tile's day (today, or tomorrow from 17:00) that have no dinner at all. A day whose dinner was skipped and past days are left alone. The week view only, not `?trip=`.

### Deviation from the approved preview

The fill bar (the choice line, "Plan these N", "Re-roll the rest", "Cancel") sits above the days, where "Fill my week" was, and not under them as previewed: on a 375x667 px screen a bar under seven days is out of sight.

### The rules of the proposal

`repertoireSuggester.fillDinners` in `utils/meal-suggester.ts` goes day by day in order, and each pick counts as planned for the later days.

- Recipes that are already dinners twice in the day's week (`MAX_USES_PER_WEEK` = 2) are left out where others remain.
- Ranking: recipes no child refused come first (the slice 2 `demoted` set from `refusalsByRecipe`, counted up to the first fill day). Then the recipe furthest from the nearest other day it was cooked or is planned on, before or after the day, within the 8-week lookback. Then the fewest uses in the week, then the title, then the id.
- The spec said "least recently cooked". It is widened to the nearest day in either direction, because a dinner planned later in the week must count as near too. The spec's "neutral without reaction data" became the slice 2 demotion.
- `MealSuggester` (the typed interface of the CEO task C3) has `dinnerOrder` and `fillDinners`. The Tonight tile goes through it as well: `tonightState` takes an optional suggester and the dashboard passes `repertoireSuggester`. There is no model call.

### Lock and re-roll

- A re-roll walks through every recipe for the day (`seen`) before one comes back. "Re-roll the rest" proposes anew every unlocked day, with the locked days counted as planned. The single re-roll is disabled on a kept day or with one recipe.
- The lock is a toggle button with `aria-pressed`, named "Keep the dinner for" plus the day's name.
- A short shuffle animation plays on the name, only under `prefers-reduced-motion: no-preference`. The name is in an `aria-live` region.
- "Only N dinners to choose from, so some come more than once." shows when there are fewer recipes than proposed days, with a "Got it" button. The dismissal is remembered per device in `localStorage` (inside try/catch). Otherwise the line says "Chosen from N dinners."

### Saving

Each dinner goes through `mealPlanStore.add`, optimistic and all at once. The notice is "Planned N dinners", or "Could not save M of N dinners. Check your connection and try again." and a day that failed stays open in the proposal. A day planned meanwhile, also on another device, drops out of the proposal. Leaving the week drops the proposal. `?fill=1` is removed from the address once used.

The week page loads the lookback (8 weeks before the first fill day, up to Sunday) for the fill. The dashboard's plan window grew from 2 to 7 days ahead (`DASHBOARD_DAYS_AHEAD`), for the tile's line; every visit to the dashboard now fetches five more days of the plan.

### The code

`utils/meal-suggester.ts`, `utils/week-fill.ts` (the draft's state), `composables/use-week-fill.ts` (the Nuxt wrapper), and `MealFillBar.vue` and `MealDraftRow.vue` in `components/meals/`. `MealDays.vue`, `MealWeekView.vue`, `TonightTile.vue` and `utils/meal-week.ts` changed.

### A bug found on the way

The e2e test found that a re-roll could leave a day unchanged when the weekly cap left only the current recipe. Moving off the current proposal now comes before the cap; the rest of the day's earlier proposals does not, so a re-roll never picks a recipe used twice already while another under the cap is left. Two unit specs cover it.

### Tests

- Vitest: `meal-suggester.spec.ts` (32) and `week-fill.spec.ts` (35), written by the test-writer agent. `npm test`: 967 tests in 52 files pass, the RLS suite included (2026-10-15).
- e2e: `tests/e2e/meal-fill.e2e.ts`, 1 test: the tile's line, the fill, the small-repertoire note, cancel, lock, "Re-roll the rest", a single re-roll, plan, reload. The clock is pinned to the last Monday before today at noon, in the past (see the root `CLAUDE.md` on pinned clocks). `a11y.e2e.ts` scans the week's proposal in both modes. The whole `dev` project passed, 41 tests (2026-10-15); the `pwa` project was not run. Typecheck, lint and format pass.

### Looked at, and left undone

Looked at on screen at 375x667 px in light and dark mode: the tile with the line and the button, and the week with proposals, one of them kept.

Not done: slice 3 was not tried by hand on a phone, and it is not committed or released.

## Released (2026-10-15)

Released as 1.13.0 the same day; how the release was checked, and the CI failures on the way, are in "Each release" in [`infra/releases.md`](../../infra/releases.md). The `pwa` project passed in CI, so the earlier "not run" is overtaken. The a11y walk had to be given 4 minutes because of the scan added here.

Still open, waiting for the owner, who has not tried slice 3 on a phone:

- The fill bar above the days instead of under them, as in the approved preview (see "Deviation from the approved preview").
- The widened ranking, the nearest use before or after the day (see "The rules of the proposal").
