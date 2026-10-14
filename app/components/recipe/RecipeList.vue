<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";

const props = defineProps<{ householdId: string }>();
const recipeStore = useRecipeStore();

onMounted(() => recipeStore.load(props.householdId));
</script>

<template>
  <div>
    <q-btn
      :to="ROUTES.recipeNew"
      color="primary"
      :icon="mdiPlus"
      label="New recipe"
      :data-testid="TEST_IDS.recipe.list.add"
      unelevated
      class="q-mb-md"
    />

    <q-spinner v-if="recipeStore.loading" color="primary" />

    <!-- A list of links, so a plain ul: a q-item that is a link is no list
         item to a screen reader, and a q-list would hold no items. -->
    <ul
      v-else-if="recipeStore.visible.length > 0"
      class="recipe-list"
      :data-testid="TEST_IDS.recipe.list.items"
    >
      <li v-for="recipe in recipeStore.visible" :key="recipe.id">
        <q-item
          :to="ROUTES.recipe(recipe.id)"
          :data-testid="TEST_IDS.recipe.list.link"
        >
          <q-item-section class="recipe-list__title">
            {{ recipe.title }}
          </q-item-section>
        </q-item>
      </li>
    </ul>

    <p
      v-else-if="recipeStore.householdId"
      class="text-muted"
      :data-testid="TEST_IDS.recipe.list.empty"
    >
      No recipes yet.
    </p>

    <p
      v-if="recipeStore.error"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ recipeStore.error }}
    </p>
  </div>
</template>

<style scoped>
.recipe-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--theme-outline);
  border-radius: 4px;
}

.recipe-list li + li {
  border-top: 1px solid var(--theme-outline);
}

/* A title is one long word at worst (a pasted link); it wraps rather than
   widening the page. */
.recipe-list__title {
  overflow-wrap: anywhere;
}
</style>
