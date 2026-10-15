<script setup lang="ts">
useHead({ title: "New recipe" });

const householdStore = useHouseholdStore();
const route = useRoute();

/** The meal plan entry the recipe is made of (`?entry=&title=`), if any. */
const fromEntry = computed(() => {
  const { entry, title } = route.query;
  return typeof entry === "string"
    ? { id: entry, title: typeof title === "string" ? title : "" }
    : undefined;
});

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <h2 class="text-h6">New recipe</h2>
      <recipe-editor
        :household-id="householdStore.household.id"
        :from-entry="fromEntry"
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
