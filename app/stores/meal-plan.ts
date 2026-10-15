import { defineStore } from "pinia";
import type { ItemsById } from "~/types/list";
import type {
  LoadedDateRange,
  MealPlanEntry,
  MealPlanEntryChange,
  MealPlanRealtimeEvent,
  MealSlot,
} from "~/types/meal-plan";
import {
  fetchMealPlanEntries,
  insertMealPlanEntry,
  softDeleteMealPlanEntryRemote,
  updateMealPlanEntry,
} from "~/composables/meal-plan-actions";
import { errorMessage } from "~/utils/error-message";
import { createChangesDuringFetch } from "~/utils/changes-during-fetch";
import { createInsertsInFlight } from "~/utils/inserts-in-flight";
import { isRangeLoaded } from "~/utils/meal-week";
import {
  addLoadedRange,
  applyMealPlanChange,
  applyMealPlanRealtimeEvent,
  mergeMealPlanResync,
  visibleMealPlanEntries,
} from "~/utils/meal-plan-state";
import { nextPosition } from "~/utils/position";
import { createRealtimeEventOrder } from "~/utils/realtime-event-order";
import {
  confirmListItem,
  softDeleteListItem,
  upsertListItem,
} from "~/utils/list-state";

/** How long a removed entry waits before the removal is sent, so that "Undo"
 * can take it back: the app has no undelete (see list-state.ts). */
export const HELD_REMOVAL_MS = 5000;

/** Adds still being saved; see createInsertsInFlight. */
const insertsInFlight = createInsertsInFlight();

/** Entries changed while a resync fetch is in flight; see createChangesDuringFetch. */
const changesDuringFetch = createChangesDuringFetch();

/** Drops Realtime events delivered out of commit order; see createRealtimeEventOrder. */
const realtimeEventOrder = createRealtimeEventOrder();

/** The timers of held removals. Not state to render, and not serializable. */
const heldRemovalTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** What a member picks for a new entry: a recipe or a title. */
export interface NewEntryChoice {
  date: string;
  slot: MealSlot;
  recipeId: string | null;
  title: string | null;
}

