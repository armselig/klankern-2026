<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight } from "@quasar/extras/mdi-v7";

/**
 * A week of the household's meals, Monday to Sunday. The week is in the
 * address (`?week=`), so a week can be linked to and the browser's back
 * button goes to the week before. The days themselves are MealDays.vue's.
 */
defineProps<{ householdId: string }>();
const route = useRoute();

const now = useMinuteClock();
const today = computed(() => localDateOf(now.value));
const monday = computed(() => weekFromParam(route.query.week, today.value));
const days = computed(() => weekDays(monday.value));
const isThisWeek = computed(() => monday.value === mondayOf(today.value));
</script>

<template>
  <section aria-labelledby="meals-heading">
    <h2
      id="meals-heading"
      class="text-h6 q-my-none"
      :data-testid="TEST_IDS.meals.heading"
    >
      Meals, week of {{ formatDay(monday, true) }}
    </h2>
    <nav aria-label="Weeks" class="meal-week__nav">
      <q-btn
        flat
        no-caps
        :icon="mdiChevronLeft"
        label="Previous"
        aria-label="Previous week"
        :to="{ query: { week: addDays(monday, -7) } }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.previousWeek"
      />
      <q-btn
        v-if="!isThisWeek"
        flat
        no-caps
        label="Today"
        aria-label="This week"
        :to="{ query: {} }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.thisWeek"
      />
      <q-btn
        flat
        no-caps
        :icon-right="mdiChevronRight"
        label="Next"
        aria-label="Next week"
        :to="{ query: { week: addDays(monday, 7) } }"
        class="touch-target"
        :data-testid="TEST_IDS.meals.nextWeek"
      />
    </nav>

    <meal-days :household-id="householdId" :days="days" :today="today" />
  </section>
</template>

<style scoped>
.meal-week__nav {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
}
</style>
