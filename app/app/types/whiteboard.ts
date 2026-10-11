import type { Database } from "./database.types";
import type { RowRealtimeEvent } from "./synced-row";

export type Board = Database["public"]["Tables"]["boards"]["Row"];

type BoardStrokeRow = Database["public"]["Tables"]["board_strokes"]["Row"];

/** What it takes to render a stroke. `points` is a flat array
 * [x0, y0, x1, y1, ...] in board units (see utils/whiteboard-geometry.ts). */
export interface StrokeShape {
  color: string;
  width: number;
  points: number[];
}

/** A stroke row. The generated type has `points` as `Json` (the column is
 * jsonb); a check constraint guarantees the array of numbers. */
export type BoardStroke = Omit<BoardStrokeRow, "points"> & StrokeShape;

/**
 * A stroke row as Realtime delivers it. `points` can be missing from an
 * UPDATE: Postgres stores a large value out of line and leaves it out of the
 * change record when the update didn't touch it, which is every update the
 * app makes (a soft delete).
 */
export type BoardStrokeChange = Omit<BoardStroke, "points"> & {
  points?: number[];
};

export type BoardStrokeRealtimeEvent = RowRealtimeEvent<BoardStrokeChange>;

export type WhiteboardTool = "pen" | "eraser";
