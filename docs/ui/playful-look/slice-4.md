# A more playful look: slice 4

How slice 4 of issue #9, "celebrations", was built. The plan is in [`plan.md`](./plan.md), the design in [`design.md`](./design.md) and slice 3 in [`slice-3.md`](./slice-3.md); [`README.md`](./README.md) lists the folder's files. The rules that came out of it are in "Motion" in [`rules/look.md`](../../rules/look.md).

## Celebrations (built 2026-10-16)

When the person's own tap finishes a list, a small burst of pen strokes flies from the box they ticked. Nothing was added to the data, and the stores are unchanged.

### What celebrates

- The person's own tick of the **last open to-do**, and of the **last item to buy**.
- The person's own tick of the **last open task of a vacation's phase**. Decided with the user: per phase, since "Before" is its own moment. The limit of once a minute is per trip (the key is the vacation's id), so ticking off "Before" and then "During" within the minute celebrates once. When "Who has what" filters the view, the phase's open tasks are still all of them, so a filtered view celebrates when the phase is finished, not when the shown part is. The user was asked whether vacation tasks belong to the plan's scope, and added them.
- **"Plan these" in Fill my week**, when every dinner was saved (`!notice.failed`, D6 of the eng review). A partial save plays nothing.

Not a celebration: a tick from another member's phone, an untick, or a tick that leaves something open.

### Reduced motion (decided with the user)

Nothing is shown. The burst is nothing but motion, so `.celebration-burst` is `display: none` outside `prefers-reduced-motion: no-preference`; a reader who asked for less motion gets no stand-in.

### The burst

- Six `PenStroke`s (variants 0 to 5) at 15°, 75°, … 315°, turned off the vertical so that none points straight at the next row. They travel from 0.5rem to 1.125rem out and fade, in 600ms ease-out. It is the one animation longer than 250ms, written into the rule.
- Every second stroke is in the accent, the others in the strong shade (`--feature-icon`); in forced colors all are `CanvasText`. The feature's colors come from `featureColors()`: to-dos, shopping, meals and vacations.
- The layer is a fixed element teleported to the body, 3.5rem square and centred on the box, with no pointer. Teleported, because a ticked shopping item slides away at once and a transformed row would carry a fixed child with it; no pointer, so a quick second tap reaches the checkbox under it.
- It was first built 0×0 (the strokes positioned out of an empty box). Playwright counts an element with an empty box as hidden, so the e2e test that looked for it failed. The layer got a size.

### Placement and timing

- Each item component emits `toggle(id, box)`. The box is the rect of Quasar's `.q-checkbox__inner`, from `tickBoxRect()` (`utils/list-motion.ts`), read at the tap before the row moves. `MealFillBar` emits `save(rect)`, read at the press, since the button is gone once the week is planned.
- The lists' handlers call `ticksLastOpen(open or toBuy, id)` (`utils/list-state.ts`) before the store's toggle, because afterwards the item is no longer open.
- `useCelebration(key)` (`composables/use-celebration.ts`) keeps the last time per key at module level for the session; a reload resets it. It also holds the burst (x, y, id) and ends it after `CELEBRATION_BURST_MS` = 700 by a timer, not by `animationend`: under reduced motion the burst is not displayed and no animation ever ends.

### Tests

- `list-state.spec.ts`: four cases of `ticksLastOpen`. `use-celebration.spec.ts`: five cases with fake timers.
- `todos.spec.ts` and `shopping.spec.ts` (TODO-1 of the eng review, E7): the tick is shown at once, and a failed tick and a failed untick roll back and report the error; three cases each.
- `lists.e2e.ts`, "ticking the last open to-do celebrates, once a minute", with motion on. `realtime-sync.e2e.ts`: the to-do test now runs with motion on in both contexts, and B's tick of the last item bursts on B and not on A (counted once as the tick arrives). `vacations.e2e.ts`: A ticks the four "Afterwards" tasks, only the last bursts, and not on B. `meal-fill.e2e.ts`: the full save bursts once, with motion turned on by `page.emulateMedia({ reducedMotion: 'no-preference' })` before the press.
- All 13 tests of `lists`, `realtime-sync` and `vacations` and the `meal-fill` spec passed; 868 unit tests passed (that run's count).
- Screenshots at 375px with the burst frozen at 220ms: the to-dos and the shopping list in light mode, dark mode, forced colors and at 200% text. At 200% text the strokes reach beyond the row and, from a box near the screen's edge, past the left edge. In forced colors they are drawn in the text's color.

Not covered: **no e2e test of a partial week save.** The eng review's diagram marked it tested, but `meal-fill.e2e.ts` has no partial case; the path is `if (!notice.failed)` and is only read, not run.

Noticed, not changed: **a different user who signs in on the same device within the minute shares the per-list time**, since it is kept at module level and not reset with the stores. The effect is a missing burst, once.
