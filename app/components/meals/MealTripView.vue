<script setup lang="ts">
/**
 * The meals of one trip: the plan for each of the trip's days, reached from
 * the trip's page (`/meals?trip=<id>`). A trip that doesn't exist and one of
 * another household look the same, so the page tells nothing about the
 * other household. The days themselves are MealDays.vue's.
 */
const props = defineProps<{ householdId: string; vacationId: string }>();
const vacationStore = useVacationStore();

onMounted(() => void vacationStore.load(props.householdId));

const now = useMinuteClock();
const today = computed(() => localDateOf(now.value));
/** Whether the household's vacations are in the store. */
const loaded = computed(() => vacationStore.householdId === props.householdId);
/** The first load failed: the trip can't be told apart from an unknown one,
 * so the page says so instead of spinning on. */
const failed = computed(
  () => !loaded.value && !vacationStore.loading && !!vacationStore.error,
);
const vacation = computed(() => vacationStore.find(props.vacationId));
const days = computed(() =>
  vacation.value
    ? daysOfRange(vacation.value.starts_on, vacation.value.ends_on)
    : [],
);
</script>

<template>
  <section aria-labelledby="meals-heading">
    <template v-if="failed">
      <page-heading id="meals-heading" feature="meals" class="text-h6 q-my-none"
        >Meals</page-heading
      >
      <p class="text-negative" :data-testid="TEST_IDS.meals.failure">
        Couldn't load the trip. Reload the page to try again.
      </p>
    </template>
    <q-spinner
      v-else-if="!loaded || vacationStore.loading"
      color="primary"
      size="2em"
      :data-testid="TEST_IDS.meals.loading"
    />
    <template v-else-if="vacation">
      <page-heading
        id="meals-heading"
        feature="meals"
        class="text-h6 q-my-none"
        :data-testid="TEST_IDS.meals.trip.heading"
      >
        Trip to {{ vacation.title }}, {{ vacationDates(vacation, today) }}
      </page-heading>
      <nuxt-link
        :to="ROUTES.meals"
        class="meal-trip__all-weeks"
        :data-testid="TEST_IDS.meals.trip.allWeeks"
        >Show all weeks</nuxt-link
      >
      <meal-days :household-id="householdId" :days="days" :today="today" />
    </template>
    <template v-else>
      <page-heading id="meals-heading" feature="meals" class="text-h6 q-my-none"
        >Meals</page-heading
      >
      <p :data-testid="TEST_IDS.meals.trip.notFound">
        This trip doesn't exist, or it was removed.
        <nuxt-link :to="ROUTES.meals">Show all weeks</nuxt-link>
      </p>
    </template>
  </section>
</template>

<style scoped>
/* A link a thumb can hit, on a line of its own. */
.meal-trip__all-weeks {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-bottom: 8px;
}
</style>
