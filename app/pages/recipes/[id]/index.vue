<script setup lang="ts">
const route = useRoute();
const recipeId = computed(() => route.params.id as string);

const householdStore = useHouseholdStore();
const recipeStore = useRecipeStore();

// The recipe's own title once it is loaded, so a tab or a history entry
// says which recipe it is.
useHead({
  title: () => recipeStore.find(recipeId.value)?.title ?? "Recipe",
});

onMounted(async () => {
  if (!householdStore.household) await householdStore.fetchMine();
});
</script>

<template>
  <q-page padding>
    <q-spinner v-if="householdStore.loading" color="primary" size="2em" />
    <!-- No heading here: it is the recipe's title, which the view knows. -->
    <div v-else-if="householdStore.household" style="max-width: 480px">
      <recipe-view
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
