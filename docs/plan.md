# Klankern — Family Organizer PWA

## Context

The repo is completely empty — this is a greenfield build. The goal is a PWA that helps a family organize shared life together, starting with **shared to-do lists** and **shared shopping lists** (MVP priority), with **shared whiteboard** and **shared cooking recipes** as explicit later phases. The schema and auth model must not preclude those later features, but we are not building them now.

Confirmed stack and decisions:
- **Frontend**: Nuxt 3 + TypeScript, SPA mode (`ssr: false`), `nuxt-quasar-ui` for Quasar components, Pinia for state, `@vite-pwa/nuxt` for the PWA/service worker.
- **Backend**: Supabase Cloud (Postgres + Auth + Realtime), via `@nuxtjs/supabase`.
- **Auth**: Email OTP (6-digit code), not magic links — magic links open the system browser instead of the installed PWA and leave it logged out.
- **Household model**: invite-link/code based, no forced email+password friction.
- **Containers**: Podman for dev and prod. Prod hosting target undecided (home server or VPS) — use a generic Podman + Caddy reverse-proxy setup that works on either.
- **App name**: Klankern.

SPA mode means the Supabase anon key/URL get baked into the client bundle at build time (acceptable — the anon key is public by design; Postgres RLS is the real security boundary). The `service_role` key must never appear in the repo, `.env`, or client code.

## 1. Project Scaffolding

```bash
npx nuxi@latest init app
cd app
npm i @pinia/nuxt pinia nuxt-quasar-ui @nuxtjs/supabase
npm i -D @vite-pwa/nuxt eslint @nuxt/eslint-config prettier eslint-config-prettier \
         vitest @vue/test-utils @nuxt/test-utils happy-dom \
         husky lint-staged
```

`nuxt.config.ts` essentials:
```ts
export default defineNuxtConfig({
  ssr: false,
  modules: ['@pinia/nuxt', 'nuxt-quasar-ui', '@vite-pwa/nuxt', '@nuxtjs/supabase'],
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/join/**', '/login', '/confirm'], // invite redemption must be reachable pre-auth
    },
  },
  quasar: { plugins: ['Notify', 'Dialog'], extras: { font: 'roboto-font', fontIcons: [] } },
})
```

Develop against a free **Supabase Cloud** project directly (matches the prod target; skip local Supabase-via-Docker entirely to avoid Podman/Docker CLI friction).

### Folder structure
```
app/
  nuxt.config.ts
  app.vue
  pages/
    login.vue
    confirm.vue
    join/[code].vue
    index.vue              # household dashboard / create-household prompt
    todos.vue
    shopping.vue
  components/
    todo/TodoList.vue
    todo/TodoItem.vue
    shopping/ShoppingList.vue
    shopping/ShoppingItem.vue
    household/InviteDialog.vue
    household/CreateHouseholdForm.vue
  composables/
    useHouseholdRealtime.ts
  stores/
    household.ts
    todos.ts
    shopping.ts
  public/
    pwa-192.png
    pwa-512.png
    pwa-512-maskable.png
    offline.html
  supabase/
    migrations/
      0001_households.sql
      0002_todo_lists.sql
      0003_shopping_lists.sql
      0004_rls_policies.sql
      0005_invite_rpc.sql
  .env.example
  Containerfile.dev
  Containerfile.prod
  podman-compose.yml
  Caddyfile
```

## 2. Data Model

Core tables: `households`, `household_members` (`household_id`, `user_id`, `role`), `household_invites` (`code`, `expires_at`, `max_uses`, `use_count`).

`todo_lists`/`todo_items` and `shopping_lists`/`shopping_items` share one shape: each item row has `household_id` (denormalized, for simple RLS + Realtime filtering), `position numeric` (fractional, for O(1) reordering instead of reindexing every row), `deleted_at` (soft delete — turns deletes into UPDATEs, which reconcile cleanly under optimistic UI + Realtime), plus `done`/`checked` and `quantity` where relevant.

**RLS pattern (applies to every table, present and future)**: a `SECURITY DEFINER` helper avoids RLS self-recursion:
```sql
create function public.is_household_member(hid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from household_members where household_id = hid and user_id = (select auth.uid()));
$$;
```
Every table's policy is `using (is_household_member(household_id)) with check (is_household_member(household_id))`. `household_invites` gets **no** `select` policy for regular users — codes must not be enumerable; all lookup happens inside the invite-redemption RPC (below).

**Future extension** (not built now): `boards`/`board_strokes` and `recipes` tables follow the exact same `household_id` + `is_household_member()` policy — zero new auth design needed later.

## 3. Auth & Household Join Flow

