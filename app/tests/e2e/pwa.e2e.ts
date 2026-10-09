import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test, type Page } from '@playwright/test'
import { ROUTES } from '../../app/utils/routes'

// Milestone 7: replaces the Lighthouse PWA audit (Lighthouse dropped its PWA
// category in v12) with the checks Chrome itself uses, run against a
// production build. Installing and the update notice need real browser
// events and stay a manual check.

/** Waits until the service worker is active and, after a reload, controls
 * the page -- registerType 'prompt' doesn't claim already open pages. */
async function loadControlledPage(page: Page) {
  await page.goto(ROUTES.login)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test.describe('PWA', () => {
  test('Chrome reports the app as installable, with the expected manifest', async ({ baseURL }) => {
    // Chrome never reports an app as installable in an incognito-like
    // context, which Playwright's default contexts are -- so this test uses
    // a throwaway persistent profile.
    const profileDir = await mkdtemp(join(tmpdir(), 'klankern-pwa-'))
    const context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome',
      baseURL,
    })
    try {
      const page = context.pages()[0] ?? (await context.newPage())
      await loadControlledPage(page)
      const cdp = await context.newCDPSession(page)

      const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
      expect(installabilityErrors).toEqual([])

      const { errors, data } = await cdp.send('Page.getAppManifest')
      expect(errors).toEqual([])
      const manifest = JSON.parse(data ?? '{}')
      expect(manifest).toMatchObject({ short_name: 'Klankern', display: 'standalone' })
      expect(manifest.icons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sizes: '192x192' }),
          expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
        ]),
      )
    } finally {
      await context.close()
      await rm(profileDir, { recursive: true, force: true })
    }
  })

  test('shows the offline page when a page load fails, and the app again once online', async ({
    page,
    context,
  }) => {
    await loadControlledPage(page)
    await expect(page.getByText('Sign in to Klankern')).toBeVisible()

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible()

    await context.setOffline(false)
    await page.reload()
    await expect(page.getByText('Sign in to Klankern')).toBeVisible()
  })
})
