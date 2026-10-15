import type { MealPlanEntry } from "~/types/meal-plan";
import type { Recipe } from "~/types/recipe";
import { dinnerSuggestionOrder, type DinnerCandidate } from "./dinner-order";
import { COOKED_LOOKBACK_WEEKS, mondayOf } from "./meal-week";
import { addDays, daysBetween, type LocalDate } from "./local-date";

/** What the proposer looks at of an entry. */
type SuggestionEntry = Pick<
  MealPlanEntry,
  "date" | "slot" | "recipe_id" | "skipped_at" | "deleted_at"
>;

/** A recipe, as the proposer needs it. */
type SuggestionRecipe = Pick<Recipe, "id" | "title">;

/** What a proposer knows of the household. */
export interface SuggestionContext<R extends SuggestionRecipe> {
  recipes: readonly R[];
  /** The plan's entries; removed, skipped and title-only ones are ignored. */
  entries: readonly SuggestionEntry[];
  /** Recipes a child refused, to propose last (see refusalsByRecipe). */
  demoted: ReadonlySet<string>;
}

/** What to propose dinners for. */
export interface DinnerFillRequest {
  /** The days to propose a dinner for, in order. */
  days: readonly LocalDate[];
  /** Dinners proposed already and kept, by day: they count as planned. */
  kept: Readonly<Record<LocalDate, string>>;
  /** Recipes not to propose again for a day, where any other is left. */
  avoid?: Readonly<Record<LocalDate, readonly string[]>>;
}

/**
 * Proposes dinners. The dashboard's Tonight tile and the week's "Fill my week"
 * ask through this interface, not a function of their own, so that another
 * way to propose (a model, other rules) replaces one object, and both places
 * stay alike. It is pure: no store, no clock, the day is a parameter.
 */
export interface MealSuggester {
  /** The recipes in the order the Tonight tile proposes them for `day`. */
  dinnerOrder<R extends SuggestionRecipe>(
    context: SuggestionContext<R>,
    day: LocalDate,
  ): DinnerCandidate<R>[];
  /** A recipe id for each requested day; none when there is no recipe. */
  fillDinners<R extends SuggestionRecipe>(
    context: SuggestionContext<R>,
    request: DinnerFillRequest,
  ): Record<LocalDate, string>;
}

/** How often a recipe may be proposed in a week before it is left out,
 * where enough others remain. */
export const MAX_USES_PER_WEEK = 2;

/** A dinner of the plan that counts: not removed, not skipped, a recipe. */
function isLiveRecipeDinner(entry: SuggestionEntry): boolean {
  return (
    entry.slot === "dinner" &&
    !entry.deleted_at &&
    !entry.skipped_at &&
    entry.recipe_id !== null
  );
}

/** The days on which each recipe is a dinner: planned, cooked or kept. */
type UsesByRecipe = Map<string, LocalDate[]>;

function addUse(uses: UsesByRecipe, recipeId: string, day: LocalDate) {
  uses.set(recipeId, [...(uses.get(recipeId) ?? []), day]);
}

/** How far `day` is from the nearest other day the recipe is a dinner,
 * before or after it, within the lookback; Infinity when there is none. */
function distanceToNearestUse(
  uses: readonly LocalDate[],
  day: LocalDate,
): number {
  const earliest = addDays(day, -COOKED_LOOKBACK_WEEKS * 7);
  let nearest = Infinity;
  for (const use of uses) {
    if (use < earliest) continue;
    nearest = Math.min(nearest, Math.abs(daysBetween(use, day)));
  }
  return nearest;
}

/**
 * The best recipe for one day of a fill. Recipes that are dinners twice in
 * that day's week already are left out where others remain, and so are
 * those in `avoid`, or when none other remains, at least the last of them,
 * so that a re-roll moves on: moving on beats the cap, the rest of `avoid`
 * does not. Then: not refused by a child first, then the
 * one furthest from any other day it was cooked or is planned on, then the
 * one used least in the week, then by title and id, so that every device
 * proposes the same.
 */
function bestFor<R extends SuggestionRecipe>(
  context: SuggestionContext<R>,
  uses: UsesByRecipe,
  day: LocalDate,
  avoid: readonly string[],
): R | undefined {
  const monday = mondayOf(day);
  const sunday = addDays(monday, 6);
  const usesInWeek = (recipe: R) =>
    (uses.get(recipe.id) ?? []).filter((use) => monday <= use && use <= sunday)
      .length;
  const capped = (recipe: R) => usesInWeek(recipe) < MAX_USES_PER_WEEK;
  const fresh = (recipe: R) => !avoid.includes(recipe.id);
  const notCurrent = (recipe: R) => recipe.id !== avoid.at(-1);
  // The first of these that holds any recipe. The cap goes before the walk
  // through what was proposed, but not before moving off the current
  // proposal: a re-roll moves on even where only a recipe used twice
  // already is left, rather than repeat itself.
  const pools = [
    (recipe: R) => capped(recipe) && fresh(recipe),
    (recipe: R) => capped(recipe) && notCurrent(recipe),
    fresh,
    notCurrent,
  ].map((keep) => context.recipes.filter(keep));
  const pool = pools.find((candidates) => candidates.length > 0) ?? [
    ...context.recipes,
  ];
  const ranked = pool.map((recipe) => ({
    recipe,
    demoted: context.demoted.has(recipe.id),
    distance: distanceToNearestUse(uses.get(recipe.id) ?? [], day),
    inWeek: usesInWeek(recipe),
  }));
  ranked.sort(
    (a, b) =>
      Number(a.demoted) - Number(b.demoted) ||
      // Infinity - Infinity is NaN, which sort takes as a tie.
      (a.distance === b.distance ? 0 : b.distance - a.distance) ||
      a.inWeek - b.inWeek ||
      a.recipe.title.localeCompare(b.recipe.title, undefined, {
        sensitivity: "base",
      }) ||
      a.recipe.id.localeCompare(b.recipe.id),
  );
  return ranked[0]?.recipe;
}

/**
 * Proposes from the household's own recipes, without a model: the Tonight
 * order of dinnerSuggestionOrder, and for a week, day by day, the recipe that
 * is furthest from the days it was cooked or is planned on. Each day's pick
 * counts as planned for the days after it, so a small repertoire spreads
 * over the week instead of repeating its first recipe.
 */
export const repertoireSuggester: MealSuggester = {
  dinnerOrder(context, day) {
    return dinnerSuggestionOrder(
      [...context.recipes],
      [...context.entries],
      day,
      context.demoted,
    );
  },

  fillDinners(context, request) {
    const uses: UsesByRecipe = new Map();
    for (const entry of context.entries)
      if (isLiveRecipeDinner(entry)) addUse(uses, entry.recipe_id!, entry.date);
    for (const [day, recipeId] of Object.entries(request.kept))
      addUse(uses, recipeId, day);

    const proposed: Record<LocalDate, string> = {};
    for (const day of request.days) {
      const pick = bestFor(context, uses, day, request.avoid?.[day] ?? []);
      if (!pick) break;
      proposed[day] = pick.id;
      addUse(uses, pick.id, day);
    }
    return proposed;
  },
};
