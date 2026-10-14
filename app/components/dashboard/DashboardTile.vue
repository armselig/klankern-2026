<script setup lang="ts">
defineProps<{
  title: string;
  /** The page the tile leads to. */
  to: string;
  /** An icon's SVG path, from Material Design Icons. */
  icon: string;
  loading: boolean;
  /** The tile's content couldn't be fetched; the link still works. */
  failed: boolean;
}>();
</script>

<template>
  <q-card class="dashboard-tile">
    <!-- The link is the heading's text alone and is stretched over the card
         (see the style): the whole tile can be pressed, yet the link is
         named "To-dos", not by everything the tile shows. -->
    <h3 class="dashboard-tile__heading">
      <q-icon :name="icon" size="24px" color="primary" aria-hidden="true" />
      <nuxt-link
        :to="to"
        class="dashboard-tile__link"
        :data-testid="TEST_IDS.dashboard.tileLink"
        >{{ title }}</nuxt-link
      >
    </h3>
    <q-spinner v-if="loading" color="primary" />
    <p
      v-else-if="failed"
      class="text-negative q-my-none"
      :data-testid="TEST_IDS.errorMessage"
    >
      Couldn't load this. Reload the page to try again.
    </p>
    <slot v-else />
  </q-card>
</template>

<style scoped>
/* The height of a heading, a count and four lines, so the tiles keep their
   size while their content is on its way. */
.dashboard-tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 0;
  min-width: 0;
  min-height: 11.75rem;
  padding: 14px;
}

/* Quasar styles a bare h3 as a 3rem display line. */
.dashboard-tile__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

.dashboard-tile__link {
  color: inherit;
  text-decoration: none;
}

/* The link's area is the card's (a q-card is positioned). */
.dashboard-tile__link::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 4px;
}

/* Hover and keyboard focus are an outline around the tile, not the theme's
   veil over it: under the veil for a surface the muted text of a tile
   falls below 4.5:1. As Quasar does, no hover on a touch screen, where it
   would stick after the tap. */
@media (any-hover: hover) {
  .dashboard-tile__link:hover::after {
    outline: 2px solid var(--theme-outline);
  }
}

.dashboard-tile__link:focus-visible {
  outline: none;
}

.dashboard-tile__link:focus-visible::after {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}
</style>
