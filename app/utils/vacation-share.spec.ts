import { describe, expect, it } from "vitest";
import type { HouseholdChild } from "~/types/kids";
import type { VacationPerson, VacationTask } from "~/types/vacation";
import {
  assigneeOf,
  isTaskOf,
  lastCreatedVacationId,
  myShareOf,
  nameFromEmail,
  openTasksIn,
  peopleOfVacation,
  peopleToStartWith,
  peopleNotComing,
  personOfUser,
  phaseSummaryIn,
  rejecterOf,
  shareView,
  addTaskLabel,
  taskFilterHint,
  taskShares,
  withChildNames,
} from "./vacation-share";

function person(overrides: Partial<VacationPerson> = {}): VacationPerson {
  return {
    id: "alex",
    vacation_id: "vacation-1",
    household_id: "house-1",
    name: "alex",
    user_id: "user-alex",
    child_id: null,
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

  it("counts the open tasks per person, the most first, and nobody's last", () => {
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

  it("puts the person with the most open tasks first, and keeps the people's order for equal counts", () => {
    const more = [...tasks, task({ id: "7", assignee_id: "mia" })].concat(
      task({ id: "8", assignee_id: "mia" }),
    );
    expect(
      taskShares(more, onTheTrip, everyone).map((s) => [
        s.person?.id ?? null,
        s.open,
      ]),
    ).toEqual([
      ["mia", 2],
      ["alex", 1],
      ["sam", 1],
      [null, 3],
    ]);
  });

  it("has only the line for nobody on a trip without people", () => {
    expect(taskShares(tasks, [], {})).toEqual([{ person: null, open: 5 }]);
  });
});

describe("shareView", () => {
  it("shows the lines while a trip with people has an open task", () => {
    expect(
      shareView([
        { person: alex, open: 0 },
        { person: null, open: 1 },
      ]),
    ).toBe("lines");
  });

  it("says that nothing is open instead of lines of zeros", () => {
    expect(
      shareView([
        { person: alex, open: 0 },
        { person: null, open: 0 },
      ]),
    ).toBe("nothing-open");
  });

  it("says that nobody is on the trip, open tasks or not", () => {
    expect(shareView([{ person: null, open: 3 }])).toBe("no-people");
  });
});

describe("the tasks filtered by a line of “Who has what”", () => {
  const tasks = [
    task({ id: "1", assignee_id: "alex" }),
    task({ id: "2", assignee_id: "alex", done: true }),
    task({ id: "3", assignee_id: "sam" }),
    task({ id: "4" }),
    task({ id: "5", done: true }),
    task({ id: "6", assignee_id: "gone" }),
  ];
  const ids = (person: VacationPerson | null) =>
    openTasksIn(tasks, { person }, everyone).map((t) => t.id);

  it("leaves a person's open tasks", () => {
    expect(ids(alex)).toEqual(["1"]);
    expect(ids(mia)).toEqual([]);
  });

  it("leaves the open tasks nobody has, a removed person's among them", () => {
    expect(ids(null)).toEqual(["4", "6"]);
  });

  it("speaks to the member beside the heading", () => {
    const summary = (list: VacationTask[], person: VacationPerson) =>
      phaseSummaryIn(list, { person }, person, everyone);
    expect(summary(tasks, alex)).toBe("1 of yours open");
    expect(summary([task({ assignee_id: "alex", done: true })], alex)).toBe(
      "Yours are done",
    );
    expect(summary(tasks, mia)).toBe("Nothing of yours here.");
  });

  it("names another person beside the heading", () => {
    const summary = (list: VacationTask[], person: VacationPerson) =>
      phaseSummaryIn(list, { person }, alex, everyone);
    expect(summary(tasks, sam)).toBe("1 open for sam");
    expect(summary([task({ assignee_id: "sam", done: true })], sam)).toBe(
      "Done for sam",
    );
    expect(summary(tasks, mia)).toBe("Nothing for Mia here.");
  });

  it("counts the open tasks nobody has beside the heading", () => {
    expect(phaseSummaryIn(tasks, { person: null }, alex, everyone)).toBe(
      "2 without a person",
    );
    expect(
      phaseSummaryIn([task({ done: true })], { person: null }, alex, everyone),
    ).toBe("Nothing without a person here.");
  });

  it("says under the strip what is shown and how to get back", () => {
    expect(taskFilterHint({ person: alex }, alex)).toBe(
      "Only your open tasks. Press the name again to see all.",
    );
    expect(taskFilterHint({ person: mia }, alex)).toBe(
      "Only Mia's open tasks. Press the name again to see all.",
    );
    expect(taskFilterHint({ person: null }, alex)).toBe(
      "Only the open tasks nobody has. Press “Nobody yet” again to see all.",
    );
  });
});

describe("addTaskLabel", () => {
  it("names the person whose tasks are listed, since a new one is theirs", () => {
    expect(addTaskLabel("before", { person: alex }, alex)).toBe(
      "Add a task before the trip, for you",
    );
    expect(addTaskLabel("after", { person: mia }, alex)).toBe(
      "Add a task for afterwards, for Mia",
    );
  });

  it("keeps the plain label without a filter and under “Nobody yet”", () => {
    expect(addTaskLabel("during", null, alex)).toBe("Add a task for the trip");
    expect(addTaskLabel("during", { person: null }, alex)).toBe(
      "Add a task for the trip",
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

  const children = [
    { id: "child-lena", name: "Lena" },
    { id: "child-tom", name: "Tom" },
  ];

  it("takes a member's name from the email address", () => {
    expect(nameFromEmail("sam.smith@example.org")).toBe("sam.smith");
    expect(nameFromEmail("@example.org")).toBe("@example.org");
  });

  it("starts with every member, on the first vacation", () => {
    expect(peopleToStartWith(members, [], [])).toEqual([
      { name: "alex", user_id: "user-alex", child_id: null },
      { name: "sam.smith", user_id: "user-sam", child_id: null },
    ]);
  });

  it("carries over the last vacation's names: a member's, and the people without an account", () => {
    const last = [person({ name: "Alexandra" }), mia, gone];
    expect(peopleToStartWith(members, [], last)).toEqual([
      { name: "Alexandra", user_id: "user-alex", child_id: null },
      { name: "sam.smith", user_id: "user-sam", child_id: null },
      { name: "Mia", user_id: null, child_id: null },
    ]);
  });

  it("puts every child after the members, linked by child_id", () => {
    expect(peopleToStartWith(members, children, [])).toEqual([
      { name: "alex", user_id: "user-alex", child_id: null },
      { name: "sam.smith", user_id: "user-sam", child_id: null },
      { name: "Lena", user_id: null, child_id: "child-lena" },
      { name: "Tom", user_id: null, child_id: "child-tom" },
    ]);
  });

  it("leaves out a typed name that is a child's, ignoring case and spaces", () => {
    const last = [
      person({ id: "a", name: " lena ", user_id: null }),
      person({ id: "b", name: "Guest", user_id: null }),
    ];
    expect(
      peopleToStartWith([], children, last).map((p) => [p.name, p.child_id]),
    ).toEqual([
      ["Lena", "child-lena"],
      ["Tom", "child-tom"],
      ["Guest", null],
    ]);
  });

  it("does not repeat a last-trip person already linked to a child as a typed name", () => {
    const linked = person({
      id: "c",
      name: "Old name",
      user_id: null,
      child_id: "child-lena",
    });
    const result = peopleToStartWith([], children, [linked]);
    expect(result).toEqual([
      { name: "Lena", user_id: null, child_id: "child-lena" },
      { name: "Tom", user_id: null, child_id: "child-tom" },
    ]);
  });

  it("is empty without members, children and people", () => {
    expect(peopleToStartWith([], [], [])).toEqual([]);
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

describe("peopleNotComing", () => {
  const members = [
    { user_id: "user-alex", email: "alex@example.org" },
    { user_id: "user-sam", email: "sam.smith@example.org" },
  ];
  const children = [
    { id: "child-lena", name: "Lena" },
    { id: "child-tom", name: "Tom" },
  ];
  const lena = person({
    id: "lena",
    name: "Lena",
    user_id: null,
    child_id: "child-lena",
  });

  it("offers a member and a child who are not on the trip", () => {
    expect(peopleNotComing(members, children, [alex, lena])).toEqual([
      { name: "sam.smith", user_id: "user-sam", child_id: null },
      { name: "Tom", user_id: null, child_id: "child-tom" },
    ]);
  });

  it("offers everyone on a trip without people", () => {
    expect(peopleNotComing(members, children, [])).toHaveLength(4);
  });

  it("offers nobody when everyone is on the trip", () => {
    const tom = person({
      id: "tom",
      name: "Tom",
      user_id: null,
      child_id: "child-tom",
    });
    expect(peopleNotComing(members, children, [alex, sam, lena, tom])).toEqual(
      [],
    );
    expect(peopleNotComing([], [], [])).toEqual([]);
  });

  it("names a child on the trip by the link, not by the typed name", () => {
    const renamed = person({ ...lena, name: "Lenchen" });
    expect(
      peopleNotComing([], children, [renamed]).map((p) => p.child_id),
    ).toEqual(["child-tom"]);
  });
});

describe("withChildNames", () => {
  const child = (overrides: Partial<HouseholdChild>): HouseholdChild => ({
    id: "child-lena",
    household_id: "house-1",
    name: "Lena",
    created_by: "user-alex",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  });
  const lena = person({
    id: "lena",
    name: "Lenny",
    user_id: null,
    child_id: "child-lena",
  });

  it("names a linked child as the roster does now", () => {
    const result = withChildNames({ lena }, { "child-lena": child({}) });
    expect(result.lena).toEqual({ ...lena, name: "Lena" });
    expect(lena.name).toBe("Lenny");
  });

  it("keeps the same objects for rows that need no change", () => {
    const same = person({ ...lena, name: "Lena" });
    const result = withChildNames(
      { lena: same, alex, mia },
      { "child-lena": child({}) },
    );
    expect(result.lena).toBe(same);
    expect(result.alex).toBe(alex);
    expect(result.mia).toBe(mia);
  });

  it("keeps the stored name of a child that is not loaded", () => {
    const result = withChildNames({ lena }, {});
    expect(result.lena).toBe(lena);
  });

  it("returns an empty map for no people", () => {
    expect(withChildNames({}, { "child-lena": child({}) })).toEqual({});
  });
});
