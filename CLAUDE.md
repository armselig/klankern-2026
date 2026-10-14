# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Klankern is a family-organizer PWA: shared to-do and shopping lists, a shared whiteboard, shared recipes and a vacation planner per household, synced live. Nuxt 4 SPA (`ssr: false`) + Quasar (`nuxt-quasar-ui`) + Pinia + `@vite-pwa/nuxt`, backed by Supabase Cloud (Postgres, Auth via email OTP, Realtime) through `@nuxtjs/supabase`.

- `docs/plan.md` is the original design and milestone list.
- `docs/progress.md` is the current state: what is built, the decisions that deviate from the plan, and the next steps. Read it before larger work.
- The history of each feature, of the app's look and of the tooling (decisions, bugs already found, what was checked by hand) is in topic files under `docs/`. `docs/CLAUDE.md` lists them and holds the rules for writing documentation. When a milestone or notable fix lands, update its topic file and `docs/progress.md`.

## Layout

The Nuxt project is the git root, and its source directory is `app/` (Nuxt 4 convention). Run every `npm`/`npx` command from the root. Paths below are relative to the root, except that the source's own folders (`composables/`, `stores/`, `utils/`, `types/`, `components/`, `pages/`, `layouts/`, `assets/`) are usually named without their leading `app/`.

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

### What the tests need

- **The tests have a TypeScript project of their own**, `tests/tsconfig.json`, which also reads `playwright.config.ts`: Nuxt's projects cover `app/` and the server only, and neither Vitest nor Playwright checks types. It extends `.nuxt/tsconfig.app.json`, so it needs `.nuxt/`; `npm run typecheck` runs it after `nuxt typecheck`, which writes that folder.
- **`npm test` is not offline.** It includes `tests/rls/household-isolation.spec.ts`, which runs against the real Supabase Cloud project and needs `.env` with `SUPABASE_URL`, `SUPABASE_KEY` and `SUPABASE_SECRET_KEY` (see `.env.example`).
- **Git hooks**: pre-commit runs lint-staged (eslint --fix + prettier on staged files, and markdownlint-cli2 --fix before prettier on Markdown files); commit-msg runs commitlint (`@commitlint/config-conventional`, configured in `package.json`), because the commit messages decide the next version (see "Releases"); pre-push runs `npm run typecheck` and `npm test`, so a push needs network and the secrets too. E2E is not in any hook.
- **CI** (`.github/workflows/ci.yml`) runs lint, the Markdown lint, format check, typecheck, `npm test` and `npm run test:e2e` on every push to `main` and `develop`, with the three Supabase values as repository secrets. Runs are queued one at a time for the whole repo, because they share the cloud project and its sign-in limit.
- **E2E** drives the installed Google Chrome (`channel: 'chrome'`, no Playwright browser download) against Supabase Cloud with disposable users. Two projects: `dev` (every spec except `pwa.e2e.ts`, against `nuxt dev` on :3000, reusing a running one) and `pwa` (`pwa.e2e.ts`, against a fresh static build served by `netlify serve --offline` on :3100, which applies `_redirects` but not the generated `_headers`).
- With the Netlify preset, Nitro's prerenderer would serve the pages that a local `nuxt generate` or `nuxt build` left in `.output/public` instead of rendering them, and the build would ship those old pages. The `nitro:init` hook in `nuxt.config.ts` prevents it by giving the prerenderer the build's own public directory; check it again after a Nuxt or Nitro upgrade. The test for it is in `pwa.e2e.ts` (the page's build id is the served build's), and it needs a leftover to mean anything: the `pwa` web server writes one, `.output/public/login/index.html`, before it builds. Playwright starts that server on every run, whichever project is selected, so an e2e run replaces a real login page in that folder.
- The `dev` project reuses a running `nuxt dev`. One that was started before the version in `package.json` changed keeps the old version in the footer and fails `app-version.e2e.ts`; stop and start it.
- E2E sign-ins through the login form are rate limited by Supabase: more than about 30 within 5 minutes makes sign-ins time out. So a test that only needs a signed-in member starts with `openSignedIn` (`tests/support/e2e-ui.ts`), which hands the browser a session; `signIn` and `enterLoginCode` are for the tests about signing in and joining, 9 form sign-ins in a run. Keep `--repeat-each` runs of those below the limit.
- Test file naming matters: Vitest picks up `*.spec.ts`, Playwright `*.e2e.ts`.
- A Vitest file that uses the secret key must start with `// @vitest-environment node`; supabase-js refuses a secret key when it detects happy-dom's `window`.

