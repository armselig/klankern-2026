import { defineStore } from "pinia";
import type { ItemsById } from "~/types/list";
import type {
  Recipe,
  RecipeContent,
  RecipeRealtimeEvent,
} from "~/types/recipe";
import {
  fetchRecipe,
  fetchRecipes,
  insertRecipe,
  softDeleteRecipeRemote,
  updateRecipeRemote,
} from "~/composables/recipe-actions";
import { errorMessage } from "~/utils/error-message";
import { createChangesDuringFetch } from "~/utils/changes-during-fetch";
import { createRealtimeEventOrder } from "~/utils/realtime-event-order";
import {
  mergeListResync,
  softDeleteListItem,
  upsertListItem,
} from "~/utils/list-state";
import {
  applyRecipeEdit,
  applyRecipeRealtimeEvent,
  recipeEventNeedsFetch,
  revertRecipeEdit,
  visibleRecipes,
} from "~/utils/recipe-state";

// Unlike the list stores there is no createInsertsInFlight here: a recipe is
// put into state only once its insert is saved (see add), so an edit or a
// removal can't get ahead of it.

/** Recipes changed while a resync fetch is in flight; see createChangesDuringFetch. */
const changesDuringFetch = createChangesDuringFetch();

/** Drops Realtime events delivered out of commit order; see createRealtimeEventOrder. */
const realtimeEventOrder = createRealtimeEventOrder();

