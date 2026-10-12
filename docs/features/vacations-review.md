# Vacation planner: engineering reviews

The engineering reviews of the vacation planner's plan, oldest first. The scope review between them is "Scope review" in [`features/vacations-scope-review.md`](./vacations-scope-review.md). The design is "Design: a vacation planner" in [`features/vacations.md`](./vacations.md). The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Engineering review (2026-10-12)

The design was checked against the code before anything was built: its architecture, its code structure, the tests it needs and what it costs at run time. The user decided four things. Everything else here follows from rules that were decided already, or corrects a statement of the design.

### Decisions (user, 2026-10-12)

1. **Adding a vacation is all or nothing.** A function `create_vacation` that runs as the caller takes the vacation and its rows as JSON and inserts them in one transaction, so row-level security applies as it does to a direct write. Not chosen: inserts from the client with a button that repairs a vacation whose tasks failed (a half-made vacation exists meanwhile, and every member sees it), and the three inserts of the design (nothing fills an empty vacation afterwards).
2. **A removed person's tasks are worked out, not rewritten.** A task whose assignee is not a live person of its vacation is shown and counted as "Nobody yet", by one function in `utils/vacation-state.ts` that the task's row, "Who has what" and the dashboard tile all use. Removing a person is one write. The store loads removed people too, so "sam said no" keeps its name. Not chosen: a trigger that clears the tasks (the schema's first, and it misses an assignment that arrives after the removal), and one update per task from the client (not one step).
3. **A vacation's title and dates can be edited, its kind can't.** The edit shows at once and sends only the changed fields, as a recipe's does. Any member can remove a vacation after a confirmation; it is a soft delete of the vacation, and its tasks, people and meals leave the view with it. Not chosen: no editing at all (a moved booking would cost every tick and assignment), and an editable kind (the old kind's tasks would stay and none would be added).
4. **Three browser tests, one journey per slice**, in `tests/e2e/vacations.e2e.ts`. Slice 1, two browsers: add a vacation from the house template, the other member sees it; add, edit, tick and remove a task; rename the vacation; reload. Slice 2, two browsers: give a task, the assignee rejects it with a reason, the first member sees it; a named person's task has no "Reject" and is ticked by a member; "Who has what" follows. Slice 3, one browser: pick recipes, put the ingredients on the shopping list, press again. `a11y.e2e.ts`, `dashboard.e2e.ts` and `session-switch.e2e.ts` are extended. Not chosen: one test per behavior, about ten (some 16 more sign-ins, on top of the 18 places where the suite signs in today, against the limit of about 30 in five minutes), and no browser tests (nothing would prove live sync for the new tables). (Journey 1 gained a step and `auth.e2e.ts` a case on 2026-10-12, see "Scope review" in [`features/vacations-scope-review.md`](./vacations-scope-review.md); that makes 24 places where the suite signs in, see "Engineering review of the scope additions".)

### Corrections to the design

- **The new store is wired in five places, not three.** Besides the listeners, the resync and the reset: `pages/index.vue` loads every store for the dashboard, and `household-realtime.spec.ts` asserts the exact list of subscribed tables and fails until the new ones are in it.
- **`visibleListItems` does not read `list_id`.** It filters on `deleted_at` and sorts by `position`; only its type asks for a list item. `applyListRealtimeEvent` does read it.
- **"One store or several" was answered by decision 9 of the design**, a fifth store. The code supports it: the three pieces of bookkeeping are maps keyed by a row's id, and ids are UUIDs, so one of each serves all four tables.

### What follows from the decisions

- **Slice 2 can't change the function with `create or replace`.** With another list of arguments that adds a second function beside the first, and a call with the old arguments then fits both and is refused as ambiguous. An installed app that hasn't updated yet makes exactly that call. Migration 0016 drops the first signature and creates the new one, whose people argument has a default, in the same migration. A function created anew can be executed by everyone again, so 0016 repeats the `revoke` and the `grant`.
- **The foreign keys need their delete actions**: `on delete cascade` from a vacation to its children, and nothing that restricts from a task to a person. The tests' cleanup deletes whole households with the secret key and relies on the cascade; a blocked cascade would leave test rows in the database that production uses.
- **A person's `user_id` references `household_members (household_id, user_id)`**, so a person tied to an account is a member of that household.
- **The rejection's reason must contain a character that isn't a space**, as a recipe's title must.
- **The size of a task's row is an estimate.** With a title and a reason of 200 four-byte characters each it is about 1,760 bytes, some 270 below the size at which Postgres stores large values out of line, and an UPDATE event then leaves them out. The migration's comment says so: another text column on `vacation_tasks` has to count again.
- **Upcoming and past are decided by a helper of their own** that compares local dates as `YYYY-MM-DD`. `new Date("2026-12-05")` is midnight UTC, not local midnight, and a comparison of timestamps is a day off around midnight.
- **The feature writes its own event reducer and sort** in `utils/vacation-state.ts`, guarded by the household as the recipes' is. `utils/list-state.ts` is not touched: the feature only adds.
- **Meals go on the shopping list one after another.** `addAll()` returns how many items were saved, so only a call per meal tells whether that meal is complete. The first failure stops the run and names the meal; a meal saved in part is not stamped, and trying again adds it once more, as pressing a recipe's button twice does.
- **Each table gets an index on its live rows by household**, as `recipes_live_idx` is, and one on each foreign-key column.

