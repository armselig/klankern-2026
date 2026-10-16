# A more playful look: the plan

The problem of issue #9, what the palette allows, what the user decided, and how the work is tested and sliced. The design itself is in [`design.md`](./design.md); [`README.md`](./README.md) lists the folder's files.

## The problem and the plan (planned 2026-10-16)

The user found the app bland and dull, and the palette underused. Looked at in screenshots at 375px in both modes (dashboard, to-dos, shopping, meals, recipes, vacations, kids, whiteboard):

- Mauve is the only color. Every tile has the same mauve icon on the same grey card, and the tiles differ only by their heading.
- The corners are Quasar's 4px, and the cards stand out from the page only by a shadow, which in light mode is the page's own color.
- Nothing moves. Ticking a to-do off strikes it through at once; a new row appears and a removed one vanishes.
- The empty states are a grey line of text ("Nothing on the list yet.").

Catppuccin has fourteen accents. The app uses mauve for everything, red for errors, and the eight inks on the whiteboard and in the avatars.

### What the palette allows

Calculated with the WCAG formula from `@catppuccin/palette`, not measured by axe. A surface is a card; the page is what the roster, headings and list rows sit on.

- **Dark mode (Mocha)**: every accent is at 5.4:1 or more on a surface and 7:1 or more on the page. Color can carry icons, borders and states there without restriction.
- **Light mode (Latte)**: only mauve (4.79), red (4.80), blue (4.34) and teal (3.31) reach the 3:1 that WCAG 1.4.11 asks of a control's edge, a state or an icon that means something. Pink (2.34), yellow (2.31), sky (2.47), peach (2.64) and green (2.96) do not.
- **Text on a tint of an accent**: the text stays above 5.5:1 on a 14% tint in both modes. The muted text falls below 4.5:1 on several 14% tints over a Mocha surface (rosewater 3.86, yellow 3.87); on the page it holds. A tint behind muted text on a card stays at the 8% that `--theme-tint` has.
- **No accent is text in light mode**, apart from mauve and red as they are now. A shade of yellow or pink dark enough for 4.5:1 needs about 63% of Latte's text mixed in and is brown.

A decorative icon beside its text (a tile's icon is `aria-hidden` next to the heading) and a tint are exempt from 1.4.11, so the pastels can be used for those as they are.

### Decided with the user

- **One accent per feature**, used the same way on its dashboard tile, its page heading and its empty state: to-dos blue, shopping green, meals and the Tonight tile peach, recipes yellow, vacations teal, whiteboard pink, the household and the kids mauve. Where an ink of that color exists, the token is built on the same Catppuccin color as the ink.
- **A darker shade for light mode, mixed in.** Each feature color gets a "strong" variant: in Mocha the accent itself, in Latte the accent mixed with Latte's text in oklab until it reaches 3:1 on the page. By calculation that needs 0% for blue, teal and mauve, 5% for green, 16% for peach, 26% for pink and 27% for yellow. The hue stays Catppuccin's; the value no longer comes straight from the package, which is a change to "Colors come from the theme" in [`rules/conventions.md`](../../rules/conventions.md). The strong shade is for icons and edges, never for text.
- **The rule "never a colored edge on one side of a row or a card" stays.** Color comes from tints, a full edge around a card, colored icons and pen strokes under headings (the icon chips first planned here were dropped in the design review).
- **All four kinds of motion are in**: press feedback, ticking off, rows in and out, and small celebrations.

Checked for the shades: Lightning CSS, which minifies the production CSS, turns `light-dark(color-mix(in oklab, <literal>, <literal>), …)` into fixed values with a `lab()` variant under `@supports`. With `var()` inside it would leave `color-mix()` to the browser (Chrome 111, Safari 16.2). Decided in the eng review (see [`eng-review.md`](./eng-review.md)): the package's variables, mixed by the browser inside `@supports`, and outside it `--theme-outline` for an edge and the text color for an icon, both of which pass already.

The design that follows from these decisions is in [`design.md`](./design.md).

### What the tests need

- `a11y.e2e.ts` scans every page in both modes as now. While an element fades in, axe would measure a color halfway, so the suite runs with `reducedMotion: 'reduce'`; one test scans the dashboard and a list with motion on, after the animations have ended.
- The helpers that find rows don't see a leaving row: it is `inert`, and `listItems` and the other row helpers in `tests/support/e2e-ui.ts` exclude what is inside `[inert]` (decided in the eng review, see [`eng-review.md`](./eng-review.md)). A row's test id alone would not do: `listItems` finds the checkbox inside the row by its own id.
- A spec ticks an item off with motion on and checks that the row is still there, ticked, once the animation has ended.

### Slices

Each slice is released on its own; each is a `refactor` (a restyling of what exists). Screenshots at 375px in both modes before and after, and the a11y scan, are part of each. So are two more looks (decided in the design review), each with screenshots: one with Playwright's `forcedColors: 'active'`, where the browser drops the tints and draws edges in its own colors, so the Tonight tile has to lead by its edge alone; and one with the root font size at 200%, where the tiles' `min-height` must not cut off their content.

1. **Tokens and shape**: the feature tokens with their specs, the radii, the card edges. Nothing changes color yet beyond the edges. With it a new rule file for the look, named look.md in `docs/rules/` (decided in the design review), listed in `rules/README.md`: the bullets of `rules/conventions.md` on colors, contrast, tints, edges, hover and focus move there, and the feature colors, the strong shades, the radius scale and the rules for motion are added. `conventions.md` keeps the rest. Also the browser's own surfaces, from the theme (decided in the design review): `::selection` (the text on mauve at 20%, above 5:1 in both modes), `caret-color`, `scrollbar-color` and `accent-color`, so that no browser blue or grey is left.
2. **Color on the screens**: tiles with colored icons and pen strokes, page headings, empty states with their drawings.
3. **Motion**: press feedback, ticking off, rows in and out, with the test changes above.
4. **Celebrations**, with store specs for the tick's rollback when its save fails, which nothing tests yet (decided in the eng review, TODO-1).

### Not decided yet

- The line drawings of the empty states: what each of the five shows. Sketched at the start of slice 2, in both modes, and shown to the user before they are built (decided in the design review).
