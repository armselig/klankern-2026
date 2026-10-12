# Sign-in, households and the database rules

The history of sign-in by email code, households and invites, and the database rules that came out of building them, oldest first. The current state is in [`progress.md`](../progress.md); [`CLAUDE.md`](../CLAUDE.md) lists the other topic files.

## Resolved: the "Supabase RLS bug" was `INSERT ... RETURNING` (2026-10-08)

The former blocker (role-scoped RLS policies apparently rejected by PostgREST) was **not** a platform bug. supabase-js `.insert().select()` sends `INSERT ... RETURNING`, and Postgres requires the returned row to pass the table's **SELECT** policies too, raising the same "new row violates row-level security policy" error when it doesn't. Creating a household (creator isn't a member yet at RETURNING time) and creating an invite (no SELECT policy by design) both hit this. Full write-up: [`supabase-support-repro.md`](../supabase-support-repro.md).

Fixed by `0007_create_household_rpc.sql` (`create_household` / `create_invite` SECURITY DEFINER RPCs; dropped the "first member claims ownership" policy) and `0008_service_role_grants.sql` (`service_role` had no table privileges, which silently broke the RLS test's admin fixtures and cleanup).

**Rule going forward**: any `.insert/.update/.upsert(...).select()` needs the resulting row to be visible under the table's SELECT policy at that moment; otherwise drop the `.select()` or use a SECURITY DEFINER RPC.

**Function privileges**: Postgres grants `EXECUTE` on every new function to `PUBLIC`, i.e. callable by signed-out clients via `/rest/v1/rpc/...`. Every new function in `public` needs `revoke execute ... from public, anon` plus an explicit `grant ... to authenticated` (see 0007, 0009). The security advisor's remaining "signed-in users can execute SECURITY DEFINER function" warnings for `create_household`, `create_invite`, `redeem_invite`, `list_household_members` and `is_household_member` are intentional: the first four are the app's RPCs, and RLS policies need `authenticated` to be able to execute `is_household_member`.

**Migrations workflow**: the Supabase MCP server (`.mcp.json`) works in fresh sessions and was used to apply 0007–0009 (`apply_migration`). It records a timestamp version, so the `supabase_migrations.schema_migrations` row was renamed to `0007`–`0009` afterwards (in its own `execute_sql` call — don't batch it with a `begin … rollback` probe, the rollback undoes it) to keep remote history matching the local `NNNN_` filenames — do the same for future migrations applied that way. In auto mode, Claude Code's permission classifier blocks that rename (`update supabase_migrations.schema_migrations ...`) when the agent does it on its own initiative, but lets it through once the user explicitly asks for it. So: ask the user, then run it, with a read-only `select version, name from supabase_migrations.schema_migrations` before and after. 0011 was renamed this way on 2026-10-08. Without the MCP server, `npx supabase db push --db-url "$DB_URL"` (from `app/`; `--dry-run` first) applies the pending files and records the `NNNN` version by itself, so nothing needs renaming; 0012 was applied that way on 2026-10-10 with the user's go-ahead.

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

Fixes 1, 3 and 4 are now covered by the e2e specs `auth` and `lists` (see "E2E gap review" in [`infra/testing.md`](../infra/testing.md)).

Leftover test data in the cloud project: to-dos "Test 1–3" and one invite in the click-through household.
