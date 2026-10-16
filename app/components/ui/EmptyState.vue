<script setup lang="ts">
import type { FeatureKey } from "~/utils/features";

/** The features whose page has an empty state; `/meals` has none (an open
 * day offers "Add dinner"), nor has the whiteboard. */
type EmptyFeature = Exclude<FeatureKey, "meals" | "whiteboard">;

/**
 * A list page with nothing on it yet: a small line drawing in the
 * feature's color above the text that says so, so that an empty list looks
 * like a welcome and not like something broken. The text is the caller's,
 * with its test id, and stays what is read; the drawing is decoration.
 *
 * Drawn in the wordmark's pen stroke (round ends, a line that keeps its
 * width), so it reads as the app's own hand. The main lines are in the
 * strong shade, the small details (a pencil, leaves, steam, the sun, the
 * kite's tail) in the accent.
 */
defineProps<{
  feature: EmptyFeature;
}>();

/** Each drawing's main lines and details, in a 120 × 96 box. */
const DRAWINGS: Record<EmptyFeature, { main: string[]; details: string[] }> = {
  // A notepad with empty boxes and a pencil beside it.
  todos: {
    main: [
      "M31 12C30 32 31 58 32 80L82 79C83 58 82 32 83 11Z",
      "M39 24L47 24L47 32L39 32Z",
      "M53 28C60 26 67 30 74 27",
      "M39 40L47 40L47 48L39 48Z",
      "M53 44C59 42 64 46 70 43",
      "M39 56L47 56L47 64L39 64Z",
      "M53 60C58 58 62 62 66 59",
    ],
    details: ["M93 76L106 36L112 38L99 78Z M93 76L93 84L99 78 M104 42L110 44"],
  },
  // An empty bag, with two leaves of what will go in it.
  shopping: {
    main: [
      "M32 35C50 33 70 35 88 34L84 80C72 82 48 82 36 80Z",
      "M47 34C46 22 54 17 60 17C66 17 74 22 73 34",
    ],
    details: [
      "M92 24C98 14 108 13 112 15C109 23 100 28 92 24Z M92 24C99 21 105 18 112 15",
      "M14 58C10 50 14 44 22 44C24 52 20 58 14 58Z M14 58C16 52 19 48 22 44",
    ],
  },
  // A pot with its lid on, steaming.
  recipes: {
    main: [
      "M32 46L88 46L85 76C80 82 40 82 35 76Z",
      "M26 46C40 38 80 38 94 46",
      "M55 39C55 33 65 33 65 39",
      "M32 52C23 51 23 60 33 60 M88 52C97 51 97 60 87 60",
    ],
    details: [
      "M47 30C43 24 51 20 47 12 M60 28C56 22 64 18 60 9 M73 30C69 24 77 20 73 12",
    ],
  },
  // A suitcase, and the sun it is packed for.
  vacations: {
    main: [
      "M24 38C24 34 26 32 30 32L86 32C90 32 92 34 92 38L92 76C92 80 90 82 86 82L30 82C26 82 24 80 24 76Z",
      "M46 32L46 24C46 22 48 21 50 21L66 21C68 21 70 22 70 24L70 32",
      "M40 32L40 82 M76 32L76 82",
    ],
    details: [
      "M98 16A6 6 0 1 0 110 16A6 6 0 1 0 98 16Z",
      "M104 4L104 6 M104 26L104 28 M92 16L94 16 M114 16L116 16 M95.5 7.5L97 9 M111 23L112.5 24.5 M111 9L112.5 7.5 M95.5 24.5L97 23",
    ],
  },
  // A kite, for the kids.
  household: {
    main: ["M58 6L82 30L60 62L36 32Z", "M58 6L60 62 M36 32L82 30"],
    details: [
      "M60 62C50 66 70 72 58 78C48 83 66 88 54 94",
      "M57 68L50 64L50 72Z M60 84L53 80L53 88Z",
    ],
  },
};
</script>

<template>
  <div class="empty-state" :style="featureColors(feature)">
    <svg
      class="empty-state__drawing"
      viewBox="0 0 120 96"
      aria-hidden="true"
      fill="none"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        v-for="d in DRAWINGS[feature].main"
        :key="d"
        :d="d"
        class="empty-state__main"
        vector-effect="non-scaling-stroke"
      />
      <path
        v-for="d in DRAWINGS[feature].details"
        :key="d"
        :d="d"
        class="empty-state__detail"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
  text-align: center;
}

/* In em, so the drawing grows with the reader's text. */
.empty-state__drawing {
  width: 7.5em;
  height: 6em;
  overflow: visible;
}

.empty-state__main {
  stroke: var(--feature-icon);
}

.empty-state__detail {
  stroke: var(--feature-accent);
}

/* Forced colors leave an SVG's strokes as they are, and a Mocha pastel
   would be pale on a white page: the drawing takes the text's color. */
@media (forced-colors: active) {
  .empty-state__main,
  .empty-state__detail {
    stroke: CanvasText;
  }
}
</style>
