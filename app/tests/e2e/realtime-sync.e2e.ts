import { expect, test, type Page } from '@playwright/test'
import { controlRealtimeSocket } from '../support/realtime-socket'
import {
  addShoppingItem,
  addTodo,
  EMPTY_LIST_TEXT,
  listItem,
  openList,
  removeListItem,
  signIn,
  signOut,
  untilSaved,
} from '../support/e2e-ui'
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  joinHousehold,
  runId,
  type TestUser,
} from '../support/supabase-fixtures'

// Milestones 5 and 6: two members in two browser contexts see each other's
// to-do and shopping changes live, including after a dropped Realtime
// connection.

/**
 * Signs both members in and opens the same list page on each.
 */
async function openListForBoth(pages: Page[], users: TestUser[], linkName: 'To-dos' | 'Shopping') {
  for (const [index, page] of pages.entries()) {
    await signIn(page, users[index]!)
    await openList(page, linkName)
    await expect(page.getByText(EMPTY_LIST_TEXT)).toBeVisible()
  }
}

test.describe('realtime sync between two members', () => {
  let userA: TestUser
  let userB: TestUser
  let householdId: string

  test.beforeAll(async () => {
    ;[userA, userB] = await Promise.all([createTestUser('e2e-a'), createTestUser('e2e-b')])
    householdId = await createHousehold(userA.client, `E2E ${runId}`)
    await joinHousehold(userA, userB, householdId)
  })

  test.afterAll(async () => {
    await deleteTestData([householdId], [userA, userB])
  })

  test('to-do changes appear live on the other member, including after a reconnect', async ({
    browser,
  }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const socketA = await controlRealtimeSocket(contextA)
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openListForBoth([pageA, pageB], [userA, userB], 'To-dos')

    await test.step('an item added by B appears on A', async () => {
      await addTodo(pageB, 'Milk from B')
      await expect(listItem(pageA, 'Milk from B')).toBeVisible()
    })

    await test.step("A's own add appears once on A (echo deduplicated) and on B", async () => {
      await addTodo(pageA, 'Bread from A')
      await expect(listItem(pageB, 'Bread from A')).toBeVisible()
      await expect(listItem(pageA, 'Bread from A')).toHaveCount(1)
    })

    await test.step('a toggle by B shows on A', async () => {
      await listItem(pageB, 'Milk from B').click()
      await expect(listItem(pageA, 'Milk from B')).toBeChecked()
    })

    await test.step('a delete by B removes the item on A', async () => {
      await removeListItem(pageB, 'Bread from A')
      await expect(listItem(pageA, 'Bread from A')).toHaveCount(0)
    })

    await test.step('changes made while A was disconnected show up after the reconnect', async () => {
      socketA.goOffline()
      await addTodo(pageB, 'Eggs while A was offline')
      await removeListItem(pageB, 'Milk from B')
      await expect(listItem(pageB, 'Milk from B')).toHaveCount(0)
      // Neither change may reach A while it is cut off, or this step proves
      // nothing about the resync. Live events arrive well within this wait.
      await pageA.waitForTimeout(3_000)
      await expect(listItem(pageA, 'Eggs while A was offline')).toHaveCount(0)
      await expect(listItem(pageA, 'Milk from B')).toBeVisible()

      socketA.goOnline()
      await expect(listItem(pageA, 'Eggs while A was offline')).toBeVisible({ timeout: 30_000 })
      await expect(listItem(pageA, 'Milk from B')).toHaveCount(0)
    })

    await test.step("signing out leaves the household's channel", async () => {
      await signOut(pageA)
      await expect
        .poll(() =>
          socketA.sentFrames.some(
            (frame) => frame.includes(`household:${householdId}`) && frame.includes('phx_leave'),
          ),
        )
        .toBe(true)
    })

    await contextA.close()
    await contextB.close()
  })

  test('shopping changes appear live on the other member, checked items last', async ({
    browser,
  }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await openListForBoth([pageA, pageB], [userA, userB], 'Shopping')

    await test.step('items added by B appear on A, with their quantity', async () => {
      await addShoppingItem(pageB, 'Apples', '6')
      await addShoppingItem(pageB, 'Bread')
      await expect(pageA.getByRole('checkbox')).toHaveText(['Apples (6)', 'Bread'])
    })

    await test.step('an item checked by B is checked on A and moves to the bottom', async () => {
      await listItem(pageB, 'Apples (6)').click()
      await expect(listItem(pageA, 'Apples (6)')).toBeChecked()
      await expect(pageA.getByRole('checkbox')).toHaveText(['Bread', 'Apples (6)'])
    })

    await test.step('an item removed by B disappears on A', async () => {
      await removeListItem(pageB, 'Bread')
      await expect(pageA.getByRole('checkbox')).toHaveText(['Apples (6)'])
    })

    await contextA.close()
    await contextB.close()
  })

  // The fetch's rows predate a write saved while it was in flight; the write
  // is no longer pending when the fetch returns (changes-during-fetch.ts).
  test('a check saved while a resync is fetching is not undone by that fetch', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const socket = await controlRealtimeSocket(context)
    const page = await context.newPage()
    const title = `Resync race ${runId}`

    await signIn(page, userA)
    await openList(page, 'Shopping')
    const added = page.waitForResponse(
      (response) =>
        response.url().includes('/shopping_items') && response.request().method() === 'POST',
    )
    await addShoppingItem(page, title)
    await added
    // Let the channel's own first joins (and their resyncs) settle, so the
    // fetch held below is the one this test triggers.
    await expect
      .poll(() => socket.receivedFrames.some((frame) => frame.includes('Subscribed to PostgreSQL')))
      .toBe(true)
    await page.waitForTimeout(3_000)

    // Hold the next list fetch after the server has answered it: its rows
    // are a snapshot from before the check below.
    let snapshotTaken!: () => void
    const snapshot = new Promise<void>((resolve) => (snapshotTaken = resolve))
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let held = false
    await page.route(/\/rest\/v1\/shopping_items/, async (route) => {
      if (route.request().method() !== 'GET' || held) return route.fallback()
      held = true
      const response = await route.fetch()
      snapshotTaken()
      await released
      await route.fulfill({ response })
    })

    await test.step('a reconnect starts a resync, whose fetch is held', async () => {
      socket.goOffline()
      socket.goOnline()
      await snapshot
    })

    await test.step('the item is checked and saved while the fetch is held', async () => {
      await untilSaved(page, () => listItem(page, title).click())
      // Wait for the UPDATE echo too: arriving after the merge, it would
      // repair the state and hide the problem.
      await expect
        .poll(() =>
          socket.receivedFrames.some(
            (frame) =>
              frame.includes('"UPDATE"') &&
              frame.includes(title) &&
              /"checked":\s*true/.test(frame),
          ),
        )
        .toBe(true)
    })

    await test.step('the late fetch result does not undo the check', async () => {
      const merged = page.waitForResponse(
        (response) =>
          response.url().includes('/shopping_items') && response.request().method() === 'GET',
      )
      release()
      await merged
      await page.waitForTimeout(1_000)
      await expect(listItem(page, title)).toBeChecked()
    })

    await context.close()
  })

  // Realtime sometimes delivers an item's UPDATE before its INSERT when both
  // are committed close together; the INSERT's row predates the check
  // (realtime-event-order.ts). Forced here by holding the INSERT back.
  test('an INSERT event arriving after the UPDATE of the same item does not undo the check', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const socket = await controlRealtimeSocket(context)
    const page = await context.newPage()
    const title = `Late insert ${runId}`
    const isEventForItem = (frame: string, eventType: 'INSERT' | 'UPDATE') =>
      frame.includes(`"${eventType}"`) && frame.includes(title)

    await signIn(page, userA)
    await openList(page, 'Shopping')
    await expect
      .poll(() => socket.receivedFrames.some((frame) => frame.includes('Subscribed to PostgreSQL')))
      .toBe(true)
    const deliverInsert = socket.holdReceivedFrames((frame) => isEventForItem(frame, 'INSERT'))

    await test.step('the item is added and checked; only the UPDATE event reaches the app', async () => {
      const added = page.waitForResponse(
        (response) =>
          response.url().includes('/shopping_items') && response.request().method() === 'POST',
      )
      await addShoppingItem(page, title)
      await added
      await untilSaved(page, () => listItem(page, title).click())
      await expect
        .poll(() => socket.receivedFrames.some((frame) => isEventForItem(frame, 'INSERT')))
        .toBe(true)
      await expect
        .poll(() =>
          socket.receivedFrames.some(
            (frame) => isEventForItem(frame, 'UPDATE') && /"checked":\s*true/.test(frame),
          ),
        )
        .toBe(true)
    })

    await test.step('the late INSERT event does not uncheck the item', async () => {
      deliverInsert()
      await page.waitForTimeout(1_000)
      await expect(listItem(page, title)).toBeChecked()
    })

    await context.close()
  })
})
