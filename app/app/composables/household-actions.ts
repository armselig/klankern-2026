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

/** Creates a household and makes the caller its owner. Two inserts: RLS only allows
 * claiming ownership (migration 0004) when the household has zero existing members,
 * which is true immediately after this first insert. */
export async function createHousehold(client: Client, name: string): Promise<Household> {
  const { data: household, error: householdError } = await client
    .from('households')
    .insert({ name })
    .select()
    .single()
  if (householdError) throw householdError

  const userId = await getCurrentUserId(client)
  const { error: memberError } = await client
    .from('household_members')
    .insert({ household_id: household.id, user_id: userId, role: 'owner' })
  if (memberError) throw memberError

  return household
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

/** Creates an invite for a household the caller already belongs to. Returns the redeemable code. */
export async function createInvite(client: Client, householdId: string): Promise<string> {
  const userId = await getCurrentUserId(client)
  const { data, error } = await client
    .from('household_invites')
    .insert({ household_id: householdId, created_by: userId })
    .select('code')
    .single()
  if (error) throw error
  return data.code
}

/** Redeems an invite code, joining the caller to that household. Returns the joined household's id. */
export async function redeemInvite(client: Client, code: string): Promise<string> {
  const { data, error } = await client.rpc('redeem_invite', { p_code: code })
  if (error) throw error
  return data
}
