# A more playful look: the eng review's ledger, R1 to R4

Every decision of the eng review of 2026-10-16, as it was saved before it was asked: the finding, the evidence, the options compared, the question as sent, and the answer. This file holds R1 to R4; R5 to R8 are in [`eng-review-ledger-2.md`](./eng-review-ledger-2.md). The review's findings, tasks and report are in [`eng-review.md`](./eng-review.md).

## Decision ledger (2026-10-16)

### R1: how leaving rows are kept out of the e2e helpers

Finding: 1, P1, confidence 9/10, `tests/support/e2e-ui.ts:206-207`, reviewer: this review. The plan says a leaving row "gets `inert` and loses its test id" (`plan.md`, "What the tests need"). The helpers don't find rows by the row's id: `listItems` is `page.getByTestId(TEST_IDS.list.checkbox)`, the checkbox inside the row, and `listItem` filters it by its text. A row that fades out still holds its checkbox with its id, so while it leaves, `listItem(page, "Bread")` matches it and `toHaveCount` counts it; with two rows of the same text (one leaving, one new) Playwright's strict mode fails.

Plan baseline: the leaving row gets `inert` and loses its own test id (original proposal, not asked).

Runtime evidence: no list has a transition today, so no row ever leaves slowly (static read of `TodoList.vue` and `ShoppingList.vue`). With the suite on `reducedMotion: 'reduce'` (planned) the transitions are off and Vue removes a row at once, so R1 only bites in the tests that run with motion on.

Comparison grid:

| Choice                     | Current                     | A                                                               | B                                                                  |
| -------------------------- | --------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| R1 leaving row vs. helpers | unspecified (row's id only) | row gets `inert`; `listItems` excludes what is inside `[inert]` | row gets `inert`; the leave hook removes every `data-testid` in it |
| R2 color-mix fallback      | pending                     | pending                                                         | pending                                                            |
| R3 radius mechanism        | pending                     | pending                                                         | pending                                                            |

Question D2:

D2 — How are fading-out rows kept away from the e2e tests?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, slice 3 (rows in and out).
ELI10: When a row is removed it will fade out for a moment before it disappears. The tests find rows by the checkbox inside them (tests/support/e2e-ui.ts:206), not by the row. So during the fade, a test that counts rows or looks one up by its text still sees the leaving one, and two rows with the same text make Playwright fail. The plan only said the row itself loses its id, which wouldn't help.
Stakes if we pick wrong: flaky e2e tests in the motion-on cases, or test-only code inside the app.
Recommendation: A, because inert is what the app sets anyway (a leaving row can't be pressed or read), so the helper just follows the app's own meaning, with no code in the app that exists only for tests.
Completeness: A=9/10, B=7/10
Pros / cons:
A) Helpers skip anything inside [inert] (recommended)
✅ One change in e2e-ui.ts: listItems and the other row helpers exclude elements inside [inert]
✅ The app does only what a user needs: the leaving row is inert, so it's neither read nor clicked
❌ Every future row helper must use the same filter, or it counts leaving rows again
B) The leave hook strips every data-testid inside the row
✅ The helpers stay as they are; a leaving row simply has no ids any more
✅ Works for any future helper that finds something inside a row by its id
❌ App code that exists only for the tests, which the test value bar rules out (a test-only seam)
Net: a helper that follows inert against test-only code in the app.

Header: Leaving rows

Options:

A) Helpers skip [inert] (recommended)
Rows get inert in the leave hook; listItems and the other row helpers in e2e-ui.ts exclude elements inside [inert]. Human ~2h / CC ~10min.

B) Strip test ids on leave
Rows get inert, and the leave hook also removes every data-testid inside the row; helpers unchanged. Human ~1h / CC ~5min; test-only code in the app.

State: approved

Actual answer: A, "Helpers skip [inert]" (D2)

Accepted scope: the leave hook of the lists' `<transition-group>` sets `inert` on the leaving row; `listItems` and every other row helper in `tests/support/e2e-ui.ts` exclude elements inside `[inert]`; no test id is removed by the app.

History: none

### R2: how the light-mode strong shades are written, and what an older browser gets

Finding: 2, P2, confidence 9/10, `design.md` ("Tokens": `--feature-<name>-strong`) and `plan.md` ("Checked for the shades"), reviewer: this review. The strong shade is Latte's accent mixed with Latte's text in oklab. Probed with the installed `lightningcss`: `light-dark(color-mix(in oklab, var(--a) 84%, var(--b)), #fab387)` comes out as `var(--lightningcss-light,color-mix(in oklab, var(--a) 84%, var(--b)))…`, for old and new targets alike. With `var()` inside, which is how `theme.css` takes every color from `@catppuccin/palette`, the mix is left to the browser: Chrome 111, Safari 16.2, Firefox 113. An older browser finds the custom property invalid at computed time, and an icon or edge that uses it falls back to its inherited color or to nothing.

Plan baseline: "Literal values or the package's variables are decided in slice 1" (original proposal, not asked).

Runtime evidence: probe output above (lightningcss in `node_modules`, both targets). Literal inputs are resolved at build time into fixed values with a `lab()` variant (probe earlier the same day).

