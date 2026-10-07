import { describe, expect, it, vi } from 'vitest'
import { createHousehold, createInvite, fetchMyHousehold, redeemInvite } from './household-actions'

/**
 * A minimal chainable stand-in for the Supabase query builder. Every
 * chain method (`insert`, `select`, `eq`, ...) is recorded and returns the
 * same object; awaiting the chain (or calling `.single()`/`.maybeSingle()`)
 * resolves to whatever `result` the test configured.
 */
function fakeQueryBuilder(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, unknown> = {
    then: (resolve: (v: typeof result) => void) => resolve(result),
  }
  for (const method of ['insert', 'select', 'eq', 'single', 'maybeSingle', 'update', 'delete']) {
    builder[method] = (...args: unknown[]) => {
      calls[method] = args
      return builder
    }
  }
  return { builder, calls }
}

function fakeClient({
  userId = 'user-1',
  from,
  rpc,
}: {
  userId?: string
  from?: (table: string) => unknown
  rpc?: (...args: unknown[]) => unknown
}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn(from ?? (() => fakeQueryBuilder({ data: null, error: null }).builder)),
    rpc: vi.fn(rpc ?? (() => Promise.resolve({ data: null, error: null }))),
  }
}

describe('createHousehold', () => {
  it('inserts the household, then inserts the caller as owner', async () => {
    const household = { id: 'h1', name: 'The Does', created_at: 'now' }
    const householdQuery = fakeQueryBuilder({ data: household, error: null })
    const memberQuery = fakeQueryBuilder({ data: null, error: null })

    const from = vi.fn((table: string) =>
      table === 'households' ? householdQuery.builder : memberQuery.builder,
    )
    const client = fakeClient({ userId: 'user-1', from })

    const result = await createHousehold(client as never, 'The Does')

    expect(result).toEqual(household)
    expect(householdQuery.calls.insert).toEqual([{ name: 'The Does' }])
    expect(memberQuery.calls.insert).toEqual([
      { household_id: 'h1', user_id: 'user-1', role: 'owner' },
    ])
  })

  it('throws when the household insert fails, without attempting the member insert', async () => {
    const error = new Error('insert failed')
    const householdQuery = fakeQueryBuilder({ data: null, error })
    const from = vi.fn(() => householdQuery.builder)
    const client = fakeClient({ from })

    await expect(createHousehold(client as never, 'x')).rejects.toBe(error)
  })
})

describe('fetchMyHousehold', () => {
  it('returns null when the user has no household yet', async () => {
    const query = fakeQueryBuilder({ data: null, error: null })
    const client = fakeClient({ from: () => query.builder })

    expect(await fetchMyHousehold(client as never)).toBeNull()
  })

  it('returns the joined household row', async () => {
    const household = { id: 'h1', name: 'The Does', created_at: 'now' }
    const query = fakeQueryBuilder({ data: { households: household }, error: null })
    const client = fakeClient({ from: () => query.builder })

    expect(await fetchMyHousehold(client as never)).toEqual(household)
  })
})

describe('createInvite', () => {
  it('inserts an invite scoped to the household and the caller, returns the code', async () => {
    const query = fakeQueryBuilder({ data: { code: 'abc123' }, error: null })
    const client = fakeClient({ userId: 'user-1', from: () => query.builder })

    const code = await createInvite(client as never, 'h1')

    expect(code).toBe('abc123')
    expect(query.calls.insert).toEqual([{ household_id: 'h1', created_by: 'user-1' }])
  })
})

describe('redeemInvite', () => {
  it('calls the redeem_invite RPC and returns the joined household id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'h1', error: null })
    const client = fakeClient({ rpc })

    const householdId = await redeemInvite(client as never, 'abc123')

    expect(householdId).toBe('h1')
    expect(rpc).toHaveBeenCalledWith('redeem_invite', { p_code: 'abc123' })
  })

  it('throws when the code is invalid or expired', async () => {
    const error = new Error('invalid_or_expired_invite')
    const rpc = vi.fn().mockResolvedValue({ data: null, error })
    const client = fakeClient({ rpc })

    await expect(redeemInvite(client as never, 'bad')).rejects.toBe(error)
  })
})
