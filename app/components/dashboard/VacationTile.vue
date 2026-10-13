<script setup lang="ts">
import type { VacationTileLines } from "~/types/dashboard";

/**
 * The vacations' tile: the next trip by name, then when it is, then how
 * much is open for it. The other tiles lead with a number, which fits a
 * list; here the number came before the trip it belongs to and read as a
 * count of vacations.
 */
defineProps<{ lines: VacationTileLines }>();
</script>

<template>
  <!-- role="list" because Safari stops announcing a list once its bullets
       are styled away. -->
  <ul role="list" class="vacation-tile">
    <li class="vacation-tile__title">{{ lines.title }}</li>
    <li>{{ lines.when }}</li>
    <li class="text-muted">{{ lines.tasks }}</li>
    <li v-if="lines.share" class="text-muted">{{ lines.share }}</li>
    <li v-if="lines.more" class="text-muted">{{ lines.more }}</li>
  </ul>
</template>

<style scoped>
.vacation-tile {
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
</style>
