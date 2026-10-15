-- Meal planner, slice 1b: the planning count behind the kill condition (see
-- docs/features/meal-planner/measuring.md), as a function instead of a query
-- pasted into the SQL editor, so the RLS suite can test it.
--
-- How many of the last 14 days, today included, have at least one planned
-- dinner that isn't removed. "Today" is the household's, given as a time zone
-- name ('Europe/Berlin'): the plan's days are calendar days without a zone.
--
-- Security invoker: the caller's RLS decides which entries are counted, so a
-- member of another household gets 0, and nobody learns about a household
-- they are not in. From the SQL editor (as postgres) it counts any household.

create function public.count_planned_dinner_days(
  p_household_id uuid,
  p_time_zone text
)
returns integer
language sql stable security invoker set search_path = '' as $$
  select count(distinct e.date)::integer
  from public.meal_plan_entries e
  where e.household_id = p_household_id
    and e.slot = 'dinner'
    and e.deleted_at is null
    and e.date between (now() at time zone p_time_zone)::date - 13
                   and (now() at time zone p_time_zone)::date;
$$;

-- As for every function in public: not for anon, and not for PUBLIC, which
-- Postgres grants EXECUTE to by default (see 0007, 0009).
revoke execute on function public.count_planned_dinner_days(uuid, text) from public, anon;
grant execute on function public.count_planned_dinner_days(uuid, text) to authenticated;
