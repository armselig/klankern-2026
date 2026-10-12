import type { StrokeShape } from "~/types/whiteboard";

/**
 * The board has one fixed size in its own units, whatever the screen: every
 * member sees the same picture, scaled. Points and pen widths are stored in
 * these units, as integers. Migration 0012 checks the same numbers.
 */
export const BOARD_WIDTH = 4000;
export const BOARD_HEIGHT = 3000;

/** Most points a stroke may have (a check constraint enforces it): a stroke
 * travels whole in one Realtime payload. */
export const MAX_STROKE_POINTS = 1000;

/** A pointer reports far more positions than a line needs; closer ones are
 * skipped, which keeps strokes small. About one screen pixel on a phone. */
export const MIN_POINT_DISTANCE = 10;

/** How close to a stroke the eraser has to come. Sized for a fingertip on a
 * phone, where the board is about a tenth of its unit size. */
export const ERASER_RADIUS = 80;

export type BoardPoint = readonly [x: number, y: number];

/** Brings a position into the board: clamped to its edges, because a
 * captured pointer keeps reporting positions outside it, and rounded,
 * because the units are finer than any screen. */
export function toBoardPoint(x: number, y: number): BoardPoint {
  return [
    Math.round(Math.min(Math.max(x, 0), BOARD_WIDTH)),
    Math.round(Math.min(Math.max(y, 0), BOARD_HEIGHT)),
  ];
}

/** The stroke's last point; `points` is flat and never empty. */
export function lastStrokePoint(points: readonly number[]): BoardPoint {
  return [points[points.length - 2]!, points[points.length - 1]!];
}

/**
 * Adds a pointer position to a stroke being drawn, unless it is too close to
 * the last point to matter. Returns the same array when nothing was added,
 * so the caller can tell.
 */
export function extendStroke(points: number[], [x, y]: BoardPoint): number[] {
  const [lastX, lastY] = lastStrokePoint(points);
  if (Math.hypot(x - lastX, y - lastY) < MIN_POINT_DISTANCE) return points;
  return [...points, x, y];
}

/** Whether a stroke has reached the size the database accepts. The surface
 * then saves it and continues in a new stroke, so a long line is never cut. */
export function isStrokeFull(points: readonly number[]): boolean {
  return points.length >= MAX_STROKE_POINTS * 2;
}

function distanceToSegment(
  [x, y]: BoardPoint,
  [fromX, fromY]: BoardPoint,
  [toX, toY]: BoardPoint,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const lengthSquared = dx * dx + dy * dy;
  // A stroke of one point (a dot) has a segment of length zero.
  const along =
    lengthSquared === 0
      ? 0
      : Math.min(
          Math.max(((x - fromX) * dx + (y - fromY) * dy) / lengthSquared, 0),
          1,
        );
  return Math.hypot(x - (fromX + along * dx), y - (fromY + along * dy));
}

/**
 * Whether the eraser at `point` touches the stroke. Measured against the
 * line segments, not just the stored points, because a straight stroke has
 * few points far apart; half the pen width is added so a thick stroke can be
 * caught at its edge.
 */
export function strokeIsWithin(
  stroke: StrokeShape,
  point: BoardPoint,
  radius: number,
): boolean {
  const reach = radius + stroke.width / 2;
  const { points } = stroke;
  for (let i = 0; i < points.length; i += 2) {
    const from: BoardPoint = [points[i]!, points[i + 1]!];
    const to: BoardPoint =
      i + 2 < points.length ? [points[i + 2]!, points[i + 3]!] : from;
    if (distanceToSegment(point, from, to) <= reach) return true;
  }
  return false;
}

/**
 * The positions between two pointer events, at most `step` apart and ending
 * at `to`. A fast drag reports positions far apart; without the ones in
 * between the eraser would jump over the strokes it crossed.
 */
export function pointsBetween(
  from: BoardPoint,
  to: BoardPoint,
  step: number,
): BoardPoint[] {
  const count = Math.max(
    1,
    Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / step),
  );
  return Array.from({ length: count }, (_, index) => {
    const along = (index + 1) / count;
    return [
      from[0] + (to[0] - from[0]) * along,
      from[1] + (to[1] - from[1]) * along,
    ] as const;
  });
}
