<script setup lang="ts">
import { mdiArrowLeft, mdiCartPlus, mdiPlus } from "@quasar/extras/mdi-v7";
import { Dialog, Notify } from "quasar";
import { putMealsOnShoppingList } from "~/composables/meals-on-shopping-list";

/**
 * The plan of a trip's meals: the recipes picked for it, and the one button
 * that puts their ingredients on the household's shopping list. The page
 * only renders and wires; what the lines say is worked out in
 * utils/vacation-meals.ts and the run of the button in
 * composables/meals-on-shopping-list.ts.
 */
const props = defineProps<{ householdId: string; vacationId: string }>();
const vacationStore = useVacationStore();
const recipeStore = useRecipeStore();
const shoppingStore = useShoppingStore();

onMounted(() => {
  void vacationStore.load(props.householdId);
  void recipeStore.load(props.householdId);
});

const vacation = computed(() => vacationStore.find(props.vacationId));
const meals = computed(() => vacationStore.mealsOf(props.vacationId));
/** A meal's recipe is looked up in the recipes, so a meal can only be
 * drawn once they are loaded: before that every recipe would be "removed". */
const recipesLoaded = computed(
  () => recipeStore.householdId === props.householdId,
);
const pending = computed(() =>
  mealsToPutOnList(meals.value, (id) => recipeStore.find(id)),
);
const summary = computed(() =>
  mealsSummary(meals.value, recipesLoaded.value ? pending.value.length : null),
);
const everyMealOnList = computed(() =>
  meals.value.every((meal) => meal.on_shopping_list_at),
);

interface MealRowHandle {
  focusRemove: () => void;
}
/** The rows by meal id, to put the focus on one after the list changed. */
const rows = new Map<string, MealRowHandle>();

function rememberRow(id: string, row: unknown) {
  if (row) rows.set(id, row as MealRowHandle);
  else rows.delete(id);
}

const addButton = useTemplateRef<{ $el: HTMLElement }>("addButton");

const pickerOpen = ref(false);
const addedLine = ref<string | null>(null);
const pickError = ref<string | null>(null);

// Every opening starts without what the last one said.
watch(pickerOpen, (isOpen) => {
  if (!isOpen) return;
  addedLine.value = null;
  pickError.value = null;
});

/** Picks a recipe as a meal. The row appears at once, so the count after
 * the pick can be read before the save is over. */
async function pickRecipe(recipeId: string) {
  pickError.value = null;
  const saved = vacationStore.addMeal(props.vacationId, recipeId);
  const recipe = recipeStore.find(recipeId);
  const inPlan = meals.value.filter(
    (meal) => meal.recipe_id === recipeId,
  ).length;
  addedLine.value = recipe ? mealAddedLine(recipe.title, inPlan) : null;
  const reason = await saved;
  if (reason) {
    pickError.value = reason;
    addedLine.value = null;
  }
}

/** Takes a meal out of the plan, after asking when its ingredients are on
 * the shopping list: they stay there, since nothing records which items
 * came from which meal. */
function removeMeal(id: string) {
  const meal = meals.value.find((other) => other.id === id);
  if (!meal) return;
  if (!meal.on_shopping_list_at) {
    void takeOut(id);
    return;
  }
  Dialog.create({
    title: "Remove this meal?",
    message: "Its ingredients stay on the shopping list. Remove the meal?",
    // No color for the flat button; see SharedWhiteboard.vue.
    cancel: withTestId(
      { label: "Cancel", flat: true, color: undefined },
      TEST_IDS.confirmDialog.cancel,
    ),
    ok: withTestId(
      { label: "Remove", color: "negative", unelevated: true },
      TEST_IDS.confirmDialog.ok,
    ),
  }).onOk(() => takeOut(id));
}

/** Removes the meal and moves the focus on: its row had it and is gone. To
 * the remove button of the row that follows, or to "Add meal" after the
 * last one. */
async function takeOut(id: string) {
  const index = meals.value.findIndex((meal) => meal.id === id);
  const next = meals.value[index + 1];
  void vacationStore.removeMeal(id);
  await nextTick();
  if (next) rows.get(next.id)?.focusRemove();
  else addButton.value?.$el.focus();
}

const putting = ref(false);
/** What stays under the button after a run stopped at a meal, until a later
 * run goes through. */
const failureLine = ref<string | null>(null);

/** Puts the ingredients of the meals that wait on the shopping list. The
 * list has to be loaded first: it is the shopping page that usually does. */
