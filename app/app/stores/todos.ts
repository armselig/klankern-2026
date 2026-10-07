import { defineStore } from 'pinia'
import type { TodoItem } from '~/types/todo'
import {
  fetchOrCreateTodoList,
  fetchTodoItems,
  insertTodoItem,
  setTodoItemDone,
  softDeleteTodoItemRemote,
} from '~/composables/todo-actions'
import { nextPosition } from '~/utils/position'
import {
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

    /** Optimistic add: the row appears immediately under a client-generated id,
     * then gets reconciled (not duplicated) once the server confirms it. */
    async add(title: string) {
      if (!this.listId || !this.householdId) throw new Error('not_initialized')
      const userId = useSupabaseUser().value?.id
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

      try {
        const confirmed = await insertTodoItem(useSupabaseClient(), {
          id,
          listId: this.listId,
          householdId: this.householdId,
          title,
          position: optimistic.position,
        })
        this.itemsById = upsertTodoItem(this.itemsById, confirmed)
      } catch (e) {
        const { [id]: _removed, ...rest } = this.itemsById
        this.itemsById = rest
        this.error = e instanceof Error ? e.message : 'unknown_error'
      }
    },

    async toggle(id: string) {
      const item = this.itemsById[id]
      if (!item) return
      const done = !item.done
      this.itemsById = upsertTodoItem(this.itemsById, { ...item, done })
      try {
        await setTodoItemDone(useSupabaseClient(), id, done)
      } catch (e) {
        this.itemsById = upsertTodoItem(this.itemsById, item)
        this.error = e instanceof Error ? e.message : 'unknown_error'
      }
    },

    async remove(id: string) {
      const previous = this.itemsById[id]
      if (!previous) return
      this.itemsById = softDeleteTodoItem(this.itemsById, id)
      try {
        await softDeleteTodoItemRemote(useSupabaseClient(), id)
      } catch (e) {
        this.itemsById = upsertTodoItem(this.itemsById, previous)
        this.error = e instanceof Error ? e.message : 'unknown_error'
      }
    },
  },
})
