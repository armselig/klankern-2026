# Whiteboard

The history of the shared whiteboard, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Milestone 9: Shared whiteboard (built 2026-10-10)

One whiteboard per household at `ROUTES.whiteboard` ("Whiteboard" button on the dashboard): a pen in four colors and three widths, an eraser that removes whole strokes, "Undo" and "Clear board". Decided with the user: one board, a fixed 4:3 board without panning or zooming, and those three tools.

### Deviations from the plan

- **Rows and `postgres_changes`, not Realtime `broadcast`** (user decision). Every finished stroke is one `board_strokes` row and syncs like a list item, on the existing household channel. The volume is one row per stroke, not per point, and RLS stays the only security boundary. A broadcast channel would need `private: true` plus RLS policies on `realtime.messages`. The price: other members see a stroke when the pen lifts, not while it is drawn. A live preview over broadcast can be added on top.
- **SVG, not a `<canvas>`.** The surface is an `<svg>` with one `<polyline>` per stroke (a `<circle>` for a tap), rendered by Vue from store state. It scales by itself (`viewBox`), needs no redraw on resize or device-pixel-ratio handling, and the e2e test can read the strokes from the DOM.

**Schema** (`0012_whiteboard.sql`, applied to the cloud project)

- `boards`: one per household, enforced by `unique (household_id)` so two members opening the whiteboard for the first time at the same moment can't create two. Drop the constraint when several boards are wanted.
- `board_strokes`: `color`, `width`, `points` (jsonb), `created_by`, `deleted_at`, `household_id`. A composite foreign key `(board_id, household_id)` keeps the denormalized `household_id` equal to the board's.
- **Board units.** The board is 4000 × 3000 units on every screen; `points` is a flat integer array `[x0, y0, x1, y1, …]` and `width` is in the same units. Check constraints limit a stroke to 1000 points with coordinates 0–4000, the color to `#rrggbb` and the width to 1–200, because RLS can't limit how large a row a member inserts. The same numbers are in `utils/whiteboard-geometry.ts`.
- Policies are the uniform `is_household_member(household_id)` ones. Grants are narrower than for the lists: `authenticated` gets `select, insert` on `boards` and `select, insert, update` on `board_strokes`. There is no `delete`: the app only soft-deletes, and a hard delete would be invisible to the other members.
- `board_strokes` is in the `supabase_realtime` publication.

**Code**, in the usual layers

- `composables/whiteboard-actions.ts`: `fetchOrCreateBoard` (an insert that ignores the conflict, then a read), `fetchBoardStrokes`, `insertBoardStroke`, `softDeleteBoardStrokeRemote`, `softDeleteAllBoardStrokes`.
- `stores/whiteboard.ts`, parallel to the list stores (`pendingIds`, `resync()`, the three module-level helpers), plus `drawnIds` for undo.
- `utils/whiteboard-state.ts` holds only what differs from a list item; the store uses `upsertListItem`, `confirmListItem`, `softDeleteListItem` and `mergeListResync` from `utils/list-state.ts`. Those four are now typed over `SyncedRow` (`types/synced-row.ts`: `id`, `deleted_at`) instead of `ListItem`, with no change in behaviour.
- `utils/whiteboard-geometry.ts`: point thinning, the eraser's hit test, clamping to the board.
- `subscribeToHouseholdChanges` has INSERT + UPDATE listeners for `board_strokes` (`onBoardStrokeChange`); `useHouseholdRealtime` resyncs the whiteboard on every `SUBSCRIBED`; `useResetStoresOnUserChange` resets its store.

### Behaviour worth knowing

