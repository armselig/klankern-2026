import { describe, expect, it } from 'vitest'
import type { TodoItem } from '~/types/todo'
import { softDeleteTodoItem, upsertTodoItem, visibleTodoItems } from './todo-state'

function item(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'item-1',
    list_id: 'list-1',
    household_id: 'house-1',
    title: 'Buy milk',
    done: false,
    position: 1,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('upsertTodoItem', () => {
  it('adds a new item under its id', () => {
    const result = upsertTodoItem({}, item())
    expect(result).toEqual({ 'item-1': item() })
  })

  it('dedups: upserting the same id again (e.g. the server-confirmed echo of an optimistic insert) replaces, not duplicates', () => {
    const optimistic = item({ created_at: 'pending' })
    const confirmed = item({ created_at: '2026-01-01T00:00:05Z' })

    let state = upsertTodoItem({}, optimistic)
    state = upsertTodoItem(state, confirmed)

    expect(Object.keys(state)).toEqual(['item-1'])
    expect(state['item-1']).toEqual(confirmed)
  })
})

describe('softDeleteTodoItem', () => {
  it('sets deleted_at on the targeted item and leaves others untouched', () => {
    const state = { 'item-1': item(), 'item-2': item({ id: 'item-2' }) }
    const result = softDeleteTodoItem(state, 'item-1')

    expect(result['item-1']?.deleted_at).not.toBeNull()
    expect(result['item-2']?.deleted_at).toBeNull()
  })

  it('is a no-op when the id is unknown', () => {
    const state = { 'item-1': item() }
    expect(softDeleteTodoItem(state, 'missing')).toBe(state)
  })
})

describe('visibleTodoItems', () => {
  it('excludes soft-deleted items', () => {
    const state = {
      'item-1': item({ id: 'item-1' }),
      'item-2': item({ id: 'item-2', deleted_at: '2026-01-02T00:00:00Z' }),
    }
    expect(visibleTodoItems(state).map((i) => i.id)).toEqual(['item-1'])
  })

  it('sorts by position ascending', () => {
    const state = {
      a: item({ id: 'a', position: 3 }),
      b: item({ id: 'b', position: 1 }),
      c: item({ id: 'c', position: 2 }),
    }
    expect(visibleTodoItems(state).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})
