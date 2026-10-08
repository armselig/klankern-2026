# Klankern — Progress Log

Tracks what's been built against the milestones in [`plan.md`](./plan.md), session by session. Update this when picking the project back up or finishing a milestone — it's the fastest way to re-orient without re-reading the whole chat history.

**Resuming in a new session**: everything below is current as of the commit that added migration 0009 (2026-10-08) (`main`, working tree clean, nothing uncommitted). Start a fresh session by pointing it at this file — e.g. "read docs/progress.md and continue from there." No other state matters; the repo and this doc are the source of truth, not any prior chat history.

## Status at a glance

| Milestone | Status |
|---|---|
| 1. Scaffold + tooling + git hooks | ✅ Done |
| 2. Schema + RLS + two-JWT test | ✅ Done — RLS test passing against Supabase Cloud |
| 3. Auth + household join flow | ✅ Built; DB paths verified by the RLS test, UI not yet clicked through in a browser |
| 4. Shared to-do list CRUD | ✅ Built; DB paths verified by the RLS test, UI not yet clicked through in a browser |
| 5. Realtime sync for to-dos | ⬜ Not started |
| 6. Shared shopping list | ⬜ Not started |
| 7. PWA installability pass | 🟡 Manifest/icons/Workbox config in place from milestone 1; Lighthouse audit not run |
| 8. Containerize (Podman) + deploy | ⬜ Not started |
| 9. Shared whiteboard (deferred phase) | ⬜ Not started |
| 10. Shared recipes (deferred phase) | ⬜ Not started |

## What's built

**Stack as scaffolded**: Nuxt **4** (not 3 — 4 is what `nuxi init` installs now; API is compatible, folder convention differs: app code lives under `app/app/`, not `app/`), SPA mode (`ssr: false`), `nuxt-quasar-ui`, `@vite-pwa/nuxt`, `@nuxtjs/supabase`, Pinia. Supabase Cloud project `qlgkbqxvdsvpoayxprdj`.

**Project layout** (relative to `app/`, the Nuxt project root):
```
app/app/
  types/            database.types.ts (generated), household.ts, todo.ts
  composables/      current-user.ts, household-actions.ts, todo-actions.ts (+ .spec.ts siblings)
  utils/            position.ts, todo-state.ts (+ .spec.ts siblings)
  stores/           household.ts, todos.ts
  pages/            login.vue, confirm.vue, index.vue, todos.vue, join/[code].vue
  components/       household/{CreateHouseholdForm,InviteDialog}.vue, todo/{TodoList,TodoItem}.vue
  layouts/          default.vue
app/supabase/migrations/   0001_households.sql … 0009_restrict_function_execute.sql
app/tests/rls/              household-isolation.spec.ts (two-JWT RLS proof against Supabase Cloud)
```

**Design pattern used throughout**: business logic lives in plain `composables/*-actions.ts` functions that take a `SupabaseClient` as a parameter, unit-tested with a mocked client (no Nuxt runtime needed). Pinia stores are thin — they call `useSupabaseClient()`/`useSupabaseUser()` and delegate to those functions. State-transition logic that needs testing on its own (optimistic add/dedup, soft-delete, sort order) is further extracted into pure reducer functions in `utils/`. This is the pattern to continue for the shopping list (milestone 6) and whiteboard/recipes (later phases).

**Testing**: Vitest, 38 tests passing (including the RLS suite) (`npm test`). Husky pre-commit (lint-staged: eslint --fix + prettier) and pre-push (full test suite) are wired and verified firing through git's actual hook dispatcher — not just callable manually. Note the project lives one directory below the git root (`app/` inside `klankern-2026/`), which needed a non-default Husky setup (`prepare` script does `cd .. && husky app/.husky`, and `core.hooksPath` points at `app/.husky/_`) since Husky's own `.git` detection assumes the package.json directory *is* the repo root.

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

**Migrations workflow**: the Supabase MCP server (`.mcp.json`) works in fresh sessions and was used to apply 0007–0009 (`apply_migration`). It records a timestamp version, so the `supabase_migrations.schema_migrations` row was renamed to `0007`–`0009` afterwards (in its own `execute_sql` call — don't batch it with a `begin … rollback` probe, the rollback undoes it) to keep remote history matching the local `NNNN_` filenames — do the same for future migrations applied that way.

## Other notable decisions / deviations from the plan

- **Local Supabase stack doesn't work on this host.** `supabase start` via Podman fails: Podman's rootless networking (netavark/nftables) works for single containers but races when the Supabase CLI starts its ~10 containers concurrently. Not fixed — the plan's fallback (develop directly against Supabase Cloud) is what's actually in use, so this hasn't blocked anything, but it means **milestone 8's `Containerfile.dev`/`podman-compose.yml` should be tested carefully** when we get there, since it's unclear if the same concurrency issue would affect a simpler (1–2 container) dev compose setup. Worth an early smoke test rather than assuming it'll just work.
- **Component path prefixing disabled** (`components: [{ path: '~/components', pathPrefix: false }]` in `nuxt.config.ts`) so `components/household/CreateHouseholdForm.vue` registers as `<CreateHouseholdForm>` rather than Nuxt's default `<HouseholdCreateHouseholdForm>`. Keep using subfolders per feature (`components/todo/`, `components/shopping/`, …) — this config makes that free.
- **No icon font bundled** (`quasar.extras.fontIcons: []` in `nuxt.config.ts`, to keep the Workbox precache small per the PWA plan). This means Quasar's `icon="..."` prop (Material Icons ligatures) silently renders as literal text, not an icon. Caught once already (the invite-copy button) — **use labeled buttons, not icon-only ones**, until/unless we deliberately add an icon strategy (SVG-based, most likely) in the PWA milestone.
- **`household_id` is denormalized onto every item table** (`todo_items`, `shopping_items`, etc.) per the plan, specifically so RLS policies and Realtime channel filters don't need a join.
- Repo name is `klankern-2026`; there's an **unrelated prior project at `/home/hendrik/src/klankern`** (no `-2026` suffix) from ~Sep 30, using pnpm + Drizzle + self-hosted Supabase — explicitly out of scope per the user, left untouched. Don't confuse the two when searching this machine.

## Environment / secrets

`app/.env` (gitignored) holds: `SUPABASE_URL`, `SUPABASE_KEY` (publishable), `SUPABASE_DB_PASSWORD`, `SUPABASE_SECRET_KEY`. The DB password and secret key are **server-side/test-tooling only** — never read by `nuxt.config.ts`'s public runtime config, never shipped to the browser. The secret key in particular should stay out of anything client-facing permanently; it's only used by `tests/rls/` to provision disposable test users via the Admin API.

## Next steps

1. Click through milestones 3–4 in a browser (magic-link login, create household, invite + join, to-do CRUD).
2. Milestone 5: Realtime sync for to-dos (`alter publication supabase_realtime add table ...`, `useHouseholdRealtime` composable, reconcile-on-reconnect).
3. Milestone 6: mirror the to-do store/component/actions pattern for shopping lists.
4. Before milestone 8: smoke-test a minimal Podman dev compose early, given the local-stack networking issue found here.
