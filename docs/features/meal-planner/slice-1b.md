# Meal planner, slice 1b

How slice 1b was built: the other slots, the move dialog, a trip's view, the shopping run from the plan and "Make a recipe from this". It ends slice 1; slice 1a is in [`features/meal-planner/slice-1a.md`](./slice-1a.md).

## Slice 1b: the week with all slots, the trip's view and the shopping run (built 2026-10-15)

Built on `develop` the same day as 1a's release, not released and not committed when this was written. Migration 0020 is written and **not applied**. (Released 1.11.1 on 2026-10-15, see "Each release" in [`infra/releases.md`](../../infra/releases.md).)

### Decisions by the owner (2026-10-15)

- **The old trip meals are removed entirely**: the table `vacation_meals`, the page `/vacations/<id>/meals`, `VacationMealsView`, `MealRow`, `RecipePickerDialog`, `utils/vacation-meals.ts`, their parts of the vacation store, the actions and the Realtime listener, `vacation-meals.e2e.ts` and the RLS tests of the meals. The old address is not redirected. Not chosen: moving the rows into `meal_plan_entries`, because they had no day.
- **A trip's meals are the plan's entries on the trip's days**, at `/meals?trip=<id>`. The vacation page's "Meals" row points there and says "N dinners planned" (`dinnersPlannedLine`). The vacation store is therefore back to three tables.
- **There is no day view.** The spec's link on a day's heading is dropped.
- **The 14-day kill condition counts from the end of slice 1**, the release of 1b, not from 1a's release (see [`features/meal-planner/measuring.md`](./measuring.md)).

### Migration 0020, written and not applied

`0020_drop_vacation_meals.sql` takes the table out of the `supabase_realtime` publication and drops it with its rows. `recipes_id_household_id_key` (0017) stays, since `meal_plan_entries` needs it for its foreign key to `recipes`.

It is applied only with the owner's go-ahead, **after the release is live and the installed apps have updated**: an older app fetches `vacation_meals` together with the vacations, and a failing fetch leaves its vacation pages empty. `database.types.ts` is regenerated after it, not before.

### The store and the actions

- `update(id, change)` is optimistic and on a failure reverts only the columns it changed. `updateMealPlanEntry` replaced `setMealPlanEntrySkipped`, and `applyMealPlanChange` replaced `applyMealPlanSkip` in `utils/meal-plan-state.ts`.
- `move` puts the entry after the target slot's entries (a position after the last) and keeps `on_shopping_list_at`: ingredients already on the list stay there.
- `makeRecipeOf` sets `recipe_id` and clears `title` and `on_shopping_list_at` in one update. The update is sent even when the entry is not in state, because the form is a page of its own and may have been reloaded. If it fails, the recipe stays saved and the member gets a notice.
- `markOnShoppingList` throws when the server refuses, so the shopping run can stop.

### The screens

- **`MealDays.vue`** is the list of days that the week and the trip share. The dinner is the main row of a day; breakfast, lunch and snack show only when something is planned, and one line of "+ Breakfast", "+ Lunch" and "+ Snack" buttons per day adds them. Each entry has one overflow menu (`MealEntry.vue`): "Make a recipe from this" for a title entry, "Move", "Mark as cooked" for a skipped one, and "Remove". The menu is opened by its button's own press, as in the root `CLAUDE.md`.
- **`MoveMealDialog.vue`**: radios for the slot, buttons for today, tomorrow and the six days after, and "Another day" with the app's `vacation-date-field`. The spec asked for a native date input; the app's field is used for the reason the vacation form uses it.
- **`MealTripView.vue`**: the heading "Trip to `<title>`, `<dates>`" and "Show all weeks". An unknown trip and one of another household give the same not-found.
- **`MealWeekView.vue`** is only the heading ("Meals, week of …") and the navigation now.
- **"Make a recipe from this"** opens `/recipes/new?entry=<id>&title=<title>` with the form prefilled; on save the store's `makeRecipeOf` links the entry.

### The shopping run from the plan

`utils/shopping-run.ts` (`planShoppingRun`) picks the entries: the shown days from today on, not yet on the list. It leaves out and counts the skipped ones, entries with a title only and entries whose recipe was removed. `putMealsOnShoppingList` takes a structural `{ meal: { id }, recipe }`, so the plan's entries and the old meals' shape did not need two copies. It still goes entry by entry, because `addAll` says only how many items it saved.

