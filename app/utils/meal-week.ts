import {
  addDays,
  daysBetween,
  isLocalDate,
  type LocalDate,
} from "./local-date";
import type { LoadedDateRange } from "~/types/meal-plan";

/** How many weeks back the Tonight tile looks to tell when a recipe was last
 * cooked; a recipe not planned in that time counts as not cooked for good. */
export const COOKED_LOOKBACK_WEEKS = 8;

/** From this hour on, the Tonight tile shows tomorrow's dinner: by then
 * tonight's is cooked or decided. */
export const TONIGHT_SWITCH_HOUR = 17;

/** How many days ahead of today the dashboard fetches. */
export const DASHBOARD_DAYS_AHEAD = 2;

/** The days the dashboard needs: the lookback before today, and a little
 * ahead for the planned dinners and the switch to tomorrow. */
export function dashboardRange(today: LocalDate): LoadedDateRange {
  return {
    from: addDays(today, -COOKED_LOOKBACK_WEEKS * 7),
    to: addDays(today, DASHBOARD_DAYS_AHEAD),
  };
}

/** Whether every day of `wanted` lies inside one of the fetched ranges. A
 * span that is covered only by two touching ranges together counts too. */
export function isRangeLoaded(
  loaded: LoadedDateRange[],
  wanted: LoadedDateRange,
): boolean {
  let covered = wanted.from;
  for (const range of [...loaded].sort((a, b) =>
    a.from.localeCompare(b.from),
  )) {
    if (range.from > covered) return false;
    if (range.to >= covered) covered = addDays(range.to, 1);
    if (covered > wanted.to) return true;
  }
  return covered > wanted.to;
}

/** The day Tonight shows: today, or from the switch hour on, tomorrow. */
export function tonightDay(today: LocalDate, hour: number): LocalDate {
  return hour >= TONIGHT_SWITCH_HOUR ? addDays(today, 1) : today;
}

/** A Monday, the anchor of the days-of-the-week count below. */
const A_MONDAY: LocalDate = "1970-01-05";

/** The Monday of the week a day is in: weeks start on Monday, fixed. */
export function mondayOf(day: LocalDate): LocalDate {
  const sinceMonday = ((daysBetween(A_MONDAY, day) % 7) + 7) % 7;
  return addDays(day, -sinceMonday);
}

/** The seven days of the week that starts on `monday`. */
export function weekDays(monday: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * The week a page shows, from its `?week=` parameter: the Monday of the day
 * given, or this week's when there is none or it is no day.
 */
export function weekFromParam(param: unknown, today: LocalDate): LocalDate {
  return mondayOf(
    typeof param === "string" && isLocalDate(param) ? param : today,
  );
}

/** A day for a member to read, with its weekday: "Tue 20 Oct". Formatted in
 * UTC for the reason given at formatDay. */
export function formatWeekday(day: LocalDate): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${day}T00:00:00Z`))
    .replace(",", "");
}
