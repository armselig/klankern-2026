# A more playful look: the eng review's ledger, R5 to R8

The second half of the eng review's decisions of 2026-10-16; R1 to R4 and how the ledger is kept are in [`eng-review-ledger.md`](./eng-review-ledger.md). The review's findings, tasks and report are in [`eng-review.md`](./eng-review.md).

## Decision ledger, continued (2026-10-16)

### R5: what "Fill my week has filled the week" means

Finding: 5, P2, confidence 9/10, `app/composables/use-week-fill.ts:187-209`, reviewer: this review, Section 1. The plan celebrates "when \"Fill my week\" has filled the week" (`design.md`, "Small celebrations"). `save()` adds each proposed dinner through the store and returns a notice made from `results.filter(Boolean).length` and `results.length`: some dinners can be refused while others are saved, and the refused days stay open.

Plan baseline: "when \"Fill my week\" has filled the week" (design review, decision 6; the moment within the save is not named).

Runtime evidence: static read of `save()`; a refused dinner is taken back by the store, per its comment.

Comparison grid:

| Choice              | Current               | A                                                                                                             | B                                                                          |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| R1–R4               | approved (D2–D5)      | unchanged                                                                                                     | unchanged                                                                  |
| R5 week-fill moment | "has filled the week" | after `save()` has resolved, only when every proposed dinner was saved; then through `useCelebration("week")` | as soon as the proposal's save button is pressed, like the optimistic tick |

Question D6:

D6 — When exactly does "Fill my week" celebrate?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, slice 4 (the week fill's celebration).
ELI10: "Fill my week" saves several dinners at once, and some can fail while others succeed (use-week-fill.ts:187). The app then says how many were planned, and failed days stay open. If the flourish plays before we know, it can celebrate a week that isn't filled.
Stakes if we pick wrong: a celebration next to a notice saying only some of the dinners were planned, which feels broken.
Recommendation: A, because the save already tells us how many succeeded, and celebrating only a fully filled week keeps the reward honest.
Completeness: A=9/10, B=6/10
Pros / cons:
A) After the save, only when every dinner was saved (recommended)
✅ The flourish never sits beside a partial-failure notice
✅ Uses the counts save() already computes; no new state, same useCelebration as the lists
❌ Plays a moment later than the tap, once the dinners are saved (usually well under a second)
B) Right on the press of the save button
✅ Instant, like the tick's own animation
✅ Nothing to wait for in the code
❌ Celebrates a week that may come back partly unplanned, next to a notice saying so
Net: an honest moment against an instant one.

Header: Week fill

Options:

A) After a full save (recommended)
Celebrate when save() resolves and every proposed dinner was saved; partial or failed saves show only the notice. Human ~1h / CC ~5min.

B) On the press
Celebrate when the proposal's save button is pressed, before the save resolves. Human ~30min / CC ~5min.

State: approved

Actual answer: A, "After a full save" (D6)

Accepted scope: the week's celebration plays after `save()` in `use-week-fill.ts` has resolved and only when every proposed dinner was saved, through `useCelebration("week")`; a partial or failed save shows only its notice.

History: none

### R6: how the Tonight tile gets its lead look

Finding: 6, P2, confidence 9/10, `app/pages/index.vue:299-310` and `:457-459`, reviewer: this review, Section 2. The Tonight tile leads with a peach tint and a full edge, only once it has content (`design.md`, "Color per screen"; design review decisions 1, 4, 5). `DashboardTile.vue` takes `title`, `to`, `icon`, `loading` and `failed`; nothing marks one tile as leading. A `lead` prop would have one caller, which the binding decision of 2026-10-12 rules out ("A shared component stays without a one-caller prop"). The page already makes this tile's layout its own business: `<li class="dashboard__tile--wide">`, styled in the page as `grid-column: 1 / -1`.

Plan baseline: the look is specified, the mechanism is not (design review).

Runtime evidence: static read of `index.vue` and `DashboardTile.vue`; the page passes `loading` and `failed` for Tonight itself (`mealPlanStore.loading || recipeStore.loading`, `tonightFailed`).

Comparison grid:

| Choice                 | Current          | A                                                                                                                                                            | B                                                  |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| R1–R5                  | approved (D2–D6) | unchanged                                                                                                                                                    | unchanged                                          |
| R6 lead look mechanism | none             | `index.vue` puts a class (`dashboard__tile--lead`) on the Tonight tile when it is neither loading nor failed, and styles it in the page, as it does `--wide` | a `lead` prop on `DashboardTile.vue`, styled there |

Question D7:

