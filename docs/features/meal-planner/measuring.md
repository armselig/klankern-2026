# Meal planner: measuring whether it is used

The kill condition for slices 2 and 3 and the query that counts the days. It counts from the end of slice 1, the release of 1b (decided 2026-10-15; see "Slice 1b" in [`features/meal-planner/slice-1b.md`](./slice-1b.md)).

## Measuring whether it is used (decided 2026-10-15)

The kill condition, set before building: **if fewer than 4 of the first 14 days after slice 1 have a planned dinner, slices 2 and 3 wait until the cause is understood.** If the tile is used and the week page is not, the page is retired rather than extended. "Plan this" counts as planned, so the number measures use of the planner as a whole. The parents also answer, by hand, whether they had the "what shall we eat" talk that week.

The count is one read-only query for the Supabase SQL editor. Set the two values at its top: the household's id and its time zone. (Replaced by a function on 2026-10-15, see "The count as a function".)

```sql
-- Days of the last 14 with at least one planned dinner, for one household.
with params as (
  select
    'the household id'::uuid as household_id,
    'Europe/Berlin'::text as time_zone
),
today as (
  select (now() at time zone (select time_zone from params))::date as day
)
select count(distinct e.date) as days_with_dinner
from meal_plan_entries e, params, today
where e.household_id = params.household_id
  and e.slot = 'dinner'
  and e.deleted_at is null
  and e.date between today.day - 13 and today.day;
```

Not checked: the review asked for this query to be tested once in the RLS suite against a seeded household; `meal-plan-isolation.spec.ts` has no such test. (Tested since 2026-10-15, see "The count as a function".)

## The count as a function (built 2026-10-15)

The query could not be tested in the RLS suite: raw SQL needs a direct Postgres connection with the database password, which CI does not have. The owner chose to wrap it in a function rather than add that secret. Migration `0019_count_planned_dinner_days.sql` (applied 2026-10-15 through the Supabase MCP server, its version renamed to `0019`) adds `count_planned_dinner_days(p_household_id, p_time_zone)`: the days of the last 14, today in the given zone included, with at least one dinner that isn't removed. It is the query above, unchanged in what it counts.

It is `security invoker`, so RLS decides what it sees: a member of another household gets 0. Only `authenticated` may call it. In the SQL editor, which runs as `postgres`, it counts any household:

```sql
select count_planned_dinner_days('the household id', 'Europe/Berlin');
```

`meal-plan-isolation.spec.ts` seeds household B with dinners on today, two on the day three days back and one 13 days back, plus a dinner 14 days back, a lunch and a removed dinner that must not count, and expects 3 (in UTC). It also checks that a member of household A gets 0 for household B and that a caller who is not signed in is refused. All pass (2026-10-15).
