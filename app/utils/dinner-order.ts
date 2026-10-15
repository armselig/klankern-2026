import type { MealPlanEntry } from "~/types/meal-plan";
import type { Recipe } from "~/types/recipe";
import { COOKED_LOOKBACK_WEEKS } from "./meal-week";
import { addDays, daysBetween, type LocalDate } from "./local-date";
import type { MealSuggester } from "./meal-suggester";

/** What the order looks at of an entry. */
type OrderEntry = Pick<
  MealPlanEntry,
  "date" | "slot" | "recipe_id" | "skipped_at" | "deleted_at"
>;

/** A recipe, as the order and the tile need it. */
type OrderRecipe = Pick<Recipe, "id" | "title">;

/** A recipe in the order of suggestions, with when it was last cooked. */
export interface DinnerCandidate<R extends OrderRecipe = OrderRecipe> {
  recipe: R;
  /** The day it was last planned for within the lookback, or null. */
  lastCooked: LocalDate | null;
}

/** A dinner of the plan that counts: not removed, not skipped, a recipe. */
function isLiveRecipeDinner(entry: OrderEntry): boolean {
  return (
    entry.slot === "dinner" &&
    !entry.deleted_at &&
    !entry.skipped_at &&
    entry.recipe_id !== null
  );
}

/**
 * The recipes in the order the Tonight tile proposes them to cook on `day`:
 * the one cooked longest ago first, one never cooked in the lookback before
 * all of them, ties by title so the order is the same on every device. The
 * recipes in `demoted`, which a child refused (see refusalsByRecipe), come
 * after all others, in the same order among themselves.
 *
 * Nothing records that a dinner was cooked; a planned dinner of an earlier day
 * counts as cooked unless it was skipped. Recipes already planned for `day` or
 * later are left out, since they are decided, unless that leaves none. Entries
 * with a title and no recipe don't take part: there is nothing to propose.
 */
export function dinnerSuggestionOrder<R extends OrderRecipe>(
  recipes: R[],
  entries: OrderEntry[],
  day: LocalDate,
  demoted: ReadonlySet<string> = new Set(),
): DinnerCandidate<R>[] {
  const earliest = addDays(day, -COOKED_LOOKBACK_WEEKS * 7);
  const lastCooked = new Map<string, LocalDate>();
  const planned = new Set<string>();
  for (const entry of entries) {
    if (!isLiveRecipeDinner(entry)) continue;
    const recipeId = entry.recipe_id!;
    if (entry.date >= day) {
      planned.add(recipeId);
    } else if (entry.date >= earliest) {
      const known = lastCooked.get(recipeId);
      if (!known || entry.date > known) lastCooked.set(recipeId, entry.date);
    }
  }
  const candidates = recipes.map((recipe) => ({
    recipe,
    lastCooked: lastCooked.get(recipe.id) ?? null,
  }));
  const open = candidates.filter(({ recipe }) => !planned.has(recipe.id));
  return (open.length > 0 ? open : candidates).sort(
    (a, b) =>
      Number(demoted.has(a.recipe.id)) - Number(demoted.has(b.recipe.id)) ||
      (a.lastCooked ?? "").localeCompare(b.lastCooked ?? "") ||
      a.recipe.title.localeCompare(b.recipe.title, undefined, {
        sensitivity: "base",
      }) ||
      a.recipe.id.localeCompare(b.recipe.id),
  );
}

/** What the Tonight tile shows besides loading and failing. */
export type TonightState<R extends OrderRecipe = OrderRecipe> =
  | {
      kind: "planned";
      /** The day's dinners by position; the first is the headline. */
      dinners: MealPlanEntry[];
      /** The headline's recipe was removed from the household. */
      recipeRemoved: boolean;
    }
  | { kind: "skipped"; dinner: MealPlanEntry }
  | {
      kind: "suggested";
      candidate: DinnerCandidate<R>;
      /** Where the candidate stands in the order, from 1. */
      place: number;
      total: number;
      /** Days since it was last cooked, or null: not within the lookback. */
      daysAgo: number | null;
    }
  | { kind: "only-one"; candidate: DinnerCandidate<R> }
  | { kind: "empty" };

/**
 * What the tile says for `day`: a planned dinner, a skipped one (only today:
 * after the switch to tomorrow nothing was cooked yet), or a suggestion.
 * `skip` is how many suggestions the member passed with "Another one".
 */
export function tonightState<R extends OrderRecipe>(
  recipes: R[],
  entries: MealPlanEntry[],
  day: LocalDate,
  options: {
    isToday: boolean;
    skip: number;
    /** Recipes to propose last; see dinnerSuggestionOrder. */
    demoted?: ReadonlySet<string>;
    /** Who proposes; without one, dinnerSuggestionOrder does. */
    suggester?: MealSuggester;
  },
): TonightState<R> {
  const dinners = entries
    .filter(
      (entry) =>
        entry.slot === "dinner" && entry.date === day && !entry.deleted_at,
    )
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.created_at.localeCompare(b.created_at) ||
        a.id.localeCompare(b.id),
    );
  const standing = dinners.filter((entry) => !entry.skipped_at);
  const [first] = standing;
  if (first) {
    return {
      kind: "planned",
      dinners: standing,
      recipeRemoved:
        first.recipe_id !== null &&
        !recipes.some((recipe) => recipe.id === first.recipe_id),
    };
  }
  const [skipped] = dinners;
  if (skipped && options.isToday) return { kind: "skipped", dinner: skipped };

  const order = options.suggester
    ? options.suggester.dinnerOrder(
        { recipes, entries, demoted: options.demoted ?? new Set() },
        day,
      )
    : dinnerSuggestionOrder(recipes, entries, day, options.demoted);
  const [only] = order;
  if (!only) return { kind: "empty" };
  if (order.length === 1) return { kind: "only-one", candidate: only };
  const index = options.skip % order.length;
  const candidate = order[index]!;
  return {
    kind: "suggested",
    candidate,
    place: index + 1,
    total: order.length,
    daysAgo:
      candidate.lastCooked === null
        ? null
        : daysBetween(candidate.lastCooked, day),
  };
}
