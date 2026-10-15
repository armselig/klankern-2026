<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import type { Recipe } from "~/types/recipe";

/**
 * Picks recipes as meals. The dialog stays open after a pick, so a week of
 * dinners is not seven rounds of opening it and searching again, and a line
 * under the search says what was added: without it a member taps twice
 * because they can't tell that the first tap worked. The app's dialog with a
 * plain form inside, as the invite dialog is built; its errors are shown
 * inside it.
 */
const props = defineProps<{
  /** The household's recipes, in the order they are listed. */
  recipes: Recipe[];
  /** What the last pick did, such as "Added: Lentil soup (2 in the plan)";
   * null before the first pick of an opening. */
  addedLine: string | null;
  /** Why the last pick could not be saved. */
  error: string | null;
}>();
const emit = defineEmits<{ pick: [recipeId: string] }>();
/** Whether the dialog is shown; the page opens and closes it. */
const open = defineModel<boolean>({ required: true });

const query = ref("");
const shown = computed(() => recipesMatching(props.recipes, query.value));

// Every opening starts with an empty search.
watch(open, (isOpen) => {
  if (isOpen) query.value = "";
});
</script>

<template>
  <q-dialog v-model="open">
    <q-card style="width: 100%; max-width: 420px">
      <q-card-section>
        <h2 class="text-h6 q-my-none">Add a meal</h2>
        <q-input
          v-model="query"
          label="Search recipes"
          :data-testid="TEST_IDS.vacation.meals.dialog.search"
          class="q-mt-sm"
          clearable
          autofocus
        />
        <!-- Said aloud: the list below is not where a screen reader's
             focus is. -->
        <p
          role="status"
          class="picker__status q-mb-none"
          :data-testid="TEST_IDS.vacation.meals.dialog.status"
        >
          {{ addedLine }}
        </p>
        <p
          v-if="error"
          role="alert"
          class="text-negative q-mt-sm q-mb-none"
          :data-testid="TEST_IDS.errorMessage"
        >
          {{ error }}
        </p>
      </q-card-section>

      <q-card-section class="picker__list q-pt-none">
        <q-list v-if="shown.length > 0" bordered separator>
          <q-item
            v-for="recipe in shown"
            :key="recipe.id"
            :data-testid="TEST_IDS.vacation.meals.dialog.recipe"
          >
            <q-item-section class="picker__title">{{
              recipe.title
            }}</q-item-section>
            <q-item-section side>
              <q-btn
                flat
                :icon="mdiPlus"
                label="Add"
                :aria-label="`Add ${recipe.title}`"
                :data-testid="TEST_IDS.vacation.meals.dialog.add"
                class="touch-target picker__add"
                @click="emit('pick', recipe.id)"
              />
            </q-item-section>
          </q-item>
        </q-list>
        <p
          v-else
          class="text-muted q-mb-none"
          :data-testid="TEST_IDS.vacation.meals.dialog.noMatch"
        >
          No recipe matches.
        </p>
      </q-card-section>

      <q-card-actions align="right">
        <!-- No color for the flat button; see SharedWhiteboard.vue. -->
        <q-btn
          v-close-popup
          flat
          label="Done"
          :data-testid="TEST_IDS.vacation.meals.dialog.done"
          class="touch-target"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
/* The list scrolls inside the dialog, so Done stays in reach. */
.picker__list {
  max-height: 50vh;
  overflow-y: auto;
}

.picker__status {
  min-height: 1.5rem;
  margin-top: 4px;
}

/* A list item's side section is grey (#757575), and a flat button takes the
   color of its text: below 4.5:1 on the dialog's surface. */
.picker__add {
  color: var(--theme-text);
}

.picker__title {
  overflow-wrap: anywhere;
}
</style>
