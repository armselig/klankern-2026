import { defineConfig } from "@playwright/test";
import { ROUTES } from "./app/utils/routes";

const devURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const productionPort = process.env.E2E_PRODUCTION_PORT ?? "3100";
const productionURL = `http://localhost:${productionPort}`;
// Where a local `nuxt generate` or `nuxt build` leaves the login page.
const leftoverPageDir = `.output/public${ROUTES.login}`;

/**
 * End-to-end tests drive the real app in the installed Google Chrome (no
 * Playwright browser download) against Supabase Cloud. `*.e2e.ts` keeps
 * these files out of Vitest's `*.spec.ts` glob.
 *
 * Two projects: `dev` runs every other spec against `nuxt dev`; `pwa` needs
 * a production build, because the service worker is not generated in dev. It
 * runs against the static output of `nuxt generate`, which is what gets
 * deployed.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: {
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "dev",
      testIgnore: "**/pwa.e2e.ts",
      // The UI is built mobile-first; an iPhone SE screen is the reference.
      use: { baseURL: devURL, viewport: { width: 375, height: 667 } },
    },
    {
      name: "pwa",
      testMatch: "**/pwa.e2e.ts",
      use: { baseURL: productionURL },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: devURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Always a fresh build, so the test checks the current service worker.
      // `netlify serve` runs the build from netlify.toml and serves the result
      // with the rules in public/_redirects, as the deployed site does.
      // `--offline` keeps it from contacting Netlify: no login, no linked site.
      //
      // A leftover page is planted first. The Netlify preset builds into
      // `dist` and never empties `.output`, and Nitro's prerenderer took the
      // pages it found in `.output/public` instead of rendering them, until
      // the `nitro:init` hook in nuxt.config.ts. With the leftover in place on
      // every run, pwa.e2e.ts fails if that ever comes back.
      command: `mkdir -p ${leftoverPageDir} && echo "A leftover page" > ${leftoverPageDir}/index.html && netlify serve --offline --port ${productionPort}`,
      url: productionURL,
      env: { BROWSER: "none" },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
