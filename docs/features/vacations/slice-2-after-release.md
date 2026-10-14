# Vacation planner: slice 2 after its release

What the user changed in slice 2 after it was released as 1.7.0. The changes made before the release are in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md), and the slice itself in [`features/vacations/slice-2.md`](./slice-2.md). The current state is in [`progress.md`](../../progress.md).

## “Who has what” sorted by open tasks (2026-10-14)

At the user's request the people's lines of "Who has what" are sorted by their open tasks, the most first. Until then they stood in the order the people were added.

- **"Nobody yet" stays the last line.** It is the pool of tasks that wait to be given, not a person, and it is the line a member looks for to hand something out. Chosen without asking, and said so to the user.
- **Equal counts keep the people's order** (the sort is stable), so the lines are the same on every member's screen and don't swap places while nothing changes.
- **A line moves while the member works**: giving a task can move its person up. The lines are buttons, and a pressed one keeps its frame wherever it moves.

Tests: a unit test of `taskShares` with an uneven count. Browser journey 2 checks the whole strip where the order now differs: after a task is given to B, B's line comes first; after the member's task and Mia's, the member with two comes before Mia with one and B with none.

## Checks (2026-10-14)

`npm run lint`, `npm run typecheck`, the unit tests of `app/utils` and `app/composables` and the `dev` project's `vacations`, `a11y` and `dashboard` specs (7) pass after the change.

Not verified: the change on a phone; with two members' devices, whether a line that moves under a finger is pressed by mistake.
