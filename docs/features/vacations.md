# Vacation planner

The history of the vacation planner, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Design: a vacation planner (planned 2026-10-12, not built yet)

A member adds a vacation to the household. The app fills in tasks for before, during and after the trip from a template that fits the kind of stay: a house where the household cooks, or a hotel. Members add, edit and remove tasks freely. A task can be given to a person on the trip, and that person can reject it with a reason ("I'm already busy enough washing all the clothes").

Designed with the user on 2026-10-12. The first real use is a stay in a house, about two months after that date, so the house template is written first. The feature may be offered to other households later, so nothing in it may be specific to one. (One exception since 2026-10-13, entries of the house template, see "The house and hotel templates" in [`features/vacations-templates.md`](./vacations-templates.md).)

### What it is for

Two things, chosen by the user over a countdown of due tasks and over templates that learn from past trips.

- **Fair share, out in the open.** Family chore apps treat an assignment as an order: a parent assigns, a child completes, the parent approves. Here an assignment is a proposal between peers. The assignee can say no, the reason stays in view, and the vacation's page opens with who carries how many open tasks.
- **The house plans its shopping.** A vacation in a house gets a meal plan picked from the household's recipes, and one action puts the ingredients of all of them on the shopping list. A recipe does that for itself already (see "Milestone 10" in [`features/recipes.md`](./recipes.md)).

A shared packing list with templates by kind of trip is what several apps offer already (a web search on 2026-10-12 named Stippl, Packup, PackItSmart and TripList). It is built plainly; the care goes into the two parts above.

### Decisions (user, 2026-10-12)

1. **A template is a starting point that is copied once.** Adding a vacation copies the template's tasks into it. From then on they are ordinary rows. A later change to a template never touches an existing vacation.
2. **Two templates ship with the app: house and hotel.** A household's own saved templates are not in the first version.
3. **An assignment is a proposal, and silence is a yes.** There is no accept step. The assignee does the task or rejects it with a reason. A rejected task becomes nobody's and shows who said no and why, until someone takes it or gives it to another person.
4. **People on a trip are not the same as members.** A vacation has its own list of people: each is a signed-in member or just a name, such as a small child or a guest. A named person cannot reject; any member ticks their task off or reassigns it.
5. **The household is the trust boundary.** The reject button is shown only to the assignee, but the database does not stop one member from changing another member's task.
6. **No notifications in the first version.** A member learns of an assignment or a rejection by opening the app. The app has no server that could send one. ("Tell them" was added on 2026-10-12, see "Scope review" in [`features/vacations-scope-review.md`](./vacations-scope-review.md).)
7. **Trip groceries go on the household's one shopping list**, through the path a single recipe uses. There is no shopping list per trip.
8. **A task has a phase, not a due date.**
9. **The vacation is a feature of its own, with a fifth store**, not more rows in the to-do list. See "Considered and not chosen".

### Data

Four tables. Each has `id` (set by the client), `household_id`, `created_by`, `created_at` and `deleted_at`, RLS with `is_household_member(household_id)`, and `select, insert, update` granted to `authenticated`. There is no `updated_at`, as in the newer tables.

