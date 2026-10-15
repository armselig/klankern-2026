# Meal planner, slice 1a

How slice 1a was built: the plan table, the store, `/meals` and the Tonight tile. Why the planner exists is in "Why it exists, and the slices" in [`features/meal-planner/design.md`](./design.md); what came after is in [`features/meal-planner/slice-1b.md`](./slice-1b.md).

## Slice 1a: the plan, the store, `/meals` and the Tonight tile (built 2026-10-15)

Built on `develop`, not released (released in 1.11.0 on 2026-10-15, see "Releases" in [`infra/releases.md`](../../infra/releases.md)). Migration 0018 is applied to the cloud project (2026-10-15, version recorded as `0018` by `supabase db push`), and `database.types.ts` was regenerated.

### The table

`meal_plan_entries` (0018). An entry is a recipe of the household or a title ("toast"), on a date and in a slot, with a fractional `position`, `on_shopping_list_at`, `skipped_at` and `created_by`.

- **A recipe or a title**: `num_nonnulls(recipe_id, title) = 1`, a title is not blank and at most 200 characters (a row travels whole in a Realtime payload, and RLS cannot limit the size of a row a member may insert). The composite foreign key `(recipe_id, household_id)` to `recipes` keeps an entry's household equal to its recipe's, as for `vacation_meals` (0017).
- **`created_by`** defaults to `auth.uid()` and the insert policy checks it, so it cannot be forged.
- **Soft delete only**: no `delete` grant to `authenticated`, and `update` is granted per column (`date`, `slot`, `recipe_id`, `title`, `position`, `on_shopping_list_at`, `skipped_at`, `deleted_at`). So `household_id` and `created_by` cannot change after the insert.
- **In the `supabase_realtime` publication**, which is what the rule in "Realtime" in the root `CLAUDE.md` asks of every new table.
- **`vacation_meals` is untouched**, and there is no bridge, copy or foreign key between the two. Retiring the old table and its pages is a separate decision, not taken.

### The store and its rules

`stores/meal-plan.ts` is the sixth store on the shared list rules, with `utils/meal-plan-state.ts` for what differs and `composables/meal-plan-actions.ts` for the Supabase calls. **Every fix to the list rules now belongs in all six stores.**

- **It holds date ranges, not the table.** A plan grows without end, so `load(householdId, range)` fetches the days a page needs and the store remembers which (`loadedRanges`; `addLoadedRange` joins ranges that touch). A page asks `isLoaded` and shows a loading state, never an empty plan, until its days are in. `resync()` fetches every held range and keeps the rows outside them (`mergeMealPlanResync`): they were not part of the fetch, and dropping them would make a Realtime event for a day that is not on screen vanish at the next reconnect.
- **The windows and constants are in `utils/meal-week.ts`** and nowhere else: weeks start on Monday; `?week=` is normalised to its Monday and falls back to this week if it is not a day; the Tonight tile switches to tomorrow at 17:00 (`TONIGHT_SWITCH_HOUR`); the lookback for "last cooked" is 8 weeks (`COOKED_LOOKBACK_WEEKS`); the dashboard loads 8 weeks back to 2 days ahead. Days are `YYYY-MM-DD` strings through `utils/local-date.ts`, as the root `CLAUDE.md` asks.
- **A one-minute clock** (`composables/use-minute-clock.ts`) drives the switch at 17:00 and the "Today" mark on an open page.
- **Held removals.** The app has no undelete, so "Undo" cannot be a second write. Removing an entry hides it and holds its id for 5 seconds (`HELD_REMOVAL_MS`) before the soft delete is sent; "Undo" cancels it. Leaving the page, or a second removal, sends what is held at once. **Held removals are local to the device**: a closed tab or a lost connection sends nothing, and the entry is there on the next visit. An entry that is on the shopping list is not held: removing it asks first ("Its ingredients stay on the shopping list. Remove the entry?").
- **Realtime**: the listener `onMealPlanEntryChange` (INSERT and UPDATE) is added to the household's channel, `resync()` runs on `onSubscribed`, and the store is reset with the others on a change of user.

### The Tonight tile

`components/dashboard/TonightTile.vue`, with the order in `utils/dinner-order.ts` and the words in `utils/tonight-lines.ts`. The tile spans the dashboard's first row, before To-dos; the whiteboard's tile stays last. Its heading is "Tonight", and "Tomorrow" from 17:00.

