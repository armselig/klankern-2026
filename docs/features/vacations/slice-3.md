# Vacation planner: slice 3

How the third slice of the vacation planner was built. What it was to be is "Meals" in [`features/vacations/design.md`](./design.md); what a member sees was decided in [`features/vacations/slice-3-design.md`](./slice-3-design.md), whose numbered decisions are quoted below as "decision N". Slice 2 is in [`features/vacations/slice-2.md`](./slice-2.md). The current state is in [`progress.md`](../../progress.md).

## Slice 3: the meals (built 2026-10-15)

A trip has meals: recipes of the household picked for it, the same recipe as often as the plan needs it. The meals have a page of their own, `/vacations/<id>/meals`, which a one-line link between "Who has what" and "Before" leads to, with a status such as "3 meals, 2 not on the shopping list". One button, "Put N ingredients on the shopping list", puts the ingredients of the meals that are not on the list yet there and notes on each meal that they are. The kind of stay can be edited and decides nothing, so meals are allowed on every kind. At the time of writing the slice is built and committed on `develop`, not released. Released in 1.10.0 on 2026-10-15, see "Releases" in [`infra/releases.md`](../../infra/releases.md).

The build followed the order of "Steps" in [`features/vacations/design.md`](./design.md): the migration and its RLS tests, the kind of stay, the actions, the reducers and the store, the pages, and the browser tests. The kind of stay went into a commit of its own (`feat(vacations): let a member change a trip's kind of stay`), as the user asked for several commits.

### Migration 0017

`0017_vacation_meals.sql` adds `vacation_meals` (`vacation_id`, `household_id`, `recipe_id`, `position`, `on_shopping_list_at`, `created_by`, `created_at`, `deleted_at`) and a unique `(id, household_id)` on `recipes`. It was applied to the cloud project with `supabase db push`, and, as that records the version itself, no history row had to be renamed.

- **Two composite foreign keys keep the household equal everywhere.** A meal's `(vacation_id, household_id)` points at the vacation and its `(recipe_id, household_id)` at the recipe, so a meal can't name a recipe or a vacation of another household whatever the client sends. That is why `recipes` needed the unique constraint. Both cascade, which is also what lets the tests delete a whole household without being blocked by its meals.
- **No unique constraint on a vacation's recipe**, as the user asked: the same dish may appear twice.
- **Select, insert and update are granted, delete is not**, as for the other tables since 0012: a meal is soft-deleted. The table is added to the `supabase_realtime` publication in the same file (see 0011), which is the step that is forgotten when events never arrive.
- **The migration is additive**, as every one must be while development and production share a project: an installed app that has not updated yet does not know the table and does not break.
- **0015's comment that the kind decides the meal plan is overtaken.** The migration says so at its top. The grant that lets a member change the kind is the update grant 0015 already gave, so no grant changed.

### Decided during the build

Beyond the ten decisions of [`features/vacations/slice-3-design.md`](./slice-3-design.md):

1. **The button works meal by meal, and stops at the first failure.** The shopping store's `addAll` answers only with the number of items it saved, so one call for all meals could not say which meal was complete. `putMealsOnShoppingList` (`composables/meals-on-shopping-list.ts`) calls it once per meal and notes the meal (`on_shopping_list_at`) only when all its ingredients saved. A meal saved in part is not noted, so the next press adds it once more, and a duplicate of some ingredients is possible. The same is true of a recipe's own button, and a duplicate on a shopping list is cheaper than a missing item. The run stops at the first failure and says which meal and how many were done before it (decision 6). Not chosen: carrying on past a failure, which would leave a plan with gaps that the line can't describe.
2. **Noting a meal is not optimistic.** Adding and removing a meal are, as a task is. The note is written after the items are saved, and showing it before the write would say "on the shopping list" for a meal whose note then failed.
3. **The link's status counts only once the recipes are loaded.** Which meals wait for the list is known from the meals and their recipes (a meal whose recipe was removed has nothing to put there and is not counted as waiting). Until the recipes are in, `mealsSummary` gets `null` for the waiting count and says only "3 meals", which is always true, rather than a wrong "all on the shopping list".
4. **The picker's search ignores case and accents.** "creme" finds "Crème brûlée".
5. **A removed recipe's meal stays**, with "Recipe was removed" in place of the link. It can still be removed. It is not counted when the button works out what is left.
6. **The dashboard's tile is unchanged** (decision 9). The data layer does load the meals with the vacations, in `load()` and `resync()`, as it does the people and the tasks.

### Data layer

- The type `VacationMeal`, and the actions that fetch the household's meals, insert one with its client-generated id, set the note and soft-delete (`composables/vacation-actions.ts`). `subscribeToHouseholdChanges` got a listener for the table (`onVacationMealChange`), and the store `stores/vacations.ts` the meals by id, `addMeal`, `removeMeal`, `markMealOnShoppingList` and the reducer `applyMealEvent`. The rules are those of the other rows: client ids, soft deletes only, the bookkeeping of "Shared list logic" in the root `CLAUDE.md`.
- `utils/vacation-meals.ts` holds what the page and the link say, worked out from rows, so the components only render it: the live meals of a trip in order, the meals still to go on the list, the ingredient count, the button's label, the summary, the line under the picker's search ("Added: Lentil soup (2 in the plan)"), the search and the failure line.

