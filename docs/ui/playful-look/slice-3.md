# A more playful look: slice 3

How slice 3 of issue #9, "motion", was built. The plan is in [`plan.md`](./plan.md), the design in [`design.md`](./design.md) and slice 2 in [`slice-2.md`](./slice-2.md); [`README.md`](./README.md) lists the folder's files. The rules that came out of it are in "Motion" in [`rules/look.md`](../../rules/look.md).

## Motion (built 2026-10-16)

Buttons and tiles give way when pressed, the rows of the to-do and the shopping list slide in and collapse, and the person's own tick springs and strikes its title through. Nothing was added to the data or the stores. Everything is inside `prefers-reduced-motion: no-preference`, hover inside `any-hover: hover`.

### What moves

- **Press feedback**: every `q-btn` scales to 0.97 while pressed (120ms), in `assets/css/motion.css`. A dashboard tile scales to 0.97 when its stretched link is pressed and lifts by 2px under a pointer (150ms, `DashboardTile.vue`). Both go by `:has(.dashboard-tile__link:…)`, so a button inside a tile (Tonight's) gives way on its own without the tile.
- **Rows in and out**: both lists render their rows in a `<transition-group name="list-row">` without a `tag`, so the rows stay the `q-list`'s own children: its separators (`.q-list--separator > .q-item-type + .q-item-type`) and the list's role stay as they were. A new row fades in from 0.5rem above (200ms). A leaving row is taken out of the flow (`position: absolute` on a `q-list` with `position: relative`) and fades while it shrinks towards its top; the rows below slide up into its place by the group's `-move` transform. So the to-dos have the `-move` transition too, which the eng review had named only for the shopping list (D8): without it a removed row's gap would close at once. A ticked shopping item slides to its place among the ticked ones the same way.
- **The tick**: the box overshoots once to 1.15 and back (200ms), the app's only bounce, and the strike-through is drawn across the title from left to right.

### The drawn strike-through (decided with the user)

A line drawn by `transform: scaleX()` is right only for a title on one line, and a longer to-do wraps at 375px. The user chose a background line instead: a `linear-gradient` on the title's inline span whose `background-size` grows from 0 to 100% (with `box-decoration-break: clone`, so every line of a wrapped title is struck). It only repaints and moves nothing; it is the one exception to "transforms and opacity only", written into the rule. For it the checkbox's label is now a `<span class="list-tick__title">` in the checkbox's slot instead of its `label` prop; the checkbox's accessible name is still the title.

The static state stays Quasar's `text-strike` (`text-decoration: line-through`): it holds in forced colors, which drop a gradient, and a tick that arrives by Realtime is struck at once. While the line is drawn the static line is off (`.list-tick--drawing.text-strike`); when the drawing's animation ends it takes over.

### Only the person's own tap

`useTickDrawing()` (`composables/use-tick-drawing.ts`) holds a flag per row. The row's checkbox handler sets it when the tap ticks (not when it unticks) and then emits the toggle; the `animationend` of the strike-through clears it, matched by the name `TICK_DRAWING_ANIMATION`. Nothing reads the item's `done` or `checked` for it, so a tick from another member's phone is never drawn. Under reduced motion the flag is set as well but changes nothing, since the styles that read it are inside `no-preference`.

### The leaving row and the tests

The group's `@before-leave` is `makeLeavingRowInert` (`utils/list-motion.ts`): a leaving row can't be pressed, focused or read out. It takes one argument: a hook that also takes `done` makes Vue wait for it, and under reduced motion the row would then stay instead of going at once.

As decided in the eng review (D2), the row keeps its test ids, and `listItems` in `tests/support/e2e-ui.ts` skips what is inside `[inert]`; `listItem` and the remove button's helper build on it. `design.md` said the row "loses its test id"; that line now names D2.

`playwright.config.ts` runs the suite with `reducedMotion: 'reduce'`.

### Quasar's own motion (decided with the user)

Quasar ignores the reader's preference for its own motion: the ripple of a pressed button or checkbox (225ms), the checkbox's fill (220ms) and its tick (180ms) ran under `prefers-reduced-motion: reduce` as well (read in `quasar.css`, whose only reduced-motion rule is for its `.animated` classes). The user chose to switch them off: `motion.css` hides `.q-ripple` and takes the checkbox's transitions away under `reduce`.

### Tests and screenshots

- `lists.e2e.ts`, "with motion on": removes a to-do and, while it leaves, finds it `inert` and not counted by `listItems`; ticks one and checks that its tick is drawn, that its accessible name is its title while and after the drawing, and that it ends ticked. A style tag lengthens the leave and the drawing to 3s, because Vue ends a leave by the computed duration as well as by its event. The counts are taken once, not retried: a retried `toHaveCount` passed even without the `[inert]` filter, since it waited until the row was gone. Verified to fail without the filter (3 counted instead of 2).
- `a11y.e2e.ts`: one test per mode with motion on scans the dashboard and the to-do list after the animations have ended.
- `use-tick-drawing.spec.ts`: the flag is set by a tick only, ended by the strike-through's animation only, and the animation's name is the one in `motion.css`.
- The `dev` project passed all 45 tests with `reducedMotion: 'reduce'` and no change to an existing spec but the `[inert]` filter. On the first run the last three (two in `vacations.e2e.ts`, one in `whiteboard.e2e.ts`) failed before they reached a list: the header never showed the signed-in account. Rerun alone, all three passed; the slice touches nothing on that path.
- Screenshots at 375px before and after, in light mode, dark mode, forced colors and with the root font at 200%: the dashboard, the to-dos and the shopping list, with a ticked item and a to-do whose title wraps. The lists are the same pixel for pixel; the dashboards differ only in the run's household name, the new user's avatar and the dev server's badge. A shot halfway through the drawing (slowed to 4s) shows the line drawn across both lines of the wrapped title at once, at the height of the static line-through that takes over.
- Checked in the browser after the commit, with motion on: a tile is lifted by 2px under the pointer and scaled to 0.97 while its link is pressed (read from the `.dashboard-tile` card, whose `:has()` rules match); a pressed button is at 0.97; a ticked shopping item and the rows it passes are under a transform while they slide (+35px and −71px partway). With reduced motion the ripple is hidden, and the checkbox's fill and tick no longer animate; what still animates on a tap is the checkbox's round hover and focus highlight (`.q-checkbox__inner:before`), a highlight like the veil, which the decision didn't cover.
- The test rules of the slice (the suite without motion, a count taken once, the `[inert]` helpers) are in "What the tests need" in [`rules/commands.md`](../../rules/commands.md).

Noticed, not changed:

- **When the last row leaves, the list's empty state shows at once**, under the fading row: it is outside the group, as the eng review planned. Not looked at in a screenshot.

- **Both lines of a wrapped title are struck at the same time**, each from its own left edge, since `box-decoration-break: clone` gives every line its own background. Drawn one after the other would need the line split per line box in script.
- **A Realtime tick is not checked against the drawing by a spec.** It can't set the flag, since nothing reads the item's state for it; the spec that a Realtime change doesn't set off a celebration is part of slice 4 (T7 of the design review).
