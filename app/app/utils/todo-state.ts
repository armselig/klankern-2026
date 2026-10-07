import type { TodoItem } from '~/types/todo'

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

export function visibleTodoItems(itemsById: TodoItemsById): TodoItem[] {
  return Object.values(itemsById)
    .filter((item) => !item.deleted_at)
    .sort((a, b) => a.position - b.position)
}