D7 — How does the Tonight tile get its special look?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, slice 2 (dashboard).
ELI10: Only the Tonight tile gets the peach tint and the full edge, and only once it has content. The shared tile component has no notion of 'the leading tile'. Adding a 'lead' option to it would serve one tile, which an earlier decision of yours rules out for shared components. The dashboard page already gives this tile its own layout (it spans the row), so it can give it its look the same way.
Stakes if we pick wrong: a shared component with an option only one caller uses, against your earlier rule; or the look split across two places.
Recommendation: A, because the page already owns this tile's layout (index.vue:457) and knows when it is loading or failed.
Completeness: A=9/10, B=7/10
Pros / cons:
A) A class set by the dashboard page (recommended)
✅ Follows the existing dashboard__tile--wide pattern: the page decides which tile leads and how
✅ The page already has the loading and failed state, so 'tint only with content' is one condition there
❌ The tile's look is partly styled outside DashboardTile.vue, in index.vue
B) A lead prop on DashboardTile
✅ Everything about how a tile can look lives in one component
✅ Discoverable for a future second leading tile
❌ A one-caller prop on a shared component, against the binding decision of 2026-10-12
Net: the page's own layout pattern against a one-caller prop.

Header: Lead tile

Options:

A) Class from the page (recommended)
index.vue adds dashboard__tile--lead to the Tonight tile when not loading and not failed, and styles it beside dashboard__tile--wide. Human ~1h / CC ~5min.

B) lead prop
A lead prop on DashboardTile.vue, styled there; only Tonight passes it. Human ~1h / CC ~5min.

State: approved

Actual answer: A, "Class from the page" (D7)

Accepted scope: `index.vue` sets `dashboard__tile--lead` on the Tonight tile's `dashboard-tile` when it is neither loading nor failed, and styles the tint and the full edge in the page beside `dashboard__tile--wide`; `DashboardTile.vue` gets no prop for it.

History: none

### R7: a ticked shopping item moves; how the move looks

Finding: 7, P1, confidence 10/10, `app/utils/shopping-state.ts:10-12`, reviewer: this review, Section 3 (user flows). `visibleShoppingItems` sorts with `(a, b) => Number(a.checked) - Number(b.checked)`: a ticked item leaves its place for the end of the list at once, and `realtime-sync.e2e.ts:128` tests "checked items last". The plan says of ticking off: "The row stays where it is, as now" (`design.md`, "Ticking off"). That holds for the to-dos only. With the lists in a `<transition-group>`, the jump is either animated or left instant, and the celebration, which starts at the ticked checkbox, would start where the row was a moment ago.

Plan baseline: "The row stays where it is, as now" (design, not asked; wrong for shopping).

Runtime evidence: static read of `shopping-state.ts`, `ShoppingList.vue` (`v-for="item in shoppingStore.visible"`) and the realtime test's title.

Comparison grid:

| Choice           | Current                 | A                                                                                                                                                                                                    | B                                                                |
| ---------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R1–R6            | approved (D2–D7)        | unchanged                                                                                                                                                                                            | unchanged                                                        |
| R7 shopping move | instant jump to the end | the row slides to its new place (a `-move` transition, transform only, 200ms, ease-out; instant under reduced motion); the burst is placed from the checkbox's position at the tap, in a fixed layer | the jump stays instant, as now; the burst is placed the same way |

Question D8:

D8 — A ticked shopping item jumps to the bottom. Should it slide there?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, slice 3 (motion).
ELI10: On the shopping list, ticked items go to the end (shopping-state.ts:10). So when you tick 'Milk', its row jumps away from under your thumb, today instantly. The plan wrongly assumed rows stay put. With the new list animations we can let the row slide down so your eye can follow it, or keep the jump.
Stakes if we pick wrong: in the shop, a row that vanishes from under your thumb makes you wonder if the tap worked; a slide that's too slow gets in the way of the next tick.
Recommendation: A, because a short slide shows where the item went, which is exactly what motion is for here; it's off under reduced motion.
Completeness: A=9/10, B=7/10
Pros / cons:
A) Slide to the new place, 200ms (recommended)
✅ You can see where the ticked item went, instead of it disappearing from under your thumb
✅ Same transition-group the plan already adds; one -move class, transform only, nothing else moves the layout
❌ During the 200ms the rows below shift up under the thumb; a very fast second tap may land on the moving row
B) Keep the instant jump
✅ Exactly today's behaviour, nothing new to get used to in the shop
✅ No moving targets for a fast second tap
❌ The row still vanishes from under the thumb, the one place where motion would explain something
Net: a visible path for the ticked item against no moving targets.

Header: Shopping move

Options:

A) Slide, 200ms (recommended)
A -move transition on the shopping list (transform, 200ms, ease-out, none under reduced motion); burst placed from the checkbox's position at the tap. Human ~2h / CC ~10min.

