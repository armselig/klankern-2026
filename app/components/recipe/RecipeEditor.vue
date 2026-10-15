<script setup lang="ts">
import { Notify } from "quasar";
import type { Recipe, RecipeContent } from "~/types/recipe";
import type { RecipeDraft } from "~/utils/recipe-draft";

/**
 * The form for a new recipe, or for the recipe with `recipeId`. A new
 * recipe can be made of a meal plan entry that has only a title
 * (`fromEntry`): the form starts with that title, and the saved recipe
 * takes the entry's title's place.
 */
const props = defineProps<{
  householdId: string;
  recipeId?: string;
  fromEntry?: { id: string; title: string };
}>();
const recipeStore = useRecipeStore();
const mealPlanStore = useMealPlanStore();
const router = useRouter();

onMounted(() => recipeStore.load(props.householdId));

const recipe = computed(() =>
  props.recipeId ? recipeStore.find(props.recipeId) : null,
);

/** The recipe as it was when the form opened. A save sends only what
 * differs from it, so that it doesn't overwrite a field another member
 * changed while the form was open. */
const original = shallowRef<Recipe | null>(null);
const initialDraft = shallowRef<RecipeDraft | null>(
  props.recipeId
    ? null
    : { ...emptyRecipeDraft(), title: props.fromEntry?.title ?? "" },
);

watch(
  recipe,
  (current) => {
    if (current && !original.value) {
      // Taken once, when the recipe is loaded: later changes by others
      // must not replace what is being typed.
      original.value = current;
      initialDraft.value = recipeDraftFrom(current);
    } else if (!current && original.value && recipeStore.householdId) {
      // Another member removed the recipe: there is nothing left to save to.
      Notify.create({
        message: "This recipe was removed.",
        attrs: { "data-testid": TEST_IDS.recipe.removedNotice },
      });
      void router.replace(ROUTES.recipes);
    }
  },
  { immediate: true },
);

const cancelTo = computed(() => {
  if (props.recipeId) return ROUTES.recipe(props.recipeId);
  return props.fromEntry ? ROUTES.meals : ROUTES.recipes;
});

const saving = ref(false);

/** Puts the saved recipe in the place of the entry it was made of. The
 * recipe is saved either way; a failure only leaves the entry's title. */
async function putInPlaceOfEntry(entryId: string, recipeId: string) {
  if (await mealPlanStore.makeRecipeOf(entryId, recipeId)) return;
  Notify.create({
    message: "The recipe is saved, but the meal plan still shows the title.",
    color: "negative",
    textColor: "on-accent",
    attrs: { "data-testid": TEST_IDS.errorMessage },
  });
}

/** Saves and shows the recipe. A failed save stays on the form, with what
 * was typed and the store's error. */
async function save(content: RecipeContent) {
  saving.value = true;
  try {
    if (!props.recipeId) {
      const id = await recipeStore.add(content);
      if (!id) return;
      if (props.fromEntry) await putInPlaceOfEntry(props.fromEntry.id, id);
      await router.replace(ROUTES.recipe(id));
    } else if (original.value) {
      const saved = await recipeStore.update(
        props.recipeId,
        changedRecipeFields(original.value, content),
      );
      if (saved) await router.replace(ROUTES.recipe(props.recipeId));
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <q-spinner v-if="recipeStore.loading" color="primary" />

    <!-- Only once the recipes are loaded: a save needs the household. -->
    <recipe-form
      v-else-if="recipeStore.householdId && initialDraft"
      :initial="initialDraft"
      :saving="saving"
      :error="recipeStore.error"
      :cancel-to="cancelTo"
      @save="save"
    />

    <template v-else>
      <p
        v-if="recipeStore.householdId"
        :data-testid="TEST_IDS.recipe.form.notFound"
      >
        This recipe doesn't exist, or it was removed.
        <nuxt-link :to="ROUTES.recipes">All recipes</nuxt-link>
      </p>
      <p
        v-if="recipeStore.error"
        class="text-negative"
        :data-testid="TEST_IDS.errorMessage"
      >
        {{ recipeStore.error }}
      </p>
    </template>
  </div>
</template>