1. `/login`: email → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` → user enters the 6-digit code → `verifyOtp(...)`. Supabase creates the `auth.users` row automatically on first verification.
2. No household yet → dashboard shows `CreateHouseholdForm`: insert into `households`, then insert the caller's own `household_members` row as `role = 'owner'`.
3. Owner opens `InviteDialog` → inserts a `household_invites` row → UI shows `https://<app>/join/<code>` as a copyable link/code.
4. Second member: since a non-member has no RLS visibility into the target household, redemption **must** go through a `SECURITY DEFINER` RPC (`redeem_invite(p_code text)`) that validates the code (not expired, under `max_uses`), inserts the `household_members` row, and increments `use_count` — all server-side, atomically.
5. `pages/join/[code].vue` is excluded from the global auth redirect so it's reachable pre-login; after OTP login it calls `supabase.rpc('redeem_invite', { p_code: code })` and redirects to `/`.

## 4. PWA Setup

`@vite-pwa/nuxt` config: manifest with name "Klankern", theme/background colors, standalone display, a 192 icon plus **both** a flat and a `purpose: 'maskable'` 512 icon (otherwise Android letterboxes it). Workbox: `navigateFallback: '/offline.html'`, raise `maximumFileSizeToCacheInBytes` (Quasar's icon font can exceed Workbox's default 2MiB cap), and a `NetworkOnly` runtime-caching rule for all `*.supabase.co` requests — never cache authed/realtime API responses. `registerType: 'autoUpdate'` paired with a Quasar `Notify` toast on update-available rather than a silent reload, so an in-progress edit isn't lost. Custom install button via the `beforeinstallprompt` event. `localhost` is a secure context, so this all works under plain `nuxt dev` with no local TLS.

## 5. Realtime Sync

Enable replication (easy to forget, fails silently): `alter publication supabase_realtime add table public.todo_items;` (and `shopping_items`).

One Realtime channel **per household** (not per table — the server-side filter only supports one `column=eq.value`), with multiple `postgres_changes` listeners attached, routing into the relevant Pinia store's `applyRealtimeEvent`. On `SUBSCRIBED`/reconnect, refetch — `postgres_changes` has no replay, so a dropped connection needs a manual repair fetch.

