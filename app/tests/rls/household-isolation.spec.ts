// @vitest-environment node
//
// Admin-API test script, not a component test: must run under Node (no
// `window`), since supabase-js refuses to use a secret key whenever it
// detects a browser-like global scope -- happy-dom's `window` would trip
// that guard and raise "Forbidden use of secret API key in browser".
import { randomUUID } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Proves household-scoped RLS before any UI is built on top of the schema
// (plan milestone 2). Runs against the real Supabase Cloud project using
// disposable test users created via the Admin API, since this host's Podman
// cannot run the local Supabase stack (netavark/nftables race on concurrent
// container starts) and magic-link/OTP email can't be automated headlessly.

loadEnv()

const url = process.env.SUPABASE_URL
const publishableKey = process.env.SUPABASE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !publishableKey || !secretKey) {
  throw new Error(
    'SUPABASE_URL, SUPABASE_KEY and SUPABASE_SECRET_KEY must be set (see .env.example) to run RLS tests.',
  )
}

const TEST_EMAIL_DOMAIN = 'klankern-rls-test.invalid'
const runId = randomUUID().slice(0, 8)

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Creates a confirmed test user and returns a client scoped to their session (RLS applies as them). */
async function createTestUser(label: string) {
  const email = `rls-${label}-${runId}@${TEST_EMAIL_DOMAIN}`
  const password = randomUUID()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) throw createError ?? new Error('user creation failed')

  const anon = createClient(url, publishableKey)
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !signedIn.session) throw signInError ?? new Error('sign-in failed')

  const scoped = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${signedIn.session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return { userId: created.user.id, client: scoped }
}

async function createHousehold(client: SupabaseClient, name: string) {
  const { data: household, error } = await client.rpc('create_household', { p_name: name })
  if (error || !household) throw error ?? new Error('create_household failed')
  return household.id as string
}

async function addTodoItem(client: SupabaseClient, householdId: string, title: string) {
  const { data: list, error: listError } = await client
    .from('todo_lists')
    .insert({ household_id: householdId })
    .select('id')
    .single()
  if (listError || !list) throw listError ?? new Error('list insert failed')

  const { data: auth } = await client.auth.getUser()
  const { error: itemError } = await client.from('todo_items').insert({
    list_id: list.id,
    household_id: householdId,
    title,
    created_by: auth.user!.id,
  })
  if (itemError) throw itemError
}

describe('household RLS isolation', () => {
  let userA: Awaited<ReturnType<typeof createTestUser>>
  let userB: Awaited<ReturnType<typeof createTestUser>>
  let userC: Awaited<ReturnType<typeof createTestUser>>
  let householdAId: string
  let householdBId: string

  beforeAll(async () => {
    ;[userA, userB, userC] = await Promise.all([
      createTestUser('a'),
      createTestUser('b'),
      createTestUser('c'),
    ])

    householdAId = await createHousehold(userA.client, `Household A ${runId}`)
    householdBId = await createHousehold(userB.client, `Household B ${runId}`)

    await addTodoItem(userA.client, householdAId, 'Buy milk (household A)')
    await addTodoItem(userB.client, householdBId, 'Walk the dog (household B)')
  })

  afterAll(async () => {
    // Deleting the households (service-role, bypasses RLS) cascades to their
    // todo_lists/items, shopping_lists/items, invites and membership rows.
    await admin.from('households').delete().in('id', [householdAId, householdBId].filter(Boolean))
    for (const user of [userA, userB, userC]) {
      if (user?.userId) await admin.auth.admin.deleteUser(user.userId)
    }
  })

  it('lets a member read their own household', async () => {
    const { data, error } = await userA.client
      .from('households')
      .select('id')
      .eq('id', householdAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('hides another household from a non-member (RLS filters, not an error)', async () => {
    const { data, error } = await userB.client
      .from('households')
      .select('id')
      .eq('id', householdAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it("returns zero of household A's todo_items to a member of household B", async () => {
    const { data, error } = await userB.client
      .from('todo_items')
      .select('title')
      .eq('household_id', householdAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it("lets a member read their own household's todo_items", async () => {
    const { data, error } = await userA.client
      .from('todo_items')
      .select('title')
      .eq('household_id', householdAId)
    expect(error).toBeNull()
    expect(data).toEqual([{ title: 'Buy milk (household A)' }])
  })

  it('blocks a direct self-insert into an existing household (must use redeem_invite)', async () => {
    const { error } = await userB.client
      .from('household_members')
      .insert({ household_id: householdAId, user_id: userB.userId, role: 'member' })
    expect(error).not.toBeNull()
  })

  it('create_invite rejects a caller who is not a member of the household', async () => {
    const { data, error } = await userB.client.rpc('create_invite', {
      p_household_id: householdAId,
    })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('redeem_invite grants a new member access to the household', async () => {
    const { data: code, error: inviteError } = await userA.client.rpc('create_invite', {
      p_household_id: householdAId,
    })
    expect(inviteError).toBeNull()

    const { data: joinedHouseholdId, error: redeemError } = await userC.client.rpc(
      'redeem_invite',
      { p_code: code },
    )
    expect(redeemError).toBeNull()
    expect(joinedHouseholdId).toBe(householdAId)

    const { data, error } = await userC.client
      .from('todo_items')
      .select('title')
      .eq('household_id', householdAId)
    expect(error).toBeNull()
    expect(data).toEqual([{ title: 'Buy milk (household A)' }])
  })

  it('redeem_invite rejects an expired code', async () => {
    const { data: invite } = await admin
      .from('household_invites')
      .insert({
        household_id: householdAId,
        created_by: userA.userId,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      })
      .select('code')
      .single()

    const { data, error } = await userB.client.rpc('redeem_invite', { p_code: invite!.code })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('redeem_invite rejects an exhausted code', async () => {
    const { data: invite } = await admin
      .from('household_invites')
      .insert({
        household_id: householdAId,
        created_by: userA.userId,
        max_uses: 1,
        use_count: 1,
      })
      .select('code')
      .single()

    const { data, error } = await userB.client.rpc('redeem_invite', { p_code: invite!.code })
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})
