import { expect, test, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test'
import { ROUTES } from '../../app/utils/routes'
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  generateLoginCode,
  joinHousehold,
  runId,
  type TestUser,
} from '../support/supabase-fixtures'

// Milestones 5 and 6: two members in two browser contexts see each other's
// to-do and shopping changes live, including after a dropped Realtime
// connection.

const REALTIME_SOCKET = /\/realtime\/v1\/websocket/

/**
 * Proxies a context's Realtime websocket so the test can cut it. Chrome's
 * offline emulation (`context.setOffline`) does not close an already open
 * websocket, so a network drop is simulated here instead: `goOffline` closes
 * the open connection and refuses reconnects until `goOnline`. Sent frames
 * are recorded to check what the app tells the server.
 */
async function controlRealtimeSocket(context: BrowserContext) {
  let offline = false
  const openSockets = new Set<WebSocketRoute>()
  const sentFrames: string[] = []

  await context.routeWebSocket(REALTIME_SOCKET, (socket) => {
    if (offline) {
      void socket.close({ code: 1006, reason: 'e2e offline' })
      return
    }
    const server = socket.connectToServer()
    openSockets.add(socket)
    socket.onMessage((message) => {
      sentFrames.push(message.toString())
      server.send(message)
    })
    socket.onClose(() => openSockets.delete(socket))
  })

  return {
    sentFrames,
    goOffline() {
      offline = true
      for (const socket of openSockets) void socket.close({ code: 1006, reason: 'e2e offline' })
      openSockets.clear()
    },
    goOnline() {
      offline = false
    },
  }
}

/**
 * Signs in through the real login form. The "send code" request is answered
 * locally so no email is sent; the code comes from the Admin API instead,
 * and verifying it hits the real auth server.
 */
async function signIn(page: Page, user: TestUser) {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.goto(ROUTES.login)
  await page.getByLabel('Email address').fill(user.email)
  await page.getByRole('button', { name: 'Send code' }).click()

  await page.getByLabel('Code from the email').fill(await generateLoginCode(user.email))
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText(user.email)).toBeVisible()
}

/** Both lists render an item as a checkbox labelled with its text. */
function listItem(page: Page, label: string) {
  return page.getByRole('checkbox', { name: label, exact: true })
}

/** Remove buttons all share one label, so find the one in the item's row. */
async function removeListItem(page: Page, label: string) {
  await page
    .locator('.q-item')
    .filter({ has: listItem(page, label) })
    .getByRole('button', { name: 'Remove' })
    .click()
}

async function addTodo(page: Page, title: string) {
  await page.getByLabel('Add a to-do').fill(title)
  await page.keyboard.press('Enter')
}

async function addShoppingItem(page: Page, title: string, quantity = '') {
  await page.getByLabel('Item', { exact: true }).fill(title)
  await page.getByLabel('Quantity (optional)').fill(quantity)
  await page.keyboard.press('Enter')
}

/**
 * Signs both members in and opens the same list page on each. Navigation is
 * in-app like a user's: a full page load right after verifying can race the
 * session being persisted and land back on the login page.
 */
async function openListForBoth(pages: Page[], users: TestUser[], linkName: string, path: string) {
  for (const [index, page] of pages.entries()) {
    await signIn(page, users[index]!)
    await page.getByRole('link', { name: linkName }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByText('Nothing on the list yet.')).toBeVisible()
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

    await openListForBoth([pageA, pageB], [userA, userB], 'To-dos', ROUTES.todos)

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
      await pageA.getByRole('button', { name: 'Sign out' }).click()
      await expect(pageA).toHaveURL(new RegExp(`${ROUTES.login}$`))
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

    await openListForBoth([pageA, pageB], [userA, userB], 'Shopping', ROUTES.shopping)

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
})
