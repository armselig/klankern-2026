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

## “Change people” in the frame of “Who has what” (2026-10-14)

At the user's request: pressing "Change people" changed the layout. "Who has what" has the frame of the lists of tasks (`--theme-separator`, square, with its heading inside, see "A frame around “Who has what”" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md)); the "Who is coming" that takes its place had its heading above a frame of its own around the list alone (`--theme-outline`, 4 px corners). Now "Who is coming" stands in the same box as "Who has what", heading and "Done" inside, and the list has no frame of its own, so the box stays where it is and only its content changes.

- The box's rules are written out in `VacationPeople.vue` beside those of `FairShare.vue`, with a comment naming the other; the two components share no style sheet.
- Checked at 375x667 in light and dark mode in both states. The `dev` project's `vacations` and `a11y` specs pass (6), the scan of "the people of a vacation" included.

## A rejection stands out (2026-10-14)

The user found that the reason of a rejection under a task did not stand out: it was a line of muted grey text. Six options were rendered on a real trip page at 375 px in both modes and put on a page for the user to compare: today's line, a red icon in front, a bold lead, icon and a red lead, a pale red box with a red edge, and an outlined badge. All kept text at 4.5:1 or more and none relied on color alone. I recommended the box; the user chose the icon with the red lead, then changed it: only the icon red, the lead bold in the text color.

- **The line now has a red stop hand** (`mdiHandBackLeftOutline`, 18 px, `text-ink-red`) beside its first line, **"Mia said no:" in bold**, and the whole line in the text color instead of muted. Red on the page is 4.8:1 in light mode and 7.1:1 in dark mode, above the 3:1 an icon needs; the text is 7.1:1 and 11.3:1.
- The icon has no name of its own (Quasar hides it from screen readers): the words say it already.
- Its text is the same as before, so the tests that read it (browser journey 2) are unchanged.

Checked at 375x667 in both modes. The `dev` project's `vacations` and `a11y` specs pass (6), the scan of a rejected task in both modes included.
