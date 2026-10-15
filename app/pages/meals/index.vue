<script setup lang="ts">
const householdStore = useHouseholdStore();
const route = useRoute();

/** The trip whose meals are shown (`?trip=`); null shows the weeks. */
const tripId = computed(() =>
  typeof route.query.trip === "string" ? route.query.trip : null,
);

useHead({ title: "Meals" });

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <!-- No heading here: the view has its own. -->
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <meal-trip-view
        v-if="tripId"
        :key="tripId"
        :household-id="householdStore.household.id"
        :vacation-id="tripId"
      />
      <meal-week-view v-else :household-id="householdStore.household.id" />
    </div>
    <p v-else :data-testid="TEST_IDS.household.requiredNotice">
      You need a household first -- go to
      <nuxt-link
        :to="ROUTES.home"
        :data-testid="TEST_IDS.household.requiredLink"
        >the dashboard</nuxt-link
      >
      to create or join one.
    </p>
  </q-page>
</template>