### Found during the build

- **Quasar's `q-icon` sets `aria-hidden="true"` itself.** The check on a meal's row has to be named "On the shopping list", and with the attribute left alone a screen reader never reaches it. A meaningful icon needs `aria-hidden="false"` explicitly.
- **A flat button inside a `q-item`'s side section takes Quasar's grey, `#757575`, which fails the contrast** on the theme's surface. The picker's "Add" buttons set the theme's text colour. It is the same family as "Don't give a flat button a color" in the root `CLAUDE.md`, reached by another way.
- **The accessibility scan has to wait for the "added" notice to fade**, as the step for the recipe page already does; the notice overlaps what the scan reads while it is on its way out.

### Tests

The counts of the whole suite are in [`progress.md`](../../progress.md).

- **Unit tests**: new specs for `utils/vacation-meals.ts` (order, what waits, the counts and the wording, the search with case and accents) and for `putMealsOnShoppingList` (the run in order, no meals, a meal without ingredients, a partial save that stops the run and is not noted, a failing `addAll` or note); additions to `vacation-actions.spec.ts`, `household-realtime.spec.ts` and `vacation-state.spec.ts` (the kind).
- **Isolation tests**: a nested "meals" block in `tests/rls/vacation-isolation.spec.ts`: a recipe picked more than once, meals isolated like the other rows, a meal on another household's vacation or with another household's recipe blocked, no hard delete, the note and the soft delete, no move into another household, a member changing the kind, and the cascade with the household and its recipes.
- **Browser journey** `tests/e2e/vacation-meals.e2e.ts`, two members: the link and its status, the picker, the same recipe twice, the other member seeing the meals live, the shopping list with its seven items, a meal added later counted alone, removing a meal with and without the question, a removed recipe, and editing the kind.
- **`a11y.e2e.ts`**: steps for the meals page empty, the picker, the page with a meal and the notice, and the trip with its link, scanned in both colour modes.

### When it breaks

- **The red line "Couldn't add …" under the button.** The run stopped at that meal: the line names it and says how many meals were added before. Read the reason in the line; pressing the button counts only what is left. Items the stopped meal already put on the list stay there and will be added again.
- **A meal says "Recipe was removed".** Its recipe was soft-deleted, or the recipes of the household had not arrived when it was looked up. A reload tells which: if it stays, the recipe is gone, and the meal can only be removed.
- **A meal has no check although its items are on the shopping list.** The items were saved and the note was not: the write of `on_shopping_list_at` failed or the page was closed between. Pressing the button adds the items a second time and then notes the meal. Taking the duplicates off the list is by hand.
- **The link says only "3 meals" with no word about the list.** The recipes are not loaded yet: the status waits for them (see above). If it stays so, the recipe store failed to load, and the recipes page shows why.
- **No event arrives for a meal on another phone.** Check that the table is in the `supabase_realtime` publication; without it the subscription succeeds and nothing comes.
- **Adding a meal fails with a row-level security message.** The recipe or the vacation is of another household, or removed meanwhile; the composite keys refuse it.

### After a deploy

Nothing of this slice was tried on a phone, nor on the deployed site, when this was written. To check there, with two phones signed in as two members of one household:

- Pick three recipes in the dialog on one phone, one of them twice; the other phone shows the meals and the link's status without a reload.
- Press "Put N ingredients on the shopping list": the shopping list on both phones has the items, the button gives way to "Everything is on the shopping list.", and the checks stand on the rows.
- Add a meal afterwards: the button counts only its ingredients.
- Remove a meal that is on the list: the question comes first and the items stay on the list. Remove one that is not: it goes at once.
- Edit the kind of stay in the trip's header: the other phone shows it.
- Open the dialog on a phone, type in the search and watch that the keyboard doesn't cover the list, the status line or "Done".

### Where the build differs from the design review

- **The dashboard fetches the meals too.** The review chose to leave the tile alone partly because it would load no new data. The store's `load()` fetches its four tables together, and the dashboard calls it, so each visit fetches the household's live meals as well. They are small rows; a separate, lazy load for the meals page was not built.

### Not verified

- **Nothing was tried by hand on a phone.** The page, the dialog and the link row were looked at on screenshots at 375 px in both color modes, not measured, and the accessibility scan covers them; the rest is the tests.
- **The design had no mockups** (see "Open and not verified" in [`features/vacations/slice-3-design.md`](./slice-3-design.md)). Whether the check icon reads as a state beside a long title, and whether the link row looks like a link, is still for the first rendering by a person.
- **No screen reader was used.** The status line and the errors are asserted to carry their roles, not heard.
- **The wording** of the empty states, the failure line and the status was written in the review and has not been read aloud.
- **A household with many dozens of recipes** was not tried in the picker.
