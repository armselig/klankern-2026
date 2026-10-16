// @vitest-environment node
//
// Admin-API test script, not a component test: must run under Node (no
// `window`), since supabase-js refuses to use a secret key whenever it
// detects a browser-like global scope -- happy-dom's `window` would trip
// that guard and raise "Forbidden use of secret API key in browser".
import {
  admin,
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  signedOut,
  type TestUser,
} from "../support/supabase-fixtures";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  personJson,
  taskJson,
  vacationJson,
  vacationPersonRow,
  vacationRow,
  vacationTaskRow,
} from "../support/rls-rows";

// Household RLS for vacations, their tasks, their people and their meals. Many of these
// tests build on the state an earlier one left (a task's assignee, who is on
// the trip), so they run in order; only the independent rejection tables run
// concurrently.

describe("vacation RLS isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;
  let householdAId: string;
  let householdBId: string;
  let householdCId: string | undefined;
  let vacationAId: string;
  let vacationBId: string;
  let taskAId: string;
  let personAId: string;
  let guestAId: string;

  beforeAll(async () => {
    [userA, userB, userC] = await Promise.all([
      createTestUser("a"),
      createTestUser("b"),
      createTestUser("c"),
    ]);

    [householdAId, householdBId] = await Promise.all([
      createHousehold(userA.client, `Household A ${runId}`),
      createHousehold(userB.client, `Household B ${runId}`),
    ]);

    const vacationA = vacationJson(householdAId);
    const tasksA = [
      taskJson(1, "Clothes"),
      taskJson(1, "Return the key", "during"),
    ];
    const peopleA = [personJson("alex", userA.userId), personJson("Mia")];
    const vacationB = vacationJson(householdBId);
    const [createdA, createdB] = await Promise.all([
      userA.client.rpc("create_vacation", {
        p_vacation: vacationA,
        p_tasks: tasksA,
        p_people: peopleA,
      }),
      userB.client.rpc("create_vacation", {
        p_vacation: vacationB,
        p_tasks: [],
      }),
    ]);
    if (createdA.error) throw createdA.error;
    if (createdB.error) throw createdB.error;
    vacationAId = vacationA.id;
    vacationBId = vacationB.id;
    taskAId = tasksA[0]!.id;
    personAId = peopleA[0]!.id;
    guestAId = peopleA[1]!.id;
  });

  afterAll(async () => {
    await deleteTestData(
      [householdAId, householdBId, householdCId],
      [userA, userB, userC],
    );
  });

  it("returns zero of household A's vacations and their tasks to a member of household B", async () => {
    const [vacations, tasks] = await Promise.all([
      userB.client
        .from("vacations")
        .select("id")
        .eq("household_id", householdAId),
      userB.client
        .from("vacation_tasks")
        .select("id")
        .eq("vacation_id", vacationAId),
    ]);
    expect(vacations.error).toBeNull();
    expect(vacations.data).toHaveLength(0);
    expect(tasks.error).toBeNull();
    expect(tasks.data).toHaveLength(0);
  });

  it("create_vacation writes the vacation and its tasks as the caller", async () => {
    const vacations = await userA.client
      .from("vacations")
      .select("id, title, kind, starts_on, ends_on, created_by, deleted_at")
      .eq("household_id", householdAId);
    expect(vacations.error).toBeNull();
    expect(vacations.data).toEqual([
      {
        id: vacationAId,
        title: "Denmark",
        kind: "house",
        starts_on: "2026-12-05",
        ends_on: "2026-12-12",
        created_by: userA.userId,
        deleted_at: null,
      },
    ]);

    const tasks = await userA.client
      .from("vacation_tasks")
      .select("household_id, phase, title, done, position, created_by")
      .eq("vacation_id", vacationAId)
      .order("phase");
    expect(tasks.error).toBeNull();
    expect(tasks.data).toEqual([
      {
        household_id: householdAId,
        phase: "before",
        title: "Clothes",
        done: false,
        position: 1,
        created_by: userA.userId,
      },
      {
        household_id: householdAId,
        phase: "during",
        title: "Return the key",
        done: false,
        position: 1,
        created_by: userA.userId,
      },
    ]);
  });

  it("create_vacation returns the rows it wrote", async () => {
    const vacation = vacationJson(householdBId);
    const task = taskJson(1.5, "Unpack the car", "after");
    const { data, error } = await userB.client.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: [task],
    });
    expect(error).toBeNull();
    expect(data.vacation).toMatchObject({
      ...vacation,
      created_by: userB.userId,
      deleted_at: null,
    });
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]).toMatchObject({
      ...task,
      vacation_id: vacation.id,
      household_id: householdBId,
      done: false,
      created_by: userB.userId,
      deleted_at: null,
    });
  });

  it("does not let vacations or their tasks be read without signing in", async () => {
    const [vacations, tasks] = await Promise.all([
      signedOut.from("vacations").select("id"),
      signedOut.from("vacation_tasks").select("id"),
    ]);
    expect(vacations.data).toBeNull();
    expect(vacations.error).not.toBeNull();
    expect(tasks.data).toBeNull();
    expect(tasks.error).not.toBeNull();
  });

  it("create_vacation cannot be called without signing in", async () => {
    const vacation = vacationJson(householdAId);
    const { data, error } = await signedOut.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: [],
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    const { data: rows } = await admin
      .from("vacations")
      .select("id")
      .eq("id", vacation.id);
    expect(rows).toHaveLength(0);
  });

  it("create_vacation refuses a vacation in another household", async () => {
    const vacation = vacationJson(householdAId);
    const { error } = await userB.client.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: [taskJson(1, "Clothes")],
    });
    expect(error).not.toBeNull();

    const { data: rows } = await admin
      .from("vacations")
      .select("id")
      .eq("id", vacation.id);
    expect(rows).toHaveLength(0);
  });

  it("create_vacation writes nothing when one of its tasks is refused", async () => {
    const vacation = vacationJson(householdBId);
    const tasks = [taskJson(1, "Clothes"), taskJson(2, "Books", "sometime")];
    const { error } = await userB.client.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: tasks,
    });
    expect(error).not.toBeNull();

    const { data: vacations } = await admin
      .from("vacations")
      .select("id")
      .eq("id", vacation.id);
    expect(vacations).toHaveLength(0);
    const { data: written } = await admin
      .from("vacation_tasks")
      .select("id")
      .in(
        "id",
        tasks.map((task) => task.id),
      );
    expect(written).toHaveLength(0);
  });

  it("blocks adding a vacation or a task to another household", async () => {
    const [vacation, task] = await Promise.all([
      userB.client.from("vacations").insert(vacationRow(userB, householdAId)),
      userB.client
        .from("vacation_tasks")
        .insert(vacationTaskRow(userB, vacationAId, householdAId)),
    ]);
    expect(vacation.error).not.toBeNull();
    expect(task.error).not.toBeNull();
  });

  it("blocks a task that names the member's own household but another household's vacation", async () => {
    // The policy alone would pass this row (household B is the caller's);
    // the composite foreign key ties the task to its vacation's household.
    const { error } = await userB.client
      .from("vacation_tasks")
      .insert(vacationTaskRow(userB, vacationAId, householdBId));
    expect(error).not.toBeNull();
  });

  it("leaves another household's vacation and task untouched by an edit or a removal (RLS filters, not an error)", async () => {
    const removedAt = new Date().toISOString();
    const [vacation, task] = await Promise.all([
      userB.client
        .from("vacations")
        .update({ title: "Taken over", deleted_at: removedAt })
        .eq("id", vacationAId),
      userB.client
        .from("vacation_tasks")
        .update({ title: "Taken over", done: true, deleted_at: removedAt })
        .eq("id", taskAId),
    ]);
    expect(vacation.error).toBeNull();
    expect(task.error).toBeNull();

    const [{ data: vacationRowNow }, { data: taskRowNow }] = await Promise.all([
      admin
        .from("vacations")
        .select("title, deleted_at")
        .eq("id", vacationAId)
        .single(),
      admin
        .from("vacation_tasks")
        .select("title, done, deleted_at")
        .eq("id", taskAId)
        .single(),
    ]);
    expect(vacationRowNow).toEqual({ title: "Denmark", deleted_at: null });
    expect(taskRowNow).toEqual({
      title: "Clothes",
      done: false,
      deleted_at: null,
    });
  });

  it("blocks moving a vacation or a task into another household", async () => {
    const [vacation, task] = await Promise.all([
      userA.client
        .from("vacations")
        .update({ household_id: householdBId })
        .eq("id", vacationAId),
      userA.client
        .from("vacation_tasks")
        .update({ household_id: householdBId })
        .eq("id", taskAId),
    ]);
    expect(vacation.error).not.toBeNull();
    expect(task.error).not.toBeNull();
  });

  it("lets a member tick, rename and soft-delete a task of their household", async () => {
    const { data: added, error: addError } = await userB.client
      .from("vacation_tasks")
      .insert(vacationTaskRow(userB, vacationBId, householdBId))
      .select("id")
      .single();
    expect(addError).toBeNull();

    const { data, error } = await userB.client
      .from("vacation_tasks")
      .update({
        done: true,
        title: "Warm clothes",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", added!.id)
      .select("done, title");
    expect(error).toBeNull();
    expect(data).toEqual([{ done: true, title: "Warm clothes" }]);
  });

  it("does not let a member hard-delete a vacation or a task, only soft-delete it", async () => {
    const [task, vacation] = await Promise.all([
      userA.client.from("vacation_tasks").delete().eq("id", taskAId),
      userA.client.from("vacations").delete().eq("id", vacationAId),
    ]);
    expect(task.error).not.toBeNull();
    expect(vacation.error).not.toBeNull();

    const [{ data: vacations }, { data: tasks }] = await Promise.all([
      admin.from("vacations").select("id").eq("id", vacationAId),
      admin.from("vacation_tasks").select("id").eq("id", taskAId),
    ]);
    expect(vacations).toEqual([{ id: vacationAId }]);
    expect(tasks).toEqual([{ id: taskAId }]);
  });

  it.concurrent.each([
    ["a blank title", { title: "  " }],
    ["a title that is too long", { title: "a".repeat(201) }],
    ["a kind the app doesn't know", { kind: "tent" }],
    ["an end before its start", { ends_on: "2026-12-04" }],
    ["no start", { starts_on: null }],
  ])("rejects a vacation with %s", async (_name, override) => {
    const { error } = await userB.client
      .from("vacations")
      .insert({ ...vacationRow(userB, householdBId), ...override });
    expect(error).not.toBeNull();
  });

  it.concurrent.each([
    ["a blank title", { title: " " }],
    ["a title that is too long", { title: "a".repeat(201) }],
    ["a phase the app doesn't know", { phase: "sometime" }],
  ])("rejects a vacation task with %s", async (_name, override) => {
    const { error } = await userB.client.from("vacation_tasks").insert({
      ...vacationTaskRow(userB, vacationBId, householdBId),
      ...override,
    });
    expect(error).not.toBeNull();
  });

  it("accepts a vacation of one day and titles of the largest allowed size", async () => {
    // Four bytes per character, the size the task row's byte budget counts with.
    const longest = "\u{1F9F3}".repeat(200);
    const [vacation, task] = await Promise.all([
      userB.client.from("vacations").insert({
        ...vacationRow(userB, householdBId),
        title: longest,
        ends_on: "2026-12-05",
      }),
      userB.client.from("vacation_tasks").insert({
        ...vacationTaskRow(userB, vacationBId, householdBId),
        title: longest,
      }),
    ]);
    expect(vacation.error).toBeNull();
    expect(task.error).toBeNull();
  });

  it("removes a household's vacations, their people and their tasks with the household", async () => {
    householdCId = await createHousehold(userC.client, `Household C ${runId}`);
    const vacation = vacationJson(householdCId);
    const { error } = await userC.client.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: [taskJson(1, "Clothes"), taskJson(2, "Books")],
      p_people: [personJson("carl", userC.userId), personJson("Mia")],
    });
    expect(error).toBeNull();

    // What the tests' cleanup does. A foreign key that blocked the cascade
    // would leave test rows in the database that production uses.
    const removal = await admin
      .from("households")
      .delete()
      .eq("id", householdCId);
    expect(removal.error).toBeNull();

    const { data: vacations } = await admin
      .from("vacations")
      .select("id")
      .eq("id", vacation.id);
    expect(vacations).toHaveLength(0);
    const { data: tasks } = await admin
      .from("vacation_tasks")
      .select("id")
      .eq("vacation_id", vacation.id);
    expect(tasks).toHaveLength(0);
    const { data: people } = await admin
      .from("vacation_people")
      .select("id")
      .eq("vacation_id", vacation.id);
    expect(people).toHaveLength(0);
  });

  it("create_vacation writes the people who are coming, and still takes a call without them", async () => {
    const people = await userA.client
      .from("vacation_people")
      .select("id, name, user_id, household_id, created_by, deleted_at")
      .eq("vacation_id", vacationAId)
      // The member first: the database's order of names ignores case.
      .order("name");
    expect(people.error).toBeNull();
    expect(people.data).toEqual([
      {
        id: personAId,
        name: "alex",
        user_id: userA.userId,
        household_id: householdAId,
        created_by: userA.userId,
        deleted_at: null,
      },
      {
        id: guestAId,
        name: "Mia",
        user_id: null,
        household_id: householdAId,
        created_by: userA.userId,
        deleted_at: null,
      },
    ]);

    // What an installed app sends that hasn't updated since slice 1.
    const vacation = vacationJson(householdBId);
    const { data, error } = await userB.client.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: [taskJson(1, "Clothes")],
    });
    expect(error).toBeNull();
    expect(data.tasks).toHaveLength(1);
    expect(data.people).toEqual([]);
  });

  it("create_vacation writes nothing when one of its people is refused", async () => {
    const vacation = vacationJson(householdBId);
    // A is no member of household B.
    const { error } = await userB.client.rpc("create_vacation", {
      p_vacation: vacation,
      p_tasks: [taskJson(1, "Clothes")],
      p_people: [
        personJson("berta", userB.userId),
        personJson("alex", userA.userId),
      ],
    });
    expect(error).not.toBeNull();

    const { data: vacations } = await admin
      .from("vacations")
      .select("id")
      .eq("id", vacation.id);
    expect(vacations).toHaveLength(0);
  });

  it("returns zero of household A's people to a member of household B, and none without signing in", async () => {
    const [people, signedOutRead] = await Promise.all([
      userB.client
        .from("vacation_people")
        .select("id")
        .eq("vacation_id", vacationAId),
      signedOut.from("vacation_people").select("id"),
    ]);
    expect(people.error).toBeNull();
    expect(people.data).toHaveLength(0);
    expect(signedOutRead.data).toBeNull();
    expect(signedOutRead.error).not.toBeNull();
  });

  it("blocks adding a person to another household's vacation, under either household", async () => {
    // The policy alone would pass the second row; the composite foreign key
    // ties the person to the vacation's household.
    const [asTheirs, asOwn] = await Promise.all([
      userB.client
        .from("vacation_people")
        .insert(vacationPersonRow(userB, vacationAId, householdAId)),
      userB.client
        .from("vacation_people")
        .insert(vacationPersonRow(userB, vacationAId, householdBId)),
    ]);
    expect(asTheirs.error).not.toBeNull();
    expect(asOwn.error).not.toBeNull();
  });

  it("leaves another household's person untouched, and lets no member hard-delete one", async () => {
    const [edit, removal] = await Promise.all([
      userB.client
        .from("vacation_people")
        .update({ name: "Taken over", deleted_at: new Date().toISOString() })
        .eq("id", guestAId),
      userA.client.from("vacation_people").delete().eq("id", guestAId),
    ]);
    expect(edit.error).toBeNull();
    expect(removal.error).not.toBeNull();

    const { data: person } = await admin
      .from("vacation_people")
      .select("name, deleted_at")
      .eq("id", guestAId)
      .single();
    expect(person).toEqual({ name: "Mia", deleted_at: null });
  });

  it("puts a member on a vacation only once, and lets two people without an account share a name", async () => {
    const [twice, sameName] = await Promise.all([
      userA.client.from("vacation_people").insert({
        ...vacationPersonRow(userA, vacationAId, householdAId),
        name: "alex again",
        user_id: userA.userId,
      }),
      userA.client
        .from("vacation_people")
        .insert(vacationPersonRow(userA, vacationAId, householdAId)),
    ]);
    expect(twice.error).not.toBeNull();
    expect(sameName.error).toBeNull();
  });

  it("lets a member who was taken off a vacation be added again", async () => {
    const off = await userA.client
      .from("vacation_people")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", personAId);
    expect(off.error).toBeNull();

    const again = await userA.client.from("vacation_people").insert({
      ...vacationPersonRow(userA, vacationAId, householdAId),
      name: "alex",
      user_id: userA.userId,
    });
    expect(again.error).toBeNull();
  });

  it.concurrent.each([
    ["a blank name", { name: " " }],
    ["a name that is too long", { name: "a".repeat(101) }],
  ])("rejects a person with %s", async (_name, override) => {
    const { error } = await userB.client.from("vacation_people").insert({
      ...vacationPersonRow(userB, vacationBId, householdBId),
      ...override,
    });
    expect(error).not.toBeNull();
  });

  it("rejects a person tied to an account that is no member of the household", async () => {
    const { error } = await userB.client.from("vacation_people").insert({
      ...vacationPersonRow(userB, vacationBId, householdBId),
      name: "alex",
      user_id: userA.userId,
    });
    expect(error).not.toBeNull();
  });

  it("lets a task be given, rejected by its assignee with a reason, and taken", async () => {
    const give = await userA.client
      .from("vacation_tasks")
      .update({ assignee_id: personAId })
      .eq("id", taskAId);
    expect(give.error).toBeNull();

    // The reject is conditional on the task still being that person's; for
    // anyone else it matches no row.
    const rejection = {
      assignee_id: null,
      rejected_by: guestAId,
      rejection_reason: "Too small to carry it.",
    };
    const notTheirs = await userA.client
      .from("vacation_tasks")
      .update(rejection)
      .eq("id", taskAId)
      .eq("assignee_id", guestAId)
      .select("id");
    expect(notTheirs.error).toBeNull();
    expect(notTheirs.data).toHaveLength(0);

    const reject = await userA.client
      .from("vacation_tasks")
      .update({ ...rejection, rejected_by: personAId })
      .eq("id", taskAId)
      .eq("assignee_id", personAId)
      .select("assignee_id, rejected_by, rejection_reason");
    expect(reject.error).toBeNull();
    expect(reject.data).toEqual([
      {
        assignee_id: null,
        rejected_by: personAId,
        rejection_reason: "Too small to carry it.",
      },
    ]);

    const take = await userA.client
      .from("vacation_tasks")
      .update({
        assignee_id: guestAId,
        rejected_by: null,
        rejection_reason: null,
      })
      .eq("id", taskAId);
    expect(take.error).toBeNull();
  });

  it.concurrent.each([
    [
      "an assignee and a rejection at once",
      { rejected_by: "own", rejection_reason: "No." },
    ],
    ["a rejection without a reason", { assignee_id: null, rejected_by: "own" }],
    [
      "a blank reason",
      { assignee_id: null, rejected_by: "own", rejection_reason: "  " },
    ],
    [
      "a reason that is too long",
      {
        assignee_id: null,
        rejected_by: "own",
        rejection_reason: "a".repeat(201),
      },
    ],
    [
      "a reason without a person",
      { assignee_id: null, rejection_reason: "No." },
    ],
  ])("rejects a task with %s", async (_name, override) => {
    // The task has an assignee since the test above. "own" stands for a
    // person of the task's vacation, whose id is known only now.
    const changes = Object.fromEntries(
      Object.entries(override).map(([key, value]) => [
        key,
        value === "own" ? guestAId : value,
      ]),
    );
    const { error } = await userA.client
      .from("vacation_tasks")
      .update(changes)
      .eq("id", taskAId);
    expect(error).not.toBeNull();
  });

  it("accepts a reason of the largest allowed size beside a title of the largest", async () => {
    // Four bytes per character, the size the task row's byte budget counts with.
    const longest = "\u{1F9F3}".repeat(200);
    const { data: added } = await userA.client
      .from("vacation_tasks")
      .insert({
        ...vacationTaskRow(userA, vacationAId, householdAId),
        title: longest,
      })
      .select("id")
      .single();
    const { error } = await userA.client
      .from("vacation_tasks")
      .update({ rejected_by: guestAId, rejection_reason: longest })
      .eq("id", added!.id);
    expect(error).toBeNull();
  });

  it("rejects an assignee of another vacation", async () => {
    const other = vacationJson(householdAId);
    const stranger = personJson("guest");
    const created = await userA.client.rpc("create_vacation", {
      p_vacation: other,
      p_tasks: [],
      p_people: [stranger],
    });
    expect(created.error).toBeNull();

    const { error } = await userA.client
      .from("vacation_tasks")
      .update({ assignee_id: stranger.id })
      .eq("id", taskAId);
    expect(error).not.toBeNull();
  });

  it("lets a member change a vacation's kind", async () => {
    const edit = await userA.client
      .from("vacations")
      .update({ kind: "hotel" })
      .eq("id", vacationAId)
      .select("kind")
      .single();
    expect(edit.error).toBeNull();
    expect(edit.data).toEqual({ kind: "hotel" });

    const unknown = await userA.client
      .from("vacations")
      .update({ kind: "tent" })
      .eq("id", vacationAId);
    expect(unknown.error).not.toBeNull();
  });
  describe("the household's children on a trip", () => {
    let childAId: string;
    let childBId: string;

    /** A child, without created_by: the column's default is the caller. */
    async function addChild(user: TestUser, householdId: string, name: string) {
      const id = randomUUID();
      const { error } = await user.client
        .from("household_children")
        .insert({ id, household_id: householdId, name });
      if (error) throw error;
      return id;
    }

    beforeAll(async () => {
      [childAId, childBId] = await Promise.all([
        addChild(userA, householdAId, `Lea ${runId}`),
        addChild(userB, householdBId, `Ben ${runId}`),
      ]);
    });

    it("create_vacation writes a child of the household", async () => {
      const vacation = vacationJson(householdAId);
      const child = personJson("Lea", null, childAId);
      const { data, error } = await userA.client.rpc("create_vacation", {
        p_vacation: vacation,
        p_tasks: [],
        p_people: [child],
      });
      expect(error).toBeNull();
      expect(data.people).toEqual([
        expect.objectContaining({ id: child.id, child_id: childAId }),
      ]);
    });

    it("create_vacation refuses another household's child and writes nothing", async () => {
      const vacation = vacationJson(householdAId);
      const { error } = await userA.client.rpc("create_vacation", {
        p_vacation: vacation,
        p_tasks: [],
        p_people: [personJson("Ben", null, childBId)],
      });
      expect(error).not.toBeNull();

      const { data: vacations } = await admin
        .from("vacations")
        .select("id")
        .eq("id", vacation.id);
      expect(vacations).toHaveLength(0);
    });

    it("blocks adding another household's child to a trip, or moving a person onto one", async () => {
      const [insert, update] = await Promise.all([
        userA.client.from("vacation_people").insert({
          ...vacationPersonRow(userA, vacationAId, householdAId),
          child_id: childBId,
        }),
        userA.client
          .from("vacation_people")
          .update({ child_id: childBId })
          .eq("id", guestAId),
      ]);
      expect(insert.error).not.toBeNull();
      expect(update.error).not.toBeNull();
    });

    it("puts a child on a vacation once, and again after they were taken off", async () => {
      const id = randomUUID();
      const first = await userA.client.from("vacation_people").insert({
        ...vacationPersonRow(userA, vacationAId, householdAId),
        id,
        child_id: childAId,
      });
      expect(first.error).toBeNull();

      const twice = await userA.client.from("vacation_people").insert({
        ...vacationPersonRow(userA, vacationAId, householdAId),
        child_id: childAId,
      });
      expect(twice.error).not.toBeNull();

      const off = await userA.client
        .from("vacation_people")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      expect(off.error).toBeNull();
      const again = await userA.client.from("vacation_people").insert({
        ...vacationPersonRow(userA, vacationAId, householdAId),
        child_id: childAId,
      });
      expect(again.error).toBeNull();
    });

    it("rejects a person who is a member and a child at once", async () => {
      const { error } = await userB.client.from("vacation_people").insert({
        ...vacationPersonRow(userB, vacationBId, householdBId),
        user_id: userB.userId,
        child_id: childBId,
      });
      expect(error).not.toBeNull();
    });
  });
});
