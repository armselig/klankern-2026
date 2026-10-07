import type { SupabaseClient } from '@supabase/supabase-js'

/** Shared by every *-actions module that needs the caller's id for created_by/user_id columns. */
export async function getCurrentUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('not_authenticated')
  return data.user.id
}
