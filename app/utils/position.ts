/**
 * Fractional ordering: inserting between two items sets `position` to the
 * midpoint of its neighbors (a single-row UPDATE), instead of reindexing
 * every row below the insertion point -- which would race badly when two
 * devices reorder the same list under Realtime.
 */

export function nextPosition(items: { position: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((item) => item.position)) + 1;
}

export function positionBetween(
  before: number | null,
  after: number | null,
): number {
  if (before == null && after == null) return 1;
  if (before == null) return after! / 2;
  if (after == null) return before + 1;
  return (before + after) / 2;
}
