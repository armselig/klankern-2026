# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Klankern is a family-organizer PWA: shared to-do and shopping lists and a shared whiteboard per household, synced live. Nuxt 4 SPA (`ssr: false`) + Quasar (`nuxt-quasar-ui`) + Pinia + `@vite-pwa/nuxt`, backed by Supabase Cloud (Postgres, Auth via email OTP, Realtime) through `@nuxtjs/supabase`.

- `docs/plan.md` is the original design and milestone list.
- `docs/progress.md` is the current state, the decisions that deviate from the plan, and the bugs already found. Read it before larger work and update it when a milestone or notable fix lands.

## Layout

The git root is **not** the Nuxt project. The Nuxt project is `app/`, and its source directory is `app/app/` (Nuxt 4 convention). Run every `npm`/`npx` command from `app/`. Paths below are relative to `app/` unless they start with `docs/`.

Husky is wired for this nesting: hooks live in `app/.husky`, and the `prepare` script installs them from the git root.

## Commands

```bash
npm run dev            # nuxt dev on :3000
npm run build          # production build for a Node server (not what is deployed)
npm run generate       # static production build; this is what Netlify deploys
npm run lint           # eslint; lint:fix to autofix
npm run format:check   # prettier; format to write
npm run typecheck      # nuxt typecheck (vue-tsc)
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

- **`npm test` is not offline.** It includes `tests/rls/household-isolation.spec.ts`, which runs against the real Supabase Cloud project and needs `app/.env` with `SUPABASE_URL`, `SUPABASE_KEY` and `SUPABASE_SECRET_KEY` (see `.env.example`).
- **Git hooks**: pre-commit runs lint-staged (eslint --fix + prettier on staged files); pre-push runs `npm run typecheck` and `npm test`, so a push needs network and the secrets too. E2E is not in any hook.
- **CI** (`.github/workflows/ci.yml`) runs lint, format check, typecheck, `npm test` and `npm run test:e2e` on every push to `main` and `develop`, with the three Supabase values as repository secrets. Runs are queued one at a time for the whole repo, because they share the cloud project and its sign-in limit.
- **E2E** drives the installed Google Chrome (`channel: 'chrome'`, no Playwright browser download) against Supabase Cloud with disposable users. Two projects: `dev` (every spec except `pwa.e2e.ts`, against `nuxt dev` on :3000, reusing a running one) and `pwa` (`pwa.e2e.ts`, against a fresh static build served by `netlify serve --offline` on :3100, which applies `_redirects` but not the generated `_headers`).
- E2E sign-ins are rate limited by Supabase: more than about 30 within 5 minutes makes sign-ins time out. Keep `--repeat-each` runs below that.
- Test file naming matters: Vitest picks up `*.spec.ts`, Playwright `*.e2e.ts`.
- A Vitest file that uses the secret key must start with `// @vitest-environment node`; supabase-js refuses a secret key when it detects happy-dom's `window`.

## Architecture

### Layers

Each feature is split the same way, and new features (recipes are planned) should follow it:

1. **`composables/*-actions.ts`**: all Supabase calls, as plain functions that take a `SupabaseClient` as a parameter. No Nuxt imports, so they are unit tested with a fake client.
2. **`stores/*.ts`** (Pinia options stores): thin. They call `useSupabaseClient()`/`useSupabaseUser()`, delegate to the actions, and hold state.
3. **`utils/*.ts`**: pure reducers and helpers for state transitions that need testing on their own.
4. **Components and pages**: rendering only.

A composable with logic worth testing is split in two: a plain function in one file and a thin `use-*.ts` wrapper that supplies the Nuxt runtime (`household-realtime.ts` ← `use-household-realtime.ts`).

### Shared list logic

To-dos and shopping share one implementation of the hard part. `utils/list-state.ts` is generic over `ListItem` (`types/list.ts`: `id`, `list_id`, `position`, `deleted_at`) and holds the rules for optimistic adds, dedup, soft delete, Realtime events and resync. Only the actions, the store, the components and list-specific ordering (`utils/shopping-state.ts`: checked items sink to the bottom) exist per list. `stores/todos.ts` and `stores/shopping.ts` are deliberately parallel; a fix in one usually belongs in the other.

Whiteboard strokes (`stores/whiteboard.ts`) follow the same rules without being list items: the reducers that need only `id` and `deleted_at` are typed over `SyncedRow` (`types/synced-row.ts`) and shared, and `utils/whiteboard-state.ts` holds what differs. A fix to those rules usually belongs in all three stores.

The rules the reducers and stores encode:

- **Client-generated ids.** An add creates the row locally under `crypto.randomUUID()` and inserts it with that id, so the server-confirmed row and the Realtime echo upsert instead of duplicating.
- **Soft deletes only.** `deleted_at` is set, the row stays in state as a tombstone, and getters filter it out. Nothing may undo a local soft delete. Newer tables (0012) don't grant `delete` to `authenticated` at all.
- **`position` is a fractional numeric** for reordering without reindexing (`utils/position.ts`).
- **`household_id` is denormalized onto every item table** so RLS policies and Realtime filters need no join.

Three pieces of bookkeeping live at module level in each store, outside Pinia state, because they are not renderable state:

- `utils/inserts-in-flight.ts`: a check or remove waits for the item's insert, otherwise its UPDATE reaches the server first and matches no row.
- `utils/changes-during-fetch.ts`: ids changed while a resync fetch is in flight keep their local version, as do `pendingIds`.
- `utils/realtime-event-order.ts`: Realtime does not deliver a row's events in commit order, so an event with an older `commit_timestamp` than the newest seen for that item is dropped. There is no `updated_at` trigger; don't order by `updated_at`.

