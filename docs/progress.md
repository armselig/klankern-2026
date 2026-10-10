# Klankern — Progress Log

Tracks what's been built against the milestones in [`plan.md`](./plan.md), session by session. Update this when picking the project back up or finishing a milestone — it's the fastest way to re-orient without re-reading the whole chat history.

**Resuming in a new session**: everything below is current as of the first Netlify deploy (2026-10-10) (`develop`). Start a fresh session by pointing it at this file — e.g. "read docs/progress.md and continue from there." No other state matters; the repo and this doc are the source of truth, not any prior chat history.

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
| 8. Deploy (Netlify; containers deferred) | 🟡 Deployed to Netlify from `main`; routing and response headers checked on the deployed URL, and login, join link, install, offline page and the Android install checked there in a browser. Only the update notice on the deployed site is still open |
| 9. Shared whiteboard (deferred phase) | ⬜ Not started |
| 10. Shared recipes (deferred phase) | ⬜ Not started |

## What's built

**Stack as scaffolded**: Nuxt **4** (not 3 — 4 is what `nuxi init` installs now; API is compatible, folder convention differs: app code lives under `app/app/`, not `app/`), SPA mode (`ssr: false`), `nuxt-quasar-ui`, `@vite-pwa/nuxt`, `@nuxtjs/supabase`, Pinia. Backend is a Supabase Cloud project.

**Project layout** (relative to `app/`, the Nuxt project root):
```
app/app/
  types/            database.types.ts (generated), household.ts, list.ts, todo.ts, shopping.ts
  composables/      current-user.ts, household-actions.ts, todo-actions.ts, shopping-actions.ts,
                    household-realtime.ts, reset-stores-on-user-change.ts (+ .spec.ts siblings),
                    use-household-realtime.ts, use-reset-stores-on-user-change.ts,
                    use-pwa-update-notice.ts
  utils/            position.ts, list-state.ts, shopping-state.ts, error-message.ts,
                    inserts-in-flight.ts, changes-during-fetch.ts, realtime-event-order.ts
                    (+ .spec.ts siblings), routes.ts
  stores/           household.ts, todos.ts, shopping.ts
  pages/            login.vue, confirm.vue, index.vue, todos.vue, shopping.vue, join/[code].vue
  components/       household/{CreateHouseholdForm,InviteDialog}.vue, todo/{TodoList,TodoItem}.vue,
                    shopping/{ShoppingList,ShoppingItem}.vue
  layouts/          default.vue
app/public/                 offline.html, icons, _redirects (Netlify fallback for client-side routes)
app/supabase/migrations/   0001_households.sql … 0011_realtime_publication.sql
app/tests/support/          supabase-fixtures.ts (disposable users/households/invites via the Admin API, shared by RLS + e2e),
                            e2e-ui.ts (sign-in and list steps through the real UI), realtime-socket.ts (cut/watch the Realtime socket, hold back frames),
                            fake-supabase-client.ts (fake query builder + client for the `*-actions.spec.ts` unit tests)
app/tests/rls/              household-isolation.spec.ts (two-JWT RLS proof against Supabase Cloud)
app/tests/e2e/              Playwright `dev` project (against `nuxt dev`): auth, household, lists, realtime-sync,
                            session-switch, a11y (*.e2e.ts); `pwa` project: pwa.e2e.ts (production build)
netlify.toml                at the git root: build settings for Netlify
```

**Design pattern used throughout**: business logic lives in plain `composables/*-actions.ts` functions that take a `SupabaseClient` as a parameter, unit-tested with a mocked client (no Nuxt runtime needed). Pinia stores are thin — they call `useSupabaseClient()`/`useSupabaseUser()` and delegate to those functions. State-transition logic that needs testing on its own (optimistic add/dedup, soft-delete, sort order) is further extracted into pure reducer functions in `utils/`. List logic that doesn't depend on the item type (dedup, soft delete, Realtime events, reconnect merge) is **generic** over `ListItem` (`types/list.ts`) in `utils/list-state.ts` and shared by every list; only the actions, store, components and list-specific ordering are per list. This is the pattern to continue for whiteboard/recipes (later phases).

**Testing**: Vitest, 93 tests passing (including the RLS suite) (`npm test`). Playwright e2e (`npm run test:e2e`, 22 tests in two projects; see the milestone 5 and 7 sections and "E2E gap review") is separate and not in the pre-push hook; CI runs it on every push to `main` and `develop` (see "CI"). Husky pre-commit (lint-staged: eslint --fix + prettier) and pre-push (full test suite) are wired and verified firing through git's actual hook dispatcher — not just callable manually. Note the project lives one directory below the git root (`app/` inside `klankern-2026/`), which needed a non-default Husky setup (`prepare` script does `cd .. && husky app/.husky`, and `core.hooksPath` points at `app/.husky/_`) since Husky's own `.git` detection assumes the package.json directory *is* the repo root.

**Database types**: generated from the live schema via `supabase gen types typescript`, saved to `app/app/types/database.types.ts`, picked up automatically by `@nuxtjs/supabase`'s default `types` path. Re-run after any migration changes:
```
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```