| Table             | Columns of its own                                                                                                                  | Rules                                                                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vacations`       | `title`, `kind` (`house` or `hotel`), `starts_on`, `ends_on`                                                                        | Title not blank and at most 200 characters. `ends_on` not before `starts_on`. Unique `(id, household_id)` as the target of the children's foreign keys.                                           |
| `vacation_people` | `vacation_id`, `name`, `user_id` (null for a person without an account)                                                             | Name not blank, at most 100 characters. A member is on a vacation once: a partial unique index on `(vacation_id, user_id)` for live rows. Unique `(id, vacation_id)`.                             |
| `vacation_tasks`  | `vacation_id`, `phase` (`before`, `during`, `after`), `title`, `done`, `position`, `assignee_id`, `rejected_by`, `rejection_reason` | `assignee_id` and `rejected_by` point at `vacation_people` of the same vacation. A reason exists exactly when `rejected_by` does, at most 200 characters. Never both an assignee and a rejection. |
| `vacation_meals`  | `vacation_id`, `recipe_id`, `position`, `on_shopping_list_at`                                                                       | `recipe_id` points at a recipe of the same household, which needs a unique `(id, household_id)` on `recipes`.                                                                                     |

The foreign keys from a child to its vacation are composite, `(vacation_id, household_id)`, as `board_strokes` has to `boards` (migration 0012). That way a row's `household_id`, which RLS checks, can't differ from its vacation's.

All rows are small, so an UPDATE event carries the whole row and the reducers can replace a row instead of laying the event over it.

### Task states

| State    | `assignee_id` | `rejected_by` | What the row shows                                                      |
| -------- | ------------- | ------------- | ----------------------------------------------------------------------- |
| Nobody's | null          | null          | "Nobody yet", "I'll take it", "Give to…"                                |
| Assigned | set           | null          | The person. For the assignee, signed in: a heavier border and "Reject". |
| Rejected | null          | set           | Who said no and the reason, "I'll take it", "Give to…"                  |
| Done     | any           | any           | Struck through, at the end of its phase                                 |

(What a row shows was redrawn on 2026-10-12, without the heavier border, see "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md).)

- **Assigning** sets `assignee_id` and clears the rejection. Only the latest rejection is kept.
- **Rejecting** is one conditional update: it sets the rejection and clears the assignee where the task is still assigned to the rejecting person. If someone reassigned it in the meantime, the update matches no row and the dialog closes with "This task isn't yours any more". To know that it matched none, the update has to return the row or a count; returning it is safe here, because the row is visible to the member.
- **Removing a person** from a vacation makes their open tasks nobody's. (How was decided on 2026-10-12, see "Engineering review" in [`features/vacations-review.md`](./vacations-review.md).)
- **A member who joins the household later** is not on an existing vacation until someone adds them under "Who is coming".
- **A member's name** on a vacation starts as the part of the email address before the `@` and can be changed there, because a member has no name in the app, only an email address.

### Templates

`utils/vacation-templates.ts` holds plain data: for each kind, a list of tasks with a phase and a title. The hotel list is the shared tasks; the house list adds what cooking and a house bring (plan meals, shop for the first evening, bring what a rented kitchen lacks, clean before leaving, return the key). No table and no migration. (What both lists hold was decided on 2026-10-13, see "The house and hotel templates" in [`features/vacations-templates.md`](./vacations-templates.md).)

### Screens

Drawn as a rough wireframe at 375 px and approved by the user on 2026-10-12; the wireframe is not in the repository. (Overtaken on 2026-10-12 in the task's row, the page's order, how a vacation is edited, the reject dialog and the tile's slice, see "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md).)

- **`/vacations`**: upcoming vacations first, past ones below, and "Add vacation".
- **`/vacations/new`**: title, kind of stay, from and until as native date fields, and who is coming (members ticked, a field to add a name). (The named people of the last vacation are listed too since 2026-10-12, see "Scope review" in [`features/vacations-scope-review.md`](./vacations-scope-review.md).)
- **`/vacations/<id>`**: title, kind and dates; "Who has what", the open tasks per person including "Nobody yet"; then Before, During, Afterwards, each with its tasks and an add field; on a house, Meals. A task has an "Edit" button of its own, so the tick box and the title stay separate targets. ("Only my tasks", "All done" and "Tell them" were added on 2026-10-12, see "Scope review" in [`features/vacations-scope-review.md`](./vacations-scope-review.md).)
- **Reject dialog**: a native dialog with one required field and the line "Everyone sees your reason."
- **Dashboard**: a fifth tile, "Vacations", with the next vacation, the open tasks, how many are the signed-in member's and how many came back rejected. It stands in for notifications.

### Meals

A meal is a pick from the household's recipes. "Put N ingredients on the shopping list" counts the meals that are not on the list yet, adds their ingredients through the shopping store's `ensureLoaded()` and `addAll()`, and stamps `on_shopping_list_at` on each meal whose ingredients were all saved. A second press adds nothing twice; a meal added later is the only one counted. A recipe that was removed since shows as "Recipe was removed".

### Steps

Three slices, each one migration and one `feat` commit, and so one release. Each works without the next.

1. **A trip checklist from a template** (migration 0015): `vacations` and `vacation_tasks` without the assignment columns, the templates, the three pages, add, edit, tick and remove, live sync.
2. **Fair share** (0016): `vacation_people`, the assignment columns, assign, reject, "Who has what", the dashboard tile. (The tile moved into slice 1 on 2026-10-12, see "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md).)
3. **The house plans its shopping** (0017): `vacation_meals`, the unique constraint on `recipes`, the meal picker and the shopping action.

Within a slice: the migration and the RLS tests first, then the actions with the fake client, the reducers, the store, the pages, and an e2e test with two browsers. Development and production share one Supabase project, so every migration has to be additive. The new store gets its listeners in `subscribeToHouseholdChanges`, its `resync()` on every `SUBSCRIBED` and its reset in `useResetStoresOnUserChange`. (Corrected 2026-10-12: it is wired in five places, see "Engineering review" in [`features/vacations-review.md`](./vacations-review.md).)

### Open decisions

1. **Is adding a vacation all-or-nothing?** Three inserts from the client (vacation, people, tasks) can leave a vacation without tasks if the last fails. A function that takes the rows as JSON and runs as the caller would make it one transaction under RLS. Recommended, not decided. (Decided 2026-10-12: one function, see "Engineering review" in [`features/vacations-review.md`](./vacations-review.md).)
2. **One store or several?** The stores so far sync one kind of row each. This one has up to four, each needing the three pieces of bookkeeping. (Answered 2026-10-12: one store, see "Engineering review" in [`features/vacations-review.md`](./vacations-review.md).)
3. **Which reducers carry over?** `upsertListItem`, `confirmListItem`, `softDeleteListItem` and `mergeListResync` are typed over `SyncedRow` and fit. `applyListRealtimeEvent` and `visibleListItems` are typed over `ListItem` and read `list_id`, which a vacation task doesn't have. (Corrected and answered 2026-10-12, see "Engineering review" in [`features/vacations-review.md`](./vacations-review.md).)
4. **What does a person without an email address look like?** `<user-avatar>` takes an email address and draws the rosette from its hash. A named person needs another seed, such as the person's id. (Decided 2026-10-12 by the user: a person without an email address gets a generic SVG picture instead of a rosette, so no other seed is needed. It is one icon from the Material Design Icons the app uses, the same for every such person. Which icon it is, is chosen in slice 2.)
5. **Does the dashboard load every vacation there ever was?** With a few trips a year and some forty tasks each this stays small for years.
6. **Is the latest rejection enough?** A task that three people rejected shows only the third reason. (Decided 2026-10-12 by the user: it is enough. A task keeps only its latest rejection, as "Task states" describes, and there is no table of past rejections.)
7. **What does the hotel template leave out?** Decided when the house template is written. (Decided 2026-10-13 by the user, with the list of the last trip's "before" tasks: of that list the hotel template leaves out two entries, the cooking and kitchen utensils and the coffee pot with the espresso powder. Every other entry is in both templates.)

### What a person has to do

Before any code, the user writes the "before" list of the household's last trip from memory, with the other adult on the trip, and notes beside each task who did it. The list is the first draft of the house template, and the names are a first "Who has what". (Handed over on 2026-10-13 without the names, see "The house and hotel templates" in [`features/vacations-templates.md`](./vacations-templates.md).)

### Done when

- The household plans its trip in the app: the vacation is created from the house template, and by departure every "before" task is done or removed.
- On two phones: one member gives a task to the other, the other rejects it with a reason, and the first sees the rejection without reloading.
- A task of a person without an account can be ticked off and reassigned by any member, and has no "Reject".
- On a house vacation, picked recipes put their ingredients on the shopping list with one press, and a second press adds none of them again.
- No existing e2e test of the to-dos, the shopping list or the recipes is changed.
- The RLS suite shows that a member of another household can neither read nor write a row of the four tables.
- `a11y.e2e.ts` passes on the new pages in light and dark mode.

### Considered and not chosen

- **Vacation tasks as to-do items**: one table for the vacations, the tasks as rows in `todo_items` with new columns, people and meals as JSON. It changes the working to-do list (its page, its open count, its dashboard tile), leaves the assignee without a foreign key, and ends the parallel between `stores/todos.ts` and `stores/shopping.ts`.
- **More to-do lists per household**: the to-do list is one per household by a constraint, and `fetchOrCreateTodoList` relies on it (see migration 0014).
- **One row per vacation**, with tasks, people and meals as JSON, as a recipe carries its ingredients: two people ticking tasks at the same moment overwrite each other, in the days before a trip when that is most likely.
- **An accept step**: one more tap on every task, and tasks nobody answers pile up as waiting.
- **Left for later**: notifications, a household's own templates and "copy from the last trip", deadlines relative to the departure, a shopping list per trip, reordering tasks by dragging.

### Not verified

- That no app lets an assignee decline with a reason: three web searches with general terms found none, which is no proof.
- The design itself: nobody but the user and the session that wrote it has read it. An engineering review before the build is the next step.
