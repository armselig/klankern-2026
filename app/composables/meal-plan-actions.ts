import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type {
  LoadedDateRange,
  MealPlanEntry,
  NewMealPlanEntry,
} from "~/types/meal-plan";
import { getCurrentUserId } from "./current-user";

type Client = SupabaseClient<Database>;

/** Entries fetched per request. Below PostgREST's row limit (1000 unless the
 * project lowers it), so a page shorter than this is certainly the last one. */
export const MEAL_PLAN_PAGE_SIZE = 500;

/**
 * The household's entries on the days of `range` that aren't deleted. Paged,
 * so a large plan isn't cut off at PostgREST's row limit, and cut by id, not
 * by offset: an entry deleted between two requests would shift an offset and
 * make the next page skip a row. The order is the caller's to establish.
 */
export async function fetchMealPlanEntries(
  client: Client,
  householdId: string,
  range: LoadedDateRange,
): Promise<MealPlanEntry[]> {
  const entries: MealPlanEntry[] = [];
  let afterId: string | null = null;
  for (;;) {
    let query = client
      .from("meal_plan_entries")
      .select()
      .eq("household_id", householdId)
      .gte("date", range.from)
      .lte("date", range.to)
      .is("deleted_at", null)
      .order("id")
      .limit(MEAL_PLAN_PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query;
    if (error) throw error;
    entries.push(...data);
    const last = data.at(-1);
    if (!last || data.length < MEAL_PLAN_PAGE_SIZE) return entries;
    afterId = last.id;
  }
}

/** Inserts with a client-supplied id, so the row the server confirms and the
 * Realtime echo of the insert share one key (see utils/list-state.ts). */
export async function insertMealPlanEntry(
  client: Client,
  entry: NewMealPlanEntry,
): Promise<MealPlanEntry> {
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from("meal_plan_entries")
    .insert({
      id: entry.id,
      household_id: entry.householdId,
      date: entry.date,
      slot: entry.slot,
      position: entry.position,
      recipe_id: entry.recipeId,
      title: entry.title,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Sets or clears when the household did not cook an entry after all. */
export async function setMealPlanEntrySkipped(
  client: Client,
  id: string,
  skippedAt: string | null,
): Promise<void> {
  const { error } = await client
    .from("meal_plan_entries")
    .update({ skipped_at: skippedAt })
    .eq("id", id);
  if (error) throw error;
}

export async function softDeleteMealPlanEntryRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("meal_plan_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
