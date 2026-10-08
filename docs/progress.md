# Klankern — Progress Log

Tracks what's been built against the milestones in [`plan.md`](./plan.md), session by session. Update this when picking the project back up or finishing a milestone — it's the fastest way to re-orient without re-reading the whole chat history.

**Resuming in a new session**: everything below is current as of commit `d3f3ba9` (`main`, working tree clean, nothing uncommitted). Start a fresh session by pointing it at this file — e.g. "read docs/progress.md and continue from there." No other state matters; the repo and this doc are the source of truth, not any prior chat history.

## Status at a glance

| Milestone | Status |
|---|---|
| 1. Scaffold + tooling + git hooks | ✅ Done |
| 2. Schema + RLS + two-JWT test | 🟡 SQL done, test **blocked** on a Supabase platform bug (see below) |
| 3. Auth + household join flow | ✅ Built, untested end-to-end (same blocker) |
| 4. Shared to-do list CRUD | ✅ Built, untested end-to-end (same blocker) |
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
app/supabase/migrations/   0001_households.sql … 0006_grants.sql
app/tests/rls/              household-isolation.spec.ts (two-JWT RLS proof, currently failing — see below)
```

**Design pattern used throughout**: business logic lives in plain `composables/*-actions.ts` functions that take a `SupabaseClient` as a parameter, unit-tested with a mocked client (no Nuxt runtime needed). Pinia stores are thin — they call `useSupabaseClient()`/`useSupabaseUser()` and delegate to those functions. State-transition logic that needs testing on its own (optimistic add/dedup, soft-delete, sort order) is further extracted into pure reducer functions in `utils/`. This is the pattern to continue for the shopping list (milestone 6) and whiteboard/recipes (later phases).

**Testing**: Vitest, 28 tests passing (`npm test`). Husky pre-commit (lint-staged: eslint --fix + prettier) and pre-push (full test suite) are wired and verified firing through git's actual hook dispatcher — not just callable manually. Note the project lives one directory below the git root (`app/` inside `klankern-2026/`), which needed a non-default Husky setup (`prepare` script does `cd .. && husky app/.husky`, and `core.hooksPath` points at `app/.husky/_`) since Husky's own `.git` detection assumes the package.json directory *is* the repo root.

**Database types**: generated from the live schema via `supabase gen types typescript`, saved to `app/app/types/database.types.ts`, picked up automatically by `@nuxtjs/supabase`'s default `types` path. Re-run after any migration changes:
```
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```

## Known blocker: Supabase project rejects role-scoped RLS policies

**This blocks milestone 2's automated test and all real end-to-end testing of milestones 3–4.**

Every RLS policy scoped to a named role (`to authenticated` or `to anon`) is rejected by the Data API (PostgREST) with `42501 — new row violates row-level security policy`, even for a policy as permissive as `with check (true)`. Policies scoped `to public` work fine through the same API path. Raw SQL (`SET ROLE authenticated; INSERT ...`) succeeds. A request-scoped check confirmed `current_user` really is `authenticated` during the failing API call. Restarting the project from the dashboard did not fix it. Full repro and everything ruled out is written up in [`supabase-support-repro.md`](./supabase-support-repro.md) — that's what to hand to Supabase support.

**Until this is fixed**: the schema/migrations/policies themselves are correct (proven via direct SQL) — no code changes are needed once Supabase resolves it. `tests/rls/household-isolation.spec.ts` is written and ready; it should just start passing. `npm test` currently excludes it implicitly only in that it's expected to fail — run `npx vitest run --exclude '**/rls/**'` to see the rest of the suite green.

A Supabase MCP server was added to this project (`.mcp.json`, scope: project) and authenticated mid-session, but its tools weren't available in that session (MCP servers load at session start) — worth using in a fresh session to dig further or to apply dashboard-side fixes directly.

## Other notable decisions / deviations from the plan

- **Local Supabase stack doesn't work on this host.** `supabase start` via Podman fails: Podman's rootless networking (netavark/nftables) works for single containers but races when the Supabase CLI starts its ~10 containers concurrently. Not fixed — the plan's fallback (develop directly against Supabase Cloud) is what's actually in use, so this hasn't blocked anything, but it means **milestone 8's `Containerfile.dev`/`podman-compose.yml` should be tested carefully** when we get there, since it's unclear if the same concurrency issue would affect a simpler (1–2 container) dev compose setup. Worth an early smoke test rather than assuming it'll just work.
- **Component path prefixing disabled** (`components: [{ path: '~/components', pathPrefix: false }]` in `nuxt.config.ts`) so `components/household/CreateHouseholdForm.vue` registers as `<CreateHouseholdForm>` rather than Nuxt's default `<HouseholdCreateHouseholdForm>`. Keep using subfolders per feature (`components/todo/`, `components/shopping/`, …) — this config makes that free.
- **No icon font bundled** (`quasar.extras.fontIcons: []` in `nuxt.config.ts`, to keep the Workbox precache small per the PWA plan). This means Quasar's `icon="..."` prop (Material Icons ligatures) silently renders as literal text, not an icon. Caught once already (the invite-copy button) — **use labeled buttons, not icon-only ones**, until/unless we deliberately add an icon strategy (SVG-based, most likely) in the PWA milestone.
- **`household_id` is denormalized onto every item table** (`todo_items`, `shopping_items`, etc.) per the plan, specifically so RLS policies and Realtime channel filters don't need a join.
- Repo name is `klankern-2026`; there's an **unrelated prior project at `/home/hendrik/src/klankern`** (no `-2026` suffix) from ~Sep 30, using pnpm + Drizzle + self-hosted Supabase — explicitly out of scope per the user, left untouched. Don't confuse the two when searching this machine.

## Environment / secrets

`app/.env` (gitignored) holds: `SUPABASE_URL`, `SUPABASE_KEY` (publishable), `SUPABASE_DB_PASSWORD`, `SUPABASE_SECRET_KEY`. The DB password and secret key are **server-side/test-tooling only** — never read by `nuxt.config.ts`'s public runtime config, never shipped to the browser. The secret key in particular should stay out of anything client-facing permanently; it's only used by `tests/rls/` to provision disposable test users via the Admin API.

## Next steps

1. Either get the Supabase platform issue resolved, or decide to proceed without automated RLS verification for now and test manually once a browser is available.
2. Milestone 5: Realtime sync for to-dos (`alter publication supabase_realtime add table ...`, `useHouseholdRealtime` composable, reconcile-on-reconnect).
3. Milestone 6: mirror the to-do store/component/actions pattern for shopping lists.
4. Before milestone 8: smoke-test a minimal Podman dev compose early, given the local-stack networking issue found here.
