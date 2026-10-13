-- Vacation planner, slice 1: a vacation and its tasks by phase. Both sync
-- like list items, through postgres_changes on the household channel, so RLS
-- stays the only security boundary. People, assignment and meals follow in
-- later migrations and only add to these tables.

create table vacations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  title text not null,
  -- Decides which template fills the vacation when it is added, and whether
  -- it gets a meal plan. The app never changes it afterwards: the old kind's
  -- tasks would stay and none would be added.
  kind text not null,
  -- Calendar days without a time or a zone: a trip starts on the same day
  -- for every member, wherever their device thinks it is.
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- No updated_at: no trigger would maintain it (see 0002).
  deleted_at timestamptz,
  -- Target of the composite foreign key on vacation_tasks.
  constraint vacations_id_household_id_key unique (id, household_id),
  -- The limits exist because every row travels whole in a Realtime payload,
  -- and RLS can't limit the size of a row a member may insert.
  constraint vacations_title_shape check (
    title ~ '\S' and char_length(title) <= 200
  ),
  constraint vacations_kind_known check (kind in ('house', 'hotel')),
  constraint vacations_dates_order check (ends_on >= starts_on)
);

create table vacation_tasks (
  id uuid primary key default gen_random_uuid(),
  vacation_id uuid not null,
  household_id uuid not null,
  -- A task has a phase, not a due date.
  phase text not null,
  title text not null,
  done boolean not null default false,
  -- Fractional, as in todo_items: a task can be placed between two others
  -- with one UPDATE. Positions are compared within a phase only.
  position numeric not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- household_id is denormalized for RLS and the Realtime filter; the
  -- composite key keeps it equal to the vacation's, so a task can't claim
  -- one household for the policy while hanging on another household's
  -- vacation. The cascade is what removes a household's tasks with it.
  constraint vacation_tasks_vacation_fkey foreign key (vacation_id, household_id)
    references vacations (id, household_id) on delete cascade,
  constraint vacation_tasks_phase_known check (
    phase in ('before', 'during', 'after')
  ),
  -- The row has to stay small: past about 2 kB Postgres stores a long value
  -- out of line, and an UPDATE event then leaves out the columns the update
  -- didn't change, which the app's reducer for this table doesn't expect. A
  -- title of 200 four-byte characters is 800 bytes. Another text column on
  -- this table has to count again.
  constraint vacation_tasks_title_shape check (
    title ~ '\S' and char_length(title) <= 200
  )
);

-- For the cascade from households.
create index vacations_household_id_idx on vacations (household_id);
-- For loading a household's vacations: the live ones, paged by id. Partial,
-- because removed vacations stay as rows (soft delete).
create index vacations_live_idx on vacations (household_id, id) where deleted_at is null;
create index vacations_created_by_idx on vacations (created_by);

-- For the cascade from vacations.
create index vacation_tasks_vacation_id_idx on vacation_tasks (vacation_id);
-- For loading a household's tasks, across its vacations: the live ones,
-- paged by id.
create index vacation_tasks_live_idx on vacation_tasks (household_id, id) where deleted_at is null;
create index vacation_tasks_created_by_idx on vacation_tasks (created_by);

alter table vacations enable row level security;
alter table vacation_tasks enable row level security;

create policy "members rw vacations" on vacations
  for all to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create policy "members rw vacation tasks" on vacation_tasks
  for all to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- Only what the app does: a row is written, edited or soft-deleted (an
-- UPDATE), never hard-deleted. A hard delete would also be invisible to the
-- other members, since Realtime is subscribed to INSERT and UPDATE only.
revoke all on vacations, vacation_tasks from public, anon, authenticated;
grant select, insert, update on vacations, vacation_tasks to authenticated;
grant select, insert, update, delete on vacations, vacation_tasks to service_role;

-- Without this the subscription succeeds but never receives an event (see 0011).
alter publication supabase_realtime add table public.vacations, public.vacation_tasks;

-- Adds a vacation with the tasks of its template in one transaction, so a
-- failed insert can't leave a vacation without tasks that every member
-- would see and nothing would fill afterwards.
--
-- SECURITY INVOKER, unlike the other functions here: it runs as the caller,
-- so the policies and constraints above apply exactly as to a direct write,
-- and the function grants nothing a member doesn't have already. The rows
-- it returns are visible to the caller, so reading them back is safe (see
-- 0007 for when it isn't).
--
-- p_vacation: { "id", "household_id", "title", "kind", "starts_on", "ends_on" }
-- p_tasks:    [{ "id", "phase", "title", "position" }, ...]
-- The ids are generated by the client, so the rows the function confirms
-- and the Realtime echoes of their inserts share one key each.
--
-- A later migration that gives it another argument must drop this signature
-- and create the new one with a default for that argument, in one
-- migration: "create or replace" with another list of arguments would add a
-- second function, and the call of an installed app that hasn't updated yet
-- would fit both and be refused as ambiguous.
create function public.create_vacation(p_vacation jsonb, p_tasks jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_vacation public.vacations;
  v_tasks jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.vacations
    (id, household_id, title, kind, starts_on, ends_on, created_by)
  values (
    (p_vacation ->> 'id')::uuid,
    (p_vacation ->> 'household_id')::uuid,
    p_vacation ->> 'title',
    p_vacation ->> 'kind',
    (p_vacation ->> 'starts_on')::date,
    (p_vacation ->> 'ends_on')::date,
    v_user_id
  )
  returning * into v_vacation;

  with inserted as (
    insert into public.vacation_tasks
      (id, vacation_id, household_id, phase, title, position, created_by)
    select
      task.id, v_vacation.id, v_vacation.household_id,
      task.phase, task.title, task.position, v_user_id
    from jsonb_to_recordset(p_tasks)
      as task (id uuid, phase text, title text, position numeric)
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb)
    into v_tasks
    from inserted;

  return jsonb_build_object('vacation', to_jsonb(v_vacation), 'tasks', v_tasks);
end;
$$;

-- Functions are executable by PUBLIC by default; restrict to signed-in users
-- (see 0009).
revoke execute on function public.create_vacation(jsonb, jsonb) from public, anon;
grant execute on function public.create_vacation(jsonb, jsonb) to authenticated;