Comparison grid:

| Choice                     | Current          | A                                                                                                                                             | B                                                                                                    | C                                           |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| R1 leaving row vs. helpers | approved (D2, A) | approved (D2, A)                                                                                                                              | approved (D2, A)                                                                                     | approved (D2, A)                            |
| R2 strong shades           | undecided        | `color-mix()` of the package's variables, under `@supports`; outside it the shade is `--theme-outline` for edges and the text color for icons | literal `#rrggbb` per shade, computed once by a script from the package and written into `theme.css` | `color-mix()` of the variables, no fallback |
| R3 radius mechanism        | pending          | pending                                                                                                                                       | pending                                                                                              | pending                                     |

Question D3:

D3 — How are the light-mode "strong" shades written into the CSS?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, slice 1 (tokens).
ELI10: In light mode, each feature colour gets a darker shade (the colour mixed with the text colour) so icons and edges reach 3:1. The theme takes every colour from the Catppuccin package as a CSS variable. Mixing variables is done by the browser, not at build time: it needs Chrome 111 / Safari 16.2 / Firefox 113 (checked with the project's own CSS minifier). In an older browser that colour would simply be missing.
Stakes if we pick wrong: on an older phone, the Tonight edge or a tile's hover outline drops below 3:1 or vanishes; or the shades drift from the package when it updates.
Recommendation: A, because it keeps the package as the one source of the colours and degrades to colours that already pass (progressive enhancement), at the cost of one @supports block.
Completeness: A=9/10, B=8/10, C=6/10
Pros / cons:
A) color-mix of the package variables, with a safe fallback (recommended)
✅ The package stays the one source; a palette update changes the shades with it
✅ Older browsers get --theme-outline for edges (3:1 already) and the text colour for icons, so nothing falls below the contrast it needs
❌ The contrast spec has to compute the oklab mix itself (a ~20-line function in the test support) to check the numbers
B) Literal hex values, generated once by a script
✅ Works in every browser that runs the app; the minifier sees plain colours
✅ The contrast spec reads the hex values directly, no oklab maths in the test
❌ A second source of colour beside the package: a script to rerun on a palette update, and a spec to catch forgetting it
C) color-mix of the variables, no fallback
✅ Simplest CSS: one declaration per shade, nothing else
✅ Same single source as A
❌ On an older browser the shade is invalid, and the edge or icon falls back to whatever it inherits, possibly below 3:1
Net: one source with a fallback against literal values that need a script.

Header: Strong shades

Options:

A) color-mix with fallback (recommended)
color-mix() of the package variables inside @supports; outside it edges use --theme-outline and icons the text colour. Spec computes the mix in oklab. Human ~3h / CC ~20min.

B) Literal hex via a script
A script computes each shade from the package and writes #rrggbb into theme.css; the spec checks them. Human ~3h / CC ~20min; rerun on palette updates.

C) color-mix, no fallback
color-mix() of the package variables, nothing for older browsers. Human ~1h / CC ~5min; edges may vanish there.

State: approved

Actual answer: A, "color-mix with fallback" (D3)

Accepted scope: each light-mode strong shade is `color-mix(in oklab, <accent> <p>%, <Latte text>)` of the package's variables, declared inside `@supports (color: color-mix(in oklab, red, red))`; outside it the token is `--theme-outline` where it draws an edge or outline and the text color where it draws an icon. The contrast spec computes the oklab mix itself, from the percentages in `theme.css` and the package's values, with a small function in the test support.

History: none

### R3: where the radius scale is applied

Finding: 3, P3, confidence 9/10, `plan.md` ("Not decided yet": "Whether the radius comes from Quasar's Sass variables … or from overrides in `theme.css`"), reviewer: this review. `nuxt.config.ts` has no `sassVariables` in its `quasar` block, and `sass` is not installed (`node_modules/sass` is missing): the app loads Quasar's precompiled `quasar.css`, where `.q-card` has `border-radius: 4px` (`quasar.css:674`). Sass variables would need a new dependency and Quasar compiled from source on every build.

Plan baseline: open ("Not decided yet").

Runtime evidence: static read of `nuxt.config.ts` and `node_modules`.

Comparison grid:

| Choice              | Current          | A                                                                 | B                                                                                   |
| ------------------- | ---------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| R1                  | approved (D2, A) | approved (D2, A)                                                  | approved (D2, A)                                                                    |
| R2                  | approved (D3, A) | approved (D3, A)                                                  | approved (D3, A)                                                                    |
| R3 radius mechanism | undecided        | the five `--radius-*` tokens, applied by overrides in `theme.css` | `sass` as a dev dependency, `sassVariables` in `nuxt.config.ts`, Quasar's variables |

Question D4:

