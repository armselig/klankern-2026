import type { StrokeShape } from "~/types/whiteboard";

/**
 * The thinnest a stroke is drawn in the dashboard's preview, in board units.
 * The preview shows the 4000 units of the board on about 150 pixels, where
 * the thin pen (16 units) would be half a pixel wide and a dot would vanish.
 * At this width a stroke stays above one and a half pixels.
 */
export const PREVIEW_MIN_STROKE_WIDTH = 48;

/** The stroke as the preview draws it: itself, but never thinner than can
 * be seen at that size. */
export function strokeForPreview<T extends StrokeShape>(stroke: T): T {
  return stroke.width >= PREVIEW_MIN_STROKE_WIDTH
    ? stroke
    : { ...stroke, width: PREVIEW_MIN_STROKE_WIDTH };
}
