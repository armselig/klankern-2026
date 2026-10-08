import { defineStore } from 'pinia'
import type { ItemsById, ListRealtimeEvent } from '~/types/list'
import type { ShoppingItem } from '~/types/shopping'
import {
  fetchOrCreateShoppingList,
  fetchShoppingItems,
  insertShoppingItem,
  setShoppingItemChecked,
  softDeleteShoppingItemRemote,
} from '~/composables/shopping-actions'
import { nextPosition } from '~/utils/position'
import {
  applyListRealtimeEvent,
  mergeListResync,
  softDeleteListItem,
  upsertListItem,
} from '~/utils/list-state'
import { visibleShoppingItems } from '~/utils/shopping-state'

export const useShoppingStore = defineStore('shopping', {
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
  },
  actions: {
    /** Loads (creating if needed) the household's single shared shopping list and its items. */
    async init(householdId: string) {
      this.loading = true
      this.error = null
      try {
        this.householdId = householdId
        const list = await fetchOrCreateShoppingList(useSupabaseClient(), householdId)
        this.listId = list.id
        const items = await fetchShoppingItems(useSupabaseClient(), list.id)
        this.itemsById = Object.fromEntries(items.map((item) => [item.id, item]))
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'unknown_error'
      } finally {
        this.loading = false
      }
    },

    /** Folds a shopping-item change from the household's Realtime channel into state. */
    applyRealtimeEvent(event: ListRealtimeEvent<ShoppingItem>) {
      this.itemsById = applyListRealtimeEvent(this.itemsById, event, this.listId)
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Skipped until init() has loaded the list (the channel can
     * connect first) and while init() is still fetching. */
    async resync() {
      const listId = this.listId
      if (!listId || this.loading) return
      try {
        const items = await fetchShoppingItems(useSupabaseClient(), listId)
        if (listId !== this.listId) return
        this.itemsById = mergeListResync(this.itemsById, items, this.pendingIds)
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'unknown_error'
      }
    },

    /** Runs a server write while its item id counts as pending (see pendingIds). */
    async withPending(id: string, write: () => Promise<void>) {
      this.pendingIds = [...this.pendingIds, id]
      try {
        await write()
      } finally {
        this.pendingIds = this.pendingIds.filter((pendingId) => pendingId !== id)
      }
    },

    /** Optimistic add: the row appears immediately under a client-generated id,
     * then gets reconciled (not duplicated) once the server confirms it. */
    async add(title: string, quantity: string | null) {
      if (!this.listId || !this.householdId) throw new Error('not_initialized')
      const userId = useSupabaseUser().value?.sub
      if (!userId) throw new Error('not_authenticated')
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
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
      }
      this.itemsById = upsertListItem(this.itemsById, optimistic)
      const listId = this.listId
      const householdId = this.householdId

      await this.withPending(id, async () => {
        try {
          const confirmed = await insertShoppingItem(useSupabaseClient(), {
            id,
            listId,
            householdId,
            title,
            quantity,
            position: optimistic.position,
          })
          this.itemsById = upsertListItem(this.itemsById, confirmed)
        } catch (e) {
          const { [id]: _removed, ...rest } = this.itemsById
          this.itemsById = rest
          this.error = e instanceof Error ? e.message : 'unknown_error'
        }
      })
    },

    async toggle(id: string) {
      const item = this.itemsById[id]
      if (!item) return
      const checked = !item.checked
      this.itemsById = upsertListItem(this.itemsById, { ...item, checked })
      await this.withPending(id, async () => {
        try {
          await setShoppingItemChecked(useSupabaseClient(), id, checked)
        } catch (e) {
          this.itemsById = upsertListItem(this.itemsById, item)
          this.error = e instanceof Error ? e.message : 'unknown_error'
        }
      })
    },

    async remove(id: string) {
      const previous = this.itemsById[id]
      if (!previous) return
      this.itemsById = softDeleteListItem(this.itemsById, id)
      await this.withPending(id, async () => {
        try {
          await softDeleteShoppingItemRemote(useSupabaseClient(), id)
        } catch (e) {
          this.itemsById = upsertListItem(this.itemsById, previous)
          this.error = e instanceof Error ? e.message : 'unknown_error'
        }
      })
    },
  },
})
