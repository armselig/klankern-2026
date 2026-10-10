import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { ListRealtimeEvent } from '~/types/list'
import type { ShoppingItem } from '~/types/shopping'
import type { RowRealtimeEvent } from '~/types/synced-row'
import type { TodoItem } from '~/types/todo'
import type { BoardStrokeChange, BoardStrokeRealtimeEvent } from '~/types/whiteboard'

type Client = SupabaseClient<Database>

/** The fields of a realtime-js INSERT or UPDATE payload the stores need. */
interface RowChangePayload<T extends { id: string }> {
  eventType: RowRealtimeEvent<T>['eventType']
  new: T
  commit_timestamp: string
}

/** Keeps realtime-js's payload shape out of the stores and reducers. */
function toRowRealtimeEvent<T extends { id: string }>(
  payload: RowChangePayload<T>,
): RowRealtimeEvent<T> {
  return {
    eventType: payload.eventType,
    new: payload.new,
    commitTimestamp: payload.commit_timestamp,
  }
}

export interface HouseholdChangeListeners {
  onTodoItemChange: (event: ListRealtimeEvent<TodoItem>) => void
  onShoppingItemChange: (event: ListRealtimeEvent<ShoppingItem>) => void
  onBoardStrokeChange: (event: BoardStrokeRealtimeEvent) => void
  /** Fires on the first subscribe and on every automatic rejoin after a
   * dropped connection; postgres_changes has no replay, so this is the cue
   * to refetch. */
  onSubscribed: () => void
}

/**
 * One channel per household rather than per table, because a server-side
 * filter supports only a single `column=eq.value`; each synced table adds its
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
  const boardStrokes = { schema: 'public', table: 'board_strokes', filter } as const

  const channel = client
    .channel(`household:${householdId}`)
    .on<TodoItem>('postgres_changes', { ...todoItems, event: 'INSERT' }, (payload) =>
      listeners.onTodoItemChange(toRowRealtimeEvent(payload)),
    )
    .on<TodoItem>('postgres_changes', { ...todoItems, event: 'UPDATE' }, (payload) =>
      listeners.onTodoItemChange(toRowRealtimeEvent(payload)),
    )
    .on<ShoppingItem>('postgres_changes', { ...shoppingItems, event: 'INSERT' }, (payload) =>
      listeners.onShoppingItemChange(toRowRealtimeEvent(payload)),
    )
    .on<ShoppingItem>('postgres_changes', { ...shoppingItems, event: 'UPDATE' }, (payload) =>
      listeners.onShoppingItemChange(toRowRealtimeEvent(payload)),
    )
    .on<BoardStrokeChange>('postgres_changes', { ...boardStrokes, event: 'INSERT' }, (payload) =>
      listeners.onBoardStrokeChange(toRowRealtimeEvent(payload)),
    )
    .on<BoardStrokeChange>('postgres_changes', { ...boardStrokes, event: 'UPDATE' }, (payload) =>
      listeners.onBoardStrokeChange(toRowRealtimeEvent(payload)),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') listeners.onSubscribed()
    })

  return () => {
    void client.removeChannel(channel)
  }
}
