# Vacation planner: slice 1

How the first slice of the vacation planner was built. The design is "Design: a vacation planner" in [`features/vacations/design.md`](./design.md); the reviews it went through and the templates are in the other vacation files that [`CLAUDE.md`](../../CLAUDE.md) lists. The current state is in [`progress.md`](../../progress.md).

## Slice 1: a trip checklist from a template (built 2026-10-13)

A member adds a vacation with a title, a kind and two dates, and it is filled with the tasks of the house or the hotel template. Its page shows the three phases as lists; a task is added, ticked, renamed and removed, the vacation is edited in place and removed after a confirmation, and all of it reaches the other members live. The dashboard has a fifth tile, and `/vacations` lists the trips. People, assignment and meals are slices 2 and 3.

The user approved the order of the build beforehand: the migration and its isolation tests, the pure logic, the database calls, the store, the pages, the browser tests, the docs.

### Migration 0015

`0015_vacations.sql` adds `vacations`, `vacation_tasks` and the function `create_vacation`. Before it went to the database that production shares, it was tried in a throwaway local Postgres of the same kind as the cloud project's. The fifteen migrations were applied there in order; all went through but the last statement of 0009, which names a function that only the cloud project has. A SQL script then acted as two members of different households and as a signed-out caller, and every rule held. The user read a summary of the SQL and approved it.

It was applied through the Supabase MCP server on the user's instruction, after two attempts with `supabase db push` did not run. The remote history therefore recorded it under a timestamp; with the user's go-ahead the row was renamed to `0015` the same day, so the history matches the filenames and `supabase db push` finds nothing pending.

### Decided during the build

None of these was in a review. The first two were put to the user; the rest follow the approved screens or an existing rule of the app.

1. **Adding a vacation waits for the server**, as saving a new recipe does: the form shows that it is saving and then opens the vacation's page. The docs had not settled it. An optimistic add would show every member a vacation that can still fail to save.
2. **`create_vacation` returns the rows it wrote**, the vacation and its tasks, so the page that opens has its tasks at once and does not depend on the events of thirty inserts arriving. It runs as the caller, unlike the app's other functions, so reading the rows back is safe.
3. **A date gets its year only for a trip that ended in an earlier year** ("5 to 12 Dec 2026"). The approved screens show next year's trip without one.
4. **Today's phase is folded once everything in it is done**, as the "Ready to go" screen shows, and open while it is empty, because that is where the field for its first task is. The design review's sentence only said that today's phase is open.
5. **The phases follow the trip once, when the page opens.** A phase that folded by itself when its last task is ticked would take the row from under the finger.
6. **An end before the start is refused twice**: by the date field's own `min`, which Chrome enforces, and by the app's own check with its message, for a browser that does not. The browser test asserts the first, a unit test the second.
7. **A task that could not be saved reports to its phase**, not to the page: the store hands the reason back to the caller, which puts it under the field the task was typed into, as the state table asks.
8. **The tile reuses the other tiles' preview.** A tile's entry can now be a muted line, which carries "in 54 days", and the preview shows its number whenever it names something, so a vacation whose tasks are all done says "0 open" and is still named. (The tile got lines of its own on 2026-10-13, with the trip before the number, see "The vacations' tile names the trip first" in [`features/dashboard.md`](../dashboard.md).)
9. **44 px is a class of its own**, `touch-target`, in a global stylesheet. Quasar's button is 36 px high and its tick box 40 px, as the rendering of the screens had shown, and the controls of these pages all need the minimum.
10. **The tasks of a removed vacation are still fetched.** Removing a vacation is one write to the vacation, as the engineering review decided, so its tasks stay live rows that nothing shows.
11. **The row's menu is a group of buttons**, as the account menu is, with "Edit" and "Remove" in normal case as on the screen.

### Bugs found while building

- **Saving a title with Enter reopened the row's menu.** The save moves the focus back to "More", and Quasar's menu listens for Enter being released on its button. The menu is now opened by the button's own press. Found by the browser journey, which asserts where the focus is.
- **The menu was open again after an edit.** Choosing "Edit" removes the line the menu belongs to before the menu can report that it closed. It is now closed explicitly. Found on a screenshot, and asserted in the journey since.
- **The two helpers that lay an edit over a row took the row's type from the changes**, not from the state, and the type check then refused a correct call. They no longer do.

