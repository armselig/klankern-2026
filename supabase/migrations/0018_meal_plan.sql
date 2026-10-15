-- Meal planner, slice 1: the household's plan, one row per planned meal. An
-- entry is a recipe of the household or just a title ("toast"), on a day and
-- in one of four slots. It is separate from vacation_meals (0017), which is
-- left as it is: nothing here reads, copies or changes it.

create table meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  -- A calendar day with no time zone: what the household's members see on
  -- their calendar, never a moment.
  date date not null,
  slot text not null,
  recipe_id uuid,
  title text,
  -- Fractional, as in todo_items: several dinners on one day are ordered by
  -- it, and one can be placed between two others with one UPDATE.
  position numeric not null default 0,
  -- When the entry's ingredients were all put on the shopping list, or null.
  on_shopping_list_at timestamptz,
  -- Set when the household did not cook this entry after all; the entry stays
  -- in the plan and does not count as cooked.
  skipped_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  -- No updated_at: no trigger would maintain it (see 0002).
  deleted_at timestamptz,
  constraint meal_plan_entries_slot_values check (
    slot in ('breakfast', 'lunch', 'dinner', 'snack')
  ),
  -- A recipe or a title, never both and never neither.
  constraint meal_plan_entries_recipe_xor_title check (
    num_nonnulls(recipe_id, title) = 1
  ),
  -- Every entry travels whole in a Realtime payload, and RLS can't limit the
  -- size of a row a member may insert.
  constraint meal_plan_entries_title_shape check (
    title is null or (title ~ '\S' and char_length(title) <= 200)
  ),
  -- The composite key keeps an entry's household_id equal to its recipe's
  -- (see 0017).
  constraint meal_plan_entries_recipe_fkey foreign key (recipe_id, household_id)
    references recipes (id, household_id) on delete cascade
);

-- For the cascade from recipes.
create index meal_plan_entries_recipe_idx on meal_plan_entries (recipe_id, household_id);
-- For loading a range of days: the live entries, as removed ones stay as rows
-- (soft delete).
create index meal_plan_entries_live_idx on meal_plan_entries (household_id, date) where deleted_at is null;
create index meal_plan_entries_created_by_idx on meal_plan_entries (created_by);

alter table meal_plan_entries enable row level security;

create policy "members read meal plan entries" on meal_plan_entries
  for select to authenticated
  using (is_household_member(household_id));

-- created_by can't be forged: it has to be the caller.
create policy "members add meal plan entries" on meal_plan_entries
  for insert to authenticated
  with check (is_household_member(household_id) and created_by = auth.uid());

create policy "members change meal plan entries" on meal_plan_entries
  for update to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Written, edited or soft-deleted, never hard-deleted. Update is granted per
-- column, so household_id and created_by can't be changed afterwards.
revoke all on meal_plan_entries from public, anon, authenticated;
grant select, insert on meal_plan_entries to authenticated;
grant update (date, slot, recipe_id, title, position, on_shopping_list_at, skipped_at, deleted_at)
  on meal_plan_entries to authenticated;
grant select, insert, update, delete on meal_plan_entries to service_role;

-- Without this the subscription succeeds but never receives an event (see 0011).
alter publication supabase_realtime add table public.meal_plan_entries;
