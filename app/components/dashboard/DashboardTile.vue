<script setup lang="ts">
import type { FeatureKey } from "~/utils/features";

const props = defineProps<{
  title: string;
  /** The page the tile leads to. */
  to: string;
  /** Whose icon and color the tile has. */
  feature: FeatureKey;
  loading: boolean;
  /** The tile's content couldn't be fetched; the link still works. */
  failed: boolean;
}>();

/** Each feature its own stroke under the heading, so that the tiles don't
 * show one squiggle six times over. */
const strokeVariant = computed(() =>
  Object.keys(FEATURE_ICONS).indexOf(props.feature),
);
</script>

<template>
  <q-card class="dashboard-tile" :style="featureColors(feature)">
    <!-- The link is the heading's text alone and is stretched over the card
         (see the style): the whole tile can be pressed, yet the link is
         named "To-dos", not by everything the tile shows. -->
    <h3 class="dashboard-tile__heading">
      <q-icon
        :name="FEATURE_ICONS[feature]"
        size="24px"
        class="dashboard-tile__icon"
        aria-hidden="true"
      />
      <nuxt-link
        :to="to"
        class="dashboard-tile__link"
        :data-testid="TEST_IDS.dashboard.tileLink"
        ><!-- The stroke lies in a span of its own: positioned on the link,
             it would shrink the link's stretched area to the heading's
             text. --><span class="dashboard-tile__title"
          >{{ title
          }}<pen-stroke
            :variant="strokeVariant"
            class="dashboard-tile__stroke" /></span
      ></nuxt-link>
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
  /* See .q-card in assets/css/theme.css. */
  --card-edge: var(--feature-edge);
}

/* In the strong shade, at 3:1 or more, so it would hold even if it meant
   something. */
.dashboard-tile__icon {
  color: var(--feature-icon);
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

.dashboard-tile__title {
  position: relative;
}

/* Under the heading's text, never through it. A pen stroke, not a link's
   underline: the accent says which feature, and the heading is no less a
   link without it. */
.dashboard-tile__stroke {
  position: absolute;
  left: 0;
  bottom: -5px;
  width: 100%;
  height: 6px;
  color: var(--feature-accent);
  stroke-width: 2px;
}

/* Forced colors leave an SVG's colors as they are; under a link the
   stroke takes the links' color, as the wordmark's does. */
@media (forced-colors: active) {
  .dashboard-tile__stroke {
    color: LinkText;
  }
}

/* The link's area is the card's (a q-card is positioned). */
.dashboard-tile__link::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: var(--radius-card);
}

/* Hover and keyboard focus are an outline around the tile, not the theme's
   veil over it: under the veil for a surface the muted text of a tile
   falls below 4.5:1. As Quasar does, no hover on a touch screen, where it
   would stick after the tap. */
@media (any-hover: hover) {
  .dashboard-tile__link:hover::after {
    outline: 2px solid var(--feature-outline);
  }
}

/* The tile lifts under a pointer and gives way when pressed, as a whole,
   since its link is stretched over it. Only for the link: a button inside
   the tile (Tonight's) gives way on its own. */
@media (prefers-reduced-motion: no-preference) {
  .dashboard-tile {
    transition: transform 150ms ease-out;
  }

  .dashboard-tile:has(.dashboard-tile__link:active) {
    transform: scale(0.97);
  }
}

@media (prefers-reduced-motion: no-preference) and (any-hover: hover) {
  .dashboard-tile:has(.dashboard-tile__link:hover):not(:active) {
    transform: translateY(-2px);
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
