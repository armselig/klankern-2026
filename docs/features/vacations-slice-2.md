# Vacation planner: slice 2

How the second slice of the vacation planner was built. The design is "Design: a vacation planner" in [`features/vacations.md`](./vacations.md), and most of what this slice shows was decided in "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md). Slice 1 is in [`features/vacations-slice-1.md`](./vacations-slice-1.md). The current state is in [`progress.md`](../progress.md).

## Slice 2: fair share (built 2026-10-13)

A vacation has people: the household's members and people without an account, such as a small child. A task is given to a person, taken, or handed back; the person it was given to can reject it with a reason, which everyone sees, and the task is nobody's again. "Who has what" shows the open tasks per person at the top of the page, "Only my tasks" filters the phases, and "Tell them" hands a sentence with a link to the device's share sheet. A link opened signed out leads to its page after sign-in.

("Tell them" and the links that land at a task were taken out again the same day, before the slice was released, see "“Tell them” removed" in [`features/vacations-slice-2-after-trying.md`](./vacations-slice-2-after-trying.md). What this section says about them is how they were built.)

The user approved the plan and three recommendations beforehand: the tests start signed in with a session (see "Signing in without the form" in [`infra/testing.md`](../infra/testing.md)), a person without an email address is drawn as the plain account icon, and the order of the build.

### Migration 0016

`0016_vacation_people.sql` adds `vacation_people`, three columns on `vacation_tasks` and re-creates `create_vacation` with a third argument for the people. It was tried in a throwaway local Postgres first, as 0015 was, and applied through the Supabase MCP server with the user's go-ahead; its history row was renamed to `0016`.

