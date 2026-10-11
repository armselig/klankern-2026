-- The dashboard shows every member of the household with an avatar. The
-- avatar is found through the member's email address (Gravatar looks a
-- picture up by the address's hash), and the address is also what names the
-- member. But a member can't read another member's address: household_members
-- holds only user_id, and auth.users is not exposed to the API.
--
-- This function hands the addresses out, to members of the same household
-- only. SECURITY DEFINER because it reads auth.users; the membership check
-- is therefore its own, and is_household_member() compares against the
-- caller's auth.uid(). A caller who is not a member gets no rows, like a
-- table read that RLS filters. Deliberately no view over auth.users and no
-- copy of the address in a table of its own.
create function public.list_household_members(p_household_id uuid)
returns table (user_id uuid, email text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, m.joined_at
  from public.household_members m
  join auth.users u on u.id = m.user_id
  where m.household_id = p_household_id
    -- Sign-in is by email, so every user has one; this keeps the result's
    -- type honest should that ever change.
    and u.email is not null
    and (select public.is_household_member(p_household_id))
  -- Whoever has been in the household longest comes first.
  order by m.joined_at, m.user_id;
$$;

-- Functions are executable by PUBLIC by default; restrict to signed-in users
-- (see 0007, 0009).
revoke execute on function public.list_household_members(uuid) from public, anon;
grant execute on function public.list_household_members(uuid) to authenticated;
