<script setup lang="ts">
import { mdiCheck, mdiDeleteOutline } from "@quasar/extras/mdi-v7";
import type { Recipe } from "~/types/recipe";
import type { VacationMeal } from "~/types/vacation";

/**
 * One meal in the plan, on one line: the recipe, whether its ingredients are
 * on the shopping list, and the way to take the meal out of the plan. The
 * state is an icon with a name and not words, which wrapped at 375 px.
 */
const props = defineProps<{
  meal: VacationMeal;
  /** The meal's recipe, or null once it was removed. */
  recipe: Recipe | null;
}>();
const emit = defineEmits<{ remove: [id: string] }>();

const removeButton = useTemplateRef<{ $el: HTMLElement }>("removeButton");

// Quasar's icon hides itself from screen readers; this one carries the
// meal's state, so it says that it is there.
const removeLabel = computed(() =>
  props.recipe ? `Remove ${props.recipe.title}` : "Remove this meal",
);

defineExpose({
  /** Puts the focus on the remove button, after the row before it went. */
  focusRemove: () => removeButton.value?.$el.focus(),
});
</script>

<template>
  <li class="meal-row" :data-testid="TEST_IDS.vacation.meals.row">
    <nuxt-link
      v-if="recipe"
      :to="ROUTES.recipe(recipe.id)"
      class="meal-row__title"
      :data-testid="TEST_IDS.vacation.meals.recipeLink"
      >{{ recipe.title }}</nuxt-link
    >
    <span
      v-else
      class="meal-row__title text-muted"
      :data-testid="TEST_IDS.vacation.meals.removedRecipe"
      >Recipe was removed</span
    >
    <q-icon
      v-if="meal.on_shopping_list_at"
      :name="mdiCheck"
      role="img"
      aria-hidden="false"
      aria-label="On the shopping list"
      size="sm"
      :data-testid="TEST_IDS.vacation.meals.onList"
    />
    <q-btn
      ref="removeButton"
      flat
      round
      :icon="mdiDeleteOutline"
      :aria-label="removeLabel"
      :data-testid="TEST_IDS.vacation.meals.remove"
      class="touch-target"
      @click="emit('remove', meal.id)"
    />
  </li>
</template>

<style scoped>
.meal-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 0 4px 0 12px;
}

/* A recipe's title is one long word at worst; it wraps rather than widening
   the page. */
.meal-row__title {
  flex: 1;
  min-width: 0;
  color: inherit;
  overflow-wrap: anywhere;
}
</style>