- **A person tied to an account is a member of the household**, by a foreign key to `household_members`. When the membership goes, the person stays on the trip as a name (`on delete set null` on the account's column alone).
- **The old call still works.** An installed app that has not updated yet calls `create_vacation` with two arguments; the new function's third has a default. The old signature is dropped in the same migration, because two functions would make that call ambiguous. An isolation test makes the two-argument call.
- **The MCP server asks the user to confirm a migration that drops something.** The first call was interrupted at that question, and a retry then fails with "Invalid or expired requestState" until a fresh one is confirmed. Nothing was applied in between.

### Decided during the build

1. **A task can be handed back to nobody**, from "Give to…", for a task that is someone's. The approved screen of "Give to…" has the entry; the design's text had not named the write. It is the same write as giving, with no person.
2. **People who were added together are ordered: members first, then by name.** The form adds them in one statement, so they share its time, and the ids are random. Found by the browser journey, which saw a different order on every run.
3. **A rejection is not optimistic.** The dialog waits for the server, because the write only counts while the task is still that person's, and the dialog has to say when it isn't. Giving and taking are optimistic.
4. **The line "Tell them" appears only where a message has someone to go to**: after giving a task to another person with an account, and after the member's own rejection. Not after "I'll take it", and not for a person without an account, as the design review decided.
5. **A vacation without people shows no second line.** Vacations added before this slice have none; "Who has what" then says so and offers "Change people". A member who is not on a trip gets no "I'll take it" there.
6. **A field's hint is the theme's muted text, not Quasar's hint.** Quasar's grey is below 4.5:1 on the theme's surface in light mode. Found by the accessibility scan, in the reject dialog and under "Add a name".
7. **The tile's third line**: "2 yours · 1 came back", only when there is something to say.
8. **The message that could neither be shared nor copied is shown in a dialog** to be selected by hand.

### A gap in the live sync, found here and narrowed for every feature

After the Realtime channel reports that it is joined, the server takes a quarter to half a second more until changes flow: it then reports "Subscribed to PostgreSQL" (measured twice on 2026-10-13: the join 2.8 s and the report 3.3 s after the page was opened, and 2.5 s and 2.7 s). The stores refetched at the join. A change another member made in that half second was in neither the refetch nor an event, and stayed missing until the next reconnect or visit.

It showed as a browser journey that failed once in two runs: one member added a vacation just as the other's dashboard had opened. The tests had hidden it until then, because a sign-in through the form took seconds longer. `subscribeToHouseholdChanges` now asks for a refetch a second time when that report arrives, for all five stores. In the app it shows as a third request for each table right at the report, after the load and the refetch at the join.

The gap is narrowed, not closed. A store's refetch does nothing while its first load is still running, so when that load answers later than the report, as it may on a slow connection, a change made between the load's answer being read and the report is still missed. Remembering that a refetch was asked for during the load, and running it afterwards, would close it; that is a change to all five stores and was not made.

### Bugs found while building

- **A variable named like a component replaced the component.** The page held a reference to "Who has what" in a variable `fairShare`; in the template `<fair-share>` then resolved to the variable, and Vue stopped with "Maximum recursive updates exceeded". The dev server's error overlay covered the page, which is how the journey found it.

### Tests

- **Unit tests**, 62 new: who has a task and who said no, a removed person's tasks counting as nobody's, the shares, "Only my tasks" and its texts, the people a new vacation starts with, both links built and read, the three sentences, the path check for the sign-in return, sharing or copying with its four outcomes, the new database calls, and the tile's third line.
- **Isolation tests**, 18 new: people are isolated like the other rows, a member is on a vacation once, a person's account must be a member, an assignee belongs to the same vacation, the shapes of a rejection, and the old two-argument call.
- **Browser journey 2**, in `vacations.e2e.ts`, two browsers: a vacation with both members and a child, a task given and seen as "yours", "Tell them" copying a sentence with a link to the task, a rejection with a reason and the focus on "I'll take it" afterwards, the other member seeing it live and taking the task, a task of a person without an account, "Only my tasks", a link that lands at a task in a folded phase, and a person taken off the trip.
- **`auth.e2e.ts`**: a link opened signed out leads to its page after sign-in, with its parameter, and sign-out forgets a remembered page. It signs in through the form twice, which makes 9 form sign-ins in a run.
- **`a11y.e2e.ts`**: six more scans, in light and dark mode.
- The whole suite: 500 unit and isolation tests, 34 browser tests.

The new states were compared with the approved screens on screenshots at 375 px, and a script measured every control of the vacation's page again: none is below 44 px, and no page scrolls sideways.

### When it breaks

In addition to "When it breaks" in [`features/vacations-slice-1.md`](./vacations-slice-1.md):

- **"This task isn't yours any more."** Someone gave the task to another person while the reject dialog was open. Nothing was written.
- **The reject dialog stays open with a red line.** The write was refused; the line is the database's message.
- **"Tell them" shows "Copy this message" with the sentence.** The device has no share sheet and the browser refused the clipboard.
- **A link from a message ends on the dashboard.** The browser was signed out and the remembered page was lost: cookies are blocked, or the sign-in happened in another browser than the one that opened the link.
- **A link's task is not marked.** The task was removed; the page says so at the top.

### After a deploy

Nothing of this slice was tried on the deployed site or on a phone when this was written. To check there:

- "Tell them" opens the phone's share sheet, and the messenger keeps the link. Neither can be tested automatically.
- The link from that message, opened on a phone whose browser is signed out, leads to the task after signing in.
  (These two went with "Tell them" on 2026-10-13. What is left of the second: an address of the app opened in a browser that is signed out leads to its page after signing in.)
- An existing vacation from before this slice: "Who has what" offers "Change people", and after adding the people its tasks can be given.
- Two phones: a task given on one shows as "yours" on the other without a reload.

### Not verified

- That a messenger keeps the link when it receives the sentence as text.
- The time between the join and the report was measured twice, on one machine and one day.
- That the gap is gone in practice: the journey that showed it failed once in two runs before and has passed since, which is few runs. And see above for the case that is left.
- A screen reader was not used; the announcements (`role="status"` on the "Tell them" line, `role="alert"` on errors) are asserted to exist, not heard.