## Architecture

### Layers

Each feature is split the same way, and new features should follow it:

1. **`composables/*-actions.ts`**: all Supabase calls, as plain functions that take a `SupabaseClient` as a parameter. No Nuxt imports, so they are unit tested with a fake client.
2. **`stores/*.ts`** (Pinia options stores): thin. They call `useSupabaseClient()`/`useSupabaseUser()`, delegate to the actions, and hold state.
3. **`utils/*.ts`**: pure reducers and helpers for state transitions that need testing on their own.
4. **Components and pages**: rendering only.

A composable with logic worth testing is split in two: a plain function in one file and a thin `use-*.ts` wrapper that supplies the Nuxt runtime (`household-realtime.ts` ← `use-household-realtime.ts`).

### Shared list logic

To-dos and shopping share one implementation of the hard part. `utils/list-state.ts` is generic over `ListItem` (`types/list.ts`: `id`, `list_id`, `position`, `deleted_at`) and holds the rules for optimistic adds, dedup, soft delete, Realtime events and resync. Only the actions, the store, the components and list-specific ordering (`utils/shopping-state.ts`: checked items sink to the bottom) exist per list. `stores/todos.ts` and `stores/shopping.ts` are deliberately parallel; a fix in one usually belongs in the other.

Whiteboard strokes (`stores/whiteboard.ts`) follow the same rules without being list items: the reducers that need only `id` and `deleted_at` are typed over `SyncedRow` (`types/synced-row.ts`) and shared, and `utils/whiteboard-state.ts` holds what differs. A fix to those rules usually belongs in all three stores.

Recipes (`stores/recipes.ts`) are the fourth store on those rules, with `utils/recipe-state.ts` for what differs, and a fix usually belongs there too. They differ in two ways. Recipes hang on the household without a list or board row, so `householdId`, set once they are loaded, is what events and resync wait for. And a recipe can be edited: a new one is saved before it enters state (the form waits for it, so there is no `inserts-in-flight`), and an edit is optimistic and sends only the fields that changed (`utils/recipe-draft.ts`).

Vacations (`stores/vacations.ts`) are the fifth store on those rules, with `utils/vacation-state.ts` for what differs, and a fix usually belongs there too. It is one store for three tables, `vacations`, `vacation_tasks` and `vacation_people`, with one of each piece of bookkeeping for all: the pieces are keyed by a row's id. Like recipes, the rows hang on the household, and a new vacation is saved before it enters state: the function `create_vacation` (0015) writes it with its tasks in one transaction: none, or copies of an earlier vacation's (`tasksToCopy`), open and nobody's. A task is added optimistically, as a list item is. What a page shows depends on the day, and every function that does takes the day as a parameter (`utils/local-date.ts`); a calendar day is a `YYYY-MM-DD` string and never goes through `new Date("2026-12-05")`, which is midnight in UTC. A person taken off a trip stays as a row, and whose a task is, is worked out from that row by `assigneeOf` (`utils/vacation-share.ts`), never written to the tasks. The feature is built in slices; `docs/features/vacations/slice-1.md` and `slice-2.md` are the first two, and the folder's `CLAUDE.md` lists all its files.

Every store is loaded with `load(householdId)`: by the dashboard, whose tiles show all five, and by the feature's own pages. Only the first call fetches everything behind a spinner; later ones merge in the background (`resync()`), because replacing state would drop a write that is still on its way. In the three older stores the first fetch is `init()`, which replaces state; nothing but `load()` may call it, and a `load()` during it waits for it (the recipe store and the vacation store fetch a second time instead).

The rules the reducers and stores encode:

- **Client-generated ids.** An add creates the row locally under `crypto.randomUUID()` and inserts it with that id, so the server-confirmed row and the Realtime echo upsert instead of duplicating.
- **Soft deletes only.** `deleted_at` is set, the row stays in state as a tombstone, and getters filter it out. Nothing may undo a local soft delete. Newer tables (0012, 0014) don't grant `delete` to `authenticated` at all.
- **`position` is a fractional numeric** for reordering without reindexing (`utils/position.ts`).
- **`household_id` is denormalized onto every item table** so RLS policies and Realtime filters need no join.

