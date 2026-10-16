# A more playful look: the eng review

The engineering review of the plan in [`plan.md`](./plan.md) and [`design.md`](./design.md), after its [`design-review.md`](./design-review.md): what the code and the tests have to do for it, decided one question at a time.

## Eng review (reviewed 2026-10-16)

Target: `docs/ui/playful-look/` (plan, design and design review of issue #9), as it stood after the design review of the same day. Run with `/plan-eng-review`.

### Scope record

Feature answers: none asked (no cut proposed; the user chose all four kinds of motion and the design review's seventeen decisions). Structure: original arrangement (D1). Accepted scope: the plan as written, built with four small shared components in `components/ui/` (`PenStroke.vue`, the wordmark's stroke, also used by the tiles' headings and the celebration; `PageHeading.vue`, the feature's icon and the page's `h2`, on seven pages; `EmptyState.vue`, a drawing and the text, on five lists; `CelebrationBurst.vue`) and `features.ts` in `utils/`, which maps a feature to its icon and its color tokens. Pending remedies: R1, R2, R3.

Scope Challenge: scope accepted as-is.

### Decisions

Eight decisions, each saved with its evidence and its question before it was asked; they are in [`eng-review-ledger.md`](./eng-review-ledger.md) (R1 to R4) and [`eng-review-ledger-2.md`](./eng-review-ledger-2.md) (R5 to R8), and each is written into [`plan.md`](./plan.md) or [`design.md`](./design.md) where it applies.

| ID  | Question                                               | Answer                                                                                      |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| R1  | How fading-out rows are kept away from the e2e helpers | D2, A: rows are `inert`; the row helpers skip what is inside `[inert]`                      |
| R2  | How the light-mode strong shades are written           | D3, A: `color-mix()` of the package's variables under `@supports`, with fallbacks that pass |
| R3  | Where the radius scale is applied                      | D4, A: overrides in `theme.css`, no Sass                                                    |
| R4  | Where the celebration's rule and limit live            | D5, A: `ticksLastOpen` in `utils/` and `useCelebration` in `composables/`                   |
| R5  | When Fill my week celebrates                           | D6, A: after a full save only                                                               |
| R6  | How the Tonight tile gets its lead look                | D7, A: a class set by `index.vue`                                                           |
| R7  | How a ticked shopping item moves                       | D8, A: it slides to its place in 200ms                                                      |
| R8  | The regression contract                                | D9, A: the suites unchanged, plus three assertions                                          |

Approval readiness: PASS. R1 (D2, A), R2 (D3, A), R3 (D4, A), R4 (D5, A), R5 (D6, A), R6 (D7, A), R7 (D8, A), R8 (D9, A), TODO-1 (D10, C); scope by D1 (original arrangement).

### Section 1: architecture

- [P2] (confidence: 8/10) `design.md` "Small celebrations": where the trigger's rule and its limit live. Disposition: accepted, R4 (D5, A).
- [P2] (confidence: 9/10) `app/composables/use-week-fill.ts:187-209`: the week's celebration only after a full save. Disposition: accepted, R5 (D6, A).

No security boundary changes: no data, no API, no auth is touched. A celebration on the last tick is optimistic like the tick itself: when the save fails, the store unticks the row and shows its error line (`stores/todos.ts:203-218`), so the person sees the burst and then the error, not a silent loss.

```text
tap on a checkbox (TodoList / ShoppingList handler)
  ├─ ticksLastOpen(store.open | store.toBuy, id)?  ── no ──► store.toggle(id)
  └─ yes ─► useCelebration(list).mayPlay()? ── no ──► store.toggle(id)
              └─ yes ─► place burst at the checkbox's rect (fixed layer)
                        store.toggle(id)  (optimistic; may be taken back)
Realtime event ─► store state ─► rows enter / leave / move (no burst, ever)
Fill my week: save() ─► every dinner saved? ─► useCelebration("week")
```

### Section 2: code quality

- [P2] (confidence: 9/10) `app/pages/index.vue:299-310`: the lead look without a one-caller prop. Disposition: accepted, R6 (D7, A).
- [P1] (confidence: 9/10) `app/components/dashboard/DashboardTile.vue:75` and `app/layouts/default.vue:126`: radii written out as `4px` that have to follow the tokens. Disposition: accepted, part of R8 (D9, A).

The four shared components and `features.ts` in `utils/` (D1) each have three or more callers: `PenStroke` (wordmark, tiles, burst), `PageHeading` (seven pages), `EmptyState` (five lists), `CelebrationBurst` (two lists and the week), `features.ts` (the tiles and the headings).

### Section 3: tests

Framework: Vitest for `*.spec.ts` (utils, composables, stores) and Playwright for `*.e2e.ts`, as `rules/commands.md` describes.

```text
CODE PATHS                                         USER FLOWS
[+] theme.css tokens                               [+] Tick the last open item (own tap)
  ├─ feature tokens' shape   [GAP] spec              ├─ burst plays            [GAP] →E2E, motion on
  ├─ contrast of every pair  [GAP] spec (oklab)      ├─ second time < 1 min    [GAP] unit (useCelebration)
  └─ @supports fallback      [GAP] spec reads CSS    └─ save fails → untick    [unverified] no test of a failed tick was looked for
[+] utils/list-state.ts                            [+] Another member ticks the last item
  └─ ticksLastOpen           [GAP] unit              └─ no burst here          [GAP] →E2E, extend realtime-sync
[+] composables/useCelebration                     [+] Rows in and out
  └─ limit per list          [GAP] unit              ├─ leaving row inert      [GAP] →E2E, motion on
[+] use-week-fill save()                             └─ helpers skip [inert]   [GAP] covered by the suite (D2)
  ├─ all saved → burst       [GAP] →E2E extend meal-fill
  └─ partial → notice only   [★★ TESTED] meal-fill.e2e (notice)
[+] index.vue lead class                           [+] Shopping tick slides (D8)
  ├─ content → tint          [GAP] a11y scan (both modes)  └─ row ends among checked [★★★ TESTED] realtime-sync :128
  └─ loading/failed → none   [GAP] a11y scan of failure? see below
[+] Regression contract (D9)                       [+] Forced colors, 200% text
  ├─ link radii = tokens     [GAP] e2e assertion     └─ looked at per slice   [GAP] screenshots (plan, decision 13)
  ├─ wordmark stroke         [GAP] e2e assertion
  └─ row's accessible name   [GAP] e2e assertion
COVERAGE: 2/19 paths tested today | every GAP has a planned test below
```

Planned tests, each with its value card:

- `list-state.spec.ts`, cases for `ticksLastOpen`: the last open item, not the last, an id not open, an empty list. Value: protects=the burst only on the last open item; fails_when=the check counts after the optimistic tick or ignores the id; why_new=no such function today; seam=none; no_claim=that the component calls it.
- `use-celebration.spec.ts` in `composables/` (new): plays once, not again within a minute for the same list, again for another list, again after a minute (fake timers). Value: protects=once a minute per list; fails_when=the time is kept per app instead of per list, or not kept; why_new=new composable; seam=none; no_claim=what the burst looks like.
- `theme-tokens.spec.ts` in `utils/` (new, beside `ink.spec.ts`): every feature has its three tokens as `light-dark()`; every text, muted, hovered-flat-button and red pair on every tint is at 4.5:1 or more, every strong shade at 3:1 or more, computed from the package and the percentages in `theme.css` with an oklab mix in the test support; the `@supports` block has a fallback for each strong shade. Value: protects=the contrast figures of the plan; fails_when=a percentage or a palette update lowers a pair; why_new=the a11y scan sees only what is on screen, not a hovered button on a tint; seam=none; no_claim=what the browser renders (the scan covers that).
- `lists.e2e.ts`, one test with `reducedMotion: 'no-preference'`: tick the last open to-do, the burst appears and is gone within a second, the row is still there, ticked, and its accessible name is its title (D9); remove a row and assert it is not counted while it leaves (D2). Value: protects=motion leaves the list correct; fails_when=a leaving row is counted or the name changes; why_new=the suite runs with reduced motion; seam=none; no_claim=animation timing.
- `realtime-sync.e2e.ts`, extend the to-do test: the other member ticks the last open item; on this page no burst appears. Value: protects=no burst from a Realtime change (design review, decision 2); fails_when=the burst is started from the store's state; why_new=nothing checks it; seam=none; no_claim=none beyond protects.
- `meal-fill.e2e.ts`, extend: after a full save the burst appears once. Value: protects=D6; fails_when=the burst plays before or without a full save; why_new=new behavior; seam=none; no_claim=the partial case beyond its notice.
- `a11y.e2e.ts`: the dashboard is scanned with the Tonight tile's content (tint) in both modes, as now; one scan with motion on after the animations end; the two radius assertions and the wordmark's (D9) go into the existing header and dashboard tests. Value: protects=contrast on the tint and the regression contract; fails_when=a pair on the tint drops or a radius is left at 4px; why_new=the tint is new; seam=none; no_claim=hover over every control.

Tests made obsolete: none. The failed Tonight tile in light mode is no longer on the tint (design review, decision 4), so it needs no scan of its own beyond the existing failure path.

### Section 4: performance

No issues found. A `<transition-group>` records each child's position on an update, a read of layout per row, at the size of a family's list (tens of rows). The burst is up to seven SVG paths for about 600ms, once a minute at most. `color-mix()` is computed once per style recalculation. Scale of the lists is not measured.

### Outside voice

Codex was asked (prompt: the plan and the design with the decisions written in) and failed: "Quota exceeded. Check your plan and billing details." The native fallback needs a tool to wait on a background reviewer, which this session didn't have. No outside review ran: this is missing coverage, not a pass.

### TODO

- **TODO-1, built in slice 4** (D10, C): store specs for `toggle` in the to-do and the shopping store, with `tests/support/fake-supabase-client.ts`: when the save throws, the item is unticked again and `error` is set (`stores/todos.ts:203-218`). Nothing tests that rollback today, and a burst on the last tick is followed by it when the save fails.

### Reality rows

| Premise                                                  | Receipt                                            | Verdict                           |
| -------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `listItems` finds the checkbox, not the row              | `tests/support/e2e-ui.ts:206-207`                  | true                              |
| `sass` is absent; Quasar's CSS is precompiled            | `nuxt.config.ts` quasar block; `node_modules/sass` | true                              |
| a mix of `var()`s is left to the browser by the minifier | lightningcss probe, both targets                   | true                              |
| a ticked to-do stays in place                            | `app/utils/list-state.ts` via `todos.ts:51`        | true                              |
| a ticked shopping item moves to the end                  | `app/utils/shopping-state.ts:10-12`                | true (plan corrected, D8)         |
| the stores tick optimistically and roll back on failure  | `app/stores/todos.ts:203-218`                      | true                              |
| `save()` of the week fill can save only part             | `app/composables/use-week-fill.ts:187-209`         | true                              |
| Playwright has `forcedColors` and `reducedMotion`        | `playwright-core/types/types.d.ts:2809,2821`       | true                              |
| the contrast figures of the plan                         | computed from `@catppuccin/palette` (WCAG formula) | true [measured: palette, not axe] |
| a failed tick is tested                                  | none found                                         | false (TODO-1)                    |

unverified=0

```text
REALITY: premise-table finding 10 premises, 1 false (no test of a failed tick, TODO-1), 1 corrected (shopping order, D8) tests/support/e2e-ui.ts:206
REALITY: already-done pass nothing on origin/main or origin/develop since 2026-10-16 touches the named files (git log) app/assets/css/theme.css:1
REALITY: surface-check pass Playwright forcedColors/reducedMotion exist; color-mix() needs Chrome 111/Safari 16.2/Firefox 113 node_modules/playwright-core/types/types.d.ts:2809
REALITY: binding-decisions pass "no one-caller prop" kept (D7) app/pages/index.vue:457
REALITY: numbers pass contrast figures computed from the package; efforts are [estimated] docs/ui/playful-look/design.md:1
REALITY: deferred-asks pass the issue's asks (color, playful, animations, transforms, borders, a11y) are all in the plan docs/ui/playful-look/plan.md:1
REALITY: pr-count pass no ship policy; four slices, each released by a push (rules/delivery.md) docs/rules/delivery.md:1
```

### Not in scope

- Paging or virtualising the lists: their size is a family's; the transitions read each row's position on an update, which is fine at that size.
- A test of every hover state on every page: the token spec covers the pairs on the tints; the a11y scan keeps its existing hovered and focused controls.
- Screenshot baselines (D9, A).

### What already exists

- `DashboardTile.vue`'s stretched link and hover outline; `index.vue`'s `dashboard__tile--wide` (reused for the lead class, D7).
- The stores' `open` and `toBuy` getters (reused by `ticksLastOpen`, D5); `use-week-fill.ts`'s counts (D6).
- `ink.spec.ts`, the model for the token spec; `tests/support/fake-supabase-client.ts` for the store specs (TODO-1).
- The wordmark's stroke in `layouts/default.vue`, moved into `PenStroke.vue` (D1).

### Failure modes

| Path                           | Realistic failure                     | Test                                  | Handling                          | User sees                         |
| ------------------------------ | ------------------------------------- | ------------------------------------- | --------------------------------- | --------------------------------- |
| last tick, save fails          | burst plays, then the row is unticked | TODO-1 store spec                     | store rollback and error line     | the error line (not silent)       |
| leaving row                    | a test or a tap reaches a fading row  | `lists.e2e.ts` with motion on         | `inert` (D2)                      | nothing: the row can't be used    |
| older browser                  | `color-mix()` unsupported             | token spec checks the fallback exists | `@supports` fallback (D3)         | text-colored icons, outline edges |
| Realtime tick of the last item | burst on the wrong phone              | `realtime-sync.e2e.ts` extension      | trigger only in the tap handler   | nothing                           |
| week fill, one dinner refused  | burst beside a partial notice         | `meal-fill.e2e.ts` extension          | burst only after a full save (D6) | the notice only                   |

Critical gaps: none.

### Lanes

| Step                            | Modules touched                                                                                | Depends on |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| 1 tokens, radii, edges, rules   | `assets/css`, `tests/unit`-style specs, `docs/rules`                                           | none       |
| 2 tiles, headings, empty states | `components/ui`, `components/dashboard`, `pages`, `utils`                                      | 1          |
| 3 motion                        | `components/todo`, `components/shopping`, `tests/support`, `tests/e2e`, `playwright.config.ts` | 1          |
| 4 celebrations                  | `components/ui`, `composables`, `utils`, `stores` specs, `tests/e2e`                           | 2, 3       |

Slices 2 and 3 touch different modules and could run in parallel once slice 1 is in; the plan releases them one after the other, so: sequential, as planned.

### Implementation tasks

- [ ] **E1 (P1, human ~4h / CC ~20min)**: theme tokens: feature tokens, strong shades as `color-mix()` under `@supports` with fallbacks (D3), tints, `--radius-*` with overrides of Quasar's components (D4), card edges without shadows, browser surfaces. Files: `app/assets/css/theme.css`. Verify: `theme-tokens.spec.ts`; screenshots both modes.
- [ ] **E2 (P1, human ~3h / CC ~15min)**: the token spec with an oklab mix in the test support. Files: `theme-tokens.spec.ts` beside `ink.spec.ts`, test support. Verify: `npm run test:unit`.
- [ ] **E3 (P1, human ~1h / CC ~5min)**: the rule file `look.md` in `docs/rules/` and the moved bullets.
- [ ] **E4 (P1, human ~4h / CC ~20min)**: `PenStroke.vue` in `components/ui/` (with the wordmark moved onto it), `PageHeading.vue`, `EmptyState.vue`, `features.ts` in `utils/`; tiles with icon in the strong shade and the stroke; `index.vue`'s lead class (D7); radii of the stretched link and wordmark from the tokens (D9). Verify: `a11y.e2e.ts`, the three regression assertions (D9).
- [ ] **E5 (P1, human ~4h / CC ~20min)**: lists in `<transition-group>`: enter, leave (`inert`), the shopping `-move` (D8); tick overshoot and drawn strike-through; `reducedMotion: 'reduce'` in `playwright.config.ts`; `[inert]` filter in the row helpers (D2). Verify: `lists.e2e.ts` with motion on; the suite.
- [ ] **E6 (P1, human ~4h / CC ~20min)**: `ticksLastOpen`, `useCelebration`, `CelebrationBurst.vue` placed from the checkbox's rect; the week's burst after a full save (D5, D6). Verify: unit specs; `realtime-sync.e2e.ts` and `meal-fill.e2e.ts` extensions.
- [ ] **E7 (P2, human ~1h / CC ~10min)**: store specs for the `toggle` rollback (TODO-1).
- [ ] **E8 (P2, human ~1h / CC ~10min per slice)**: forced colors and 200% text, with screenshots (design review, decision 13).

Efforts are [estimated], with the default ratios of the review (features ~30x, tests ~50x).

### Summary

- Scope Challenge: scope accepted as-is (original arrangement, D1).
- Reality rows: 7/7 emitted, 0 unverified premises.
- Architecture: 2 issues; code quality: 2; tests: diagram made, 17 gaps, each with a planned test; performance: 0.
- Not in scope and what already exists: written. TODO: 1 proposed, built in slice 4.
- Failure modes: 0 critical gaps. Unresolved decisions: 0.
- Outside voice: Codex, unavailable (quota exceeded); no native fallback (no tool to wait on it).
- Lanes: 4 steps, sequential as planned.
- Lake score: 9/9 answers chose the option scored highest.

## GSTACK REVIEW REPORT (2026-10-16)

| Review         | Trigger                   | Why                             | Runs | Status      | Findings                                |
| -------------- | ------------------------- | ------------------------------- | ---- | ----------- | --------------------------------------- |
| CEO Review     | `/plan-ceo-review`        | Scope & strategy                | 0    | (none)      | (none)                                  |
| Outside Review | Codex, `/plan-eng-review` | Independent 2nd opinion         | 1    | unavailable | quota exceeded, no review ran           |
| Eng Review     | `/plan-eng-review`        | Architecture & tests (required) | 1    | ISSUES OPEN | 21 issues, 0 critical gaps, all decided |
| Design Review  | `/plan-design-review`     | UI/UX gaps                      | 1    | CLEAR       | score 4/10 → 8/10, 17 decisions         |
| DX Review      | `/plan-devex-review`      | Developer experience gaps       | 0    | (none)      | (none)                                  |

- **OUTSIDE COVERAGE**: Codex, plan-review phase, unavailable (quota exceeded); design phase skipped by the user. No outside model has read this plan.
- **VERDICT**: DESIGN CLEARED. The eng review's issues are all decided and mapped to tasks E1–E8; its status is "issues open" by the log's rule (any issue found counts), not because anything is left to decide.

NO UNRESOLVED DECISIONS
