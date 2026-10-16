# A more playful look: the design review

The review of the plan in [`plan.md`](./plan.md) and [`design.md`](./design.md), where its decisions are written in.

## Design review (reviewed 2026-10-16)

The plan went through `/plan-design-review` on the day it was written, before any code. Every decision marked "decided in the design review" was asked as a question of its own, and the user chose it; it is written into the plan where it applies. The design tool's mockups failed (the image service refused every request with a rate limit), so the review was in text, against screenshots of the app as it is. No outside reviewers: the user chose to go without.

### The decisions

1. **Tonight leads** the dashboard with a tint over its surface and a full edge in peach; the other tiles stay quiet.
2. **Whose change moves what**: rows slide in and collapse for every change; the tick's overshoot and the celebrations answer only the person's own tap, started from the tap's handler.
3. **Empty-state drawings** on the five list pages that have an empty state, not in the dashboard's tiles.
4. **The Tonight tile shows its tint only with content**: the shared red failure line is at 4.42:1 on peach at 8%.
5. **The Tonight tint is 6% in light mode**, 8% in dark: a hovered flat button on it was at 4.48:1 at 8%.
6. **The celebration's moment** is the person's own tap on the last open item, at most once a minute per list; not a list becoming empty, which the app has no action for.
7. **No icon chips.** The wordmark's pen stroke under a tile's heading and the icon in the strong shade carry the color.
8. **A page's heading** has the colored icon and no stroke: it is not a link, and only links are underlined.
9. **Cards have an edge and no shadow**; what floats above the page keeps its shadow.
10. **The tick's overshoot is the app's only bounce**; everything else eases out.
11. **Radii on a scale by size, in `rem`**: 0.5, 0.625, 0.75, 1 and 1.25rem.
12. **The rules for the look go into a new rule file**, look.md in `docs/rules/`, written with slice 1.
13. **Forced colors and 200% text** are looked at in every slice.
14. **The whiteboard's board keeps a neutral edge**; its pink is on the heading's icon.
15. **The celebration is pen strokes** bursting from the ticked checkbox, about 600ms.
16. **The drawings are sketched at the start of slice 2** and shown before they are built.
17. **The browser's own surfaces** (selection, caret, scrollbar, `accent-color`) take the theme's colors in slice 1.

Two contrast failures came out of the review's own figures and were fixed by decisions 4 and 5: the red failure line and a hovered flat button, both on the Tonight tile's tint in light mode. Without the review, the a11y scan would have found the second only when a button happened to be hovered.

### What already exists and is reused

- The tile's hover outline instead of a veil, and its link stretched over the card (`DashboardTile.vue`).
- `--theme-tint` and the rule for text on a tint; `--theme-veil-on-surface` for flat buttons.
- The inks (`--ink-*`, `utils/ink.ts`): the feature tokens are built on the same Catppuccin colors.
- The wordmark's pen stroke (`layouts/default.vue`): the tiles' strokes, the drawings and the celebration use its style.
- The guards for motion and hover, `prefers-reduced-motion: no-preference` and `any-hover: hover`, as the wordmark has them.
- `touch-target` for 44px controls, and the one shared failure line of the tiles.

### Not in scope

- The layout of the dashboard and the order of its tiles: unchanged; only how the tiles look.
- Fonts: Roboto stays (decided 2026-10-11, see [`icons-fonts-and-markup.md`](../icons-fonts-and-markup.md)).
- The header: it stays mauve on every page; a header in each feature's color would leave text on Latte's pastels, which no text color carries.
- Wider screens: the layout grows as it does now; nothing in this plan changes at a breakpoint.
- Sounds and haptics: none.

### Implementation tasks

From the decisions above; each slice's checks are those of "Slices".

- [ ] **T1 (P1)**: feature tokens (`--feature-<name>`, `-strong`, `-tint`) and the radius tokens in `theme.css`; the Tonight tint at 6% (light) and 8% (dark). A spec for their shape and one that calculates every pair's contrast, including the hovered flat button and the red line on the tint. Slice 1.
- [ ] **T2 (P1)**: cards with an edge and no shadow, dialogs, menus and notices with one; `::selection`, `caret-color`, `scrollbar-color`, `accent-color`. Slice 1.
- [ ] **T3 (P1)**: the rule file look.md in `docs/rules/`, with the look's bullets moved out of `conventions.md`. Slice 1.
- [ ] **T4 (P1)**: tiles with the icon in the strong shade, the pen stroke under the heading in a few variants, faint edges; Tonight with its tint only once it has content. Page headings with the icon; the whiteboard's board with a neutral edge. Slice 2.
- [ ] **T5 (P1)**: sketches of the five drawings in both modes, shown to the user, then built. Slice 2.
- [ ] **T6 (P1)**: press feedback; the tick's overshoot and the drawn strike-through, from the tap's handler only; rows in and out with `inert` and no test id while leaving. The suite on `reducedMotion: 'reduce'`, one scan with motion on. Slice 3.
- [ ] **T7 (P1)**: the celebration, pen strokes from the ticked checkbox, on the person's own last tick, at most once a minute per list; a spec that a Realtime change doesn't set it off. Slice 4.
- [ ] **T8 (P2)**: in every slice, a look with `forcedColors: 'active'` and one at 200% text, with screenshots.

### Summary

| Pass                            | Before | After | What keeps it from 10                                            |
| ------------------------------- | ------ | ----- | ---------------------------------------------------------------- |
| Step 0, first impression        | 6      |       |                                                                  |
| 1, information architecture     | 5      | 9     | the order of the other tiles is not looked at                    |
| 2, states                       | 4      | 8     | partial states (a list loaded, its tile failed) stay as they are |
| 3, journey                      | 6      | 8     | the first visit of a new household is not storyboarded           |
| 4, generic patterns             | 5      | 8     | the strokes' variants are not drawn yet                          |
| 5, design system                | 5      | 8     | the tint and edge strengths per color are calculated in slice 1  |
| 6, responsive and accessibility | 7      | 9     | wider screens are not reviewed                                   |
| 7, open decisions               |        |       | 3 decided, none deferred                                         |

Overall: 4 before (the lowest pass), 8 after. Decisions made: 17. Open: none. Mockups: none (refused by the image service).

### Review report

| Review        | Trigger               | Runs | Status              | Findings                        |
| ------------- | --------------------- | ---- | ------------------- | ------------------------------- |
| CEO review    | `/plan-ceo-review`    | 0    | (none)              | (none)                          |
| Outside       | Codex                 | 0    | skipped by the user | (none)                          |
| Eng review    | `/plan-eng-review`    | 0    | (none)              | (none)                          |
| Design review | `/plan-design-review` | 1    | clean               | score 4/10 → 8/10, 17 decisions |
| DX review     | `/plan-devex-review`  | 0    | (none)              | (none)                          |

- **Outside coverage**: none; the user chose to go without outside reviewers.
- **Verdict**: the design review is clear; the eng review has not run for this plan. It is the next step, for the motion's effect on the tests and the stores.

NO UNRESOLVED DECISIONS