Three pieces of bookkeeping live at module level in each store, outside Pinia state, because they are not renderable state:

- `utils/inserts-in-flight.ts`: a check or remove waits for the item's insert, otherwise its UPDATE reaches the server first and matches no row.
- `utils/changes-during-fetch.ts`: ids changed while a resync fetch is in flight keep their local version, as do `pendingIds`.
- `utils/realtime-event-order.ts`: Realtime does not deliver a row's events in commit order, so an event with an older `commit_timestamp` than the newest seen for that item is dropped. There is no `updated_at` trigger; don't order by `updated_at`.

### Realtime

`subscribeToHouseholdChanges` (`composables/household-realtime.ts`) opens **one channel per household**, filtered by `household_id=eq.<id>`, and every item table adds its listeners to it. Only INSERT and UPDATE are subscribed: DELETE events can't be filtered and bypass RLS, and the app never hard-deletes. `postgres_changes` has no replay, so every `SUBSCRIBED` (first join and each rejoin) triggers `resync()` on every list store, and so does the server's report "Subscribed to PostgreSQL" a quarter to half a second later: only from then on do changes flow, and one made in between is in no event. A store's `resync()` does nothing while its first load is running, so a load that answers after that report can still miss such a change. A new table also has to be added to the `supabase_realtime` publication (see migration 0011), or events silently never arrive.

An UPDATE event leaves out a large column the update didn't change (Postgres TOAST): a stroke's `points` is missing from its soft-delete event, and a recipe's `instructions` from a rename. A reducer for a table with such a column has to lay the event over the local row instead of replacing it (`applyStrokeRealtimeEvent`, `applyRecipeRealtimeEvent`). Where such a row can also be edited, an event may tell only part of a live row that isn't in state; the store then fetches it (`recipeEventNeedsFetch`).

`layouts/default.vue` mounts this once. Order matters there: `useResetStoresOnUserChange()` runs before `useHouseholdRealtime()`, so a new user never sees the previous user's household.

### Deployment

Production is Netlify, serving the static output of `nuxt generate`; there is no server and no Netlify Function. `netlify.toml` sets the build (`npm run generate`, publish `dist`) and no base directory; Netlify's own build settings must not name one either, and they can't be seen from the repository. Netlify builds every push to `main` on its own, independently of CI.

- The fallback for client-side routes (`/join/<code>`) is `public/_redirects`, not `netlify.toml`: Nitro's Netlify preset writes its own catch-all into `_redirects` unless one is there, and that file wins.
- Netlify's environment holds only `SUPABASE_URL` and `SUPABASE_KEY`, baked into the bundle at build time.
- `NODE_VERSION` in `netlify.toml` is exact; raise it together with `engines` in `package.json`.
- Deploy previews and branch deploys stay off: they would all use the one production Supabase project.

### Releases

Every push to `main` is a release. `.github/workflows/release.yml` runs semantic-release (`.releaserc.yaml` at the git root), which works out the next version from the Conventional Commits since the last `vX.Y.Z` tag: `fix` and `perf` give a patch, as does a revert whose message starts with `revert:` or `Revert` and keeps the line "This reverts commit `<hash>`.", `feat` a minor, `!` or a `BREAKING CHANGE:` footer a major, and a push with none of these releases nothing. It writes `CHANGELOG.md`, bumps `version` in `package.json` and `package-lock.json`, pushes both to `main` as a `chore(release): X.Y.Z` commit, tags that commit and creates the GitHub release. Don't edit `CHANGELOG.md` or the version by hand.

