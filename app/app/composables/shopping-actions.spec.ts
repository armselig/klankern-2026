import { describe, expect, it, vi } from 'vitest'
import {
  fetchOrCreateShoppingList,
  fetchShoppingItems,
  insertShoppingItem,
  setShoppingItemChecked,
  softDeleteShoppingItemRemote,
} from './shopping-actions'
import { fakeClient, fakeQueryBuilder } from '../../tests/support/fake-supabase-client'

describe('fetchOrCreateShoppingList', () => {
  it('returns the existing list without creating one', async () => {
    const list = { id: 'list-1', household_id: 'h1', name: 'Shopping', created_at: 'now' }
    const query = fakeQueryBuilder({ data: list, error: null })
    const client = fakeClient({ from: () => query.builder })

    expect(await fetchOrCreateShoppingList(client as never, 'h1')).toEqual(list)
    expect(query.calls.eq).toEqual(['household_id', 'h1'])
    expect(query.calls.insert).toBeUndefined()
  })

  it('creates a list when none exists yet', async () => {
    const created = { id: 'list-1', household_id: 'h1', name: 'Shopping', created_at: 'now' }
    // First .from() call is the lookup (no list), the second the insert.
    let call = 0
    const inserts = fakeQueryBuilder({ data: created, error: null })
    const from = vi.fn(() => {
      call++
      return call === 1 ? fakeQueryBuilder({ data: null, error: null }).builder : inserts.builder
    })
    const client = fakeClient({ from })

    expect(await fetchOrCreateShoppingList(client as never, 'h1')).toEqual(created)
    expect(from).toHaveBeenCalledWith('shopping_lists')
    expect(inserts.calls.insert).toEqual([{ household_id: 'h1' }])
  })
})

describe('fetchShoppingItems', () => {
  it('returns only non-deleted items of the list, ordered by position', async () => {
    const items = [{ id: 'a', position: 1 }]
    const query = fakeQueryBuilder({ data: items, error: null })
    const from = vi.fn(() => query.builder)
    const client = fakeClient({ from })

    expect(await fetchShoppingItems(client as never, 'list-1')).toEqual(items)
    expect(from).toHaveBeenCalledWith('shopping_items')
    expect(query.calls.eq).toEqual(['list_id', 'list-1'])
    expect(query.calls.is).toEqual(['deleted_at', null])
    expect(query.calls.order).toEqual(['position'])
  })
})

describe('insertShoppingItem', () => {
  it('inserts with the client-supplied id, quantity and the resolved created_by', async () => {
    const row = { id: 'item-1', title: 'Apples', quantity: '6' }
    const query = fakeQueryBuilder({ data: row, error: null })
    const client = fakeClient({ userId: 'user-1', from: () => query.builder })

    const result = await insertShoppingItem(client as never, {
      id: 'item-1',
      listId: 'list-1',
      householdId: 'h1',
      title: 'Apples',
      quantity: '6',
      position: 1,
    })

    expect(result).toEqual(row)
    expect(query.calls.insert).toEqual([
      {
        id: 'item-1',
        list_id: 'list-1',
        household_id: 'h1',
        title: 'Apples',
        quantity: '6',
        position: 1,
        created_by: 'user-1',
      },
    ])
  })

  it('stores a missing quantity as null', async () => {
    const query = fakeQueryBuilder({ data: { id: 'item-1' }, error: null })
    const client = fakeClient({ from: () => query.builder })

    await insertShoppingItem(client as never, {
      id: 'item-1',
      listId: 'list-1',
      householdId: 'h1',
      title: 'Bread',
      quantity: null,
      position: 1,
    })

    expect((query.calls.insert![0] as { quantity: unknown }).quantity).toBeNull()
  })
})

describe('setShoppingItemChecked', () => {
  it('updates the checked flag for the given id', async () => {
    const query = fakeQueryBuilder({ data: null, error: null })
    const client = fakeClient({ from: () => query.builder })

    await setShoppingItemChecked(client as never, 'item-1', true)

    expect(query.calls.update).toEqual([{ checked: true }])
    expect(query.calls.eq).toEqual(['id', 'item-1'])
  })

  it('throws on error', async () => {
    const error = new Error('boom')
    const query = fakeQueryBuilder({ data: null, error })
    const client = fakeClient({ from: () => query.builder })

    await expect(setShoppingItemChecked(client as never, 'item-1', true)).rejects.toBe(error)
  })
})

describe('softDeleteShoppingItemRemote', () => {
  it('sets deleted_at for the given id', async () => {
    const query = fakeQueryBuilder({ data: null, error: null })
    const client = fakeClient({ from: () => query.builder })

    await softDeleteShoppingItemRemote(client as never, 'item-1')

    expect(query.calls.eq).toEqual(['id', 'item-1'])
    expect(typeof (query.calls.update![0] as { deleted_at: string }).deleted_at).toBe('string')
  })
})
