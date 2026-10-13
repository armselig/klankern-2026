// @vitest-environment node
//
// Admin-API test script, not a component test: must run under Node (no
// `window`), since supabase-js refuses to use a secret key whenever it
// detects a browser-like global scope -- happy-dom's `window` would trip
// that guard and raise "Forbidden use of secret API key in browser".
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createHousehold,
  createTestUser,
  deleteTestData,
  insertInvite,
  runId,
  signedOut,
  type TestUser,
} from "../support/supabase-fixtures";

// Proves household-scoped RLS before any UI is built on top of the schema
// (plan milestone 2). See tests/support/supabase-fixtures.ts for why this
// runs against Supabase Cloud with disposable users.

async function addTodoItem(
  client: SupabaseClient,
  householdId: string,
  title: string,
) {
  const { data: list, error: listError } = await client
    .from("todo_lists")
    .insert({ household_id: householdId })
    .select("id")
    .single();
  if (listError || !list) throw listError ?? new Error("list insert failed");

  const { data: auth } = await client.auth.getUser();
  const { error: itemError } = await client.from("todo_items").insert({
    list_id: list.id,
    household_id: householdId,
    title,
    created_by: auth.user!.id,
  });
  if (itemError) throw itemError;
}

/** A whiteboard for the household, created the way the app does. */
async function addBoard(
  client: SupabaseClient,
  householdId: string,
): Promise<string> {
  const { data: board, error } = await client
    .from("boards")
    .insert({ household_id: householdId })
    .select("id")
    .single();
  if (error || !board) throw error ?? new Error("board insert failed");
  return board.id as string;
}

/** A stroke row as the app inserts it; tests override the field under test. */
function strokeRow(user: TestUser, boardId: string, householdId: string) {
  return {
    board_id: boardId,
    household_id: householdId,
    color: "#212121",
    width: 32,
    points: [0, 0, 100, 100],
    created_by: user.userId,
  };
}

/** An ingredient as the app stores it; the id only has to look like a UUID. */
function ingredient(index: number, name = "Flour", quantity: unknown = null) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name,
    quantity,
  };
}

/** A recipe row as the app inserts it; tests override the field under test. */
function recipeRow(user: TestUser, householdId: string) {
  return {
    household_id: householdId,
    title: "Pancakes",
    servings: "4",
    ingredients: [ingredient(1, "Flour", "250 g"), ingredient(2, "Eggs")],
    instructions: "Mix.\nFry.",
    created_by: user.userId,
  };
}

/** A vacation as the app hands it to create_vacation; tests override the field under test. */
function vacationJson(householdId: string) {
  return {
    id: randomUUID(),
    household_id: householdId,
    title: "Denmark",
    kind: "house",
    starts_on: "2026-12-05",
    ends_on: "2026-12-12",
  };
}

/** A template task as the app hands it to create_vacation. */
function taskJson(position: number, title: string, phase = "before") {
  return { id: randomUUID(), phase, title, position };
}

/** A vacation row for a direct insert, which the app doesn't do but a member could. */
function vacationRow(user: TestUser, householdId: string) {
  return {
    household_id: householdId,
    title: "Denmark",
    kind: "house",
    starts_on: "2026-12-05",
    ends_on: "2026-12-12",
    created_by: user.userId,
  };
}

/** A task row as the app inserts it when a member adds one. */
function vacationTaskRow(
  user: TestUser,
  vacationId: string,
  householdId: string,
) {
  return {
    vacation_id: vacationId,
    household_id: householdId,
    phase: "before",
    title: "Clothes",
    position: 1,
    created_by: user.userId,
  };
}

/** A person as the app hands one to create_vacation; `userId` is null for a
 * person without an account. */
function personJson(name: string, userId: string | null = null) {
  return { id: randomUUID(), name, user_id: userId };
}

