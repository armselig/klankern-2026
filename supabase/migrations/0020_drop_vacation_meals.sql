-- Meal planner, slice 1b: a trip's meals are the meal plan's entries on the
-- trip's days (/meals?trip=<id>), so the table of 0017 goes, with its rows.
-- Its rows had no day, so they could not be moved into meal_plan_entries.
--
-- Apply only once the release without the trip's old meals page is live and
-- the installed apps have updated: an older app fetches vacation_meals with
-- the vacations, and that fetch failing leaves its vacation pages empty.
--
-- recipes_id_household_id_key (0017) stays: meal_plan_entries' foreign key
-- to recipes (0018) needs it. The policy, grants and indexes go with the
-- table.

alter publication supabase_realtime drop table public.vacation_meals;

drop table vacation_meals;
