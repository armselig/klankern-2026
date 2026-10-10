import { describe, expect, it } from 'vitest'
import { createRealtimeEventOrder } from './realtime-event-order'

describe('createRealtimeEventOrder', () => {
  it('accepts events that arrive in commit order', () => {
    const order = createRealtimeEventOrder()
    expect(order.accept('item-1', '2026-01-01T00:00:35.436Z')).toBe(true)
    expect(order.accept('item-1', '2026-01-01T00:00:35.485Z')).toBe(true)
  })

  it('refuses an event committed before the newest one seen for the same item', () => {
    const order = createRealtimeEventOrder()
    expect(order.accept('item-1', '2026-01-01T00:00:35.485Z')).toBe(true)
    expect(order.accept('item-1', '2026-01-01T00:00:35.436Z')).toBe(false)
  })

  it('keeps comparing against the newest event after refusing a late one', () => {
    const order = createRealtimeEventOrder()
    order.accept('item-1', '2026-01-01T00:00:35.485Z')
    order.accept('item-1', '2026-01-01T00:00:35.436Z')
    expect(order.accept('item-1', '2026-01-01T00:00:35.460Z')).toBe(false)
    expect(order.accept('item-1', '2026-01-01T00:00:35.490Z')).toBe(true)
  })

  it('orders each item on its own', () => {
    const order = createRealtimeEventOrder()
    order.accept('item-1', '2026-01-01T00:00:35.485Z')
    expect(order.accept('item-2', '2026-01-01T00:00:35.436Z')).toBe(true)
  })

  it('accepts an event committed in the same millisecond as the newest one', () => {
    const order = createRealtimeEventOrder()
    order.accept('item-1', '2026-01-01T00:00:35.485Z')
    expect(order.accept('item-1', '2026-01-01T00:00:35.485Z')).toBe(true)
  })

  it('compares points in time, not the text of the timestamps', () => {
    const order = createRealtimeEventOrder()
    order.accept('item-1', '2026-01-01T00:00:35.5Z')
    expect(order.accept('item-1', '2026-01-01T00:00:35.436Z')).toBe(false)
    expect(order.accept('item-1', '2026-01-01T01:00:36+01:00')).toBe(true)
  })

  it('accepts an event whose commit time cannot be parsed, without remembering it', () => {
    const order = createRealtimeEventOrder()
    order.accept('item-1', '2026-01-01T00:00:35.485Z')
    expect(order.accept('item-1', 'not a timestamp')).toBe(true)
    expect(order.accept('item-1', '2026-01-01T00:00:35.436Z')).toBe(false)
  })
})
