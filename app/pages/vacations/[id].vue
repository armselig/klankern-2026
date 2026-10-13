<script setup lang="ts">
const route = useRoute();
const vacationId = computed(() => route.params.id as string);

const householdStore = useHouseholdStore();
const vacationStore = useVacationStore();

// The vacation's own title once it is loaded, so a tab or a history entry
// says which trip it is.
useHead({
  title: () => vacationStore.find(vacationId.value)?.title ?? "Vacation",
});

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <!-- No heading here: it is the vacation's title, which the view knows. -->
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <vacation-view
        :household-id="householdStore.household.id"
        :vacation-id="vacationId"
      />
    </div>
    <p v-else>
      You need a household first -- go to
      <nuxt-link :to="ROUTES.home">the dashboard</nuxt-link>
      to create or join one.
    </p>
  </q-page>
</template>
