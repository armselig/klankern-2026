-- redeem_invite() (migration 0005) incremented use_count even when the
-- caller was already a member and the membership insert was skipped, so an
-- owner opening their own invite link used up one of its max_uses without
-- adding anyone. Only count a redemption that actually added a member.
-- CREATE OR REPLACE keeps the existing EXECUTE grants from 0009.
create or replace function public.redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.household_invites%rowtype;
begin
  select * into v_invite from public.household_invites
    where code = p_code and expires_at > now() and use_count < max_uses
    for update;

  if not found then
    raise exception 'invalid_or_expired_invite';
  end if;

  insert into public.household_members (household_id, user_id, role)
    values (v_invite.household_id, (select auth.uid()), 'member')
    on conflict do nothing;

  if found then
    update public.household_invites set use_count = use_count + 1 where id = v_invite.id;
  end if;

  return v_invite.household_id;
end;
$$;
