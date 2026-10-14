# Vacation planner: slice 2 after its release

What the user changed in slice 2 after it was released as 1.7.0. The changes made before the release are in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md), and the slice itself in [`features/vacations/slice-2.md`](./slice-2.md). The current state is in [`progress.md`](../../progress.md).

## “Who has what” sorted by open tasks (2026-10-14)

At the user's request the people's lines of "Who has what" are sorted by their open tasks, the most first. Until then they stood in the order the people were added.

- **"Nobody yet" stays the last line.** It is the pool of tasks that wait to be given, not a person, and it is the line a member looks for to hand something out. Chosen without asking, and said so to the user.
- **Equal counts keep the people's order** (the sort is stable), so the lines are the same on every member's screen and don't swap places while nothing changes.
- **A line moves while the member works**: giving a task can move its person up. The lines are buttons, and a pressed one keeps its frame wherever it moves.

Tests: a unit test of `taskShares` with an uneven count. Browser journey 2 checks the whole strip where the order now differs: after a task is given to B, B's line comes first; after the member's task and Mia's, the member with two comes before Mia with one and B with none.

## A task added under a person's line is theirs (2026-10-14)

At the user's request the field for a new task stays under each phase while a line of "Who has what" is pressed, and a task typed there is given to that person at once. Until then the fields were hidden in every filtered view, because a new task was nobody's and would have vanished from a person's list as it was saved (see "The names of “Who has what” filter the tasks" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md)).

- **The assignment is in the insert** (`assignee_id` in `insertVacationTask`), not a second update after it: the task never shows as nobody's in between, on this device or on another member's, and the optimistic row is already the person's.
- **The field's label names the person**: "Add a task before the trip, for you" or "…, for Mia" (`addTaskLabel`). Under "Nobody yet" the label is the plain one and the task is nobody's, which is what that line lists, so it stays there too.
- **The line under the strip** no longer says that the tasks can be added after pressing the line again: "Only Mia's open tasks. Press the name again to see all."
- No migration: the column, its foreign key to a person of the same trip and the policies are those of 0016, and a member could already set `assignee_id` on any task of the household.

Tests: unit tests of `addTaskLabel` and of the insert with a person, and the changed texts of `taskFilterHint`. Browser journey 2 adds "Sunglasses" under the member's own line and checks that it is listed there as theirs, that their line counts two, and that the other member sees it as the member's. The accessibility scan of a pressed line now includes the field.

## Checks (2026-10-14)

`npm run lint`, `npm run typecheck`, the unit tests of `app/utils` and `app/composables` (398) and the `dev` project's `vacations` and `a11y` specs (6) pass after both changes.

Not verified: either change on a phone; with two members' devices, whether a line that moves under a finger is pressed by mistake.
