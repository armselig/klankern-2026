<script setup lang="ts">
/**
 * The app's pen stroke, as under the wordmark: a line drawn by hand, as on
 * the whiteboard. Stretched to whatever it underlines; the line keeps its
 * thickness (non-scaling-stroke). It is drawn in `currentColor` and its
 * width is the `stroke-width` of the place that uses it.
 *
 * A few variants, so that the dashboard's tiles don't show the same
 * squiggle six times over.
 */
const props = withDefaults(
  defineProps<{
    /** Which of the strokes; the wordmark's is 0. Wraps around. */
    variant?: number;
  }>(),
  { variant: 0 },
);

const STROKES = [
  "M2 5.5C20 2 38 7 58 4S88 3 98 5",
  "M2 4.5C18 6.5 34 2.5 52 4.5S84 6.5 98 3.5",
  "M2 5C14 3 30 3.5 46 5S78 6.5 98 3",
  "M2 3.5C22 5.5 40 6 60 4S86 2.5 98 5.5",
] as const;

const path = computed(() => STROKES[props.variant % STROKES.length]);
</script>

<template>
  <svg
    class="pen-stroke"
    viewBox="0 0 100 8"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      :d="path"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.pen-stroke {
  overflow: visible;
}
</style>