- **The release commit is made on `main` by the workflow**, which then fast-forwards `develop` to it. Both local branches are one commit behind after a release; `git pull --ff-only` them before the next push. If `develop` moved on in the meantime, the fast-forward step fails and `develop` has to be rebased onto `main`. It also fails when `main` got a change under `.github/workflows/` that `develop` didn't have yet, because the workflow's token may not push workflow files; push `develop` before `main` (`git push origin develop main`), or repair it with `git push origin main:develop`.
- The release does not wait for CI, and its commit starts no workflow run, because it is pushed with the workflow's own token. Netlify does build it, and has to: the footer shows `runtimeConfig.public.appVersion`, which `nuxt.config.ts` reads from `package.json` at build time. So the release commit's message must not contain `[skip ci]`.
- The tooling is a package of its own in `.github/release`, with its own lockfile, so that neither the Netlify build nor the CI checks install it. Run its `npm` commands there. `conventional-changelog-conventionalcommits` stays on 9.x until `@semantic-release/release-notes-generator` ships `conventional-changelog-writer` 9; with 10.x the notes step fails with "Missing helper".
- `CHANGELOG.md` is listed in `.prettierignore`: Prettier would reject the generated format, and `format:check` would fail on every release commit. The Markdown linter leaves it out too (`.markdownlint-cli2.jsonc`).
- `--dry-run` skips the steps that write the changelog, the version and the commit. To try a change to the release config, run a real release in a scratch clone whose only remote is a scratch bare repository, with the GitHub plugin removed and no token set. Give the remote as a `file://` URL, because the notes step fails with "Invalid URL" on a plain path, and start semantic-release with `--no-ci`, because outside a CI system it otherwise falls back to a dry run.

### Database and security

RLS is the security boundary; the publishable key ships in the client bundle. Every household-scoped table uses `using (is_household_member(household_id)) with check (is_household_member(household_id))`, where `is_household_member` is a SECURITY DEFINER helper that avoids RLS self-recursion. `household_invites` has no SELECT policy on purpose (codes must not be enumerable); household creation, invite creation and redemption go through the SECURITY DEFINER RPCs `create_household`, `create_invite` and `redeem_invite`. Members' email addresses live in `auth.users`, which the API doesn't expose; the SECURITY DEFINER RPC `list_household_members` (0013) returns them, to members of the same household only.

Rules that came out of bugs:

- **`.insert/.update/.upsert(...).select()` sends `RETURNING`, which Postgres checks against the table's SELECT policies** and reports as "new row violates row-level security policy". If the row is not visible to the caller at that moment, drop the `.select()` or use a SECURITY DEFINER RPC. Details: `docs/supabase-support-repro.md`.
- **Every new function in `public` needs `revoke execute ... from public, anon` and an explicit `grant ... to authenticated`**; Postgres grants EXECUTE to PUBLIC by default (see 0007, 0009).
- `SUPABASE_SECRET_KEY` and `SUPABASE_DB_PASSWORD` are for test tooling only and must never reach client code or `nuxt.config.ts`.

### Migrations and types

Migrations are `supabase/migrations/NNNN_name.sql`, applied to the cloud project; development and tests run against Supabase Cloud, not a local Supabase stack. When a migration is applied through the Supabase MCP server (`.mcp.json`), it records a timestamp version; the `supabase_migrations.schema_migrations` row is then renamed to the `NNNN` number so remote history matches the filenames. Ask the user before running that rename. Without the MCP server, `npx supabase db push --db-url "$DB_URL"` (`--dry-run` first) applies pending migrations and records the `NNNN` version itself; ask the user before applying either way.

`app/types/database.types.ts` is generated; don't edit it by hand. After a schema change (`DB_URL` is the project's Postgres connection string, built with `SUPABASE_DB_PASSWORD`):

```bash
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```

## Conventions and gotchas

