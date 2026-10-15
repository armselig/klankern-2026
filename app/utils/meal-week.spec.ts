import { describe, expect, it } from "vitest";
import {
  COOKED_LOOKBACK_WEEKS,
  dashboardRange,
  DASHBOARD_DAYS_AHEAD,
  daysOfRange,
  dinnersPlannedLine,
  formatWeekday,
  isRangeLoaded,
  mondayOf,
  moveTargets,
  slotLabel,
  SLOTS_IN_ORDER,
  tonightDay,
  weekDays,
  weekFromParam,
} from "./meal-week";

const TODAY = "2026-10-15";

describe("dashboardRange", () => {
  it("reaches back by the lookback and ahead by the dashboard's days", () => {
    expect(COOKED_LOOKBACK_WEEKS).toBe(8);
    expect(DASHBOARD_DAYS_AHEAD).toBe(7);
    expect(dashboardRange(TODAY)).toEqual({
      from: "2026-08-20",
      to: "2026-10-22",
    });
  });

  it("crosses the end of a year", () => {
    expect(dashboardRange("2027-01-01")).toEqual({
      from: "2026-11-06",
      to: "2027-01-08",
    });
  });
});

describe("isRangeLoaded", () => {
  const wanted = { from: "2026-10-05", to: "2026-10-11" };

  it("is false when nothing is loaded", () => {
    expect(isRangeLoaded([], wanted)).toBe(false);
  });

  it("is true when one range covers the days, ends included", () => {
    expect(isRangeLoaded([wanted], wanted)).toBe(true);
    expect(
      isRangeLoaded([{ from: "2026-09-01", to: "2026-12-31" }], wanted),
    ).toBe(true);
  });

  it("is false when the loaded range stops a day short at either end", () => {
    expect(
      isRangeLoaded([{ from: "2026-10-06", to: "2026-10-11" }], wanted),
    ).toBe(false);
    expect(
      isRangeLoaded([{ from: "2026-10-05", to: "2026-10-10" }], wanted),
    ).toBe(false);
  });

  it("is true when two touching ranges cover the days together", () => {
    expect(
      isRangeLoaded(
        [
          { from: "2026-10-05", to: "2026-10-08" },
          { from: "2026-10-09", to: "2026-10-20" },
        ],
        wanted,
      ),
    ).toBe(true);
  });

  it("is true for overlapping ranges", () => {
    expect(
      isRangeLoaded(
        [
          { from: "2026-10-01", to: "2026-10-08" },
          { from: "2026-10-07", to: "2026-10-12" },
        ],
        wanted,
      ),
    ).toBe(true);
  });

  it("is false when a gap of one day lies between the ranges", () => {
    expect(
      isRangeLoaded(
        [
          { from: "2026-10-05", to: "2026-10-07" },
          { from: "2026-10-09", to: "2026-10-11" },
        ],
        wanted,
      ),
    ).toBe(false);
  });

  it("does not depend on the order of the loaded ranges", () => {
    expect(
      isRangeLoaded(
        [
          { from: "2026-10-09", to: "2026-10-20" },
          { from: "2026-09-01", to: "2026-10-08" },
        ],
        wanted,
      ),
    ).toBe(true);
  });

  it("ignores ranges that lie entirely before or after", () => {
    expect(
      isRangeLoaded(
        [
          { from: "2026-01-01", to: "2026-02-01" },
          { from: "2026-12-01", to: "2026-12-31" },
        ],
        wanted,
      ),
    ).toBe(false);
  });
});

describe("tonightDay", () => {
  it("is today up to 16:59", () => {
    expect(tonightDay(TODAY, 0)).toBe(TODAY);
    expect(tonightDay(TODAY, 16)).toBe(TODAY);
  });

  it("is tomorrow from 17:00", () => {
    expect(tonightDay(TODAY, 17)).toBe("2026-10-16");
    expect(tonightDay(TODAY, 23)).toBe("2026-10-16");
  });

  it("rolls over the end of a month", () => {
    expect(tonightDay("2026-10-31", 18)).toBe("2026-11-01");
  });
});

