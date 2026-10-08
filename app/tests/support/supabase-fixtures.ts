import { randomUUID } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Shared by the RLS suite (Vitest) and the e2e suite (Playwright). Both run
// against the real Supabase Cloud project with disposable users created via
// the Admin API, since this host's Podman cannot run the local Supabase stack
// (netavark/nftables race on concurrent container starts) and OTP email
// can't be read headlessly. Must run under Node: supabase-js refuses to use
// a secret key whenever it detects a browser-like global scope.

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

/** Adds `member` to the owner's household through the same invite RPCs the app uses. */
export async function joinHousehold(owner: TestUser, member: TestUser, householdId: string) {
  const { data: code, error: inviteError } = await owner.client.rpc('create_invite', {
    p_household_id: householdId,
  })
  if (inviteError || !code) throw inviteError ?? new Error('create_invite failed')

  const { error: redeemError } = await member.client.rpc('redeem_invite', { p_code: code })
  if (redeemError) throw redeemError
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
 * todo_lists/items, shopping_lists/items, invites and membership rows.
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
