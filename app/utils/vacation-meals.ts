import type { ItemsById } from "~/types/list";
import type { Recipe } from "~/types/recipe";
import type { VacationMeal } from "~/types/vacation";

// What the meals page and the link to it say, worked out from the rows: the
// components only render it. The rows follow the rules of the other rows of
// a vacation (see vacation-state.ts).

/** A meal and its recipe, for a meal whose ingredients are still to go on
 * the shopping list. */
export interface MealToPutOnList {
  meal: VacationMeal;
  recipe: Recipe;
}

/** A vacation's live meals in the order the plan lists them: by position,
 * and for equal positions in the order they were added. */
export function mealsOfVacation(
  mealsById: ItemsById<VacationMeal>,
  vacationId: string,
): VacationMeal[] {
  return Object.values(mealsById)
    .filter((meal) => meal.vacation_id === vacationId && !meal.deleted_at)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}

/** The meals whose ingredients are not on the shopping list yet, with their
 * recipes. A meal whose recipe was removed has nothing to put there and is
 * left out, as is one that is already on the list. */
export function mealsToPutOnList(
  meals: readonly VacationMeal[],
  findRecipe: (id: string) => Recipe | null,
): MealToPutOnList[] {
  const pending: MealToPutOnList[] = [];
  for (const meal of meals) {
    if (meal.on_shopping_list_at) continue;
    const recipe = findRecipe(meal.recipe_id);
    if (recipe) pending.push({ meal, recipe });
  }
  return pending;
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

/** The status of the link to the meals page, which is also what the page's
 * heading line says. A meal counts as on the list once it has been put
 * there; one whose recipe was removed is not counted as waiting, since
 * there is nothing of it to put. Which meals wait is only known once the
 * recipes are loaded: until then `waiting` is null and the line gives the
 * count alone, which is always true. */
export function mealsSummary(
  meals: readonly VacationMeal[],
  waiting: number | null,
): string {
  if (meals.length === 0) return "No meals yet";
  const count = `${meals.length} ${meals.length === 1 ? "meal" : "meals"}`;
  if (waiting === null) return count;
  if (waiting === 0) {
    return meals.length === 1
      ? `${count}, on the shopping list`
      : `${count}, all on the shopping list`;
  }
  return `${count}, ${waiting} not on the shopping list`;
}

/** The line under the picker's search after a recipe was added: what was
 * added, and how often the plan holds it now. */
export function mealAddedLine(title: string, inPlan: number): string {
  return `Added: ${title} (${inPlan} in the plan)`;
}

/** The recipes whose title holds what was typed, ignoring case and
 * accents. Nothing typed lists them all. */
export function recipesMatching(
  recipes: readonly Recipe[],
  query: string,
): Recipe[] {
  const needle = normalise(query.trim());
  if (!needle) return [...recipes];
  return recipes.filter((recipe) => normalise(recipe.title).includes(needle));
}

function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/** What the page says when the button stopped at a meal: which meal, and how
 * many were put on the list before it. */
export function putOnListFailureLine(title: string, mealsDone: number): string {
  const done =
    mealsDone === 0
      ? "The button tries again."
      : `${mealsDone} ${mealsDone === 1 ? "meal was" : "meals were"} added; the button adds the rest.`;
  return `Couldn't add ${title}. ${done}`;
}
