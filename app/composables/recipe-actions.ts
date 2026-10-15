import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type { Recipe, RecipeContent } from "~/types/recipe";
import { getCurrentUserId } from "./current-user";

type Client = SupabaseClient<Database>;

/**
 * Plain, framework-agnostic recipe operations -- see household-actions.ts
 * for why these are kept separate from the Pinia store.
 */

/** Recipes fetched per request. Below PostgREST's row limit (1000 unless the
 * project lowers it), so a page shorter than this is certainly the last one. */
export const RECIPE_PAGE_SIZE = 500;

/**
 * Every recipe of the household that isn't deleted. Paged, so a large
 * collection isn't cut off at PostgREST's row limit. The pages are cut by
 * id, not by offset: a recipe deleted between two requests would shift an
 * offset and make the next page skip a row. The order is the caller's to
 * establish (see visibleRecipes).
 */
export async function fetchRecipes(
  client: Client,
  householdId: string,
): Promise<Recipe[]> {
  const recipes: Recipe[] = [];
  let afterId: string | null = null;
  for (;;) {
    let query = client
      .from("recipes")
      .select()
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("id")
      .limit(RECIPE_PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query;
    if (error) throw error;
    // `ingredients` is jsonb, so the generated type is Json; the table's
    // check constraint guarantees the array of ingredients.
    const page = data as Recipe[];
    recipes.push(...page);
    const last = page.at(-1);
    if (!last || page.length < RECIPE_PAGE_SIZE) return recipes;
    afterId = last.id;
  }
}

/** One recipe, or null when it doesn't exist, is deleted or belongs to
 * another household (RLS returns no row for that, not an error). For a
 * recipe a Realtime event told only part of. */
export async function fetchRecipe(
  client: Client,
  id: string,
): Promise<Recipe | null> {
  const { data, error } = await client
    .from("recipes")
    .select()
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as Recipe | null;
}

/** Inserts with a client-supplied id, so the row the server confirms and the
 * Realtime echo of the insert share one key (see utils/list-state.ts). */
export async function insertRecipe(
  client: Client,
  recipe: RecipeContent & { id: string; householdId: string },
): Promise<Recipe> {
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from("recipes")
    .insert({
      id: recipe.id,
      household_id: recipe.householdId,
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      kids_version: recipe.kids_version,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Recipe;
}

/**
 * Saves an edit. Only the fields the member changed are sent, so two members
 * editing different fields of a recipe at the same time don't overwrite each
 * other. A deleted recipe is not edited: the update then matches no row,
 * which is no error to Postgres, so the returned rows are counted to tell a
 * saved edit from one that went nowhere.
 */
export async function updateRecipeRemote(
  client: Client,
  id: string,
  changes: Partial<RecipeContent>,
): Promise<void> {
  const { data, error } = await client
    .from("recipes")
    .update(changes)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  if (data.length === 0)
    throw new Error("This recipe was removed in the meantime.");
}

export async function softDeleteRecipeRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
