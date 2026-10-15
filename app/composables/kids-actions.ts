import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type {
  HouseholdChild,
  MealReaction,
  MealReactionKind,
} from "~/types/kids";
import { getCurrentUserId } from "./current-user";

type Client = SupabaseClient<Database>;

/**
 * Plain, framework-agnostic operations on the household's children and their
 * reactions to meals -- see household-actions.ts for why these are kept
 * separate from the Pinia store.
 */

/** Rows fetched per request. Below PostgREST's row limit (1000 unless the
 * project lowers it), so a page shorter than this is certainly the last one. */
export const KIDS_PAGE_SIZE = 500;

/** What one request for a page of rows resolves to. */
interface Page<T> {
  data: T[] | null;
  error: unknown;
}

/** Collects every page of a query, cut by id and not by offset: a row
 * removed between two requests would shift an offset and make the next page
 * skip a row. */
async function fetchAllPages<T extends { id: string }>(
  fetchPage: (afterId: string | null) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let afterId: string | null = null;
  for (;;) {
    const { data, error } = await fetchPage(afterId);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    const last = page.at(-1);
    if (!last || page.length < KIDS_PAGE_SIZE) return rows;
    afterId = last.id;
  }
}

/** The household's children that aren't removed. The order is the caller's
 * to establish (see liveChildren). */
export function fetchHouseholdChildren(
  client: Client,
  householdId: string,
): Promise<HouseholdChild[]> {
  return fetchAllPages((afterId) => {
    let query = client
      .from("household_children")
      .select()
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("id")
      .limit(KIDS_PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    return query;
  });
}

/** Every reaction of the household's children that isn't taken back. Not
 * cut to a range of days: a reaction carries no day, and there are few. */
export async function fetchMealReactions(
  client: Client,
  householdId: string,
): Promise<MealReaction[]> {
  const rows = await fetchAllPages((afterId) => {
    let query = client
      .from("meal_reactions")
      .select()
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("id")
      .limit(KIDS_PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    return query;
  });
  // The column is text; its check constraint keeps it to the two reactions.
  return rows as MealReaction[];
}

/** Adds a child with a client-supplied id, so the row the server confirms
 * and the Realtime echo of the insert share one key. */
export async function insertHouseholdChild(
  client: Client,
  child: { id: string; householdId: string; name: string },
): Promise<HouseholdChild> {
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from("household_children")
    .insert({
      id: child.id,
      household_id: child.householdId,
      name: child.name,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameHouseholdChildRemote(
  client: Client,
  id: string,
  name: string,
): Promise<void> {
  const { error } = await client
    .from("household_children")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

/** Removes a child. One write: the child's reactions stay as rows, and the
 * app leaves out those of a removed child. */
export async function softDeleteHouseholdChildRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("household_children")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Records what a child made of an entry, with a client-supplied id. */
export async function insertMealReaction(
  client: Client,
  reaction: {
    id: string;
    householdId: string;
    entryId: string;
    childId: string;
    reaction: MealReactionKind;
  },
): Promise<MealReaction> {
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from("meal_reactions")
    .insert({
      id: reaction.id,
      household_id: reaction.householdId,
      entry_id: reaction.entryId,
      child_id: reaction.childId,
      reaction: reaction.reaction,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MealReaction;
}

/** Changes a live reaction to the other one. */
export async function updateMealReactionRemote(
  client: Client,
  id: string,
  reaction: MealReactionKind,
): Promise<void> {
  const { error } = await client
    .from("meal_reactions")
    .update({ reaction })
    .eq("id", id);
  if (error) throw error;
}

/** Takes a reaction back: the child ate it after all. */
export async function softDeleteMealReactionRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("meal_reactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
