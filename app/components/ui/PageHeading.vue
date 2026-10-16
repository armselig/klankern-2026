<script setup lang="ts">
import type { FeatureKey } from "~/utils/features";

/**
 * A feature's page heading, with the icon its dashboard tile has, in the
 * feature's strong shade, so that the page and its tile are recognisably
 * one. No pen stroke under it, as there is on the tile: the heading is not
 * a link, and only links are underlined.
 *
 * The heading's class, id and test id are passed on to the h2, as on a
 * plain one.
 */
defineProps<{
  feature: FeatureKey;
}>();
</script>

<template>
  <h2 class="page-heading" :style="featureColors(feature)">
    <q-icon
      :name="FEATURE_ICONS[feature]"
      class="page-heading__icon"
      aria-hidden="true"
    />
    <span><slot /></span>
  </h2>
</template>

<style scoped>
.page-heading {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

/* A little larger than the text, as on the tiles; it shrinks with the
   heading, never the heading with it. */
.page-heading__icon {
  flex: none;
  font-size: 1.2em;
  color: var(--feature-icon);
}
</style>
