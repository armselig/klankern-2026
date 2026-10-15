<script setup lang="ts">
const householdStore = useHouseholdStore();

useHead({ title: "Kids" });

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <!-- No heading here: the records have their own. -->
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <kid-records :household-id="householdStore.household.id" />
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
