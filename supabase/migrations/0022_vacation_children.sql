-- Vacation planner: the household's children on a trip. A person on a trip
-- can be one of the household's children (0021) instead of a typed name, so
-- a child is picked, not typed again for every trip, and is named as the
-- household's list of children names them. Everything here adds to 0016;
-- an installed app that hasn't updated yet keeps working, and its people
-- are typed names as before.

-- The child this person is, or null for a member or a typed name. name is
-- still written when the child is added; the app shows the child's own name
-- over it, so a child renamed on the kids' page is renamed on every trip.
alter table vacation_people
  add column child_id uuid,
  -- The child is one of this household's: the composite key keeps it equal
  -- to the trip's household, as for a member. Children are only
  -- soft-deleted; should the row go all the same, the person stays on the
  -- trip as a name.
  add constraint vacation_people_child_fkey foreign key (child_id, household_id)
    references household_children (id, household_id)
    on delete set null (child_id),
  -- A person is a member, a child or a typed name, never two of them.
  add constraint vacation_people_member_or_child check (
    user_id is null or child_id is null
  );

-- A child is on a vacation once. Only among the live rows, as for members
-- (see vacation_people_member_once_idx in 0016).
create unique index vacation_people_child_once_idx
  on vacation_people (vacation_id, child_id)
  where deleted_at is null and child_id is not null;
-- For the foreign key to household_children.
create index vacation_people_child_idx on vacation_people (household_id, child_id);

-- The children typed as names before this migration are linked where the
-- name says without doubt who it is: one live child of the household and
-- one live typed person of the trip carry it, compared without case and
-- surrounding spaces. Every other typed name stays as it is.
update vacation_people person
set child_id = child.id
from household_children child
where person.child_id is null
  and person.user_id is null
  and person.deleted_at is null
  and child.household_id = person.household_id
  and child.deleted_at is null
  and lower(btrim(child.name)) = lower(btrim(person.name))
  and (
    select count(*) from household_children other
    where other.household_id = person.household_id
      and other.deleted_at is null
      and lower(btrim(other.name)) = lower(btrim(person.name))
  ) = 1
  and (
    select count(*) from vacation_people other
    where other.vacation_id = person.vacation_id
      and other.user_id is null
      and other.deleted_at is null
      and lower(btrim(other.name)) = lower(btrim(person.name))
  ) = 1;

-- create_vacation also writes the child of a person. Its arguments stay
-- the same, so "create or replace" replaces it and adds no second function
-- (see 0015). The call of an app that hasn't updated yet sends no child_id,
-- which is read as null.
--
-- p_people: [{ "id", "name", "user_id", "child_id" }, ...]; user_id and
-- child_id are null for a typed name.
create or replace function public.create_vacation(
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
      (id, vacation_id, household_id, name, user_id, child_id, created_by)
    select
      person.id, v_vacation.id, v_vacation.household_id,
      person.name, person.user_id, person.child_id, v_user_id
    from jsonb_to_recordset(p_people)
      as person (id uuid, name text, user_id uuid, child_id uuid)
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

-- "create or replace" keeps the grants, but they are stated again so this
-- migration reads alone (see 0009).
revoke execute on function public.create_vacation(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_vacation(jsonb, jsonb, jsonb) to authenticated;
