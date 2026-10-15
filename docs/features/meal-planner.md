# Meal planner

The household's meal plan: what is cooked on which day, and the Tonight tile on the dashboard that proposes a dinner. It is built in slices; this file holds all of them and is split along them when it grows (see the rules in [`CLAUDE.md`](../CLAUDE.md)). The state is in [`progress.md`](../progress.md).

## Why it exists, and the slices (decided 2026-10-15)

Every day the parents ask "what shall we eat today or tomorrow". The household settles on one of about five dishes, or on toast and pasta for the two small children while the adults eat something else. The load is the daily deciding, so the app proposes and the parents veto. **The Tonight tile on the dashboard is the product; the week page is its supporting tool.** The children (4 and 6) are not users.

The work was reviewed before it was built and split into slices:

- **Slice 1, in two releases.** 1a is the plan table, the store, a list of dinners on `/meals` and the Tonight tile. 1b is the full week with all four slots, a move dialog, a trip's view and the shopping run from the plan.
- **Slice 2**: a kids' version text on a recipe, children as household records, recording what a child refused (exceptions only), and a visible effect on the suggestion. Its screens are to be approved before it is built.
- **Slice 3**: "Fill my week" with a lock and a re-roll per slot, the proposer behind a typed interface, and the tile showing the week's proposal.

Slices 2 and 3 are not designed further than that here. Left out on purpose, so that nobody builds them unasked: copying last week, theme nights, who eats on which day, a share link for a day, a fixed weekly template, retiring `vacation_meals` and its pages, reordering inside a slot, and "exclude this recipe".

## Glossary

The words are fixed so that code, screens and these docs say the same. A **dinner** is an entry in the slot `dinner`. An **entry** is one row of `meal_plan_entries`: a recipe or a title on a day and in a slot. **Kids** means the two small children. The slots are called breakfast, lunch, dinner and snack.

## Slice 1a: the plan, the store, `/meals` and the Tonight tile (built 2026-10-15)

Built on `develop`, not released. Migration 0018 is applied to the cloud project (2026-10-15, version recorded as `0018` by `supabase db push`), and `database.types.ts` was regenerated.

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
- `tests/e2e/meal-plan.e2e.ts`: the tile proposes, plans, skips and switches to tomorrow, the week page adds a dinner as text and removes it with "Undo", and a day that is not a Monday opens its week. Playwright's clock fixes the time, and the tests start with `openSignedIn`. `a11y.e2e.ts` scans the tile, `/meals` and the add dialog in both modes.
- **`tests/support/fake-supabase-client.ts` has no `gte` or `lte`**, so the meal-plan specs add them to the builder themselves. Not fixed in the shared fake.

### Known limits

- Held removals are local to the device (see above).
- A meal added on a trip's meal page stays in `vacation_meals` and never reaches the plan.
- Only dinners can be planned; breakfast, lunch and snack exist in the table and not on screen.
- Not tried by hand on a phone yet.

### Not built yet: slice 1b

Breakfast, lunch and snack rows, the move dialog, the trip's view `/meals?trip=<id>`, the vacation page's "Meals" row pointing there, the shopping run from the plan (a structural entry type for `putMealsOnShoppingList`, from today on, skipping skipped entries and removed recipes), and "Make a recipe from this" for a title entry. These were specified in the review and are not in the code.

### Measuring whether it is used

The kill condition, set before building: **if fewer than 4 of the first 14 days after slice 1 have a planned dinner, slices 2 and 3 wait until the cause is understood.** If the tile is used and the week page is not, the page is retired rather than extended. "Plan this" counts as planned, so the number measures use of the planner as a whole. The parents also answer, by hand, whether they had the "what shall we eat" talk that week.

The count is one read-only query for the Supabase SQL editor. Set the two values at its top: the household's id and its time zone.

```sql
-- Days of the last 14 with at least one planned dinner, for one household.
with params as (
  select
    'the household id'::uuid as household_id,
    'Europe/Berlin'::text as time_zone
),
today as (
  select (now() at time zone (select time_zone from params))::date as day
)
select count(distinct e.date) as days_with_dinner
from meal_plan_entries e, params, today
where e.household_id = params.household_id
  and e.slot = 'dinner'
  and e.deleted_at is null
  and e.date between today.day - 13 and today.day;
```

Not checked: the review asked for this query to be tested once in the RLS suite against a seeded household; `meal-plan-isolation.spec.ts` has no such test.
