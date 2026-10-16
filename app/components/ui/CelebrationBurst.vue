<script setup lang="ts">
import type { CelebrationOrigin } from "~/composables/use-celebration";
import type { FeatureKey } from "~/utils/features";

/**
 * A small "done!" when the person's own tap finishes a list: six short pen
 * strokes, the wordmark's, burst from the control that was pressed and fade
 * in about 600ms (see "Small celebrations" in
 * docs/ui/playful-look/design.md). It stays near the thumb, covers no
 * other row for long and shifts nothing.
 *
 * Laid over the page in a fixed layer of its own (teleported to the body),
 * because the row it starts from may slide away at once (a ticked shopping
 * item) and a transformed row would carry a fixed child with it. It takes
 * no pointer, so a quick second tap reaches the checkbox under it. It is
 * decoration, so it is hidden from screen readers, and under reduced motion
 * it isn't shown at all: it is nothing but motion. useCelebration says
 * where and when, and takes it out again.
 */
defineProps<{
  origin: CelebrationOrigin;
  feature: FeatureKey;
}>();

/** The strokes' directions, in degrees, every 60° but turned off the
 * vertical, so that none points straight at the row above or below. */
const RAYS = [15, 75, 135, 195, 255, 315] as const;
</script>

<template>
  <teleport to="body">
    <div
      class="celebration-burst"
      :style="{
        ...featureColors(feature),
        left: `${origin.x}px`,
        top: `${origin.y}px`,
      }"
      aria-hidden="true"
      :data-testid="TEST_IDS.celebration"
    >
      <span
        v-for="(angle, index) in RAYS"
        :key="angle"
        class="celebration-burst__ray"
        :style="{ transform: `rotate(${angle}deg)` }"
      >
        <pen-stroke
          :variant="index"
          class="celebration-burst__stroke"
          :class="{ 'celebration-burst__stroke--accent': index % 2 === 1 }"
        />
      </span>
    </div>
  </teleport>
</template>

<style scoped>
/* Nothing under reduced motion: the burst is only motion. */
.celebration-burst {
  display: none;
}

@media (prefers-reduced-motion: no-preference) {
  .celebration-burst {
    display: block;
    position: fixed;
    z-index: 9000;
    /* The burst's reach, centred on the box: the strokes end 1.75rem out. */
    width: 3.5rem;
    height: 3.5rem;
    margin: -1.75rem 0 0 -1.75rem;
    pointer-events: none;
  }

  .celebration-burst__ray {
    position: absolute;
    top: 50%;
    left: 50%;
    transform-origin: 0 0;
  }

  /* In rem, so the burst grows with the reader's text like the box does. */
  .celebration-burst__stroke {
    display: block;
    width: 0.625rem;
    height: 0.375rem;
    margin-top: -0.1875rem;
    color: var(--feature-icon);
    stroke-width: 2.5;
    opacity: 0;
    animation: celebration-burst 600ms ease-out;
  }

  /* Every second stroke in the accent, as the empty states' details. */
  .celebration-burst__stroke--accent {
    color: var(--feature-accent);
  }
}

/* Forced colors leave an SVG's strokes alone: the text's color instead. */
@media (forced-colors: active) {
  .celebration-burst__stroke,
  .celebration-burst__stroke--accent {
    color: CanvasText;
  }
}

/* Outward from the box's edge, fading as it goes. */
@keyframes celebration-burst {
  from {
    opacity: 1;
    transform: translateX(0.5rem);
  }

  to {
    opacity: 0;
    transform: translateX(1.125rem);
  }
}
</style>
