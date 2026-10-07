# PostgREST ignores role-scoped RLS policies (only `to public` works)

**Project ref:** qlgkbqxvdsvpoayxprdj

## Symptom

Any RLS policy scoped to a named role (`to authenticated` or `to anon`) is rejected via
the Data API (PostgREST / `/rest/v1/...`) with:

```json
{"code":"42501","details":null,"hint":null,"message":"new row violates row-level security policy for table \"<table>\""}
```

...even though:

- The row would clearly satisfy the policy's `WITH CHECK` expression.
- A policy scoped `to public` on the same shape of table, through the same API path,
  with the same logged-in user, works correctly.
- A direct SQL connection (`SET ROLE authenticated; INSERT ...`) succeeds.

## Minimal repro (fresh table, not pre-existing schema)

```sql
create table public.repro_probe (id uuid primary key default gen_random_uuid(), name text);
alter table public.repro_probe enable row level security;
create policy p on public.repro_probe for insert to authenticated with check (true);
grant insert, select on public.repro_probe to authenticated;
notify pgrst, 'reload schema';
```

Then, as a real logged-in user (confirmed `role: authenticated` in their JWT), call:

```
POST /rest/v1/repro_probe
Authorization: Bearer <user_access_token>
apikey: <publishable_key>
Content-Type: application/json
Prefer: return=representation

{"name": "x"}
```

Result: `403 { "code": "42501", "message": "new row violates row-level security policy for table \"repro_probe\"" }`

Changing the policy to `for insert to public with check (true)` makes the identical
request succeed (`201`).

## What we ruled out

- **Not missing grants** -- `grant insert, select on ... to authenticated` is present
  and confirmed via `information_schema`/`pg_policy` introspection; a genuinely missing
  grant produces a distinctly different error ("permission denied for table ..."), not
  this RLS-violation message.
- **Not a stale PostgREST schema cache** -- ran `notify pgrst, 'reload schema'` and
  `notify pgrst, 'reload config'` repeatedly; no change. Also reproduced on a table
  created seconds before the test, so no accumulated staleness is possible.
- **Not the project being in a degraded state** -- restarted the project from the
  dashboard; issue persisted identically afterward.
- **Not actually a role-switch failure** -- confirmed via a `SECURITY INVOKER` SQL
  function called through `/rest/v1/rpc/...` in the exact same request as the failing
  INSERT: `current_user` reports `authenticated` in that request, and the INSERT inside
  that same function call still gets rejected by the `to authenticated` policy.
- **Not `pgrst.db_schemas` on the `authenticator` role** -- per a community thread
  (tanius / Supabase support "Steve") describing a similar-sounding issue caused by the
  resumable-uploads feature rollout clobbering `pgrst.db_schemas` on the `authenticator`
  role (dropping `public` from the exposed schema list). We checked:

  ```sql
  SELECT setrole::regrole, setconfig
    FROM pg_db_role_setting
    WHERE setrole::regrole = 'authenticator'::regrole;
  ```

  No `pgrst.db_schemas` override was present at all in our case (different from that
  thread's exact symptom). We set it explicitly anyway:

  ```sql
  ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public';
  NOTIFY pgrst, 'reload config';
  ```

  No change -- issue persisted identically. (This also wouldn't explain our symptom
  shape: if `public` weren't exposed at all, policies scoped `to public` on tables in
  that schema should fail too, but they succeed.)

## Working hypothesis

Something in this project's PostgREST deployment isn't applying role-scoped
(`to authenticated` / `to anon`) RLS policies correctly even though the role switch
itself is confirmed to happen (`current_user` is correct), while role-agnostic
(`to public`) policies work normally. This points at the PostgREST layer specifically,
not the underlying Postgres roles/grants/policies, which all check out correctly via
direct SQL.