## Resolved: the "Supabase RLS bug" was `INSERT ... RETURNING` (2026-10-08)

The former blocker (role-scoped RLS policies apparently rejected by PostgREST) was **not** a platform bug. supabase-js `.insert().select()` sends `INSERT ... RETURNING`, and Postgres requires the returned row to pass the table's **SELECT** policies too, raising the same "new row violates row-level security policy" error when it doesn't. Creating a household (creator isn't a member yet at RETURNING time) and creating an invite (no SELECT policy by design) both hit this. Full write-up: [`supabase-support-repro.md`](./supabase-support-repro.md).

Fixed by `0007_create_household_rpc.sql` (`create_household` / `create_invite` SECURITY DEFINER RPCs; dropped the "first member claims ownership" policy) and `0008_service_role_grants.sql` (`service_role` had no table privileges, which silently broke the RLS test's admin fixtures and cleanup).

**Rule going forward**: any `.insert/.update/.upsert(...).select()` needs the resulting row to be visible under the table's SELECT policy at that moment; otherwise drop the `.select()` or use a SECURITY DEFINER RPC.

**Function privileges**: Postgres grants `EXECUTE` on every new function to `PUBLIC`, i.e. callable by signed-out clients via `/rest/v1/rpc/...`. Every new function in `public` needs `revoke execute ... from public, anon` plus an explicit `grant ... to authenticated` (see 0007, 0009). The security advisor's remaining "signed-in users can execute SECURITY DEFINER function" warnings for `create_household`, `create_invite`, `redeem_invite` and `is_household_member` are intentional: the first three are the app's RPCs, and RLS policies need `authenticated` to be able to execute `is_household_member`.

**Migrations workflow**: the Supabase MCP server (`.mcp.json`) works in fresh sessions and was used to apply 0007–0009 (`apply_migration`). It records a timestamp version, so the `supabase_migrations.schema_migrations` row was renamed to `0007`–`0009` afterwards (in its own `execute_sql` call — don't batch it with a `begin … rollback` probe, the rollback undoes it) to keep remote history matching the local `NNNN_` filenames — do the same for future migrations applied that way. In auto mode, Claude Code's permission classifier blocks that rename (`update supabase_migrations.schema_migrations ...`) when the agent does it on its own initiative, but lets it through once the user explicitly asks for it. So: ask the user, then run it, with a read-only `select version, name from supabase_migrations.schema_migrations` before and after. 0011 was renamed this way on 2026-10-08.

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

The layout header shows the signed-in user's email next to "Sign out". Signed out, it shows a "Log in" link, except on `/login` and `/join/<code>` (a detour from the join page to `/login` would drop the invite code). Tested in a browser by the user.

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
- The update notice could not be verified by hand. It is now covered by the `pwa` project instead (see "E2E gap review"), so this is resolved.
- Installing on Android needs HTTPS on a real host, so it waits for milestone 8.

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

## Milestone 8: Netlify deploy (repo side built 2026-10-10)

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

Still open:

1. The update notice on the deployed site: needs a deploy while the app is open, so check it with the next push to `main`.

## Icon strategy (2026-10-10)

Icons are SVG paths from **Material Design Icons v7** (`@quasar/extras`, now a direct dependency), imported where they are used (`import { mdiDeleteOutline } from '@quasar/extras/mdi-v7'`, `:icon="mdiDeleteOutline"`), so only the icons a screen uses are bundled. `quasar.iconSet` is `svg-mdi-v7`, which also makes the icons Quasar's own components draw (select arrows, clear buttons, …) SVG. Chosen by the user over staying with text labels, the Material Icons web font, Iconify and hand-picked SVG files; MDI over Material Icons for its larger catalogue.

- **The "no icon font" setup never worked as intended.** `nuxt-quasar-ui` adds the font of the configured `iconSet` (default `material-icons`) to `extras.fontIcons` on its own (`autoIncludeIconSet`), so `fontIcons: []` had no effect and every production build shipped the 128 KB Material Icons font unused. With an SVG `iconSet` it is gone; `fontIcons: []` was removed from the config.
- **Never use a string icon name** (`icon="delete"`): without the font it renders as literal text.
- **Existing buttons**: the per-row "Remove" button of both lists is icon-only with `aria-label="Remove"` (keeps rows narrow on phones); Add, Copy, "Invite a family member", the dashboard's To-dos/Shopping and the header's Install app/Sign out/Log in have an icon next to their label. Form submit buttons, "Use a different email" and "Close" stay text only. Accessible names are unchanged, so the e2e helpers needed no change.
- **Test**: `lists.e2e.ts` checks that the Remove button contains an `svg` and no text; verified to fail with a string icon name.
- Not auto-imported via `extras.svgIcons`: that would register about 7,400 global names.

Checked by the user in a browser (2026-10-10).

## Next steps

1. Finish milestone 8: check the update notice on the deployed site with the next push to `main` (keep the app open during the deploy).
2. Optional, later: the Podman production setup (`Containerfile.prod`, Quadlet units, Caddy).
