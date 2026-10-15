# Vacation planner: design review

The design review of the vacation planner's screens. The design is "Design: a vacation planner" in [`features/vacations/design.md`](./design.md), the engineering reviews are in [`features/vacations/review.md`](./review.md) and the scope review is "Scope review" in [`features/vacations/scope-review.md`](./scope-review.md). The current state is in [`progress.md`](../../progress.md); [`CLAUDE.md`](../../CLAUDE.md) lists the other topic files.

## Design review (2026-10-12)

Before slice 1 was built, the screens were reviewed in seven passes: what a member sees first, the states of every screen, the journey, generic-looking UI, the fit with the app's look, phones and accessibility, and what was still undecided. Seventeen issues came out of it. Each was put to the user as one question with its alternatives, and the user decided all of them.

The review was done in text against the wireframe of the design, because no mockups could be generated. A second reader, a subagent that had not seen the plan before, read the design and the wireframe first and reported nine findings; most of the issues below were found by both.

### What was wrong with the wireframe

- **Slice 1 had no way in.** The app has no menu: a feature is reached through its tile on the dashboard, and the header only leads back there. The plan built the pages in slice 1 and the tile in slice 2.
- **The task's row did not fit a phone.** With people and assignment it held a tick box, a title, "Edit", a picture, a name, up to three text buttons and a quoted reason, with buttons drawn about 22 px high. Removing a task had no control at all.
- **Every task was a box of its own**, where the to-dos and the shopping list are one list with separators, and the borders carried meaning: heavier for the member's own task, dashed for a rejected one.
- **The page looked the same on every day of the trip**, and a vacation became "past" on the day its "Afterwards" tasks fell due.
- **Nothing accepted after the wireframe was drawn**: "Tell them", "Only my tasks", "All done", editing and removing a vacation, people after creation.

### Decisions (user, 2026-10-12)

