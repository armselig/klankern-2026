# Vacation planner

The history of the vacation planner, oldest first. The current state is in [`progress.md`](../../progress.md); [`CLAUDE.md`](../../CLAUDE.md) lists the other topic files.

## Design: a vacation planner (planned 2026-10-12, not built yet)

(Slice 1 was built on 2026-10-13, see "Slice 1: a trip checklist from a template" in [`features/vacations/slice-1.md`](./slice-1.md).)

A member adds a vacation to the household. The app fills in tasks for before, during and after the trip from a template that fits the kind of stay: a house where the household cooks, or a hotel. Members add, edit and remove tasks freely. A task can be given to a person on the trip, and that person can reject it with a reason ("I'm already busy enough washing all the clothes"). (Since 2026-10-14 a new vacation starts empty or with the tasks of an earlier one, and the templates are gone, see "A new vacation starts empty or with an earlier one's tasks" in [`features/vacations/copy-tasks.md`](./copy-tasks.md).)

Designed with the user on 2026-10-12. The first real use is a stay in a house, about two months after that date, so the house template is written first. The feature may be offered to other households later, so nothing in it may be specific to one. (One exception since 2026-10-13, entries of the house template, see "The house and hotel templates" in [`features/vacations/templates.md`](./templates.md).)

### What it is for

Two things, chosen by the user over a countdown of due tasks and over templates that learn from past trips.

- **Fair share, out in the open.** Family chore apps treat an assignment as an order: a parent assigns, a child completes, the parent approves. Here an assignment is a proposal between peers. The assignee can say no, the reason stays in view, and the vacation's page opens with who carries how many open tasks.
- **The house plans its shopping.** A vacation in a house gets a meal plan picked from the household's recipes, and one action puts the ingredients of all of them on the shopping list. A recipe does that for itself already (see "Milestone 10" in [`features/recipes.md`](../recipes.md)).

A shared packing list with templates by kind of trip is what several apps offer already (a web search on 2026-10-12 named Stippl, Packup, PackItSmart and TripList). It is built plainly; the care goes into the two parts above.

### Decisions (user, 2026-10-12)

1. **A template is a starting point that is copied once.** Adding a vacation copies the template's tasks into it. From then on they are ordinary rows. A later change to a template never touches an existing vacation.
2. **Two templates ship with the app: house and hotel.** A household's own saved templates are not in the first version.
3. **An assignment is a proposal, and silence is a yes.** There is no accept step. The assignee does the task or rejects it with a reason. A rejected task becomes nobody's and shows who said no and why, until someone takes it or gives it to another person.
4. **People on a trip are not the same as members.** A vacation has its own list of people: each is a signed-in member or just a name, such as a small child or a guest. A named person cannot reject; any member ticks their task off or reassigns it.
5. **The household is the trust boundary.** The reject button is shown only to the assignee, but the database does not stop one member from changing another member's task.
6. **No notifications in the first version.** A member learns of an assignment or a rejection by opening the app. The app has no server that could send one. ("Tell them" was added on 2026-10-12, see "Scope review" in [`features/vacations/scope-review.md`](./scope-review.md), and removed again on 2026-10-13, see "“Tell them” removed" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md).)
7. **Trip groceries go on the household's one shopping list**, through the path a single recipe uses. There is no shopping list per trip.
8. **A task has a phase, not a due date.**
9. **The vacation is a feature of its own, with a fifth store**, not more rows in the to-do list. See "Considered and not chosen" in [`features/vacations/design-decisions.md`](./design-decisions.md).

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

(What a row shows was redrawn on 2026-10-12, without the heavier border, see "Design review" in [`features/vacations/design-review.md`](./design-review.md).)

- **Assigning** sets `assignee_id` and clears the rejection. Only the latest rejection is kept.
- **Rejecting** is one conditional update: it sets the rejection and clears the assignee where the task is still assigned to the rejecting person. If someone reassigned it in the meantime, the update matches no row and the dialog closes with "This task isn't yours any more". To know that it matched none, the update has to return the row or a count; returning it is safe here, because the row is visible to the member.
- **Removing a person** from a vacation makes their open tasks nobody's. (How was decided on 2026-10-12, see "Engineering review" in [`features/vacations/review.md`](./review.md).)
- **A member who joins the household later** is not on an existing vacation until someone adds them under "Who is coming".
- **A member's name** on a vacation starts as the part of the email address before the `@` and can be changed there, because a member has no name in the app, only an email address.

