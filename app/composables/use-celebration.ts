import { getCurrentScope, onScopeDispose, ref } from "vue";

/** How long a list waits before it celebrates again: unticking and ticking
 * the last item again within it plays nothing. */
export const CELEBRATION_INTERVAL_MS = 60_000;

/** How long a burst stays in the page: its strokes fade in about 600ms
 * (CelebrationBurst.vue). Ended by a timer, not by the animation's end,
 * which never comes under reduced motion, where the burst isn't shown. */
export const CELEBRATION_BURST_MS = 700;

/** Where a burst starts: the middle of the control the person pressed, in
 * the viewport's coordinates, and a number that tells two bursts apart. */
export interface CelebrationOrigin {
  x: number;
  y: number;
  id: number;
}

/** When each list last celebrated, for the session: kept outside the
 * component, so a list left and opened again within the minute waits too. */
const lastPlayedAt = new Map<string, number>();
let burstCount = 0;

/**
 * The celebration of one list: a small burst of pen strokes when the
 * person's own tap finishes it, at most once a minute (see "Small
 * celebrations" in docs/ui/playful-look/design.md).
 *
 * Whether a tap finishes the list is the caller's (`ticksLastOpen`), and
 * only a tap's handler calls `playFrom`, so a change that arrives by
 * Realtime never celebrates. `key` names the list: "todos", "shopping",
 * "week", or a trip's id for its phases.
 */
export function useCelebration(key: string) {
  const burst = ref<CelebrationOrigin | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** Plays the burst from the control at `from`, unless this list played
   * one within the last minute. Returns whether it plays. */
  function playFrom(from: DOMRect) {
    const now = Date.now();
    const last = lastPlayedAt.get(key);
    if (last !== undefined && now - last < CELEBRATION_INTERVAL_MS)
      return false;
    lastPlayedAt.set(key, now);
    burstCount += 1;
    burst.value = {
      x: from.left + from.width / 2,
      y: from.top + from.height / 2,
      id: burstCount,
    };
    clearTimeout(timer);
    timer = setTimeout(() => (burst.value = null), CELEBRATION_BURST_MS);
    return true;
  }

  if (getCurrentScope()) onScopeDispose(() => clearTimeout(timer));

  return { burst, playFrom };
}
