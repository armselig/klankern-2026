import { defineStore } from "pinia";
import type { ItemsById } from "~/types/list";
import type {
  HouseholdChild,
  HouseholdChildRealtimeEvent,
  MealReaction,
  MealReactionChoice,
  MealReactionRealtimeEvent,
} from "~/types/kids";
import {
  fetchHouseholdChildren,
  fetchMealReactions,
  insertHouseholdChild,
  insertMealReaction,
  renameHouseholdChildRemote,
  softDeleteHouseholdChildRemote,
  softDeleteMealReactionRemote,
  updateMealReactionRemote,
} from "~/composables/kids-actions";
import { errorMessage } from "~/utils/error-message";
import { createChangesDuringFetch } from "~/utils/changes-during-fetch";
import { createInsertsInFlight } from "~/utils/inserts-in-flight";
import { createRealtimeEventOrder } from "~/utils/realtime-event-order";
import {
  confirmListItem,
  mergeListResync,
  softDeleteListItem,
  upsertListItem,
} from "~/utils/list-state";
import {
  applyRowEdit,
  applyVacationRowEvent,
  revertRowEdit,
} from "~/utils/vacation-state";
import { liveChildren, liveReactionOf } from "~/utils/kids-state";

// One store for the children and their reactions, and one of each piece of
// bookkeeping for both, as in the vacation store: they are keyed by a row's
// id, and ids are UUIDs, so rows of the two tables can't be mistaken for
// each other.

/** Adds still being saved; see createInsertsInFlight. */
const insertsInFlight = createInsertsInFlight();

/** Rows changed while a resync fetch is in flight; see createChangesDuringFetch. */
const changesDuringFetch = createChangesDuringFetch();

/** Drops Realtime events delivered out of commit order; see createRealtimeEventOrder. */
const realtimeEventOrder = createRealtimeEventOrder();

