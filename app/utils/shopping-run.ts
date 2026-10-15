import type { MealPlanEntry } from "~/types/meal-plan";
import type { Recipe } from "~/types/recipe";
import type { LocalDate } from "./local-date";

// What the button that puts the plan's ingredients on the shopping list
// says and covers, worked out from the entries: the page only renders it,
// and composables/meals-on-shopping-list.ts runs it.

/** An entry whose ingredients are still to go on the shopping list, with its
 * recipe. Only the entry's id is needed, to note it as on the list. */
export interface MealToPutOnList {
  meal: { id: string };
  recipe: Recipe;
}

/** How many entries the run leaves out, by reason. */
export interface LeftOutOfRun {
  /** Entries marked as not cooked. */
  skipped: number;
  /** Entries with a title and no recipe: they have no ingredients. */
  withoutRecipe: number;
  /** Entries whose recipe was removed. */
  recipeRemoved: number;
}

/** The entries of a run and the ones it leaves out. */
export interface ShoppingRun {
  pending: MealToPutOnList[];
  leftOut: LeftOutOfRun;
}

/**
 * The entries whose ingredients a run puts on the list: from `today` on,
 * since what was eaten needs no shopping, and not on the list yet. A recipe
 * planned three times is there three times. Skipped entries, entries without
 * a recipe and entries whose recipe was removed are left out and counted, so
 * the notice can say why.
 */
export function planShoppingRun(
  entries: readonly MealPlanEntry[],
  today: LocalDate,
  findRecipe: (id: string) => Recipe | null,
): ShoppingRun {
  const run: ShoppingRun = {
    pending: [],
    leftOut: { skipped: 0, withoutRecipe: 0, recipeRemoved: 0 },
  };
  for (const entry of entries) {
    if (entry.deleted_at || entry.date < today || entry.on_shopping_list_at)
      continue;
    if (entry.skipped_at) {
      run.leftOut.skipped += 1;
      continue;
    }
    if (!entry.recipe_id) {
      run.leftOut.withoutRecipe += 1;
      continue;
    }
    const recipe = findRecipe(entry.recipe_id);
    if (recipe) run.pending.push({ meal: entry, recipe });
    else run.leftOut.recipeRemoved += 1;
  }
  return run;
}

/** How many ingredients the button would put on the list. */
export function ingredientCount(pending: readonly MealToPutOnList[]): number {
  return pending.reduce(
    (sum, { recipe }) => sum + recipe.ingredients.length,
    0,
  );
}

/** The label of the button that puts the ingredients on the list. */
export function putOnListLabel(count: number): string {
  return `Put ${count} ${count === 1 ? "ingredient" : "ingredients"} on the shopping list`;
}

/** The notice after a run: how many items were added, then in one line which
 * entries were left out and why. Never more than two lines. */
export function shoppingRunNotice(
  items: number,
  leftOut: LeftOutOfRun,
): string[] {
  const lines = [
    items === 1
      ? "1 item added to the shopping list"
      : `${items} items added to the shopping list`,
  ];
  const reasons = [
    leftOut.withoutRecipe > 0 && `${leftOut.withoutRecipe} without a recipe`,
    leftOut.skipped > 0 && `${leftOut.skipped} skipped`,
    leftOut.recipeRemoved > 0 &&
      `${leftOut.recipeRemoved} whose recipe was removed`,
  ].filter((reason): reason is string => !!reason);
  if (reasons.length > 0) lines.push(`Left out: ${reasons.join(", ")}`);
  return lines;
}

/** What the page says when the run stopped at a meal: which meal, and how
 * many were put on the list before it. */
export function putOnListFailureLine(title: string, mealsDone: number): string {
  const done =
    mealsDone === 0
      ? "The button tries again."
      : `${mealsDone} ${mealsDone === 1 ? "meal was" : "meals were"} added; the button adds the rest.`;
  return `Couldn't add ${title}. ${done}`;
}
