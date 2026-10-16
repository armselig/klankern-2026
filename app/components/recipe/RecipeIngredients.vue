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

/** One tick box springs at a time: the one the person just ticked. Only
 * the overshoot, since a chosen ingredient is not struck through. */
const { drawing, startFromTap, endDrawing } = useTickDrawing(
  TICK_SPRING_ANIMATION,
);
const springingIngredient = ref<string | null>(null);
const springingId = computed(() =>
  drawing.value ? springingIngredient.value : null,
);

/** The person's own tap: springs the box when it is ticked, then changes
 * the choice. */
function chooseFromTap(id: string, isChosen: boolean) {
  springingIngredient.value = id;
  startFromTap(isChosen);
  setChosen(id, isChosen);
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
            :class="{ 'list-tick--drawing': springingId === ingredient.id }"
            :data-testid="TEST_IDS.recipe.view.ingredient"
            @update:model-value="(value) => chooseFromTap(ingredient.id, value)"
            @animationend="endDrawing"
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