- **Realtime leaves `points` out of an UPDATE for a large stroke.** Postgres stores a large value out of line (TOAST) and doesn't put it in the change record when the update didn't touch it. Measured on the cloud project: the UPDATE of a 2-point stroke carries `points`, the UPDATE of a 1000-point stroke has no `points` key at all. The only update the app makes is a soft delete, so `applyStrokeRealtimeEvent` lays the event's row over the local one instead of replacing it (`BoardStrokeChange` in `types/whiteboard.ts` has `points` optional). The same would hit any future table with a large column.
- **Strokes are fetched in pages of 500, cut by id** (`.gt('id', lastId)`), not by offset: PostgREST returns at most 1000 rows per request, and a stroke erased between two requests would shift an offset. The fetch order doesn't matter; `visibleStrokes` sorts by `created_at`, parsed as a date because the client, PostgREST and Realtime each format it differently.
- **Undo** removes the member's own newest stroke that is still on the board. It only knows the strokes drawn since the page was loaded (`drawnIds` is in memory), and there is no redo: a redo would be an undelete, which the sync rules rule out.
- **Clear board** soft-deletes every stroke of the board in one UPDATE, selected by `board_id`, after a confirmation. It therefore also removes a stroke another member saved a moment earlier that this client hasn't seen. Every member gets one Realtime event per stroke.
- **A stroke that reaches 1000 points** is saved and the line continues in a new stroke.
- **Pointer input**: Pointer Events with pointer capture, `touch-action: none`, only the primary pointer. `pointercancel` discards the stroke in progress.
- **Accessibility**: the toolbar is three radio groups and two buttons. The surface is `role="img"` with the name "Whiteboard, N strokes"; the drawing itself has no text alternative, and drawing needs a pointer.
- Erased strokes stay as rows forever (soft delete); nothing purges them. The partial index `board_strokes_live_idx` keeps loading a board independent of their number.

### Tests

- Unit: `whiteboard-actions.spec.ts`, `whiteboard-state.spec.ts`, `whiteboard-geometry.spec.ts`, and the stroke listener in `household-realtime.spec.ts`.
- RLS (`household-isolation.spec.ts`): another household's board and strokes are invisible and can't be drawn on or erased; the composite key rejects a stroke on another household's board; no hard delete; one board per household; each check constraint.
- E2E (`whiteboard.e2e.ts`): two members; a stroke with its color, width and points arrives on the other; a tap makes a dot; undo; reload; the eraser on another member's stroke of several hundred points (the missing-`points` rule itself is guarded by the unit test, since an erased stroke is hidden either way); clear with its confirmation. It asserts on the surface's accessible name and the strokes' attributes, not on pixels. Verified to fail with the stroke listener disconnected. `a11y.e2e.ts` scans the page and `auth.e2e.ts` checks its auth guard.
- Not tested separately: a reconnect (same resync as the lists), and touch or pen input (the e2e test draws with the mouse).
- **Tried by hand by the user (2026-10-11)**: the whiteboard on a phone and with a second member. No automated test draws by touch.

### Found on the way

- A long-running `nuxt dev` did not pick up the new page file (`/whiteboard` answered 404) until the file was moved away and back.
- **The `pwa` project failed once in the working tree** (all 4 tests, blank page): the HTML in `dist` referenced `/_nuxt/*.js` files that the same build had not written. A fresh copy of the same tree built correctly and passed all 4. Not explained then: Playwright always runs `nuxt dev` and the production build side by side, in CI too, so that alone is not the cause. Explained and fixed on 2026-10-11, see "The `pwa` e2e project and a leftover `.output`" in [`infra/testing.md`](../infra/testing.md).
- `dragOnWhiteboard` (`tests/support/e2e-ui.ts`) scrolls the board into view first: Playwright's mouse doesn't scroll, and a position under the fixed footer hits the footer.

**Noticed, not changed** (the lists):

- `fetchOrCreateTodoList` and `fetchOrCreateShoppingList` have the race the board's unique constraint prevents: two simultaneous first visits create two lists, after which `.maybeSingle()` fails for that household. Fixed with milestone 10 (see there).
- `fetchTodoItems` and `fetchShoppingItems` are not paged, so a list with more than 1000 live items would be cut off.