Optimistic updates keyed by client-generated UUID: generate `crypto.randomUUID()` locally, push into Pinia state immediately, insert with that id — the echoed Realtime INSERT reconciles as a no-op. Toggle/delete follow the same optimistic-then-reconcile pattern (delete = soft-delete UPDATE, filtered out of the store's getter). Unsubscribe the channel on household switch/logout.

## 6. Containerization (Podman)

> **Changed 2026-10-10**: production is hosted on Netlify as static files instead (see "Milestone 8" in [`progress.md`](./progress.md)). The dev container was dropped; the production container setup below is deferred, not built.

**`Containerfile.dev`**: `node:22-slim`, `npm ci`, `CMD npx nuxi dev --host 0.0.0.0`. Run with a bind mount for source **and a separate named volume for `node_modules`** (otherwise the host mount shadows installed deps); `--userns=keep-id` and `:Z` SELinux relabeling on mounts. Set `server.watch.usePolling = true` in `nuxt.config.ts` — inotify doesn't reliably cross Podman bind mounts.

**`Containerfile.prod`**: multi-stage — build stage takes `NUXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` as build `ARG`s (baked in due to SPA mode), `npm run build`; runtime stage copies `.output` and runs `node .output/server/index.mjs`. This makes the image environment-specific (one build per Supabase project) — acceptable since the anon key is public-by-design.

**Dev orchestration**: `podman-compose.yml` wiring the app service with the bind + named-volume pattern above.

**Prod orchestration**: Podman **Quadlet** `.container` systemd units (not compose) for proper restart/boot-ordering/journald integration — one unit for the app, one for a `caddy:2-alpine` reverse proxy handling automatic Let's Encrypt TLS. Identical Caddyfile works whether the eventual host is a home server or a VPS, which keeps the undecided hosting target open.

## 7. Testing Strategy & Git Hooks

**Development is test-driven**: for every unit of behavior (a Pinia store action, a composable, an RLS policy, a redemption RPC), write the failing test first, then implement against it. This applies throughout the milestones in §8 — each feature milestone starts with its test(s).

**Test layers**:
- **Unit/component — Vitest + @vue/test-utils + @nuxt/test-utils**: Pinia store logic (optimistic update + realtime reconciliation, e.g. `applyRealtimeEvent` dedup-by-id, soft-delete filtering, fractional `position` math), composables (`useHouseholdRealtime` channel wiring, mocking the Supabase client), and components with meaningful logic (not pure markup). Co-locate as `*.spec.ts` next to the file under test, or under `tests/unit/`.
- **Database/RLS — scripted two-JWT checks**: a Node/Vitest script (or `pgTAP` if preferred) that authenticates as two distinct test users in two households and asserts cross-household row isolation on every table, and that `redeem_invite` rejects expired/exhausted codes. This is the test specified in milestone 2 of §8 — it must exist and pass before any UI is built on top of the schema.
- **E2E (post-MVP, optional)**: Playwright against a running dev container for the full login → create household → invite → redeem → add/check/sync flow. Not required for MVP but the structure should accommodate adding it later (`tests/e2e/`).

**Linting & formatting**: ESLint (`@nuxt/eslint-config`) + Prettier (`eslint-config-prettier` to disable stylistic rules ESLint would otherwise fight Prettier on). `npm run lint` / `npm run format` scripts in `package.json`.

**Git hooks via Husky + lint-staged**:
```bash
npx husky init
```
`.husky/pre-commit`:
```bash
npx lint-staged
```
`package.json`:
```json
"lint-staged": {
  "*.{ts,vue}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```
`.husky/pre-push`:
```bash
npm run test
```
Pre-commit only touches staged files (fast, via lint-staged) so it stays cheap on every commit; pre-push runs the full Vitest suite (including the RLS two-JWT checks against the dev Supabase project) so a broken build can't reach the remote. CI (if added later) should re-run both as a backstop, since hooks are local and bypassable with `--no-verify`.

## 8. Milestones

1. Scaffold Nuxt + Quasar + Pinia + PWA + Supabase modules; wire ESLint/Prettier, Vitest, and Husky (pre-commit lint-staged, pre-push `npm test`) **before writing any feature code**, with one trivial passing test, so the hooks are proven to fire from commit zero. Create the Supabase Cloud project; verify `nuxt dev` renders a Quasar page.
2. Write migrations 0001–0005 (tables, `is_household_member()`, RLS policies, `redeem_invite()` RPC). **Write the two-JWT RLS test first** (it will fail against no schema), then write the schema/policies until it passes — confirm user B gets zero rows from household A's `todo_items`, and that `redeem_invite` rejects expired/exhausted codes.
3. Build auth + household flow end-to-end (OTP login, create household, generate invite, redeem invite). Write composable/store tests against a mocked Supabase client first (e.g. "creating a household inserts an owner membership row"), then implement; verify manually end-to-end with two separate emails/browser profiles.
4. Shared to-do list CRUD: write Pinia store unit tests first (optimistic add assigns a client UUID and dedups against the echoed insert; soft-delete filters from the visible getter; fractional `position` midpoint math), then implement the store and UI against them. No Realtime yet.
5. Add Realtime to to-dos: test `applyRealtimeEvent` reconciliation logic in isolation (mocked channel payloads) first, then wire `useHouseholdRealtime` (publication, subscribe, reconnect-refetch); verify live sync across two sessions manually.
6. Mirror steps 4–5 for the shared shopping list, reusing the same test patterns.
7. PWA installability pass: manifest, icons (incl. maskable), Workbox caching rules, install-prompt button, Lighthouse PWA check.
8. Containerize: dev Containerfile + compose, prod Containerfile + Quadlet units behind Caddy, one real deploy with HTTPS to confirm installability end-to-end. **→ MVP complete.** *(Changed 2026-10-10: the deploy goes to Netlify; containers are deferred, see section 6.)*
9. *(Deferred)* Shared whiteboard: `boards`/`board_strokes`, same RLS pattern, canvas component, likely Realtime `broadcast` channel rather than `postgres_changes` given stroke volume. *(Changed 2026-10-10: built with one row per finished stroke over `postgres_changes` and an SVG surface instead; see `progress.md`.)*
10. *(Deferred)* Shared recipes: `recipes` table, same RLS pattern, CRUD UI, no Realtime strictly needed. *(Changed 2026-10-11: built with live sync, structured ingredients and a button that puts them on the shopping list; see `progress.md`.)*

## Verification

- After step 1: make a trivial commit and confirm pre-commit actually runs lint-staged; confirm `git push` runs the test suite and would block on a deliberately broken test.
- After step 2: the two-JWT RLS test suite passes in CI/locally (`npm test`), confirming cross-household row isolation and invite-code validation.
- After step 3: store/composable unit tests pass, plus a manual two-account walkthrough of login → create household → invite → redeem.
- After steps 4–6: unit tests for store reconciliation logic pass, plus a manual two-device/two-session test of add/check/delete/reorder syncing live.
- After step 7: Lighthouse PWA audit + actual install on at least one Android/desktop browser.
- After step 8: real HTTPS deploy, confirm install + offline fallback page work against the deployed URL, not just `localhost`.
