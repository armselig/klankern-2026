# Dashboard

The history of the dashboard, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Dashboard with live tiles (built 2026-10-11)

The dashboard was one card in the middle of the screen: the household's name, the roster and four identical buttons that said nothing about what was behind them. Now the name and the roster stand at the top, and below them are four tiles, two by two, each showing what its page holds. On the reference phone all of it is on one screen.

- **What a tile shows.** To-dos: how many are open and the first of them. Shopping: the same for what is still to buy. Recipes: how many there are and the first by title. Whiteboard: the board itself, small. `utils/list-preview.ts` cuts a list to a tile's four lines; a longer list gives its last line to "and N more", so a tile never says "and 1 more" where the entry would have fitted. An empty tile says so in words ("Nothing to do.") instead of a zero.
- **The dashboard loads all four stores**, where it loaded none. The to-do, shopping and whiteboard stores got a `load()` like the recipe store's: the first call fetches behind a spinner (`init()`, which only `load()` calls now), later ones merge in the background. `TodoList`, `ShoppingList` and `SharedWhiteboard` call it too, so a page opened from the dashboard is there at once. A call during the first fetch waits for that fetch; `ensureLoaded()` of the shopping store depends on it, because a recipe page can ask for the list while the dashboard's fetch is still running.
- **`init()` drops its result after a reset.** "Noticed, not changed" under "Milestone 10" in [`features/recipes.md`](recipes.md) listed that the list stores kept the result of a fetch that ended after a change of user. With every sign-in starting four fetches that mattered more, so `init()` of the three stores now checks that the store still belongs to the household it fetched for.
- **The cost.** Every visit to the dashboard fetches every stroke with its points, and so does every reconnect from the first visit on, where both happened only once the whiteboard had been opened. Accepted for a preview that is live.
- **The link of a tile is its heading's text**, stretched over the card with `::after`. A link around the whole tile would be named by everything in it ("To-dos 3 open Call the plumber ..."), which is a poor name and would have broken `openRecipes`, which asks for the exact name. The helpers in `tests/support/e2e-ui.ts` that open a page from the dashboard are unchanged. The tiles are a list in a `nav`.
- **Hover and focus are an outline.** The theme's veil for a surface is calibrated for the text color; under it the muted text of a tile is at 3.77:1 in light mode and 3.58:1 in dark mode. The outlines are at 3.49:1 or more against what is behind them.
- **"Invite" on the roster**, as the place where the next member would stand: a dashed circle with a plus. It is beside the list of members, not in it (`avatars.e2e.ts` asserts the list's items, and it is no member), and it is named "Invite", not "Invite a family member": that is the account menu's entry, which stays, and the tests find it by that name with the menu open. The dashboard has an `<invite-dialog>` of its own. Quasar's dialog gives the focus back to the button itself here, because the button is still there when the dialog closes; the account menu has to do that by hand.
- **No spinner on a return visit.** `fetchMine()` still runs on every visit, but the spinner only shows while there is no household to show, so the tiles of a household that is known stay on screen.
- **The preview draws no stroke thinner than 48 board units** (`utils/whiteboard-preview.ts`): the thin pen's 16 units would be half a pixel at a tile's width.

### Tests

- Unit: `list-preview.spec.ts`, `whiteboard-preview.spec.ts`.
- `dashboard.e2e.ts`, with two members: A stays on the dashboard while B adds a to-do and checks it, adds five shopping items, draws a stroke and saves a recipe; A's tiles follow each change. Then the roster's button with the keyboard, and a tile pressed away from its link.
- `a11y.e2e.ts`: the scan of a highlighted filled button used the dashboard's buttons, which are gone; it now uses "Add" on the to-do page. New: a tile hovered and focused, and the dashboard with filled tiles, both in both modes.
- `session-switch.e2e.ts`: the second user's tiles show nothing of the first user's lists.
- `untilFadesEnd` of `a11y.e2e.ts` looked for running fades once, right after the account menu appeared. A fade starts a frame or two after its element is in the page, so the look could come too early; on the fuller dashboard it did, and the menu was scanned half faded in (seen in the trace's frames, light mode, once in one run). It now waits until the page has been still for three frames in a row.

### Not done

- A layout for wide screens: the dashboard stays one column of 480px.
- Nobody has used it on a phone by touch yet.
