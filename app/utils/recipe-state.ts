import type { ItemsById } from "~/types/list";
import type {
  Recipe,
  RecipeChange,
  RecipeContent,
  RecipeRealtimeEvent,
} from "~/types/recipe";
import { upsertListItem } from "./list-state";

// Recipes follow the same rules as list items (client-generated ids, soft
// deletes, resync); the store uses the reducers in list-state.ts for those.
// Here is only what differs for a recipe.

/** Whether a row from Realtime has the columns an UPDATE can leave out (see
 * RecipeChange). */
function isWholeRecipe(change: RecipeChange): change is Recipe {
  return (
    change.ingredients !== undefined &&
    change.instructions !== undefined &&
    change.kids_version !== undefined
  );
}

/**
 * Whether an event tells only part of a recipe this client doesn't have: an
 * UPDATE without the large columns, for a recipe whose INSERT was missed or
 * is still on its way (Realtime doesn't deliver in commit order, and the
 * late INSERT is then dropped as the older event). There is nothing to lay
 * the event over, so the caller has to fetch the row.
 */
export function recipeEventNeedsFetch(
  recipesById: ItemsById<Recipe>,
  event: RecipeRealtimeEvent,
  householdId: string | null,
): boolean {
  const incoming = event.new;
  return (
    incoming.household_id === householdId &&
    !recipesById[incoming.id] &&
    !incoming.deleted_at &&
    !isWholeRecipe(incoming)
  );
}

/**
 * Folds a Realtime change into local state, like applyListRealtimeEvent:
 * upserting by id makes the echo of our own write a no-op, and nothing may
 * undo a local soft delete.
 *
 * Unlike a list item, the event's row is laid over the local one instead of
 * replacing it, because the large columns can be missing from an UPDATE (see
 * RecipeChange). Part of a recipe that isn't in state is kept only when it is
 * deleted, as a tombstone without content; part of a live one is left out
 * (see recipeEventNeedsFetch).
 */
export function applyRecipeRealtimeEvent(
  recipesById: ItemsById<Recipe>,
  event: RecipeRealtimeEvent,
  householdId: string | null,
): ItemsById<Recipe> {
  const incoming = event.new;
  if (!householdId || incoming.household_id !== householdId) return recipesById;
  const local = recipesById[incoming.id];
  if (local?.deleted_at && !incoming.deleted_at) return recipesById;
  if (!local && !incoming.deleted_at && !isWholeRecipe(incoming))
    return recipesById;
  return upsertListItem(recipesById, {
    ingredients: [],
    instructions: "",
    kids_version: null,
    ...local,
    ...incoming,
  });
}

/** Lays an edit over the recipe at once, before the server has it. Nothing
 * changes for a recipe that isn't in state or is deleted. */
export function applyRecipeEdit(
  recipesById: ItemsById<Recipe>,
  id: string,
  changes: Partial<RecipeContent>,
): ItemsById<Recipe> {
  const local = recipesById[id];
  if (!local || local.deleted_at) return recipesById;
  return upsertListItem(recipesById, { ...local, ...changes });
}

/**
 * Takes back an edit the server refused: the edited fields get the values
 * they had before, and everything else stays as it is now, so a change to
 * another field, or a removal, that arrived in the meantime is kept.
 */
export function revertRecipeEdit(
  recipesById: ItemsById<Recipe>,
  previous: Recipe,
  changes: Partial<RecipeContent>,
): ItemsById<Recipe> {
  const local = recipesById[previous.id];
  if (!local) return recipesById;
  const reverted = { ...local };
  for (const field of Object.keys(changes) as (keyof RecipeContent)[]) {
    Object.assign(reverted, { [field]: previous[field] });
  }
  return upsertListItem(recipesById, reverted);
}

/** Non-deleted recipes by title, ignoring case and accents as a reader
 * looking for one would. The id breaks ties, to keep the order the same on
 * every member's screen. */
export function visibleRecipes(recipesById: ItemsById<Recipe>): Recipe[] {
  return Object.values(recipesById)
    .filter((recipe) => !recipe.deleted_at)
    .sort(
      (a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
        a.id.localeCompare(b.id),
    );
}
