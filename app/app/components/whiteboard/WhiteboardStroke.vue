<script setup lang="ts">
import type { StrokeShape } from "~/types/whiteboard";

const props = defineProps<{ stroke: StrokeShape }>();

/** A tap leaves a single point, which a line can't show. */
const isDot = computed(() => props.stroke.points.length === 2);
</script>

<template>
  <circle
    v-if="isDot"
    :cx="stroke.points[0]"
    :cy="stroke.points[1]"
    :r="stroke.width / 2"
    :fill="stroke.color"
  />
  <polyline
    v-else
    :points="stroke.points.join(' ')"
    :stroke="stroke.color"
    :stroke-width="stroke.width"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</template>
