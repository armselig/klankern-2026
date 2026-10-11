import { randomUUID } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Shared by the RLS suite (Vitest) and the e2e suite (Playwright). Both run
// against the real Supabase Cloud project with disposable users created via
// the Admin API, since the project doesn't use a local Supabase stack and OTP
// email can't be read headlessly. Must run under Node: supabase-js refuses to
// use a secret key whenever it detects a browser-like global scope.

loadEnv({ quiet: true })

const url = process.env.SUPABASE_URL
const publishableKey = process.env.SUPABASE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !publishableKey || !secretKey) {
  throw new Error(
    'SUPABASE_URL, SUPABASE_KEY and SUPABASE_SECRET_KEY must be set (see .env.example) to run tests against Supabase.',
  )
}

const TEST_EMAIL_DOMAIN = 'klankern-rls-test.invalid'

/** Distinguishes this run's users and households from those of concurrent or crashed runs. */
export const runId = randomUUID().slice(0, 8)

export const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * A client without a session: what anyone can do who holds the publishable
 * key, which ships in the app's bundle, without signing in.
 */
export const signedOut = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export interface TestUser {
  userId: string
  email: string
  /** Client scoped to the user's session, so RLS applies as them. */
  client: SupabaseClient
}

/** Creates a confirmed test user and returns a client scoped to their session. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `rls-${label}-${runId}@${TEST_EMAIL_DOMAIN}`
  const password = randomUUID()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) throw createError ?? new Error('user creation failed')

  const anon = createClient(url!, publishableKey!)
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signedIn.session) throw signInError ?? new Error('sign-in failed')

  const scoped = createClient(url!, publishableKey!, {
    global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return { userId: created.user.id, email, client: scoped }
}

export async function createHousehold(client: SupabaseClient, name: string): Promise<string> {
  const { data: household, error } = await client.rpc('create_household', { p_name: name })
  if (error || !household) throw error ?? new Error('create_household failed')
  return household.id as string
}

/** An invite code for the household, created through the same RPC the app's invite dialog uses. */
export async function createInviteCode(owner: TestUser, householdId: string): Promise<string> {
  const { data: code, error } = await owner.client.rpc('create_invite', {
    p_household_id: householdId,
  })
  if (error || !code) throw error ?? new Error('create_invite failed')
  return code as string
}

/**
 * Inserts an invite directly (service role), so a test can create one that
 * `create_invite` never would: already expired, or already used up.
 */
export async function insertInvite(
  householdId: string,
  createdBy: string,
  overrides: { expires_at?: string; max_uses?: number; use_count?: number },
): Promise<string> {
  const { data: invite, error } = await admin
    .from('household_invites')
    .insert({ household_id: householdId, created_by: createdBy, ...overrides })
    .select('code')
    .single()
  if (error || !invite) throw error ?? new Error('invite insert failed')
  return invite.code as string
}

/** Adds `member` to the owner's household through the same invite RPCs the app uses. */
export async function joinHousehold(owner: TestUser, member: TestUser, householdId: string) {
  const code = await createInviteCode(owner, householdId)
  const { error: redeemError } = await member.client.rpc('redeem_invite', { p_code: code })
  if (redeemError) throw redeemError
}

/** The id of the household a user belongs to, for cleaning up one created through the UI. */
export async function findHouseholdId(user: TestUser): Promise<string | undefined> {
  const { data } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.userId)
    .maybeSingle()
  return data?.household_id as string | undefined
}

/**
 * A login code for the app's email-OTP form, issued by the Admin API instead
 * of being emailed -- so tests can sign in through the real UI without an
 * inbox.
 */
export async function generateLoginCode(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  return data.properties.email_otp
}

/**
 * Deleting the households (service role, bypasses RLS) cascades to their
 * todo_lists/items, shopping_lists/items, boards and their strokes, invites
 * and membership rows.
 */
export async function deleteTestData(
  householdIds: (string | undefined)[],
  users: (TestUser | undefined)[],
) {
  const ids = householdIds.filter((id): id is string => Boolean(id))
  if (ids.length) await admin.from('households').delete().in('id', ids)
  for (const user of users) {
    if (user?.userId) await admin.auth.admin.deleteUser(user.userId)
  }
}
