import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type Page } from "@playwright/test";
import { ROUTES } from "../../app/utils/routes";
import { TEST_IDS } from "../../app/utils/test-ids";

// Milestone 7: replaces the Lighthouse PWA audit (Lighthouse dropped its PWA
// category in v12) with the checks Chrome itself uses, run against a
// production build. The browser events behind installing and updating are
// simulated; the real install dialog stays a manual check.

/** Waits until the service worker is active and, after a reload, controls
 * the page -- registerType 'prompt' doesn't claim already open pages. */
async function loadControlledPage(page: Page, origin?: string) {
  await page.goto(origin ? new URL(ROUTES.login, origin).href : ROUTES.login);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
}

/**
 * Serves the production build through a local proxy that can pretend a new
 * version was deployed: from then on, sw.js has one more line, and a
 * byte-different sw.js is all the browser looks for. Playwright's request
 * routing doesn't see the browser's own service-worker update check, so it
 * can't do this.
 */
async function startDeployProxy(upstream: string) {
  let newVersion = false;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", upstream);
    const upstreamResponse = await fetch(url, {
      headers: { accept: request.headers.accept ?? "*/*" },
    });
    let body = Buffer.from(await upstreamResponse.arrayBuffer());
    if (newVersion && url.pathname === "/sw.js") {
      body = Buffer.concat([body, Buffer.from("\n// e2e: new version\n")]);
    }
    // fetch() already decoded the body, so the encoding and length headers
    // no longer apply.
    const headers = Object.fromEntries(upstreamResponse.headers);
    delete headers["content-encoding"];
    delete headers["content-length"];
    response.writeHead(upstreamResponse.status, headers).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    // 127.0.0.1 counts as a secure context, like localhost.
    url: `http://127.0.0.1:${port}`,
    deployNewVersion() {
      newVersion = true;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test.describe("PWA", () => {
  // Every prerendered page carries the id of the build that rendered it, and
  // the build's own id is in /_nuxt/builds/latest.json. They differ when the
  // build took its pages from somewhere else, as it did from a leftover
  // `.output/public` until the `nitro:init` hook in nuxt.config.ts. The web
  // server command in playwright.config.ts plants such a leftover for the
  // login page before every build, so this fails if the hook stops working.
  // The other tests only notice a real leftover once a script's hashed name
  // has changed.
  test("the served page was rendered by the build that is served", async ({
    page,
    request,
  }) => {
    // The first load in a fresh context has no service worker yet, so this is
    // the server's HTML. An inline script sets the id, so it is there even
    // when the page's script files are missing and the app never mounts.
    await page.goto(ROUTES.login);
    const pageBuildId = await page.evaluate(
      () =>
        (window as { __NUXT__?: { config?: { app?: { buildId?: string } } } })
          .__NUXT__?.config?.app?.buildId,
    );

    const latestBuild = await request.get("/_nuxt/builds/latest.json");
    const { id: servedBuildId } = (await latestBuild.json()) as { id: string };

    expect(servedBuildId).toBeTruthy();
    expect(pageBuildId).toBe(servedBuildId);
  });

  test("Chrome reports the app as installable, with the expected manifest", async ({
    baseURL,
  }) => {
    // Chrome never reports an app as installable in an incognito-like
    // context, which Playwright's default contexts are -- so this test uses
    // a throwaway persistent profile.
    const profileDir = await mkdtemp(join(tmpdir(), "klankern-pwa-"));
    const context = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      baseURL,
    });
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      await loadControlledPage(page);
      const cdp = await context.newCDPSession(page);

      // Polled: the manifest link is added once the app has mounted, which can
      // be a moment after the service worker controls the page.
      await expect
        .poll(
          async () =>
            (await cdp.send("Page.getInstallabilityErrors"))
              .installabilityErrors,
        )
        .toEqual([]);

      const { errors, data } = await cdp.send("Page.getAppManifest");
      expect(errors).toEqual([]);
      const manifest = JSON.parse(data ?? "{}");
      expect(manifest).toMatchObject({
        short_name: "Klankern",
        display: "standalone",
      });
      expect(manifest.icons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ sizes: "192x192" }),
          expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
        ]),
      );
    } finally {
      await context.close();
      await rm(profileDir, { recursive: true, force: true });
    }
  });

  test("shows the offline page when a page load fails, and the app again once online", async ({
    page,
    context,
  }) => {
    await loadControlledPage(page);
    await expect(page.getByTestId(TEST_IDS.login.heading)).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId(TEST_IDS.offlinePage.heading)).toBeVisible();

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByTestId(TEST_IDS.login.heading)).toBeVisible();
  });

  test('a new version shows the update notice, and "Reload" switches to it', async ({
    page,
    baseURL,
  }) => {
    const proxy = await startDeployProxy(baseURL!);
    try {
      await loadControlledPage(page, proxy.url);

      proxy.deployNewVersion();
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      });

      const notice = page.getByTestId(TEST_IDS.pwa.updateNotice);

      await expect(notice).toBeVisible();

      // Marks this page load, to tell whether "Reload" really reloaded.
      await page.evaluate(
        () => ((window as { beforeUpdate?: boolean }).beforeUpdate = true),
      );
      await page.getByTestId(TEST_IDS.pwa.updateReload).click();

      // An evaluate that lands in the middle of the reload itself throws
      // ("execution context was destroyed"): not reloaded yet, so poll again.
      await expect
        .poll(() =>
          page
            .evaluate(
              () =>
                (window as { beforeUpdate?: boolean }).beforeUpdate ?? false,
            )
            .catch(() => true),
        )
        .toBe(false);
      await expect(page.getByTestId(TEST_IDS.login.heading)).toBeVisible();

      await expect(notice).toHaveCount(0);
      const waiting = await page.evaluate(
        async () =>
          !!(await navigator.serviceWorker.getRegistration())?.waiting,
      );
      expect(waiting).toBe(false);
    } finally {
      await proxy.close();
    }
  });

  test('"Install app" appears once the browser offers installing, and opens its prompt', async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await expect(page.getByTestId(TEST_IDS.login.heading)).toBeVisible();

    const installButton = page.getByTestId(TEST_IDS.layout.installButton);

    await expect(installButton).toHaveCount(0);

    // Chrome only fires beforeinstallprompt after its engagement heuristic,
    // so the test fires one itself, with a prompt() that records the call.
    await page.evaluate(() => {
      const event = Object.assign(
        new Event("beforeinstallprompt", { cancelable: true }),
        {
          prompt: () =>
            ((window as { installPrompted?: boolean }).installPrompted = true),
          userChoice: Promise.resolve({
            outcome: "dismissed",
            platform: "web",
          }),
        },
      );
      window.dispatchEvent(event);
    });

    await installButton.click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as { installPrompted?: boolean }).installPrompted,
        ),
      )
      .toBe(true);
    await expect(installButton).toHaveCount(0);
  });
});
