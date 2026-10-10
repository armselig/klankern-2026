import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { ListItem, ListRealtimeEvent } from '~/types/list'
import type { ShoppingItem } from '~/types/shopping'
import type { TodoItem } from '~/types/todo'

type Client = SupabaseClient<Database>

/** The fields of a realtime-js INSERT or UPDATE payload the stores need. */
interface ListItemChangePayload<T extends ListItem> {
  eventType: ListRealtimeEvent<T>['eventType']
  new: T
  commit_timestamp: string
}

/** Keeps realtime-js's payload shape out of the stores and reducers. */
function toListRealtimeEvent<T extends ListItem>(
  payload: ListItemChangePayload<T>,
): ListRealtimeEvent<T> {
  return {
    eventType: payload.eventType,
    new: payload.new,
    commitTimestamp: payload.commit_timestamp,
  }
}

export interface HouseholdChangeListeners {
  onTodoItemChange: (event: ListRealtimeEvent<TodoItem>) => void
  onShoppingItemChange: (event: ListRealtimeEvent<ShoppingItem>) => void
  /** Fires on the first subscribe and on every automatic rejoin after a
   * dropped connection; postgres_changes has no replay, so this is the cue
   * to refetch. */
  onSubscribed: () => void
}

/**
 * One channel per household rather than per table, because a server-side
 * filter supports only a single `column=eq.value`; each item table adds its
 * listeners to this same channel. Plain function taking the
 * client, like the *-actions modules, so it can be tested with a mock.
 *
 * Only INSERT and UPDATE are subscribed: DELETE events can't be filtered and
 * bypass RLS, and the app never hard-deletes (deletes are soft UPDATEs).
 *
 * @returns a function that removes the channel
 */
export function subscribeToHouseholdChanges(
  client: Client,
  householdId: string,
  listeners: HouseholdChangeListeners,
): () => void {
  const filter = `household_id=eq.${householdId}`
  const todoItems = { schema: 'public', table: 'todo_items', filter } as const
  const shoppingItems = { schema: 'public', table: 'shopping_items', filter } as const

  const channel = client
    .channel(`household:${householdId}`)
    .on<TodoItem>('postgres_changes', { ...todoItems, event: 'INSERT' }, (payload) =>
      listeners.onTodoItemChange(toListRealtimeEvent(payload)),
    )
    .on<TodoItem>('postgres_changes', { ...todoItems, event: 'UPDATE' }, (payload) =>
      listeners.onTodoItemChange(toListRealtimeEvent(payload)),
    )
    .on<ShoppingItem>('postgres_changes', { ...shoppingItems, event: 'INSERT' }, (payload) =>
      listeners.onShoppingItemChange(toListRealtimeEvent(payload)),
    )
    .on<ShoppingItem>('postgres_changes', { ...shoppingItems, event: 'UPDATE' }, (payload) =>
      listeners.onShoppingItemChange(toListRealtimeEvent(payload)),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') listeners.onSubscribed()
    })

  return () => {
    void client.removeChannel(channel)
  }
}
