# Vacation planner: the rendered screens

The screens of the reviewed design as they were rendered and approved, and what the rendering showed for the build. They were split from [`features/vacations-design-review.md`](./vacations-design-review.md) on 2026-10-13, when that file had grown past the size at which a topic file is split, without a change beyond the two references back to it. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Screens rendered and approved (2026-10-13)

The design review judged the screens from text, see "Not verified" under "Design review" in [`features/vacations-design-review.md`](./vacations-design-review.md). On 2026-10-12, after the reviews, the reviewed design was drawn as 17 screens at a width of 375 px, each in light and in dark mode: the vacation's page before, during and after the trip and as slice 1 ships it, the row's menu and editing, "Give to…", "Only my tasks", "Ready to go", editing a vacation, the reject dialog, arrival through a link, the dashboard and the tile's states, the list with and without vacations, "not found" and the meals. They are one HTML page on Quasar's stylesheet and the app's `theme.css`, with the header and the dashboard's tile copied from the app, rendered with the repository's Playwright. They are not in the repository.

The user approved them on 2026-10-13 without a change. They take the wireframe's place as the picture the build follows.

### What the rendering showed

- Quasar's button is 36 px high and its tick box 40 px. The 44 px of "Access rules" in the design review therefore need a minimum of their own on every control of the feature. With it, the script that rendered the screens found no control below 44 px.
- Quasar writes a button's text in capitals. The screens show the buttons that way, except the control that folds a phase.
- A page's padding is 8 px on a phone.
- A row is 53 px high without a second line, about 97 px with a person, and about 142 px with a rejection's reason or with the "Tell them" line.
- "I'll take it" and "Give to…" fit on one line: they take 207 of the 301 px there.
- No screen scrolls sideways.

### What the rendering does not show

- The screens are pictures of a hand-written page, not of the app's components, so the build can still differ from them.
