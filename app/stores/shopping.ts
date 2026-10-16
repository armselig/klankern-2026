import { defineStore } from "pinia";
import type { ItemsById, ListRealtimeEvent } from "~/types/list";
import type { ShoppingItem } from "~/types/shopping";
import {
  fetchOrCreateShoppingList,
  fetchShoppingItems,
  insertShoppingItem,
  setShoppingItemChecked,
  softDeleteShoppingItemRemote,
} from "~/composables/shopping-actions";
import { errorMessage } from "~/utils/error-message";
import { createChangesDuringFetch } from "~/utils/changes-during-fetch";
import { createInsertsInFlight } from "~/utils/inserts-in-flight";
import { createWritesInOrder } from "~/utils/writes-in-order";
import { nextPosition } from "~/utils/position";
import { createRealtimeEventOrder } from "~/utils/realtime-event-order";
import {
  applyListRealtimeEvent,
  confirmListItem,
  mergeListResync,
  softDeleteListItem,
  upsertListItem,
} from "~/utils/list-state";
import { visibleShoppingItems } from "~/utils/shopping-state";

/** Adds still being saved; see createInsertsInFlight. */
const insertsInFlight = createInsertsInFlight();

/** Ticks and unticks of an item, sent in the order they were made; see
 * createWritesInOrder. */
const togglesInOrder = createWritesInOrder();

/** Items changed while a resync fetch is in flight; see createChangesDuringFetch. */
const changesDuringFetch = createChangesDuringFetch();

/** Drops Realtime events delivered out of commit order; see createRealtimeEventOrder. */
const realtimeEventOrder = createRealtimeEventOrder();

/** The first fetch while it runs, for a second caller to wait for instead of
 * fetching again: the dashboard starts one, and the page a member opens
 * from it asks for the same list a moment later. */
let initInFlight: Promise<void> | null = null;

export const useShoppingStore = defineStore("shopping", {
  state: () => ({
    householdId: null as string | null,
    listId: null as string | null,
    itemsById: {} as ItemsById<ShoppingItem>,
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    visible: (state) => visibleShoppingItems(state.itemsById),
    /** What is still to buy, in list order: what the dashboard counts and
     * previews. */
    toBuy(): ShoppingItem[] {
      return this.visible.filter((item) => !item.checked);
    },
  },
  actions: {
    /**
     * Makes the household's single shared shopping list available, creating
     * it if needed. The dashboard and the shopping page both call this, and
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
        const list = await fetchOrCreateShoppingList(
          useSupabaseClient(),
          householdId,
        );
        if (ended()) return;
        this.listId = list.id;
        const items = await fetchShoppingItems(useSupabaseClient(), list.id);
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

    /** Folds a shopping-item change from the household's Realtime channel into state. */
    applyRealtimeEvent(event: ListRealtimeEvent<ShoppingItem>) {
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
        const items = await fetchShoppingItems(useSupabaseClient(), listId);
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

    /**
     * Optimistic add: the row appears immediately under a client-generated id,
     * then gets reconciled (not duplicated) once the server confirms it,
     * keeping any check or remove made in the meantime.
     *
     * @returns whether the item is saved; false also leaves `error` set
     */
    async add(title: string, quantity: string | null) {
      if (!this.listId || !this.householdId) throw new Error("not_initialized");
      const userId = useSupabaseUser().value?.sub;
      if (!userId) throw new Error("not_authenticated");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const optimistic: ShoppingItem = {
        id,
        list_id: this.listId,
        household_id: this.householdId,
        title,
        quantity,
        checked: false,
        position: nextPosition(this.visible),
        created_by: userId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      this.itemsById = upsertListItem(this.itemsById, optimistic);
      const listId = this.listId;
      const householdId = this.householdId;

      let saved = false;
      await this.withPending(id, async () => {
        try {
          const confirmed = await insertsInFlight.track(
            id,
            insertShoppingItem(useSupabaseClient(), {
              id,
              listId,
              householdId,
              title,
              quantity,
              position: optimistic.position,
            }),
          );
          this.itemsById = confirmListItem(
            this.itemsById,
            optimistic,
            confirmed,
          );
          saved = true;
        } catch (e) {
          const { [id]: _removed, ...rest } = this.itemsById;
          this.itemsById = rest;
          this.error = errorMessage(e);
        }
      });
      return saved;
    },

    /** Loads the household's list unless it is loaded already. For a page
     * other than the shopping list that adds to it (a recipe's ingredients):
     * add() needs the list's id, and the items for the next position. */
    async ensureLoaded(householdId: string) {
      const loaded = this.listId && this.householdId === householdId;
      if (loaded && !this.loading) return;
      await this.load(householdId);
    },

    /**
     * Adds several items in the order given, each through add(), so each is
     * its own optimistic row and insert. add() gives an item its position
     * before it first waits, so starting them together still numbers them
     * one after the other.
     *
     * @returns how many of them are saved
     */
    async addAll(entries: Pick<ShoppingItem, "title" | "quantity">[]) {
      const saved = await Promise.all(
        entries.map((entry) => this.add(entry.title, entry.quantity)),
      );
      return saved.filter(Boolean).length;
    },

    /** Optimistic; the server update waits for the item's add to be saved,
     * and for its previous tick or untick (see createWritesInOrder). */
    async toggle(id: string) {
      const item = this.itemsById[id];
      if (!item) return;
      const checked = !item.checked;
      this.itemsById = upsertListItem(this.itemsById, { ...item, checked });
      await this.withPending(id, () =>
        togglesInOrder.run(id, async () => {
          await insertsInFlight.settled(id);
          // The add failed and took the item with it: nothing left to update.
          if (!this.itemsById[id]) return;
          try {
            await setShoppingItemChecked(useSupabaseClient(), id, checked);
          } catch (e) {
            this.itemsById = upsertListItem(this.itemsById, item);
            this.error = errorMessage(e);
          }
        }),
      );
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
          await softDeleteShoppingItemRemote(useSupabaseClient(), id);
        } catch (e) {
          this.itemsById = upsertListItem(this.itemsById, previous);
          this.error = errorMessage(e);
        }
      });
    },
  },
});
