<script setup lang="ts">
import {
  mdiArrowLeft,
  mdiDeleteOutline,
  mdiPencilOutline,
} from "@quasar/extras/mdi-v7";
import { Dialog, Notify } from "quasar";
import type { RecipeIngredient } from "~/types/recipe";

const props = defineProps<{ householdId: string; recipeId: string }>();
const recipeStore = useRecipeStore();
const shoppingStore = useShoppingStore();
const router = useRouter();

onMounted(() => recipeStore.load(props.householdId));

const recipe = computed(() => recipeStore.find(props.recipeId));

/** Removing takes the recipe from every member and can't be undone, so it
 * asks first. The removal is optimistic, so the list is shown right away;
 * should it fail, the recipe is back there with the error. */
function confirmRemove() {
  const title = recipe.value?.title;
  Dialog.create({
    title: "Delete this recipe?",
    message: `This removes "${title}" for the whole family.`,
    // No color for the flat button; see SharedWhiteboard.vue.
    cancel: withTestId(
      { label: "Cancel", flat: true, color: undefined },
      TEST_IDS.confirmDialog.cancel,
    ),
    ok: withTestId(
      { label: "Delete", color: "negative", unelevated: true },
      TEST_IDS.confirmDialog.ok,
    ),
  }).onOk(async () => {
    void recipeStore.remove(props.recipeId);
    await router.replace(ROUTES.recipes);
  });
}

const addingToShoppingList = ref(false);

/** Puts the chosen ingredients on the household's shopping list, which this
 * page has to load first: it is the shopping page that usually does. */
async function addToShoppingList(ingredients: RecipeIngredient[]) {
  addingToShoppingList.value = true;
  try {
    await shoppingStore.ensureLoaded(props.householdId);
    // Loading failed; the store's error says why.
    if (!shoppingStore.listId) return;
    const saved = await shoppingStore.addAll(
      ingredients.map((ingredient) => ({
        title: ingredient.name,
        quantity: ingredient.quantity,
      })),
    );
    if (saved > 0) {
      Notify.create({
        message:
          saved === 1
            ? "1 item added to the shopping list"
            : `${saved} items added to the shopping list`,
        // Not "positive": no text color of the theme is readable on its
        // green in light mode. The primary color with the theme's text for
        // an accent is, in both modes (assets/css/theme.css).
        color: "primary",
        textColor: "on-accent",
        attrs: { "data-testid": TEST_IDS.recipe.addedNotice },
      });
    }
  } finally {
    addingToShoppingList.value = false;
  }
}
</script>

<template>
  <div>
    <!-- An installed app has no back button of its own on every device. -->
    <q-btn
      flat
      dense
      :to="ROUTES.recipes"
      :icon="mdiArrowLeft"
      label="All recipes"
      :data-testid="TEST_IDS.recipe.view.back"
      class="q-mb-sm"
    />

    <div v-if="recipeStore.loading"><q-spinner color="primary" /></div>

    <article v-else-if="recipe">
      <h2
        class="text-h6 recipe-view__text"
        :data-testid="TEST_IDS.recipe.view.title"
      >
        {{ recipe.title }}
      </h2>
      <p
        v-if="recipe.servings"
        class="text-muted recipe-view__text"
        :data-testid="TEST_IDS.recipe.view.servings"
      >
        Servings: {{ recipe.servings }}
      </p>

      <div class="row q-gutter-sm q-mb-md">
        <q-btn
          :to="ROUTES.recipeEdit(recipe.id)"
          color="primary"
          :icon="mdiPencilOutline"
          label="Edit"
          :data-testid="TEST_IDS.recipe.view.edit"
          unelevated
        />
        <q-btn
          flat
          :icon="mdiDeleteOutline"
          label="Delete"
          :data-testid="TEST_IDS.recipe.view.remove"
          @click="confirmRemove"
        />
      </div>

      <h3 class="text-subtitle1 text-weight-medium">Ingredients</h3>
      <recipe-ingredients
        v-if="recipe.ingredients.length > 0"
        :ingredients="recipe.ingredients"
        :adding="addingToShoppingList"
        @add="addToShoppingList"
      />
      <p v-else class="text-muted">No ingredients listed.</p>
      <p
        v-if="shoppingStore.error"
        class="text-negative"
        :data-testid="TEST_IDS.errorMessage"
      >
        {{ shoppingStore.error }}
      </p>

      <h3 class="text-subtitle1 text-weight-medium">Instructions</h3>
      <p
        v-if="recipe.instructions"
        class="recipe-view__instructions"
        :data-testid="TEST_IDS.recipe.view.instructions"
      >
        {{ recipe.instructions }}
      </p>
      <p v-else class="text-muted">No instructions written yet.</p>

      <template v-if="recipe.kids_version">
        <h3 class="text-subtitle1 text-weight-medium">Kids' version</h3>
        <p
          class="recipe-view__instructions"
          :data-testid="TEST_IDS.recipe.view.kidsVersion"
        >
          {{ recipe.kids_version }}
        </p>
      </template>
    </article>

    <!-- Also for another household's recipe: RLS returns no row for it. -->
    <div
      v-else-if="recipeStore.householdId"
      :data-testid="TEST_IDS.recipe.view.notFound"
    >
      <h2 class="text-h6">Recipe not found</h2>
      <p>This recipe doesn't exist, or it was removed.</p>
    </div>

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
.recipe-view__text {
  overflow-wrap: anywhere;
}

/* Plain text as it was typed: its line breaks are the steps. */
.recipe-view__instructions {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
