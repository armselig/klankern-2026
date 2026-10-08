import type { Database } from './database.types'

export type TodoList = Database['public']['Tables']['todo_lists']['Row']
export type TodoItem = Database['public']['Tables']['todo_items']['Row']

/** A to-do row change as delivered by Realtime, reduced to what the store
 * needs, so the reducers in utils/todo-state.ts stay free of realtime-js
 * types. Only INSERT and UPDATE: deletes are soft, i.e. UPDATEs. */
export interface TodoRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE'
  new: TodoItem
}