### Tests

- **Unit tests**, 126 new: the templates' shape, the local dates (also run in a time zone west and one east of UTC), the trip's stage at its edges, the phases that open, the fourteen days across a month's and a year's end, the list's order, the tile's choice, the event reducer, the edit helpers, the database calls with the fake client, and the two new tables in the Realtime wiring's exact list.
- **Isolation tests**, 23 new, against the cloud project: another household reads and writes nothing, a task cannot name its own household and another household's vacation, nothing is hard-deleted, `create_vacation` writes everything or nothing and cannot be called signed out, the limits of the columns, and a household's removal takes both tables with it.
- **Browser journey 1**, `vacations.e2e.ts`, two browsers: a vacation from the house template with its 33 tasks, the other member's tile and list without a reload, a task added, renamed, ticked and removed with the focus rules asserted, the vacation renamed in place, an end before the start, a dropped and restored connection, a reload, and the removal with "Vacation not found" on the other member's page.
- **Extended**: `dashboard.e2e.ts` (the tile with a hotel's 25 tasks, and "and 1 more"), `session-switch.e2e.ts` (nothing of the first user's vacation is left), `a11y.e2e.ts` (nine scans of the new pages and states, in light and dark mode) and `auth.e2e.ts` (the three new pages are behind the sign-in).
- **Sign-ins**: counted as the engineering review of the design review's changes asked. The `dev` project signs in 30 times in one run, 28 before this slice and 2 for the journey; the earlier figures of 18 and 21 counted lines, and several of those are in loops and helpers. A whole run, both projects, took five minutes on 2026-10-13 and passed, so the suite now stands at the limit of about 30 sign-ins in five minutes. The journeys of slices 2 and 3 add three more.

The screens were compared with the approved ones on screenshots at 375 px, in light and dark mode, and a script measured every control of the vacation's page and the list: none is below 44 px, and no page scrolls sideways.

### When it breaks

The app has no logs or alerts of its own. What a member sees, and where to look:

- **"Add vacation" stays on the form with a red line.** `create_vacation` refused or did not answer. The line is the database's message. The function's errors are in the Supabase project's Postgres logs; a household the member does not belong to gives "new row violates row-level security policy".
- **A vacation's page says "Vacation not found."** The vacation was removed, belongs to another household, or the link is wrong. Row-level security returns no row for all three, so the page cannot tell them apart.
- **A tick, a new title or a removal jumps back, with a red line under the title.** The write was refused; the line says why. "This task was removed in the meantime." means another member removed it first.
- **A new task disappears again, with a red line under its field.** Its insert was refused.
- **The tile says "Couldn't load this."** The first fetch of the vacations or of their tasks failed; neither is shown without the other. The browser's console has the request.
- **Another member's change does not show.** The Realtime connection is down or the table is missing from the `supabase_realtime` publication. The change appears after a reconnect or a reload; the browser's network tab shows the websocket.
- **A page left open overnight shows yesterday's stage.** Known and accepted; reopening the page corrects it.

Rolling back is publishing the previous deploy. The database stays as it is: the two tables and the function are unknown to the older app and harmless to it.

### After a deploy

Nothing of this slice was tried on the deployed site or on a phone when this was written. (Released as 1.6.0 on 2026-10-13; the user went through this list on the deployed site the same day and reported all of it tested, without a finding.) To check there:

- A vacation is added on one phone and appears on another member's dashboard without a reload.
- The date fields open the phone's own date picker, and an end before the start is refused. Safari on an iPhone is the browser the app's own message was written for.
- A row's tick box, its "More" button and the phase's heading are easy to hit with a thumb.
- The page in dark mode.
- An installed app that has not updated yet still works: it does not know the new tables.

### Not verified

- Nobody has planned a trip with it. The templates' later phases and the fourteen days are guesses that the first trip checks.
- A screen reader was not used. The names, the roles and the focus after each action are asserted in the browser journey, which is not the same as hearing them.
- The focus after a tick is set again after the list is redrawn, because a browser may drop the focus of a row that moves. Whether it would have been lost without that was not tried.
