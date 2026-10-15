# Adding a synced store

A checklist for the next table that is shared by a household and kept live. It was collected when the meal plan became the sixth store (see [`features/meal-planner.md`](../features/meal-planner.md)). The rules themselves are in the root `CLAUDE.md`; this file lists where each one has to be applied so that none is forgotten. A rule that changes is changed there, and this list follows.

## The checklist (written 2026-10-15)

### Migration

- The table has `household_id` and RLS with `is_household_member(household_id)`; soft delete only, so no `delete` grant to `authenticated`; `update` granted per column when some columns must not change (`household_id`, `created_by`). A column that names the author defaults to `auth.uid()` and is checked on insert.
- It is added to the `supabase_realtime` publication, or events never arrive. A new function in `public` gets `revoke execute ... from public, anon` and an explicit grant.
- Regenerate `app/types/database.types.ts` after applying it. Ask before applying (see "Migrations and types" in the root `CLAUDE.md`).

### Store

- Actions in `composables/*-actions.ts`, the store in `stores/`, the reducers that differ in `utils/*-state.ts`; the generic ones come from `utils/list-state.ts`.
- The three pieces of bookkeeping at module level: inserts in flight, changes during a fetch, Realtime event order. `pendingIds` in state. Events and `resync()` wait for `householdId` when the rows hang on the household.
- A table with a large column needs a reducer that lays an event over the local row (the TOAST rule in "Realtime" in the root `CLAUDE.md`).
- A store that holds only part of a table (the meal plan holds date ranges) has to keep what lies outside the part on a resync.

### Wiring

- A listener in `HouseholdChangeListeners` and its two `.on(...)` calls (INSERT and UPDATE) in `composables/household-realtime.ts`, passed in `use-household-realtime.ts`.
- The store in the list of `useResetStoresOnUserChange`.
- `load(...)` called by the dashboard and by the feature's pages. A failed load must degrade only what shows it.
- A route in `ROUTES`, test ids in `TEST_IDS`.

### Tests

- Unit specs for the utils, the actions (with the fake client; it lacks some filters, such as `gte` and `lte`, so a spec may need to add them) and the store.
- A spec in `tests/rls/`: its own file for a new feature, so the files keep running in parallel (see "The RLS suite in four files that run in parallel" in [`infra/testing.md`](./testing.md)). A file that uses the secret key starts with `// @vitest-environment node`.
- An e2e test that starts with `openSignedIn`, and a case in `a11y.e2e.ts` for each new page, dialog and dashboard tile, in both modes. A page that is opened twice in one test is what finds a use of a value before its declaration in `<script setup>` (see "Bugs found on the way" in [`features/meal-planner.md`](../features/meal-planner.md)).

### Documentation

- A feature file, and the line in the list in `docs/CLAUDE.md`; the status and test counts in `progress.md`; the root `CLAUDE.md` where it counts the stores and the RLS specs.
- Every fix to the list rules belongs in every store; say in the root `CLAUDE.md` how many there are.
