// @vitest-environment node
//
// Admin-API test script, not a component test: must run under Node (no
// `window`), since supabase-js refuses to use a secret key whenever it
// detects a browser-like global scope -- happy-dom's `window` would trip
// that guard and raise "Forbidden use of secret API key in browser".
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  type TestUser,
} from "../support/supabase-fixtures";
import { addBoard, strokeRow } from "../support/rls-rows";

// Household RLS for the whiteboard: its board and strokes.

describe("whiteboard RLS isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdAId: string;
  let householdBId: string;
  let boardAId: string;
  let boardBId: string;
  let strokeAId: string;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("a"),
      createTestUser("b"),
    ]);

    [householdAId, householdBId] = await Promise.all([
      createHousehold(userA.client, `Household A ${runId}`),
      createHousehold(userB.client, `Household B ${runId}`),
    ]);

    [boardAId, boardBId] = await Promise.all([
      addBoard(userA.client, householdAId),
      addBoard(userB.client, householdBId),
    ]);
    const { data: stroke, error } = await userA.client
      .from("board_strokes")
      .insert(strokeRow(userA, boardAId, householdAId))
      .select("id")
      .single();
    if (error || !stroke) throw error ?? new Error("stroke insert failed");
    strokeAId = stroke.id as string;
  });

  afterAll(async () => {
    await deleteTestData([householdAId, householdBId], [userA, userB]);
  });

  it("returns zero of household A's whiteboard to a member of household B", async () => {
    const [boards, strokes] = await Promise.all([
      userB.client.from("boards").select("id").eq("id", boardAId),
      userB.client.from("board_strokes").select("id").eq("board_id", boardAId),
    ]);
    expect(boards.error).toBeNull();
    expect(boards.data).toHaveLength(0);
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

  it.concurrent.each([
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
});
