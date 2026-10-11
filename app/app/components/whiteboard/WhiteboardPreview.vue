<script setup lang="ts">
import type { BoardStroke } from "~/types/whiteboard";

const props = defineProps<{ strokes: BoardStroke[] }>();

/** At the preview's size a thin stroke would not be seen. */
const previewStrokes = computed(() => props.strokes.map(strokeForPreview));
</script>

<template>
  <!-- The board as it is, small and only to look at: WhiteboardSurface
       draws the same strokes but listens to the pointer. An image to
       assistive technology, as the board itself is. -->
  <svg
    role="img"
    aria-label="Preview of the whiteboard"
    :viewBox="`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`"
    class="whiteboard-preview"
  >
    <!-- The outline keeps one screen width however small the board is; half
         of it lies outside the viewBox. -->
    <rect
      class="whiteboard-preview__board"
      :width="BOARD_WIDTH"
      :height="BOARD_HEIGHT"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
    />
    <whiteboard-stroke
      v-for="stroke in previewStrokes"
      :key="stroke.id"
      :stroke="stroke"
    />
  </svg>
</template>

<style scoped>
.whiteboard-preview {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
}

.whiteboard-preview__board {
  fill: var(--theme-surface);
  stroke: var(--theme-outline);
}
</style>
