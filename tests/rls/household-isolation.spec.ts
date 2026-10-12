// @vitest-environment node
//
// Admin-API test script, not a component test: must run under Node (no
// `window`), since supabase-js refuses to use a secret key whenever it
// detects a browser-like global scope -- happy-dom's `window` would trip
// that guard and raise "Forbidden use of secret API key in browser".
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
  });

  afterAll(async () => {
    await deleteTestData([householdAId, householdBId], [userA, userB, userC]);
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
});
