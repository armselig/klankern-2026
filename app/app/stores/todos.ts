import { defineStore } from "pinia";
import type { ItemsById, ListRealtimeEvent } from "~/types/list";
import type { TodoItem } from "~/types/todo";
import {
  fetchOrCreateTodoList,
  fetchTodoItems,
  insertTodoItem,
  setTodoItemDone,
  softDeleteTodoItemRemote,
} from "~/composables/todo-actions";
import { errorMessage } from "~/utils/error-message";
import { createChangesDuringFetch } from "~/utils/changes-during-fetch";
import { createInsertsInFlight } from "~/utils/inserts-in-flight";
import { nextPosition } from "~/utils/position";
import { createRealtimeEventOrder } from "~/utils/realtime-event-order";
import {
  applyListRealtimeEvent,
  confirmListItem,
  mergeListResync,
  softDeleteListItem,
  upsertListItem,
  visibleListItems,
} from "~/utils/list-state";

/** Adds still being saved; see createInsertsInFlight. */
const insertsInFlight = createInsertsInFlight();

/** Items changed while a resync fetch is in flight; see createChangesDuringFetch. */
const changesDuringFetch = createChangesDuringFetch();

/** Drops Realtime events delivered out of commit order; see createRealtimeEventOrder. */
const realtimeEventOrder = createRealtimeEventOrder();

/** The first fetch while it runs, for a second caller to wait for instead of
 * fetching again: the dashboard starts one, and the page a member opens
 * from it asks for the same list a moment later. */
let initInFlight: Promise<void> | null = null;

export const useTodoStore = defineStore("todos", {
  state: () => ({
    householdId: null as string | null,
    listId: null as string | null,
    itemsById: {} as ItemsById<TodoItem>,
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    visible: (state) => visibleListItems(state.itemsById),
    /** What is still to do, in list order: what the dashboard counts and
     * previews. */
    open(): TodoItem[] {
      return this.visible.filter((item) => !item.done);
    },
  },
  actions: {
    /**
     * Makes the household's single shared to-do list available, creating it
     * if needed. The dashboard and the to-do page both call this, and
     * members move between them all the time, so only the first call
     * fetches everything behind a spinner. Later ones repair state in the
     * background (see resync): replacing it would drop a write that is
     * still on its way. A call while the first is still fetching waits for
     * that one.
     */
    async load(householdId: string) {
      if (this.householdId === householdId) {
        if (this.loading && initInFlight) return initInFlight;
        if (this.listId) return this.resync();
      }
      initInFlight = this.init(householdId);
      return initInFlight;
    },

    /** The first fetch, which replaces state; only load() calls it. */
    async init(householdId: string) {
      this.loading = true;
      this.error = null;
      this.householdId = householdId;
      // A reset in the meantime (the user changed) ended this load; what it
      // fetched is the previous user's.
      const ended = () => this.householdId !== householdId;
      try {
        const list = await fetchOrCreateTodoList(
          useSupabaseClient(),
          householdId,
        );
        if (ended()) return;
        this.listId = list.id;
        const items = await fetchTodoItems(useSupabaseClient(), list.id);
        if (ended()) return;
        this.itemsById = Object.fromEntries(
          items.map((item) => [item.id, item]),
        );
      } catch (e) {
        if (!ended()) this.error = errorMessage(e);
      } finally {
        if (!ended()) this.loading = false;
      }
    },

    /** Folds a to-do change from the household's Realtime channel into state. */
    applyRealtimeEvent(event: ListRealtimeEvent<TodoItem>) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp))
        return;
      changesDuringFetch.record(event.new.id);
      this.itemsById = applyListRealtimeEvent(
        this.itemsById,
        event,
        this.listId,
      );
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Skipped until load() has loaded the list (the channel can
     * connect first) and while load() is still fetching. */
    async resync() {
      const listId = this.listId;
      if (!listId || this.loading) return;
      const changes = changesDuringFetch.start();
      try {
        const items = await fetchTodoItems(useSupabaseClient(), listId);
        if (listId !== this.listId) return;
        const keepLocalIds = [...this.pendingIds, ...changes.stop()];
        this.itemsById = mergeListResync(this.itemsById, items, keepLocalIds);
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        changes.stop();
      }
    },

    /** Runs a server write while its item id counts as pending (see pendingIds).
     * Its end counts as a change: a write that finishes while a resync fetch
     * is in flight is no longer pending when the fetch returns, yet the
     * fetch may predate it. */
    async withPending(id: string, write: () => Promise<void>) {
      this.pendingIds = [...this.pendingIds, id];
      try {
        await write();
      } finally {
        changesDuringFetch.record(id);
        // Only this write's entry: an add and a check of the same item can
        // be pending at the same time.
        const index = this.pendingIds.indexOf(id);
        this.pendingIds = this.pendingIds.filter((_, i) => i !== index);
      }
    },

    /** Optimistic add: the row appears immediately under a client-generated id,
     * then gets reconciled (not duplicated) once the server confirms it,
     * keeping any check or remove made in the meantime. */
    async add(title: string) {
      if (!this.listId || !this.householdId) throw new Error("not_initialized");
      const userId = useSupabaseUser().value?.sub;
      if (!userId) throw new Error("not_authenticated");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const optimistic: TodoItem = {
        id,
        list_id: this.listId,
        household_id: this.householdId,
        title,
        done: false,
        position: nextPosition(this.visible),
        created_by: userId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      this.itemsById = upsertListItem(this.itemsById, optimistic);
      const listId = this.listId;
      const householdId = this.householdId;

      await this.withPending(id, async () => {
        try {
          const confirmed = await insertsInFlight.track(
            id,
            insertTodoItem(useSupabaseClient(), {
              id,
              listId,
              householdId,
              title,
              position: optimistic.position,
            }),
          );
          this.itemsById = confirmListItem(
            this.itemsById,
            optimistic,
            confirmed,
          );
        } catch (e) {
          const { [id]: _removed, ...rest } = this.itemsById;
          this.itemsById = rest;
          this.error = errorMessage(e);
        }
      });
    },

    /** Optimistic; the server update waits for the item's add to be saved. */
    async toggle(id: string) {
      const item = this.itemsById[id];
      if (!item) return;
      const done = !item.done;
      this.itemsById = upsertListItem(this.itemsById, { ...item, done });
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        // The add failed and took the item with it: nothing left to update.
        if (!this.itemsById[id]) return;
        try {
          await setTodoItemDone(useSupabaseClient(), id, done);
        } catch (e) {
          this.itemsById = upsertListItem(this.itemsById, item);
          this.error = errorMessage(e);
        }
      });
    },

    /** Optimistic soft delete; like toggle, waits for the item's add to be saved. */
    async remove(id: string) {
      const previous = this.itemsById[id];
      if (!previous) return;
      this.itemsById = softDeleteListItem(this.itemsById, id);
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        if (!this.itemsById[id]) return;
        try {
          await softDeleteTodoItemRemote(useSupabaseClient(), id);
        } catch (e) {
          this.itemsById = upsertListItem(this.itemsById, previous);
          this.error = errorMessage(e);
        }
      });
    },
  },
});
