-- Postgres grants EXECUTE on new functions to PUBLIC by default, which made
-- these SECURITY DEFINER functions callable by signed-out clients via
-- /rest/v1/rpc/... (Supabase security advisor lint 0028). Same lockdown as
-- 0007 applies to create_household()/create_invite().

-- Join-by-code is only meaningful for a signed-in user. Left open, anon
-- could probe invite codes for validity (an unknown code and a valid one
-- fail with different errors).
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- Called from RLS policies, which evaluate with the querying role's
-- privileges -- so authenticated must keep EXECUTE or every
-- household-scoped query fails.
revoke execute on function public.is_household_member(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;

-- Event-trigger function behind Supabase's "auto-enable RLS" setting
-- (event trigger ensure_rls). Postgres invokes it directly on DDL, with no
-- EXECUTE check, so no API role needs to be able to call it.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