### Realtime

`subscribeToHouseholdChanges` (`composables/household-realtime.ts`) opens **one channel per household**, filtered by `household_id=eq.<id>`, and every item table adds its listeners to it. Only INSERT and UPDATE are subscribed: DELETE events can't be filtered and bypass RLS, and the app never hard-deletes. `postgres_changes` has no replay, so every `SUBSCRIBED` (first join and each rejoin) triggers `resync()` on every list store. A new table also has to be added to the `supabase_realtime` publication (see migration 0011), or events silently never arrive.

An UPDATE event leaves out a large column the update didn't change (Postgres TOAST): a stroke's `points` is missing from its soft-delete event. A reducer for a table with such a column has to lay the event over the local row instead of replacing it (`applyStrokeRealtimeEvent`).

`layouts/default.vue` mounts this once. Order matters there: `useResetStoresOnUserChange()` runs before `useHouseholdRealtime()`, so a new user never sees the previous user's household.

### Deployment

Production is Netlify, serving the static output of `nuxt generate`; there is no server and no Netlify Function. `netlify.toml` is at the git root (`base = "app"`, publish `dist`). Netlify builds every push to `main` on its own, independently of CI.

- The fallback for client-side routes (`/join/<code>`) is `public/_redirects`, not `netlify.toml`: Nitro's Netlify preset writes its own catch-all into `_redirects` unless one is there, and that file wins.
- Netlify's environment holds only `SUPABASE_URL` and `SUPABASE_KEY`, baked into the bundle at build time.
- `NODE_VERSION` in `netlify.toml` is exact; raise it together with `engines` in `package.json`.
- Deploy previews and branch deploys stay off: they would all use the one production Supabase project.

### Database and security

RLS is the security boundary; the publishable key ships in the client bundle. Every household-scoped table uses `using (is_household_member(household_id)) with check (is_household_member(household_id))`, where `is_household_member` is a SECURITY DEFINER helper that avoids RLS self-recursion. `household_invites` has no SELECT policy on purpose (codes must not be enumerable); household creation, invite creation and redemption go through the SECURITY DEFINER RPCs `create_household`, `create_invite` and `redeem_invite`.

Rules that came out of bugs:

- **`.insert/.update/.upsert(...).select()` sends `RETURNING`, which Postgres checks against the table's SELECT policies** and reports as "new row violates row-level security policy". If the row is not visible to the caller at that moment, drop the `.select()` or use a SECURITY DEFINER RPC. Details: `docs/supabase-support-repro.md`.
- **Every new function in `public` needs `revoke execute ... from public, anon` and an explicit `grant ... to authenticated`**; Postgres grants EXECUTE to PUBLIC by default (see 0007, 0009).
- `SUPABASE_SECRET_KEY` and `SUPABASE_DB_PASSWORD` are for test tooling only and must never reach client code or `nuxt.config.ts`.

### Migrations and types

Migrations are `supabase/migrations/NNNN_name.sql`, applied to the cloud project; development and tests run against Supabase Cloud, not a local Supabase stack. When a migration is applied through the Supabase MCP server (`.mcp.json`), it records a timestamp version; the `supabase_migrations.schema_migrations` row is then renamed to the `NNNN` number so remote history matches the filenames. Ask the user before running that rename. Without the MCP server, `npx supabase db push --db-url "$DB_URL"` from `app/` (`--dry-run` first) applies pending migrations and records the `NNNN` version itself; ask the user before applying either way.

`app/types/database.types.ts` is generated; don't edit it by hand. After a schema change, from `app/` (`DB_URL` is the project's Postgres connection string, built with `SUPABASE_DB_PASSWORD`):

```bash
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```

## Conventions and gotchas

- **User id is `useSupabaseUser().value?.sub`**, never `.id`: in `@nuxtjs/supabase` v2 the ref holds JWT claims, and the type check does not catch `.id`. In `*-actions.ts`, use `getCurrentUserId(client)`.
- **Route paths come from `ROUTES`** (`utils/routes.ts`, auto-imported); never write a literal like `'/login'`. Routing stays file-based, so renaming a route means changing `ROUTES` and renaming the file in `pages/`.
- **Icons are SVG paths from Material Design Icons v7**, imported where used: `import { mdiDeleteOutline } from '@quasar/extras/mdi-v7'` and `:icon="mdiDeleteOutline"`. Never a string name like `icon="delete"`: no icon font is bundled (`quasar.iconSet` is `svg-mdi-v7`), so it renders as literal text. An icon-only button needs an `aria-label`.
- **Component names have no path prefix** (`pathPrefix: false`): `components/household/InviteDialog.vue` is `<InviteDialog>`. Keep one subfolder per feature.
- **The service worker only exists in a production build** (`nuxt generate` or `nuxt build`). PWA behaviour can't be checked in `nuxt dev`; use the `pwa` Playwright project. The Workbox options in `nuxt.config.ts` each work around a specific `@vite-pwa/nuxt` default, as their comments explain. In templates use the global `$pwa`.
- Supabase errors are plain objects, not `Error` instances; turn them into text with `errorMessage` (`utils/error-message.ts`).
- Login is email OTP with a code typed into the app, not a magic link (a link would open the system browser instead of the installed PWA). UI text does not name a code length.
- E2E helpers in `tests/support/` drive the real forms by label and button text, so renaming UI text breaks them. `supabase-fixtures.ts` creates and deletes the disposable users and households for both the RLS and e2e suites.
- Prettier: no semicolons, single quotes, width 100, trailing commas.
