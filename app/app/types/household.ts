import type { Database } from './database.types'

export type Household = Database['public']['Tables']['households']['Row']
export type HouseholdMember = Database['public']['Tables']['household_members']['Row']
export type HouseholdInvite = Database['public']['Tables']['household_invites']['Row']

/** A member as the list_household_members RPC returns it: with the email
 * address, which the household_members table doesn't have. */
export type HouseholdMemberProfile =
  Database['public']['Functions']['list_household_members']['Returns'][number]
