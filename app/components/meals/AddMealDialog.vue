<script setup lang="ts">
import type { MealSlot } from "~/types/meal-plan";
import type { Recipe } from "~/types/recipe";

/**
 * Asks what to put in a day's slot: a recipe of the household or a few
 * words ("toast"). A plain form, so it works without the extras: the text
 * field, then a button for each recipe that matches it, then the button that
 * adds the text as it is. With `chooseSlot`, radios for the slot stand above
 * the field, so that one button per day adds any meal (see
 * docs/features/meal-planner/week-layout.md). It only reports the choice;
 * saving is the page's.
 */
const props = defineProps<{
  /** The day, as a member reads it ("Tue 20 Oct"). */
  dayLabel: string;
  /** The slot, as a member reads it ("Dinner"); the title's when the slot
   * is not chosen here. */
  slotLabel: string;
  recipes: Recipe[];
  /** Whether the dialog asks for the slot, which `mealSlot` then holds. */
  chooseSlot?: boolean;
}>();
const open = defineModel<boolean>({ required: true });
/** The slot chosen in the radios; only read with `chooseSlot`. */
const mealSlot = defineModel<MealSlot>("mealSlot", { default: "dinner" });
const emit = defineEmits<{
  choose: [choice: { recipeId: string | null; title: string | null }];
}>();

/** The radios in the order the day runs. */
const SLOTS_BY_TIME: readonly MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];
// The prop `slotLabel` shadows the auto-imported helper in the template.
const slotLabelOf = slotLabel;

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
          <template v-if="chooseSlot">Add to {{ dayLabel }}</template>
          <template v-else>{{ slotLabel }} on {{ dayLabel }}</template>
        </h2>
        <!-- Native radios, so the choice works without Quasar's extras;
             each label is the button a thumb presses. -->
        <fieldset v-if="chooseSlot" class="add-meal-dialog__slots">
          <legend class="add-meal-dialog__legend text-muted">Meal</legend>
          <label
            v-for="choice in SLOTS_BY_TIME"
            :key="choice"
            class="add-meal-dialog__slot"
          >
            <input
              v-model="mealSlot"
              type="radio"
              name="slot"
              :value="choice"
              :data-testid="TEST_IDS.meals.dialog.slot"
            />
            {{ slotLabelOf(choice) }}
          </label>
        </fieldset>
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

/* Four buttons in a row, the chosen one filled. */
.add-meal-dialog__slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
}

.add-meal-dialog__legend {
  margin-bottom: 4px;
  padding: 0;
  font-size: 0.8125rem;
}

.add-meal-dialog__slot {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 44px;
  border: 1px solid var(--theme-outline);
  border-radius: 4px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

/* The radio itself is pressed, laid unseen over its label. */
.add-meal-dialog__slot input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.add-meal-dialog__slot:has(input:checked) {
  background: var(--q-primary);
  border-color: var(--q-primary);
  color: var(--theme-on-accent);
}

.add-meal-dialog__slot:has(input:focus-visible) {
  outline: 2px solid var(--theme-text);
  outline-offset: 2px;
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
