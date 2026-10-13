-- Vacation planner, slice 2: the people on a trip, and tasks given to them.
-- An assignment is a proposal: the person does the task or rejects it with a
-- reason, and a rejected task is nobody's again. Everything here adds to
-- 0015; an installed app that hasn't updated yet keeps working.

create table vacation_people (
  id uuid primary key default gen_random_uuid(),
  vacation_id uuid not null,
  household_id uuid not null,
  -- What the trip calls the person. A member has no name in the app, only
  -- an email address, so a member's name is typed here too.
  name text not null,
  -- The member this person is, or null for a person without an account: a
  -- small child, a guest. Such a person can be given a task and cannot
  -- reject one.
  user_id uuid,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  -- Set when a person is taken off the trip. The row stays, so a rejection
  -- keeps its name; the app shows that person's open tasks as nobody's.
  deleted_at timestamptz,
  -- household_id is denormalized for RLS and the Realtime filter; the
  -- composite key keeps it equal to the vacation's (see 0015).
  constraint vacation_people_vacation_fkey foreign key (vacation_id, household_id)
    references vacations (id, household_id) on delete cascade,
  -- A person tied to an account is a member of this household. When the
  -- membership goes, the person stays on the trip as a name.
  constraint vacation_people_member_fkey foreign key (household_id, user_id)
    references household_members (household_id, user_id)
    on delete set null (user_id),
  -- Target of the composite foreign keys on vacation_tasks.
  constraint vacation_people_id_vacation_id_key unique (id, vacation_id),
  constraint vacation_people_name_shape check (
    name ~ '\S' and char_length(name) <= 100
  )
);

-- A member is on a vacation once. Only among the live rows, so a member who
-- was taken off can be added again; and not for people without an account,
-- of whom two may share a name.
create unique index vacation_people_member_once_idx
  on vacation_people (vacation_id, user_id)
  where deleted_at is null and user_id is not null;
-- For the cascade from vacations.
create index vacation_people_vacation_id_idx on vacation_people (vacation_id);
-- For loading a household's people, across its vacations, paged by id. Not
-- partial: removed people are loaded too, for the names of old rejections.
create index vacation_people_household_id_idx on vacation_people (household_id, id);
-- For the foreign key to household_members.
create index vacation_people_member_idx on vacation_people (household_id, user_id);
create index vacation_people_created_by_idx on vacation_people (created_by);

alter table vacation_people enable row level security;

create policy "members rw vacation people" on vacation_people
  for all to authenticated
  using (is_household_member(household_id)) with check (is_household_member(household_id));

-- As in 0015: written, edited or soft-deleted, never hard-deleted.
revoke all on vacation_people from public, anon, authenticated;
grant select, insert, update on vacation_people to authenticated;
grant select, insert, update, delete on vacation_people to service_role;

-- Without this the subscription succeeds but never receives an event (see 0011).
alter publication supabase_realtime add table public.vacation_people;

-- Who has a task, and who said no. A task is nobody's (both null), someone's
-- (assignee_id), or was rejected (rejected_by with its reason) and is
-- nobody's until someone takes it. Only the latest rejection is kept.
--
-- The household is the trust boundary: the app offers "Reject" to the
-- assignee alone, but nothing here stops one member from changing another
-- member's task.
alter table vacation_tasks
  add column assignee_id uuid,
  add column rejected_by uuid,
  add column rejection_reason text,
  -- Both point at a person of the same vacation. No delete action: people
  -- are never hard-deleted except with their vacation, which takes the
  -- tasks along in the same statement.
  add constraint vacation_tasks_assignee_fkey foreign key (assignee_id, vacation_id)
    references vacation_people (id, vacation_id),
  add constraint vacation_tasks_rejected_by_fkey foreign key (rejected_by, vacation_id)
    references vacation_people (id, vacation_id),
  -- A reason exists exactly when someone said no, and says something. With
  -- a title and a reason of 200 four-byte characters each the row is about
  -- 1,760 bytes, some 270 below the size at which Postgres stores a long
  -- value out of line (see the byte budget in 0015). Another text column on
  -- this table has to count again.
  add constraint vacation_tasks_rejection_shape check (
    (rejected_by is null) = (rejection_reason is null)
    and (
      rejection_reason is null
      or (rejection_reason ~ '\S' and char_length(rejection_reason) <= 200)
    )
  ),
  add constraint vacation_tasks_assigned_or_rejected check (
    assignee_id is null or rejected_by is null
  );

-- For the two foreign keys.
create index vacation_tasks_assignee_id_idx on vacation_tasks (assignee_id);
create index vacation_tasks_rejected_by_idx on vacation_tasks (rejected_by);

-- create_vacation now also writes the people who are coming. The old
-- signature is dropped and the new one created here, in one migration, as
-- 0015 says: with "create or replace" both would exist, and the call of an
-- installed app that hasn't updated yet, which names two arguments, would
-- fit both and be refused as ambiguous. It fits the new one alone, through
-- the default.
--
-- p_people: [{ "id", "name", "user_id" }, ...]; user_id is null for a person
-- without an account.
drop function public.create_vacation(jsonb, jsonb);

create function public.create_vacation(
  p_vacation jsonb,
  p_tasks jsonb,
  p_people jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_vacation public.vacations;
  v_tasks jsonb;
  v_people jsonb;
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
    insert into public.vacation_people
      (id, vacation_id, household_id, name, user_id, created_by)
    select
      person.id, v_vacation.id, v_vacation.household_id,
      person.name, person.user_id, v_user_id
    from jsonb_to_recordset(p_people)
      as person (id uuid, name text, user_id uuid)
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb)
    into v_people
    from inserted;

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

  return jsonb_build_object(
    'vacation', to_jsonb(v_vacation),
    'tasks', v_tasks,
    'people', v_people
  );
end;
$$;

-- A function created anew is executable by PUBLIC again (see 0009).
revoke execute on function public.create_vacation(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_vacation(jsonb, jsonb, jsonb) to authenticated;
