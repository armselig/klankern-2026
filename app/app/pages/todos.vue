<script setup lang="ts">
useHead({ title: "To-dos" });

const householdStore = useHouseholdStore();

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <h1 class="text-h6">To-dos</h1>
      <todo-list :household-id="householdStore.household.id" />
    </div>
    <p v-else>
      You need a household first -- go to
      <nuxt-link :to="ROUTES.home">the dashboard</nuxt-link>
      to create or join one.
    </p>
  </q-page>
</template>