### Tests

Every rule of the tables gets a test in the RLS suite: another household reads and writes nothing, a child row can't name its own household and another household's vacation, nothing is hard-deleted, `create_vacation` writes everything or nothing and can't be called without signing in (also after 0016), a member is on a vacation once, an assignee belongs to the same vacation, a blank or too long reason is refused, a meal can't name another household's recipe, and deleting a household takes all four tables with it. The actions are tested with the fake client and the reducers as pure functions: the event reducer, the rule for a removed assignee, the open tasks per person, the tasks by phase, the meals still to add, the templates' shape and the local dates. The stores have no tests of their own, like the other four.

### Kept as planned

- **Every visit to the dashboard loads all vacations with their rows.** About 40 rows per trip, so hundreds after years.
- **The shopping step sends one insert per ingredient**, as a recipe's button does.
- **The household's channel goes from 8 to 16 listeners**, and adding a vacation sends each connected member one event per row: tens of messages.

### Still open

- What a person without an email address looks like (open decision 4 of the design), before slice 2. (Decided 2026-10-12, see "Open decisions" in [`features/vacations.md`](./vacations.md).)
- Whether only the latest rejection is kept (open decision 6 of the design), before slice 2. (Decided 2026-10-12, see "Open decisions" in [`features/vacations.md`](./vacations.md).)
- What the hotel template leaves out (open decision 7 of the design), before slice 1.

### Noticed, not changed

- The block that loads, resyncs and tracks pending writes exists in four stores and gets a fifth copy. Taking it out would change four working stores.
- Two members who press "I'll take it" at the same moment both see it as theirs until the later write arrives; then both see the same person. Nothing is lost.

### Not verified

- Nobody but the session that wrote the design reviewed it: no second reviewer was available.
- The row size above is calculated, not measured.
- Whether Supabase limits Realtime messages per second: the documentation that was read names a monthly quota and no such limit.

## Engineering review of the scope additions (2026-10-12)

The scope review added seven things after the engineering review above (see "Scope review" in [`features/vacations-scope-review.md`](./vacations-scope-review.md)). They were checked against the code the same day, and only they. The user decided one thing; the rest is what the additions need in order to be true.

### Decided for the additions (user, 2026-10-12)

1. **While "Only my tasks" is ticked, the phases show no field to add a task.** A new task belongs to nobody, so the filter would hide it the moment it is saved, which looks as if the app had lost it. Unticking brings the fields back. Not chosen: giving a task added in that view to the member (adding would mean two things, depending on a checkbox), and keeping the fields with a notice that says where the task went (it still disappears).

### What the additions need to be true

- **Sign-out forgets the remembered page.** The sign-in module remembers the page a signed-out person asked for and `pages/login.vue` would read it after a successful code, but nothing else clears it: the join page sends a new member to the dashboard without reading it. A person who opens a link signed out, joins through an invite instead and signs out would leave that page to whoever signs in next on the device. Nothing would leak, since the page says "not found" to another household, but it is wrong.
- **The share sheet is called straight from the press.** A browser opens it only during a user's gesture, so nothing may be awaited before the call.
- **The link is part of the sentence**, and the share sheet gets the sentence alone. Apps that receive a share treat a separate link and text differently, and some show only one.
- **Two plain functions carry the edge cases**: one says whether a remembered path is inside the app (a path that starts with two slashes is not, nor a full address), one chooses between sharing and copying (no share sheet: copy; sheet closed by the person: nothing; share refused: copy). Both are unit tested and need no browser.
- **"Only my tasks" is shown only to a person of that vacation.** A member who is not on the trip has no tasks there.
- **A phase without tasks is not "All done"**; it says "Nothing here yet". "Ready to go" shows until the vacation's start date.

### Defined, and open to be overruled

- **"The most recent vacation"** whose named people a new one starts with is the live vacation that was created last, not the one that starts last. With two trips planned at once the two differ; the names typed last are the likelier ones to want again.

### Tests for the additions

The new case in `auth.e2e.ts` fills in the sign-in form itself: the shared `signIn` helper asserts that sign-in ends on the dashboard, which is exactly what this case changes. No existing test opens a protected page signed out before it signs in, so none breaks. The same case checks that the remembered page is gone after sign-out, by its cookie, without a second sign-in. The copy fallback of "Tell them" is checked by its notice, as the invite dialog shows one, because no test reads the clipboard and doing so needs a permission in the test's browser; the test removes the share sheet, so the result doesn't depend on the system it runs on. With this case the browser suite signs in at 24 places: 18 before the feature, 5 for the three journeys and 1 here.

### Not verified for the additions

- That the share sheet opens on a phone, and that a messenger keeps the link: neither can be tested automatically. Both are checked by hand once and belong in "After a deploy".
- How apps that receive a share treat a separate link was not looked up; the plan avoids the question by sending one text.
- No second reviewer read this pass either.
