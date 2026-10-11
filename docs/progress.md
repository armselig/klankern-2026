# Klankern — Progress Log

Tracks what's been built against the milestones in [`plan.md`](./plan.md), session by session. Update this when picking the project back up or finishing a milestone — it's the fastest way to re-orient without re-reading the whole chat history.

**Resuming in a new session**: everything below is current as of milestone 9, the shared whiteboard, the first automated release, v1.0.0 (2026-10-10), the member avatars with the hover-contrast fix, the header with the wordmark and the account menu, the Catppuccin theme with light and dark mode, the two font replacements that were tried and dropped, release v1.3.1, the fix for the `pwa` e2e project with a leftover `.output`, milestone 8 finished with the update notice checked on the deployed site, milestone 10, the shared recipes, released as v1.4.0, and the fix of the success notices' colors (all 2026-10-11). `main` and `develop` are level at v1.4.0, except for that last fix, which is on `develop` only. Start a fresh session by pointing it at this file — e.g. "read docs/progress.md and continue from there." No other state matters; the repo and this doc are the source of truth, not any prior chat history.

## Status at a glance

| Milestone | Status |
|---|---|
| 1. Scaffold + tooling + git hooks | ✅ Done |
| 2. Schema + RLS + two-JWT test | ✅ Done — RLS test passing against Supabase Cloud |
| 3. Auth + household join flow | ✅ Done — clicked through in a browser (OTP login, invite, join) |
| 4. Shared to-do list CRUD | ✅ Done — clicked through in a browser (add, toggle, remove, reload, second member sees the list) |
| 5. Realtime sync for to-dos | ✅ Done — proven by the Playwright e2e test (two browsers, incl. reconnect) |
| 6. Shared shopping list | ✅ Done — CRUD + live sync, covered by unit tests and the Playwright e2e test |
| 7. PWA installability pass | ✅ Done — installability, offline page, update notice and install button covered by the Playwright `pwa` project; the install button also checked by hand in Chrome. Installing on Android moves to milestone 8 (needs HTTPS) |
| 8. Deploy (Netlify; containers deferred) | ✅ Done — deployed to Netlify from `main`; routing and response headers checked on the deployed URL, and login, join link, install, offline page, the Android install and the update notice checked there in a browser |
| 9. Shared whiteboard | ✅ Built — drawing, eraser, undo, clear and live sync, covered by unit, RLS and Playwright e2e tests, and tried by hand on a phone and with a second member |
| 10. Shared recipes | ✅ Built — write, read, edit and remove recipes with live sync, and put a recipe's ingredients on the shopping list; covered by unit, RLS and Playwright e2e tests, and clicked through in a browser by one member |

## What's built

**Stack as scaffolded**: Nuxt **4** (not 3 — 4 is what `nuxi init` installs now; API is compatible, folder convention differs: app code lives under `app/app/`, not `app/`), SPA mode (`ssr: false`), `nuxt-quasar-ui`, `@vite-pwa/nuxt`, `@nuxtjs/supabase`, Pinia. Backend is a Supabase Cloud project.

**Project layout** (relative to `app/`, the Nuxt project root):
```
app/app/
  types/            database.types.ts (generated), household.ts, synced-row.ts, list.ts, todo.ts,
                    shopping.ts, whiteboard.ts, recipe.ts
  composables/      current-user.ts, household-actions.ts, todo-actions.ts, shopping-actions.ts,
                    whiteboard-actions.ts, recipe-actions.ts,
                    household-realtime.ts, reset-stores-on-user-change.ts,
                    use-gravatar-hash.ts (+ .spec.ts siblings),
                    use-household-realtime.ts, use-reset-stores-on-user-change.ts,
                    use-pwa-update-notice.ts
  utils/            position.ts, list-state.ts, shopping-state.ts, error-message.ts,
                    inserts-in-flight.ts, changes-during-fetch.ts, realtime-event-order.ts,
                    whiteboard-state.ts, whiteboard-geometry.ts, recipe-state.ts, recipe-draft.ts,
                    gravatar.ts, avatar-rosette.ts, email.ts (+ .spec.ts siblings),
                    whiteboard-pen.ts, ink.ts (+ .spec.ts), routes.ts
  stores/           household.ts, todos.ts, shopping.ts, whiteboard.ts, recipes.ts
  pages/            login.vue, confirm.vue, index.vue, todos.vue, shopping.vue, whiteboard.vue,
                    join/[code].vue, recipes/{index,new}.vue, recipes/[id]/{index,edit}.vue
  components/       household/{CreateHouseholdForm,InviteDialog,MemberRoster}.vue,
                    todo/{TodoList,TodoItem}.vue, shopping/{ShoppingList,ShoppingItem}.vue,
                    whiteboard/{SharedWhiteboard,WhiteboardToolbar,WhiteboardSurface,WhiteboardStroke}.vue,
                    recipe/{RecipeList,RecipeView,RecipeIngredients,RecipeEditor,RecipeForm}.vue,
                    user/{UserAvatar,AccountMenu}.vue
  layouts/          default.vue
  assets/css/       theme.css (the colors of light and dark mode), hover-contrast.css
app/public/                 offline.html, icons, favicon.ico, robots.txt, _redirects (Netlify fallback for client-side routes)
app/scripts/                generate-pwa-icons.mjs (writes the app icons and the favicon in `public/`)
app/supabase/migrations/   0001_households.sql … 0014_recipes.sql
app/tests/support/          supabase-fixtures.ts (disposable users/households/invites via the Admin API, shared by RLS + e2e),
                            e2e-ui.ts (sign-in and list steps through the real UI), realtime-socket.ts (cut/watch the Realtime socket, hold back frames),
                            fake-supabase-client.ts (fake query builder + client for the `*-actions.spec.ts` unit tests)
app/tests/rls/              household-isolation.spec.ts (two-JWT RLS proof against Supabase Cloud)
app/tests/unit/             environment.spec.ts (the Vitest environment mounts a Vue component)
app/tests/e2e/              Playwright `dev` project (against `nuxt dev`): auth, household, lists, realtime-sync,
                            session-switch, whiteboard, recipes, avatars, a11y, app-version (*.e2e.ts); `pwa` project: pwa.e2e.ts (production build)
netlify.toml                at the git root: build settings for Netlify
```

**Design pattern used throughout**: business logic lives in plain `composables/*-actions.ts` functions that take a `SupabaseClient` as a parameter, unit-tested with a mocked client (no Nuxt runtime needed). Pinia stores are thin — they call `useSupabaseClient()`/`useSupabaseUser()` and delegate to those functions. State-transition logic that needs testing on its own (optimistic add/dedup, soft-delete, sort order) is further extracted into pure reducer functions in `utils/`. List logic that doesn't depend on the item type (dedup, soft delete, Realtime events, reconnect merge) is **generic** over `ListItem` (`types/list.ts`) in `utils/list-state.ts` and shared by every list; only the actions, store, components and list-specific ordering are per list. The whiteboard follows it too (see "Milestone 9"), and so do the recipes (see "Milestone 10").

**Testing**: Vitest, 263 tests in 25 files passing (including the RLS suite) (`npm test`, run 2026-10-11). Playwright e2e (`npm run test:e2e`, 30 tests in 11 files and two projects; see the milestone 5 and 7 sections and "E2E gap review") is separate and not in the pre-push hook; CI runs it on every push to `main` and `develop` (see "CI"). Husky pre-commit (lint-staged: eslint --fix + prettier) and pre-push (full test suite) are wired and verified firing through git's actual hook dispatcher — not just callable manually. Note the project lives one directory below the git root (`app/` inside `klankern-2026/`), which needed a non-default Husky setup (`prepare` script does `cd .. && husky app/.husky`, and `core.hooksPath` points at `app/.husky/_`) since Husky's own `.git` detection assumes the package.json directory *is* the repo root.

**Database types**: generated from the live schema via `supabase gen types typescript`, saved to `app/app/types/database.types.ts`, picked up automatically by `@nuxtjs/supabase`'s default `types` path. Re-run after any migration changes:
```
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```

## Resolved: the "Supabase RLS bug" was `INSERT ... RETURNING` (2026-10-08)

