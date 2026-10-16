# A more playful look

Issue #9, "playful colours and design elements": making the app more colorful and playful without making it less usable or less accessible. The theme it builds on is in [`theme-and-contrast.md`](../theme-and-contrast.md); [`docs/README.md`](../../README.md) lists the other topic files.

Read the files in this order:

- [`plan.md`](./plan.md): the problem, what the palette allows by contrast, what the user decided, the tests and the four slices.
- [`design.md`](./design.md): the tokens, the shapes, the colors per screen, the states, a day with the app, and the motion.
- [`design-review.md`](./design-review.md): the design review of 2026-10-16, its seventeen decisions, the implementation tasks and the scores.
- [`eng-review.md`](./eng-review.md): the eng review of 2026-10-16: its findings by section, the tests each change needs, the failure modes, the implementation tasks E1–E8 and the report.
- [`slice-1.md`](./slice-1.md): slice 1, tokens and shape (built 2026-10-16): the feature tokens and how their strengths were calculated, the darker strong shades, the radius scale, the cards' edges, the browser's surfaces, and the tests and screenshots.
- [`slice-2.md`](./slice-2.md): slice 2, color on the screens (built 2026-10-16): the five empty-state drawings, the shared pieces (`features.ts`, the pen stroke, the page heading, the empty state), the feature edge tokens and their strengths, the Tonight tile's lead, and the tests and screenshots.
- [`slice-3.md`](./slice-3.md): slice 3, motion (built 2026-10-16): press feedback, rows sliding in and collapsing in a tagless `<transition-group>`, the tick's overshoot and the strike-through drawn as a background line, the leaving row made `inert`, Quasar's own motion switched off under reduced motion, the tests with motion on, and the tick brought to a vacation's tasks and a recipe's ingredients.
- [`slice-4.md`](./slice-4.md): slice 4, celebrations (built 2026-10-16): what celebrates and why per phase for a vacation, nothing shown under reduced motion, the burst of six pen strokes, how it is placed from the tick box's rect and limited to once a minute, and the tests.
- [`eng-review-ledger.md`](./eng-review-ledger.md) and [`eng-review-ledger-2.md`](./eng-review-ledger-2.md): the eng review's eight decisions, R1 to R4 and R5 to R8, each with its evidence, the options compared and the question as it was asked.

New material goes into a new file here, listed above: how each slice was built goes into a file of its own (`slice-1.md`, `slice-2.md` …).
