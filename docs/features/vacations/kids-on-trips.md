# The household's children on a trip

Until now a child on a trip was a name typed into the vacation's form, again for every trip. On 2026-10-16 the owner asked to "select my kids for a vacation and assign them tasks": a child of the household, from the list under "Kids" (see "Meal planner, slice 2" in [`features/meal-planner/README.md`](../meal-planner/README.md)), is picked for a trip and can be given tasks like any other person. This file tells how that was decided and built; it overtakes the statements in [`features/vacations/slice-2.md`](./slice-2.md) and [`features/vacations/slice-2-names-and-pictures.md`](./slice-2-names-and-pictures.md) that a child is a person without an account with a typed name.

## Children as people of a trip (built 2026-10-16)

### The owner's decisions

- **Old typed names are linked by matching the name.** The other choice offered, and recommended, was to leave the old trips alone and link only new picks, so that nothing is guessed from a name; the owner chose the matching.
- **A child's name on a trip follows the household's list.** `withChildNames` in `VacationView` puts the list's name over the one stored on the person, so a child renamed under "Kids" is renamed on every trip. The name is therefore not editable on the trip.
- **All children are ticked by default on a new trip**, as the members are.
- Commit type `refactor(vacations)`.

### Migration 0022 (applied to Supabase Cloud 2026-10-16)

Applied by `supabase db push` at the owner's go-ahead, after a dry run that listed 0022 alone. `database.types.ts` was regenerated; only `child_id` and its foreign key were added to it.

- `vacation_people.child_id`, nullable, with a composite foreign key `(child_id, household_id)` to `household_children`, `on delete set null (child_id)`: a child's row cannot name another household's child, and a deleted child leaves the person as a plain name.
- A check that a person is a member or a child, not both.
- A partial unique index: a child is on a live trip once. An index for the foreign key.
- Linking: an existing typed name was linked to a child where that was unambiguous, that is, the household has one live child and the trip one live typed person with that name, compared case-insensitively and trimmed. 6 rows were linked and 1 typed name stayed typed.
- `create_vacation` was replaced with `create or replace` (same arguments) and reads `child_id`.

### The client

- `NewVacationPerson` has `child_id`; the actions and the store pass it on.
- `peopleToStartWith(members, children, lastPeople)` starts a form with the members, the children and the names typed on the last trip, and drops a last-trip typed name equal to a child's, so that the child is not there twice.
- `peopleNotComing` offers the absent members and children in "Who is coming".
- `PersonAvatar` keys a child's badge ink on `child_id`, so a child looks the same on the kids' roster and on every trip.
- `VacationForm` loads the kids at setup and waits for them, or for their failure; on a failure it offers the members and typed names alone. It asks at setup and not when mounted because a load sets `loading` at once, so the people wait for it and are not taken from an error left by an earlier load.
- The form and "Who is coming" mark a child as "child" where they said "no account". The form's hint now says that the household's kids are added under "Kids" on the home page, and that the typed name is for someone without an account, such as a guest.
- New test id `TEST_IDS.vacation.people.absentRow`.

### Tests

- Unit specs for `vacation-share` and `vacation-actions`: 77 tests in the two files.
- Five new RLS tests in `tests/rls/vacation-isolation.spec.ts`: 47 pass in that file.
- A new describe in `vacations.e2e.ts`, "the household's children on a trip"; all three vacation e2e tests pass on the dev project, run against a worktree dev server.
- The full `npm test`: 54 files, 1004 tests pass. Lint, format and typecheck pass.

### Not done

- Not tried on a phone, and not released.
- The one typed name that was not linked stays typed; nothing in the app turns a typed name into a child afterwards.
- A child's name cannot be corrected on a trip; it is corrected under "Kids".
- A child removed under "Kids" stays on the trips they are on, as a member who left the household does; they are only no longer offered for new ones.