export const useMealPlanStore = defineStore("meal-plan", {
  state: () => ({
    /** The household whose plan is in state; null until load() has fetched
     * a range. Entries hang on the household directly, so Realtime events
     * and resync wait for it. */
    householdId: null as string | null,
    entriesById: {} as ItemsById<MealPlanEntry>,
    /** The days fetched so far. The store holds a window of the plan, not
     * all of it: a page asks for its own days (see load). */
    loadedRanges: [] as LoadedDateRange[],
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    /** Entries removed by the member whose removal is still held back for
     * "Undo". They are hidden but not yet deleted on the server. */
    heldRemovalIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    visible: (state) =>
      visibleMealPlanEntries(state.entriesById, state.heldRemovalIds),
    /** Whether every day of a range was fetched; a page that needs the days
     * shows a loading state, never an empty plan, until it is. */
    isLoaded: (state) => (range: LoadedDateRange) =>
      isRangeLoaded(state.loadedRanges, range),
  },
  actions: {
    /**
     * Makes the days of `range` available. Every page that shows the plan
     * calls this, and members move between them all the time. The first call
     * for a household fetches behind a spinner; a range that is loaded
     * already only repairs state in the background (see resync), since
     * replacing it would drop a write still on its way; a range that is new
     * is fetched and added to what is held.
     */
    async load(householdId: string, range: LoadedDateRange) {
      if (this.householdId === householdId && this.isLoaded(range))
        return this.resync();
      const userId = useSupabaseUser().value?.sub;
      this.loading = true;
      this.error = null;
      const changes = changesDuringFetch.start();
      try {
        const entries = await fetchMealPlanEntries(
          useSupabaseClient(),
          householdId,
          range,
        );
        // The user changed in the meantime: the entries fetched are the
        // previous user's.
        if (userId !== useSupabaseUser().value?.sub) return;
        // Decided now, not before the fetch: two loads of different ranges
        // can be running, and the second to arrive adds to the first.
        if (this.householdId !== householdId) {
          this.entriesById = Object.fromEntries(
            entries.map((entry) => [entry.id, entry]),
          );
          this.loadedRanges = [range];
          this.householdId = householdId;
        } else {
          const ranges = addLoadedRange(this.loadedRanges, range);
          this.entriesById = mergeMealPlanResync(
            this.entriesById,
            entries,
            [...this.pendingIds, ...changes.stop()],
            [range],
          );
          this.loadedRanges = ranges;
        }
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        changes.stop();
        this.loading = false;
      }
    },

    /** Folds a plan change from the household's Realtime channel into state. */
    applyRealtimeEvent(event: MealPlanRealtimeEvent) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp))
        return;
      changesDuringFetch.record(event.new.id);
      this.entriesById = applyMealPlanRealtimeEvent(
        this.entriesById,
        event,
        this.householdId,
      );
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Fetches every range held. Skipped until load() has fetched
     * something (the channel can connect first) and while load() is running. */
    async resync() {
      const householdId = this.householdId;
      if (!householdId || this.loading) return;
      const ranges = this.loadedRanges;
      const changes = changesDuringFetch.start();
      try {
        const fetched = (
          await Promise.all(
            ranges.map((range) =>
              fetchMealPlanEntries(useSupabaseClient(), householdId, range),
            ),
          )
        ).flat();
        if (householdId !== this.householdId) return;
        const keepLocalIds = [...this.pendingIds, ...changes.stop()];
        this.entriesById = mergeMealPlanResync(
          this.entriesById,
          fetched,
          keepLocalIds,
          ranges,
        );
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        changes.stop();
      }
    },

    /** Runs a server write while its entry id counts as pending (see
     * pendingIds). Its end counts as a change: a write that finishes while a
     * resync fetch is in flight is no longer pending when the fetch returns,
     * yet the fetch may predate it. */
    async withPending(id: string, write: () => Promise<void>) {
      this.pendingIds = [...this.pendingIds, id];
      try {
        await write();
      } finally {
        changesDuringFetch.record(id);
        // Only this write's entry: two writes to an entry can be pending at
        // the same time.
        const index = this.pendingIds.indexOf(id);
        this.pendingIds = this.pendingIds.filter((_, i) => i !== index);
      }
    },

    /**
     * Plans a meal: optimistic, so it shows at once, with a client-generated
     * id so that the server's row and the Realtime echo upsert instead of
     * duplicating. A refused add is taken back.
     *
     * @returns whether the entry is saved; false also leaves `error` set
     */
    async add(choice: NewEntryChoice): Promise<boolean> {
      const householdId = this.householdId;
      const userId = useSupabaseUser().value?.sub;
      if (!householdId || !userId) throw new Error("not_initialized");
      this.error = null;
      const sameSlot = Object.values(this.entriesById).filter(
        (entry) =>
          !entry.deleted_at &&
          entry.date === choice.date &&
          entry.slot === choice.slot,
      );
      const optimistic: MealPlanEntry = {
        id: crypto.randomUUID(),
        household_id: householdId,
        date: choice.date,
        slot: choice.slot,
        recipe_id: choice.recipeId,
        title: choice.title,
        position: nextPosition(sameSlot),
        on_shopping_list_at: null,
        skipped_at: null,
        created_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      this.entriesById = upsertListItem(this.entriesById, optimistic);
      let saved = false;
      await this.withPending(optimistic.id, async () => {
        const insert = insertMealPlanEntry(useSupabaseClient(), {
          id: optimistic.id,
          householdId,
          date: optimistic.date,
          slot: choice.slot,
          position: optimistic.position,
          recipeId: optimistic.recipe_id,
          title: optimistic.title,
        });
        try {
          const confirmed = await insertsInFlight.track(optimistic.id, insert);
          saved = true;
          this.entriesById = confirmListItem(
            this.entriesById,
            optimistic,
            confirmed,
          );
        } catch (e) {
          this.error = errorMessage(e);
          const { [optimistic.id]: _taken, ...rest } = this.entriesById;
          this.entriesById = rest;
        }
      });
      return saved;
    },

    /**
     * Changes some columns of an entry: optimistic, and only those columns
     * are taken back if the server refuses, so a change to another column
     * that arrived meanwhile stays.
     *
     * @returns whether the server has the change; false also leaves `error`
     *   set
     */
    async update(id: string, change: MealPlanEntryChange): Promise<boolean> {
      const previous = this.entriesById[id];
      if (!previous || previous.deleted_at) return false;
      this.error = null;
      const undo = Object.fromEntries(
        Object.keys(change).map((column) => [
          column,
          previous[column as keyof MealPlanEntryChange],
        ]),
      ) as MealPlanEntryChange;
      this.entriesById = applyMealPlanChange(this.entriesById, id, change);
      let saved = false;
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        try {
          await updateMealPlanEntry(useSupabaseClient(), id, change);
          saved = true;
        } catch (e) {
          this.entriesById = applyMealPlanChange(this.entriesById, id, undo);
          this.error = errorMessage(e);
        }
      });
      return saved;
    },

    /** Marks an entry as not cooked after all, or takes the mark back. */
    async setSkipped(id: string, skipped: boolean) {
      await this.update(id, {
        skipped_at: skipped ? new Date().toISOString() : null,
      });
    },

    /** Puts an entry on another day or in another slot, after what is there
     * already. Its ingredients stay noted as on the shopping list: they are
     * the same ingredients. */
    async move(id: string, date: string, slot: MealSlot): Promise<boolean> {
      const target = Object.values(this.entriesById).filter(
        (entry) =>
          !entry.deleted_at &&
          entry.id !== id &&
          entry.date === date &&
          entry.slot === slot,
      );
      return this.update(id, { date, slot, position: nextPosition(target) });
    },

    /**
     * Turns an entry with a title into one with a recipe, in one write. The
     * note that it is on the shopping list goes: the recipe's ingredients
     * were never put there. Sent also for an entry that is not in state: the
     * recipe form it is called from may have been reloaded, which empties
     * the store, and the Realtime echo brings the entry back.
     */
    async makeRecipeOf(id: string, recipeId: string): Promise<boolean> {
      const change = {
        recipe_id: recipeId,
        title: null,
        on_shopping_list_at: null,
      };
      if (this.entriesById[id]) return this.update(id, change);
      try {
        await updateMealPlanEntry(useSupabaseClient(), id, change);
        return true;
      } catch (e) {
        this.error = errorMessage(e);
        return false;
      }
    },

    /**
     * Notes that an entry's ingredients are on the shopping list.
     *
     * @throws what the server refused with, for the shopping run to report
     */
    async markOnShoppingList(id: string) {
      const saved = await this.update(id, {
        on_shopping_list_at: new Date().toISOString(),
      });
      if (!saved) throw new Error(this.error ?? "not_saved");
    },

    /** Soft delete at once: optimistic, taken back if the server refuses it.
     * For an entry whose removal was asked about (see holdRemoval for the
     * rest). */
    async remove(id: string) {
      const local = this.entriesById[id];
      if (!local || local.deleted_at) return;
      this.error = null;
      this.entriesById = softDeleteListItem(this.entriesById, id);
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        try {
          await softDeleteMealPlanEntryRemote(useSupabaseClient(), id);
        } catch (e) {
          const current = this.entriesById[id];
          // Not after a reset: the entry is the previous user's.
          if (current) {
            this.entriesById = upsertListItem(this.entriesById, {
              ...current,
              deleted_at: null,
            });
          }
          this.error = errorMessage(e);
        }
      });
    },

    /**
     * Hides an entry and sends its removal after HELD_REMOVAL_MS, so that
     * "Undo" can take it back without an undelete. A removal already held is
     * sent first: only the latest one can be undone. A closed tab sends
     * nothing, and the entry is still there on the next visit.
     */
    holdRemoval(id: string) {
      const local = this.entriesById[id];
      if (!local || local.deleted_at) return;
      void this.flushHeldRemovals();
      this.heldRemovalIds = [...this.heldRemovalIds, id];
      heldRemovalTimers.set(
        id,
        setTimeout(() => void this.commitHeldRemoval(id), HELD_REMOVAL_MS),
      );
    },

    /** Takes a held removal back: the entry shows again and nothing was sent. */
    undoRemoval(id: string) {
      clearTimeout(heldRemovalTimers.get(id));
      heldRemovalTimers.delete(id);
      this.heldRemovalIds = this.heldRemovalIds.filter((held) => held !== id);
    },

    /** Sends a held removal now. Nothing happens for an id that isn't held
     * (it was undone, or the stores were reset in the meantime). */
    async commitHeldRemoval(id: string) {
      if (!this.heldRemovalIds.includes(id)) return;
      clearTimeout(heldRemovalTimers.get(id));
      heldRemovalTimers.delete(id);
      // Deleted locally in the same step, so the entry never shows again
      // between the end of the hold and the answer of the server.
      const send = this.remove(id);
      this.heldRemovalIds = this.heldRemovalIds.filter((held) => held !== id);
      await send;
    },

    /** Sends every held removal now: when the member leaves the page, or
     * removes another entry. */
    async flushHeldRemovals() {
      await Promise.all(
        this.heldRemovalIds.map((id) => this.commitHeldRemoval(id)),
      );
    },
  },
});
