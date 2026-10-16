# A more playful look: the design

What the screens look like and how they move. Why, and what the palette allows, is in [`plan.md`](./plan.md); the decisions of the design review are in [`design-review.md`](./design-review.md).

## The design (planned 2026-10-16)

**Tokens** (`assets/css/theme.css`), one set per feature, as `light-dark()` like every token:

- `--feature-<name>`: the accent, for the pen stroke under a tile's heading and for tints.
- `--feature-<name>-strong`: the shade at 3:1 or more on page and surface, for icons and edges that carry meaning.
- `--feature-<name>-tint`: the accent at a strength that keeps the text and the muted text above 4.5:1 on the page and on a surface, calculated per color.

A unit spec in the manner of `ink.spec.ts` checks that every feature has all three and that each is a `light-dark()`. A second one calculates the contrast of each pair from the package's values, so a changed shade fails a test, not a person.

**Shape**:

- Rounder corners, on a scale by size (decided in the design review), in `rem` so that they grow with the reader's text size: `--radius-field` 0.5rem (fields), `--radius-control` 0.625rem (buttons), `--radius-menu` 0.75rem (menus, tooltips, notices), `--radius-card` 1rem (cards and tiles), `--radius-dialog` 1.25rem (dialogs). That is 8, 10, 12, 16 and 20px at the default text size. Avatars, the round buttons and the tick stay round. The bigger a thing, the rounder; one large radius on everything is a mark of generated UI. Applied by overrides of Quasar's components in `theme.css` (decided in the eng review): the app loads Quasar's precompiled CSS, and its Sass variables would need Sass in the build.
- A card has a 1px edge all around and no shadow (decided in the design review): in light mode the edge is what sets a card off from the page, which has the same color, and an edge with Quasar's shadow around it is the "thin border plus wide shadow" of generated UI. A card that is not a feature's has its edge in `--theme-separator`. What floats above the page keeps a shadow with an offset: dialogs (their content is a `q-card` too, so the rule exempts a card inside `.q-dialog`), menus and notices. A shadow then means "above the page", and an edge means "a card". A tile's edge is its feature's strong shade at low strength; its hover outline (now `--theme-outline`) becomes the strong shade at full strength, so the 3:1 holds where it means something.
- **No icon chip** (decided in the design review): an icon on a tinted circle above or beside every heading is the most common look of generated dashboards, and it would make the app look like a starter template. Instead the tile's heading gets the wordmark's pen stroke under it, in the feature's color, and the icon is drawn in the feature's strong shade (3:1 or more, so it would hold even if it carried meaning). The stroke is the same `<path>` style as the wordmark's (round caps, `non-scaling-stroke`), drawn in a few variants so seven tiles don't show seven identical squiggles; it is `aria-hidden` and lies under the heading's text, never through it.

**Color per screen**:

- Dashboard: the Tonight tile leads (decided in the design review, see [`design-review.md`](./design-review.md)). It is the one tile that asks for a decision today, so it is the one with color over its whole surface: peach behind it, at 6% in light mode and 8% in dark mode, and an edge in peach's strong shade at full strength. Light mode has the weaker tint because of the flat buttons ("Another one", "Fill my week"): hovered or focused, under `--theme-veil-on-surface`, their text is at 4.48:1 on peach at 8% and at 4.56:1 at 6% (decided in the design review). On the tint the text is at 6.64:1 (light, 6%) and 7.35:1 (dark, 8%), the muted text at 5.20:1 and 4.77:1, and a hovered flat button at 4.56:1 and 4.79:1. Mauve as text would be at 4.50:1 in light mode, with no margin, so the tile's only mauve is the filled "Plan this" button, on its own background. The dashboard page sets the lead look itself, as a class on the Tonight tile beside the one that makes it span the row, and only while the tile is neither loading nor failed (decided in the eng review). The tint is faint in light mode (1.06:1 against the page); the edge, the stroke and the icon carry the color there. The other tiles keep the surface's color, with their icon in the strong shade, the stroke under the heading and a faint edge in their feature's color: the color says which feature, not "look here". The headings stay in the text's color, and so do the counts.

```text
┌────────────────────────────────────┐  ← Tonight: peach tint (6%/8%),
│ ✦ Tonight                          │    full peach edge, spans the row
│ Lentil soup                        │
│ [ Plan this ]                      │
│ 3 dinners not planned this week    │
└────────────────────────────────────┘
┌────────────────┐ ┌────────────────┐  ← others: surface color,
│ ✦ To-dos       │ │ ✦ Shopping     │    icon in strong shade,
│ 3 open         │ │ 5 to buy       │    faint feature edge
└────────────────┘ └────────────────┘
```

- The whiteboard's page has its pink only on the heading's icon; the board keeps a neutral edge in `--theme-separator` (decided in the design review), since the drawing is what is on the board, in eight inks, pink among them, and a pink frame would compete with it.
- A feature's page: its heading has the feature's icon before it, in the strong shade, the same icon as on the tile, so that the page and its tile are recognisably one. No pen stroke under it (decided in the design review): a page's heading is not a link, and "text that is not a link has no underline" (now in [`rules/look.md`](../../rules/look.md)) holds; a stroke under it would look like something to press. The stroke stays on the dashboard, under headings that are links.
- Empty states (decided in the design review): a small line drawing in the feature's colors (inline SVG, `aria-hidden`) above the text that is there now, on the pages that have an empty state: to-dos, shopping, recipes, vacations and kids. `/meals` has none (an open day shows "Add dinner"). Drawn in the single pen stroke of the wordmark's underline (round caps, `non-scaling-stroke`), so it reads as the app's own hand and not as a stock illustration. The empty tiles on the dashboard stay text: seven drawings on a new household's dashboard would make a sticker sheet of it. The text stays and stays what is read.
- The primary color stays mauve: filled buttons, the header and focus outlines don't change color per feature. Only mauve and red carry Latte's base as text.