/** A person row for a direct insert, as the app adds one to a vacation. */
function vacationPersonRow(
  user: TestUser,
  vacationId: string,
  householdId: string,
) {
  return {
    vacation_id: vacationId,
    household_id: householdId,
    name: "Mia",
    user_id: null as string | null,
    created_by: user.userId,
  };
}

describe("household RLS isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;
  let householdAId: string;
  let householdBId: string;
  let boardAId: string;
  let boardBId: string;
  let strokeAId: string;
  let recipeAId: string;
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

    householdAId = await createHousehold(userA.client, `Household A ${runId}`);
    householdBId = await createHousehold(userB.client, `Household B ${runId}`);

    await addTodoItem(userA.client, householdAId, "Buy milk (household A)");
    await addTodoItem(userB.client, householdBId, "Walk the dog (household B)");

    boardAId = await addBoard(userA.client, householdAId);
    boardBId = await addBoard(userB.client, householdBId);
    const { data: stroke, error } = await userA.client
      .from("board_strokes")
      .insert(strokeRow(userA, boardAId, householdAId))
      .select("id")
      .single();
    if (error || !stroke) throw error ?? new Error("stroke insert failed");
    strokeAId = stroke.id as string;

    const { data: recipe, error: recipeError } = await userA.client
      .from("recipes")
      .insert(recipeRow(userA, householdAId))
      .select("id")
      .single();
    if (recipeError || !recipe)
      throw recipeError ?? new Error("recipe insert failed");
    recipeAId = recipe.id as string;

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

  it("lets a member read their own household", async () => {
    const { data, error } = await userA.client
      .from("households")
      .select("id")
      .eq("id", householdAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("hides another household from a non-member (RLS filters, not an error)", async () => {
    const { data, error } = await userB.client
      .from("households")
      .select("id")
      .eq("id", householdAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("returns zero of household A's todo_items to a member of household B", async () => {
    const { data, error } = await userB.client
      .from("todo_items")
      .select("title")
      .eq("household_id", householdAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("lets a member read their own household's todo_items", async () => {
    const { data, error } = await userA.client
      .from("todo_items")
      .select("title")
      .eq("household_id", householdAId);
    expect(error).toBeNull();
    expect(data).toEqual([{ title: "Buy milk (household A)" }]);
  });

  it("blocks a direct self-insert into an existing household (must use redeem_invite)", async () => {
    const { error } = await userB.client.from("household_members").insert({
      household_id: householdAId,
      user_id: userB.userId,
      role: "member",
    });
    expect(error).not.toBeNull();
  });

  it("create_invite rejects a caller who is not a member of the household", async () => {
    const { data, error } = await userB.client.rpc("create_invite", {
      p_household_id: householdAId,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("redeem_invite grants a new member access to the household", async () => {
    const { data: code, error: inviteError } = await userA.client.rpc(
      "create_invite",
      {
        p_household_id: householdAId,
      },
    );
    expect(inviteError).toBeNull();

    const { data: joinedHouseholdId, error: redeemError } =
      await userC.client.rpc("redeem_invite", { p_code: code });
    expect(redeemError).toBeNull();
    expect(joinedHouseholdId).toBe(householdAId);

    const { data, error } = await userC.client
      .from("todo_items")
      .select("title")
      .eq("household_id", householdAId);
    expect(error).toBeNull();
    expect(data).toEqual([{ title: "Buy milk (household A)" }]);
  });

  it("redeem_invite does not count a redemption by an existing member", async () => {
    const { data: code, error: inviteError } = await userA.client.rpc(
      "create_invite",
      {
        p_household_id: householdAId,
      },
    );
    expect(inviteError).toBeNull();

    const { data: joinedHouseholdId, error: redeemError } =
      await userA.client.rpc("redeem_invite", { p_code: code });
    expect(redeemError).toBeNull();
    expect(joinedHouseholdId).toBe(householdAId);

    const { data: invite, error } = await admin
      .from("household_invites")
      .select("use_count")
      .eq("code", code!)
      .single();
    expect(error).toBeNull();
    expect(invite!.use_count).toBe(0);
  });

  it("redeem_invite rejects an expired code", async () => {
    const code = await insertInvite(householdAId, userA.userId, {
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const { data, error } = await userB.client.rpc("redeem_invite", {
      p_code: code,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("redeem_invite rejects an exhausted code", async () => {
    const code = await insertInvite(householdAId, userA.userId, {
      max_uses: 1,
      use_count: 1,
    });

    const { data, error } = await userB.client.rpc("redeem_invite", {
      p_code: code,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("list_household_members gives a member the email addresses of their own household", async () => {
    const { data, error } = await userA.client.rpc("list_household_members", {
      p_household_id: householdAId,
    });
    expect(error).toBeNull();
    // Not the exact list: an earlier test may have added user C to household A.
    expect(data).toContainEqual({
      user_id: userA.userId,
      email: userA.email,
      joined_at: expect.any(String),
    });
    expect(data.map((member: { email: string }) => member.email)).not.toContain(
      userB.email,
    );
  });

  it("list_household_members returns nothing of household A to a member of household B (no rows, not an error)", async () => {
    const { data, error } = await userB.client.rpc("list_household_members", {
      p_household_id: householdAId,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("list_household_members cannot be called without signing in", async () => {
    const { data, error } = await signedOut.rpc("list_household_members", {
      p_household_id: householdAId,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("returns zero of household A's whiteboard to a member of household B", async () => {
    const boards = await userB.client
      .from("boards")
      .select("id")
      .eq("id", boardAId);
    expect(boards.error).toBeNull();
    expect(boards.data).toHaveLength(0);

    const strokes = await userB.client
      .from("board_strokes")
      .select("id")
      .eq("board_id", boardAId);
    expect(strokes.error).toBeNull();
    expect(strokes.data).toHaveLength(0);
  });

  it("lets a member read their own household's strokes", async () => {
    const { data, error } = await userA.client
      .from("board_strokes")
      .select("id, points")
      .eq("board_id", boardAId);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: strokeAId, points: [0, 0, 100, 100] }]);
  });

  it("blocks drawing on another household's board", async () => {
    const { error } = await userB.client
      .from("board_strokes")
      .insert(strokeRow(userB, boardAId, householdAId));
    expect(error).not.toBeNull();
  });

  it("blocks a stroke that names the member's own household but another household's board", async () => {
    // The policy alone would pass this row (household B is the caller's);
    // the composite foreign key ties the stroke to its board's household.
    const { error } = await userB.client
      .from("board_strokes")
      .insert(strokeRow(userB, boardAId, householdBId));
    expect(error).not.toBeNull();
  });

  it("leaves another household's stroke untouched by an erase (RLS filters, not an error)", async () => {
    const { error } = await userB.client
      .from("board_strokes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", strokeAId);
    expect(error).toBeNull();

    const { data: stroke } = await admin
      .from("board_strokes")
      .select("deleted_at")
      .eq("id", strokeAId)
      .single();
    expect(stroke!.deleted_at).toBeNull();
  });

  it("does not let a member hard-delete a stroke, only soft-delete it", async () => {
    const { error } = await userA.client
      .from("board_strokes")
      .delete()
      .eq("id", strokeAId);
    expect(error).not.toBeNull();

    const { data: stroke } = await admin
      .from("board_strokes")
      .select("id")
      .eq("id", strokeAId)
      .single();
    expect(stroke).toEqual({ id: strokeAId });
  });

  it("allows only one board per household", async () => {
    const { error } = await userB.client
      .from("boards")
      .insert({ household_id: householdBId });
    expect(error).not.toBeNull();
  });

  it.each([
    ["not an array", { points: { x: 1, y: 2 } }],
    ["no points", { points: [] }],
    ["an odd number of coordinates", { points: [0, 0, 100] }],
    ["a coordinate that is not a number", { points: [0, "100"] }],
    ["a coordinate outside the board", { points: [0, 4001] }],
    ["more points than a stroke may have", { points: new Array(2002).fill(0) }],
    ["a color that is not #rrggbb", { color: "red" }],
    ["a pen width outside the allowed range", { width: 0 }],
  ])("rejects a stroke with %s", async (_name, override) => {
    const { error } = await userB.client
      .from("board_strokes")
      .insert({ ...strokeRow(userB, boardBId, householdBId), ...override });
    expect(error).not.toBeNull();
  });

  it("accepts a stroke of the largest allowed size", async () => {
    const { error } = await userB.client.from("board_strokes").insert({
      ...strokeRow(userB, boardBId, householdBId),
      points: new Array(2000).fill(4000),
    });
    expect(error).toBeNull();
  });

  it.each(["todo_lists", "shopping_lists"])(
    "allows only one of %s per household",
    async (table) => {
      // Whether the household has a list yet differs by table; after the
      // first insert it has one either way.
      await userB.client.from(table).insert({ household_id: householdBId });
      const { error } = await userB.client
        .from(table)
        .insert({ household_id: householdBId });
      expect(error).not.toBeNull();

      const { data: lists } = await admin
        .from(table)
        .select("id")
        .eq("household_id", householdBId);
      expect(lists).toHaveLength(1);
    },
  );

  it("returns zero of household A's recipes to a member of household B", async () => {
    const { data, error } = await userB.client
      .from("recipes")
      .select("id")
      .eq("household_id", householdAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("lets a member read their own household's recipes", async () => {
    const { data, error } = await userA.client
      .from("recipes")
      .select("id, title, ingredients")
      .eq("household_id", householdAId);
    expect(error).toBeNull();
    expect(data).toEqual([
      {
        id: recipeAId,
        title: "Pancakes",
        ingredients: recipeRow(userA, householdAId).ingredients,
      },
    ]);
  });

  it("does not let recipes be read without signing in", async () => {
    const { data, error } = await signedOut.from("recipes").select("id");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("blocks adding a recipe to another household", async () => {
    const { error } = await userB.client
      .from("recipes")
      .insert(recipeRow(userB, householdAId));
    expect(error).not.toBeNull();
  });

  it("leaves another household's recipe untouched by an edit or a removal (RLS filters, not an error)", async () => {
    const { error } = await userB.client
      .from("recipes")
      .update({ title: "Taken over", deleted_at: new Date().toISOString() })
      .eq("id", recipeAId);
    expect(error).toBeNull();

    const { data: recipe } = await admin
      .from("recipes")
      .select("title, deleted_at")
      .eq("id", recipeAId)
      .single();
    expect(recipe).toEqual({ title: "Pancakes", deleted_at: null });
  });

  it("blocks moving a recipe into another household", async () => {
    const { error } = await userA.client
      .from("recipes")
      .update({ household_id: householdBId })
      .eq("id", recipeAId);
    expect(error).not.toBeNull();
  });

  it("does not let a member hard-delete a recipe, only soft-delete it", async () => {
    const { error } = await userA.client
      .from("recipes")
      .delete()
      .eq("id", recipeAId);
    expect(error).not.toBeNull();

    const { data: recipe } = await admin
      .from("recipes")
      .select("id")
      .eq("id", recipeAId)
      .single();
    expect(recipe).toEqual({ id: recipeAId });
  });

  it.each([
    ["a blank title", { title: "  " }],
    ["a title that is too long", { title: "a".repeat(201) }],
    ["blank servings", { servings: " " }],
    ["servings that are too long", { servings: "4".repeat(51) }],
    ["instructions that are too long", { instructions: "a".repeat(20001) }],
    ["ingredients that are not an array", { ingredients: { name: "Flour" } }],
    [
      "more ingredients than a recipe may have",
      { ingredients: Array.from({ length: 101 }, (_, i) => ingredient(i)) },
    ],
    ["an ingredient that is not an object", { ingredients: ["Flour"] }],
    ["an ingredient wrapped in an array", { ingredients: [[ingredient(1)]] }],
    [
      "an ingredient without an id",
      { ingredients: [{ name: "Flour", quantity: null }] },
    ],
    [
      "an ingredient whose id is not a UUID",
      { ingredients: [{ ...ingredient(1), id: "first" }] },
    ],
    [
      "an ingredient without a name",
      { ingredients: [{ id: ingredient(1).id, quantity: null }] },
    ],
    ["an ingredient with a blank name", { ingredients: [ingredient(1, " ")] }],
    [
      "an ingredient whose name is too long",
      { ingredients: [ingredient(1, "a".repeat(201))] },
    ],
    [
      "an ingredient without a quantity field",
      { ingredients: [{ id: ingredient(1).id, name: "Flour" }] },
    ],
    [
      "an ingredient whose quantity is not text",
      { ingredients: [ingredient(1, "Eggs", 6)] },
    ],
    [
      "an ingredient with a blank quantity",
      { ingredients: [ingredient(1, "Eggs", " ")] },
    ],
    [
      "an ingredient whose quantity is too long",
      { ingredients: [ingredient(1, "Eggs", "6".repeat(51))] },
    ],
    [
      "an ingredient with a field the app doesn't know",
      { ingredients: [{ ...ingredient(1), note: "sifted" }] },
    ],
    [
      "one bad ingredient among good ones",
      { ingredients: [ingredient(1), ingredient(2, "")] },
    ],
  ])("rejects a recipe with %s", async (_name, override) => {
    const { error } = await userB.client
      .from("recipes")
      .insert({ ...recipeRow(userB, householdBId), ...override });
    expect(error).not.toBeNull();
  });

  it("accepts a recipe of the largest allowed size", async () => {
    const { error } = await userB.client.from("recipes").insert({
      ...recipeRow(userB, householdBId),
      title: "ä".repeat(200),
      servings: "4".repeat(50),
      instructions: "a".repeat(20000),
      ingredients: Array.from({ length: 100 }, (_, i) =>
        ingredient(i, "ä".repeat(200), "6".repeat(50)),
      ),
    });
    expect(error).toBeNull();
  });

  it("accepts a recipe with nothing but a title", async () => {
    const { error } = await userB.client.from("recipes").insert({
      household_id: householdBId,
      title: "Toast",
      created_by: userB.userId,
    });
    expect(error).toBeNull();
  });

  it("returns zero of household A's vacations and their tasks to a member of household B", async () => {
    const vacations = await userB.client
      .from("vacations")
      .select("id")
      .eq("household_id", householdAId);
    expect(vacations.error).toBeNull();
    expect(vacations.data).toHaveLength(0);

    const tasks = await userB.client
      .from("vacation_tasks")
      .select("id")
      .eq("vacation_id", vacationAId);
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
    const vacations = await signedOut.from("vacations").select("id");
    expect(vacations.data).toBeNull();
    expect(vacations.error).not.toBeNull();

    const tasks = await signedOut.from("vacation_tasks").select("id");
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
    const vacation = await userB.client
      .from("vacations")
      .insert(vacationRow(userB, householdAId));
    expect(vacation.error).not.toBeNull();

    const task = await userB.client
      .from("vacation_tasks")
      .insert(vacationTaskRow(userB, vacationAId, householdAId));
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
    const vacation = await userB.client
      .from("vacations")
      .update({ title: "Taken over", deleted_at: removedAt })
      .eq("id", vacationAId);
    expect(vacation.error).toBeNull();
    const task = await userB.client
      .from("vacation_tasks")
      .update({ title: "Taken over", done: true, deleted_at: removedAt })
      .eq("id", taskAId);
    expect(task.error).toBeNull();

    const { data: vacationRowNow } = await admin
      .from("vacations")
      .select("title, deleted_at")
      .eq("id", vacationAId)
      .single();
    expect(vacationRowNow).toEqual({ title: "Denmark", deleted_at: null });
    const { data: taskRowNow } = await admin
      .from("vacation_tasks")
      .select("title, done, deleted_at")
      .eq("id", taskAId)
      .single();
    expect(taskRowNow).toEqual({
      title: "Clothes",
      done: false,
      deleted_at: null,
    });
  });

  it("blocks moving a vacation or a task into another household", async () => {
    const vacation = await userA.client
      .from("vacations")
      .update({ household_id: householdBId })
      .eq("id", vacationAId);
    expect(vacation.error).not.toBeNull();

    const task = await userA.client
      .from("vacation_tasks")
      .update({ household_id: householdBId })
      .eq("id", taskAId);
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
    const task = await userA.client
      .from("vacation_tasks")
      .delete()
      .eq("id", taskAId);
    expect(task.error).not.toBeNull();
    const vacation = await userA.client
      .from("vacations")
      .delete()
      .eq("id", vacationAId);
    expect(vacation.error).not.toBeNull();

    const { data: vacations } = await admin
      .from("vacations")
      .select("id")
      .eq("id", vacationAId);
    expect(vacations).toEqual([{ id: vacationAId }]);
    const { data: tasks } = await admin
      .from("vacation_tasks")
      .select("id")
      .eq("id", taskAId);
    expect(tasks).toEqual([{ id: taskAId }]);
  });

  it.each([
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

  it.each([
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
    const vacation = await userB.client.from("vacations").insert({
      ...vacationRow(userB, householdBId),
      title: longest,
      ends_on: "2026-12-05",
    });
    expect(vacation.error).toBeNull();

    const task = await userB.client.from("vacation_tasks").insert({
      ...vacationTaskRow(userB, vacationBId, householdBId),
      title: longest,
    });
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
    const people = await userB.client
      .from("vacation_people")
      .select("id")
      .eq("vacation_id", vacationAId);
    expect(people.error).toBeNull();
    expect(people.data).toHaveLength(0);

    const signedOutRead = await signedOut.from("vacation_people").select("id");
    expect(signedOutRead.data).toBeNull();
    expect(signedOutRead.error).not.toBeNull();
  });

  it("blocks adding a person to another household's vacation, under either household", async () => {
    const asTheirs = await userB.client
      .from("vacation_people")
      .insert(vacationPersonRow(userB, vacationAId, householdAId));
    expect(asTheirs.error).not.toBeNull();

    // The policy alone would pass this row; the composite foreign key ties
    // the person to the vacation's household.
    const asOwn = await userB.client
      .from("vacation_people")
      .insert(vacationPersonRow(userB, vacationAId, householdBId));
    expect(asOwn.error).not.toBeNull();
  });

  it("leaves another household's person untouched, and lets no member hard-delete one", async () => {
    const edit = await userB.client
      .from("vacation_people")
      .update({ name: "Taken over", deleted_at: new Date().toISOString() })
      .eq("id", guestAId);
    expect(edit.error).toBeNull();
    const removal = await userA.client
      .from("vacation_people")
      .delete()
      .eq("id", guestAId);
    expect(removal.error).not.toBeNull();

    const { data: person } = await admin
      .from("vacation_people")
      .select("name, deleted_at")
      .eq("id", guestAId)
      .single();
    expect(person).toEqual({ name: "Mia", deleted_at: null });
  });

  it("puts a member on a vacation only once, and lets two people without an account share a name", async () => {
    const twice = await userA.client.from("vacation_people").insert({
      ...vacationPersonRow(userA, vacationAId, householdAId),
      name: "alex again",
      user_id: userA.userId,
    });
    expect(twice.error).not.toBeNull();

    const sameName = await userA.client
      .from("vacation_people")
      .insert(vacationPersonRow(userA, vacationAId, householdAId));
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

  it.each([
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

  it.each([
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
});
