-- Vacation planner, slice 3: the meals of a trip. A meal is a recipe of the
-- household picked for a vacation; the same recipe can be a meal more than
-- once. Everything here adds to 0015 and 0016; an installed app that hasn't
-- updated yet keeps working.
--
-- A vacation's kind decides nothing, and 0015's comment saying that it
-- decides the meal plan is overtaken: any kind of stay may have meals, and
-- the kind may be edited (the update grant of 0015 covers it).

-- Target of the composite foreign key on vacation_meals, so a meal's
-- household_id can't differ from its recipe's, as it can't from its
-- vacation's (see 0015).
alter table recipes
  add constraint recipes_id_household_id_key unique (id, household_id);

create table vacation_meals (
  id uuid primary key default gen_random_uuid(),
  vacation_id uuid not null,
  household_id uuid not null,
  recipe_id uuid not null,
  -- Fractional, as in todo_items: a meal can be placed between two others
  -- with one UPDATE.
  position numeric not null default 0,
  -- When the meal's ingredients were all put on the shopping list, or null.
  -- Stamped only once every ingredient was saved, so a meal saved in part is
  -- tried again.
  on_shopping_list_at timestamptz,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- No updated_at: no trigger would maintain it (see 0002).
  deleted_at timestamptz,
  -- household_id is denormalized for RLS and the Realtime filter; the
  -- composite keys keep it equal to the vacation's and to the recipe's. The
  -- cascades are what remove a household's meals with it, and what keep the
  -- tests' cleanup of whole households from being blocked.
  constraint vacation_meals_vacation_fkey foreign key (vacation_id, household_id)
    references vacations (id, household_id) on delete cascade,
  constraint vacation_meals_recipe_fkey foreign key (recipe_id, household_id)
    references recipes (id, household_id) on delete cascade
);

-- For the cascade from vacations.
create index vacation_meals_vacation_id_idx on vacation_meals (vacation_id);
-- For the cascade from recipes.
create index vacation_meals_recipe_idx on vacation_meals (recipe_id, household_id);
-- For loading a household's meals, across its vacations: the live ones,
-- paged by id. Partial, because removed meals stay as rows (soft delete).
create index vacation_meals_live_idx on vacation_meals (household_id, id) where deleted_at is null;
create index vacation_meals_created_by_idx on vacation_meals (created_by);

alter table vacation_meals enable row level security;

create policy "members rw vacation meals" on vacation_meals
  for all to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- As in 0015: written, edited or soft-deleted, never hard-deleted.
revoke all on vacation_meals from public, anon, authenticated;
grant select, insert, update on vacation_meals to authenticated;
grant select, insert, update, delete on vacation_meals to service_role;

-- Without this the subscription succeeds but never receives an event (see 0011).
alter publication supabase_realtime add table public.vacation_meals;
