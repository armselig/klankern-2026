# Vacation planner: design review of slice 3, the meals

The design pass over slice 3 before it is built. The text design it reviews is "Meals" and "Steps" in [`features/vacations/design.md`](./design.md); the rules that came out of the earlier reviews are in [`features/vacations/review.md`](./review.md) and [`features/vacations/design-review.md`](./design-review.md). The current state is in [`progress.md`](../../progress.md); [`CLAUDE.md`](../../CLAUDE.md) lists the other topic files.

## Design review of the meals (2026-10-15)

The text design said what meals do and never what a member sees: no screen, no picker, no states beyond "Recipe was removed". It was rated 4 of 10 on design completeness. The review ran as text against the existing components (`VacationHeader.vue`, `VacationPhase.vue`, `RecipeView.vue`, `VacationTile.vue`) and the theme.

No mockups exist. The gstack designer needs an OpenAI API key, which this machine has none of, so nothing here was drawn and no pixel was checked. The first rendering of the screens is the first time any of it is seen, and the points under "Not verified" are what to look at then.

### What the user changed before the review (2026-10-15)

- **The same recipe may be a meal more than once.** There is no unique constraint on a vacation's recipe.
- **The kind of stay becomes editable, and meals are allowed on every kind.** This overtakes "Not chosen: an editable kind" in [`features/vacations/review.md`](./review.md) and the line in [`features/vacations/copy-tasks.md`](./copy-tasks.md) that the kind decides the meal plan: it decides nothing now.
- **Several commits**, not one.

### Decisions (user, 2026-10-15)

1. **Meals have a page of their own**, `/vacations/<id>/meals`. Not chosen: a fold on the vacation's page after "Afterwards", and a section between "Who has what" and "Before". The file-based router needs `pages/vacations/[id].vue` to become `pages/vacations/[id]/index.vue` beside `pages/vacations/[id]/meals.vue`, and `ROUTES` gets `vacationMeals(id)`. The page has a back button to the trip, as the recipe page has one to the recipes.
2. **The vacation's page links to it with one row** between "Who has what" and "Before": "Meals", a muted status such as "3 meals, 2 not on the shopping list" and a chevron; one line, 56 px, the whole row is the link. Not chosen: a button beside "Edit", and a line inside "Who has what". With no meals the status says "No meals yet".
3. **A meal is picked in a dialog with a search field**, the app's dialog with a plain form inside as the reject dialog is built, with each recipe as a row and an "Add" button. Not chosen: a native select (the new-trip form's pattern) and a list of every recipe on the page.
4. **The dialog stays open after a pick.** Each add shows a status line under the search, "Added: Lentil soup (2 in the plan)", announced to a screen reader, and "Done" closes the dialog. A week of dinners is not seven rounds of open, search and pick. Not chosen: closing after one pick, and an "Add another" link in a notice.
5. **A meal's row is one line**: the recipe's title as a link to the recipe, a check icon when its ingredients are on the shopping list (named "On the shopping list"), and a remove icon button of 44 px. A removed recipe shows "Recipe was removed" in muted text in place of the link. Not chosen: words for the state beside the title, which wrap at 375 px, and no state on the row.
6. **The shopping button, "Put N ingredients on the shopping list"**, shows a spinner and is disabled while it runs. On success the notice of the recipe page ("6 items added to the shopping list", with its colors) appears and the button gives way to "Everything is on the shopping list." On a failure midway a red line stays under the button and names the meal, "Couldn't add Lentil soup. 2 meals were added; the button adds the rest.", and the button counts only what is left. The line goes when a later run succeeds. Not chosen: a failure that is only a notice, and a dialog that lists the ingredients first.
7. **Removing a meal that is on the shopping list asks first**: "Its ingredients stay on the shopping list. Remove the meal?" A meal that is not on the list goes at once. The app doesn't know which shopping items came from which meal, so it can't take them back. Not chosen: always at once, and always asking.
8. **The kind is edited with a radio group in the header's edit form**, in place of the line that said it is chosen when the vacation is added, and its words are neutral: "House or apartment" and "Hotel". The summary line and the new-trip form use the same words. "House, we cook ourselves" (`VACATION_KIND_DESCRIPTIONS`) would be untrue of a hotel trip that plans meals. The kind stays a label that decides nothing, and the form doesn't say so. Not chosen: editable with the old words, and fixed after adding.
9. **The dashboard's tile says nothing about meals.** The link row carries the state. The tile is at its five lines and would load every vacation's meals on each visit. Not chosen: a line when meals wait, and the "more" line given up near the trip.
10. **The two empty states name their next step.** No meals: "No meals yet. Pick recipes for the trip, then put their ingredients on the shopping list." with "Add meal". A household without recipes: in place of the button, "The household has no recipes yet." and a link "Write a recipe". Not chosen: one line and an empty dialog, and a disabled button.

### Interaction states

