import type { ShoppingItem } from "~/types/shopping";
import type { MealToPutOnList } from "~/utils/shopping-run";
import { errorMessage } from "~/utils/error-message";

/** What the shopping list and the plan give the run: the list's add of
 * several items, which says how many it saved, and the note that a meal is
 * on the list. Passed in so the run needs no Nuxt runtime. */
export interface ShoppingListWrites {
  addAll: (
    entries: Pick<ShoppingItem, "title" | "quantity">[],
  ) => Promise<number>;
  markMealOnList: (mealId: string) => Promise<void>;
}

/** How a run ended. */
export interface PutOnListOutcome {
  /** Items saved on the shopping list. */
  items: number;
  /** Meals whose ingredients are all on the list and are noted as such. */
  meals: number;
  /** The first meal that could not be completed, with the reason; the run
   * stops there. Null when every meal went through. */
  failure: { title: string; reason: string } | null;
}

/**
 * Puts the ingredients of the given meals on the shopping list, one meal
 * after another: `addAll` says only how many items it saved, so a call per
 * meal is what tells whether that meal is complete. A meal is noted as on
 * the list only once all its ingredients are saved. One saved in part is not
 * noted, and trying again adds it once more, as pressing a recipe's own
 * button twice does.
 */
export async function putMealsOnShoppingList(
  pending: readonly MealToPutOnList[],
  writes: ShoppingListWrites,
): Promise<PutOnListOutcome> {
  const outcome: PutOnListOutcome = { items: 0, meals: 0, failure: null };
  for (const { meal, recipe } of pending) {
    try {
      const entries = recipe.ingredients.map((ingredient) => ({
        title: ingredient.name,
        quantity: ingredient.quantity,
      }));
      const saved = entries.length > 0 ? await writes.addAll(entries) : 0;
      outcome.items += saved;
      if (saved < entries.length) {
        outcome.failure = {
          title: recipe.title,
          reason: "Not every ingredient could be saved.",
        };
        return outcome;
      }
      await writes.markMealOnList(meal.id);
      outcome.meals += 1;
    } catch (e) {
      outcome.failure = { title: recipe.title, reason: errorMessage(e) };
      return outcome;
    }
  }
  return outcome;
}
