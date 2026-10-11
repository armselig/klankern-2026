/**
 * The columns the optimistic-write, soft-delete and resync rules look at.
 * Every row the household syncs live has them, list items and whiteboard
 * strokes alike, so those rules exist once (utils/list-state.ts).
 */
export interface SyncedRow {
  id: string;
  deleted_at: string | null;
}

/** A row change as delivered by Realtime, reduced to what the stores need,
 * so the reducers stay free of realtime-js types. Only INSERT and UPDATE:
 * deletes are soft, i.e. UPDATEs. */
export interface RowRealtimeEvent<T extends { id: string }> {
  eventType: "INSERT" | "UPDATE";
  new: T;
  /** When the database committed the change (ISO 8601). Realtime doesn't
   * guarantee delivery in commit order, so this, not the arrival order, says
   * which of two events of one row is newer (see createRealtimeEventOrder). */
  commitTimestamp: string;
}
