/**
 * The columns every shared-list item table has (todo_items, shopping_items,
 * ...), which is all the reducers in utils/list-state.ts look at -- so one
 * implementation of the dedup, soft-delete and resync rules serves every list.
 */
export interface ListItem {
  id: string
  list_id: string
  position: number
  deleted_at: string | null
}

export type ItemsById<T extends ListItem> = Record<string, T>

/** A list-item row change as delivered by Realtime, reduced to what the
 * stores need, so the reducers stay free of realtime-js types. Only INSERT
 * and UPDATE: deletes are soft, i.e. UPDATEs. */
export interface ListRealtimeEvent<T extends ListItem> {
  eventType: 'INSERT' | 'UPDATE'
  new: T
  /** When the database committed the change (ISO 8601). Realtime doesn't
   * guarantee delivery in commit order, so this, not the arrival order, says
   * which of two events of one item is newer (see createRealtimeEventOrder). */
  commitTimestamp: string
}
