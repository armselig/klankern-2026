# Lists and live sync

The history of the to-do and shopping lists and their live sync, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Milestone 5: Realtime sync (done 2026-10-08)

- `0011_realtime_publication.sql` adds `todo_items` and `shopping_items` to `supabase_realtime` (applied to the cloud project).
- `utils/list-state.ts` (was `todo-state.ts` until milestone 6 made it generic): `applyListRealtimeEvent` (upsert by id so the echo of an optimistic add dedups; ignores other lists and everything before the list is loaded; nothing undoes a local soft delete) and `mergeListResync` (refetch result + items the fetch may predate + local tombstones; anything else missing from the fetch was deleted remotely and is dropped). Event shape is the app's own `ListRealtimeEvent<T>` (`types/list.ts`), not realtime-js types.
- `stores/todos.ts` (and `stores/shopping.ts`): `pendingIds` (wrapped around every server write via `withPending`), `applyRealtimeEvent`, `resync()` (no-op until `init()` has loaded the list). During a resync fetch, `utils/changes-during-fetch.ts` collects the ids of writes that finish and Realtime events that arrive; those keep their local version in the merge, like `pendingIds`.
- `composables/household-realtime.ts`: `subscribeToHouseholdChanges` — one channel per household, `postgres_changes` INSERT + UPDATE only (never DELETE: unfilterable and RLS-free; the app only soft-deletes), filter `household_id=eq.<id>`, `onSubscribed` on every `SUBSCRIBED` (first join and every automatic rejoin) → resync.
- `composables/use-household-realtime.ts`: `useHouseholdRealtime()`, called once in `layouts/default.vue`. Keyed on user **and** household id, because sign-out doesn't clear the household store. Every list adds its listeners to this same channel rather than opening a new one; every `SUBSCRIBED` resyncs every list's store.
- No `updated_at` trigger exists; don't use `updated_at` for ordering. Events of one item are ordered by the payload's `commit_timestamp` instead (since 2026-10-10, see "E2E gap review" in [`infra/testing.md`](../infra/testing.md)); between items, and on equal timestamps, the later arrival wins.

**E2E test** (`npm run test:e2e`, Playwright 1.64, uses the installed Google Chrome via `channel: 'chrome'`, reuses a running `nuxt dev` on :3000 or starts one): two disposable users in one household, two browser contexts. Covers add/toggle/delete arriving live, echo dedup, changes made while disconnected arriving after the reconnect, and the channel leave on sign-out. Verified to fail with the subscription removed and with the resync removed. Things learned building it:
- Login goes through the real form: the `auth/v1/otp` request is fulfilled in the browser (no email sent) and the code comes from `admin.auth.admin.generateLink({ type: 'magiclink' }).properties.email_otp`, which `verifyOtp({ type: 'email' })` accepts.
- Chrome's offline emulation (`context.setOffline`) does **not** close an open websocket. The drop is simulated with `context.routeWebSocket` (close the socket, refuse reconnects until "online").
- The session cookie is written a moment after the header already shows the user; a full page load in that gap starts signed out. `signIn` (`tests/support/e2e-ui.ts`) therefore waits for the `…-auth-token` cookie, after which `page.goto` is safe. Since 2026-10-10 it first waits for the home URL and for the email in the header (see "CI" in [`infra/ci.md`](../infra/ci.md)).
- Test files are `*.e2e.ts` so Vitest's `*.spec.ts` glob doesn't pick them up.

## Milestone 6: Shared shopping list (done 2026-10-08)

No migration needed: `shopping_lists`/`shopping_items` existed since 0003 and `shopping_items` was already in the Realtime publication (0011).

- First, the to-do reducers were made generic (`utils/list-state.ts`, `types/list.ts`: `ListItem`, `ItemsById<T>`, `ListRealtimeEvent<T>`), so the dedup/tombstone/resync rules exist once.
- `composables/shopping-actions.ts`, `stores/shopping.ts`, `components/shopping/{ShoppingList,ShoppingItem}.vue`, `pages/shopping.vue` (`ROUTES.shopping`, "Shopping" button on the dashboard) mirror the to-do layers. Differences: `checked` instead of `done`, and an optional free-text `quantity` (empty input → `null`), shown in the checkbox label as "Apples (6)" so screen readers announce it.
- **Checked items sink to the bottom** (`visibleShoppingItems` in `utils/shopping-state.ts`), each group in list order. Decided with the user; to-dos keep plain list order.
- A "remove all checked items" button was **deliberately left out** for now (user decision); add it if it's missed in practice.
- `subscribeToHouseholdChanges` has INSERT + UPDATE listeners for `shopping_items` on the household channel (`onShoppingItemChange`).
- E2E: second scenario (add with quantity, check → moves to the bottom, remove), verified to fail with the shopping listener disconnected. Reconnect isn't tested separately for shopping since it uses the same generic merge.

The fake Supabase query builder/client for the unit tests was first copied into `household-actions.spec.ts`, `todo-actions.spec.ts` and `shopping-actions.spec.ts`; since 2026-10-10 it is one shared helper, `tests/support/fake-supabase-client.ts`. New `*-actions.spec.ts` files import it from there.