B) Instant, as now
No move transition; the burst is placed from the checkbox's position at the tap. Human ~1h / CC ~5min.

State: approved

Actual answer: A, "Slide, 200ms" (D8)

Accepted scope: the shopping list's `<transition-group>` has a `-move` transition (transform only, 200ms, ease-out; none under `prefers-reduced-motion: reduce`), so a ticked item slides to its place among the checked ones; the burst is placed from the checkbox's position at the tap, in a fixed layer, so it doesn't follow the row. The ordering itself (`visibleShoppingItems`) is unchanged.

History: none

### R8: the regression contract

Finding: 8, P1, confidence 9/10, reviewer: this review, Section 3 (regression rule). The plan restyles every page and wraps both lists in a `<transition-group>`; existing behavior is at risk in places the plan doesn't name: the tile's stretched link has `border-radius: 4px` written out (`DashboardTile.vue:75`), and so has the wordmark's link (`layouts/default.vue:126`); the wordmark's stroke moves into `PenStroke.vue` (D1); the rows' accessible names come from the checkbox's label (`TodoItem.vue`), which the strike-through animation touches; the suite's helpers change (D2).

Plan baseline: "Screenshots at 375px in both modes before and after, and the a11y scan, are part of each [slice]" (plan, "Slices").

Runtime evidence: static reads of the two files and lines above; the existing suites: `lists.e2e.ts` (add, check, remove, across a reload; check while the add is saving), `realtime-sync.e2e.ts` (live changes, checked items last), `dashboard.e2e.ts` (tiles follow another member, lead to their pages), `a11y.e2e.ts` (every page, both modes, hovered and focused controls).

Comparison grid:

| Choice                 | Current                       | A                                                                                                                                                                                                                                                                                                                                                                                                  | B                                                                |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| R1–R7                  | approved (D2–D8)              | unchanged                                                                                                                                                                                                                                                                                                                                                                                          | unchanged                                                        |
| R8 regression contract | screenshots and the a11y scan | preserve: every existing e2e and unit spec passes with no change but the `[inert]` filter (D2) and `reducedMotion` in the config; intended differences: looks, motion, the shopping slide (D8); added assertions: the stretched link's and the wordmark's radius follow the tokens, the wordmark's stroke is still `aria-hidden` and thickens on focus, a row's accessible name is still its title | A, plus `toHaveScreenshot` baselines of every page in both modes |

Question D9:

D9 — What must keep working, and how is it checked?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, all slices.
ELI10: This restyles every page and changes how list rows appear and disappear. Some existing behaviour is easy to break by accident: the tile's whole-card link has its own 4px corner (DashboardTile.vue:75), the wordmark's link too (default.vue:126), the wordmark's pen stroke moves into a shared component, and a row's name for screen readers comes from the checkbox label that the strike-through will animate. We need a written promise of what stays the same.
Stakes if we pick wrong: a regression in links, focus or screen-reader names that no test catches, or a wall of brittle screenshot tests.
Recommendation: A, because the existing suites already cover the behaviour, and three targeted assertions cover exactly what this plan touches; pixel baselines would break on every intended restyle.
Completeness: A=9/10, B=9/10
Pros / cons:
A) Existing suites unchanged plus three targeted assertions (recommended)
✅ Every current e2e and unit spec must pass as is, apart from the inert filter and reducedMotion
✅ New checks for the radius of the stretched link and wordmark, the wordmark stroke's aria-hidden and focus thickness, and each row's accessible name
❌ Visual drift between slices is caught only by the screenshots a person looks at, not by a test
B) A plus screenshot baselines of every page in both modes
✅ Any visual change fails a test until its baseline is updated
✅ Catches drift nobody looked for
❌ Every slice changes the look on purpose, so baselines churn each time; fonts and timing make them flaky on CI
Net: targeted checks for the risky spots against pixel baselines that churn.

Header: Regressions

Options:

A) Suites + 3 assertions (recommended)
Existing specs pass unchanged (except the inert filter and reducedMotion); add assertions for link radii, the wordmark stroke and rows' accessible names. Human ~3h / CC ~15min.

B) Plus screenshot baselines
A, plus toHaveScreenshot for every page in light and dark. Human ~1 day / CC ~45min; baselines updated each slice.

State: approved

Actual answer: A, "Suites + 3 assertions" (D9)

Accepted scope: every existing e2e and unit spec passes with no change but the `[inert]` filter of D2 and `reducedMotion: 'reduce'` in `playwright.config.ts`; intended differences are the looks, the motion and the shopping slide (D8); three assertions are added: the stretched link's and the wordmark link's `border-radius` equal their tokens, the wordmark's stroke is `aria-hidden` and thicker on focus, and a row's accessible name is still its title while and after its strike-through is drawn. No screenshot baselines.

History: none
