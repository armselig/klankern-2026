import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { ROUTES } from '../../app/utils/routes'
import {
  addShoppingItem,
  addTodo,
  dragOnWhiteboard,
  expectStrokeCount,
  listItem,
  memberAvatar,
  openList,
  openWhiteboard,
  signIn,
  untilSaved,
} from '../support/e2e-ui'
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

/**
 * Waits until a hovered or keyboard-focused control shows its highlight in
 * full. Quasar fades the highlight in (a veil over the control), and a scan
 * in the middle of that would measure a state nobody sees for long.
 */
async function untilHighlightShown(control: Locator) {
  const veil = control.locator('.q-focus-helper')
  await expect.poll(() => veil.evaluate((el) => getComputedStyle(el).opacity)).not.toBe('0')
  await control.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  )
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
    // The members arrive after the household; the scan should see them.
    await expect(memberAvatar(page, user.email)).toBeVisible()
    await expectNoBlockingViolations(page, 'the dashboard')

    // White text on the primary color is close to the contrast limit, and a
    // highlight that lightens the background takes it below (see
    // assets/css/hover-contrast.css). Checked for hover and for keyboard
    // focus, which is marked more strongly than hover.
    await test.step('highlighted controls on the primary color keep their contrast', async () => {
      const todosLink = page.getByRole('link', { name: 'To-dos' })
      await todosLink.hover()
      await untilHighlightShown(todosLink)
      await expectNoBlockingViolations(page, 'the dashboard with a filled button hovered')

      // Tab from "To-dos" moves the keyboard focus to "Shopping".
      await todosLink.focus()
      await page.keyboard.press('Tab')
      const shoppingLink = page.getByRole('link', { name: 'Shopping' })
      await expect(shoppingLink).toBeFocused()
      await untilHighlightShown(shoppingLink)
      await expectNoBlockingViolations(page, 'the dashboard with a filled button focused')

      // axe can't judge anything in the header: the header's shadow layer
      // lies over it, so axe reports the background as undetermined. A
      // button there has the same text and the same highlight as a filled
      // one, so the check is that its highlight is the dark one as well.
      const signOutButton = page.getByRole('button', { name: 'Sign out' })
      await signOutButton.hover()
      await untilHighlightShown(signOutButton)
      await expect
        .soft(signOutButton.locator('.q-focus-helper'), 'the highlight of a header button')
        .toHaveCSS('background-color', 'rgb(0, 0, 0)')
    })

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

    await page.getByRole('link', { name: 'Klankern' }).click()
    await openWhiteboard(page)
    await expect(page).toHaveTitle('Whiteboard · Klankern')
    await expectNoBlockingViolations(page, 'the empty whiteboard')
    await dragOnWhiteboard(page, [
      [0.2, 0.2],
      [0.6, 0.6],
    ])
    await expectStrokeCount(page, 1)
    await page.getByRole('radio', { name: 'Eraser' }).click()
    await expectNoBlockingViolations(page, 'the whiteboard with the eraser selected')
  })
})
