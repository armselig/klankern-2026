import type { ItemsById } from "~/types/list";
import type { BoardStroke, BoardStrokeRealtimeEvent } from "~/types/whiteboard";
import { upsertListItem } from "./list-state";

// Strokes follow the same rules as list items (client-generated ids, soft
// deletes, resync); the store uses the reducers in list-state.ts for those.
// Here is only what differs for a stroke.

/**
 * Folds a Realtime change into local state, like applyListRealtimeEvent:
 * upserting by id makes the echo of our own stroke a no-op, and nothing may
 * undo a local soft delete (an erase, an undo or a cleared board).
 *
 * Unlike a list item, the event's row is laid over the local one instead of
 * replacing it, because `points` can be missing from an UPDATE (see
 * BoardStrokeChange). A stroke first heard of through such an update is
 * already erased, so it is kept as a tombstone without points.
 */
export function applyStrokeRealtimeEvent(
  strokesById: ItemsById<BoardStroke>,
  event: BoardStrokeRealtimeEvent,
  boardId: string | null,
): ItemsById<BoardStroke> {
  const incoming = event.new;
  if (!boardId || incoming.board_id !== boardId) return strokesById;
  const local = strokesById[incoming.id];
  if (local?.deleted_at && !incoming.deleted_at) return strokesById;
  return upsertListItem(strokesById, { points: [], ...local, ...incoming });
}

/** Non-deleted strokes, oldest first, so a newer stroke is painted over an
 * older one on every member's screen. The times are parsed, not compared as
 * text: an optimistic stroke, a fetched row and a Realtime row each write
 * the timestamp differently. The id breaks ties, to keep the order the same
 * everywhere. */
export function visibleStrokes(
  strokesById: ItemsById<BoardStroke>,
): BoardStroke[] {
  return Object.values(strokesById)
    .filter((stroke) => !stroke.deleted_at)
    .sort(
      (a, b) =>
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}

/**
 * The stroke "Undo" removes: the newest one this member drew that is still
 * on the board. Strokes someone erased in the meantime are skipped, so undo
 * never appears to do nothing.
 *
 * @param drawnIds ids of the strokes this member drew, oldest first
 */
export function lastUndoableStrokeId(
  strokesById: ItemsById<BoardStroke>,
  drawnIds: readonly string[],
): string | null {
  return (
    drawnIds.findLast((id) => strokesById[id] && !strokesById[id].deleted_at) ??
    null
  );
}

/** Clears the board locally: every stroke becomes a tombstone, in one step
 * rather than stroke by stroke, since a full board holds thousands. */
export function softDeleteAllStrokes(
  strokesById: ItemsById<BoardStroke>,
): ItemsById<BoardStroke> {
  const deletedAt = new Date().toISOString();
  return Object.fromEntries(
    Object.entries(strokesById).map(([id, stroke]) => [
      id,
      stroke.deleted_at ? stroke : { ...stroke, deleted_at: deletedAt },
    ]),
  );
}
