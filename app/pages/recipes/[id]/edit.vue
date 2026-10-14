<script setup lang="ts">
useHead({ title: "Edit recipe" });

const route = useRoute();
const recipeId = computed(() => route.params.id as string);

const householdStore = useHouseholdStore();

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <h2 class="text-h6">Edit recipe</h2>
      <recipe-editor
        :household-id="householdStore.household.id"
        :recipe-id="recipeId"
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
