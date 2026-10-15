<script setup lang="ts">
const route = useRoute();
const vacationId = computed(() => route.params.id as string);

const householdStore = useHouseholdStore();
const vacationStore = useVacationStore();

useHead({
  title: () => {
    const title = vacationStore.find(vacationId.value)?.title;
    return title ? `Meals · ${title}` : "Meals";
  },
});

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <!-- No heading here: the view has its own. -->
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <vacation-meals-view
        :household-id="householdStore.household.id"
        :vacation-id="vacationId"
      />
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
