# Database

Row-level security, the database functions, migrations and the generated types. Part of the rules for the code; [`README.md`](./README.md) lists the others.

## Database and security

RLS is the security boundary; the publishable key ships in the client bundle. Every household-scoped table uses `using (is_household_member(household_id)) with check (is_household_member(household_id))`, where `is_household_member` is a SECURITY DEFINER helper that avoids RLS self-recursion. `household_invites` has no SELECT policy on purpose (codes must not be enumerable); household creation, invite creation and redemption go through the SECURITY DEFINER RPCs `create_household`, `create_invite` and `redeem_invite`. Members' email addresses live in `auth.users`, which the API doesn't expose; the SECURITY DEFINER RPC `list_household_members` (0013) returns them, to members of the same household only.

Rules that came out of bugs:

- **`.insert/.update/.upsert(...).select()` sends `RETURNING`, which Postgres checks against the table's SELECT policies** and reports as "new row violates row-level security policy". If the row is not visible to the caller at that moment, drop the `.select()` or use a SECURITY DEFINER RPC. Details: `docs/supabase-support-repro.md`.
- **Every new function in `public` needs `revoke execute ... from public, anon` and an explicit `grant ... to authenticated`**; Postgres grants EXECUTE to PUBLIC by default (see 0007, 0009).
- `SUPABASE_SECRET_KEY` and `SUPABASE_DB_PASSWORD` are for test tooling only and must never reach client code or `nuxt.config.ts`.

## Migrations and types

Migrations are `supabase/migrations/<NNNN>_<name>.sql`, applied to the cloud project; development and tests run against Supabase Cloud, not a local Supabase stack. When a migration is applied through the Supabase MCP server (`.mcp.json`), it records a timestamp version; the `supabase_migrations.schema_migrations` row is then renamed to the `NNNN` number so remote history matches the filenames. Ask the user before running that rename. Without the MCP server, `npx supabase db push --db-url "$DB_URL"` (`--dry-run` first) applies pending migrations and records the `NNNN` version itself; ask the user before applying either way.

`app/types/database.types.ts` is generated; don't edit it by hand. After a schema change (`DB_URL` is the project's Postgres connection string, built with `SUPABASE_DB_PASSWORD`):

```bash
npx supabase gen types typescript --db-url "$DB_URL" --schema public > app/types/database.types.ts
npx prettier --write app/types/database.types.ts
```
