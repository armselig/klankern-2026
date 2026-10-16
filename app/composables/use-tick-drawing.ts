import { ref } from "vue";

/** The name of the strike-through's animation in assets/css/motion.css. */
export const TICK_DRAWING_ANIMATION = "list-tick-strike";

/**
 * Whether a list item's tick is being drawn: the box's overshoot and the
 * strike-through drawn across the title (assets/css/motion.css).
 *
 * The drawing answers only the person's own tap, so it is started from the
 * checkbox's handler and never from the item's state: a tick that arrives
 * by Realtime from another member's phone is struck through at once. Under
 * reduced motion the flag is set as well but changes nothing, since the
 * styles that read it are inside `prefers-reduced-motion: no-preference`.
 */
export function useTickDrawing() {
  const drawing = ref(false);

  /** Called with the checkbox's new value by the person's tap: only a tick
   * is drawn, an untick is not. */
  function startFromTap(checked: boolean) {
    drawing.value = checked;
  }

  /** Ends the drawing once the strike-through is drawn; the box's
   * overshoot ends at the same time and is ignored. */
  function endDrawing(event: AnimationEvent) {
    if (event.animationName === TICK_DRAWING_ANIMATION) drawing.value = false;
  }

  return { drawing, startFromTap, endDrawing };
}