D4 — Where does the new corner-radius scale get applied?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, slice 1 (shape).
ELI10: Quasar comes as ready-made CSS here (no Sass installed), with 4px corners on cards. To use the new scale, we either override Quasar's radius in our own theme.css, or install Sass and let Quasar build itself with our numbers. The second is how Quasar intends it, but it adds a tool to every build for five numbers.
Stakes if we pick wrong: a slower, heavier build for little gain, or overrides that miss a Quasar component.
Recommendation: A, because five tokens and a handful of selectors in theme.css need no new dependency, and theme.css already overrides Quasar's colours the same way.
Completeness: A=8/10, B=8/10
Pros / cons:
A) Overrides in theme.css (recommended)
✅ No new dependency and no change to the build; the same file already overrides Quasar's colours
✅ The tokens are plain CSS, usable by the app's own components too
❌ Each Quasar component that should change needs its selector listed; a new one used later keeps 4px until added
B) Sass with Quasar's variables
✅ Quasar applies the radius everywhere it uses its own variable, no list of selectors
✅ The way Quasar documents theming
❌ A new dev dependency, Quasar compiled from Sass on every build, and only some radii exist as Sass variables
Net: a list of overrides against a new build dependency.

Header: Radius

Options:

A) Overrides in theme.css (recommended)
--radius-* tokens and overrides for q-field, q-btn, q-menu, q-card, q-dialog in theme.css. Human ~2h / CC ~10min.

B) Sass variables
Add sass, set sassVariables in nuxt.config.ts, use Quasar's variables. Human ~3h / CC ~20min; slower build.

State: approved

Actual answer: A, "Overrides in theme.css" (D4)

Accepted scope: the five `--radius-*` tokens in `theme.css`, applied there by overrides of Quasar's fields, buttons, menus (with tooltips and notices), cards and dialogs; no Sass, no change to `nuxt.config.ts`.

History: none

### R4: where the celebration's trigger and its once-a-minute limit live

Finding: 4, P2, confidence 8/10, `design.md` ("Small celebrations": "the person's own tap ticks the last open item … At most once a minute per list"), reviewer: this review, Section 1. The stores tick optimistically: `toggle` in `app/stores/todos.ts:203-218` flips `done` at once and takes it back if the save fails; `open` (`todos.ts:54-56`) and `toBuy` (`shopping.ts:54`) list what is still open. The plan says the trigger is started "from the tap's handler in the component", but not where the rule "this tap ticked the last open item" and the limit per list are kept. The user's standing rule keeps logic out of the components that render.

Plan baseline: "started from the tap's handler in the component, not from the store's state" (design review, decision 2).

Runtime evidence: static read of the two stores; no celebration code exists.

Comparison grid:

| Choice               | Current                | A                                                                                                                                                                                                                  | B                                                          |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| R1–R3                | approved (D2–D4)       | unchanged                                                                                                                                                                                                          | unchanged                                                  |
| R4 trigger and limit | in "the tap's handler" | a pure `ticksLastOpen(open, id)` in `utils/list-state.ts`; `useCelebration(key)` in `composables/` keeps the time per list for the session and says whether to play; the list's handler calls both before `toggle` | the check and a timestamp in each list component's handler |
| R5 week-fill moment  | pending                | pending                                                                                                                                                                                                            | pending                                                    |

Question D5:

D5 — Where does the "last item ticked, once a minute" logic live?
Project/branch/task: develop, eng review of docs/ui/playful-look/ for #9, slice 4 (celebrations).
ELI10: The celebration plays when your own tap ticks the last open item, at most once a minute per list. That's a small rule, but it's logic: 'was this the last open one?' and 'did we celebrate in the last minute?'. Your rule is that logic stays out of components that draw the screen. Ticking is optimistic, so the check has to look at the list just before the tick.
Stakes if we pick wrong: logic copied into two list components with no unit test, or a check made after the tick that miscounts.
Recommendation: A, because a pure function and a small composable are unit-testable with the project's Vitest setup, like the other utils and composables, and both lists share them.
Completeness: A=9/10, B=6/10
Pros / cons:
A) A pure check in utils plus a useCelebration composable (recommended)
✅ ticksLastOpen(open, id) is a pure function with a Vitest spec beside list-state.spec.ts; the minute limit lives in one composable with its own spec
✅ To-dos and shopping call the same two pieces; the components only start the burst
❌ Two more small units (a function, a composable) to name and keep, for a rule of a few lines
B) Inline in each list's handler
✅ No new function or composable, everything visible where the tap is handled
✅ Fewest files touched
❌ The same rule twice, inside components that render, with no unit test and against your separation rule
Net: two tested pieces against a few untested lines in two places.

Header: Trigger logic

Options:

A) utils check + composable (recommended)
ticksLastOpen(open, id) in utils/list-state.ts and useCelebration(key) in composables/, each with a Vitest spec; the lists call them before toggle. Human ~3h / CC ~15min.

B) Inline in each list
The check and a timestamp inside TodoList.vue and ShoppingList.vue handlers, no unit test. Human ~1h / CC ~5min.

State: approved

Actual answer: A, "utils check + composable" (D5)

Accepted scope: a pure `ticksLastOpen(open, id)` in `utils/list-state.ts`, with cases in `list-state.spec.ts`; `useCelebration(key)` in `composables/`, which keeps the last time per list for the session and says whether the burst may play, with a spec of its own; `TodoList.vue` and `ShoppingList.vue` call both in the tap's handler, before the store's `toggle`, with the list's open items (`open`, `toBuy`).

History: none
