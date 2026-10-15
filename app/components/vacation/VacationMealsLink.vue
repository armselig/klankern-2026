<script setup lang="ts">
import { mdiChevronRight } from "@quasar/extras/mdi-v7";

/**
 * The way from a vacation's page to its meals. One line with what waits
 * there, so a member sees that ingredients are still to go on the shopping
 * list without opening the page: the app has no notifications.
 */
defineProps<{
  vacationId: string;
  /** What the meals page says about itself (see mealsSummary). */
  summary: string;
}>();
</script>

<template>
  <nuxt-link
    :to="ROUTES.vacationMeals(vacationId)"
    class="vacation-meals-link"
    :data-testid="TEST_IDS.vacation.meals.link"
  >
    <span class="vacation-meals-link__name">Meals</span>
    <span class="vacation-meals-link__summary text-muted">{{ summary }}</span>
    <q-icon :name="mdiChevronRight" aria-hidden="true" size="sm" />
  </nuxt-link>
</template>

<style scoped>
/* A row of one line, as a task's is, framed as the lists around it. */
.vacation-meals-link {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  margin: 16px 0 4px;
  padding: 0 12px;
  border: 1px solid var(--theme-separator);
  color: inherit;
  text-decoration: none;
}

.vacation-meals-link__name {
  flex: none;
  font-weight: 500;
}

/* The status gives way and wraps, so a long one doesn't widen the row. */
.vacation-meals-link__summary {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
}

@media (any-hover: hover) {
  .vacation-meals-link:hover {
    outline: 2px solid var(--theme-outline);
  }
}
</style>
