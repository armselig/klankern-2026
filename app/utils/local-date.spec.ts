import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDay, localDateOf } from "./local-date";

describe("localDateOf", () => {
  // The dates are built from local parts, so the tests hold in any time zone.
  it("gives the device's day just after midnight", () => {
    expect(localDateOf(new Date(2026, 11, 5, 0, 0, 1))).toBe("2026-12-05");
  });

  it("gives the device's day just before midnight", () => {
    expect(localDateOf(new Date(2026, 11, 5, 23, 59, 59))).toBe("2026-12-05");
  });

  it("pads the month and the day", () => {
    expect(localDateOf(new Date(2027, 0, 3, 12))).toBe("2027-01-03");
  });
});

describe("daysBetween", () => {
  it("is 0 for the same day", () => {
    expect(daysBetween("2026-12-05", "2026-12-05")).toBe(0);
  });

  it("counts forwards and backwards", () => {
    expect(daysBetween("2026-12-05", "2026-12-12")).toBe(7);
    expect(daysBetween("2026-12-12", "2026-12-05")).toBe(-7);
  });

  it("counts across the end of a month and of a year", () => {
    expect(daysBetween("2026-11-30", "2026-12-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("counts the leap day", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
  });

  it("counts whole days across both changes of the clock", () => {
    // Europe's clocks change on these nights; a day is then 23 or 25 hours
    // long in local time, which is why the arithmetic is done in UTC.
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("refuses a value that is not a calendar day", () => {
    expect(() => daysBetween("2026-12-05T00:00:00Z", "2026-12-06")).toThrow(
      "Not a calendar day",
    );
  });
});

describe("addDays", () => {
  it("stays in the month", () => {
    expect(addDays("2026-12-05", 7)).toBe("2026-12-12");
  });

  it("goes past the end of a month", () => {
    expect(addDays("2026-11-20", 14)).toBe("2026-12-04");
    expect(addDays("2027-01-31", 1)).toBe("2027-02-01");
  });

  it("goes past the end of a year", () => {
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
  });

  it("goes back for a negative count", () => {
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("is undone by daysBetween", () => {
    expect(daysBetween("2026-12-05", addDays("2026-12-05", 400))).toBe(400);
  });
});

describe("formatDay", () => {
  it("names the day and the month", () => {
    expect(formatDay("2026-12-05")).toBe("5 Dec");
  });

  it("adds the year when asked", () => {
    expect(formatDay("2026-12-05", true)).toBe("5 Dec 2026");
  });

  it("does not shift the day by the device's time zone", () => {
    expect(formatDay("2027-01-01")).toBe("1 Jan");
    expect(formatDay("2026-12-31")).toBe("31 Dec");
  });
});
