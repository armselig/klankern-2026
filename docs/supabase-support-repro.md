# Resolved: "new row violates row-level security policy" on insert (not a Supabase bug)

**Resolved:** 2026-10-08 · **Fix:** migrations `0007_create_household_rpc.sql`, `0008_service_role_grants.sql`

This file was originally a bug report for Supabase support, claiming PostgREST ignored
role-scoped (`to authenticated`) RLS policies. That diagnosis was wrong. It was never
sent; this is the corrected write-up so the same mistake isn't repeated.

## Symptom

Inserts through supabase-js failed with:

```json
{
  "code": "42501",
  "message": "new row violates row-level security policy for table \"households\""
}
```

even though the row clearly satisfied the table's INSERT policy (`with check (true)`),
and the same insert succeeded via direct SQL as `authenticated`.

## Actual cause: `RETURNING` is checked against SELECT policies

supabase-js `.insert(...).select()` makes PostgREST send `Prefer: return=representation`,
i.e. `INSERT ... RETURNING ...`. Postgres then requires the new row to pass the table's
**SELECT** policies too — and when it doesn't, it raises the same
"new row violates row-level security policy" error as a failed `WITH CHECK`. The error
message names the INSERT, but the policy that rejected it is the SELECT one.

Reproduced directly in SQL (transactions rolled back):

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.households(name) values ('x');               -- succeeds
insert into public.households(name) values ('x') returning id;   -- 42501
rollback;
```

Where this hit us:

- **`households`** — SELECT policy is `is_household_member(id)`, but the creator only
  becomes a member in a _second_ insert into `household_members`. At `RETURNING` time
  they aren't a member yet, so reading back the household they just created is denied.
- **`household_invites`** — deliberately has no SELECT policy (codes must not be
  enumerable), so `.insert().select('code')` could never succeed.

## Why the original investigation was misled

- **The direct-SQL comparisons** (`SET ROLE authenticated; INSERT ...`) didn't use
  `RETURNING`, so they passed and made the API path look uniquely broken.
- **The `repro_probe` table** had only an INSERT policy and no SELECT policy, so the
  `return=representation` request failed for exactly this reason — the "minimal repro"
  reproduced the RETURNING rule, not a role-handling bug.
- **The `to public` vs `to authenticated` comparison** was a red herring; the role the
  policy targeted was never the variable that mattered.
- **The RPC check** (`current_user` = `authenticated` inside the request) was correct,
  and confirmed the role switch worked — which in hindsight pointed _away_ from a
  PostgREST role bug.

## Fix

`0007_create_household_rpc.sql` adds two `SECURITY DEFINER` RPCs, the same pattern
already used by `redeem_invite()`:

- `create_household(p_name)` — inserts the household and the caller's owner membership
  in one transaction and returns the household. Also removes the risk of a memberless
  household if the second insert failed. The now-unused
  "first member claims ownership" policy on `household_members` was dropped.
- `create_invite(p_household_id)` — checks the caller is a member, inserts the invite,
  returns the code. `household_invites` still has no SELECT policy.

Both revoke `EXECUTE` from `public`/`anon` and grant it only to `authenticated`.

## Second, unrelated finding: `service_role` had no table grants

Once the RPCs worked, the RLS test's Admin-API (secret key) fixture inserts and its
`afterAll` cleanup still failed — silently, since the errors weren't checked.
`service_role` bypasses RLS but still needs table privileges, and this project's
default privileges hadn't given it any (`0006_grants.sql` only covered
`authenticated`). `0008_service_role_grants.sql` grants it
`select, insert, update, delete` on all app tables.

## Rule for future tables

If client code does `.insert().select()` / `.update().select()` / `.upsert().select()`,
the resulting row must be visible under the table's SELECT policy _at that moment_.
If it can't be (visibility depends on a row inserted later, or the table has no SELECT
policy by design), either drop the `.select()` or do the write in a `SECURITY DEFINER`
RPC that returns what the client needs.
