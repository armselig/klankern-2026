# Vacation planner: the design's open decisions

The second half of the vacation planner's design: what it left open, what a person had to do before the build, what counts as done, and what was considered and not chosen. The first half is "Design: a vacation planner" in [`features/vacations/design.md`](./design.md), from which this was split on 2026-10-13 without a change to its text. The current state is in [`progress.md`](../../progress.md); [`CLAUDE.md`](../../CLAUDE.md) lists the other topic files.

## Design: open decisions and what was not chosen (2026-10-12)

### Open decisions

1. **Is adding a vacation all-or-nothing?** Three inserts from the client (vacation, people, tasks) can leave a vacation without tasks if the last fails. A function that takes the rows as JSON and runs as the caller would make it one transaction under RLS. Recommended, not decided. (Decided 2026-10-12: one function, see "Engineering review" in [`features/vacations/review.md`](./review.md).)
2. **One store or several?** The stores so far sync one kind of row each. This one has up to four, each needing the three pieces of bookkeeping. (Answered 2026-10-12: one store, see "Engineering review" in [`features/vacations/review.md`](./review.md).)
3. **Which reducers carry over?** `upsertListItem`, `confirmListItem`, `softDeleteListItem` and `mergeListResync` are typed over `SyncedRow` and fit. `applyListRealtimeEvent` and `visibleListItems` are typed over `ListItem` and read `list_id`, which a vacation task doesn't have. (Corrected and answered 2026-10-12, see "Engineering review" in [`features/vacations/review.md`](./review.md).)
4. **What does a person without an email address look like?** `<user-avatar>` takes an email address and draws the rosette from its hash. A named person needs another seed, such as the person's id. (Decided 2026-10-12 by the user: a person without an email address gets a generic SVG picture instead of a rosette, so no other seed is needed. It is one icon from the Material Design Icons the app uses, the same for every such person. Which icon it is, is chosen in slice 2.)
5. **Does the dashboard load every vacation there ever was?** With a few trips a year and some forty tasks each this stays small for years.
6. **Is the latest rejection enough?** A task that three people rejected shows only the third reason. (Decided 2026-10-12 by the user: it is enough. A task keeps only its latest rejection, as "Task states" in [`features/vacations/design.md`](./design.md) describes, and there is no table of past rejections.)
7. **What does the hotel template leave out?** Decided when the house template is written. (Decided 2026-10-13 by the user, with the list of the last trip's "before" tasks: of that list the hotel template leaves out two entries, the cooking and kitchen utensils and the coffee pot with the espresso powder. Every other entry is in both templates.)

### What a person has to do

Before any code, the user writes the "before" list of the household's last trip from memory, with the other adult on the trip, and notes beside each task who did it. The list is the first draft of the house template, and the names are a first "Who has what". (Handed over on 2026-10-13 without the names, see "The house and hotel templates" in [`features/vacations/templates.md`](./templates.md).)

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
- **Left for later**: notifications, a household's own templates and "copy from the last trip" (copying is built since 2026-10-14, see "A new vacation starts empty or with an earlier one's tasks" in [`features/vacations/copy-tasks.md`](./copy-tasks.md)), deadlines relative to the departure, a shopping list per trip, reordering tasks by dragging.

### Not verified

- That no app lets an assignee decline with a reason: three web searches with general terms found none, which is no proof.
- The design itself: nobody but the user and the session that wrote it has read it. An engineering review before the build is the next step.
