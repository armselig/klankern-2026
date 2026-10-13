import { describe, expect, it } from "vitest";
import type { VacationPerson, VacationTask } from "~/types/vacation";
import {
  assigneeOf,
  isTaskOf,
  lastCreatedVacationId,
  myShareOf,
  nameFromEmail,
  openTasksOf,
  peopleOfVacation,
  peopleToStartWith,
  personOfUser,
  phaseSummaryOfMine,
  rejecterOf,
  taskShares,
} from "./vacation-share";

function person(overrides: Partial<VacationPerson> = {}): VacationPerson {
  return {
    id: "alex",
    vacation_id: "vacation-1",
    household_id: "house-1",
    name: "alex",
    user_id: "user-alex",
    created_by: "user-alex",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function task(overrides: Partial<VacationTask> = {}): VacationTask {
  return {
    id: "task-1",
    vacation_id: "vacation-1",
    household_id: "house-1",
    phase: "before",
    title: "Clothes",
    done: false,
    position: 1,
    assignee_id: null,
    rejected_by: null,
    rejection_reason: null,
    created_by: "user-alex",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

const alex = person();
const sam = person({ id: "sam", name: "sam", user_id: "user-sam" });
const mia = person({ id: "mia", name: "Mia", user_id: null });
/** Taken off the trip. */
const gone = person({
  id: "gone",
  name: "kim",
  user_id: "user-kim",
  deleted_at: "2026-10-02T00:00:00Z",
});
const everyone = { alex, sam, mia, gone };
const onTheTrip = [alex, sam, mia];

describe("peopleOfVacation", () => {
  it("lists the people on the trip in the order they were added", () => {
    const later = person({ id: "zoe", created_at: "2026-10-03T00:00:00Z" });
    const state = { zoe: later, sam, alex, gone };
    expect(peopleOfVacation(state, "vacation-1").map((p) => p.id)).toEqual([
      "alex",
      "sam",
      "zoe",
    ]);
  });

  it("orders people added at the same moment: members first, then by name", () => {
    const zed = person({ id: "a", name: "Zed", user_id: null });
    const state = { a: zed, mia, sam, alex };
    expect(peopleOfVacation(state, "vacation-1").map((p) => p.name)).toEqual([
      "alex",
      "sam",
      "Mia",
      "Zed",
    ]);
  });

  it("leaves out people of another vacation", () => {
    const other = person({ id: "x", vacation_id: "vacation-2" });
    expect(peopleOfVacation({ x: other, alex }, "vacation-1")).toEqual([alex]);
  });
});

describe("personOfUser", () => {
  it("finds the member's person, and nobody for a member who isn't on the trip", () => {
    expect(personOfUser(onTheTrip, "user-sam")).toBe(sam);
    expect(personOfUser(onTheTrip, "user-kim")).toBeNull();
    expect(personOfUser(onTheTrip, undefined)).toBeNull();
  });
});

describe("assigneeOf and rejecterOf", () => {
  it("names the person a task was given to", () => {
    expect(assigneeOf(task({ assignee_id: "sam" }), everyone)).toBe(sam);
    expect(assigneeOf(task(), everyone)).toBeNull();
  });

  it("counts a task of a person who was taken off as nobody's", () => {
    expect(assigneeOf(task({ assignee_id: "gone" }), everyone)).toBeNull();
  });

  it("counts a task of a person it doesn't know as nobody's", () => {
    expect(assigneeOf(task({ assignee_id: "unknown" }), everyone)).toBeNull();
  });

  it("still names who said no after that person was taken off", () => {
    expect(rejecterOf(task({ rejected_by: "gone" }), everyone)).toBe(gone);
    expect(rejecterOf(task(), everyone)).toBeNull();
  });

  it("says whose a task is", () => {
    expect(isTaskOf(task({ assignee_id: "sam" }), sam, everyone)).toBe(true);
    expect(isTaskOf(task({ assignee_id: "sam" }), alex, everyone)).toBe(false);
    expect(isTaskOf(task(), null, everyone)).toBe(false);
  });
});

describe("taskShares", () => {
  const tasks = [
    task({ id: "1", assignee_id: "alex" }),
    task({ id: "2", assignee_id: "alex", done: true }),
    task({ id: "3", assignee_id: "sam" }),
    task({ id: "4" }),
    task({ id: "5", rejected_by: "sam", rejection_reason: "No." }),
    task({ id: "6", assignee_id: "gone" }),
  ];

  it("counts the open tasks per person, and nobody's last", () => {
    expect(
      taskShares(tasks, onTheTrip, everyone).map((s) => [
        s.person?.id ?? null,
        s.open,
      ]),
    ).toEqual([
      ["alex", 1],
      ["sam", 1],
      ["mia", 0],
      // Free, rejected, and given to someone who was taken off.
      [null, 3],
    ]);
  });

  it("has only the line for nobody on a trip without people", () => {
    expect(taskShares(tasks, [], {})).toEqual([{ person: null, open: 5 }]);
  });
});

describe("only my tasks", () => {
  const tasks = [
    task({ id: "1", assignee_id: "alex" }),
    task({ id: "2", assignee_id: "alex", done: true }),
    task({ id: "3", assignee_id: "sam" }),
  ];

  it("leaves the member's open tasks", () => {
    expect(openTasksOf(tasks, alex, everyone).map((t) => t.id)).toEqual(["1"]);
    expect(openTasksOf(tasks, null, everyone)).toEqual([]);
  });

  it("counts the member's tasks beside the heading", () => {
    expect(phaseSummaryOfMine(tasks, alex, everyone)).toBe("1 of yours open");
  });

  it("says so when the member's tasks are done", () => {
    const done = [task({ assignee_id: "alex", done: true })];
    expect(phaseSummaryOfMine(done, alex, everyone)).toBe("Yours are done");
  });

  it("says so when the member has none there", () => {
    expect(phaseSummaryOfMine(tasks, mia, everyone)).toBe(
      "Nothing of yours here.",
    );
  });
});

describe("myShareOf", () => {
  it("counts the member's open tasks and the rejected ones nobody took", () => {
    const tasks = [
      task({ id: "1", assignee_id: "alex" }),
      task({ id: "2", assignee_id: "alex", done: true }),
      task({ id: "3", rejected_by: "sam", rejection_reason: "No." }),
      task({
        id: "4",
        rejected_by: "sam",
        rejection_reason: "No.",
        done: true,
      }),
      task({ id: "5" }),
    ];
    expect(myShareOf(tasks, alex, everyone)).toEqual({ mine: 1, rejected: 1 });
    expect(myShareOf(tasks, null, everyone)).toEqual({ mine: 0, rejected: 1 });
  });
});

describe("the people a new vacation starts with", () => {
  const members = [
    { user_id: "user-alex", email: "alex@example.org" },
    { user_id: "user-sam", email: "sam.smith@example.org" },
  ];

  it("takes a member's name from the email address", () => {
    expect(nameFromEmail("sam.smith@example.org")).toBe("sam.smith");
    expect(nameFromEmail("@example.org")).toBe("@example.org");
  });

  it("starts with every member, on the first vacation", () => {
    expect(peopleToStartWith(members, [])).toEqual([
      { name: "alex", user_id: "user-alex" },
      { name: "sam.smith", user_id: "user-sam" },
    ]);
  });

  it("carries over the last vacation's names: a member's, and the people without an account", () => {
    const last = [person({ name: "Alexandra" }), mia, gone];
    expect(peopleToStartWith(members, last)).toEqual([
      { name: "Alexandra", user_id: "user-alex" },
      { name: "sam.smith", user_id: "user-sam" },
      { name: "Mia", user_id: null },
    ]);
  });

  it("takes the vacation that was created last, not the one that starts last", () => {
    expect(
      lastCreatedVacationId([
        { id: "a", created_at: "2026-10-01T00:00:00Z", deleted_at: null },
        { id: "b", created_at: "2026-10-05T00:00:00Z", deleted_at: null },
        { id: "c", created_at: "2026-10-09T00:00:00Z", deleted_at: "x" },
      ]),
    ).toBe("b");
    expect(lastCreatedVacationId([])).toBeNull();
  });
});
