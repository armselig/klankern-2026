import { describe, expect, it } from "vitest";
import type { RowRealtimeEvent } from "~/types/synced-row";
import type { Vacation, VacationPhase, VacationTask } from "~/types/vacation";
import {
  UNPACKING_DAYS,
  applyRowEdit,
  applyVacationRowEvent,
  changedVacationDetails,
  groupVacations,
  isCurrentVacation,
  isReadyToGo,
  openTaskCount,
  phaseSummary,
  phasesOpenAtFirst,
  revertRowEdit,
  stageLine,
  stageOf,
  tasksInPhase,
  tasksOfVacation,
  vacationDates,
  vacationDetailsProblem,
  vacationTilePreview,
  openTasksLine,
} from "./vacation-state";

const HOUSEHOLD = "house-1";

/** A week by the sea, 5 to 12 December 2026. */
function vacation(overrides: Partial<Vacation> = {}): Vacation {
  return {
    id: "vacation-1",
    household_id: HOUSEHOLD,
    title: "Winter week by the sea",
    kind: "house",
    starts_on: "2026-12-05",
    ends_on: "2026-12-12",
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function task(overrides: Partial<VacationTask> = {}): VacationTask {
  return {
    id: "task-1",
    vacation_id: "vacation-1",
    household_id: HOUSEHOLD,
    phase: "before",
    title: "Clothes",
    done: false,
    position: 1,
    assignee_id: null,
    rejected_by: null,
    rejection_reason: null,
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

/** One task per entry: a phase and whether it is done. */
function tasks(...entries: [VacationPhase, boolean][]): VacationTask[] {
  return entries.map(([phase, done], index) =>
    task({ id: `task-${index + 1}`, phase, done, position: index + 1 }),
  );
}

function byId<T extends { id: string }>(...rows: T[]): Record<string, T> {
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

function event<T extends { id: string }>(
  row: T,
  eventType: RowRealtimeEvent<T>["eventType"] = "UPDATE",
): RowRealtimeEvent<T> {
  return { eventType, new: row, commitTimestamp: "2026-10-01T00:00:00.000Z" };
}

describe("applyVacationRowEvent", () => {
  it("adds a row another member wrote", () => {
    expect(
      applyVacationRowEvent({}, event(task(), "INSERT"), HOUSEHOLD),
    ).toEqual({ "task-1": task() });
  });

  it("makes the echo of our own write a no-op (same id, no duplicate)", () => {
    const state = byId(task());
    const next = applyVacationRowEvent(
      state,
      event(task(), "INSERT"),
      HOUSEHOLD,
    );
    expect(Object.keys(next)).toEqual(["task-1"]);
  });

  it("replaces the row with the event's", () => {
    const next = applyVacationRowEvent(
      byId(task()),
      event(task({ done: true, title: "Warm clothes" })),
      HOUSEHOLD,
    );
    expect(next["task-1"]).toEqual(task({ done: true, title: "Warm clothes" }));
  });

  it("takes a removal by another member", () => {
    const removed = vacation({ deleted_at: "2026-10-02T00:00:00Z" });
    const next = applyVacationRowEvent(
      byId(vacation()),
      event(removed),
      HOUSEHOLD,
    );
    expect(next["vacation-1"]!.deleted_at).toBe("2026-10-02T00:00:00Z");
  });

  it("does not undo a local soft delete", () => {
    const state = byId(task({ deleted_at: "2026-10-02T00:00:00Z" }));
    expect(
      applyVacationRowEvent(state, event(task({ done: true })), HOUSEHOLD),
    ).toBe(state);
  });

  it("ignores a row of another household", () => {
    const state = byId(task());
    const foreign = task({ id: "task-9", household_id: "house-2" });
    expect(
      applyVacationRowEvent(state, event(foreign, "INSERT"), HOUSEHOLD),
    ).toBe(state);
  });

  it("ignores every event until a household is loaded", () => {
    expect(applyVacationRowEvent({}, event(task(), "INSERT"), null)).toEqual(
      {},
    );
  });
});

describe("applyRowEdit and revertRowEdit", () => {
  it("lays the changed fields over the row", () => {
    const next = applyRowEdit(byId(vacation()), "vacation-1", {
      title: "Week by the sea",
    });
    expect(next["vacation-1"]).toEqual(vacation({ title: "Week by the sea" }));
  });

  it("changes nothing for a removed or unknown row", () => {
    const state = byId(vacation({ deleted_at: "2026-10-02T00:00:00Z" }));
    expect(applyRowEdit(state, "vacation-1", { title: "x" })).toBe(state);
    expect(applyRowEdit(state, "vacation-2", { title: "x" })).toBe(state);
  });

  it("takes back only the fields of the refused edit", () => {
    const previous = vacation();
    // The refused edit changed the title; meanwhile another member's change
    // of the end date arrived.
    const state = byId(
      vacation({ title: "Week by the sea", ends_on: "2026-12-14" }),
    );
    const next = revertRowEdit(state, previous, { title: "Week by the sea" });
    expect(next["vacation-1"]).toEqual(vacation({ ends_on: "2026-12-14" }));
  });

  it("keeps a removal that arrived while the edit was on its way", () => {
    const state = byId(
      task({ title: "Warm clothes", deleted_at: "2026-10-02T00:00:00Z" }),
    );
    const next = revertRowEdit(state, task(), { title: "Warm clothes" });
    expect(next["task-1"]).toEqual(
      task({ deleted_at: "2026-10-02T00:00:00Z" }),
    );
  });

  it("does not bring back a row that left state", () => {
    expect(revertRowEdit({}, task(), { title: "x" })).toEqual({});
  });
});

describe("changedVacationDetails", () => {
  const previous = {
    title: "Winter week by the sea",
    starts_on: "2026-12-05",
    ends_on: "2026-12-12",
  };

  it("is empty when nothing changed", () => {
    expect(changedVacationDetails(previous, { ...previous })).toEqual({});
  });

  it("names only the changed fields", () => {
    expect(
      changedVacationDetails(previous, { ...previous, ends_on: "2026-12-14" }),
    ).toEqual({ ends_on: "2026-12-14" });
  });

  it("trims the title, and does not count spaces around it as a change", () => {
    expect(
      changedVacationDetails(previous, {
        ...previous,
        title: "  Winter week by the sea ",
      }),
    ).toEqual({});
    expect(
      changedVacationDetails(previous, { ...previous, title: " Sea week " }),
    ).toEqual({ title: "Sea week" });
  });
});

describe("tasksOfVacation", () => {
  it("leaves out removed tasks and other vacations' tasks", () => {
    const state = byId(
      task(),
      task({ id: "task-2", deleted_at: "2026-10-02T00:00:00Z" }),
      task({ id: "task-3", vacation_id: "vacation-2" }),
    );
    expect(tasksOfVacation(state, "vacation-1").map((t) => t.id)).toEqual([
      "task-1",
    ]);
  });
});

describe("tasksInPhase", () => {
  it("keeps only the phase's tasks, in their order", () => {
    const list = [
      task({ id: "b", position: 2 }),
      task({ id: "x", phase: "during", position: 1 }),
      task({ id: "a", position: 1 }),
    ];
    expect(tasksInPhase(list, "before").map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("moves the done tasks to the end, in their order", () => {
    const list = [
      task({ id: "a", position: 1, done: true }),
      task({ id: "b", position: 2 }),
      task({ id: "c", position: 3, done: true }),
      task({ id: "d", position: 4 }),
    ];
    expect(tasksInPhase(list, "before").map((t) => t.id)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("orders two tasks at the same position the same way on every screen", () => {
    const one = task({ id: "b", position: 5 });
    const other = task({ id: "a", position: 5 });
    expect(tasksInPhase([one, other], "before")).toEqual(
      tasksInPhase([other, one], "before"),
    );
  });

  it("does not reorder the list it was given", () => {
    const list = [task({ id: "b", position: 2 }), task({ id: "a" })];
    tasksInPhase(list, "before");
    expect(list.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("phaseSummary", () => {
  it("counts the open tasks", () => {
    const list = tasks(["before", false], ["before", true], ["before", false]);
    expect(openTaskCount(list)).toBe(2);
    expect(phaseSummary(list)).toBe("2 open");
  });

  it("says so when every task is done", () => {
    expect(phaseSummary(tasks(["before", true]))).toBe("All done");
  });

  it("does not call a phase without tasks done", () => {
    expect(phaseSummary([])).toBe("Nothing here yet");
  });
});

describe("stageOf", () => {
  it.each([
    ["2026-12-04", "before"],
    ["2026-12-05", "during"],
    ["2026-12-12", "during"],
    ["2026-12-13", "after"],
  ])("on %s the trip is %s", (today, stage) => {
    expect(stageOf(vacation(), today)).toBe(stage);
  });

  it("puts a trip of one day in 'during' on that day only", () => {
    const day = vacation({ starts_on: "2026-12-05", ends_on: "2026-12-05" });
    expect(stageOf(day, "2026-12-04")).toBe("before");
    expect(stageOf(day, "2026-12-05")).toBe("during");
    expect(stageOf(day, "2026-12-06")).toBe("after");
  });
});

describe("stageLine", () => {
  it.each([
    ["2026-10-12", "in 54 days"],
    ["2026-12-03", "in 2 days"],
    ["2026-12-04", "tomorrow"],
    ["2026-12-05", "day 1 of 8"],
    ["2026-12-07", "day 3 of 8"],
    ["2026-12-12", "day 8 of 8"],
    ["2026-12-13", "back since 12 Dec"],
    ["2027-01-02", "back since 12 Dec 2026"],
  ])("on %s it says '%s'", (today, line) => {
    expect(stageLine(vacation(), today)).toBe(line);
  });

  it("counts the days of a trip across the end of a year", () => {
    const trip = vacation({ starts_on: "2026-12-28", ends_on: "2027-01-03" });
    expect(stageLine(trip, "2027-01-01")).toBe("day 5 of 7");
  });
});

describe("vacationDates", () => {
  const today = "2026-10-12";

  it("names the month once for a trip within a month", () => {
    expect(vacationDates(vacation(), today)).toBe("5 to 12 Dec");
  });

  it("names both months otherwise", () => {
    const trip = vacation({ starts_on: "2026-11-28", ends_on: "2026-12-05" });
    expect(vacationDates(trip, today)).toBe("28 Nov to 5 Dec");
  });

  it("names a single day once", () => {
    const day = vacation({ starts_on: "2026-12-05", ends_on: "2026-12-05" });
    expect(vacationDates(day, today)).toBe("5 Dec");
  });

  it("leaves the year out for a trip of next year", () => {
    const trip = vacation({ starts_on: "2027-04-03", ends_on: "2027-04-07" });
    expect(vacationDates(trip, today)).toBe("3 to 7 Apr");
  });

  it("adds the year to a trip that ended in an earlier year", () => {
    expect(vacationDates(vacation(), "2027-03-01")).toBe("5 to 12 Dec 2026");
  });
});

describe("phasesOpenAtFirst", () => {
  const allOpen = tasks(["before", false], ["during", false], ["after", false]);

  it("opens the phase of today and folds the later ones", () => {
    expect(phasesOpenAtFirst(vacation(), allOpen, "2026-10-12")).toEqual([
      "before",
    ]);
  });

  it("keeps an earlier phase open while it has open tasks", () => {
    expect(phasesOpenAtFirst(vacation(), allOpen, "2026-12-07")).toEqual([
      "before",
      "during",
    ]);
    expect(phasesOpenAtFirst(vacation(), allOpen, "2026-12-13")).toEqual([
      "before",
      "during",
      "after",
    ]);
  });

  it("folds an earlier phase that is done", () => {
    const list = tasks(["before", true], ["during", false], ["after", false]);
    expect(phasesOpenAtFirst(vacation(), list, "2026-12-07")).toEqual([
      "during",
    ]);
  });

  it("folds today's phase too once everything in it is done", () => {
    const list = tasks(["before", true], ["during", false]);
    expect(phasesOpenAtFirst(vacation(), list, "2026-12-04")).toEqual([]);
  });

  it("opens today's phase while it is empty, for its first task", () => {
    expect(phasesOpenAtFirst(vacation(), [], "2026-12-07")).toEqual(["during"]);
  });

  it("does not open an earlier phase that is empty", () => {
    const list = tasks(["after", false]);
    expect(phasesOpenAtFirst(vacation(), list, "2026-12-13")).toEqual([
      "after",
    ]);
  });
});

describe("isReadyToGo", () => {
  const packed = tasks(["before", true], ["before", true], ["during", false]);

  it("is true when every task before the trip is done", () => {
    expect(isReadyToGo(vacation(), packed, "2026-12-04")).toBe(true);
  });

  it("is false while one of them is open", () => {
    const list = tasks(["before", true], ["before", false]);
    expect(isReadyToGo(vacation(), list, "2026-12-04")).toBe(false);
  });

  it("is false from the first day of the trip", () => {
    expect(isReadyToGo(vacation(), packed, "2026-12-05")).toBe(false);
  });

  it("is false when there was nothing to do before the trip", () => {
    expect(
      isReadyToGo(vacation(), tasks(["during", false]), "2026-12-04"),
    ).toBe(false);
  });
});

describe("isCurrentVacation", () => {
  const unpacking = tasks(["after", false]);
  const unpacked = tasks(["after", true], ["before", false]);

  it("is true before and during the trip, whatever its tasks", () => {
    expect(isCurrentVacation(vacation(), [], "2026-10-12")).toBe(true);
    expect(isCurrentVacation(vacation(), unpacked, "2026-12-12")).toBe(true);
  });

  it("stays true after the trip while 'Afterwards' has an open task", () => {
    expect(isCurrentVacation(vacation(), unpacking, "2026-12-13")).toBe(true);
  });

  it("is false after the trip once 'Afterwards' is done or empty", () => {
    expect(isCurrentVacation(vacation(), unpacked, "2026-12-13")).toBe(false);
    expect(isCurrentVacation(vacation(), [], "2026-12-13")).toBe(false);
  });

  it(`gives up on the unpacking after ${UNPACKING_DAYS} days`, () => {
    // 12 December + 14 days is 26 December.
    expect(isCurrentVacation(vacation(), unpacking, "2026-12-26")).toBe(true);
    expect(isCurrentVacation(vacation(), unpacking, "2026-12-27")).toBe(false);
  });

  it("counts those days across the end of a month and of a year", () => {
    const trip = vacation({ starts_on: "2026-12-20", ends_on: "2026-12-25" });
    expect(isCurrentVacation(trip, unpacking, "2027-01-08")).toBe(true);
    expect(isCurrentVacation(trip, unpacking, "2027-01-09")).toBe(false);

    const february = vacation({
      starts_on: "2027-02-10",
      ends_on: "2027-02-20",
    });
    expect(isCurrentVacation(february, unpacking, "2027-03-06")).toBe(true);
    expect(isCurrentVacation(february, unpacking, "2027-03-07")).toBe(false);
  });
});

describe("groupVacations", () => {
  const today = "2026-12-14";
  /** Over since the 12th, with the car still to unpack. */
  const back = vacation({ id: "back" });
  const running = vacation({
    id: "running",
    starts_on: "2026-12-13",
    ends_on: "2026-12-15",
  });
  const next = vacation({
    id: "next",
    starts_on: "2027-04-03",
    ends_on: "2027-04-07",
  });
  const summer = vacation({
    id: "summer",
    starts_on: "2026-07-01",
    ends_on: "2026-07-14",
  });
  const autumn = vacation({
    id: "autumn",
    starts_on: "2026-10-01",
    ends_on: "2026-10-04",
  });
  const unpackTheCar = task({
    id: "unpack",
    vacation_id: "back",
    phase: "after",
  });

  it("orders the current ones by their first day: back, running, upcoming", () => {
    const groups = groupVacations(
      byId(next, running, back),
      byId(unpackTheCar),
      today,
    );
    expect(groups.current.map((v) => v.id)).toEqual([
      "back",
      "running",
      "next",
    ]);
    expect(groups.past).toEqual([]);
  });

  it("moves a trip to the past once it is unpacked", () => {
    const groups = groupVacations(
      byId(next, back),
      byId({ ...unpackTheCar, done: true }),
      today,
    );
    expect(groups.current.map((v) => v.id)).toEqual(["next"]);
    expect(groups.past.map((v) => v.id)).toEqual(["back"]);
  });

  it("starts the past ones with the latest", () => {
    const groups = groupVacations(byId(summer, autumn), {}, today);
    expect(groups.past.map((v) => v.id)).toEqual(["autumn", "summer"]);
  });

  it("leaves out a removed vacation", () => {
    const removed = vacation({
      id: "gone",
      deleted_at: "2026-10-02T00:00:00Z",
    });
    const groups = groupVacations(byId(removed, next), {}, today);
    expect(groups.current.map((v) => v.id)).toEqual(["next"]);
    expect(groups.past).toEqual([]);
  });

  it("does not count a removed task as something to unpack", () => {
    const groups = groupVacations(
      byId(back),
      byId({ ...unpackTheCar, deleted_at: "2026-12-13T00:00:00Z" }),
      today,
    );
    expect(groups.past.map((v) => v.id)).toEqual(["back"]);
  });

  it("is empty for a household without vacations", () => {
    expect(groupVacations({}, {}, today)).toEqual({ current: [], past: [] });
  });
});

describe("vacationTilePreview", () => {
  const today = "2026-10-12";
  const next = vacation();
  const later = vacation({
    id: "vacation-2",
    title: "Easter at grandma's",
    starts_on: "2027-04-03",
    ends_on: "2027-04-07",
  });

  it("is null when no vacation is current", () => {
    expect(vacationTilePreview({}, {}, today)).toBeNull();
    const over = vacation({ starts_on: "2026-08-02", ends_on: "2026-08-16" });
    expect(vacationTilePreview(byId(over), {}, today)).toBeNull();
  });

  it("names the vacation, where it stands, and its open tasks", () => {
    const list = tasks(["before", false], ["before", true], ["after", false]);
    expect(vacationTilePreview(byId(next), byId(...list), today)).toEqual({
      title: "Winter week by the sea",
      when: "in 54 days",
      tasks: "2 tasks open",
      share: null,
      more: null,
    });
  });

  it("names the one that starts first and counts the others", () => {
    const further = vacation({
      id: "vacation-3",
      starts_on: "2027-07-01",
      ends_on: "2027-07-08",
    });
    const two = vacationTilePreview(byId(later, next), {}, today);
    expect(two?.title).toBe("Winter week by the sea");
    expect(two?.more).toBe("and 1 more vacation");
    expect(
      vacationTilePreview(byId(later, next, further), {}, today)?.more,
    ).toBe("and 2 more vacations");
  });

  it("says what the number counts, down to none", () => {
    expect(openTasksLine(2)).toBe("2 tasks open");
    expect(openTasksLine(1)).toBe("1 task open");
    expect(openTasksLine(0)).toBe("No tasks open");
  });

  it("still names a vacation whose tasks are all done", () => {
    const preview = vacationTilePreview(
      byId(next),
      byId(...tasks(["before", true])),
      today,
    );
    expect(preview?.title).toBe("Winter week by the sea");
    expect(preview?.tasks).toBe("No tasks open");
  });

  it("adds what is the member's and what came back, when there is any", () => {
    const share = (mine: number, rejected: number) => () => ({
      mine,
      rejected,
    });
    const line = (mine: number, rejected: number) =>
      vacationTilePreview(byId(next), {}, today, share(mine, rejected))?.share;
    expect(line(2, 1)).toBe("2 yours · 1 came back");
    expect(line(2, 0)).toBe("2 yours");
    expect(line(0, 1)).toBe("1 came back");
    expect(line(0, 0)).toBeNull();
  });

  it("does not count another vacation's tasks", () => {
    const foreign = task({ id: "task-9", vacation_id: "vacation-2" });
    expect(vacationTilePreview(byId(next), byId(foreign), today)?.tasks).toBe(
      "No tasks open",
    );
  });
});

describe("vacationDetailsProblem", () => {
  const details = {
    title: "Winter week by the sea",
    starts_on: "2026-12-05",
    ends_on: "2026-12-12",
  };

  it("finds nothing wrong with a title and dates in order", () => {
    expect(vacationDetailsProblem(details)).toBeNull();
    expect(
      vacationDetailsProblem({ ...details, ends_on: "2026-12-05" }),
    ).toBeNull();
  });

  it("does not take spaces for a title", () => {
    expect(vacationDetailsProblem({ ...details, title: "   " })).toBe("title");
  });

  it("refuses an end before the start, and a missing date", () => {
    expect(vacationDetailsProblem({ ...details, ends_on: "2026-12-04" })).toBe(
      "dates",
    );
    expect(vacationDetailsProblem({ ...details, starts_on: "" })).toBe("dates");
  });
});