1. **A phase is one bordered list with separators**, as the to-dos are. The box per task goes, and with it the heavier and the dashed border. Not chosen: the boxes as drawn.
2. **A row has two lines and one "More" button.** Line 1 is the tick box with the title as its label and, at the right, an icon button that opens a menu with Edit, Give to… and Remove. Line 2, from slice 2, is the person's picture and name and at most one text button: "Reject" on the member's own task. Another person's task has no button there. A rejection adds who said no and the quoted reason. Slice 1's row is line 1 only, with Edit and Remove in the menu. Not chosen: a pen and a bin as icon buttons with the name as the picker (88 px less for the title, a bin beside the tick box), and the wireframe's text buttons at 44 px (rows of three to four lines). (Line 2 was given up on 2026-10-13 after the user tried it, see "The task's row back to one line" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md).)
3. **"Tell them" is a line in the row, and an entry in the menu.** After the member gives a task or rejects one, that row gets one more line with "Tell them" and a close button. It has no timer: it stays until it is closed or the member leaves the page, it is held in the page's state only and nobody else sees it. The menu keeps "Tell them" for later, on a task that has a person or a rejection. It is not offered after "I'll take it", nor for a person without an account, who cannot open the link. This settles what the scope review left open. Not chosen: a button on the confirming notice (it leaves after seconds, sits away from the row, and several stack), and the menu alone (nothing reminds the member). ("Tell them" was removed on 2026-10-13, and decisions 10 and 12 with it, see "“Tell them” removed" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md).)
4. **The "Vacations" tile ships in slice 1**, with the next vacation and its open tasks; slice 2 adds how many are the member's and how many came back. The vacation's page starts with a flat "All vacations" button, as a recipe's page has "All recipes", because an installed app has no back button on every device. Not chosen: a plain link in slice 1, and no way in until slice 2.
5. **The page follows the trip, and a vacation stays until it is unpacked.** The phase of today is open: Before until the start date, During until the end date, Afterwards after it. An earlier phase with open tasks stays open too; later and finished phases are folded to their heading and count, and a tap opens any. Folding lasts for the visit. The line under the title says "in 54 days", "day 3 of 8" or "back since 12 Dec". A vacation stays current, on the tile and in the list's upper group, until its end date has passed and "Afterwards" has no open task, at most 14 days after the end. Not chosen: folding with "past" by date alone, and phases that are always open.
6. **The states of the undrawn screens are fixed**, see "States of the screens". Not chosen: only "not found" and the empty list, and leaving them to the build.
7. **A vacation is edited in place on its page.** "Edit" under the title turns the title and the dates into fields where they stand, with Cancel, Save and "Remove vacation", which asks first and says how many tasks go with it. From slice 2, "Change people" turns "Who has what" into the list of names: each can be changed, a tick takes a person off, and a field adds one. The user chose this over the recommendation. Not chosen: an edit page as the recipes have (recommended, because it keeps a destructive button off the daily page), and a menu beside the title with three dialogs. (Since 2026-10-13 only the name of a person without an account can be changed there, see "A member's name is not a field" in [`features/vacations/slice-2-names-and-pictures.md`](./slice-2-names-and-pictures.md).)
8. **A task is edited in place, in its row.** The title turns into a text field with Save and Cancel; Enter saves, Escape cancels, an empty title is not saved. Edit changes the title only. Not chosen: a small dialog.
9. **"Only my tasks" stands above the phases and has its own texts.** Ticked, a phase counts the member's tasks ("2 of yours open"), says "Nothing of yours here." or "Yours are done", and the line "Untick to add tasks." explains the hidden add fields. Not chosen: the unfiltered texts, which contradict the filtered list. (Replaced on 2026-10-13 by the lines of "Who has what", which filter the tasks for any person, see "The names of “Who has what” filter the tasks" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md).)
10. **A "Tell them" link lands at its task.** The link names the task; the page opens that task's phase, scrolls to its row, moves the focus there and marks the row for a moment. If the task is gone, the page opens at the top and says so. Not chosen: opening with "Only my tasks" ticked (it would hide a rejected task, which is nobody's), and the top of the page.
11. **A free task shows two buttons.** A task that is nobody's or was rejected shows "I'll take it" and "Give to…" side by side in place of the words "Nobody yet". With one button, giving a task took three taps, about forty for "Before", while taking one took a single tap: the row made keeping everything the easy path. Not chosen: the row of decision 2 unchanged, and the name as the picker. (Replaced on 2026-10-13 by one person button per row, see "The task's row back to one line" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md).)
12. **One message per person as well.** New in slice 2: a person's line in "Who has what" gets a share button, "Tell sam about their open tasks", for one message with the number of their open tasks and a link that opens the vacation with "Only my tasks" ticked. It is shown for other people with an account only. After a trip is added, a member gives several tasks in a row, and nobody sends a message for each. Not chosen: noting it for later, and leaving it out.
13. **The look uses existing tokens.** "yours" is set in medium weight. A rejection is plain text in the muted text colour, with no bar and no background. All bars of "Who has what" are one muted colour, hidden from screen readers, with the number beside them. (The bars went on 2026-10-13, see "“Who has what” as a strip of names" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md).) The arrival mark is the theme's veil for a surface, fading in about two seconds, and it stays for a person who has turned motion off. The row's buttons are flat without a colour. Not chosen: bars in each person's rosette colour (each to be calculated in both modes, and a person without an email address has none).
14. **The reject dialog is the app's dialog with a plain form inside**, as the invite dialog is built, in place of the design's native dialog. Its errors are shown inside it. Not chosen: the browser's own dialog element, which needs its own theming and hides a notice that appears while it is open.
15. **Six rules for phones, keyboards and screen readers**, see "Access rules". Not chosen: sizes and names only, and leaving it to the automated scan, which sees none of them.
16. **Meals are never added twice.** The design's text holds over a note in the wireframe that asked before adding again. When no meal is left to add, the button gives way to "Everything is on the shopping list." A deliberate repeat is the recipe's own button.
17. **The tile is last in the grid as it is**, alone in the third row. Not chosen: first and wide while a trip is current, and last across both columns.

### The task's row

