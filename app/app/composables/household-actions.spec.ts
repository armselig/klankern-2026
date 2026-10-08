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
  it('calls the create_household RPC and returns the created household', async () => {
    const household = { id: 'h1', name: 'The Does', created_at: 'now' }
    const rpc = vi.fn().mockResolvedValue({ data: household, error: null })
    const client = fakeClient({ rpc })

    const result = await createHousehold(client as never, 'The Does')

    expect(result).toEqual(household)
    expect(rpc).toHaveBeenCalledWith('create_household', { p_name: 'The Does' })
  })

  it('throws when the RPC fails', async () => {
    const error = new Error('not_authenticated')
    const rpc = vi.fn().mockResolvedValue({ data: null, error })
    const client = fakeClient({ rpc })

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
  it('calls the create_invite RPC for the household and returns the code', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'abc123', error: null })
    const client = fakeClient({ rpc })

    const code = await createInvite(client as never, 'h1')

    expect(code).toBe('abc123')
    expect(rpc).toHaveBeenCalledWith('create_invite', { p_household_id: 'h1' })
  })

  it('throws when the caller is not a member of the household', async () => {
    const error = new Error('not_a_household_member')
    const rpc = vi.fn().mockResolvedValue({ data: null, error })
    const client = fakeClient({ rpc })

    await expect(createInvite(client as never, 'h1')).rejects.toBe(error)
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
