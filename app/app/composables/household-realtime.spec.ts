import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { TodoItem } from '~/types/todo'
import { subscribeToHouseholdChanges } from './household-realtime'

type ChangeCallback = (payload: { eventType: string; new: unknown }) => void
type StatusCallback = (status: string) => void

function fakeRealtimeClient() {
  const registrations: {
    type: string
    filter: Record<string, string>
    callback: ChangeCallback
  }[] = []
  let statusCallback: StatusCallback = () => {}
  const channel = {
    on: (type: string, filter: Record<string, string>, callback: ChangeCallback) => {
      registrations.push({ type, filter, callback })
      return channel
    },
    subscribe: (callback: StatusCallback) => {
      statusCallback = callback
      return channel
    },
  }
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  }
  return {
    client: client as unknown as SupabaseClient<Database>,
    channel,
    registrations,
    removeChannel: client.removeChannel,
    channelFactory: client.channel,
    emitStatus: (status: string) => statusCallback(status),
  }
}

const row: TodoItem = {
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
}

function listeners() {
  return { onTodoItemChange: vi.fn(), onSubscribed: vi.fn() }
}

describe('subscribeToHouseholdChanges', () => {
  it('opens one channel per household', () => {
    const fake = fakeRealtimeClient()
    subscribeToHouseholdChanges(fake.client, 'house-1', listeners())
    expect(fake.channelFactory).toHaveBeenCalledWith('household:house-1')
  })

  it('listens to INSERT and UPDATE on todo_items, filtered to the household -- never DELETE', () => {
    const fake = fakeRealtimeClient()
    subscribeToHouseholdChanges(fake.client, 'house-1', listeners())

    expect(fake.registrations.map((r) => [r.type, r.filter])).toEqual([
      [
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'todo_items',
          filter: 'household_id=eq.house-1',
        },
      ],
      [
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'todo_items',
          filter: 'household_id=eq.house-1',
        },
      ],
    ])
  })

  it('passes to-do changes on as ListRealtimeEvents', () => {
    const fake = fakeRealtimeClient()
    const l = listeners()
    subscribeToHouseholdChanges(fake.client, 'house-1', l)

    fake.registrations[0]?.callback({ eventType: 'INSERT', new: row })
    fake.registrations[1]?.callback({ eventType: 'UPDATE', new: { ...row, done: true } })

    expect(l.onTodoItemChange).toHaveBeenNthCalledWith(1, { eventType: 'INSERT', new: row })
    expect(l.onTodoItemChange).toHaveBeenNthCalledWith(2, {
      eventType: 'UPDATE',
      new: { ...row, done: true },
    })
  })

  it('asks for a resync on every SUBSCRIBED, including reconnects, and on nothing else', () => {
    const fake = fakeRealtimeClient()
    const l = listeners()
    subscribeToHouseholdChanges(fake.client, 'house-1', l)

    fake.emitStatus('SUBSCRIBED')
    fake.emitStatus('CHANNEL_ERROR')
    fake.emitStatus('SUBSCRIBED')

    expect(l.onSubscribed).toHaveBeenCalledTimes(2)
  })

  it('returns an unsubscribe function that removes the channel', () => {
    const fake = fakeRealtimeClient()
    const unsubscribe = subscribeToHouseholdChanges(fake.client, 'house-1', listeners())

    expect(fake.removeChannel).not.toHaveBeenCalled()
    unsubscribe()
    expect(fake.removeChannel).toHaveBeenCalledWith(fake.channel)
  })
})
