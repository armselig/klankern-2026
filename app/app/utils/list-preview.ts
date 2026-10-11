import type { ListPreview, TitledEntry } from "~/types/dashboard";

/** Lines a dashboard tile has for a list's entries. Four keep the 2x2 grid
 * of tiles on one screen of a small phone. */
export const LIST_PREVIEW_LINES = 4;

/**
 * Cuts a list down to what a dashboard tile has room for. A list that fits
 * is shown whole. A longer one gives up its last line to "and N more", so a
 * tile never says "and 1 more" where the entry itself would have fitted.
 */
export function previewOfList<T extends TitledEntry>(
  entries: readonly T[],
  lines: number = LIST_PREVIEW_LINES,
): ListPreview<T> {
  const fits = entries.length <= lines;
  const shown = entries.slice(0, fits ? lines : lines - 1);
  return {
    count: entries.length,
    shown,
    more: entries.length - shown.length,
  };
}