```text
+--------------------------------------+
| [ ] Check passports and ID cards   : |
|     (A) yours              [Reject]  |
+--------------------------------------+
| [ ] Ask the neighbours to water    : |
|     the plants                       |
|     [I'll take it]  [Give to...]     |
+--------------------------------------+
| [ ] Pack the kids' clothes         : |
|     sam said no: "I'm already busy   |
|     enough washing all the clothes." |
|     [I'll take it]  [Give to...]     |
+--------------------------------------+
| [ ] Wash the clothes for the trip  : |
|     (S) sam                          |
|     Given to sam.   [Tell them] [x]  |
+--------------------------------------+
| [x] Book the house                 : |
+--------------------------------------+

":" is More: Edit, Give to..., Tell them, Remove
```

### States of the screens

What a member sees. The states the wireframe named already (the form, a failed tick or reject, the reject dialog, the meals) stay.

| Screen          | Loading                         | Empty                                                                                                   | Failure                                                                                                                                                            | When it works                                                                                                                                   |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/vacations`    | Spinner in place of the list    | "No vacations yet. Add your next trip, and the app fills in the tasks." above the "Add vacation" button | The error in a red line under the list                                                                                                                             | Two groups, "Upcoming" with a running trip first, and "Past". A row shows title, dates, the stage line and "N open". An empty group is left out |
| Vacation's page | Spinner in place of the content | A phase without tasks: "Nothing here yet"                                                               | "Vacation not found. This vacation doesn't exist, or it was removed." with "All vacations". The same replaces the page if the vacation is removed while it is open | "All done", "Ready to go"                                                                                                                       |
| Adding a task   | none                            | An empty field does nothing                                                                             | The task is taken out again and the error stands under the field                                                                                                   | The row appears at once and the field keeps the focus                                                                                           |
| Dashboard tile  | As the other tiles              | "No vacation planned."                                                                                  | "Couldn't load the vacations."                                                                                                                                     | Title, stage line, "N open"                                                                                                                     |
| "Who has what"  | With the page                   | Nobody has an open task: "Nothing open."                                                                | none of its own                                                                                                                                                    | A person without open tasks is listed with 0; a removed person is not listed                                                                    |

(Two of these texts changed on 2026-10-12: the tile reports a failed load with the tile component's own text, and the list's upper group has no heading, see "Engineering review of the design review's changes" in [`features/vacations/design-eng-review.md`](./design-eng-review.md).)

### Access rules

- **Size**: every control is at least 44 px in both directions, including "More" and the control that folds a phase.
- **Names**: the visible word stays short and comes first in the name a screen reader hears, which adds the task: "Reject: Check passports and ID cards". Otherwise a page has some sixty buttons called "More" or "Reject".
- **Structure**: each phase is a heading with a button that says whether it is open, and its tasks are a list. "Who has what" is a list of people with the number as text.
- **Focus**: after a tick the row moves to the end of its phase and the focus stays on its tick box. After a rejection it goes to that row's "I'll take it"; after a removal to the next row, or to the add field if it was the last; after an edit back to the row's "More"; on arrival through a link to the marked row.
- **Announcements**: a failed action is announced, and so is the "Tell them" line when it appears.
- **Wider screens**: one column of 480 px, as every other page.

The focus rules are asserted in the three browser journeys.

### What it changes in the earlier plans

- Slice 1 gains the tile and its test in `dashboard.e2e.ts`.
- "Past" is no longer decided by the end date alone: the local-date helper of the engineering review also takes the open "Afterwards" tasks and the 14 days.
- Slice 2 gains a second sentence and a second kind of link, and the link of "Tell them" carries a task through the sign-in step.
- Editing a vacation has its screen: in place, not a page.

An engineering review of these changes had not been done when this was written. (Done the same day, see "Engineering review of the design review's changes" in [`features/vacations/design-eng-review.md`](./design-eng-review.md).)

### Not verified

- Nothing was rendered. The row, the texts and the widths were judged from text and from estimates, not seen on a screen. (Rendered on 2026-10-12 and approved by the user on 2026-10-13, see "Screens rendered and approved" in [`features/vacations/screens.md`](./screens.md).)
- The 14 days are a guess, to be checked on the first trip.
- The second reader was a model of the same family as the session that wrote the plan. No reviewer outside it was available.
- In slice 1 the vacation's page has no visual anchor beyond its title and the stage line; "Who has what" comes in slice 2. No decision addresses that.