The former blocker (role-scoped RLS policies apparently rejected by PostgREST) was **not** a platform bug. supabase-js `.insert().select()` sends `INSERT ... RETURNING`, and Postgres requires the returned row to pass the table's **SELECT** policies too, raising the same "new row violates row-level security policy" error when it doesn't. Creating a household (creator isn't a member yet at RETURNING time) and creating an invite (no SELECT policy by design) both hit this. Full write-up: [`supabase-support-repro.md`](./supabase-support-repro.md).

Fixed by `0007_create_household_rpc.sql` (`create_household` / `create_invite` SECURITY DEFINER RPCs; dropped the "first member claims ownership" policy) and `0008_service_role_grants.sql` (`service_role` had no table privileges, which silently broke the RLS test's admin fixtures and cleanup).

**Rule going forward**: any `.insert/.update/.upsert(...).select()` needs the resulting row to be visible under the table's SELECT policy at that moment; otherwise drop the `.select()` or use a SECURITY DEFINER RPC.

**Function privileges**: Postgres grants `EXECUTE` on every new function to `PUBLIC`, i.e. callable by signed-out clients via `/rest/v1/rpc/...`. Every new function in `public` needs `revoke execute ... from public, anon` plus an explicit `grant ... to authenticated` (see 0007, 0009). The security advisor's remaining "signed-in users can execute SECURITY DEFINER function" warnings for `create_household`, `create_invite`, `redeem_invite`, `list_household_members` and `is_household_member` are intentional: the first four are the app's RPCs, and RLS policies need `authenticated` to be able to execute `is_household_member`.

**Migrations workflow**: the Supabase MCP server (`.mcp.json`) works in fresh sessions and was used to apply 0007–0009 (`apply_migration`). It records a timestamp version, so the `supabase_migrations.schema_migrations` row was renamed to `0007`–`0009` afterwards (in its own `execute_sql` call — don't batch it with a `begin … rollback` probe, the rollback undoes it) to keep remote history matching the local `NNNN_` filenames — do the same for future migrations applied that way. In auto mode, Claude Code's permission classifier blocks that rename (`update supabase_migrations.schema_migrations ...`) when the agent does it on its own initiative, but lets it through once the user explicitly asks for it. So: ask the user, then run it, with a read-only `select version, name from supabase_migrations.schema_migrations` before and after. 0011 was renamed this way on 2026-10-08. Without the MCP server, `npx supabase db push --db-url "$DB_URL"` (from `app/`; `--dry-run` first) applies the pending files and records the `NNNN` version by itself, so nothing needs renaming; 0012 was applied that way on 2026-10-10 with the user's go-ahead.

## Other notable decisions / deviations from the plan

- **No local Supabase stack.** Development and tests run directly against Supabase Cloud (the plan's fallback), and `supabase start` is not part of the workflow.
- **No dev container** (decided 2026-10-10, deviating from the plan's `Containerfile.dev` + `podman-compose.yml`). Development stays on the host: Node is pinned (`.nvmrc`, `engine-strict`), and the e2e tests drive the host's Chrome against the host's dev server. A dev container would add a `node_modules` volume, user-namespace mapping and a polling file watcher for little gain; add one if a second machine or contributor needs it. Production is hosted on Netlify instead of in a container (see "Milestone 8"). The Podman production setup is **deferred, not dropped**: if it is built later, it is `Containerfile.prod` (Node 24, not the plan's `node:22-slim`), Quadlet units and Caddy. A throwaway smoke test of a two-container Podman setup (Caddy proxying to a Node server, via compose and via plain `podman run`) passed beforehand.
- **Component path prefixing disabled** (`components: [{ path: '~/components', pathPrefix: false }]` in `nuxt.config.ts`) so `components/household/CreateHouseholdForm.vue` registers as `<CreateHouseholdForm>` rather than Nuxt's default `<HouseholdCreateHouseholdForm>`. Keep using subfolders per feature (`components/todo/`, `components/shopping/`, …) — this config makes that free.
- **Icons are SVG, not an icon font** (`quasar.iconSet: 'svg-mdi-v7'` in `nuxt.config.ts`). See "Icon strategy".
- **Route paths live in `ROUTES`** (`app/app/utils/routes.ts`, auto-imported; `nuxt.config.ts` imports it explicitly for the auth redirect config). Never write a literal path like `'/login'` in pages, components or config. Routing itself stays file-based, so renaming a route means changing `ROUTES` **and** renaming the file in `pages/`.
- **`household_id` is denormalized onto every item table** (`todo_items`, `shopping_items`, etc.) per the plan, specifically so RLS policies and Realtime channel filters don't need a join.

## Environment / secrets

`app/.env` (gitignored) holds: `SUPABASE_URL`, `SUPABASE_KEY` (publishable), `SUPABASE_DB_PASSWORD`, `SUPABASE_SECRET_KEY`. The DB password and secret key are **server-side/test-tooling only** — never read by `nuxt.config.ts`'s public runtime config, never shipped to the browser. The secret key in particular should stay out of anything client-facing permanently; it's only used by `tests/rls/` to provision disposable test users via the Admin API.

## Resolved: login emails contained no OTP code (2026-10-08)

Supabase's default email templates only contain a magic link. Fixed in the dashboard by the user: custom SMTP via **Resend**, and `{{ .Token }}` (no `{{ .ConfirmationURL }}`) in **both** the "Magic link" template (existing users) and the "Confirm signup" template (a brand-new user's first `signInWithOtp`). Missing the second one is easy: the first code request for a new address uses "Confirm signup".

Click-through accounts: two real accounts, A (owner) and B (member), in one household. Codes are pasted into the app by the user — the agent doesn't read the inbox.

## Browser click-through of milestones 3–4 (2026-10-08)

Done in Chrome against the user's `nuxt dev` on `localhost:3000`. Every step works: OTP login, invite creation, signed-out join via `/join/<code>` + OTP, to-do add (button and Enter), toggle, soft-delete, state survives reload, and A sees the items B created.

**Bug found and fixed**: adding a to-do always failed with `not_authenticated`. In `@nuxtjs/supabase` v2, `useSupabaseUser()` holds the JWT **claims** (`Ref<JwtPayload | null>`, filled via `auth.getClaims()`), not a `User` — the user id is `.sub`, and `.id` is always `undefined`. The type check didn't catch it because `JwtPayload` allows arbitrary keys. **Rule going forward**: read the id as `useSupabaseUser().value?.sub`, or use `getCurrentUserId(client)` in `*-actions.ts`.

Smaller issues found, all fixed afterwards:
1. The cloud project sends **8-digit** codes, but the login and join pages said "6-digit code" → the text no longer names a length ("We sent a login code", "Code from the email").
2. `redeem_invite` incremented `use_count` even when the caller was already a member → `0010_redeem_invite_count_new_members.sql` only counts a redemption that inserted a member (also switches the function to `search_path = ''`); covered by a new RLS test.
3. The add-to-do input lost focus after each add → `TodoList` refocuses it on submit.
4. To-do checkboxes had no accessible name (announced as "on") → the title is now the `q-checkbox` `label`, which Quasar also sets as `aria-label`.

Fixes 1, 3 and 4 are now covered by the e2e specs `auth` and `lists` (see "E2E gap review").

Leftover test data in the cloud project: to-dos "Test 1–3" and one invite in the click-through household.

## Header shows the signed-in user (2026-10-08)

The layout header shows the signed-in user's avatar, which opens the account menu with the email and "Sign out" (see "Header: wordmark and account menu"). Signed out, it shows a "Log in" link, except on `/login` and `/join/<code>` (a detour from the join page to `/login` would drop the invite code). Tested in a browser by the user.

## Milestone 5: Realtime sync (done 2026-10-08)

- `0011_realtime_publication.sql` adds `todo_items` and `shopping_items` to `supabase_realtime` (applied to the cloud project).
- `utils/list-state.ts` (was `todo-state.ts` until milestone 6 made it generic): `applyListRealtimeEvent` (upsert by id so the echo of an optimistic add dedups; ignores other lists and everything before the list is loaded; nothing undoes a local soft delete) and `mergeListResync` (refetch result + items the fetch may predate + local tombstones; anything else missing from the fetch was deleted remotely and is dropped). Event shape is the app's own `ListRealtimeEvent<T>` (`types/list.ts`), not realtime-js types.
- `stores/todos.ts` (and `stores/shopping.ts`): `pendingIds` (wrapped around every server write via `withPending`), `applyRealtimeEvent`, `resync()` (no-op until `init()` has loaded the list). During a resync fetch, `utils/changes-during-fetch.ts` collects the ids of writes that finish and Realtime events that arrive; those keep their local version in the merge, like `pendingIds`.
- `composables/household-realtime.ts`: `subscribeToHouseholdChanges` — one channel per household, `postgres_changes` INSERT + UPDATE only (never DELETE: unfilterable and RLS-free; the app only soft-deletes), filter `household_id=eq.<id>`, `onSubscribed` on every `SUBSCRIBED` (first join and every automatic rejoin) → resync.
- `composables/use-household-realtime.ts`: `useHouseholdRealtime()`, called once in `layouts/default.vue`. Keyed on user **and** household id, because sign-out doesn't clear the household store. Every list adds its listeners to this same channel rather than opening a new one; every `SUBSCRIBED` resyncs every list's store.
- No `updated_at` trigger exists; don't use `updated_at` for ordering. Events of one item are ordered by the payload's `commit_timestamp` instead (since 2026-10-10, see "E2E gap review"); between items, and on equal timestamps, the later arrival wins.

**E2E test** (`npm run test:e2e`, Playwright 1.64, uses the installed Google Chrome via `channel: 'chrome'`, reuses a running `nuxt dev` on :3000 or starts one): two disposable users in one household, two browser contexts. Covers add/toggle/delete arriving live, echo dedup, changes made while disconnected arriving after the reconnect, and the channel leave on sign-out. Verified to fail with the subscription removed and with the resync removed. Things learned building it:
- Login goes through the real form: the `auth/v1/otp` request is fulfilled in the browser (no email sent) and the code comes from `admin.auth.admin.generateLink({ type: 'magiclink' }).properties.email_otp`, which `verifyOtp({ type: 'email' })` accepts.
- Chrome's offline emulation (`context.setOffline`) does **not** close an open websocket. The drop is simulated with `context.routeWebSocket` (close the socket, refuse reconnects until "online").
- The session cookie is written a moment after the header already shows the user; a full page load in that gap starts signed out. `signIn` (`tests/support/e2e-ui.ts`) therefore waits for the `…-auth-token` cookie, after which `page.goto` is safe. Since 2026-10-10 it first waits for the home URL and for the email in the header (see "CI").
- Test files are `*.e2e.ts` so Vitest's `*.spec.ts` glob doesn't pick them up.

## Milestone 6: Shared shopping list (done 2026-10-08)

No migration needed: `shopping_lists`/`shopping_items` existed since 0003 and `shopping_items` was already in the Realtime publication (0011).

- First, the to-do reducers were made generic (`utils/list-state.ts`, `types/list.ts`: `ListItem`, `ItemsById<T>`, `ListRealtimeEvent<T>`), so the dedup/tombstone/resync rules exist once.
- `composables/shopping-actions.ts`, `stores/shopping.ts`, `components/shopping/{ShoppingList,ShoppingItem}.vue`, `pages/shopping.vue` (`ROUTES.shopping`, "Shopping" button on the dashboard) mirror the to-do layers. Differences: `checked` instead of `done`, and an optional free-text `quantity` (empty input → `null`), shown in the checkbox label as "Apples (6)" so screen readers announce it.
- **Checked items sink to the bottom** (`visibleShoppingItems` in `utils/shopping-state.ts`), each group in list order. Decided with the user; to-dos keep plain list order.
- A "remove all checked items" button was **deliberately left out** for now (user decision); add it if it's missed in practice.
- `subscribeToHouseholdChanges` has INSERT + UPDATE listeners for `shopping_items` on the household channel (`onShoppingItemChange`).
- E2E: second scenario (add with quantity, check → moves to the bottom, remove), verified to fail with the shopping listener disconnected. Reconnect isn't tested separately for shopping since it uses the same generic merge.

The fake Supabase query builder/client for the unit tests was first copied into `household-actions.spec.ts`, `todo-actions.spec.ts` and `shopping-actions.spec.ts`; since 2026-10-10 it is one shared helper, `tests/support/fake-supabase-client.ts`. New `*-actions.spec.ts` files import it from there.

## Milestone 7: PWA installability (built 2026-10-09)

Checking a production build (`nuxt build`) showed the milestone-1 PWA config was broken in ways `nuxt dev` never revealed (the service worker isn't generated in dev):
- **No `<link rel="manifest">`** — `@vite-pwa/nuxt` only adds it via `<NuxtPwaManifest />`, now in `app.vue`. Without it the app wasn't installable at all.
- **`navigateFallback: '/offline.html'`** registers a route that answers *every* page load with the fallback page, online or not. Replaced by a `NetworkOnly` runtime rule for navigations with `precacheFallback: { fallbackURL: 'offline.html' }`, and `navigateFallback: null`.
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
- The update notice could not be verified by hand. It is now covered by the `pwa` project instead (see "E2E gap review"), so this is resolved. Since 2026-10-11 it has also been checked by the user on the deployed site (see "Milestone 8").
- Installing on Android needs HTTPS on a real host, so it waits for milestone 8 (checked there on 2026-10-10, see "Milestone 8").

## E2E gap review (2026-10-09)

Playwright arrived only in milestone 5, so milestones 3–4 had never been tested end to end. The review added these specs (the Playwright project `sync` is now `dev` and runs every spec except `pwa.e2e.ts`):
- `auth.e2e.ts`: the auth guard (signed out, `/`, `/todos` and `/shopping` redirect to `/login`; `/join/<code>` stays reachable), the session surviving a reload, sign-out locking the pages again, a wrong code, "Use a different email".
- `household.e2e.ts`: creating a household as a new user, joining through the invite link from the invite dialog (signed out, with the join page's own sign-in; and signed in, joining right away), unknown/expired/used-up codes.
- `lists.e2e.ts`: add (Enter and button), empty input ignored, focus kept, check, remove, state after a reload, for both lists; plus checking/removing an item while its add is still saving.
- `session-switch.e2e.ts`: two users of different households in one tab, without a page load in between.
- `pwa.e2e.ts`: the update notice (served through a local proxy that changes `sw.js`, since Playwright's routing doesn't see the browser's own service-worker update check) and the install button (synthetic `beforeinstallprompt`).
- `a11y.e2e.ts`: axe (`@axe-core/playwright`) on every page, failing on serious/critical WCAG 2.1 A/AA findings.

Each new test was checked to fail with its feature broken (auth guard exclude, removed refocus, removed update notice, and the bugs below before their fixes).

**Bugs found and fixed:**
1. Supabase errors showed as "unknown_error": supabase-js returns PostgREST errors as plain objects, so `e instanceof Error` never matched. `utils/error-message.ts` reads both; the join page explains an invalid or expired invite in a sentence.
2. A check or remove made while the item's add was still saving was lost: the PATCH could reach the server before the INSERT (0 rows updated), and the insert's confirmed row undid the check in the UI. Updates now wait for the item's insert (`utils/inserts-in-flight.ts`), and `confirmListItem` keeps fields changed locally. `withPending` now removes only its own `pendingIds` entry.
3. Signing out didn't clear the stores, so the next user in the same tab first joined the previous household's Realtime channel (RLS kept the data out). `useResetStoresOnUserChange` (in the layout, before `useHouseholdRealtime`) resets the stores whenever the user id changes.
4. No page had a `<title>`, and the grey text of checked items and empty lists had a contrast of about 2.7:1. Pages now set titles via `useHead` (template in `app.vue`; the route announcer now reads them out), and the text uses `text-grey-8`.

**Fixed 2026-10-10: resync could undo a change.** `mergeListResync` protected only ids still in `pendingIds` when the fetch *returned*, so a check or remove saved while a resync fetch was in flight was undone in the UI by the older fetch result. Now every id whose write finishes or whose Realtime event arrives during the fetch is collected (`utils/changes-during-fetch.ts`) and keeps its local version. The last test in `realtime-sync.e2e.ts` covers it (no longer `test.fail()`; verified to fail again with the fix disabled).

**Fixed 2026-10-10: Realtime events of one row can arrive out of order.** Found while verifying the resync fix; this, not the resync, is what made "shopping: checking or removing an item while its add is saving" in `lists.e2e.ts` fail in roughly 1 of 10 runs. When an item's INSERT and its UPDATE are committed within about 50 ms, Realtime sometimes delivers the UPDATE echo *before* the INSERT echo (recorded frames: UPDATE `checked: true`, `commit_timestamp` …35.485, followed by INSERT `checked: false`, `commit_timestamp` …35.436). Applied in arrival order, the stale INSERT unchecked the item in the UI until a reload; the server kept the check. Now `ListRealtimeEvent` carries the payload's `commit_timestamp` (`commitTimestamp`), and each store drops an event committed before the newest one it has seen for the same item (`utils/realtime-event-order.ts`, bookkeeping outside store state like `inserts-in-flight.ts`). Chosen by the user over the narrower "ignore an INSERT for an item already in state", since it also covers two swapped UPDATEs. Limits: commit timestamps have millisecond resolution, so two events of one item committed in the same millisecond still go by arrival; and the local soft-delete guard in `applyListRealtimeEvent` stays, since a local delete has no commit timestamp. The last test in `realtime-sync.e2e.ts` forces the order by holding the INSERT frame back until the UPDATE has arrived (`holdReceivedFrames` in `realtime-socket.ts`); verified to fail with the check disabled in the shopping store (to-dos use the same wiring and weren't checked separately). The formerly flaky test then passed 10 of 10 repeats.

**Running e2e tests repeatedly**: long `--repeat-each` runs made sign-ins time out (the session cookie never appears) once a run did more than about 30 sign-ins within 5 minutes — presumably Supabase's rate limit on OTP verifications, not checked in the dashboard. Keep repeat runs below that or pause between them.

## CI (added 2026-10-10)

`.github/workflows/ci.yml` runs on every push to `main` and `develop` (a merged pull request is a push): lint, format check, typecheck, `npm test` (unit + RLS), then `npm run test:e2e` (both Playwright projects). The e2e tests had only ever been started by hand. The hooks are unchanged.

- Needs the repository secrets `SUPABASE_URL`, `SUPABASE_KEY` and `SUPABASE_SECRET_KEY`.
- One run at a time for the whole repo (`concurrency`), since every run uses the same cloud project and its sign-in limit. A push to `develop` followed quickly by a merge to `main`, or a CI run overlapping a local e2e run, can still exceed that limit (see "Running e2e tests repeatedly"); it shows as sign-in timeouts across specs, and rerunning the job later fixes it.
- Playwright uses the Chrome installed on the runner; a step checks it is there. No Playwright `retries`, on purpose: a retry spends sign-ins and hides flakiness.
- Traces of failed tests are uploaded as an artifact for 7 days. They contain the publishable key and sessions of disposable test users, not the secret key. Reconsider the upload if the repo becomes public.
- Actions are pinned to commit SHAs.

The first run passed everything except one e2e test: "a new version shows the update notice" (`pwa.e2e.ts`) failed with "execution context was destroyed". A race in the test, not in the app: after clicking "Reload", the poll for the `beforeUpdate` marker landed in the middle of the reload it was waiting for. The poll now treats that error as "not reloaded yet" and tries again.

**Fixed 2026-10-10: `signIn` returned before the app had left the login page.** "the session survives a reload" (`auth.e2e.ts`) failed in four CI runs in a row, on docs-only commits, while passing locally. The Playwright trace showed a race in the test helper, not in the app:

- `getByText(user.email)` was meant to match the header but matched the code step's own text ("We sent a login code to …"), so it passed before the code was even verified.
- The session cookie is written as the verify request returns, before `router.push(ROUTES.home)` in `login.vue` has finished. The test's reload then loaded `/login`, which is excluded from the auth guard and shows the login form to a signed-in user.

`signIn` now waits for the home URL and looks for the email inside the header (`getByRole('banner')`) before it waits for the cookie. The next CI run passed. Why the race started to lose every time in CI, without a code change, was not found.

- The same CI run on `develop` once also failed "a signed-out family member joins through the invite link" (`household.e2e.ts`) with the 120 s test timeout, in the step where the member opens the join link. It overlapped with a local e2e run; not explained, and it has not recurred.
- Not changed: a signed-in user who opens `/login` directly sees the login form.

## Milestone 8: Netlify deploy (repo side built 2026-10-10, done 2026-10-11)

Production hosting is **Netlify, as static files** (user decision, deviating from the plan's Podman + Caddy setup, which is deferred). The app is a client-only SPA with no `server/` directory, so `nuxt generate` output is all it needs: no Netlify Function, no container.

- **`netlify.toml`** (git root): `base = "app"`, `npm run generate`, publish `dist`, `HUSKY=0` (the `prepare` script would otherwise try to install git hooks) and an exact `NODE_VERSION` (`.nvmrc` holds an alias, and `engine-strict` rejects a 24.x below the range in `package.json`; raise both together).
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

## Milestone 9: Shared whiteboard (built 2026-10-10)

One whiteboard per household at `ROUTES.whiteboard` ("Whiteboard" button on the dashboard): a pen in four colors and three widths, an eraser that removes whole strokes, "Undo" and "Clear board". Decided with the user: one board, a fixed 4:3 board without panning or zooming, and those three tools.

**Deviations from the plan**

- **Rows and `postgres_changes`, not Realtime `broadcast`** (user decision). Every finished stroke is one `board_strokes` row and syncs like a list item, on the existing household channel. The volume is one row per stroke, not per point, and RLS stays the only security boundary. A broadcast channel would need `private: true` plus RLS policies on `realtime.messages`. The price: other members see a stroke when the pen lifts, not while it is drawn. A live preview over broadcast can be added on top.
- **SVG, not a `<canvas>`.** The surface is an `<svg>` with one `<polyline>` per stroke (a `<circle>` for a tap), rendered by Vue from store state. It scales by itself (`viewBox`), needs no redraw on resize or device-pixel-ratio handling, and the e2e test can read the strokes from the DOM.

**Schema** (`0012_whiteboard.sql`, applied to the cloud project)

- `boards`: one per household, enforced by `unique (household_id)` so two members opening the whiteboard for the first time at the same moment can't create two. Drop the constraint when several boards are wanted.
- `board_strokes`: `color`, `width`, `points` (jsonb), `created_by`, `deleted_at`, `household_id`. A composite foreign key `(board_id, household_id)` keeps the denormalized `household_id` equal to the board's.
- **Board units.** The board is 4000 × 3000 units on every screen; `points` is a flat integer array `[x0, y0, x1, y1, …]` and `width` is in the same units. Check constraints limit a stroke to 1000 points with coordinates 0–4000, the color to `#rrggbb` and the width to 1–200, because RLS can't limit how large a row a member inserts. The same numbers are in `utils/whiteboard-geometry.ts`.
- Policies are the uniform `is_household_member(household_id)` ones. Grants are narrower than for the lists: `authenticated` gets `select, insert` on `boards` and `select, insert, update` on `board_strokes`. There is no `delete`: the app only soft-deletes, and a hard delete would be invisible to the other members.
- `board_strokes` is in the `supabase_realtime` publication.

**Code**, in the usual layers

- `composables/whiteboard-actions.ts`: `fetchOrCreateBoard` (an insert that ignores the conflict, then a read), `fetchBoardStrokes`, `insertBoardStroke`, `softDeleteBoardStrokeRemote`, `softDeleteAllBoardStrokes`.
- `stores/whiteboard.ts`, parallel to the list stores (`pendingIds`, `resync()`, the three module-level helpers), plus `drawnIds` for undo.
- `utils/whiteboard-state.ts` holds only what differs from a list item; the store uses `upsertListItem`, `confirmListItem`, `softDeleteListItem` and `mergeListResync` from `utils/list-state.ts`. Those four are now typed over `SyncedRow` (`types/synced-row.ts`: `id`, `deleted_at`) instead of `ListItem`, with no change in behaviour.
- `utils/whiteboard-geometry.ts`: point thinning, the eraser's hit test, clamping to the board.
- `subscribeToHouseholdChanges` has INSERT + UPDATE listeners for `board_strokes` (`onBoardStrokeChange`); `useHouseholdRealtime` resyncs the whiteboard on every `SUBSCRIBED`; `useResetStoresOnUserChange` resets its store.

**Behaviour worth knowing**

- **Realtime leaves `points` out of an UPDATE for a large stroke.** Postgres stores a large value out of line (TOAST) and doesn't put it in the change record when the update didn't touch it. Measured on the cloud project: the UPDATE of a 2-point stroke carries `points`, the UPDATE of a 1000-point stroke has no `points` key at all. The only update the app makes is a soft delete, so `applyStrokeRealtimeEvent` lays the event's row over the local one instead of replacing it (`BoardStrokeChange` in `types/whiteboard.ts` has `points` optional). The same would hit any future table with a large column.
- **Strokes are fetched in pages of 500, cut by id** (`.gt('id', lastId)`), not by offset: PostgREST returns at most 1000 rows per request, and a stroke erased between two requests would shift an offset. The fetch order doesn't matter; `visibleStrokes` sorts by `created_at`, parsed as a date because the client, PostgREST and Realtime each format it differently.
- **Undo** removes the member's own newest stroke that is still on the board. It only knows the strokes drawn since the page was loaded (`drawnIds` is in memory), and there is no redo: a redo would be an undelete, which the sync rules rule out.
- **Clear board** soft-deletes every stroke of the board in one UPDATE, selected by `board_id`, after a confirmation. It therefore also removes a stroke another member saved a moment earlier that this client hasn't seen. Every member gets one Realtime event per stroke.
- **A stroke that reaches 1000 points** is saved and the line continues in a new stroke.
- **Pointer input**: Pointer Events with pointer capture, `touch-action: none`, only the primary pointer. `pointercancel` discards the stroke in progress.
- **Accessibility**: the toolbar is three radio groups and two buttons. The surface is `role="img"` with the name "Whiteboard, N strokes"; the drawing itself has no text alternative, and drawing needs a pointer.
- Erased strokes stay as rows forever (soft delete); nothing purges them. The partial index `board_strokes_live_idx` keeps loading a board independent of their number.

**Tests**

- Unit: `whiteboard-actions.spec.ts`, `whiteboard-state.spec.ts`, `whiteboard-geometry.spec.ts`, and the stroke listener in `household-realtime.spec.ts`.
- RLS (`household-isolation.spec.ts`): another household's board and strokes are invisible and can't be drawn on or erased; the composite key rejects a stroke on another household's board; no hard delete; one board per household; each check constraint.
- E2E (`whiteboard.e2e.ts`): two members; a stroke with its color, width and points arrives on the other; a tap makes a dot; undo; reload; the eraser on another member's stroke of several hundred points (the missing-`points` rule itself is guarded by the unit test, since an erased stroke is hidden either way); clear with its confirmation. It asserts on the surface's accessible name and the strokes' attributes, not on pixels. Verified to fail with the stroke listener disconnected. `a11y.e2e.ts` scans the page and `auth.e2e.ts` checks its auth guard.
- Not tested separately: a reconnect (same resync as the lists), and touch or pen input (the e2e test draws with the mouse).
- **Tried by hand by the user (2026-10-11)**: the whiteboard on a phone and with a second member. No automated test draws by touch.

**Found on the way**

- A long-running `nuxt dev` did not pick up the new page file (`/whiteboard` answered 404) until the file was moved away and back.
- **The `pwa` project failed once in the working tree** (all 4 tests, blank page): the HTML in `dist` referenced `/_nuxt/*.js` files that the same build had not written. A fresh copy of the same tree built correctly and passed all 4. Not explained then: Playwright always runs `nuxt dev` and the production build side by side, in CI too, so that alone is not the cause. Explained and fixed on 2026-10-11, see "The `pwa` e2e project and a leftover `.output`".
- `dragOnWhiteboard` (`tests/support/e2e-ui.ts`) scrolls the board into view first: Playwright's mouse doesn't scroll, and a position under the fixed footer hits the footer.

**Noticed, not changed** (the lists):

- `fetchOrCreateTodoList` and `fetchOrCreateShoppingList` have the race the board's unique constraint prevents: two simultaneous first visits create two lists, after which `.maybeSingle()` fails for that household. Fixed with milestone 10 (see there).
- `fetchTodoItems` and `fetchShoppingItems` are not paged, so a list with more than 1000 live items would be cut off.

## Icon strategy (2026-10-10)

Icons are SVG paths from **Material Design Icons v7** (`@quasar/extras`, now a direct dependency), imported where they are used (`import { mdiDeleteOutline } from '@quasar/extras/mdi-v7'`, `:icon="mdiDeleteOutline"`), so only the icons a screen uses are bundled. `quasar.iconSet` is `svg-mdi-v7`, which also makes the icons Quasar's own components draw (select arrows, clear buttons, …) SVG. Chosen by the user over staying with text labels, the Material Icons web font, Iconify and hand-picked SVG files; MDI over Material Icons for its larger catalogue.

- **The "no icon font" setup never worked as intended.** `nuxt-quasar-ui` adds the font of the configured `iconSet` (default `material-icons`) to `extras.fontIcons` on its own (`autoIncludeIconSet`), so `fontIcons: []` had no effect and every production build shipped the 128 KB Material Icons font unused. With an SVG `iconSet` it is gone; `fontIcons: []` was removed from the config.
- **Never use a string icon name** (`icon="delete"`): without the font it renders as literal text.
- **Existing buttons**: the per-row "Remove" button of both lists is icon-only with `aria-label="Remove"` (keeps rows narrow on phones); Add, Copy, "Invite a family member", the dashboard's To-dos/Shopping and the header's Install app/Sign out/Log in (since 2026-10-11 "Install app" is icon-only, and "Invite a family member" and "Sign out" are in the account menu) have an icon next to their label. Form submit buttons, "Use a different email" and "Close" stay text only. Accessible names are unchanged, so the e2e helpers needed no change.
- **Test**: `lists.e2e.ts` checks that the Remove button contains an `svg` and no text; verified to fail with a string icon name.
- Not auto-imported via `extras.svgIcons`: that would register about 7,400 global names.

Checked by the user in a browser (2026-10-10).

## Releases: automated versions and changelog (built 2026-10-10, v1.0.0 released the same day)

Every push to `main` is now a release, cut by semantic-release in `.github/workflows/release.yml`: the version follows from the commit messages since the last tag, and `CHANGELOG.md` (at the git root until 2026-10-11, since then `app/CHANGELOG.md`), the version in `app/package.json`, the tag and the GitHub release are written by the workflow. How it works day to day is in `CLAUDE.md` ("Releases").

Decisions:

- **Every push to `main`, not a release pull request.** Netlify deploys every push to `main`, so that push already is the release. The price is a bot commit on `main` after almost every push: the workflow fast-forwards `develop` to it, and both local branches have to be pulled before the next push.
- **The first release is 1.0.0 and lists the whole history** (the 20 `feat` and `fix` commits so far, plus whatever the first push adds). semantic-release has no 0.x mode: without a tag it starts at 1.0.0.
- **Not gated on CI.** Netlify doesn't wait for CI either, so the tag marks what was deployed. Gating would also delay the release commit by a full CI run, and `develop` would more often have moved on by then.
- **Own package in `.github/release`.** In `app/package.json` the tooling would add 348 lockfile entries (it bundles the npm CLI) to every Netlify build and to the CI job that holds the secret key. The release job installs only this package, with `--ignore-scripts` and without the npm cache, because it can write to the repository.
- **The version is shown in the footer** (`Version X.Y.Z`, from `runtimeConfig.public.appVersion`, read from `package.json` at build time). So the release commit has no `[skip ci]`: Netlify builds twice per release, and until the second build is live the site shows the previous version.
- **commitlint in a `commit-msg` hook** (`@commitlint/config-conventional`, 45 lockfile entries, none with install scripts). All 59 earlier commit messages pass it unchanged.
- The GitHub plugin's comments and labels on issues and pull requests are off, so the job needs only `contents: write`.

Found while building it:

- `conventional-changelog-conventionalcommits` 10.x does not work with the notes plugin semantic-release ships ("Missing helper"); 9.3.1 is the version that plugin is tested with.
- `--dry-run` skips exactly the steps that needed checking (changelog, version bump, commit). The setup was instead run for real in a scratch clone against a scratch bare repository, with the files as committed apart from the GitHub plugin: a first release (1.0.0, three files in the commit, tag on it, `develop` fast-forwarded), a run with nothing to release, and a `fix` commit giving 1.0.1.
- **A leftover `app/.output` breaks the local `pwa` e2e project.** If `app/.output/public` exists from an earlier `nuxt generate` without the Netlify preset, a later `netlify serve` build takes the old HTML from there for every route that folder has, instead of rendering it; the pages then point at script files that no longer exist, and the four `pwa.e2e.ts` tests fail on "Sign in to Klankern". Deleting `app/.output` fixes it: the leftover found here was deleted on 2026-10-10, and the four tests pass again. Not caused by the release work, and CI and Netlify build from a fresh checkout. Why the prerender step reads that folder was not traced in Nitro's source then, so the folder could come back with the next local `nuxt generate`. Traced and fixed on 2026-10-11, see "The `pwa` e2e project and a leftover `.output`".

Tests: `app-version.e2e.ts` (the footer shows the version from `package.json`; written first and seen to fail), and the `a11y` and `pwa` specs pass with the change.

**First real run, 2026-10-10: v1.0.0.** `develop` and `main` were pushed together, and the "Release" workflow passed on its first run, in 26 seconds:

- The release commit `chore(release): 1.0.0` is on `main` with exactly `CHANGELOG.md`, `app/package.json` and `app/package-lock.json` in it, and the tag `v1.0.0` is on that commit.
- `CHANGELOG.md` has 21 entries (the 20 earlier `feat` and `fix` commits and the footer version), and the GitHub release is published.
- `develop` was fast-forwarded to the release commit, and no workflow run started for it.
- The CI runs for the pushed commit passed on both branches, the new `app-version.e2e.ts` included.

**Four more releases on 2026-10-11: v1.1.0, v1.2.0, v1.3.0 and v1.3.1.** Each was a push of `develop` and `main` together, and the "Release" workflow passed every time, as did CI on both branches.

- 1.1.0: the member avatars, the header with the account menu and the hover-contrast fix. 1.2.0: the theme. 1.3.0: the shipped fonts. 1.3.1: their revert.
- **v1.4.0, the same day**: milestone 10 and the fix for the lists created twice, again as one push of `develop` and `main`, with the workflow and CI on both branches passing. The fix has a commit of its own (`fix(lists): …`) so that the changelog lists it; its unique constraints are in the feature commit's migration, which is why the feature commit comes first.
- **Netlify's deploys can be read without the dashboard**: logged in, `npx netlify api listSiteDeploys --data '{"site_id":"<id>","per_page":2}'` lists them with their commit and state (`npx netlify sites:list --json` has the id), and the folder doesn't have to be linked. For v1.4.0 the release commit's deploy was `ready`, and the deployed page carried `appVersion:"1.4.0"`.
- **A revert releases a patch**, by the commit analyzer's default rules (`.releaserc.yaml` sets none of its own). The rule goes by what the parser recognises as a revert, not by the commit type: the message has to start with `revert:` or `Revert` and keep git's line "This reverts commit <hash>.", as the 1.3.1 commit did. A hand-written `revert: …` without that line releases nothing.
- Each release commit holds exactly `app/CHANGELOG.md`, `app/package.json` and `app/package-lock.json`, so the changelog's new place works (see "Changelog moved into `app/`").
- `develop` was fast-forwarded to the release commit every time.

**Netlify builds the release commit** (checked by the user on the deployed site, 2026-10-11): the footer reads `Version 1.3.1`, the version that only the release commit carries. Netlify reports nothing back to GitHub, so the footer is the place to see it.

Still open: the fast-forward step's failure paths (`develop` moved on, or workflow changes on `main` that `develop` lacks) have not happened yet.

## Member avatars from Gravatar (built 2026-10-10)

Every user has an avatar: the signed-in user's in the header (since 2026-10-11 as the account button), and one for each member of the household in a row on the dashboard (`MemberRoster`), under the household's name. The picture is the person's Gravatar; whoever has none gets a drawing the app makes itself.

Decided with the user:

- **Header and member row only.** No avatars on list items or strokes ("added by").
- **Members of a household can read each other's email address.** It is the avatar's accessible name and tooltip. The caption under an avatar is the part before the `@` (`utils/email.ts`), because the app has no display names.
- **The app draws the fallback itself**, rather than using one of Gravatar's generated defaults: it works offline and in tests and adds no further third-party content.
- **The header kept the email text and the "Sign out" button**, so the e2e sign-in helper was unchanged. No longer so since 2026-10-11 (see "Header: wordmark and account menu").

**How an avatar is made** (`components/user/UserAvatar.vue`)

- `utils/gravatar.ts`: the hash is SHA-256 of the trimmed, lower-cased address (Web Crypto, no dependency), and the picture is `https://gravatar.com/avatar/<hash>?s=<px>&d=404`. `d=404` makes Gravatar answer 404 for a person without a picture, which the `<img>` reports as an error.
- `composables/use-gravatar-hash.ts` turns the asynchronous hash into a ref and drops a hash that arrives after the address has changed.
- **The drawing is a "pen rosette"** (`utils/avatar-rosette.ts`): a looped, spirograph-like figure as one closed whiteboard stroke (a `StrokeShape`, rendered by `WhiteboardStroke`) on a disc tinted with the ink. Five bytes of the hash pick the ink (8), the lobes (3 to 6), whether the loops point outward or inward, their depth (3 levels) and the rotation (2), which makes 384 pictures.
- The inks are a list of their own, not `PEN_COLORS`: the ink is picked by its place in the list, so a new whiteboard pen would otherwise change everyone's picture.
- The rosette shows as soon as the hash is known. The Gravatar `<img>` lies over it and is empty while it loads. On `load` the rosette is removed (a Gravatar may be transparent); on `error` (404 or offline) the image is. Until the hash is there, the avatar is a grey disc.
- The image is `loading="lazy"`, so a slow gravatar.com can't hold up the page's `load` event, and `referrerpolicy="no-referrer"`.
- With a `label` the avatar is `role="img"` with that name and `title`. Without one it is `aria-hidden`: the header, where the account button around it carries the name.

**The header on a narrow phone** (user decision; replaced on 2026-10-11, see "Header: wordmark and account menu"): the email gives way. The title keeps at least its own width, the email is cut with an ellipsis, "Sign out" doesn't wrap, and an avatar never shrinks (`flex-shrink: 0` in `UserAvatar`).

- Before, the title was the only part of the header that could shrink. With the avatar added it was squeezed to one letter at 360 px, and a long address wrapped onto three lines.
- Looked at in screenshots at 360, 412 and 1280 px: about 70 px (at 360) and 122 px (at 412) remain for the address, and nothing changes on a wide screen. No automated check.
- Not looked at: a 360 px header that also shows the "Install app" button.

**What leaves the app**: every avatar is a request to gravatar.com, which gets the viewer's IP address and the hash of the pictured person's email address. There is no server to proxy it through. Accepted by the user.

**Schema** (`0013_list_household_members.sql`, applied to the cloud project with `db push`, with the user's go-ahead)

- `list_household_members(p_household_id)` returns `user_id`, `email` and `joined_at` of a household's members, oldest membership first. SECURITY DEFINER with `search_path = ''`, because it reads `auth.users`. It checks `is_household_member` itself; a caller who is not a member gets no rows. `EXECUTE` is revoked from `public` and `anon`.
- No view over `auth.users`, no profile table, no trigger on `auth.users`.
- Checked before applying: the migration role (`postgres`) can read `auth.users` (`has_table_privilege`). Postgres checks a SQL function's privileges only when it is called, so a role without that privilege would have created a function that fails on first use.

**Code**

- `fetchHouseholdMembers` (`household-actions.ts`); `members`, `membersError` and `fetchMembers()` in `stores/household.ts`.
- `fetchMembers` keeps its result only if the household is still the one it asked for. A fetch that ends after a user switch would otherwise show the previous household's addresses to the next user.
- `pages/index.vue` fetches the members when the household's id appears or changes; `MemberRoster` only renders. A fetch in the roster's own `onMounted` would run twice on every revisit, because `fetchMine()` swaps the whole card for the spinner and back.
- The full address is deliberately not in the roster's text: `getByText(user.email)` in the `auth`, `household` and `session-switch` specs would match twice.

**Tests**

- Unit: `gravatar.spec.ts` (Gravatar's documented example hash), `avatar-rosette.spec.ts` (each of the 384 variants stays inside the disc, is closed and differs from the others), `email.spec.ts`, `use-gravatar-hash.spec.ts`, and `fetchHouseholdMembers` in `household-actions.spec.ts`.
- RLS: a member gets their household's addresses and none of another household's; a member of another household gets no rows; a signed-out client (`signedOut` in `supabase-fixtures.ts`) can't call the function.
- E2E: `avatars.e2e.ts` answers `**/gravatar.com/avatar/**` itself, so it doesn't depend on Gravatar. With a 404, everyone has the drawing and the requests carry the SHA-256 of the address; with a picture for one member, that member shows the photo.
- `session-switch` checks that none of the previous user's members are left, `household` that a newly created household shows its member, and `a11y` scans the dashboard with the roster.
- Seen to fail with the feature broken: the avatar spec with a wrong hash, without the `error` handler and without the `load` handler, and the `household` check with the members not fetched when the household appears. The roster checks added to `session-switch` and `a11y` were not broken on purpose.
- The other specs make real requests to gravatar.com for their disposable addresses, which answer 404. Nothing waits for them.

**Not included**

- A member who joins while someone else has the dashboard open appears there on that person's next visit to the dashboard: `household_members` is not in the Realtime publication.
- Display names, uploading a picture, a way to opt out of Gravatar.

**Looked at, and not yet**: the rosettes were judged on a contact sheet of all shapes at 32, 48 and 96 px, and the header and the dashboard in screenshots from the e2e run (a stand-in picture for the Gravatar). A real Gravatar photo had not been seen in the app then; the user checked one on 2026-10-11, signed in with an address that has a Gravatar.

**Found on the way**

- **A long-running `nuxt dev` keeps showing the old version in the footer**, and `app-version.e2e.ts` then fails locally. The version is read from `package.json` when the process starts. A dev server started before a release was pulled still served `0.0.0` after `package.json` said `1.0.0`, and the reload Nuxt does by itself after a change to `nuxt.config.ts` did not re-read it. Stop and start `npm run dev`. CI starts a fresh server, and the production build from the same run had `1.0.0`.
- The member row made the dashboard card taller, which uncovered the contrast problem in the next section.

## Hover and focus contrast on the primary color (fixed 2026-10-11)

The `a11y` scan of the dashboard failed with `color-contrast` on the "To-dos" button once the member row was there. The taller card had moved that button under the spot where the pointer rests after the click on "Verify", so the scan saw it hovered.

- **Cause**: Quasar shows hover and keyboard focus with a veil in the control's text color, laid over the control (`.q-focus-helper`; 15 % for hover, 22 % for keyboard focus). White text on the primary color is 4.6:1 at rest (axe's figure). The white veil lightens the background and takes the text below 4.5:1.
- It affected every filled primary button and the flat buttons in the header, and had been there from the start. The scan had only never happened to hover one.
- **Fix** (user decision, over scanning pages only at rest): `assets/css/hover-contrast.css`, the app's first global stylesheet (`css` in `nuxt.config.ts`). It makes the veil black for a control that is `bg-primary` itself or sits on a `bg-primary` surface, so hover and focus darken these controls instead of lightening them.
- **Tests** (`a11y.e2e.ts`): axe scans the dashboard with a filled button hovered and with one focused by keyboard, each after the highlight has faded in (`untilHighlightShown` waits for the control's transitions).
- **axe can't judge anything in the header.** The elevated header's shadow layer (`.q-layout__shadow`) lies over it, so axe reports the background as undetermined ("incomplete"), which the spec doesn't count. For a header button the spec therefore checks that its highlight is the dark one. The header's email text and buttons at rest have the same colors as a filled button.
- All three checks were seen to fail before the fix, and pass with it.
- **Noticed, not changed**: "Cancel" in the whiteboard's "Clear" dialog is primary-colored text on white. Its veil is primary-colored and darkens the white behind it. By calculation, not measured, the hovered text is at about 3.8:1. The black veil doesn't apply there. Fixed with the theme (see "Theme: Catppuccin Latte and Mocha"): "Cancel" is no longer primary-colored.

## Formatting and markup rules, and the mobile viewport (2026-10-11)

The tooling now holds the formatting, the spelling of component tags and the screen the e2e tests run at. `CLAUDE.md` ("Conventions and gotchas") records them, together with two rules that no tool checks: build mobile-first, and favor progressive enhancement.

- **Prettier runs with its defaults** (80 columns, semicolons, double quotes); `.prettierrc.json` is empty.
- **Components are kebab-case in markup** (`<nuxt-link>`, `<q-btn>`, `<invite-dialog>`): ESLint's `vue/component-name-in-template-casing`, also for components it can't see registered. File names stay PascalCase.
- **The Playwright `dev` project runs at 375x667**, an iPhone SE, the reference screen for the mobile-first rule. The `pwa` project keeps Playwright's default viewport.
- The whole code base was reformatted once under the new rules (`prettier --write .` and `eslint --fix`, 97 files, no change in behaviour), in a commit of its own.

## Changelog moved into `app/` (2026-10-11)

On the user's request `CHANGELOG.md` moved from the git root to `app/CHANGELOG.md`: `changelogFile` and the git plugin's `assets` in `.releaserc.yaml` point there, and `app/.prettierignore` lists the file, because Prettier rejects the generated format and `format:check` would fail on every release commit. `--dry-run` doesn't write the changelog, so the first real run of this path was the next release, 1.1.0, the same day: it and the three releases after it wrote `app/CHANGELOG.md` and committed it with the version bump.

## Header: wordmark and account menu (built 2026-10-11)

The header had become too full for a phone: title, "Install app", avatar, email and "Sign out" in one row, with the email cut to a few letters. It now holds the app's name on the left and one or two round buttons on the right. This replaces "The header on a narrow phone" in the avatar section and the header description under milestone 4.

Decided with the user:

- **The app's name is the `<h1>` of every page** and links to the dashboard. The page titles (To-dos, Shopping, Whiteboard) and the card titles (sign in, join, set up a household, the household's name) are `<h2>`. The invite dialog's title is still a `<div>`.
- **The avatar is in the account button** and so is always on screen. Its menu (`components/user/AccountMenu.vue`) shows the whole email address, "Invite a family member" and "Sign out".
- **"Invite a family member" moved from the dashboard into that menu.** It is only there while the household store holds a household.
- **"Install app" is an icon-only button** with that `aria-label` and a tooltip. It stays in the header because the offer also comes on the login page, where there is no account menu. "Log in" keeps its label.

How it is built:

- **The wordmark** is Roboto 700 with a hand-drawn pen stroke under it, an inline SVG that is hidden from assistive technology, so the link's name stays "Klankern". No new font or dependency. Hover and keyboard focus thicken the stroke; focus also draws a white outline. Quasar styles a bare `h1` at 6rem, so the layout's scoped style resets it.
- **The account button's name is "Account, <email>"**, and the avatar inside has no label. The e2e helpers find the signed-in user by that name (`accountButton` in `tests/support/e2e-ui.ts`), since the address is no longer text in the header.
- **The menu is `role="group"`, and its entries are real buttons.** `role="menu"` allows only menu items, and the address is none; a clickable `q-item` is a list item with no role that says it can be pressed.
- **`InviteDialog` no longer has its own button.** It is a dialog with a `v-model`, rendered beside the menu, and asks for a code each time it opens. Inside the menu it would be removed together with the menu's content.
- **Closing the invite dialog puts the keyboard focus on the account button.** The menu entry that opened the dialog is gone by then, and the focus was left on `<body>`. `a11y.e2e.ts` checks it.
- Signing out stays in the layout, which holds the Supabase client; the menu emits `signOut`.
- The wordmark link and the header buttons are 44px high.

**The account button as a pill, and stronger highlights** (same day, user decision): the bare avatar didn't look like a button, and the hover was hard to see, because the avatar hid most of Quasar's veil.

- The button is a pill on a slightly darker blue (15% black) with the avatar and a chevron. While the menu is open the pill is darker (40%) and the chevron points up. A tooltip says "Account".
- Hover and keyboard focus put a white ring around the avatar; focus also draws a white outline around the pill.
- **Every highlight in the header is a 30% veil** instead of Quasar's 15 to 22% (`.app-header` in `layouts/default.vue`). It is still black, so the contrast only rises. This holds for "Install app" and "Log in" too.
- The wordmark gets the same 30% behind it on hover and focus, and its pen stroke thickens from 2 to 4.5px.
- Hover rules are inside `@media (any-hover: hover)`, as Quasar's are, so a hover doesn't stick after a tap on a phone.
- `a11y.e2e.ts` checks the veil's 30% on the account button. Seen in screenshots at 375px: at rest, hovered, open and the wordmark hovered. The keyboard focus outline of the pill has not been looked at.

Tests:

- `signOut` and the invite steps open the account menu first (`openAccountMenu`). `a11y.e2e.ts` scans the open menu, and checks the dark hover highlight on the account button instead of on "Sign out".
- **A scan right after the menu opens fails on contrast**: the menu fades in, and axe measures the half-transparent text. The same happens to the invite dialog's scan while the menu fades out. `untilFadesEnd` in `a11y.e2e.ts` waits for the page's animations.
- axe still can't judge the header itself (see the previous section), so the wordmark's contrast is not scanned. It is white on the primary color, like the header's text before.

## Theme: Catppuccin Latte and Mocha (built 2026-10-11)

The app had Quasar's default blue, light mode only, and colors written out in about ten places. It now has one palette per mode: **Catppuccin Latte** in light mode and **Catppuccin Mocha** in dark mode, with mauve as the primary color.

Decided with the user: the device's setting alone picks the mode (no switch in the app); mauve rather than blue; the whiteboard and the avatars follow the theme instead of staying white paper.

- **`assets/css/theme.css`** imports the colors from `@catppuccin/palette` and names them by role: `--theme-page`, `--theme-surface`, `--theme-text`, `--theme-text-muted`, `--theme-outline`, `--theme-placeholder`, `--theme-on-accent`, `--theme-veil`, Quasar's brand variables (`--q-primary` …) and the inks (`--ink-*`). Every token is one declaration, `light-dark(<Latte>, <Mocha>)`.
- **`light-dark()` with `color-scheme: light dark` on the root, not `body.body--dark`**: the tokens hold before the app has started, so a dark device doesn't show a white page first. Quasar's `dark: 'auto'` (`nuxt.config.ts`) reads the same setting, so its dark components and the tokens agree. An in-app switch needs a rule in the stylesheet that sets `color-scheme` for a class or attribute of the root element, and Quasar's `Dark` set to match. Setting `color-scheme` from a script alone would work in `nuxt dev` and not in production, where the build's fallback only switches inside rules it compiled.
- **`light-dark()`** is a user decision, over a `prefers-color-scheme` media block, which the first version had. It needs Chrome 123, Firefox 120 or Safari 17.5, but **the production build doesn't ask for it**: Vite's CSS minifier (Lightning CSS) rewrites every `light-dark(a, b)` into `var(--lightningcss-light, a) var(--lightningcss-dark, b)` and adds a `prefers-color-scheme` rule that switches the two. Seen in `dist/_nuxt/entry.*.css`, and the static build was looked at in both modes. Only `nuxt dev` and `public/offline.html`, which no build step touches, need a browser that knows the function; in an older one the offline page falls back to the browser's own light or dark colors.
- **`light-dark()` takes colors only.** A number that differs by mode (the veil's strength) can't be a token of its own without a media query, so it is the alpha of the veil's color.
- **Only what Quasar writes as plain black or white is replaced**: text, the surface of cards and menus, the tooltip, the text on filled controls. Its translucent greys (field labels, borders, separators) stay; they take on the surface beneath them in either mode.
- **Light surfaces are the page's color.** Latte has nothing lighter than its base, and mauve text on mantle is 4.45:1, so a card stands out by its shadow. In Mocha a card is `surface0`, lighter than the page, because a shadow can't be seen there.
- **Text on an accent is `--theme-on-accent`** (the flavor's base), not white: white on a Mocha accent is about 2:1. Quasar puts `text-white` on every filled control; `theme.css` overrides it for `bg-primary` and `bg-negative`, and the header, the footer, a checkbox's check mark and the update notice get the same color.
- **The veil of `hover-contrast.css` is the theme's**: black in Latte, white in Mocha, so hover and focus always move an accent away from the text on it. The header's veils (`default.vue`, `AccountMenu.vue`) use it too.
- **The veils are stronger than Quasar's, and as strong for hover as for focus** (user: "hover colours are too subtle, especially in dark mode"). "Step" below is the contrast between a control's resting and its hovered background.
  - **On an accent color** (`--theme-veil`; filled buttons, everything in the header): black at 30% in Latte, white at 65% in Mocha. Quasar's 15% gave a step of 1.28 in Latte and 1.12 in Mocha, where white over a pale accent hardly shows; now 1.65 and 1.61. The text on the hovered button is at 7.90 and 13.00. A black veil would show more in Mocha per percent (22%: step 1.62), but takes the text on a red button to 4.43, and moves towards the text.
  - **On the page or a surface** (`--theme-veil-on-surface`; flat buttons without a color of their own: the account menu's entries, "Undo", "Clear board", "Remove"): the text's color at 25% in Latte and 18% in Mocha. Quasar's 15% gave 1.25 and 1.46; now 1.47 and 1.58. This veil moves towards the text, so it is as strong as the text allows: 4.81 in Latte, 5.52 in Mocha on a card.
  - `hover-contrast.css` shows both veils at opacity 1 and hides Quasar's two overlays on them. The header's own 30% rule in `default.vue` is gone, and the account button's pill is half the veil at rest and the whole veil while the menu is open.
  - **No flat button has a color of its own any more.** "Cancel" in the "Clear" dialog was the only one, mauve because Quasar's dialog plugin gives its buttons the dialog's color (primary, or amber in dark mode). Mauve text on a surface is at 4.79 in Latte and takes no darkening at all: 3.87 hovered and 3.49 focused with Quasar's veil. It is now a plain flat button in the text's color (`cancel: { …, color: undefined }` in `SharedWhiteboard.vue`), like "Close" in the invite dialog: 7.06 at rest and 4.81 highlighted in Latte, 8.69 and 5.52 in Mocha.
- **Contrast figures** (calculated with the WCAG formula from the package's values): Latte base on mauve 4.79, mauve on base 4.79, text on base 7.06, subtext1 on base 5.53, red on base 4.80; Mocha base on mauve 8.07, text on base 11.34, subtext0 on base 7.37. Latte's subtext0 on base (4.37) and blue on base (4.34) fail, which is why muted text is subtext1 and the primary color is not blue.
- **Inks** (`utils/ink.ts`): a stroke keeps the `#rrggbb` it is stored with, as an attribute, and a style on top draws it in `--ink-<name>`. `PEN_COLORS` and `AVATAR_INKS` take their values from `INK_VALUES`; the order of `AVATAR_INKS` is unchanged, so nobody's rosette changed its shape or ink. A stored color that is none of the inks (the database accepts any) is drawn as stored.
- `theme-color` is two meta tags with `media`. They have no `key`: with one, Nuxt's head manager doesn't recognise the tags of the generated page and adds them a second time. The manifest holds one `theme_color` and one `background_color`; they are Latte's.
- `public/offline.html` has the six values it needs written out, since it has to work without the app's stylesheet. It is now page-colored with a mauve heading.
- **The app icons are the K on Latte mauve** (`public/pwa-*.png`), regenerated with `node scripts/generate-pwa-icons.mjs` from `app/`. The script takes both colors from `@catppuccin/palette`; the glyph is unchanged. It now writes `favicon.ico` too (32px, a PNG inside the `.ico`), which had been Nuxt's default green logo until then (approved by the user). An icon file holds one set of colors, so the icons are Latte's in dark mode as well.

Tests:

- `a11y.e2e.ts` runs every scan in light and in dark mode (`test.use({ colorScheme })`) and checks the body's mode class first, so a dark scan can't pass on the light palette. The veil it expects on a header button is the mode's, with its strength. It also scans the "Clear" dialog at rest and with "Cancel" focused and hovered; verified to fail in both modes with the mauve "Cancel".
- `ink.spec.ts` checks `inkPaint` and that `theme.css` gives every ink an `--ink-*` color that is a `light-dark()` of a Latte and a Mocha color, and a `text-ink-*` name for every pen.
- Looked at in screenshots at 375px in both modes: login, dashboard with a hovered button, the account menu, a to-do list, the whiteboard with all four pens, the "Clear" dialog with "Cancel" at rest and hovered, the offline page.

Noticed, not changed:

- **The pen named "Black" draws in a light color in dark mode.** Accepted (user decision); the name stays.
- Latte's green on the board is 2.96:1, its blue 4.34:1. Fine for a drawing, but below what text would need.
- Only primary and negative carry text. `--q-secondary`, `--q-accent`, `--q-positive`, `--q-info` and `--q-warning` are mapped to Catppuccin colors but unused; a filled control in one of them needs its contrast calculated first.
- Not looked at: the update notice, tooltips, the join page and the keyboard focus outlines in dark mode, and either mode on a real phone.

## Fonts: two replacements tried, Roboto stays (2026-10-11)

The font is Roboto again, shipped by Quasar (`quasar.extras.font: 'roboto-font'`), as before. Two replacements were built and dropped the same day, both on the user's decision after seeing them:

- **Stacks of the device's own fonts** (modernfontstacks.com: Slab Serif, Geometric Humanist, Monospace Slab Serif), with no font shipped. They come out as a different font on each system, which can't be checked without owning each, and the result looked cheap and unmatched. Never committed.
- **Bitter, Nunito Sans and JetBrains Mono from the `@fontsource` packages**, shipped with the app so that every device shows the same page. Released as 1.3.0 and reverted in the next release.

Kept from it: `vite.build.assetsInlineLimit` in `nuxt.config.ts`, which stops Vite from writing a font file under 4 KB into the stylesheet. With Roboto it changes nothing yet (its smallest file is just above that), so it only guards a later change of fonts.

Worth knowing for a next attempt: a `@fontsource` weight is one file per script with its own `unicode-range`, so only the Latin file is fetched; `public/offline.html` is not built and can't name the build's hashed font files, so it needs copies at fixed addresses, precached by the service worker; and none of these fonts has emoji, which stay the device's own.

## The `pwa` e2e project and a leftover `.output` (fixed 2026-10-11)

The `pwa` project had failed twice on a blank page (see "Found on the way" under "Milestone 9" and "Found while building it" under "Releases"). The cause is now traced in Nitro (2.13.4) and removed in `nuxt.config.ts`.

**Cause.** The Netlify preset (`netlify-static`) sets both of Nitro's output directories to `dist`, and Nitro empties only those before a build, so `.output` is left alone. The prerenderer is a second Nitro instance with the preset `nitro-prerender`, created from the config without the Netlify preset: its `output.publicDir` is the default, `.output/public`, and Nitro afterwards points only its `output.dir` at the main build's. That preset has `serveStatic: true`, so its static handler comes first and answers `/login` with an existing `.output/public/login/index.html`. The route is never rendered, and the old page is written into `dist`. With the plain `static` preset both instances use `.output/public`, which is emptied first, so `nuxt generate` on its own is fine; so are CI and Netlify, which build from a fresh checkout.

**It does not always fail.** This time the leftover came from a `nuxt generate` of the same source. The old pages named script files that the new build wrote as well, so all four tests passed, on pages that carried the old build id and the version before the last release. The tests fail only once the hashed name of a script has changed, which is why it looked random.

**Changes.**

- `nuxt.config.ts` gives the prerenderer the build's own public directory: a `nitro:init` hook registers Nitro's `prerender:config` hook and sets `output.publicDir` to the main instance's. With the Netlify preset that is `dist`, which every build empties before it prerenders, as it does `.output/public` with the `static` preset.
- `pwa.e2e.ts` has a fifth test: the build id in the served page is the one in `/_nuxt/builds/latest.json`.
- The `pwa` web server command writes a leftover login page into `.output/public` before `netlify serve` (`playwright.config.ts`), so that test exercises the hook on every run, in CI too. A first version of the command deleted `.output` instead; that hid the problem from the test and removed a local `nuxt build` with every e2e run.

Written test first. With the leftover planted and no hook, the build shipped the planted file as `dist/login/index.html` and the test failed; with the hook all five pass and the leftover is still in place. Also checked by hand, comparing whole builds apart from the build id and timestamps: a Netlify build without any `.output`, as on Netlify, has the same files with the same contents with and without the hook, so what gets deployed is unchanged, and the same again as a build with the leftover present. A plain `nuxt generate` still renders its nine pages, with matching build ids.

Worth knowing: the hook relies on how Nitro builds its prerenderer, which no documentation promises. If the fifth test fails after an upgrade, read `prerender()` in Nitro's source again.

## Milestone 10: Shared recipes (built 2026-10-11)

The household's recipes at `ROUTES.recipes` ("Recipes" button on the dashboard): a list sorted by title, a page per recipe, a form to write and edit one, and removal after a confirmation. A recipe has a title, optional servings, a list of ingredients and instructions. Decided with the user, and beyond the plan's "CRUD UI, no Realtime strictly needed": structured ingredients, live sync, a page of its own per recipe, and a button that puts a recipe's ingredients on the shopping list.

**Schema** (`0014_recipes.sql`, applied to the cloud project with `supabase db push`)

- `recipes` hangs on `household_id` directly. There is no container table like `todo_lists` or `boards`, so nothing has to be found or created on a first visit.
- `ingredients` is one jsonb column, an array of `{ id, name, quantity }` in the order entered, so a recipe is one row to sync. `quantity` is free text or null, like a shopping item's. The `id` is a UUID the client generates; it keys the row in the form and in the pick list.
- `servings` is free text; nothing is calculated from it. There is no `updated_at`, because no trigger would maintain it.
- Check constraints limit the title to 200 characters, the servings to 50, the instructions to 20,000 and the ingredients to 100, each with a name of at most 200 and a quantity of at most 50, and reject an ingredient with a missing, mistyped or unknown field. RLS can't limit how large a row a member inserts, and every recipe travels whole in a Realtime payload. The same numbers are `RECIPE_LIMITS` in `utils/recipe-draft.ts`.
- **The ingredient check is two jsonpath tests, for a reason.** A jsonpath filter unwraps an array before it looks at it, so `[[{…}]]` passed as the object inside; the elements' types are tested separately (`$[*].type() ? (@ != "object")`). And a comparison with a missing key or a value of another type is "unknown", not true, so existence and type are tested before the text.
- Policies are the uniform `is_household_member(household_id)` ones. `authenticated` gets `select, insert, update` and no `delete`, as for strokes. `recipes` is in the `supabase_realtime` publication.
- **The same migration allows only one to-do list and one shopping list per household** (`unique (household_id)` on both, as `boards` has). `fetchOrCreateTodoList` and `fetchOrCreateShoppingList` now insert with the conflict ignored and read the list back, like `fetchOrCreateBoard`. This closes the race noted under "Milestone 9", which mattered more now that a recipe page is a second place that creates the shopping list. No household had two lists when it was applied.

**Code**, in the usual layers

- `composables/recipe-actions.ts`: `fetchRecipes` (pages of 500 cut by id, like the strokes), `fetchRecipe`, `insertRecipe`, `updateRecipeRemote`, `softDeleteRecipeRemote`.
- `stores/recipes.ts`, parallel to the other three (`pendingIds`, `resync()`, `changesDuringFetch`, `realtimeEventOrder`), with the differences below.
- `utils/recipe-state.ts` holds only what differs from a list item (the Realtime reducer, applying and taking back an edit, the order); the store uses `upsertListItem`, `softDeleteListItem` and `mergeListResync` from `utils/list-state.ts`.
- `utils/recipe-draft.ts`: what the form edits, what it saves as (text trimmed, empty optional fields as null, ingredient rows without a name dropped) and which fields an edit changed.
- `subscribeToHouseholdChanges` has INSERT + UPDATE listeners for `recipes` (`onRecipeChange`); `useHouseholdRealtime` resyncs the recipes on every `SUBSCRIBED`; `useResetStoresOnUserChange` resets their store.
- Components: `RecipeList`, `RecipeView` with `RecipeIngredients`, and `RecipeEditor` with `RecipeForm`. The first, second and fourth talk to the stores; the other two only render and emit.

**Where the recipe store differs from the list stores**

- **`load()` instead of `init()`.** Four pages show recipes, and members move between them all the time. Only the first `load()` fetches behind a spinner; later ones call `resync()`, which merges. Replacing state on every page, as `init()` does, would drop a write that is still on its way.
- **Events and resync wait for `householdId`**, which is set once the recipes are loaded. It stands in for a list's id.
- **A new recipe is not optimistic.** The form waits for the insert, so a failed save leaves the member on the form with what they typed. The id is still generated by the client, so the Realtime echo upserts. Because a recipe is in state only once it is saved, the store needs no `inserts-in-flight`.
- **Edits are new in this app.** `update()` is optimistic and sends only the fields the member changed, compared with the recipe as it was when the form opened. Two members editing different fields don't overwrite each other. The ingredients are one column, so there the later save wins. A refused edit takes back only its own fields (`revertRecipeEdit`).
- **An edit of a removed recipe is an error.** The update excludes deleted rows and asks for the updated ids back; none means nothing was saved ("This recipe was removed in the meantime.").

**Behaviour worth knowing**

- **Realtime leaves `instructions` and `ingredients` out of an UPDATE that didn't change them**, once they are large enough to be stored out of line (TOAST, as with a stroke's `points`). Here that is any update, a rename as much as a removal. `applyRecipeRealtimeEvent` lays the event over the local row.
- **Part of a recipe that isn't in state can't be laid over anything.** If it is a removal, it is kept as a tombstone without content. If the recipe is live, the store fetches the row (`fetchUnknown`). This happens when a recipe's UPDATE arrives before its INSERT: `realtime-event-order.ts` then drops the INSERT as the older event, so without the fetch the recipe would be missing until the next resync.
- **The edit form works on a copy.** A change by another member doesn't replace what is being typed. If another member removes the recipe meanwhile, the form closes with a notice and shows the list.
- **A recipe that doesn't exist, was removed or belongs to another household is "not found"**: RLS returns no row for the last case.
- **The ingredients are a pick list for the shopping list.** They are checkboxes, all ticked; "Add to shopping list" adds the ticked ones as shopping items (name as title, quantity as quantity) and reports how many. An ingredient that is on the list already is added again; quantities are free text and can't be summed.
- **Adding goes through the shopping store's existing `add()`, once per ingredient** (`addAll`), not a batch insert. `add()` gives an item its position before it first waits, so the items are numbered one after the other even when started together. `add()` now returns whether the item was saved. `ensureLoaded()` loads the shopping list first when the member hasn't opened it in this session.
- Instructions are plain text and keep their line breaks (`white-space: pre-wrap`). There is no Markdown.
- Removed recipes stay as rows forever (soft delete); nothing purges them.
- **Accessibility**: the list is a `ul` of links (a `q-item` that is a link is no list item, so a `q-list` would hold none). In the form, the ingredients are a `fieldset`, and each row is a group named "Ingredient N" with a "Remove ingredient N" button. Adding a row puts the focus in it; removing one moves the focus to "Add ingredient".

**Not included**: photos (they would need Storage and its own policies), tags, search, scaling by servings, import from a URL, a source link, and reordering ingredients.

**Tests**

- Unit: `recipe-actions.spec.ts`, `recipe-state.spec.ts`, `recipe-draft.spec.ts`, the recipe listener in `household-realtime.spec.ts`, and the changed `fetchOrCreate…List` in the two list specs. `fakeClientWithQueries` (a client for an action that makes several queries) moved from the whiteboard spec into `tests/support/fake-supabase-client.ts`.
- RLS (`household-isolation.spec.ts`): another household's recipes are invisible and can't be added to, edited or removed; a recipe can't be moved to another household; signed out, the table can't be read; no hard delete; each check constraint, and a recipe of the largest allowed size; one to-do list and one shopping list per household.
- E2E (`recipes.e2e.ts`): two members. A recipe written by one appears in the other's list; the other reads it; an edit changes the page the other has open; a rename alone leaves the other the ingredients and the long instructions; a reload of the recipe's address; the ticked ingredients appear on the other's shopping list; a removal closes the form the other has open. A second test opens another household's recipe and an unknown id.
- **Verified to fail** with the recipe listener disconnected (at the first live step), and with the reducer replacing the row instead of laying the event over it (at the rename: the instructions were gone). The second shows that the rename really arrives without them on the cloud project.
- `a11y.e2e.ts` scans the empty list, the form with its error, the filled form, a recipe and the list, in both modes; `auth.e2e.ts` checks the auth guard of the four routes.
- The stores have no unit tests, like the others; what they decide is in the reducers.
- Not tested separately: a reconnect (same resync as the lists), and a failed save.
- Screenshots of the dashboard, the list, the form, a recipe and the delete dialog at 375 px were looked at in both modes.
- **Clicked through in a browser (2026-10-11)**, by the agent in the user's Chrome against `nuxt dev`, as one member, in dark mode at phone width: write a recipe with three ingredients (the form's focus order, the focus in a new row, Enter in the instructions making a new line), read it, edit the title and remove an ingredient, reload the recipe's address, put one of two ingredients on the shopping list and find it there, delete the recipe, and get "Recipe not found" at its address. The test recipe and the shopping item were removed again. The last step was pressed by script, because the browser window had gone out of view by then and clicks no longer arrived; the e2e test does it with real clicks.
- **Still not tried by hand**: on a phone by touch, with a second member watching, in light mode, and on the deployed site.

**Changed on the way**

- The dashboard's buttons are a wrapping row now (`row q-gutter-sm`): four don't fit one line on a phone.

**Noticed, not changed**

- The list stores and the whiteboard store put a row back after a failed write without checking that the store wasn't reset in between (a change of user). The recipe store checks.
- `init()` of the list stores keeps the result of a fetch that ends after a reset; `load()` of the recipe store drops it.

## Success notices readable in both modes (fixed 2026-10-11)

Found in the click-through of milestone 10: the notice "1 item added to the shopping list" was hard to read in dark mode. It used Quasar's `positive` color, on which Quasar writes white. Measured with the palette's values, white on the theme's green is at 3.34:1 in light mode and at 1.49:1 in dark mode, so it failed the 4.5:1 of WCAG 1.4.3 in both. "Invite link copied" was built the same way.

- **A text color alone doesn't fix it.** The theme's text for an accent (`--theme-on-accent`) is at 11.03:1 on Mocha's green but at 2.96:1 on Latte's, and no text color of the theme reaches 4.5:1 there (the comment at the top of `theme.css` says as much for every Latte accent but mauve and red).
- **Both notices now use the primary color with `textColor: "on-accent"`**, as the update notice already did: 4.79:1 in light mode and 8.07:1 in dark mode. There is no `positive` notice left. A notice without a color (the "This recipe was removed." of the recipe form) is Quasar's dark grey with white text in both modes, at 12.82:1.
- **A notice was never scanned**: it is gone after a few seconds, and `a11y.e2e.ts` only scanned pages at rest. It now adds a recipe's ingredients to the shopping list and scans while the notice shows, in both modes. Verified to fail on the notice's text before the fix, in both modes. "Invite link copied" is not scanned (it needs the clipboard); it is the same two options.

## Next steps

Every milestone of the plan is built. The four checks that were listed here are done (the Gravatar photo, the whiteboard by hand, the update notice and the footer version on the deployed site, all 2026-10-11). The sections on the header and the theme still name a few things nobody has looked at, mostly in dark mode.

1. Try milestone 10 by hand where the click-through didn't reach: on a phone by touch, with a second member, in light mode and on the deployed site.
2. The fix of the success notices is on `develop`; it is released (as a patch) with the next push to `main`.
3. Optional, later: the Podman production setup (`Containerfile.prod`, Quadlet units, Caddy).
