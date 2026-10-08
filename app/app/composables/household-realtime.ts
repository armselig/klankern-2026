import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { ListRealtimeEvent } from '~/types/list'
import type { TodoItem } from '~/types/todo'

type Client = SupabaseClient<Database>

export interface HouseholdChangeListeners {
  onTodoItemChange: (event: ListRealtimeEvent<TodoItem>) => void
  /** Fires on the first subscribe and on every automatic rejoin after a
   * dropped connection; postgres_changes has no replay, so this is the cue
   * to refetch. */
  onSubscribed: () => void
}

/**
 * One channel per household rather than per table, because a server-side
 * filter supports only a single `column=eq.value`; further tables (shopping
 * items) add listeners to this same channel. Plain function taking the
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
  const target = {
    schema: 'public',
    table: 'todo_items',
    filter: `household_id=eq.${householdId}`,
  } as const
  const forwardTodoChange = (payload: { eventType: 'INSERT' | 'UPDATE'; new: TodoItem }) =>
    listeners.onTodoItemChange({ eventType: payload.eventType, new: payload.new })

  const channel = client
    .channel(`household:${householdId}`)
    .on<TodoItem>('postgres_changes', { ...target, event: 'INSERT' }, (payload) =>
      forwardTodoChange(payload),
    )
    .on<TodoItem>('postgres_changes', { ...target, event: 'UPDATE' }, (payload) =>
      forwardTodoChange(payload),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') listeners.onSubscribed()
    })

  return () => {
    void client.removeChannel(channel)
  }
}