async function putOnShoppingList() {
  putting.value = true;
  failureLine.value = null;
  try {
    await shoppingStore.ensureLoaded(props.householdId);
    // Loading failed; the store's error says why.
    if (!shoppingStore.listId) {
      failureLine.value =
        shoppingStore.error ?? "The shopping list could not be loaded.";
      return;
    }
    const outcome = await putMealsOnShoppingList(pending.value, {
      addAll: (entries) => shoppingStore.addAll(entries),
      markMealOnList: (id) => vacationStore.markMealOnShoppingList(id),
    });
    if (outcome.items > 0) {
      Notify.create({
        message:
          outcome.items === 1
            ? "1 item added to the shopping list"
            : `${outcome.items} items added to the shopping list`,
        // Not "positive": see RecipeView.vue.
        color: "primary",
        textColor: "on-accent",
        attrs: { "data-testid": TEST_IDS.vacation.meals.addedNotice },
      });
    }
    if (outcome.failure) {
      failureLine.value = putOnListFailureLine(
        outcome.failure.title,
        outcome.meals,
      );
    }
  } finally {
    putting.value = false;
  }
}
</script>

<template>
  <div>
    <!-- An installed app has no back button of its own on every device. -->
    <q-btn
      flat
      :to="ROUTES.vacation(vacationId)"
      :icon="mdiArrowLeft"
      :label="vacation ? `Back to ${vacation.title}` : 'Back'"
      :data-testid="TEST_IDS.vacation.meals.back"
      class="touch-target q-mb-xs vacation-meals__back"
    />

    <div v-if="vacationStore.loading || recipeStore.loading">
      <q-spinner color="primary" />
    </div>

    <article v-else-if="vacation && recipesLoaded">
      <h2 class="text-h6 vacation-meals__title">Meals</h2>
      <p
        class="text-muted q-mb-md"
        :data-testid="TEST_IDS.vacation.meals.summary"
      >
        {{ summary }}
      </p>

      <ul
        v-if="meals.length > 0"
        role="list"
        class="vacation-meals__list q-mb-md"
      >
        <meal-row
          v-for="meal in meals"
          :key="meal.id"
          :ref="(row) => rememberRow(meal.id, row)"
          :meal="meal"
          :recipe="recipeStore.find(meal.recipe_id)"
          @remove="removeMeal"
        />
      </ul>
      <p v-else class="q-mb-md" :data-testid="TEST_IDS.vacation.meals.noMeals">
        No meals yet. Pick recipes for the trip, then put their ingredients on
        the shopping list.
      </p>

      <q-btn
        v-if="recipeStore.visible.length > 0"
        ref="addButton"
        flat
        :icon="mdiPlus"
        label="Add meal"
        :data-testid="TEST_IDS.vacation.meals.add"
        class="touch-target"
        @click="pickerOpen = true"
      />
      <template v-else>
        <p class="q-mb-sm" :data-testid="TEST_IDS.vacation.meals.noRecipes">
          The household has no recipes yet.
        </p>
        <q-btn
          flat
          no-caps
          :to="ROUTES.recipeNew"
          label="Write a recipe"
          :data-testid="TEST_IDS.vacation.meals.writeRecipe"
          class="touch-target"
        />
      </template>

      <div v-if="meals.length > 0" class="q-mt-md">
        <q-btn
          v-if="pending.length > 0"
          color="primary"
          :icon="mdiCartPlus"
          :label="putOnListLabel(ingredientCount(pending))"
          :data-testid="TEST_IDS.vacation.meals.putOnList"
          :loading="putting"
          unelevated
          no-caps
          class="touch-target"
          @click="putOnShoppingList"
        />
        <p v-else :data-testid="TEST_IDS.vacation.meals.allOnList">
          {{
            everyMealOnList
              ? "Everything is on the shopping list."
              : "Nothing more to put on the shopping list."
          }}
        </p>
        <p
          v-if="failureLine"
          role="alert"
          class="text-negative q-mt-sm q-mb-none"
          :data-testid="TEST_IDS.vacation.meals.failure"
        >
          {{ failureLine }}
        </p>
      </div>

      <p
        v-if="vacationStore.error"
        role="alert"
        class="text-negative q-mt-sm"
        :data-testid="TEST_IDS.errorMessage"
      >
        {{ vacationStore.error }}
      </p>

      <recipe-picker-dialog
        v-model="pickerOpen"
        :recipes="recipeStore.visible"
        :added-line="addedLine"
        :error="pickError"
        @pick="pickRecipe"
      />
    </article>

    <!-- Also for another household's vacation: RLS returns no row for it. -->
    <div
      v-else-if="vacationStore.householdId && !vacation"
      :data-testid="TEST_IDS.vacation.meals.notFound"
    >
      <h2 class="text-h6">Vacation not found</h2>
      <p>This vacation doesn't exist, or it was removed.</p>
    </div>

    <p
      v-else-if="vacationStore.error || recipeStore.error"
      role="alert"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ vacationStore.error ?? recipeStore.error }}
    </p>
  </div>
</template>

<style scoped>
/* A trip's title in the back button is one long word at worst. */
.vacation-meals__back {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.vacation-meals__title {
  margin: 8px 0 4px;
}

/* Framed as the lists of tasks are, with a hairline between the rows. */
.vacation-meals__list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--theme-separator);
}

.vacation-meals__list > :deep(li + li) {
  border-top: 1px solid var(--theme-separator);
}
</style>
