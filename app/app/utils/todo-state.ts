import type { TodoItem, TodoRealtimeEvent } from '~/types/todo'

export type TodoItemsById = Record<string, TodoItem>

/**
 * Keyed by client-generated UUID (set at optimistic-insert time): the
 * server-confirmed row -- and later, the Realtime echo of the same INSERT --
 * upserts under the same id instead of appending a duplicate.
 */
export function upsertTodoItem(itemsById: TodoItemsById, item: TodoItem): TodoItemsById {
  return { ...itemsById, [item.id]: item }
}

/** Deletes are soft (deleted_at set) rather than removed from state, so an
 * out-of-order confirmation/Realtime event can't resurrect a deleted item. */
export function softDeleteTodoItem(itemsById: TodoItemsById, id: string): TodoItemsById {
  const existing = itemsById[id]
  if (!existing) return itemsById
  return { ...itemsById, [id]: { ...existing, deleted_at: new Date().toISOString() } }
}

/**
 * Folds a Realtime change into local state. Upserting by id makes the echo of
 * our own optimistic add a no-op. There is no reliable updated_at to order
 * events by, so the latest event wins -- except that nothing may undo a local
 * soft delete, since the app has no undelete and a late event would otherwise
 * bring the item back.
 */
export function applyTodoRealtimeEvent(
  itemsById: TodoItemsById,
  event: TodoRealtimeEvent,
  listId: string | null,
): TodoItemsById {
  const incoming = event.new
  if (!listId || incoming.list_id !== listId) return itemsById
  if (itemsById[incoming.id]?.deleted_at && !incoming.deleted_at) return itemsById
  return upsertTodoItem(itemsById, incoming)
}

/**
 * Rebuilds state after a (re)connect, since Realtime doesn't replay events
 * missed while offline. The fetch excludes deleted rows, so an item missing
 * from it was deleted remotely and is dropped. Two kinds of local state win
 * over the fetch: items with a write still in flight (`pendingIds`; the fetch
 * may predate that write) and local tombstones (which the fetch would
 * otherwise resurrect while the delete is still on its way).
 */
export function mergeTodoResync(
  itemsById: TodoItemsById,
  fetched: TodoItem[],
  pendingIds: readonly string[],
): TodoItemsById {
  const merged: TodoItemsById = Object.fromEntries(fetched.map((item) => [item.id, item]))
  for (const local of Object.values(itemsById)) {
    if (pendingIds.includes(local.id) || local.deleted_at) merged[local.id] = local
  }
  return merged
}

export function visibleTodoItems(itemsById: TodoItemsById): TodoItem[] {
  return Object.values(itemsById)
    .filter((item) => !item.deleted_at)
    .sort((a, b) => a.position - b.position)
}