### Templates

`utils/vacation-templates.ts` holds plain data: for each kind, a list of tasks with a phase and a title. The hotel list is the shared tasks; the house list adds what cooking and a house bring (plan meals, shop for the first evening, bring what a rented kitchen lacks, clean before leaving, return the key). No table and no migration. (What both lists hold was decided on 2026-10-13, see "The house and hotel templates" in [`features/vacations/templates.md`](./templates.md). Replaced on 2026-10-14 by copying an earlier trip's tasks, see "A new vacation starts empty or with an earlier one's tasks" in [`features/vacations/copy-tasks.md`](./copy-tasks.md).)

### Screens

Drawn as a rough wireframe at 375 px and approved by the user on 2026-10-12; the wireframe is not in the repository. (Overtaken on 2026-10-12 in the task's row, the page's order, how a vacation is edited, the reject dialog and the tile's slice, see "Design review" in [`features/vacations/design-review.md`](./design-review.md).)

- **`/vacations`**: upcoming vacations first, past ones below, and "Add vacation".
- **`/vacations/new`**: title, kind of stay, from and until as native date fields, and who is coming (members ticked, a field to add a name). (The named people of the last vacation are listed too since 2026-10-12, see "Scope review" in [`features/vacations/scope-review.md`](./scope-review.md).)
- **`/vacations/<id>`**: title, kind and dates; "Who has what", the open tasks per person including "Nobody yet"; then Before, During, Afterwards, each with its tasks and an add field; on a house, Meals. A task has an "Edit" button of its own, so the tick box and the title stay separate targets. ("Only my tasks", "All done" and "Tell them" were added on 2026-10-12, see "Scope review" in [`features/vacations/scope-review.md`](./scope-review.md). The lines of "Who has what" replaced "Only my tasks" on 2026-10-13, see "The names of “Who has what” filter the tasks" in [`features/vacations/slice-2-after-trying.md`](./slice-2-after-trying.md).)
- **Reject dialog**: a native dialog with one required field and the line "Everyone sees your reason."
- **Dashboard**: a fifth tile, "Vacations", with the next vacation, the open tasks, how many are the signed-in member's and how many came back rejected. It stands in for notifications.

### Meals

A meal is a pick from the household's recipes. "Put N ingredients on the shopping list" counts the meals that are not on the list yet, adds their ingredients through the shopping store's `ensureLoaded()` and `addAll()`, and stamps `on_shopping_list_at` on each meal whose ingredients were all saved. A second press adds nothing twice; a meal added later is the only one counted. A recipe that was removed since shows as "Recipe was removed".

### Steps

Three slices, each one migration and one `feat` commit, and so one release. Each works without the next.

1. **A trip checklist from a template** (migration 0015): `vacations` and `vacation_tasks` without the assignment columns, the templates, the three pages, add, edit, tick and remove, live sync.
2. **Fair share** (0016): `vacation_people`, the assignment columns, assign, reject, "Who has what", the dashboard tile. (The tile moved into slice 1 on 2026-10-12, see "Design review" in [`features/vacations/design-review.md`](./design-review.md).)
3. **The house plans its shopping** (0017): `vacation_meals`, the unique constraint on `recipes`, the meal picker and the shopping action.

Within a slice: the migration and the RLS tests first, then the actions with the fake client, the reducers, the store, the pages, and an e2e test with two browsers. Development and production share one Supabase project, so every migration has to be additive. The new store gets its listeners in `subscribeToHouseholdChanges`, its `resync()` on every `SUBSCRIBED` and its reset in `useResetStoresOnUserChange`. (Corrected 2026-10-12: it is wired in five places, see "Engineering review" in [`features/vacations/review.md`](./review.md).)

### Where the rest of the design is

The design's open decisions, what a person has to do before the build, what counts as done, what was considered and not chosen, and what was not verified were moved on 2026-10-13, when this file had grown past the size at which a topic file is split. They are in "Design: open decisions and what was not chosen" in [`features/vacations/design-decisions.md`](./design-decisions.md), unchanged.