describe("mondayOf", () => {
  it("is the day itself for a Monday", () => {
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
  });

  it("goes back six days from a Sunday", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
  });

  it("finds the Monday of a midweek day", () => {
    expect(mondayOf("2026-10-20")).toBe("2026-10-19");
  });

  it("goes back into the month before", () => {
    expect(mondayOf("2026-03-01")).toBe("2026-02-23");
  });

  it("goes back into the year before", () => {
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("is not moved by the change to summer time", () => {
    expect(mondayOf("2026-03-29")).toBe("2026-03-23");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
  });

  it("handles days before 1970", () => {
    expect(mondayOf("1969-12-31")).toBe("1969-12-29");
  });
});

describe("weekDays", () => {
  it("lists the seven days from the Monday", () => {
    expect(weekDays("2026-10-19")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("runs over the end of a year", () => {
    const days = weekDays("2026-12-28");
    expect(days[4]).toBe("2027-01-01");
    expect(days).toHaveLength(7);
  });
});

describe("weekFromParam", () => {
  it("normalises a day in the middle of a week to its Monday", () => {
    expect(weekFromParam("2026-10-22", TODAY)).toBe("2026-10-19");
  });

  it("keeps a Monday", () => {
    expect(weekFromParam("2026-10-19", TODAY)).toBe("2026-10-19");
  });

  it("falls back to this week without a parameter", () => {
    expect(weekFromParam(undefined, TODAY)).toBe("2026-10-12");
    expect(weekFromParam(null, TODAY)).toBe("2026-10-12");
  });

  it("falls back to this week for text that is no day", () => {
    expect(weekFromParam("garbage", TODAY)).toBe("2026-10-12");
    expect(weekFromParam("", TODAY)).toBe("2026-10-12");
  });

  it("falls back to this week for a day that does not exist", () => {
    expect(weekFromParam("2026-02-30", TODAY)).toBe("2026-10-12");
  });

  it("falls back to this week for a value that is not a string", () => {
    expect(weekFromParam(["2026-10-22"], TODAY)).toBe("2026-10-12");
    expect(weekFromParam(20261022, TODAY)).toBe("2026-10-12");
  });
});

describe("formatWeekday", () => {
  it("gives the weekday, day and month", () => {
    expect(formatWeekday("2026-10-20")).toBe("Tue 20 Oct");
  });

  it("gives a Sunday and a single-digit day", () => {
    expect(formatWeekday("2026-11-01")).toBe("Sun 1 Nov");
  });
});

describe("daysOfRange", () => {
  it("is the one day for a single-day range", () => {
    expect(daysOfRange(TODAY, TODAY)).toEqual([TODAY]);
  });

  it("includes both ends", () => {
    expect(daysOfRange("2026-10-15", "2026-10-17")).toEqual([
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
  });

  it("runs over the end of a month", () => {
    expect(daysOfRange("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("runs over the end of a year", () => {
    expect(daysOfRange("2026-12-31", "2027-01-01")).toEqual([
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("has no skipped or doubled day over the change to summer time", () => {
    expect(daysOfRange("2026-03-28", "2026-03-30")).toEqual([
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
    ]);
  });

  it("has no skipped or doubled day over the change back to winter time", () => {
    expect(daysOfRange("2026-10-24", "2026-10-26")).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
    ]);
  });
});

describe("SLOTS_IN_ORDER", () => {
  it("lists dinner first, then the others as the day runs", () => {
    expect(SLOTS_IN_ORDER).toEqual(["dinner", "breakfast", "lunch", "snack"]);
  });
});

describe("slotLabel", () => {
  it("capitalises the slot's name", () => {
    expect(SLOTS_IN_ORDER.map(slotLabel)).toEqual([
      "Dinner",
      "Breakfast",
      "Lunch",
      "Snack",
    ]);
  });
});

describe("moveTargets", () => {
  it("offers eight days, today and tomorrow by name", () => {
    const targets = moveTargets(TODAY);
    expect(targets).toHaveLength(8);
    expect(targets[0]).toEqual({ day: "2026-10-15", label: "Today" });
    expect(targets[1]).toEqual({ day: "2026-10-16", label: "Tomorrow" });
  });

  it("names the six days after tomorrow by weekday across a month end", () => {
    expect(moveTargets("2026-10-29")).toEqual([
      { day: "2026-10-29", label: "Today" },
      { day: "2026-10-30", label: "Tomorrow" },
      { day: "2026-10-31", label: "Sat 31 Oct" },
      { day: "2026-11-01", label: "Sun 1 Nov" },
      { day: "2026-11-02", label: "Mon 2 Nov" },
      { day: "2026-11-03", label: "Tue 3 Nov" },
      { day: "2026-11-04", label: "Wed 4 Nov" },
      { day: "2026-11-05", label: "Thu 5 Nov" },
    ]);
  });
});

describe("dinnersPlannedLine", () => {
  it("says no dinners are planned for none", () => {
    expect(dinnersPlannedLine(0)).toBe("No dinners planned");
  });

  it("uses the singular for one", () => {
    expect(dinnersPlannedLine(1)).toBe("1 dinner planned");
  });

  it("uses the plural for several", () => {
    expect(dinnersPlannedLine(3)).toBe("3 dinners planned");
  });
});
