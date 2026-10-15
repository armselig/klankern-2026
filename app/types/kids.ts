import type { Database } from "./database.types";
import type { RowRealtimeEvent } from "./synced-row";

/** One of the household's children. Children are not users: they have a
 * name and no account. A removed child stays as a row with `deleted_at`. */
export type HouseholdChild =
  Database["public"]["Tables"]["household_children"]["Row"];

/** What a child made of a meal, when it was not "ate it". The column is text
 * with a check constraint, so the generated type only says `string`. */
export type MealReactionKind = "picked_at" | "refused";

/** What a child made of a meal as a member chooses it: one of the recorded
 * reactions, or "ate it", which is the absence of a live row. */
export type MealReactionChoice = MealReactionKind | "ate";

type MealReactionRow = Database["public"]["Tables"]["meal_reactions"]["Row"];

/** A recorded reaction of one child to one entry of the plan. Taken back to
 * "ate it", it stays as a row with `deleted_at`; recorded again, it is a new
 * row (see migration 0021). */
export type MealReaction = Omit<MealReactionRow, "reaction"> & {
  reaction: MealReactionKind;
};

/** Both rows are small, so an UPDATE event carries the whole row. */
export type HouseholdChildRealtimeEvent = RowRealtimeEvent<HouseholdChild>;
export type MealReactionRealtimeEvent = RowRealtimeEvent<MealReaction>;

/** How often a child refused a recipe, or picked at it. */
export interface RecipeReactionCount {
  recipeId: string;
  count: number;
}

/** A child's record: the recipes the child refused or picked at, with how
 * often, the most often first. Counts, not a score. */
export interface ChildRecord {
  child: HouseholdChild;
  refused: RecipeReactionCount[];
  pickedAt: RecipeReactionCount[];
}

/** How often one child refused one recipe, for the Tonight tile's line. */
export interface ChildRefusal {
  childName: string;
  count: number;
}
