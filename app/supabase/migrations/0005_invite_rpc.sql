-- Redeeming an invite requires visibility into a household the caller is
-- not yet a member of, and permission to insert their own membership row
-- into it -- neither of which plain RLS grants a non-member. This runs
-- SECURITY DEFINER (as the migration-owning role, which bypasses RLS) and
-- does its own validation instead.
create function public.redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invite household_invites%rowtype;
begin
  select * into v_invite from household_invites
    where code = p_code and expires_at > now() and use_count < max_uses
    for update;

  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  insert into household_members (household_id, user_id, role)
    values (v_invite.household_id, (select auth.uid()), 'member')
    on conflict do nothing;

  update household_invites set use_count = use_count + 1 where id = v_invite.id;

  return v_invite.household_id;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
