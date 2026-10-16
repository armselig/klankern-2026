# Commands and tests

Where the project sits, the commands, and what the tests need to run. Part of the rules for the code; [`README.md`](./README.md) lists the others.

## Layout

The Nuxt project is the git root, and its source directory is `app/` (Nuxt 4 convention). Run every `npm`/`npx` command from the root. Paths in the rule files are relative to the root, except that the source's own folders (`composables/`, `stores/`, `utils/`, `types/`, `components/`, `pages/`, `layouts/`, `assets/`) are usually named without their leading `app/`.

## Commands

```bash
npm run dev            # nuxt dev on :3000
npm run build          # production build for a Node server (not what is deployed)
npm run generate       # static production build; this is what Netlify deploys
npm run lint           # eslint; lint:fix to autofix
npm run lint:md        # markdownlint-cli2 over the Markdown files
npm run format:check   # prettier; format to write
npm run typecheck      # nuxt typecheck (vue-tsc), then the tests (typecheck:tests)
npm test               # nuxt prepare + vitest run (unit + RLS suite)
npm run test:e2e       # Playwright, both projects
```

Single tests:

```bash
npx vitest run app/utils/list-state.spec.ts             # one file
npx vitest run app/utils/list-state.spec.ts -t "soft"   # by test name
npx playwright test tests/e2e/lists.e2e.ts --project dev
npx playwright test --project pwa
```

`npx vitest` directly needs `.nuxt/` to exist; `npm install` and `npm test` create it via `nuxt prepare`.

Node `>=24.21.0 <25` is enforced (`engine-strict`), and dependencies are pinned exactly (`save-exact`).

## What the tests need

- **The tests have a TypeScript project of their own**, `tests/tsconfig.json`, which also reads `playwright.config.ts`: Nuxt's projects cover `app/` and the server only, and neither Vitest nor Playwright checks types. It extends `.nuxt/tsconfig.app.json`, so it needs `.nuxt/`; `npm run typecheck` runs it after `nuxt typecheck`, which writes that folder.
- **`npm test` is not offline.** It includes the six specs in `tests/rls/` (`household`, `whiteboard`, `recipe`, `vacation`, `meal-plan` and `kids-isolation.spec.ts`, run in parallel), which run against the real Supabase Cloud project and needs `.env` with `SUPABASE_URL`, `SUPABASE_KEY` and `SUPABASE_SECRET_KEY` (see `.env.example`).
- **Git hooks**: pre-commit runs lint-staged (eslint --fix + prettier on staged files, and markdownlint-cli2 --fix before prettier on Markdown files); commit-msg runs commitlint (`@commitlint/config-conventional` with a scope required, `fix(vacations): …`, configured in `package.json`), because the commit messages decide the next version (see "Releases" in `rules/delivery.md`); pre-push runs `npm run typecheck` and `npm test`, so a push needs network and the secrets too. E2E is not in any hook.
- **CI** (`.github/workflows/ci.yml`) runs lint, the Markdown lint, format check, typecheck, `npm test` and `npm run test:e2e` on every push to `main` and `develop`, with the three Supabase values as repository secrets. Runs are queued one at a time for the whole repo, because they share the cloud project and its sign-in limit.
- **E2E** drives the installed Google Chrome (`channel: 'chrome'`, no Playwright browser download) against Supabase Cloud with disposable users. Two projects: `dev` (every spec except `pwa.e2e.ts`, against `nuxt dev` on :3000, reusing a running one) and `pwa` (`pwa.e2e.ts`, against a fresh static build served by `netlify serve --offline` on :3100, which applies `_redirects` but not the generated `_headers`).
- With the Netlify preset, Nitro's prerenderer would serve the pages that a local `nuxt generate` or `nuxt build` left in `.output/public` instead of rendering them, and the build would ship those old pages. The `nitro:init` hook in `nuxt.config.ts` prevents it by giving the prerenderer the build's own public directory; check it again after a Nuxt or Nitro upgrade. The test for it is in `pwa.e2e.ts` (the page's build id is the served build's), and it needs a leftover to mean anything: the `pwa` web server writes one, `.output/public/login/index.html`, before it builds. Playwright starts that server on every run, whichever project is selected, so an e2e run replaces a real login page in that folder.
- The `dev` project reuses a running `nuxt dev`. One that was started before the version in `package.json` changed keeps the old version in the menus and fails `app-version.e2e.ts`; stop and start it.
- E2E sign-ins through the login form are rate limited by Supabase: more than about 30 within 5 minutes makes sign-ins time out. So a test that only needs a signed-in member starts with `openSignedIn` (`tests/support/e2e-ui.ts`), which hands the browser a session; `signIn` and `enterLoginCode` are for the tests about signing in and joining, 9 form sign-ins in a run. Keep `--repeat-each` runs of those below the limit.
- **Never pin Playwright's clock ahead of the real time** (`page.clock.setFixedTime`) in a test that is signed in: the session's token expires an hour after the real time, and the app checks that against the browser's clock (`getClaims`), so the member is signed out. Pin a moment in the past, such as yesterday at the hour the test needs (`meal-plan.e2e.ts`). The device's time zone differs too: CI runs in UTC.
- **E2E runs with `reducedMotion: 'reduce'`** (`playwright.config.ts`), so a list's row is gone at once and axe measures no color halfway through a fade. A spec that checks motion turns it on with `test.use({ reducedMotion: 'no-preference' })`, waits for the animations to end before a scan (`untilFadesEnd` in `a11y.e2e.ts`), and takes a count during an animation once, not with a retrying `toHaveCount`, which passes as soon as the animation is over. Motion can also be turned on in the middle of a test with `page.emulateMedia({ reducedMotion: 'no-preference' })`, and a context made by hand needs `browser.newContext({ reducedMotion })`, which does not inherit the config's. An element with an empty box counts as hidden, so a fixed overlay (the celebration's layer) needs a size. The row helpers of `tests/support/e2e-ui.ts` skip what is inside `[inert]`: a leaving row is `inert` and keeps its test ids.
- Test file naming matters: Vitest picks up `*.spec.ts`, Playwright `*.e2e.ts`.
- A Vitest file that uses the secret key must start with `// @vitest-environment node`; supabase-js refuses a secret key when it detects happy-dom's `window`.
