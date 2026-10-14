<script setup lang="ts">
import type { StrokeShape } from "~/types/whiteboard";

const props = defineProps<{ stroke: StrokeShape }>();

/** A tap leaves a single point, which a line can't show. */
const isDot = computed(() => props.stroke.points.length === 2);

/** The attribute carries the color the stroke is stored with; the style
 * draws it in the theme's color for that pen, where it is one of the pens. */
const paint = computed(() => inkPaint(props.stroke.color));
</script>

<template>
  <circle
    v-if="isDot"
    :data-testid="TEST_IDS.whiteboard.stroke"
    :cx="stroke.points[0]"
    :cy="stroke.points[1]"
    :r="stroke.width / 2"
    :fill="stroke.color"
    :style="{ fill: paint }"
  />
  <polyline
    v-else
    :data-testid="TEST_IDS.whiteboard.stroke"
    :points="stroke.points.join(' ')"
    :stroke="stroke.color"
    :style="{ stroke: paint }"
    :stroke-width="stroke.width"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</template>
