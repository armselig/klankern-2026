import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { ROUTES } from '../../app/utils/routes'

// The footer shows the version that semantic-release writes into package.json
// with each release, so a deployed build can be matched to its entry in
// CHANGELOG.md. Checked on the login page, which needs no sign-in.

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string }

test('the footer shows the version from package.json', async ({ page }) => {
  await page.goto(ROUTES.login)
  await expect(page.getByRole('contentinfo')).toContainText(`Version ${version}`)
})
