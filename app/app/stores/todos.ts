import { defineStore } from 'pinia'
import type { TodoItem, TodoRealtimeEvent } from '~/types/todo'
import {
  fetchOrCreateTodoList,
  fetchTodoItems,
  insertTodoItem,
  setTodoItemDone,
  softDeleteTodoItemRemote,
} from '~/composables/todo-actions'
import { nextPosition } from '~/utils/position'
import {
  applyTodoRealtimeEvent,
  mergeTodoResync,
  softDeleteTodoItem,
  upsertTodoItem,
  visibleTodoItems,
  type TodoItemsById,
} from '~/utils/todo-state'

export const useTodoStore = defineStore('todos', {
  state: () => ({
    householdId: null as string | null,
    listId: null as string | null,
    itemsById: {} as TodoItemsById,
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    visible: (state) => visibleTodoItems(state.itemsById),
  },
  actions: {
    /** Loads (creating if needed) the household's single shared todo list and its items. */
    async init(householdId: string) {
      this.loading = true
      this.error = null
      try {
        this.householdId = householdId
        const list = await fetchOrCreateTodoList(useSupabaseClient(), householdId)
        this.listId = list.id
        const items = await fetchTodoItems(useSupabaseClient(), list.id)
        this.itemsById = Object.fromEntries(items.map((item) => [item.id, item]))
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'unknown_error'
      } finally {
        this.loading = false
      }
    },

    /** Folds a to-do change from the household's Realtime channel into state. */
    applyRealtimeEvent(event: TodoRealtimeEvent) {
      this.itemsById = applyTodoRealtimeEvent(this.itemsById, event, this.listId)
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Skipped until init() has loaded the list (the channel can
     * connect first) and while init() is still fetching. */
    async resync() {
      const listId = this.listId
      if (!listId || this.loading) return
      try {
        const items = await fetchTodoItems(useSupabaseClient(), listId)
        if (listId !== this.listId) return
        this.itemsById = mergeTodoResync(this.itemsById, items, this.pendingIds)
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
    async add(title: string) {
      if (!this.listId || !this.householdId) throw new Error('not_initialized')
      const userId = useSupabaseUser().value?.sub
      if (!userId) throw new Error('not_authenticated')
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
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
      }
      this.itemsById = upsertTodoItem(this.itemsById, optimistic)
      const listId = this.listId
      const householdId = this.householdId

      await this.withPending(id, async () => {
        try {
          const confirmed = await insertTodoItem(useSupabaseClient(), {
            id,
            listId,
            householdId,
            title,
            position: optimistic.position,
          })
          this.itemsById = upsertTodoItem(this.itemsById, confirmed)
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
      const done = !item.done
      this.itemsById = upsertTodoItem(this.itemsById, { ...item, done })
      await this.withPending(id, async () => {
        try {
          await setTodoItemDone(useSupabaseClient(), id, done)
        } catch (e) {
          this.itemsById = upsertTodoItem(this.itemsById, item)
          this.error = e instanceof Error ? e.message : 'unknown_error'
        }
      })
    },

    async remove(id: string) {
      const previous = this.itemsById[id]
      if (!previous) return
      this.itemsById = softDeleteTodoItem(this.itemsById, id)
      await this.withPending(id, async () => {
        try {
          await softDeleteTodoItemRemote(useSupabaseClient(), id)
        } catch (e) {
          this.itemsById = upsertTodoItem(this.itemsById, previous)
          this.error = e instanceof Error ? e.message : 'unknown_error'
        }
      })
    },
  },
})