export const useKidsStore = defineStore("kids", {
  state: () => ({
    /** The household whose children are in state; null until load() has
     * fetched them. The rows hang on the household directly, so Realtime
     * events and resync wait for it. */
    householdId: null as string | null,
    childrenById: {} as ItemsById<HouseholdChild>,
    /** Every live reaction of the household, not only those of the days the
     * meal plan holds: there are few, and a reaction carries no day. */
    reactionsById: {} as ItemsById<MealReaction>,
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    /** The live children in the order they were added. */
    children: (state) => liveChildren(state.childrenById),
  },
  actions: {
    /**
     * Makes the household's children and their reactions available. The
     * dashboard and the pages that show them call this, so only the first
     * call fetches behind a spinner; later ones repair state in the
     * background (see resync). Both tables are fetched before either is put
     * into state, so a failure of one leaves the state as it was.
     */
    async load(householdId: string) {
      if (this.householdId === householdId) return this.resync();
      this.loading = true;
      this.error = null;
      try {
        const client = useSupabaseClient();
        const [children, reactions] = await Promise.all([
          fetchHouseholdChildren(client, householdId),
          fetchMealReactions(client, householdId),
        ]);
        // A reset in the meantime (the user changed) ended this load; the
        // rows fetched are the previous user's.
        if (!this.loading) return;
        this.childrenById = Object.fromEntries(
          children.map((child) => [child.id, child]),
        );
        this.reactionsById = Object.fromEntries(
          reactions.map((reaction) => [reaction.id, reaction]),
        );
        this.householdId = householdId;
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        this.loading = false;
      }
    },

    /** Folds a change of a child from the household's Realtime channel into
     * state. */
    applyChildEvent(event: HouseholdChildRealtimeEvent) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp))
        return;
      changesDuringFetch.record(event.new.id);
      this.childrenById = applyVacationRowEvent(
        this.childrenById,
        event,
        this.householdId,
      );
    },

    /** Folds a change of a reaction from the household's Realtime channel
     * into state. */
    applyReactionEvent(event: MealReactionRealtimeEvent) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp))
        return;
      changesDuringFetch.record(event.new.id);
      this.reactionsById = applyVacationRowEvent(
        this.reactionsById,
        event,
        this.householdId,
      );
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Skipped until load() has fetched the rows (the channel can
     * connect first). As in load(), a failure of one fetch changes nothing. */
    async resync() {
      const householdId = this.householdId;
      if (!householdId) return;
      const changes = changesDuringFetch.start();
      try {
        const client = useSupabaseClient();
        const [children, reactions] = await Promise.all([
          fetchHouseholdChildren(client, householdId),
          fetchMealReactions(client, householdId),
        ]);
        if (householdId !== this.householdId) return;
        const keepLocalIds = [...this.pendingIds, ...changes.stop()];
        this.childrenById = mergeListResync(
          this.childrenById,
          children,
          keepLocalIds,
        );
        this.reactionsById = mergeListResync(
          this.reactionsById,
          reactions,
          keepLocalIds,
        );
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        changes.stop();
      }
    },

    /** Runs a server write while its row id counts as pending (see
     * pendingIds). Its end counts as a change: a write that finishes while a
     * resync fetch is in flight is no longer pending when the fetch returns,
     * yet the fetch may predate it. */
    async withPending(id: string, write: () => Promise<void>) {
      this.pendingIds = [...this.pendingIds, id];
      try {
        await write();
      } finally {
        changesDuringFetch.record(id);
        const index = this.pendingIds.indexOf(id);
        this.pendingIds = this.pendingIds.filter((_, i) => i !== index);
      }
    },

    /**
     * Adds a child: optimistic, with a client-generated id. A refused add
     * is taken back.
     *
     * @returns whether the child is saved; false also leaves `error` set
     */
    async addChild(name: string): Promise<boolean> {
      const householdId = this.householdId;
      const userId = useSupabaseUser().value?.sub;
      if (!householdId || !userId) throw new Error("not_initialized");
      this.error = null;
      const optimistic: HouseholdChild = {
        id: crypto.randomUUID(),
        household_id: householdId,
        name: name.trim(),
        created_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      this.childrenById = upsertListItem(this.childrenById, optimistic);
      let saved = false;
      await this.withPending(optimistic.id, async () => {
        const insert = insertHouseholdChild(useSupabaseClient(), {
          id: optimistic.id,
          householdId,
          name: optimistic.name,
        });
        try {
          const confirmed = await insertsInFlight.track(optimistic.id, insert);
          saved = true;
          this.childrenById = confirmListItem(
            this.childrenById,
            optimistic,
            confirmed,
          );
        } catch (e) {
          this.error = errorMessage(e);
          const { [optimistic.id]: _taken, ...rest } = this.childrenById;
          this.childrenById = rest;
        }
      });
      return saved;
    },

    /** Renames a child: optimistic, and taken back if the server refuses.
     * @returns whether the server has the new name */
    async renameChild(id: string, name: string): Promise<boolean> {
      const previous = this.childrenById[id];
      if (!previous || previous.deleted_at) return false;
      this.error = null;
      const change = { name: name.trim() };
      this.childrenById = applyRowEdit(this.childrenById, id, change);
      let saved = false;
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        try {
          await renameHouseholdChildRemote(
            useSupabaseClient(),
            id,
            change.name,
          );
          saved = true;
        } catch (e) {
          this.childrenById = revertRowEdit(
            this.childrenById,
            previous,
            change,
          );
          this.error = errorMessage(e);
        }
      });
      return saved;
    },

    /** Removes a child. Soft, and not taken back if the server refuses: the
     * app has no undelete, and the next resync shows the child again.
     * @returns whether the server has the removal; false also sets `error` */
    async removeChild(id: string): Promise<boolean> {
      if (!this.childrenById[id] || this.childrenById[id].deleted_at)
        return false;
      this.error = null;
      this.childrenById = softDeleteListItem(this.childrenById, id);
      let saved = false;
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        try {
          await softDeleteHouseholdChildRemote(useSupabaseClient(), id);
          saved = true;
        } catch (e) {
          this.error = errorMessage(e);
        }
      });
      return saved;
    },

    /**
     * Records what a child made of an entry. "Ate it" takes a live reaction
     * back (a soft delete); the other reaction changes the live row; a
     * reaction where there is none is a new row, also after one was taken
     * back, since a removed row is never brought back.
     *
     * @returns whether the server has it; false also leaves `error` set
     */
    async setReaction(
      entryId: string,
      childId: string,
      choice: MealReactionChoice,
    ): Promise<boolean> {
      const householdId = this.householdId;
      const userId = useSupabaseUser().value?.sub;
      if (!householdId || !userId) throw new Error("not_initialized");
      this.error = null;
      const live = liveReactionOf(this.reactionsById, entryId, childId);
      if ((live?.reaction ?? "ate") === choice) return true;
      const client = useSupabaseClient();

      if (live && choice === "ate") {
        this.reactionsById = softDeleteListItem(this.reactionsById, live.id);
        let saved = false;
        await this.withPending(live.id, async () => {
          await insertsInFlight.settled(live.id);
          try {
            await softDeleteMealReactionRemote(client, live.id);
            saved = true;
          } catch (e) {
            this.error = errorMessage(e);
          }
        });
        return saved;
      }

      if (live && choice !== "ate") {
        const change = { reaction: choice };
        this.reactionsById = applyRowEdit(this.reactionsById, live.id, change);
        let saved = false;
        await this.withPending(live.id, async () => {
          await insertsInFlight.settled(live.id);
          try {
            await updateMealReactionRemote(client, live.id, choice);
            saved = true;
          } catch (e) {
            this.reactionsById = revertRowEdit(
              this.reactionsById,
              live,
              change,
            );
            this.error = errorMessage(e);
          }
        });
        return saved;
      }

      if (choice === "ate") return true;
      const optimistic: MealReaction = {
        id: crypto.randomUUID(),
        household_id: householdId,
        entry_id: entryId,
        child_id: childId,
        reaction: choice,
        created_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      this.reactionsById = upsertListItem(this.reactionsById, optimistic);
      let saved = false;
      await this.withPending(optimistic.id, async () => {
        const insert = insertMealReaction(client, {
          id: optimistic.id,
          householdId,
          entryId,
          childId,
          reaction: choice,
        });
        try {
          const confirmed = await insertsInFlight.track(optimistic.id, insert);
          saved = true;
          this.reactionsById = confirmListItem(
            this.reactionsById,
            optimistic,
            confirmed,
          );
        } catch (e) {
          this.error = errorMessage(e);
          const { [optimistic.id]: _taken, ...rest } = this.reactionsById;
          this.reactionsById = rest;
        }
      });
      return saved;
    },
  },
});
