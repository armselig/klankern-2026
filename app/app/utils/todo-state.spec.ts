import { describe, expect, it } from 'vitest'
import type { TodoItem, TodoRealtimeEvent } from '~/types/todo'
import {
  applyTodoRealtimeEvent,
  mergeTodoResync,
  softDeleteTodoItem,
  upsertTodoItem,
  visibleTodoItems,
} from './todo-state'

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

function event(eventType: TodoRealtimeEvent['eventType'], row: TodoItem): TodoRealtimeEvent {
  return { eventType, new: row }
}

describe('applyTodoRealtimeEvent', () => {
  it('adds an item inserted by another member', () => {
    const result = applyTodoRealtimeEvent({}, event('INSERT', item()), 'list-1')
    expect(result).toEqual({ 'item-1': item() })
  })

  it('dedups the INSERT echo of an optimistic add', () => {
    const state = { 'item-1': item({ created_at: 'pending' }) }
    const result = applyTodoRealtimeEvent(state, event('INSERT', item()), 'list-1')

    expect(Object.keys(result)).toEqual(['item-1'])
    expect(result['item-1']).toEqual(item())
  })

  it('applies a remote toggle', () => {
    const state = { 'item-1': item() }
    const result = applyTodoRealtimeEvent(state, event('UPDATE', item({ done: true })), 'list-1')
    expect(result['item-1']?.done).toBe(true)
  })

  it('hides an item soft-deleted by another member', () => {
    const state = { 'item-1': item() }
    const deleted = item({ deleted_at: '2026-01-02T00:00:00Z' })
    const result = applyTodoRealtimeEvent(state, event('UPDATE', deleted), 'list-1')

    expect(visibleTodoItems(result)).toEqual([])
  })

  it('does not let a late INSERT or UPDATE resurrect a locally deleted item', () => {
    const state = { 'item-1': item({ deleted_at: '2026-01-02T00:00:00Z' }) }

    expect(applyTodoRealtimeEvent(state, event('INSERT', item()), 'list-1')).toBe(state)
    expect(applyTodoRealtimeEvent(state, event('UPDATE', item({ done: true })), 'list-1')).toBe(
      state,
    )
  })

  it('ignores events for another list', () => {
    const state = { 'item-1': item() }
    const other = item({ id: 'item-2', list_id: 'list-2' })
    expect(applyTodoRealtimeEvent(state, event('INSERT', other), 'list-1')).toBe(state)
  })

  it('ignores every event while no list is loaded', () => {
    const state = {}
    expect(applyTodoRealtimeEvent(state, event('INSERT', item()), null)).toBe(state)
  })
})

describe('mergeTodoResync', () => {
  it('takes the fetched rows as the new state', () => {
    const state = { 'item-1': item({ title: 'Old title' }) }
    const result = mergeTodoResync(state, [item({ title: 'New title' })], [])
    expect(result).toEqual({ 'item-1': item({ title: 'New title' }) })
  })

  it('keeps an optimistic add the server has not confirmed yet', () => {
    const optimistic = item({ id: 'pending-add' })
    const result = mergeTodoResync({ 'pending-add': optimistic }, [item()], ['pending-add'])

    expect(result['pending-add']).toEqual(optimistic)
    expect(result['item-1']).toEqual(item())
  })

  it('keeps a pending local change over the fetched row', () => {
    const local = item({ done: true })
    const result = mergeTodoResync({ 'item-1': local }, [item({ done: false })], ['item-1'])
    expect(result['item-1']).toEqual(local)
  })

  it('does not resurrect a locally deleted item the fetch still returns as live', () => {
    const tombstone = item({ deleted_at: '2026-01-02T00:00:00Z' })
    const result = mergeTodoResync({ 'item-1': tombstone }, [item()], [])
    expect(visibleTodoItems(result)).toEqual([])
  })

  it('drops an item deleted remotely while offline (missing from the fetch)', () => {
    const state = { 'item-1': item(), 'item-2': item({ id: 'item-2' }) }
    const result = mergeTodoResync(state, [item()], [])
    expect(Object.keys(result)).toEqual(['item-1'])
  })
})
