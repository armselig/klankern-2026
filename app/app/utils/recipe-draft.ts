import type { RecipeContent, RecipeIngredient } from "~/types/recipe";

/** The largest values the recipes table accepts (see its check constraints
 * in migration 0014), so the form can stop at them instead of letting the
 * save fail. */
export const RECIPE_LIMITS = {
  title: 200,
  servings: 50,
  ingredients: 100,
  ingredientName: 200,
  ingredientQuantity: 50,
  instructions: 20000,
} as const;

/** An ingredient row of the form: text inputs hold strings, also for a
 * quantity that is left empty. */
export interface IngredientDraft {
  id: string;
  name: string;
  quantity: string;
}

/**
 * What the recipe form edits. A copy, not the recipe in the store: a change
 * another member makes while the form is open must not overwrite what is
 * being typed.
 */
export interface RecipeDraft {
  title: string;
  servings: string;
  ingredients: IngredientDraft[];
  instructions: string;
}

/** A new, empty ingredient row. The id is the ingredient's for good: it
 * keys the row in the form and is saved with the recipe. */
export function emptyIngredientDraft(): IngredientDraft {
  return { id: crypto.randomUUID(), name: "", quantity: "" };
}

/** The draft of a recipe that doesn't exist yet. It starts with one
 * ingredient row, so the first ingredient can be typed without a click. */
export function emptyRecipeDraft(): RecipeDraft {
  return {
    title: "",
    servings: "",
    ingredients: [emptyIngredientDraft()],
    instructions: "",
  };
}

export function recipeDraftFrom(recipe: RecipeContent): RecipeDraft {
  return {
    title: recipe.title,
    servings: recipe.servings ?? "",
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      quantity: ingredient.quantity ?? "",
    })),
    instructions: recipe.instructions,
  };
}

/**
 * What a draft saves as: text trimmed, an empty servings or quantity field
 * as null, and ingredient rows without a name dropped, so an untouched row
 * needs no clearing away before saving.
 */
export function recipeContentFrom(draft: RecipeDraft): RecipeContent {
  return {
    title: draft.title.trim(),
    servings: draft.servings.trim() || null,
    ingredients: draft.ingredients
      .map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name.trim(),
        quantity: ingredient.quantity.trim() || null,
      }))
      .filter((ingredient) => ingredient.name !== ""),
    instructions: draft.instructions.trim(),
  };
}

function sameIngredients(
  a: readonly RecipeIngredient[],
  b: readonly RecipeIngredient[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (ingredient, index) =>
        ingredient.id === b[index]!.id &&
        ingredient.name === b[index]!.name &&
        ingredient.quantity === b[index]!.quantity,
    )
  );
}

/**
 * The fields an edit changed, which is all a save sends (see
 * updateRecipeRemote). The ingredients count as one field: they are one
 * column, so a change to any of them sends the whole list.
 */
export function changedRecipeFields(
  original: RecipeContent,
  edited: RecipeContent,
): Partial<RecipeContent> {
  const changes: Partial<RecipeContent> = {};
  if (edited.title !== original.title) changes.title = edited.title;
  if (edited.servings !== original.servings) changes.servings = edited.servings;
  if (!sameIngredients(edited.ingredients, original.ingredients))
    changes.ingredients = edited.ingredients;
  if (edited.instructions !== original.instructions)
    changes.instructions = edited.instructions;
  return changes;
}
