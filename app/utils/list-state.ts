import type { ItemsById, ListItem, ListRealtimeEvent } from "~/types/list";
import type { SyncedRow } from "~/types/synced-row";

// The reducers typed over SyncedRow need only a row's id and deleted_at, so
// they also serve rows that are not list items (whiteboard strokes).

/**
 * Keyed by client-generated UUID (set at optimistic-insert time): the
 * server-confirmed row -- and later, the Realtime echo of the same INSERT --
 * upserts under the same id instead of appending a duplicate.
 */
export function upsertListItem<T extends SyncedRow>(
  itemsById: ItemsById<T>,
  item: T,
): ItemsById<T> {
  return { ...itemsById, [item.id]: item };
}

/**
 * Folds the server-confirmed row of an optimistic add into state. A check or
 * remove made while the add was saving has changed the local item since its
 * optimistic version: those fields keep the local value, the rest (server
 * timestamps) comes from the confirmed row. Nothing is added back when the
 * item is no longer in state at all (e.g. the stores were reset).
 */
export function confirmListItem<T extends SyncedRow>(
  itemsById: ItemsById<T>,
  optimistic: T,
  confirmed: T,
): ItemsById<T> {
  const local = itemsById[confirmed.id];
  if (!local) return itemsById;
  const merged = { ...confirmed };
  for (const key of Object.keys(local) as (keyof T)[]) {
    if (local[key] !== optimistic[key]) merged[key] = local[key];
  }
  return upsertListItem(itemsById, merged);
}

/** Deletes are soft (deleted_at set) rather than removed from state, so an
 * out-of-order confirmation/Realtime event can't resurrect a deleted item. */
export function softDeleteListItem<T extends SyncedRow>(
  itemsById: ItemsById<T>,
  id: string,
): ItemsById<T> {
  const existing = itemsById[id];
  if (!existing) return itemsById;
  return {
    ...itemsById,
    [id]: { ...existing, deleted_at: new Date().toISOString() },
  };
}

/**
 * Folds a Realtime change into local state. Upserting by id makes the echo of
 * our own optimistic add a no-op. Events that arrive out of commit order are
 * the caller's to drop (see createRealtimeEventOrder); here the event given
 * wins -- except that nothing may undo a local soft delete, since the app has
 * no undelete and an event from before the delete would otherwise bring the
 * item back.
 */
export function applyListRealtimeEvent<T extends ListItem>(
  itemsById: ItemsById<T>,
  event: ListRealtimeEvent<T>,
  listId: string | null,
): ItemsById<T> {
  const incoming = event.new;
  if (!listId || incoming.list_id !== listId) return itemsById;
  if (itemsById[incoming.id]?.deleted_at && !incoming.deleted_at)
    return itemsById;
  return upsertListItem(itemsById, incoming);
}

/**
 * Rebuilds state after a (re)connect, since Realtime doesn't replay events
 * missed while offline. The fetch excludes deleted rows, so an item missing
 * from it was deleted remotely and is dropped. Two kinds of local state win
 * over the fetch: `keepLocalIds` -- items the fetch may predate (a write
 * still in flight, or a write or Realtime event since the fetch started) --
 * and local tombstones (which the fetch would otherwise resurrect while the
 * delete is still on its way).
 */
export function mergeListResync<T extends SyncedRow>(
  itemsById: ItemsById<T>,
  fetched: T[],
  keepLocalIds: readonly string[],
): ItemsById<T> {
  const merged: ItemsById<T> = Object.fromEntries(
    fetched.map((item) => [item.id, item]),
  );
  for (const local of Object.values(itemsById)) {
    if (keepLocalIds.includes(local.id) || local.deleted_at)
      merged[local.id] = local;
  }
  return merged;
}

/** Non-deleted items in list order. Lists with their own ordering (shopping:
 * checked items last) sort this result further. */
export function visibleListItems<T extends ListItem>(
  itemsById: ItemsById<T>,
): T[] {
  return Object.values(itemsById)
    .filter((item) => !item.deleted_at)
    .sort((a, b) => a.position - b.position);
}
