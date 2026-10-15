<script setup lang="ts">
import type { Recipe } from "~/types/recipe";

/**
 * Asks what to put on a day's dinner: a recipe of the household or a few
 * words ("toast"). A plain form, so it works without the extras: the text
 * field, then a button for each recipe that matches it, then the button that
 * adds the text as it is. It only reports the choice; saving is the page's.
 */
const props = defineProps<{
  /** The day, as a member reads it ("Tue 20 Oct"). */
  dayLabel: string;
  recipes: Recipe[];
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  choose: [choice: { recipeId: string | null; title: string | null }];
}>();

const query = ref("");
const blank = ref(false);

/** Recipes whose title contains what was typed, ignoring case; every recipe
 * while nothing is typed. Capped, so a long list doesn't push the form off a
 * phone's screen. */
const matches = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  return props.recipes
    .filter((recipe) => recipe.title.toLocaleLowerCase().includes(needle))
    .slice(0, 8);
});

watch(open, (isOpen) => {
  if (!isOpen) return;
  query.value = "";
  blank.value = false;
});

function chooseRecipe(recipe: Recipe) {
  emit("choose", { recipeId: recipe.id, title: null });
  open.value = false;
}

function chooseTypedText() {
  const title = query.value.trim();
  if (!title) {
    blank.value = true;
    return;
  }
  emit("choose", { recipeId: null, title });
  open.value = false;
}
</script>

<template>
  <q-dialog v-model="open">
    <q-card class="add-meal-dialog">
      <form class="add-meal-dialog__form" @submit.prevent="chooseTypedText">
        <h2
          class="text-h6 q-my-none"
          :data-testid="TEST_IDS.meals.dialog.title"
        >
          Dinner on {{ dayLabel }}
        </h2>
        <q-input
          v-model="query"
          label="What will you eat?"
          maxlength="200"
          autofocus
          outlined
          :data-testid="TEST_IDS.meals.dialog.input"
          @update:model-value="blank = false"
        />
        <p
          v-if="blank"
          class="text-negative q-my-none"
          role="alert"
          :data-testid="TEST_IDS.meals.dialog.error"
        >
          Write what you will eat
        </p>
        <ul v-if="matches.length > 0" role="list" class="add-meal-dialog__list">
          <li v-for="recipe in matches" :key="recipe.id">
            <q-btn
              flat
              no-caps
              align="left"
              class="touch-target full-width"
              :label="recipe.title"
              :data-testid="TEST_IDS.meals.dialog.recipe"
              @click="chooseRecipe(recipe)"
            />
          </li>
        </ul>
        <div class="add-meal-dialog__actions">
          <q-btn
            flat
            no-caps
            class="touch-target"
            label="Cancel"
            @click="open = false"
          />
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            class="touch-target"
            :label="
              query.trim() ? `Add “${query.trim()}” as text` : 'Add as text'
            "
            :data-testid="TEST_IDS.meals.dialog.addText"
          />
        </div>
      </form>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.add-meal-dialog {
  width: min(24rem, 100vw - 32px);
}

.add-meal-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.add-meal-dialog__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.add-meal-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