- **User id is `useSupabaseUser().value?.sub`**, never `.id`: in `@nuxtjs/supabase` v2 the ref holds JWT claims, and the type check does not catch `.id`. In `*-actions.ts`, use `getCurrentUserId(client)`.
- **Route paths come from `ROUTES`** (`utils/routes.ts`, auto-imported); never write a literal like `'/login'`. Routing stays file-based, so renaming a route means changing `ROUTES` and renaming the file in `pages/`.
- **Icons are SVG paths from Material Design Icons v7**, imported where used: `import { mdiDeleteOutline } from '@quasar/extras/mdi-v7'` and `:icon="mdiDeleteOutline"`. Never a string name like `icon="delete"`: no icon font is bundled (`quasar.iconSet` is `svg-mdi-v7`), so it renders as literal text. An icon-only button needs an `aria-label`.
- **A person's picture is `<user-avatar>`** (`components/user/`). It draws the app's own "pen rosette" from the hash of the email address (`utils/avatar-rosette.ts`) at once, and lays the person's Gravatar over it once that has loaded; a 404 or being offline leaves the rosette. Every avatar is a request to gravatar.com. Pass `label` (the email) unless something around the avatar names the person already, as the header's account button does. The dashboard page fetches the household's members; `<member-roster>` only renders them. A person on a trip is drawn by `<person-avatar>` (`components/vacation/`): the member's avatar, or for a person without an account two letters of the name on a disc in an ink picked from the person's id (`utils/person-badge.ts`). Text in an ink or on one is below 4.5:1 for most inks, so the letters are in the text color on a tint.
- **The dashboard's tiles only render too** (`components/dashboard/`), and the whiteboard's tile stays last, also when a tile is added: `pages/index.vue` loads the five stores and hands each tile what it shows, a count and the first entries (`utils/list-preview.ts`), the board's strokes (`<whiteboard-preview>`) or the next vacation with where it stands (`vacationTilePreview`). So every visit to the dashboard fetches all five, the strokes with their points and every vacation's tasks included. A tile's link is its heading's text alone, stretched over the card with `::after`: the whole tile can be pressed, and the link is still named "To-dos", which is what a screen reader says and `a11y.e2e.ts` looks for. Keep everything else in a tile plain text. The vacations' tile is the exception (`VacationTile.vue`): its trip's lines are a second link, to the trip, stretched over those lines the same way and lying over the tile's own, and under them a "See all" button leads to the list. Hover and focus are an outline around the tile, not a veil over it: under the veil for a surface the tile's muted text is at 3.77:1 in light mode and 3.58:1 in dark mode.
- **Colors come from the theme**, `assets/css/theme.css`: Catppuccin Latte in light mode and Catppuccin Mocha in dark mode, taken from `@catppuccin/palette`. Every token is a `light-dark()` of the two, so the device's setting picks (`color-scheme: light dark`; Quasar follows with `dark: 'auto'`). The production build rewrites `light-dark()` for older browsers; `nuxt dev` and `public/offline.html` need Chrome 123, Firefox 120 or Safari 17.5. `light-dark()` takes colors only, so a value that differs by mode has to be part of a color (the veil's strength is its alpha). Never write a color value or a fixed Quasar palette name (`grey-8`, `red-9`) in a component: use a token (`var(--theme-surface)`, `--theme-text-muted`, `--theme-outline`), a brand name (`color="primary"`, `text-negative`) or one of the theme's own names (`text-muted`, `text-on-accent`, `ink-red`). `public/offline.html` is the one place with the values written out; `nuxt.config.ts` and `scripts/generate-pwa-icons.mjs` (the favicon and the app icons in `public/`) read them from the package.
- **Text on the primary and the negative color is `--theme-on-accent`**, not white: Mocha's accents are pastel, and white on them is at about 2:1. `theme.css` gives it to filled controls, the header and the footer. Catppuccin's pairings don't guarantee 4.5:1 (Latte: base on mauve is 4.8:1, and of the accents only mauve and red carry it at all), so calculate a new pair; `a11y.e2e.ts` scans every page in both modes.
- **Hover and keyboard focus move a control on an accent color away from its text**, where Quasar would move it towards it: `assets/css/hover-contrast.css` lays the theme's veil over it (`--theme-veil`: black at 30% in light mode, white at 65% in dark mode, where a veil shows less). The header's own highlights (wordmark, account button) use the same token. A flat button without a color of its own gets `--theme-veil-on-surface`, in the text's color and only as strong as leaves its text above 4.5:1. Don't give a flat button a color (`flat` with `color="primary"`): no highlight leaves colored text on a surface above 4.5:1 in light mode. Quasar's dialog plugin does it by default; pass `color: undefined` for its flat button.
- **A whiteboard stroke is stored with its pen's fixed `#rrggbb` and drawn in the theme's color for that pen** (`utils/ink.ts`, `--ink-*` in `theme.css`), so the board is light or dark with the rest. The avatars' rosettes are drawn the same way.
- **A list's row is one line.** A vacation's task shows who has it as a round button in that line (`VacationTask.vue`); a second line on every row made the list twice as long and no easier to read. A second line is for what needs a reader, such as the reason of a rejection.
- **Don't name a variable in `<script setup>` after a component the template uses** (`fairShare` beside `<fair-share>`): the template then takes the variable for the component.
- **A hint under a field is a `text-muted` paragraph, not Quasar's `hint`**, whose grey is below 4.5:1 on the theme's surfaces in light mode.
- **Sign-in leads back to the page that was asked for** (`saveRedirectToCookie` in `nuxt.config.ts`, read in `pages/login.vue` and only followed if `isInAppPath`); sign-out forgets it.
- **Component names have no path prefix** (`pathPrefix: false`): `components/household/InviteDialog.vue` is `<invite-dialog>`. Keep one subfolder per feature.
- **Components are written in kebab-case in markup**: `<nuxt-link>`, not `<NuxtLink>`. This holds for Nuxt's, Quasar's and the app's own components; ESLint enforces it (`vue/component-name-in-template-casing` in `eslint.config.mjs`) and `lint:fix` converts. File names stay PascalCase.
- **The UI is built mobile-first and optimised for small devices.** The reference screen is an iPhone SE, 375x667 px: design and check a layout there first, then let it grow for wider screens. The Playwright `dev` project runs at that viewport.
- **A control that is used with a thumb is at least 44 px in both directions.** Quasar's button is 36 px high and its checkbox 40 px; the class `touch-target` (`assets/css/touch-target.css`) gives the minimum. The vacation pages use it on every control.
- **A menu is opened by its button's own press where the focus returns to that button** (`VacationTask.vue`): Quasar's menu also opens when Enter is released on its button, which is what happens after Enter has saved a field and the focus has moved back.
- **Favor progressive enhancement.** Start from semantic native elements and forms that work on their own, and layer the extras on top so that their absence or failure leaves a working baseline, as `<user-avatar>` does with the rosette and the Gravatar.
- **The service worker only exists in a production build** (`nuxt generate` or `nuxt build`). PWA behaviour can't be checked in `nuxt dev`; use the `pwa` Playwright project. The Workbox options in `nuxt.config.ts` each work around a specific `@vite-pwa/nuxt` default, as their comments explain. In templates use the global `$pwa`.
- Supabase errors are plain objects, not `Error` instances; turn them into text with `errorMessage` (`utils/error-message.ts`).
- Login is email OTP with a code typed into the app, not a magic link (a link would open the system browser instead of the installed PWA). UI text does not name a code length.
- **The e2e tests find an element by its test id, never by its text.** The ids are in `TEST_IDS` (`utils/test-ids.ts`, auto-imported): a template binds one (`:data-testid="TEST_IDS.list.row"`), and the tests import the same constant, so a reworded or translated label breaks no test, and a misspelled id fails `npm run typecheck` on either side. An element a test needs gets its id there; don't locate by label, button text, heading or CSS class. An id names a kind of element, and where there are several, the helpers in `tests/support/e2e-ui.ts` pick the one with the text the test typed (`listItem`, `vacationTask`, `recipeLink`). `supabase-fixtures.ts` creates and deletes the disposable users and households for both the RLS and e2e suites.
  - Text is still asserted where the test is about wording the app puts together ("in 10 days", "23 open") or about which error is shown. A line that only ever says one thing is checked for being there.
  - Finding by id no longer proves that a control has a name. `a11y.e2e.ts` therefore keeps its locators by role and name, and a spec asserts a name where it carries what the test is about (`toHaveAccessibleName("Yours: Clothes")`).
  - Quasar: `q-input` puts the attribute on the native field and `q-btn`, `q-checkbox` and `q-menu` on the element with the role. `q-select` puts it on the hidden input it focuses, whose value is the chosen option's label. `q-option-group` gives its radios nothing, so a radio is found by its option's place (`optionRadio`). A button of a plugin dialog or a notice gets its id through `withTestId`, and a notice through `attrs`.
  - A menu is not inside the row of its button, and one that was just closed stays in the page while it fades; open one with `openTaskMenu` or `giveTaskTo`, which wait for that.
  - `public/offline.html` is not built and has its id written out.
- Prettier runs with its defaults; `.prettierrc.json` is empty on purpose. Don't add an option that only restates a default. It checks the whole repository, `docs/` included; `.prettierignore` leaves out the agent skills (`.agents`, `skills-lock.json`), which are another project's files.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy → never /ship or /land-and-deploy: a release is a push of `develop` and `main`, and semantic-release owns the version and the changelog (see "Releases")
