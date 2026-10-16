# Documentation of the vacation planner

Guidance for reading and writing the files in this folder. The rules for all documentation are in [`README.md`](../../README.md) one level up from `features/` and are not repeated here; the rules for the code are in [`rules/`](../../rules/README.md). The current state of the planner is in [`progress.md`](../../progress.md).

## Where things are

Read the design first, then the file of the slice you are about to touch. The reviews tell why the design is as it is; read the one that decided what you are about to change.

### The design

- [`design.md`](./design.md): the vacation planner: its design, with tasks by phase, assignment that can be rejected and a meal plan. All three slices are built and released.
- [`design-decisions.md`](./design-decisions.md): the rest of that design: its open decisions and how each was answered, what counts as done, and what was considered and not chosen.
- [`templates.md`](./templates.md): what its house and hotel templates held, until they were replaced by copying (see `features/vacations/copy-tasks.md`): the list the user handed over, how its entries are worded, and the tasks added for the two later phases.

### The reviews of the design, in the order they ran

- [`review.md`](./review.md): the two engineering reviews of that design, of the plan and of what the scope review added: what was decided, what was corrected and what is still open.
- [`scope-review.md`](./scope-review.md): the scope review between them: the seven additions, among them "Tell them" and the return to a link after sign-in, and what was declined.
- [`design-review.md`](./design-review.md): the design review of its screens: the task's row, where "Tell them" sits, the states of every screen, the access rules, and what changed against the wireframe.
- [`screens.md`](./screens.md): the screens of the reviewed design as rendered and approved, and what the rendering showed for the build.
- [`design-eng-review.md`](./design-eng-review.md): the engineering review of what the design review changed: four decisions, the rules for a link's parameters, and what was not confirmed.

### How it was built

- [`slice-1.md`](./slice-1.md): how slice 1 was built, the trip checklist from a template: migration 0015, what was decided and found during the build, its tests, "When it breaks" and "After a deploy".
- [`slice-2.md`](./slice-2.md): how slice 2 was built, fair share: migration 0016, people and assignment, the gap in the live sync that was narrowed for every feature, its tests, "When it breaks" and "After a deploy".
- [`slice-2-after-trying.md`](./slice-2-after-trying.md): what the user changed in slice 2 after trying it, before its release: the task's row back on one line, "Tell them" removed, "Who has what" as a strip of names that filter the tasks, and its frame.
- [`slice-2-names-and-pictures.md`](./slice-2-names-and-pictures.md): more of those changes, split off on 2026-10-15: "Edit" beside the title, a picture of two letters for a person without an account, and a member's name as text in "Change people".
- [`slice-2-after-release.md`](./slice-2-after-release.md): what the user changed in slice 2 after its release (2026-10-14): "Who has what" sorted by open tasks, and a task added under a person's line given to them.
- [`slice-3-design.md`](./slice-3-design.md): the design review of slice 3, the meals (2026-10-15): the meals on a page of their own, the dialog that picks recipes, the shopping button's states, and the kind of stay made editable. Nothing was drawn.
- [`slice-3.md`](./slice-3.md): how slice 3 was built, the meals (removed by meal planner slice 1b on 2026-10-15, see the last section): migration 0017, the page of its own, the picker and the shopping button, what was decided and found during the build, its tests, "When it breaks" and "After a deploy".
- [`copy-tasks.md`](./copy-tasks.md): the templates replaced (2026-10-14): a new vacation starts empty or with copies of an earlier trip's tasks, open and nobody's; what was decided, how it is built and how the tests get their tasks now; then Quasar's date picker and select in the form, and frames around the dates and the tasks.

## Writing here

- **A slice gets a file of its own when it is built** (`slice-3.md` was the last of the three): the migration, what was decided and found during the build, its tests, "When it breaks" and "After a deploy".
- **What changes after a slice is built goes into that slice's file**, as a dated section at its end. Once such a file passes about 2,500 words, the changes get a file of their own beside it, as `slice-2-after-trying.md` did.
- **A decision that overtakes a review is not written into the review.** The review gets a dated remark at the place it overtakes, which names the section that holds the newer state.
- **The list above is part of the change**: a new or renamed file gets its line here in the same commit. The list in the documentation's `README.md` has one line for the whole folder and changes only when what the folder covers does.
- **A reference to a file of this folder is shown as its path from `docs/`**, as everywhere: `features/vacations/slice-2.md`.