export const useRecipeStore = defineStore("recipes", {
  state: () => ({
    /** The household whose recipes are in state; null until load() has
     * fetched them. Recipes hang on the household directly, so this is what
     * a list's id is to the list stores: Realtime events and resync wait
     * for it. */
    householdId: null as string | null,
    recipesById: {} as ItemsById<Recipe>,
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    visible: (state) => visibleRecipes(state.recipesById),
    /** The recipe with this id, unless it is deleted or unknown: what the
     * pages of a single recipe show, or report as not found. */
    find: (state) => (id: string) => {
      const recipe = state.recipesById[id];
      return recipe && !recipe.deleted_at ? recipe : null;
    },
  },
  actions: {
    /**
     * Makes the household's recipes available. Every recipe page calls this,
     * and members move between those pages all the time, so only the first
     * call fetches everything behind a spinner. Later ones repair state in
     * the background (see resync): replacing it would drop a write that is
     * still on its way.
     */
    async load(householdId: string) {
      if (this.householdId === householdId) return this.resync();
      this.loading = true;
      this.error = null;
      try {
        const recipes = await fetchRecipes(useSupabaseClient(), householdId);
        // A reset in the meantime (the user changed) ended this load; the
        // recipes fetched are the previous user's.
        if (!this.loading) return;
        this.recipesById = Object.fromEntries(
          recipes.map((recipe) => [recipe.id, recipe]),
        );
        this.householdId = householdId;
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        this.loading = false;
      }
    },

    /** Folds a recipe change from the household's Realtime channel into state. */
    applyRealtimeEvent(event: RecipeRealtimeEvent) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp))
        return;
      changesDuringFetch.record(event.new.id);
      if (recipeEventNeedsFetch(this.recipesById, event, this.householdId)) {
        void this.fetchUnknown(event.new.id);
        return;
      }
      this.recipesById = applyRecipeRealtimeEvent(
        this.recipesById,
        event,
        this.householdId,
      );
    },

    /** Fetches a recipe that an event told only part of (see
     * recipeEventNeedsFetch). Whatever put the recipe into state while the
     * fetch was running is at least as new, and is kept. */
    async fetchUnknown(id: string) {
      const householdId = this.householdId;
      try {
        const recipe = await fetchRecipe(useSupabaseClient(), id);
        if (!recipe || recipe.household_id !== this.householdId) return;
        if (householdId !== this.householdId || this.recipesById[id]) return;
        changesDuringFetch.record(id);
        this.recipesById = upsertListItem(this.recipesById, recipe);
      } catch (e) {
        this.error = errorMessage(e);
      }
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Skipped until load() has fetched the recipes (the channel can
     * connect first). */
    async resync() {
      const householdId = this.householdId;
      if (!householdId) return;
      const changes = changesDuringFetch.start();
      try {
        const recipes = await fetchRecipes(useSupabaseClient(), householdId);
        if (householdId !== this.householdId) return;
        const keepLocalIds = [...this.pendingIds, ...changes.stop()];
        this.recipesById = mergeListResync(
          this.recipesById,
          recipes,
          keepLocalIds,
        );
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        changes.stop();
      }
    },

    /** Runs a server write while its recipe id counts as pending (see
     * pendingIds). Its end counts as a change: a write that finishes while a
     * resync fetch is in flight is no longer pending when the fetch returns,
     * yet the fetch may predate it. */
    async withPending(id: string, write: () => Promise<void>) {
      this.pendingIds = [...this.pendingIds, id];
      try {
        await write();
      } finally {
        changesDuringFetch.record(id);
        // Only this write's entry: two edits of a recipe can be pending at
        // the same time.
        const index = this.pendingIds.indexOf(id);
        this.pendingIds = this.pendingIds.filter((_, i) => i !== index);
      }
    },

    /**
     * Saves a new recipe. Not optimistic, unlike an added list item: the
     * form waits for the result, so that a failed save leaves the member on
     * the form with what they typed. The id is still generated here, so the
     * Realtime echo of the insert upserts instead of duplicating.
     *
     * @returns the new recipe's id, or null when saving failed (see `error`)
     */
    async add(content: RecipeContent): Promise<string | null> {
      const householdId = this.householdId;
      if (!householdId) throw new Error("not_initialized");
      this.error = null;
      const id = crypto.randomUUID();
      let saved = false;
      await this.withPending(id, async () => {
        try {
          const confirmed = await insertRecipe(useSupabaseClient(), {
            id,
            householdId,
            ...content,
          });
          saved = true;
          // Not after a reset, and not over the echo: if that got here
          // first, it is the same row or a newer one.
          if (householdId !== this.householdId || this.recipesById[id]) return;
          this.recipesById = upsertListItem(this.recipesById, confirmed);
        } catch (e) {
          this.error = errorMessage(e);
        }
      });
      return saved ? id : null;
    },

    /**
     * Saves an edit: optimistic, and taken back if the server refuses it.
     * `changes` holds only the fields the member changed (see
     * changedRecipeFields).
     *
     * @returns whether the edit is saved; false also leaves `error` set
     */
    async update(id: string, changes: Partial<RecipeContent>) {
      const previous = this.find(id);
      if (!previous) return false;
      if (Object.keys(changes).length === 0) return true;
      this.error = null;
      this.recipesById = applyRecipeEdit(this.recipesById, id, changes);
      let saved = false;
      await this.withPending(id, async () => {
        try {
          await updateRecipeRemote(useSupabaseClient(), id, changes);
          saved = true;
        } catch (e) {
          this.recipesById = revertRecipeEdit(
            this.recipesById,
            previous,
            changes,
          );
          this.error = errorMessage(e);
        }
      });
      return saved;
    },

    /** Optimistic soft delete, taken back if the server refuses it. */
    async remove(id: string) {
      if (!this.find(id)) return;
      this.error = null;
      this.recipesById = softDeleteListItem(this.recipesById, id);
      await this.withPending(id, async () => {
        try {
          await softDeleteRecipeRemote(useSupabaseClient(), id);
        } catch (e) {
          const local = this.recipesById[id];
          // Not after a reset: the recipe is the previous user's.
          if (local) {
            this.recipesById = upsertListItem(this.recipesById, {
              ...local,
              deleted_at: null,
            });
          }
          this.error = errorMessage(e);
        }
      });
    },
  },
});
