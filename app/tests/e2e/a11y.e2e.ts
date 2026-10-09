import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ROUTES } from '../../app/utils/routes'
import { addShoppingItem, addTodo, listItem, openList, signIn, untilSaved } from '../support/e2e-ui'
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from '../support/supabase-fixtures'

// The WCAG rule for this project, checked on every run: axe scans each page
// in a realistic state (lists with items, the invite dialog open). Only
// serious and critical findings fail the test, so it guards against real
// barriers rather than style nits.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

/** Scans the page and records its blocking findings in a readable form.
 * Soft, so one run reports the findings of every page, not just the first. */
async function expectNoBlockingViolations(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The Nuxt DevTools button only exists in `nuxt dev`.
    .exclude('#nuxt-devtools-container')
    .analyze()
  const blocking = violations
    .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''))
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }))
  expect.soft(blocking, `accessibility violations on ${name}`).toEqual([])
}

test.describe('accessibility', () => {
  let user: TestUser
  let householdId: string

  test.beforeAll(async () => {
    user = await createTestUser('e2e-a11y')
    householdId = await createHousehold(user.client, `E2E a11y ${runId}`)
  })

  test.afterAll(async () => {
    await deleteTestData([householdId], [user])
  })

  test('signed-out pages have no serious accessibility violations', async ({ page }) => {
    await page.goto(ROUTES.login)
    await expect(page.getByText('Sign in to Klankern')).toBeVisible()
    await expectNoBlockingViolations(page, 'the login page')

    await page.goto(ROUTES.join('some-code'))
    await expect(page.getByText('Join your household', { exact: true })).toBeVisible()
    await expectNoBlockingViolations(page, 'the join page')
  })

  test('signed-in pages have no serious accessibility violations', async ({ page }) => {
    await signIn(page, user)
    await expect(page.getByText(`E2E a11y ${runId}`)).toBeVisible()
    await expect(page).toHaveTitle('Klankern')
    await expectNoBlockingViolations(page, 'the dashboard')

    await page.getByRole('button', { name: 'Invite a family member' }).click()
    await expect(page.getByLabel('Invite link')).toHaveValue(/.+/)
    await expectNoBlockingViolations(page, 'the invite dialog')
    await page.getByRole('button', { name: 'Close' }).click()

    await openList(page, 'To-dos')
    await expect(page).toHaveTitle('To-dos · Klankern')
    await expectNoBlockingViolations(page, 'the empty to-do list')
    await addTodo(page, 'Open item')
    await addTodo(page, 'Done item')
    await untilSaved(page, () => listItem(page, 'Done item').click())
    await expectNoBlockingViolations(page, 'the to-do list')

    await page.getByRole('link', { name: 'Klankern' }).click()
    await openList(page, 'Shopping')
    await addShoppingItem(page, 'Apples', '6')
    await addShoppingItem(page, 'Bread')
    await untilSaved(page, () => listItem(page, 'Bread').click())
    await expectNoBlockingViolations(page, 'the shopping list')
  })
})