- **The states** (`tonightState`): planned (the first dinner by position, "and N more"), planned with a removed recipe ("Recipe was removed", button "Plan something else"), suggested ("last cooked N days ago" or "not in 8 weeks", and "2 of 5"), exactly one recipe ("Only 1 dinner to choose from"), skipped (today only), and empty. An empty household gets the link "Write what you eat" and the button "Add a dinner as text". Loading shows a spinner without buttons, and a failed load says so; a failed plan load degrades only this tile.
- **Buttons**: "Plan this", "Another one", "We didn't cook this" (today only, never after 17:00) with "Undo", "Change" and "Plan something else" (to `/meals`).
- **The order of suggestions**: a recipe never cooked within the 8 weeks comes first, then the one cooked longest ago, ties by title so every device shows the same. Nothing records that a dinner was cooked, so **a planned dinner of an earlier day counts as cooked unless it was skipped**. Recipes already planned for the day or later are left out, unless none would remain. Entries with a title only are ignored; there is nothing to propose. No model is called; the order is a plain pure function so that slice 3 can extend it.
- **"Another one"** is an index into that order, held on this device only. It starts again when the day or the dinners change.
- **An exception to the tile rule** "keep everything else in a tile plain text" in the root `CLAUDE.md`, as the vacations' tile is: its buttons lie above the heading's stretched link (a `z-index`), and the link is still named "Tonight".

### The page `/meals`

`pages/meals/index.vue` with `components/meals/MealWeekView.vue` and `components/meals/AddMealDialog.vue`. Dinners only in 1a: one bordered list of seven days (weeks from Monday), previous, next and this week, "Add a dinner" as a recipe or as text (the dialog is shared with the tile's "Add a dinner as text"), and removal with "Undo". The page loads the household first, as the others do. The week is in the address (`?week=`).

### Bugs found on the way

- **"Another one" was reset by every resync.** The first version watched the list of dinners; a resync builds a new list with the same dinners, so the suggestion went back to the first one a moment after the press. The e2e test for the tile caught it. The tile now watches a key built from what the dinners say (`id`, day, recipe, skip), not the list.
- **The dashboard crashed on a second visit.** Its watcher on the household runs at once and used a `today` constant that is declared further down the same script, which is a temporal dead zone error when the household is already known (a second visit). The accessibility scan, which opens the dashboard twice, caught it. The watcher now computes the day itself, with a comment saying why.

### Tests

- Unit specs for every new util (`meal-week`, `dinner-order`, `meal-plan-state`, `tonight-lines`), the actions and the store, and for the new listener in `household-realtime.spec.ts`. 617 unit tests pass, the RLS suite included (`npm test`, 2026-10-15).
- `tests/rls/meal-plan-isolation.spec.ts` (17 tests, pass) is the **fifth** RLS spec. It covers reading, the foreign household, the foreign recipe, a forged `created_by`, skipping and soft delete, a member of another household changing an entry and a refused hard delete.
- `tests/e2e/meal-plan.e2e.ts`: the tile proposes, plans, skips and switches to tomorrow, the week page adds a dinner as text and removes it with "Undo", and a day that is not a Monday opens its week. Playwright's clock fixes the time, and the tests start with `openSignedIn`. (The fixed time made them fail on CI; moved to yesterday on 2026-10-15, see "The e2e tests failed on CI: a clock ahead of the session" in [`features/meal-planner/ci-clock-failure.md`](./ci-clock-failure.md).) `a11y.e2e.ts` scans the tile, `/meals` and the add dialog in both modes.
- **`tests/support/fake-supabase-client.ts` has no `gte` or `lte`**, so the meal-plan specs add them to the builder themselves. Not fixed in the shared fake.

### Known limits

- Held removals are local to the device (see above).
- A meal added on a trip's meal page stays in `vacation_meals` and never reaches the plan. (Overtaken 2026-10-15: slice 1b removed `vacation_meals`, see "Slice 1b" in [`features/meal-planner/slice-1b.md`](./slice-1b.md).)
- Only dinners can be planned; breakfast, lunch and snack exist in the table and not on screen. (Overtaken 2026-10-15 by slice 1b.)
- Not tried by hand on a phone yet. (Tried 2026-10-15, see "Slice 1a tried by hand (2026-10-15)".)

### Not built yet: slice 1b

Breakfast, lunch and snack rows, the move dialog, the trip's view `/meals?trip=<id>`, the vacation page's "Meals" row pointing there, the shopping run from the plan (a structural entry type for `putMealsOnShoppingList`, from today on, skipping skipped entries and removed recipes), and "Make a recipe from this" for a title entry. These were specified in the review and are not in the code. (Built 2026-10-15, except that the day view was dropped; see "Slice 1b" in [`features/meal-planner/slice-1b.md`](./slice-1b.md).)

## Slice 1a tried by hand (2026-10-15)

The owner tried slice 1a by hand after the release of 1.11.0 and found nothing to change.
