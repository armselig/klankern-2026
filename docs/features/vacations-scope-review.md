# Vacation planner: scope review

The scope review of the vacation planner's plan. The design is "Design: a vacation planner" in [`features/vacations.md`](./vacations.md), and the engineering reviews before and after this one are in [`features/vacations-review.md`](./vacations-review.md). The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Scope review (2026-10-12)

After the engineering review (see "Engineering review" in [`features/vacations-review.md`](./vacations-review.md)) the plan was looked at from further away: is this the right thing to build, what is missing for it to be used, and what will it cost in a year. The scope of the design was kept, and additions were offered one at a time. The user accepted seven and declined one.

### What prompted it

- **Other apps do share the load.** A search for exactly that found a group of apps that make household work visible and divide it between partners. So "Who has what" is not new ground, as the design's "What it is for" suggests. What was not found is declining with a reason, and none of them is tied to an event such as a trip or sits beside a household's own lists and recipes.
- **Shared task apps tend to fail in one way**: one partner uses the app and the other never opens it. The design has no notifications, so a task given to someone reaches them only if they open the app by themselves.

### Scope decisions (user, 2026-10-12)

1. **"Tell them"** (slice 2). After giving a task or rejecting one, the app offers the device's share sheet with a sentence that names the task and a link to the vacation, so it goes out through the messenger the household uses anyway. Where a browser has no share sheet, "Copy message" does the same through the clipboard, as the invite dialog copies its link. Nothing is sent by the app and no server is needed. Closing the share sheet is not an error; a refused clipboard shows the sentence to select by hand. (Where it sits, where its link lands and a second message per person were decided on 2026-10-12, see "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md).) (Built and removed again on 2026-10-13, before a release, see "“Tell them” removed" in [`features/vacations-slice-2.md`](./vacations-slice-2.md).)
2. **People carry over** (slice 2). "Who is coming" on a new vacation lists the named people of the household's most recent vacation, ticked, after the members. People stay per vacation; no table changes.
3. **A link leads to its page after sign-in too** (slice 2). `pages/login.vue` sends everyone to the dashboard after signing in. On an iPhone a link from a messenger opens the browser, not the installed app, and the browser may not be signed in, so the link of "Tell them" would end on the dashboard. The page that was asked for is remembered while a person signs in, with what the sign-in module provides for it, and only a path inside the app is accepted: one that starts with two slashes is another host to a browser. It holds for every link in the app. `auth.e2e.ts` gets a case for it. Not chosen: leaving sign-in alone, and a message without a link.
4. **The first browser journey drops and restores the connection** (slice 1), with the helper the to-dos' reconnect test uses: one member is cut off, the other adds a task, and it appears once the first is back. The new store's resync is wiring that nothing else proves.
5. **"When it breaks" and "After a deploy"** (slice 1) are written into [`features/vacations.md`](./vacations.md) when the feature is built: what each failure looks like to a member, where to look (the browser's console, Supabase's logs for `create_vacation`, the Realtime connection), and what to check on the deployed site. The app has no logs or alerts of its own. (Written on 2026-10-13 into [`features/vacations-slice-1.md`](./vacations-slice-1.md) instead, because that file had reached the size at which a topic file is split.)
6. **"Only my tasks"** (slice 2): a checkbox on the vacation's page; ticked, each phase lists the signed-in member's open tasks only. It lasts for the visit and is stored nowhere. (Its place and its own texts were decided on 2026-10-12, and a link can open the page with it ticked, see "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md).)
7. **"All done" and "Ready to go"** (slice 1): a phase whose tasks are all done says "All done" in place of "0 open", and when every task before the trip is done the page says "Ready to go" under the dates.
8. **The tables keep their vacation names.** Declined: general names such as `occasions`, so that a party or a move could later be another kind in the same tables. The code uses the word the screens and the user use, and a second kind of event has no user yet. The cost is known: a table can't simply be renamed later, because an installed app that hasn't updated stops working when a table it knows changes its name.

### Checked and found in order

- **A link opened cold loads the app**: `public/_redirects` sends every path that matches no file to the app shell.
- **Every failure of the new paths reaches the member**: thirteen were traced, from a dropped connection while a vacation is added to a refused clipboard, and none ends silently. A load in which one of the store's four fetches fails keeps the previous state whole.
- **A reject and a reassignment of the same task, in either order, leave it with one assignee and no rejection.** In one order the rejecting person's reason is lost, which the design accepts by keeping only the latest rejection.
- **Old and new code side by side**: an installed app with an older bundle keeps working after each migration, including the one that re-creates `create_vacation`.
- **Rolling back** is publishing the previous deploy; the database stays as it is, since every slice only adds.

### Left open by the scope review

- Where "Tell them" sits: in the task's row, or as the action on the notice that confirms an assignment. The row already holds a tick box, a title, "Edit", a person and up to three actions at 375 px. (2026-10-12, by the user: this is decided in a design review of the screens, not on its own. The review comes before slice 1, so that the row is designed once before any of it is built. Whether it has run is in "Next steps" in [`progress.md`](../progress.md).) (Decided 2026-10-12: a line in the task's row without a timer, and an entry in the row's menu, see "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md).)

### Debt named, not taken on

- Soft delete only: a name typed for a child can be hidden but not erased by a member. Inside one household that is fine; with other households using the app it becomes an obligation.
- The templates are English text in the code.
- A fifth copy of the stores' load-and-resync block.
- No notifications sent by the app; "Tell them" depends on the member pressing it.

### Not proposed

A household's own templates and "copy from the last trip", deadlines and a countdown, and notifications from a server were decided against in the design, and nothing new speaks against that. Error reporting from the client would be a new dependency and a third party receiving data from a household's app.

### Not verified by the scope review

- Nobody but the session that wrote the plan reviewed it, here either.
- The engineering review was done before these seven additions. One of them changes the sign-in page. (They were reviewed the same day, see "Engineering review of the scope additions" in [`features/vacations-review.md`](./vacations-review.md).)
