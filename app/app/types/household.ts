import type { Database } from './database.types'

export type Household = Database['public']['Tables']['households']['Row']
export type HouseholdMember = Database['public']['Tables']['household_members']['Row']
export type HouseholdInvite = Database['public']['Tables']['household_invites']['Row']
