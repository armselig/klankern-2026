# Vacation planner: tasks copied from an earlier trip

How the templates were replaced by copying an earlier trip's tasks. The design is "Design: a vacation planner" in [`features/vacations/design.md`](./design.md); the templates this replaces are in [`features/vacations/templates.md`](./templates.md). The current state is in [`progress.md`](../../progress.md).

## A new vacation starts empty or with an earlier one's tasks (built 2026-10-14)

The user asked that a new vacation no longer be filled with default tasks, and that the form offer to copy all the tasks of a previous vacation instead. Until then every vacation got the house or the hotel template, 33 or 25 tasks, some of which named things only one household has (see "The house and hotel templates" in [`features/vacations/templates.md`](./templates.md)).

### Decisions (user, 2026-10-14)

1. **The form chooses the vacation that was added last.** It is the same rule the form already uses for who is coming (`lastCreatedVacationId`), so a household that plans one trip after another gets its list again with no extra step. The member can pick another trip or "No tasks". Not chosen: "No tasks" as the default.
2. **A copy starts open and nobody's.** Done, given and rejected say something about the earlier trip, and its people may not be this trip's. Not chosen: giving a copy to the same person when that person is on the new trip.
3. **The templates are deleted**, data and code. The first vacation of a household starts empty. Not chosen: keeping the templates as a third choice beside "No tasks" and the earlier trips.
4. **Only live trips and tasks count.** A removed vacation is not offered, and a removed task is not copied.

### How it is built

- **No migration.** `create_vacation` (0015, 0016) already takes the tasks from the app and accepts an empty list, so only the app decides where they come from.
- **`tasksToCopy`** (`utils/vacation-state.ts`) turns an earlier trip's tasks into the new trip's. It keeps each task's phase and title and the order within the phase, done or not, and numbers the positions from 1 again, so the fractions left by edits on the earlier trip are not carried over. `vacationsByCreation` lists the trips the form offers, the one added last first, which is the trip `lastCreatedVacationId` picks.
- **The store's `add`** takes the id of the trip to copy, or null, and copies from the tasks it already holds: every task of the household is loaded with the vacations, so nothing is fetched.
- **The form** shows "Start with the tasks of" only when the household has a vacation. It is a native `<select>`, which phones show with their own picker, drawn like the Quasar fields around it, with a line under it saying that copies start open and belong to nobody. Its choice is taken once, when the vacations are known, as the people are: a trip that arrives while the form is open is offered but doesn't change the choice. A trip that was removed while the form was open is not copied.
- **The kind of stay stays.** It no longer decides any tasks, but it is shown on the trip and is to decide the meal plan in slice 3. It still can't be changed after the vacation is added. (Changed 2026-10-15: it can be edited, and it decides no meal plan either, see "Design review of the meals" in [`features/vacations/slice-3-design.md`](./slice-3-design.md).) The reason given until then, that the old kind's tasks would stay, is gone; making it editable was not asked for.
- `VACATION_KINDS` and `VACATION_PHASES` moved from the deleted `utils/vacation-templates.ts` to `utils/vacation-state.ts`, and the type `VacationTemplateTask` is now `NewVacationTask`.
- The list's empty text no longer says that the app fills in the tasks.

### Tests

- **Unit tests**: `tasksToCopy` (copies are open and nobody's, removed tasks are left out, the order within a phase is kept and counted anew) and `vacationsByCreation` (live trips only, and the first is the one `lastCreatedVacationId` picks). The thirteen tests of the templates were deleted with them.
- **E2E**: the tests that need tasks to work with first add an earlier trip through `create_vacation`, as the household's own (`tests/support/earlier-trip.ts`). Its 33 tasks are the former house template, so the counts in the journeys stayed, plus a ticked task ("Clothes") and a removed one ("Old tent"). The trip lies a hundred days back, so no tile or list counts it as current.
  - Slice 1's journey and `a11y.e2e.ts` reload the page after adding the trip: Realtime delivers its rows out of order, and the form copies the tasks the page holds when it is saved, so a soft delete arriving late would have been copied.
  - Slice 1's journey checks that the form chooses that trip, that "Clothes" arrives unticked and "Old tent" not at all. At its end the list is no longer empty; it checks that the removed trip is gone and the earlier one is still there.
  - Slice 2's journey and `a11y.e2e.ts` add the earlier trip too and let the form copy it. The accessibility scan of the form now covers the new choice, in both modes.
  - `dashboard.e2e.ts` adds the household's first vacation, which starts empty: its tile says "No tasks open" where it said "25 tasks open".
- Run on 2026-10-14: `npm run lint`, `npm run typecheck`, `npm test` (492 tests in 33 files), and the `dev` project's `vacations`, `dashboard`, `a11y` and `session-switch` specs (8 tests), all passing. The form was looked at in a screenshot at 375 px in light and dark mode.

### Not verified

- Nobody has added a vacation with a copy on a phone, where the select opens the system's picker.
- Choosing "No tasks" while the household has a vacation is covered by no test: the e2e tests leave the form's choice as it is, and the store's `add` has no unit test.

## Quasar's pickers and two frames in the form (2026-10-14)

After seeing the form the user asked for Quasar's pickers where Quasar has one, and for a frame around the dates and around the choice of tasks, each, to set them apart.

- **The dates** are `<vacation-date-field>` (`components/vacation/`), Quasar's documented pattern of a `q-input` with a `q-date` in a popup: the field takes a typed day (`YYYY-MM-DD`, through Quasar's mask), and a calendar button beside it opens the calendar, which closes on a pick. "Until" doesn't offer the days before "From" and opens on its month. Weeks start on Monday. The form only: the edit in a trip's header kept the browser's date fields, which was not asked for. (The header got the same field later that day at the user's request: its end before its start is now refused by the app's message, which browser journey 1 checks, where it checked Chrome's own refusal before.)
- **A typed day can now be no day** ("2026-12", "2026-02-30"), which the browser's date field never let through. `vacationDetailsProblem` returns a third problem, `day`, for it (`isLocalDate` in `utils/local-date.ts`), and both forms show the text of any date problem. Chrome's own refusal of an end before the start (the native field's `min`) is gone from this form; the app's message "The trip can't end before it starts." does it.
- **The choice of tasks** is a `q-select` in place of the native `<select>` of the section above, with the same options and the same first choice. Quasar puts its `data-testid` on the hidden input it focuses, whose value is the chosen option's label; the test checks that value.
- **The frames** are `fieldset`s with a legend, "Dates" and "Tasks", in the line color and radius of the other boxes of the vacation pages (`--theme-outline`, 4 px).
- **Contrast**: the axe scan of the open calendar failed in both modes. Quasar fades the weekdays' names and the days it doesn't offer with opacity, below 4.5:1. `theme.css` gives them the muted text color instead, and strikes through a day that can't be picked: in light mode the muted text is too close to the text to tell the two apart otherwise.
- **The calendar's popup is a named dialog** (`role="dialog"`, "Until: pick a day"): on a wide screen the popup is Quasar's menu, which declares no role, so a screen reader had nothing to announce. `a11y.e2e.ts` opens the calendar and the select and scans both, in both modes.
- Run on 2026-10-14: `npm run lint`, `npm run typecheck`, the unit tests of `local-date` and `vacation-state` (100), and the `dev` project's `vacations`, `dashboard`, `a11y` and `session-switch` specs (8), all passing. The form and the open calendar were looked at in screenshots at 375 px in both modes.
- Not verified: the calendar on a phone, where Quasar opens it as a dialog instead of a menu.
