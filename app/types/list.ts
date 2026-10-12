import type { RowRealtimeEvent, SyncedRow } from "./synced-row";

/**
 * The columns every shared-list item table has (todo_items, shopping_items,
 * ...), which is all the reducers in utils/list-state.ts look at -- so one
 * implementation of the dedup, soft-delete and resync rules serves every list.
 */
export interface ListItem extends SyncedRow {
  list_id: string;
  position: number;
}

export type ItemsById<T extends SyncedRow> = Record<string, T>;

/** A list-item row change as delivered by Realtime (see RowRealtimeEvent). */
export type ListRealtimeEvent<T extends ListItem> = RowRealtimeEvent<T>;
