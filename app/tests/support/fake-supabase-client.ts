import { vi } from 'vitest'

/** What an awaited Supabase query resolves to. */
interface FakeQueryResult {
  data: unknown
  error: unknown
}

/** The chain methods the `*-actions.ts` functions call on a query. */
const CHAIN_METHODS = [
  'insert',
  'upsert',
  'select',
  'eq',
  'gt',
  'is',
  'order',
  'limit',
  'single',
  'maybeSingle',
  'update',
] as const

type ChainMethod = (typeof CHAIN_METHODS)[number]

/**
 * A minimal chainable stand-in for the Supabase query builder, so the
 * `*-actions.ts` functions can be unit tested without a network or the Nuxt
 * runtime. Every chain method (`insert`, `select`, `eq`, ...) returns the same
 * object; awaiting the chain (or calling `.single()`/`.maybeSingle()`)
 * resolves to whatever `result` the test configured.
 *
 * `calls` holds the arguments of the **last** call of each method, which is
 * enough to assert on the filters and payload of a single query.
 */
export function fakeQueryBuilder(result: FakeQueryResult) {
  const calls: Partial<Record<ChainMethod, unknown[]>> = {}
  const builder: Record<string, unknown> = {
    then: (resolve: (v: FakeQueryResult) => void) => resolve(result),
  }
  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls[method] = args
      return builder
    }
  }
  return { builder, calls }
}

/**
 * A stand-in for the parts of `SupabaseClient` the actions use: the signed-in
 * user, `.from()` and `.rpc()`. Shared by every `*-actions.spec.ts` so the
 * fake exists once and cannot drift between features. Without `from` or
 * `rpc`, every query and RPC resolves to `{ data: null, error: null }`.
 */
export function fakeClient({
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
