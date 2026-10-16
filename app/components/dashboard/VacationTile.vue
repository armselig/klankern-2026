<script setup lang="ts">
import { mdiArrowRight } from "@quasar/extras/mdi-v7";
import type { VacationTileLines } from "~/types/dashboard";

/**
 * The vacations' tile: the next trip by name, then when it is, then how
 * much is open for it. The other tiles lead with a number, which fits a
 * list; here the number came before the trip it belongs to and read as a
 * count of vacations.
 *
 * The trip's lines lead to the trip itself, which is where a member wants
 * to go from them; the other tiles have nothing of their own to lead to.
 * "See all" under them is the way to the list of vacations that is said
 * in words, beside the tile's heading and the rest of its area.
 */
defineProps<{
  lines: VacationTileLines;
  /** The list of vacations, where "See all" leads. */
  allTo: string;
}>();
</script>

<template>
  <!-- role="list" because Safari stops announcing a list once its bullets
       are styled away. -->
  <ul role="list" class="vacation-tile">
    <!-- The link is the title's text alone and is stretched over the lines
         (see the style), as the tile's own link is over the card: all of
         them can be pressed, and the link is named by the trip. -->
    <li
      class="vacation-tile__title"
      :data-testid="TEST_IDS.dashboard.tileEntry"
    >
      <nuxt-link :to="ROUTES.vacation(lines.id)" class="vacation-tile__link">{{
        lines.title
      }}</nuxt-link>
    </li>
    <li :data-testid="TEST_IDS.dashboard.tileEntry">{{ lines.when }}</li>
    <li class="text-muted" :data-testid="TEST_IDS.dashboard.tileEntry">
      {{ lines.tasks }}
    </li>
    <li
      v-if="lines.share"
      class="text-muted"
      :data-testid="TEST_IDS.dashboard.tileEntry"
    >
      {{ lines.share }}
    </li>
    <li
      v-if="lines.more"
      class="text-muted"
      :data-testid="TEST_IDS.dashboard.tileEntry"
    >
      {{ lines.more }}
    </li>
  </ul>
  <!-- Named in full for a screen reader: "See all" alone doesn't say of
       what, away from the tile's heading. No color: see hover-contrast.css. -->
  <q-btn
    flat
    :to="allTo"
    :icon-right="mdiArrowRight"
    label="See all"
    aria-label="See all vacations"
    :data-testid="TEST_IDS.dashboard.vacationsAll"
    class="touch-target vacation-tile__all"
  />
</template>

<style scoped>
/* Positioned, so the link's area is the lines' and lies over the area of
   the tile's own link. */
.vacation-tile {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;
  line-height: 1.25rem;
}

/* Two lines at most: a tile is half a phone's screen wide, and a title
   cut after one line of it often loses the word that tells trips apart. */
.vacation-tile__title {
  display: -webkit-box;
  overflow: hidden;
  margin-bottom: 2px;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.375rem;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.vacation-tile__link {
  color: inherit;
  text-decoration: none;
}

.vacation-tile__link::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: var(--radius-field);
}

/* Hover and focus as on the tile itself (see DashboardTile.vue): an
   outline, since a veil would take the muted lines below 4.5:1. */
@media (any-hover: hover) {
  .vacation-tile__link:hover::after {
    outline: 2px solid var(--theme-outline);
  }
}

.vacation-tile__link:focus-visible {
  outline: none;
}

.vacation-tile__link:focus-visible::after {
  outline: 2px solid var(--q-primary);
}

.vacation-tile__all {
  align-self: flex-start;
  margin-top: 8px;
  margin-left: -8px;
  padding: 0 8px;
}
</style>
