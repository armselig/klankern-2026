# A more playful look: slice 2

How slice 2 of issue #9, "color on the screens", was built. The plan is in [`plan.md`](./plan.md), the design in [`design.md`](./design.md) and slice 1 in [`slice-1.md`](./slice-1.md); [`README.md`](./README.md) lists the folder's files. The rules that came out of it are in [`rules/look.md`](../../rules/look.md).

## Color on the screens (built 2026-10-16)

The feature tokens of slice 1 are now on the screens: the dashboard's tiles, the page headings and the empty states. Nothing was added to the data or the stores.

### The drawings were decided first

The user approved the five empty-state drawings at the start of the slice (decision 16 of the design review, see [`design-review.md`](./design-review.md)):

- to-dos: a notepad with empty boxes and a pencil;
- shopping: an empty bag with two leaves;
- recipes: a steaming pot;
- vacations: a suitcase and a sun;
- kids: a kite.

The main lines are in the feature's strong shade, with the text color as the fallback for a browser without `color-mix()`; the details are in the accent. The drawing is `components/ui/EmptyState.vue`: inline SVG, `aria-hidden`, a 120×96 box sized in `em`, so it grows with the text. The caller's text element keeps its test id. It is on the to-dos, the shopping list (inside the bordered list's empty row), the recipes, the vacations and the kids.

Forced colors leave an SVG's strokes alone in Chrome, so the drawings would keep their theme colors on a system background. They name `CanvasText` for forced colors.

### The shared pieces

- **`utils/features.ts`** holds `FEATURE_ICONS` and `featureColors(feature)`. The icons are keyed by the token name (meals is shared by the Tonight tile; the household is the kids' page, with `mdiHumanChild`). `featureColors()` sets `--feature-accent`, `-tint`, `-edge`, `-icon` and `-outline` on a component, so a component asks for a feature once and does not write token names. The strong shade's two fallbacks, the text color for an icon and the outline color for an edge, are named there, in one place, not at every use as in slice 1. `features.spec.ts` checks that the keys equal the features in `theme.css`, that every token named exists, and that the fallbacks are there.
- **`PenStroke.vue`** is the wordmark's stroke, now a component with four variants; the wordmark uses variant 0. A tile picks a variant by the feature's index, so the tiles' strokes differ a little.
- **`PageHeading.vue`** is an `h2` with the feature's icon in the strong shade and no stroke. Its attributes pass through, so the id, test id and class of the heading stay. It is on the to-dos, shopping, recipes, vacations, whiteboard, the kids (`KidRecords`) and `/meals` (the week's heading and the three headings of the trip view).
- **`DashboardTile`** takes `feature` instead of `icon`: the icon in the strong shade, the stroke under the heading in the accent, a faint edge in the feature's color, and on hover an outline in the strong shade (the outline color as the fallback).

### The edge token

Slice 1's cards have a `--theme-separator` edge. The feature edge is `--feature-<name>-edge` in `theme.css`: the accent at the least alpha, in steps of 5%, that stands out from the page and from a surface as much as `--theme-separator` does, calculated per ground, and below 3:1 so that the edge stays faint.

| Feature    | Light | Dark |
| ---------- | ----- | ---- |
| to-dos     | 25%   | 45%  |
| shopping   | 30%   | 40%  |
| meals      | 30%   | 45%  |
| recipes    | 35%   | 35%  |
| vacations  | 25%   | 40%  |
| whiteboard | 35%   | 40%  |
| household  | 20%   | 45%  |

`theme-tokens.spec.ts` checks, for each feature, the same hue as its other tokens, at least the separator's stand-out on each ground, that a step weaker would fall below it on some ground, and that the edge is below 3:1.

The `.q-card` rule in `theme.css` takes its edge from `--card-edge` and `--card-edge-width` (falling back to the separator and 1px). A feature's card sets the two properties and does not have to fight the rule's specificity.

### Two details that were not obvious

- **The tile's stroke lies in a positioned span inside the link, not on the link.** Giving the link `position: relative` would shrink its stretched `::after` to the heading's text, and the tile would no longer press as a whole. In forced colors the tile's stroke is `LinkText`.
- **The Tonight tile leads** (D7 of the eng review). `pages/index.vue` sets `dashboard__tile--lead` beside `--wide` only while the tile is neither loading nor failed. Its peach tint is a `background-image` gradient over the surface, because the tint is translucent and its contrast was calculated over the surface. Its edge is the strong shade at 2px, so it still leads in forced colors, where the tint is dropped (seen in the screenshot as a thicker black edge); the padding is 13px instead of 14px so the content does not move.

The whiteboard's board now has its edge in `--theme-separator` (decision 14 of the design review); the dashboard's preview of it keeps `--theme-outline`.

### Tests and screenshots

- `a11y.e2e.ts` got the third step of D9 of the eng review, "the pen strokes leave the links as they were": the wordmark's stroke spans the word (the link's width minus 16px), and `elementFromPoint` in a tile's lower-right corner is still the tile's link. Verified to fail with `position: relative` on the tile's link. The scans passed in both modes.
- Screenshots at 375px before and after, in light mode, dark mode, forced colors and with the root font at 200%: the dashboard, the to-dos, the shopping list, `/meals`, the recipes, the vacations, the kids and the whiteboard, and the empty lists. In forced colors the Tonight tile leads by its 2px edge, and the drawings and icons are in system colors. At 200% the tiles' icons stay 24px.

Noticed, not changed:

- **At 200% text the long tile headings still run to the tile's edge**, as noted in "Tokens and shape" in [`slice-1.md`](./slice-1.md).
- **Two links are in the browser's link blue**, against the link rule of [`rules/look.md`](../../rules/look.md): "What the kids refused" on the dashboard and "the dashboard" on the kids' page. Both were so before the slice.
