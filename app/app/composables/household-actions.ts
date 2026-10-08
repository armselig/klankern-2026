import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { Household } from '~/types/household'
import { getCurrentUserId } from './current-user'

type Client = SupabaseClient<Database>

/**
 * Plain, framework-agnostic household operations. Kept separate from the
 * Pinia store (stores/household.ts) so the actual business logic -- what
 * each operation does, in what order, against which tables -- is unit
 * testable with a mocked SupabaseClient, without needing a Nuxt runtime.
 */

/** Creates a household and makes the caller its owner, atomically, via the
 * create_household RPC (migration 0007). Not a plain insert + select: RETURNING
 * the new household would have to pass its SELECT policy, which requires a
 * membership that doesn't exist yet at that point. */
export async function createHousehold(client: Client, name: string): Promise<Household> {
  const { data, error } = await client.rpc('create_household', { p_name: name })
  if (error) throw error
  return data
}

/** The household the current user belongs to, or null if they haven't created/joined one yet. */
export async function fetchMyHousehold(client: Client): Promise<Household | null> {
  const userId = await getCurrentUserId(client)
  const { data, error } = await client
    .from('household_members')
    .select('households(*)')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.households ?? null
}

/** Creates an invite for a household the caller already belongs to. Returns the redeemable code.
 * Goes through the create_invite RPC (migration 0007) because household_invites has no SELECT
 * policy (codes must not be enumerable), so an insert could never read its code back. */
export async function createInvite(client: Client, householdId: string): Promise<string> {
  const { data, error } = await client.rpc('create_invite', { p_household_id: householdId })
  if (error) throw error
  return data
}

/** Redeems an invite code, joining the caller to that household. Returns the joined household's id. */
export async function redeemInvite(client: Client, code: string): Promise<string> {
  const { data, error } = await client.rpc('redeem_invite', { p_code: code })
  if (error) throw error
  return data
}
