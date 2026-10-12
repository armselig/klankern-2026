# PWA and deployment

The history of the installable app and its deployment to Netlify, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Milestone 7: PWA installability (built 2026-10-09)

Checking a production build (`nuxt build`) showed the milestone-1 PWA config was broken in ways `nuxt dev` never revealed (the service worker isn't generated in dev):

- **No `<link rel="manifest">`** — `@vite-pwa/nuxt` only adds it via `<NuxtPwaManifest />`, now in `app.vue`. Without it the app wasn't installable at all.
- **`navigateFallback: '/offline.html'`** registers a route that answers _every_ page load with the fallback page, online or not. Replaced by a `NetworkOnly` runtime rule for navigations with `precacheFallback: { fallbackURL: 'offline.html' }`, and `navigateFallback: null`.
- **Nearly empty precache**: `@vite-pwa/nuxt` appends its own glob patterns to an empty list, which drops Workbox's defaults. `globPatterns` is now explicit (`offline.html`, icons, favicon).
- **`offline.html` precached as `offline`**: the module's default `manifestTransforms` strips `.html` (pretty URLs), but this server answers `/offline` with the app's own page. Overridden with `manifestTransforms: []`.
- **Build-info JSON in the precache**: the module also appends `_nuxt/builds/**/*.json` to `globPatterns`; those files aren't needed offline and would be cached without a revision. The `integration.beforeBuildServiceWorker` hook removes that pattern right before the service worker is built. Until 2026-10-10 this was `globIgnores: ['_nuxt/builds/**']`, which left a pattern that matched nothing, so Workbox warned on every production build. The precache list is the same either way.

Added:

- `registerType: 'prompt'` (was `autoUpdate` + `skipWaiting`, i.e. silent reloads) with a persistent Quasar notice "A new version of Klankern is available." / Reload / Later (`composables/use-pwa-update-notice.ts`, called in the layout).
- "Install app" header button, shown when `$pwa.showInstallPrompt && !$pwa.isPWAInstalled`. Use the global `$pwa` in templates: Vue reserves `$`-prefixed setup bindings.
- `theme-color` meta and `apple-touch-icon` link (`app.head` in `nuxt.config.ts`).

**Verification**: Lighthouse dropped its PWA category in v12, so the planned Lighthouse audit is replaced by the Playwright `pwa` project (`tests/e2e/pwa.e2e.ts`). It runs against a fresh production build served on port 3100 (`E2E_PRODUCTION_PORT`), built on every `npm run test:e2e`. It covers:

- Chrome's own installability check (`Page.getInstallabilityErrors` is empty) and the manifest contents.
- Offline page loads show `offline.html`; back online, the app loads again.

Chrome never reports installability in an incognito-like context, which Playwright's default contexts are, so the installability test uses `chromium.launchPersistentContext` with a throwaway profile. `context.setOffline` works for HTTP page loads (unlike open websockets, see milestone 5).

**Manual check (2026-10-09)**, on a production build (`npx nuxi build && PORT=3100 node .output/server/index.mjs`, so it doesn't clash with `nuxt dev` on :3000):

- The "Install app" button appears in Chrome and installs the app. It only appears after Chrome's engagement heuristic (roughly one click plus ~30 s on the page). It never appears in `nuxt dev` (no service worker) or in Firefox (desktop Firefox doesn't support `beforeinstallprompt`).
- The update notice could not be verified by hand. It is now covered by the `pwa` project instead (see "E2E gap review" in [`infra/testing.md`](testing.md)), so this is resolved. Since 2026-10-11 it has also been checked by the user on the deployed site (see "Milestone 8").
- Installing on Android needs HTTPS on a real host, so it waits for milestone 8 (checked there on 2026-10-10, see "Milestone 8").

## Milestone 8: Netlify deploy (repo side built 2026-10-10, done 2026-10-11)

Production hosting is **Netlify, as static files** (user decision, deviating from the plan's Podman + Caddy setup, which is deferred). The app is a client-only SPA with no `server/` directory, so `nuxt generate` output is all it needs: no Netlify Function, no container.

- **`netlify.toml`** (git root): `base = "app"`, `npm run generate`, publish `dist`, `HUSKY=0` (the `prepare` script would otherwise try to install git hooks) and an exact `NODE_VERSION` (`.nvmrc` holds an alias, and `engine-strict` rejects a 24.x below the range in `package.json`; raise both together). Since 2026-10-12 there is no `base`: the Nuxt project is the git root, so `public/_redirects`, `.env` and `.netlify/`, named with a leading `app/` below, are there too (see "The move to the git root" in [`infra/project-layout.md`](project-layout.md)).
- **Preset**: on Netlify (`NETLIFY=true`) Nitro picks `netlify-static` by itself and writes to `dist`, adding `_headers` (long-lived caching for `/_nuxt/*`). Elsewhere `nuxt generate` uses the `static` preset, writes to `.output/public` and makes `dist` a link to it. Apart from `_headers`, `_redirects` handling and the build id the two outputs are identical (compared with `diff -r`), so the preset is not pinned.
- **Fallback for client-side routes** (`/join/<code>` is not prerendered): `app/public/_redirects` with `/* /200.html 200`. It has to be that file, not a rule in `netlify.toml`: without a catch-all in `_redirects`, Nitro's Netlify preset writes `/* /404.html 404` there (the same app shell, but with status 404), and `_redirects` takes precedence over `netlify.toml`. The rule is not forced, so real files (`sw.js`, `offline.html`) are served as they are.
- **The `pwa` e2e project now tests the deployed build, except Netlify's response headers.** Its web server is `netlify serve --offline` (`netlify-cli`, a devDependency; chosen by the user over a small static test server and `sirv-cli`): it runs the build from `netlify.toml` with the Netlify preset and serves `dist` with the real `_redirects`. `--offline` means no login and no linked site; it also works from a clean checkout with `CI=true` (checked locally with `dist` and `.netlify` removed). `nuxt preview` was tried first and can't do it: it starts the Node server command from the config.
  - `netlify serve` loads `app/.env` into the build's environment, including the secret key and DB password. Only the public runtime config is baked into the bundle; checked that neither value is in `dist`.
  - It creates `app/.netlify/` (gitignored) and leaves `dist` as a real directory; a later plain `nuxt generate` does not turn it back into a link, so `dist` can be stale locally. `netlify serve` always rebuilds.
  - It does **not** apply the generated `_headers`: every file comes back with `cache-control: public, max-age=0`, including `/_nuxt/*`. Caching headers can only be checked on the deployed site.
  - `netlify-cli` adds 751 packages to the lockfile (no existing package changed version), some with install scripts (`unix-dgram` compiles with node-gyp, `sharp`). They are installed by `npm ci` in CI, where the job holds the secret key, and by every Netlify build, which needs devDependencies anyway (`@vite-pwa/nuxt` is one).
  - `netlify-cli` raised `npm audit` from 15 to 26 findings (11 more "high", all in its own dependency tree, development only).
- **Test race fixed**: "Chrome reports the app as installable" failed against the static server with `no-manifest`. The manifest link is added when the app mounts, about 300 ms after the service worker controls the page; the test asked Chrome immediately. It now polls. Not an app bug.
- **Deploys**: Netlify's Git integration builds every push to `main`. It builds independently of CI, so a `main` with failing tests still deploys (accepted). Deploy previews and branch deploys stay **off**: every one of them would use the one production Supabase project.
- **Environment on Netlify**: only `SUPABASE_URL` and `SUPABASE_KEY`. Never the secret key or the DB password.

**First deploy (2026-10-10).** CI ran the new `pwa` web server on `develop` and passed (the job took about 6 minutes instead of 5, presumably the larger `npm ci`). The Netlify site was created by the user and `main` fast-forwarded to `develop`.

- The site was first created while `main` had no `netlify.toml` and no `_redirects`. That build served deep links with status 404 (Nitro's own catch-all) and deployed the older code. Merge first, then create a site.
- Checked on the deployed URL with `curl`, after the deploy of the merged `main`:
  - `/join/<code>` answers 200 with the app shell; so does any other unmatched path.
  - `sw.js`, the HTML pages and `manifest.webmanifest` have `cache-control: public,max-age=0,must-revalidate`; hashed `/_nuxt/*.js` files are `immutable`.
  - The page carries the right Supabase URL and a publishable key; the precache list is the expected one.
- **Manifest content type**: Netlify served `manifest.webmanifest` as `application/octet-stream`. A `[[headers]]` rule in `netlify.toml` now sets `application/manifest+json` (verified on the deployed URL).
- **`/_nuxt/builds/latest.json` is served `max-age=31536000, immutable`**: of the overlapping rules in the generated `_headers`, the year-long `/_nuxt/*` one applies, not the `max-age=1` one for `/_nuxt/builds/*`. Left as it is: Nuxt requests the file with a timestamp query (`check-outdated-build.client.js`), so a cached copy is never reused.
- **`/login`, `/todos`, `/shopping` and `/confirm` answer 301 to the same path with a trailing slash**, because `nuxt generate` prerenders them as `<route>/index.html`. Works; left alone.
- **Netlify added an HTML comment and a script (`/.netlify/scripts/hud`) to every page.** Not from the build: Netlify's edge servers inject them. The script was the "Powered by Netlify" badge, which is on by default for new projects on the Free plan. Turned off by the user under **Project configuration > General > Powered by Netlify badge** (per project, no redeploy needed); checked with `curl` that no page references the script any more. The comment ("This site is hosted on Netlify. …", with a link to Netlify) is still at the start of every page's `<head>`. No setting for it was found; it is inert and **accepted** (user decision).

**Checked by the user on the deployed URL (2026-10-10):**

- In a browser: OTP login; a `/join/<code>` link opened directly; "Install app"; the offline page; installing on Android (carried over from milestone 7).
- Settings: deploy previews and branch deploys are off in Netlify; the Supabase Auth "Site URL" is the deployed URL; the install step of the Netlify deploy log was looked at.

**Checked by the user on the deployed site (2026-10-11):** the update notice. It was the last open item, so milestone 8 is done.

## The move to the git root on `main`, and a broken deploy (2026-10-12)

`main` got the move of the Nuxt project to the git root (see "The move to the git root" in [`infra/project-layout.md`](project-layout.md)). CI had passed on `develop` and passed on `main`, the release workflow released nothing (eight commits, none of them a `feat` or a `fix`), and Netlify's own build settings named no base directory. Netlify built and published, and the published site was broken: every page showed Nuxt's error page with "500 Internal Server Error" and "Cannot read properties of undefined (reading '\_s')". It was live for about 50 minutes.

### How it showed and how it was found

- **The first check after the deploy missed it.** It was done with `curl`: the status codes, the build's id and time, the version in the page's config, the fallback for `/join/<code>`, the headers. All of it was right. The app is a single-page app, and every address answers 200 with the shell, whether the app starts or not. The user found the error by opening the site.
- **Reproduced** signed out, in headless Chrome through the project's own Playwright (`channel: 'chrome'`), on `/`, `/login` and `/join/<code>`.
- **The message is Pinia's**: a store was used while no Pinia was active. The deployed bundle held two copies of Pinia. The entry chunk created one and installed it; the chunk with the stores carried a second one, whose "active instance" was never set. There was one Vue runtime, since Vite deduplicates Vue. In a clean local build the same chunk creates Pinia and looks it up.
- **The cause is a `node_modules` folder inside `app/`.** The five stores import `defineStore` from `"pinia"` by name, and such an import resolves from the nearest `node_modules`. With one beside the source, that is another copy than the root's, which `@pinia/nuxt` installs. Tried locally: with a copy of `node_modules/pinia` at `app/node_modules/pinia`, `npm run generate` splits the bundle the same way, and the served build shows the same message.
- **Where the folder came from on Netlify is inferred, not seen**; the build log was not read. Until this deploy the base directory was `app`, so Netlify's build cache held `app/node_modules`, and the first build in the new layout got it back, into what is now the source folder. A build with the cache cleared was right, which supports it.
- **No check could catch it.** CI and a fresh checkout have no such leftover, and the `pwa` project builds from a clean tree. It is the trap that "Traps" in [`infra/project-layout.md`](project-layout.md) names for a checkout that pulls the move, met by Netlify's cache.

### How it was repaired

All of it through Netlify's API, each change with the user's go-ahead.

1. The deploy before it, release 1.5.0, was published again, and the site was back. Publishing an older deploy this way did not lock auto-publishing.
2. Auto-publishing was locked, and `main` was built with the cache cleared. A locked site builds without publishing, so the build could be looked at on its own deploy address first: one Pinia, in a chunk with the same hash as in a clean local build, and `/`, `/login`, `/join/<code>` and `/todos` rendered without errors in headless Chrome.
3. That build was published and auto-publishing unlocked. Production was then checked the same way.

### Left undone

- **Nothing in the repository prevents it.** A `node_modules` folder under `app/` would split Pinia again, on Netlify or in a developer's checkout. Proposed and not tried: `resolve.dedupe` for `pinia` in the Vite config. The user decided on the record alone (2026-10-12).
- Not checked after the repair: signing in on the deployed site, and the update notice in an installed app.
