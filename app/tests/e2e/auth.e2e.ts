import { expect, test } from '@playwright/test'
import { ROUTES } from '../../app/utils/routes'
import { signIn, signOut, stubOtpRequest } from '../support/e2e-ui'
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from '../support/supabase-fixtures'

// Milestone 3: the auth guard (redirectOptions in nuxt.config.ts) and the
// login form, including its error path.

const LOGIN_URL = new RegExp(`${ROUTES.login}(\\?.*)?$`)
const PROTECTED_ROUTES = [ROUTES.home, ROUTES.todos, ROUTES.shopping, ROUTES.whiteboard]

test.describe('auth', () => {
  let user: TestUser
  let householdId: string

  test.beforeAll(async () => {
    user = await createTestUser('e2e-auth')
    householdId = await createHousehold(user.client, `E2E auth ${runId}`)
  })

  test.afterAll(async () => {
    await deleteTestData([householdId], [user])
  })

  test('signed out, protected pages redirect to the login page; join links do not', async ({
    page,
  }) => {
    for (const path of PROTECTED_ROUTES) {
      await test.step(`${path} redirects`, async () => {
        await page.goto(path)
        await expect(page).toHaveURL(LOGIN_URL)
        await expect(page.getByText('Sign in to Klankern')).toBeVisible()
      })
    }

    await test.step('a join link stays on the join page', async () => {
      await page.goto(ROUTES.join('some-code'))
      await expect(page.getByText('Join your household', { exact: true })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${ROUTES.join('some-code')}$`))
    })
  })

  test('the session survives a reload, and sign-out locks the pages again', async ({ page }) => {
    await signIn(page, user)

    await test.step('a full reload keeps the user signed in', async () => {
      await page.reload()
      await expect(page.getByText(user.email)).toBeVisible()
      await expect(page.getByText(`E2E auth ${runId}`)).toBeVisible()
    })

    await test.step('after sign-out, protected pages redirect again', async () => {
      await signOut(page)
      for (const path of PROTECTED_ROUTES) {
        await page.goto(path)
        await expect(page).toHaveURL(LOGIN_URL)
      }
    })
  })

  test('a wrong code shows an error and keeps the code step; the email can be changed', async ({
    page,
  }) => {
    await stubOtpRequest(page)
    await page.goto(ROUTES.login)
    await page.getByLabel('Email address').fill(user.email)
    await page.getByRole('button', { name: 'Send code' }).click()
    await expect(page.getByText(`We sent a login code to ${user.email}.`)).toBeVisible()

    await test.step('a wrong code is rejected by the auth server', async () => {
      await page.getByLabel('Code from the email').fill('00000000')
      await page.getByRole('button', { name: 'Verify' }).click()
      await expect(page.getByText(/expired or is invalid/i)).toBeVisible()
      await expect(page.getByLabel('Code from the email')).toBeVisible()
      await expect(page).toHaveURL(LOGIN_URL)
    })

    await test.step('"Use a different email" returns to the email step', async () => {
      await page.getByRole('button', { name: 'Use a different email' }).click()
      await expect(page.getByLabel('Email address')).toHaveValue(user.email)
      await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible()
    })
  })
})
