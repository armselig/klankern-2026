-- INSERT ... RETURNING (what supabase-js `.insert().select()` sends) requires
-- the new row to pass the table's SELECT policies as well as its INSERT
-- policy; failing that raises 42501 "new row violates row-level security
-- policy". Creating a household and an invite both hit this:
--   * households: the SELECT policy is is_household_member(id), but the
--     creator only becomes a member in a second, later insert.
--   * household_invites: deliberately has no SELECT policy (codes must not
--     be enumerable), so the generated code can never be read back.
-- Both operations therefore run as SECURITY DEFINER RPCs that do their own
-- validation, the same pattern as redeem_invite() (migration 0005).

-- Creates the household and the caller's owner membership in one
-- transaction, so a failed second step can't leave a memberless household.
create function public.create_household(p_name text) returns public.households
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_household public.households;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.households (name) values (p_name)
    returning * into v_household;

  insert into public.household_members (household_id, user_id, role)
    values (v_household.id, v_user_id, 'owner');

  return v_household;
end;
$$;

-- Creates an invite for a household the caller belongs to and returns its
-- code, without exposing any SELECT access to household_invites.
create function public.create_invite(p_household_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text;
begin
  if v_user_id is null or not public.is_household_member(p_household_id) then
    raise exception 'not_a_household_member' using errcode = '42501';
  end if;

  insert into public.household_invites (household_id, created_by)
    values (p_household_id, v_user_id)
    returning code into v_code;

  return v_code;
end;
$$;

-- Functions are executable by PUBLIC by default; restrict to signed-in users.
revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.create_invite(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;

-- Ownership is now only ever claimed inside create_household(), so the
-- direct self-insert path on household_members is no longer needed.
drop policy "first member claims ownership" on public.household_members;
