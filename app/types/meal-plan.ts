import type { Database } from "./database.types";
import type { RowRealtimeEvent } from "./synced-row";

/** A planned meal: a recipe of the household or just a title, on a day and in
 * a slot. */
export type MealPlanEntry =
  Database["public"]["Tables"]["meal_plan_entries"]["Row"];

/** The four times of day an entry can be planned for. */
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

/** What an add sends: a recipe or a title, never both. */
export interface NewMealPlanEntry {
  id: string;
  householdId: string;
  date: string;
  slot: MealSlot;
  position: number;
  recipeId: string | null;
  title: string | null;
}

/** The columns of an entry that an update may change (0018 grants update on
 * these and `deleted_at` only). */
export type MealPlanEntryChange = Partial<
  Pick<
    MealPlanEntry,
    | "date"
    | "slot"
    | "position"
    | "recipe_id"
    | "title"
    | "on_shopping_list_at"
    | "skipped_at"
  >
>;

/** A plan entry change as delivered by Realtime (see RowRealtimeEvent). */
export type MealPlanRealtimeEvent = RowRealtimeEvent<MealPlanEntry>;

/** A span of days the store has fetched, both ends included. */
export interface LoadedDateRange {
  from: string;
  to: string;
}