The result is one notice, "N items added to the shopping list. Left out: …". A Quasar caption was not used: Quasar dims it below 4.5:1 on the primary color.

### Tests

- Unit specs for all of it. `npx vitest run app`: 622 tests in 40 files pass (2026-10-15). The RLS suite, still five specs, passes with 119 tests (2026-10-15); `vacation-isolation.spec.ts` lost its meals tests.
- `meal-plan.e2e.ts` has six tests. Added: a move to tomorrow's lunch and making a recipe of a title; the shopping run; the trip's page leading to the plan of its days. All six pass locally on the `dev` project. `vacation-meals.e2e.ts` is gone. The whole Playwright suite lists 41 tests in 14 files; the `dev` project passed all 36 locally (2026-10-15), the `pwa` project was not run.
- `a11y.e2e.ts` scans the trip view empty and with a dinner, the run's notice, the entry menu and the move dialog: all four pass in both modes.

### Found on the way

- **The focus was lost after the move dialog.** Its "Move" sat in the entry's menu, which Quasar's auto-close did not close when the dialog took the focus: the menu stayed open underneath, its button still "expanded", and after Cancel the focus went nowhere. `MealEntry.vue` now closes the menu itself before it reports a choice, and `MealDays.vue` puts the focus back on the entry's "More" once the dialog has gone (on the dialog's `hide`), also after a move. The e2e test asserts it after Escape.
- **Locators by text crept in.** The first e2e version found the move dialog's "Tomorrow" by its text and the recipe link and slot heading by role; they now use test ids (`entryRecipeLink`, `slotHeading`) and the day button's place.

### Looked at on screen (2026-10-15)

Screenshots at 375x667 in both color modes, of a week with a recipe and a title for dinner and a breakfast and a lunch on one day, the open entry menu, the move dialog and an empty trip view. Everything fits the width and nothing overlaps; the dialog's eight day buttons stand in two columns. A week is long: an empty day takes about 130 px for its "Add dinner" and the line of the other slots, so a week is about two screens. Not measured, and not tried on a phone.

### Not done, and open

- **The planning-count query is not tested in the RLS suite.** The review asked for it once. Raw SQL needs a direct Postgres connection with `SUPABASE_DB_PASSWORD`, which CI does not have. Open for the owner: add that secret to CI, or wrap the query in an RPC. (Wrapped in a function and tested on 2026-10-15, see "The count as a function" in [`features/meal-planner/measuring.md`](./measuring.md).)
- **Not tried by hand on a phone.**
- The shopping run goes entry by entry and stops at the first failure.
- Migration 0020 is not applied (see above).

## After the first review (2026-10-15)

- **Migrations renumbered.** The owner had the planning count wrapped in a function, which was applied at once, while the drop of `vacation_meals` waits for the release. So the function became `0019` and the drop `0020`: applied in the other order, a later `db push` would have found `0019` behind an applied `0020`. Everything above that says 0019 for the drop meant what is now `0020_drop_vacation_meals.sql`.
- **A trip that could not be loaded span for ever.** `MealTripView.vue` showed its spinner until the vacations were in the store, and a failed first load never put them there. It now says "Couldn't load the trip. Reload the page to try again." An e2e test blocks the vacations' request and expects that line.

## QA on localhost (2026-10-15)

A QA run (gstack `/qa`, Standard tier) went through slice 1b at 375x667 with a disposable member and household on `nuxt dev`: the week's slots, the entry menu by state, mark as cooked, move, remove with Undo, making a recipe of a title, the shopping run with its notice and list, the trip's page and view, the removed old address and an unknown trip. All passed, with no console errors from the app.

- **The focus after "Mark as cooked" looked lost** and is not: Quasar gives it back to the "More" button by focusing the `q-focus-helper` span inside it, as for every menu, so `document.activeElement` is a span. `tests/e2e/meal-plan.regression-1.e2e.ts` checks that the focus is inside the button. The e2e helper `mealEntry` now also finds a skipped entry, whose row says "Skipped" after the name.
- **Left as they are (Low):** after "Remove" the focus falls to the page, since the row goes and the Undo notice cannot hold it; "Add dinner" is indented further than the line of the other slots, and recipe links in the week are in the browser's default blue.