**States** (from the design review). What a person sees; what isn't named stays as it is now.

| Where            | Loading                                | Empty                                         | Error                                                 | Success                                                             |
| ---------------- | -------------------------------------- | --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Tonight tile     | surface color, no tint, mauve spinner  | the headline it shows now, on the tint        | surface color, no tint; the shared red line at 4.80:1 | the tint and the peach edge                                         |
| Other tiles      | as now, icon and stroke, mauve spinner | icon, stroke and the line of text, no drawing | icon, stroke and the shared red line, as now          | icon, stroke, faint edge, counts                                    |
| List pages       | as now, mauve spinner                  | pen-stroke drawing above the text             | red line under the list, as now                       | own tick springs; row slides in or collapses                        |
| Last item ticked | (none)                                 | (none)                                        | (none)                                                | celebration if the person's own tap ticked it; the ticked rows stay |
| Notices (toasts) | (none)                                 | (none)                                        | unchanged                                             | unchanged: mauve with `on-accent` text                              |

The Tonight tile only shows its tint once it has content (decided in the design review): Latte's red as text is at 4.51:1 on peach at 6%, too close to 4.5:1 to rely on (4.42:1 at 8%), and a tile that is loading or failed offers no decision for tonight. The spinners stay mauve; a spinner in a feature's color would make loading look like seven different things.

**A day with the app** (from the design review): what a person does, what they should feel, and what in this plan carries it.

| Step | The person                                    | Should feel                       | Carried by                                                                                |
| ---- | --------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | Opens the app at 17:30                        | "I know what's up" at a glance    | Tonight leads with its tint; the other tiles' colored icons and strokes name the features |
| 2    | Presses "Plan this"                           | Done, settled                     | Press feedback; what the tile shows next is unchanged                                     |
| 3    | Opens Shopping from its tile                  | Same place, one step further      | The green of the tile, again at the page's heading                                        |
| 4    | Ticks items in the shop, one hand on the cart | Each tick registered              | The tick's spring and the drawn strike-through, 44px targets                              |
| 5    | Ticks the last item                           | A small "done!"                   | The celebration, under a second, once                                                     |
| 6    | A partner adds "Bread" at home                | Notices without being interrupted | The row slides in; no celebration, no sound                                               |
| 7    | Opens an empty list                           | Welcome, not "broken"             | The pen-stroke drawing above the text                                                     |

Over months: the colors are what stays; they help find a feature without reading. The celebration is short and comes only at the end of a list, so it stays a reward and doesn't become noise.

**Motion.** Every animation is inside `@media (prefers-reduced-motion: no-preference)`, every hover effect inside `@media (any-hover: hover)`, as the wordmark and the tiles already do it. Nothing loops and nothing starts without the person doing something. Durations 120–250ms, transforms and opacity only, so nothing shifts the layout. The curve is an ease-out everywhere (fast start, soft landing, from a visible default) but for the one exception below.

- **Press feedback**: tiles and buttons scale to 0.97 while pressed; a tile lifts by 2px on hover with a pointer.
- **Ticking off**: the checkbox's tick overshoots once, to a scale of about 1.15 and back in 200ms, and the strike-through is drawn across the title from left to right. The overshoot is the app's only bounce, on purpose (decided in the design review): a bounce on rows, tiles or pages is a mark of generated UI and wears out in daily use; on the person's own tick it is the moment of finishing something. A to-do's row stays where it is, as now. A shopping item moves to the end of the list when it is ticked (`visibleShoppingItems` sorts the checked ones last), and its row now slides there in 200ms, transform only, instant under reduced motion; the celebration is placed from where the checkbox was at the tap (decided in the eng review).
- **Rows in and out**: a new row slides in and a removed row collapses (`<transition-group>` on the lists). A leaving row gets `inert` when it starts to leave, so it is neither read nor clicked nor counted while it fades. (Changed in the eng review: the row keeps its test id, and the e2e helpers skip what is inside `[inert]`; see D2 in [`eng-review.md`](./eng-review.md).)
- **Whose change moves what** (decided in the design review): rows slide in and collapse for every change, also one that comes from another member's phone, since that tells the reader something just changed. The tick's spring and the celebrations answer only the person's own tap: they are started from the tap's handler in the component, not from the store's state, so a change that arrives by Realtime never sets one off. On another phone a ticked item is struck through at once, as now.
- **Small celebrations**: a flourish of under a second when the person's own tap ticks the last open item of the to-do or the shopping list, and when "Fill my week" has filled the week, which is once its save has resolved with every proposed dinner saved; a partial save shows only its notice (decided in the eng review): five to seven short pen strokes, the wordmark's stroke in the feature's color, burst from the control the person pressed (the ticked checkbox) and fade in about 600ms (decided in the design review). They stay near the thumb, cover no other row and shift nothing; no confetti over the screen and no library for it. `aria-hidden`, no sound, nothing that flashes (WCAG 2.3.1). Not when a list becomes empty (decided in the design review): the app has no "clear" action, a ticked row stays until someone removes it, and the moment a person finishes is the last tick, not the tidying after it. The check and the limit are a pure `ticksLastOpen(open, id)` in `utils/list-state.ts` and a composable `useCelebration(key)`, which the lists call before `toggle` (decided in the eng review). At most once a minute per list, so unticking and ticking the last item again doesn't repeat it. It says nothing new; the ticked rows do.
