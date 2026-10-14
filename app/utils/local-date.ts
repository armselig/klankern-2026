/**
 * Calendar days without a time, as "YYYY-MM-DD": the form a Postgres `date`
 * column and a native date field both have. Two such strings compare as
 * their days do, so "is it past the end date" is a string comparison.
 *
 * A day must never go through `new Date("2026-12-05")`: that is midnight in
 * UTC, which is still the 4th west of Greenwich, and a comparison of
 * timestamps is then a day off around midnight. Here a device's clock is
 * turned into its local day once (`localDateOf`), and all arithmetic on days
 * is done in one time base, UTC, which has no daylight saving and so no day
 * of 23 or 25 hours.
 */
export type LocalDate = string;

const DAY_MS = 86_400_000;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day as a count of days since 1970, for arithmetic. */
function dayNumber(day: LocalDate): number {
  const match = LOCAL_DATE.exec(day);
  if (!match) throw new Error(`Not a calendar day: "${day}"`);
  const [, year, month, date] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(date)) / DAY_MS;
}

/** Whether a value is a calendar day that exists, such as one typed into a
 * field: "2026-02-30" has the form of one but is no day. */
export function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE.test(value)) return false;
  return addDays(value, 0) === value;
}

/** The calendar day a moment falls on where the device is. */
export function localDateOf(moment: Date): LocalDate {
  const year = String(moment.getFullYear()).padStart(4, "0");
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const date = String(moment.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

/** How many days `to` lies after `from`; negative when it lies before. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return dayNumber(to) - dayNumber(from);
}

/** The day that many days later, or earlier for a negative count. */
export function addDays(day: LocalDate, days: number): LocalDate {
  return new Date((dayNumber(day) + days) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * A day for a member to read: "12 Dec", or "12 Dec 2026" where the year is
 * not obvious. Formatted in UTC because the day was placed there for the
 * arithmetic; formatting in the device's zone would shift it again.
 */
export function formatDay(day: LocalDate, withYear = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(dayNumber(day) * DAY_MS));
}
