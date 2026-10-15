import type { MealPlanEntry } from "~/types/meal-plan";
import { COOKED_LOOKBACK_WEEKS } from "./meal-week";
import type { TonightState } from "./dinner-order";

/** The words of the Tonight tile: a headline and a line under it. */
export interface TonightLines {
  headline: string;
  secondary: string;
  /** The headline says what is missing, not what is for dinner. */
  headlineMuted: boolean;
}

/** "last cooked 12 days ago", or the lookback when it was never in it. */
function lastCookedText(daysAgo: number | null): string {
  if (daysAgo === null) return `not in ${COOKED_LOOKBACK_WEEKS} weeks`;
  if (daysAgo === 1) return "last cooked yesterday";
  return `last cooked ${daysAgo} days ago`;
}

/** What an entry is called: its title, or its recipe's title. */
function nameOf(
  entry: MealPlanEntry,
  recipeTitleById: ReadonlyMap<string, string>,
): string | null {
  if (entry.title) return entry.title;
  return (entry.recipe_id && recipeTitleById.get(entry.recipe_id)) || null;
}

/** The tile's two lines for a state; the states are in dinner-order.ts. */
export function tonightLines(
  state: TonightState,
  recipeTitleById: ReadonlyMap<string, string>,
): TonightLines {
  switch (state.kind) {
    case "planned": {
      const [first] = state.dinners;
      const name = first ? nameOf(first, recipeTitleById) : null;
      const more = state.dinners.length - 1;
      return {
        headline: name ?? "Recipe was removed",
        secondary: more > 0 ? `Planned, and ${more} more` : "Planned",
        headlineMuted: name === null,
      };
    }
    case "skipped":
      return {
        headline: nameOf(state.dinner, recipeTitleById) ?? "Recipe was removed",
        secondary: "Skipped. Plan something else?",
        headlineMuted: false,
      };
    case "suggested":
      return {
        headline: state.candidate.recipe.title,
        secondary: `${lastCookedText(state.daysAgo)} · ${state.place} of ${state.total}`,
        headlineMuted: false,
      };
    case "only-one":
      return {
        headline: state.candidate.recipe.title,
        secondary: "Only 1 dinner to choose from",
        headlineMuted: false,
      };
    case "empty":
      return {
        headline: "Nothing to suggest yet",
        secondary: "Save a recipe or write what you eat.",
        headlineMuted: true,
      };
  }
}
