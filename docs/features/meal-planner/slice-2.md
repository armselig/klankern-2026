# Meal planner, slice 2: the kids

How slice 2 was built: the children of a household, what they ate, a record of what they refused, and the effect of that on what the Tonight tile proposes. Slice 1 is in [`features/meal-planner/slice-1a.md`](./slice-1a.md) and [`features/meal-planner/slice-1b.md`](./slice-1b.md).

## Slice 2: the kids (built 2026-10-15)

Built on `develop` the same day as the release of 1b, not committed and not released when this was written. Migration 0021 is applied. Slice 2 was started before the kill condition's date (2026-10-29) at the owner's choice; the call of `count_planned_dinner_days` on that day stays, see [`features/meal-planner/measuring.md`](./measuring.md).

### Screens approved before building (2026-10-15)

The owner chose each from proposed options.

- **Recording is an item in a dinner's menu**: "How did the kids eat?" in the entry's menu opens a dialog with one radio group per child (Ate it, Picked at, Refused). It is offered only for a dinner from a recipe, on or before today, not skipped, and only when the household has children. A row gets a muted second line only for exceptions ("Refused: Mila · Picked at: Jo"). Rejected: toggles in the row, which break the one-line row, and recording from the Tonight tile alone.
- **The record is a read-only page**, `/kids`, "What the kids refused": per child the recipes refused and picked at, with counts ("once", "twice", "3 times"), over the last 8 weeks (`COOKED_LOOKBACK_WEEKS`), the most often first. Rejected: a count on the recipe's page only.
- **Children are managed on the dashboard**, in a "Kids" row under the members' roster (`KidRoster.vue`), with a link "What the kids refused". The owner picked this over managing them on `/kids`. A child is drawn by `<person-avatar>` as letters on a disc, never with a Gravatar.
- **A recipe refused at least twice by one child** in the 8 weeks before the tile's day (`REFUSALS_TO_DEMOTE` = 2) is proposed after all others, and the Tonight tile says why: "Refused twice by Mila", with several children "Refused twice by Mila and 3 times by Jo". Rejected: the line without the effect.

### Decided against the spec (2026-10-15)

The build spec said a child's record counts only entries dated on or after the child's `created_at`. That is dropped: every recorded reaction in the window counts, also for dinners from before the child was added. Only exceptions are recorded, and a member who adds the kids wants to enter last week's refusals. The e2e test found it, when it seeded refusals from 10 and 20 days back for a child added that day.

### Migration 0021, applied

Applied to the cloud project with the owner's go-ahead by `supabase db push` after a dry run; the history records `0021`. `database.types.ts` is regenerated.

- `recipes.kids_version`: text, null or not blank, at most 2,000 characters.
- `household_children`: id, `household_id`, name (at most 100), `created_by`, `created_at`, `deleted_at`. `update` is granted on `name` and `deleted_at` only.
- `meal_plan_entries_id_household_id_key`, a unique constraint, so that a reaction can point at an entry and its household together.
- `meal_reactions`: `household_id`, `entry_id`, `child_id`, `reaction` (`picked_at` or `refused`), `created_by`, `created_at`, `deleted_at`. Composite foreign keys to (entry, household) and (child, household), so that a reaction cannot join rows of two households. A partial unique index on (`entry_id`, `child_id`) where `deleted_at` is null. `update` is granted on `reaction` and `deleted_at`.
- Both tables are in the `supabase_realtime` publication, and neither grants `delete`.

### Reactions: "ate it" is no row

Only exceptions are stored. Choosing "Ate it" leaves no live row. Changing between picked at and refused updates the live row. Going back to "Ate it" soft-deletes it, and recording again after that inserts a new row: a removed row is never revived, because nothing may undo a soft delete. That is why the unique index is partial.

### The code

- `types/kids.ts`, `composables/kids-actions.ts`, `utils/kids-state.ts` (`liveChildren`, `reactionNote`, `canRecordReactions`, `childRecords`, `refusalsByRecipe`, `refusalLine` and others) and `stores/kids.ts`.
- The kids store is the seventh synced store, one store for the two tables as the vacation store is, and reuses `applyVacationRowEvent`, `applyRowEdit` and `revertRowEdit`. It loads every live reaction. The record and the Tonight order read the meal plan's entries that the dashboard and the page load anyway (8 weeks back), so there is no join.
- Realtime: `onHouseholdChildChange` and `onMealReactionChange` in `household-realtime.ts`; the store is in the list that is reset when the user changes, and the dashboard loads it.
- `utils/dinner-order.ts` takes a `demoted` set.
- The kids' version of a recipe is a "Kids' version" textarea in the recipe form, with a hint in `text-muted`, and is shown on the recipe's page under the instructions. It is handled like `instructions` for the TOAST rule: an UPDATE event may leave it out, and `isWholeRecipe` checks it.
- A notice never names a child: a failure says only "Could not save…". The confirmation for removing a child names it.

### A bug found on the way

On the dashboard a template ref named `kidRoster` shadowed the component `<kid-roster>`, which is the known rule in the root `CLAUDE.md` about variables named after components. The page crashed with "Maximum recursive updates". The e2e test found it; the ref is now `childrenRoster`.

### Tests

- Vitest: `kids-state.spec.ts` (49), `kids-actions.spec.ts` (25), the store's `kids.spec.ts` (44) and 4 more in `recipe-state.spec.ts`, written by the test-writer agent. `npm test`: 900 tests in 50 files pass (2026-10-15).
- RLS: `tests/rls/kids-isolation.spec.ts`, 32 tests, the sixth RLS spec file.
- e2e: `tests/e2e/kids.e2e.ts`, 2 tests. `a11y.e2e.ts` scans the add-child dialog, the dashboard with a child, the reaction dialog, a dinner a child refused and `/kids`, in both modes; all pass. `mealEntry` in `tests/support/e2e-ui.ts` now finds a row by its name element (the recipe link or the id `meals.entryName`) and no longer by the row's whole text, since a row can have the note line. New helpers: `kidOnRoster`, `reactionRadio`. The whole `dev` project then passed, 40 tests (the `pwa` project was not run).

### Looked at, and left undone

Looked at on screen at 375x667 px in light and dark mode: the dashboard with two children, the Tonight tile with the refusal line, the week with the note, the dialog, `/kids` and the recipe page with the kids' version. One Low finding, left as it is: the link "What the kids refused" is the browser's default blue, like the recipe links in the week (already noted Low in `slice-1b.md`).

Not done: slice 2 was not tried by hand on a phone, and it is not released.

## After a review of the diff (2026-10-15)

- **"Add child" before the children were loaded** called the store's `addChild` without a household and threw. The dashboard now shows the kids' row only once the kids store has loaded the household; a failed load leaves the row out.
- **The note under a dinner disagreed with what counts.** A refusal recorded and then followed by "We didn't cook this", or by a move to a later day, still showed "Refused: Mila" under the entry, while the record and the suggestions leave such a dinner out and its menu no longer offers to change it. The note now shows only where the reactions can be recorded. After it, `kids.e2e.ts`, `meal-plan.e2e.ts`, `a11y.e2e.ts` and the `pwa` project passed again, 18 tests.

## Released (2026-10-15)

Released as 1.12.0 the same day; how the release was checked is in "Each release" in [`infra/releases.md`](../../infra/releases.md). Not yet tried by hand on a phone.
