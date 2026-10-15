-- Meal planner, slice 2: the kids. A recipe gets a text for the kids'
-- version of the dish; the household's children are records of their own
-- (they are not users); and what a child refused or picked at is recorded
-- per planned meal, by exception: a child without a reaction ate it.
-- Everything here adds to 0018; an installed app that hasn't updated yet
-- keeps working.

-- The kids' version of a recipe, as plain text ("without the spinach
-- layer"). Null when there is none. recipes is granted UPDATE on the whole
-- table (0014), so the column needs no grant.
alter table recipes
  add column kids_version text,
  -- The limit exists for the reason given in 0014: a recipe travels whole
  -- in a Realtime payload.
  add constraint recipes_kids_version_shape check (
    kids_version is null or (kids_version ~ '\S' and char_length(kids_version) <= 2000)
  );

create table household_children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  -- What the household calls the child. It stays in the database and the
  -- app: never in a notice and never in a request to another service.
  name text not null,
  created_by uuid not null default auth.uid() references auth.users (id),
  -- A child's record counts the meals from this day on.
  created_at timestamptz not null default now(),
  -- No updated_at: no trigger would maintain it (see 0002).
  -- Set when the child is removed. The row stays, as every row does here,
  -- and the app leaves the child's reactions out.
  deleted_at timestamptz,
  constraint household_children_name_shape check (
    name ~ '\S' and char_length(name) <= 100
  ),
  -- Target of the composite foreign key on meal_reactions.
  constraint household_children_id_household_id_key unique (id, household_id)
);

-- For loading a household's children, removed ones included: their
-- reactions are still rows.
create index household_children_household_id_idx on household_children (household_id, id);
create index household_children_created_by_idx on household_children (created_by);

alter table household_children enable row level security;

create policy "members read children" on household_children
  for select to authenticated
  using (is_household_member(household_id));

-- created_by can't be forged: it has to be the caller.
create policy "members add children" on household_children
  for insert to authenticated
  with check (is_household_member(household_id) and created_by = auth.uid());

create policy "members change children" on household_children
  for update to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Written, renamed or soft-deleted, never hard-deleted. Update is granted per
-- column, so household_id, created_by and created_at can't be changed.
revoke all on household_children from public, anon, authenticated;
grant select, insert on household_children to authenticated;
grant update (name, deleted_at) on household_children to authenticated;
grant select, insert, update, delete on household_children to service_role;

-- Without this the subscription succeeds but never receives an event (see 0011).
alter publication supabase_realtime add table public.household_children;

-- Target of the composite foreign key on meal_reactions, as
-- recipes_id_household_id_key is for meal_plan_entries (0017, 0018).
alter table meal_plan_entries
  add constraint meal_plan_entries_id_household_id_key unique (id, household_id);

-- What a child made of a planned meal, when it was not "ate it". A change
-- between the two reactions is an UPDATE of the live row; going back to
-- "ate it" soft-deletes it, and a reaction recorded after that is a new
-- row: a removed row is never brought back.
create table meal_reactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  entry_id uuid not null,
  child_id uuid not null,
  reaction text not null,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint meal_reactions_reaction_values check (
    reaction in ('picked_at', 'refused')
  ),
  -- household_id is denormalized for RLS and the Realtime filter; the
  -- composite keys keep it equal to the entry's and the child's, so a
  -- reaction can't tie one household's child to another's meal.
  constraint meal_reactions_entry_fkey foreign key (entry_id, household_id)
    references meal_plan_entries (id, household_id) on delete cascade,
  constraint meal_reactions_child_fkey foreign key (child_id, household_id)
    references household_children (id, household_id) on delete cascade
);

-- One live reaction per child and meal. Only among the live rows, so that
-- a reaction taken back and recorded again is a new row.
create unique index meal_reactions_live_once_idx
  on meal_reactions (entry_id, child_id)
  where deleted_at is null;
-- For the cascades and for loading a household's reactions.
create index meal_reactions_entry_idx on meal_reactions (entry_id, household_id);
create index meal_reactions_child_idx on meal_reactions (child_id, household_id);
create index meal_reactions_household_id_idx on meal_reactions (household_id, id);
create index meal_reactions_created_by_idx on meal_reactions (created_by);

alter table meal_reactions enable row level security;

create policy "members read meal reactions" on meal_reactions
  for select to authenticated
  using (is_household_member(household_id));

create policy "members add meal reactions" on meal_reactions
  for insert to authenticated
  with check (is_household_member(household_id) and created_by = auth.uid());

create policy "members change meal reactions" on meal_reactions
  for update to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Only the reaction and the soft delete change; the entry and the child of
-- a row are fixed.
revoke all on meal_reactions from public, anon, authenticated;
grant select, insert on meal_reactions to authenticated;
grant update (reaction, deleted_at) on meal_reactions to authenticated;
grant select, insert, update, delete on meal_reactions to service_role;

alter publication supabase_realtime add table public.meal_reactions;
