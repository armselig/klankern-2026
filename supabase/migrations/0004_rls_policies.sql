-- SECURITY DEFINER helper avoids RLS self-recursion on household_members
-- (a policy on household_members that queries household_members directly
-- triggers Postgres error 42P17).
create function public.is_household_member(hid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from household_members
    where household_id = hid and user_id = (select auth.uid())
  );
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;
alter table todo_lists enable row level security;
alter table todo_items enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_items enable row level security;

-- households: any authenticated user may create one (they have no
-- household yet); membership is what grants visibility afterwards.
create policy "members read own household" on households
  for select using (is_household_member(id));

create policy "authenticated users create a household" on households
  for insert to authenticated with check (true);

create policy "members update own household" on households
  for update using (is_household_member(id)) with check (is_household_member(id));

-- household_members: members can see their household's roster. Self-insert
-- is only allowed to claim ownership of a brand-new household (zero
-- existing members) -- joining an existing household must go through the
-- redeem_invite() RPC (migration 0005), which runs SECURITY DEFINER and so
-- bypasses this policy entirely.
create policy "members read own household roster" on household_members
  for select using (is_household_member(household_id));

create policy "first member claims ownership" on household_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and not exists (
      select 1 from household_members existing
      where existing.household_id = household_members.household_id
    )
  );

-- household_invites: deliberately no select policy for regular users --
-- invite codes must not be enumerable. All lookup and redemption happens
-- inside the redeem_invite() SECURITY DEFINER RPC.
create policy "owners create invites" on household_invites
  for insert to authenticated
  with check (is_household_member(household_id));

-- todo_lists / todo_items / shopping_lists / shopping_items: uniform
-- household-scoped read/write. This exact pattern is what boards/recipes
-- will reuse in later phases.
create policy "members rw todo lists" on todo_lists
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "members rw todo items" on todo_items
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "members rw shopping lists" on shopping_lists
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "members rw shopping items" on shopping_items
  for all using (is_household_member(household_id)) with check (is_household_member(household_id));