| Feature                         | Loading                                                           | Empty                                                      | Error                                                                   | Success                                                                        | Partial                                                |
| ------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Meals page                      | Spinner, as the recipe page has                                   | Decision 10                                                | The vacation is not found: the page's "Vacation not found"              | The list of rows                                                               | A recipe was removed: its row says so                  |
| Link row on the vacation's page | Its status waits for the meals, which load with the vacation      | "No meals yet"                                             | The page's own failure                                                  | "3 meals, 2 not on the shopping list", and "3 meals, all on the shopping list" | none                                                   |
| Recipe dialog                   | The recipes load with the household's; the list shows the spinner | The household has no recipes: not reachable, decision 10   | Adding fails: the red line stays in the dialog, as in the reject dialog | The status line, decision 4                                                    | A search that matches nothing says "No recipe matches" |
| Shopping button                 | Spinner, disabled                                                 | No meal left to add: "Everything is on the shopping list." | The red line of decision 6                                              | The notice of decision 6                                                       | The count of what is left                              |
| Removing a meal                 | none                                                              | none                                                       | The row stays and a red line says why                                   | The row goes; the focus moves on                                               | none                                                   |
| Editing the kind                | The save button's own spinner                                     | none                                                       | The header form's own message                                           | The summary line shows the new kind                                            | none                                                   |

### The journey

| Step | The member does                            | Feels                     | What carries it                                 |
| ---- | ------------------------------------------ | ------------------------- | ----------------------------------------------- |
| 1    | Opens the trip, sees "Meals, No meals yet" | Curious, nothing demanded | The link row is one quiet line                  |
| 2    | Opens the page, sees the empty state       | Told what to do           | Decision 10                                     |
| 3    | Adds seven dinners in one dialog           | In flow                   | The dialog stays open and says what it added    |
| 4    | Sees the rows, the same dish twice         | In control                | Rows are one line                               |
| 5    | Presses the shopping button                | Wants it to just work     | A spinner, then the notice                      |
| 6    | A failure stops it at the third meal       | Worried, then clear       | The line names the meal and says what was added |
| 7    | Comes back on the day of the shopping      | Recognises it             | The link row's status says what is left         |
| 8    | Removes a meal that was on the list        | Warned, not stopped       | Decision 7                                      |

### Access and phone rules

These restate what the repository already demands; nothing here is new.

- Every control is 44 px or more in both directions (`touch-target`), also the dialog's "Add" and the remove icon, at 375 px.
- The link row is one link, and the chevron is not read. The row's name carries the status.
- The check icon has the name "On the shopping list". The remove button is named after its meal: "Remove Lentil soup".
- The dialog is Quasar's, which keeps the focus inside and gives it back to "Add meal"; the search field has a visible label. The status line is `role="status"`, an error is `role="alert"`.
- After a meal is removed the focus moves to the next row's remove button, or to "Add meal" after the last one, as `VacationPhase.vue` does for a task.
- Text uses the theme's tokens; the hints are `text-muted` paragraphs. Every element a test needs gets its id in `TEST_IDS`.
- The page holds no horizontal scroll at 375 px, and a long recipe title wraps (`overflow-wrap: anywhere`) as a trip's title does.

### What already exists and is reused

`VacationHeader.vue` (edit in place), `VacationPhase.vue` (the heading's pattern, focus after a removal), `RejectDialog.vue` (the dialog), `RecipeView.vue` (`ensureLoaded` and `addAll`, the notice), the `touch-target` class, and the `text-muted` hints.

### Not in scope

- Days, servings or amounts per meal, and a meal's place in the week.
- Taking ingredients off the shopping list when a meal goes.
- A tile line for meals, and notifications.
- A meal for a recipe that was written for the trip alone.
- Search by ingredient in the dialog.

### Open and not verified

- **Nothing was drawn or measured.** Whether the row's check icon reads as a state beside a long title, and whether the link row looks like a link, is for the first rendering.
- **A recipe book of many dozens** is not designed for; the dialog's search is what is there for it.
- **The wording** of the empty states, the failure line and the status was written in the review, not read aloud.
- **The kind as a label** is unexplained in the form, deliberately.

### Scores

| Pass                       | Before | After |
| -------------------------- | ------ | ----- |
| 1 Information architecture | 4      | 9     |
| 2 States                   | 3      | 9     |
| 3 Journey                  | 5      | 8     |
| 4 Generic-UI risk          | 7      | 8     |
| 5 Design-system fit        | 6      | 8     |
| 6 Phone and access         | 5      | 8     |

Overall 4 of 10 before, 8 of 10 after (the lowest pass). Passes 3 to 6 stay below 9 because nothing was rendered.

## GSTACK REVIEW REPORT

| Review         | Trigger               | Why                     | Runs | Status      | Findings                                                   |
| -------------- | --------------------- | ----------------------- | ---- | ----------- | ---------------------------------------------------------- |
| Outside Review | none                  | Independent 2nd opinion | 0    | unavailable | Codex is not installed; no native second voice was started |
| Design Review  | `/plan-design-review` | UI/UX gaps              | 1    | clean       | score: 4/10 → 8/10, 10 decisions                           |

**OUTSIDE COVERAGE:** Codex, design phase: unavailable (CLI not installed). No outside coverage.

**VERDICT:** DESIGN REVIEW DONE with no mockups; eng review required.

NO UNRESOLVED DECISIONS
