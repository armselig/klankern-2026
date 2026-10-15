<script setup lang="ts">
import { mdiDeleteOutline, mdiPlus } from "@quasar/extras/mdi-v7";
import type { RecipeContent } from "~/types/recipe";
import type { RecipeDraft } from "~/utils/recipe-draft";

const props = defineProps<{
  /** What the form starts with; it is copied, never changed. */
  initial: RecipeDraft;
  saving: boolean;
  error: string | null;
  /** Where "Cancel" leads. */
  cancelTo: string;
}>();
const emit = defineEmits<{ save: [content: RecipeContent] }>();

/** The form's own copy to type into (see RecipeDraft). Taken once on
 * purpose: a later change of `initial` must not replace what was typed. */
const draft = reactive<RecipeDraft>(structuredClone(toRaw(props.initial)));

/** A title of spaces only gets past the field's `required`. */
const titleMissing = ref(false);

interface Focusable {
  focus: () => void;
}
const titleInput = useTemplateRef<Focusable>("titleInput");
const addIngredientButton = useTemplateRef<{ $el: HTMLElement }>(
  "addIngredientButton",
);
/** The ingredient rows' name fields by ingredient id, to put the focus in a
 * row that was just added. */
const nameInputs = new Map<string, Focusable>();

function rememberNameInput(id: string, input: unknown) {
  if (input) nameInputs.set(id, input as Focusable);
  else nameInputs.delete(id);
}

/** Adds an empty row and puts the focus in it, so ingredients can be typed
 * one after the other. */
async function addIngredient() {
  const ingredient = emptyIngredientDraft();
  draft.ingredients.push(ingredient);
  await nextTick();
  nameInputs.get(ingredient.id)?.focus();
}

/** Removes a row. Its button had the focus and is gone with it, so the
 * focus moves to the button below the rows instead of being lost. */
function removeIngredient(id: string) {
  draft.ingredients = draft.ingredients.filter(
    (ingredient) => ingredient.id !== id,
  );
  addIngredientButton.value?.$el.focus();
}

function submit() {
  const content = recipeContentFrom(draft);
  titleMissing.value = content.title === "";
  if (titleMissing.value) {
    titleInput.value?.focus();
    return;
  }
  emit("save", content);
}
</script>

<template>
  <q-form class="q-gutter-y-md" @submit.prevent="submit">
    <q-input
      ref="titleInput"
      v-model="draft.title"
      label="Title"
      :data-testid="TEST_IDS.recipe.form.title"
      :maxlength="RECIPE_LIMITS.title"
      :error="titleMissing"
      error-message="Give the recipe a title."
      hide-bottom-space
      required
      autofocus
    />
    <q-input
      v-model="draft.servings"
      label="Servings (optional)"
      :data-testid="TEST_IDS.recipe.form.servings"
      :maxlength="RECIPE_LIMITS.servings"
    />

    <fieldset class="recipe-form__ingredients">
      <legend class="text-subtitle1 text-weight-medium">Ingredients</legend>
      <!-- Each row is a group with a name of its own, so its two fields and
           its button can be told from the other rows'. -->
      <div
        v-for="(ingredient, index) in draft.ingredients"
        :key="ingredient.id"
        role="group"
        :aria-label="`Ingredient ${index + 1}`"
        :data-testid="TEST_IDS.recipe.form.ingredientRow"
        class="row no-wrap items-center q-gutter-x-sm"
      >
        <q-input
          :ref="(input) => rememberNameInput(ingredient.id, input)"
          v-model="ingredient.name"
          label="Ingredient"
          :data-testid="TEST_IDS.recipe.form.ingredientName"
          :maxlength="RECIPE_LIMITS.ingredientName"
          class="col"
        />
        <q-input
          v-model="ingredient.quantity"
          label="Quantity (optional)"
          :data-testid="TEST_IDS.recipe.form.ingredientQuantity"
          :maxlength="RECIPE_LIMITS.ingredientQuantity"
          class="col-5"
        />
        <!-- Icon only, to keep rows narrow on phones; the name comes from aria-label. -->
        <q-btn
          flat
          dense
          round
          :icon="mdiDeleteOutline"
          :aria-label="`Remove ingredient ${index + 1}`"
          :data-testid="TEST_IDS.recipe.form.ingredientRemove"
          @click="removeIngredient(ingredient.id)"
        />
      </div>
      <q-btn
        ref="addIngredientButton"
        flat
        :icon="mdiPlus"
        label="Add ingredient"
        :data-testid="TEST_IDS.recipe.form.addIngredient"
        class="q-mt-sm"
        :disable="draft.ingredients.length >= RECIPE_LIMITS.ingredients"
        @click="addIngredient"
      />
    </fieldset>

    <q-input
      v-model="draft.instructions"
      type="textarea"
      label="Instructions"
      :data-testid="TEST_IDS.recipe.form.instructions"
      :maxlength="RECIPE_LIMITS.instructions"
      autogrow
    />

    <q-input
      v-model="draft.kidsVersion"
      type="textarea"
      label="Kids' version"
      :data-testid="TEST_IDS.recipe.form.kidsVersion"
      :maxlength="RECIPE_LIMITS.kidsVersion"
      aria-describedby="recipe-form-kids-hint"
      autogrow
    />
    <p id="recipe-form-kids-hint" class="text-muted q-mt-none">
      What is different for the kids, if anything.
    </p>

    <p
      v-if="error"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
      role="alert"
    >
      {{ error }}
    </p>

    <div class="row q-gutter-sm">
      <q-btn
        type="submit"
        color="primary"
        label="Save"
        :data-testid="TEST_IDS.recipe.form.save"
        unelevated
        :loading="saving"
      />
      <q-btn flat label="Cancel" :to="cancelTo" />
    </div>
  </q-form>
</template>

<style scoped>
/* A fieldset for its meaning only: the rows need no frame around them. */
.recipe-form__ingredients {
  min-width: 0;
  margin-inline: 0;
  padding: 0;
  border: 0;
}

.recipe-form__ingredients legend {
  padding: 0;
}
</style>
