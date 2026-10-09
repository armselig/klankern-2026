import { expect, type Page } from '@playwright/test'
import { ROUTES } from '../../app/utils/routes'
import { generateLoginCode, type TestUser } from './supabase-fixtures'

// UI steps shared by the e2e specs. They drive the app through its real
// forms, so a renamed label or button breaks the tests like it would a user.

/**
 * Answers the "send code" request locally, so no email is sent. The code
 * comes from the Admin API instead (see `enterLoginCode`), and verifying it
 * still hits the real auth server.
 */
export async function stubOtpRequest(page: Page) {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
}

/**
 * Fills the email step and the code step of a sign-in form. Shared by the
 * login page ("Verify") and the join page ("Join household"), which use the
 * same two-step OTP flow.
 */
export async function enterLoginCode(page: Page, email: string, submitLabel: string) {
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('Code from the email').fill(await generateLoginCode(email))
  await page.getByRole('button', { name: submitLabel }).click()
}

/** Signs in through the real login form and waits for the header to show the user. */
export async function signIn(page: Page, user: TestUser) {
  await stubOtpRequest(page)
  await page.goto(ROUTES.login)
  await enterLoginCode(page, user.email, 'Verify')
  await expect(page.getByText(user.email)).toBeVisible()
}

/** Signs out through the header and waits for the login page. */
export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(new RegExp(`${ROUTES.login}$`))
}

/** Both lists render an item as a checkbox labelled with its text. */
export function listItem(page: Page, label: string) {
  return page.getByRole('checkbox', { name: label, exact: true })
}

/** Remove buttons all share one label, so find the one in the item's row. */
export async function removeListItem(page: Page, label: string) {
  await page
    .locator('.q-item')
    .filter({ has: listItem(page, label) })
    .getByRole('button', { name: 'Remove' })
    .click()
}

export async function addTodo(page: Page, title: string) {
  await page.getByLabel('Add a to-do').fill(title)
  await page.keyboard.press('Enter')
}

export async function addShoppingItem(page: Page, title: string, quantity = '') {
  await page.getByLabel('Item', { exact: true }).fill(title)
  await page.getByLabel('Quantity (optional)').fill(quantity)
  await page.keyboard.press('Enter')
}

/**
 * Opens a list from the dashboard the way a user does. In-app on purpose: a
 * full page load right after verifying the code can race the session being
 * persisted and land back on the login page.
 */
export async function openList(page: Page, linkName: 'To-dos' | 'Shopping') {
  await page.getByRole('link', { name: linkName }).click()
  const path = linkName === 'To-dos' ? ROUTES.todos : ROUTES.shopping
  await expect(page).toHaveURL(new RegExp(`${path}$`))
}

/** The text both lists show when they have no items. */
export const EMPTY_LIST_TEXT = 'Nothing on the list yet.'
