import {
  addDays,
  daysBetween,
  isLocalDate,
  type LocalDate,
} from "./local-date";
import type { LoadedDateRange, MealSlot } from "~/types/meal-plan";

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

/** The days from `from` to `to`, both included: a trip's days. */
export function daysOfRange(from: LocalDate, to: LocalDate): LocalDate[] {
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) =>
    addDays(from, i),
  );
}

/** The slots in the order a day shows them: dinner first, since it is what
 * the household decides every day, then the others as the day runs. */
export const SLOTS_IN_ORDER: readonly MealSlot[] = [
  "dinner",
  "breakfast",
  "lunch",
  "snack",
];

/** A slot's name for a member to read: "Dinner". */
export function slotLabel(slot: MealSlot): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** A day the move dialog offers, with what its button says. */
export interface MoveTarget {
  day: LocalDate;
  label: string;
}

/** The days the move dialog offers as buttons: today, tomorrow and the six
 * after, by name; any other day is picked in the dialog's date field. */
export function moveTargets(today: LocalDate): MoveTarget[] {
  return Array.from({ length: 8 }, (_, i) => {
    const day = addDays(today, i);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatWeekday(day);
    return { day, label };
  });
}

/** What a trip's link to its meals says: "3 dinners planned". */
export function dinnersPlannedLine(count: number): string {
  if (count === 0) return "No dinners planned";
  return `${count} ${count === 1 ? "dinner" : "dinners"} planned`;
}
