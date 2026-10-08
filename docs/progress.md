# Klankern — Progress Log

Tracks what's been built against the milestones in [`plan.md`](./plan.md), session by session. Update this when picking the project back up or finishing a milestone — it's the fastest way to re-orient without re-reading the whole chat history.

**Resuming in a new session**: everything below is current as of the commit that recorded the milestone 3–4 browser click-through (2026-10-08) (`main`, working tree clean, nothing uncommitted). Start a fresh session by pointing it at this file — e.g. "read docs/progress.md and continue from there." No other state matters; the repo and this doc are the source of truth, not any prior chat history.

## Status at a glance

| Milestone | Status |
|---|---|
| 1. Scaffold + tooling + git hooks | ✅ Done |
| 2. Schema + RLS + two-JWT test | ✅ Done — RLS test passing against Supabase Cloud |
| 3. Auth + household join flow | ✅ Done — clicked through in a browser (OTP login, invite, join) |
| 4. Shared to-do list CRUD | ✅ Done — clicked through in a browser (add, toggle, remove, reload, second member sees the list) |
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

## Resolved: login emails contained no OTP code (2026-10-08)

Supabase's default email templates only contain a magic link. Fixed in the dashboard by the user: custom SMTP via **Resend**, and `{{ .Token }}` (no `{{ .ConfirmationURL }}`) in **both** the "Magic link" template (existing users) and the "Confirm signup" template (a brand-new user's first `signInWithOtp`). Missing the second one is easy: the first code request for a new address uses "Confirm signup".

Click-through accounts: A = `hndrk.nmnn@gmail.com` (owner), B = `hndrk.nmnn+b@gmail.com` (member), both in household "Neumann". Codes are pasted into the app by the user — the agent doesn't read the inbox.

## Browser click-through of milestones 3–4 (2026-10-08)

Done in Chrome against the user's `nuxt dev` on `localhost:3000`. Every step works: OTP login, invite creation, signed-out join via `/join/<code>` + OTP, to-do add (button and Enter), toggle, soft-delete, state survives reload, and A sees the items B created.

**Bug found and fixed**: adding a to-do always failed with `not_authenticated`. In `@nuxtjs/supabase` v2, `useSupabaseUser()` holds the JWT **claims** (`Ref<JwtPayload | null>`, filled via `auth.getClaims()`), not a `User` — the user id is `.sub`, and `.id` is always `undefined`. The type check didn't catch it because `JwtPayload` allows arbitrary keys. **Rule going forward**: read the id as `useSupabaseUser().value?.sub`, or use `getCurrentUserId(client)` in `*-actions.ts`.

Smaller issues found (to be fixed next):
1. The cloud project sends **8-digit** codes, but the login and join pages said "6-digit code".
2. `redeem_invite` increments `use_count` even when the caller is already a member (`on conflict do nothing` skips the insert, the update still runs).
3. The add-to-do input loses focus after each add.
4. To-do checkboxes have no accessible name (announced as "on" instead of the item title).

Leftover test data in the cloud project: to-dos "Test 1–3" and invite `b005ab07` in household "Neumann".

## Milestone 5 plan (agreed, not started)

Pre-checks already done (2026-10-08): the live `supabase_realtime` publication is **empty**; there is **no trigger** maintaining `updated_at`, so don't use it to order/last-write-wins Realtime events. Supabase changelog checked — nothing breaking for this design (the `realtime` schema lock-down doesn't affect `alter publication`).

Test-first, same pattern as milestone 4:
1. `0010_realtime_publication.sql`: `alter publication supabase_realtime add table public.todo_items, public.shopping_items;` — apply via MCP `apply_migration`, then rename the version to `0010` in a separate `execute_sql` call.
2. Pure reducer `applyTodoRealtimeEvent` in `utils/todo-state.ts` (spec first): INSERT echo of an optimistic id doesn't duplicate; remote soft-delete hides the item; a late INSERT/UPDATE can't resurrect a locally deleted item; events for another `list_id` are ignored.
3. Reconnect resync **merges** rather than replaces: `fetchTodoItems` excludes deleted rows, so replacing `itemsById` would wipe in-flight optimistic adds — track pending ids in the store and keep them across the refetch.
4. Plain, mock-testable `subscribeToHouseholdChanges(client, householdId, listeners)` returning an unsubscribe fn — one channel per household, `postgres_changes` filtered on `household_id=eq.<id>`, refetch on every `SUBSCRIBED`. Thin `useHouseholdRealtime` composable on top, mounted where the household id is known (not inside `TodoList`, so shopping can reuse the channel), torn down on scope dispose and sign-out.
5. **Listen to `INSERT` and `UPDATE` only, not `*`**: per the Realtime docs, DELETE events can't be filtered and RLS isn't applied to them. The app never hard-deletes (soft delete = UPDATE), so nothing is lost. Leave replica identity at its default.

## Next steps

1. Fix the four click-through issues listed above.
2. Milestone 5 per the plan above — accounts A and B are already in one household for the manual two-session sync test.
3. Milestone 6: mirror the to-do store/component/actions pattern for shopping lists.
4. Before milestone 8: smoke-test a minimal Podman dev compose early, given the local-stack networking issue found here.
