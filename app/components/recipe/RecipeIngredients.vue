<script setup lang="ts">
import { mdiCartPlus } from "@quasar/extras/mdi-v7";
import type { RecipeIngredient } from "~/types/recipe";

const props = defineProps<{
  ingredients: RecipeIngredient[];
  /** Whether the chosen ingredients are being added right now. */
  adding: boolean;
}>();
const emit = defineEmits<{ add: [ingredients: RecipeIngredient[]] }>();

/** The ingredients the member unticked. Kept instead of the ticked ones, so
 * an ingredient another member adds meanwhile starts ticked like the rest. */
const skippedIds = ref<string[]>([]);

const chosen = computed(() =>
  props.ingredients.filter(
    (ingredient) => !skippedIds.value.includes(ingredient.id),
  ),
);

/** The quantity is part of the checkbox label, so screen readers announce it
 * with the ingredient, as on the shopping list. */
function label(ingredient: RecipeIngredient) {
  return ingredient.quantity
    ? `${ingredient.name} (${ingredient.quantity})`
    : ingredient.name;
}

function setChosen(id: string, isChosen: boolean) {
  skippedIds.value = isChosen
    ? skippedIds.value.filter((skippedId) => skippedId !== id)
    : [...skippedIds.value, id];
}
</script>

<template>
  <!-- The ingredients are a pick list for the shopping list: all ticked, to
       untick what is in the house already. -->
  <q-form @submit.prevent="emit('add', chosen)">
    <q-list bordered separator class="q-mb-sm">
      <q-item v-for="ingredient in ingredients" :key="ingredient.id">
        <q-item-section>
          <q-checkbox
            :model-value="!skippedIds.includes(ingredient.id)"
            :label="label(ingredient)"
            class="recipe-ingredients__name"
            :data-testid="TEST_IDS.recipe.view.ingredient"
            @update:model-value="(value) => setChosen(ingredient.id, value)"
          />
        </q-item-section>
      </q-item>
    </q-list>
    <q-btn
      type="submit"
      color="primary"
      :icon="mdiCartPlus"
      label="Add to shopping list"
      :data-testid="TEST_IDS.recipe.view.addToShopping"
      unelevated
      :loading="adding"
      :disable="chosen.length === 0"
    />
  </q-form>
</template>

<style scoped>
.recipe-ingredients__name {
  overflow-wrap: anywhere;
}
</style>
