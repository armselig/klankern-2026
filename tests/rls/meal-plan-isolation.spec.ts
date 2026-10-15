// @vitest-environment node
//
// Admin-API test script, not a component test: must run under Node (no
// `window`), since supabase-js refuses to use a secret key whenever it
// detects a browser-like global scope (see recipe-isolation.spec.ts).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createHousehold,
  createTestUser,
  deleteTestData,
  runId,
  signedOut,
  type TestUser,
} from "../support/supabase-fixtures";
import { recipeRow } from "../support/rls-rows";

// Household RLS for the meal plan (0018), the shape its constraints enforce,
// and the columns a member may not change once an entry exists.

/** An entry of household `householdId` on a fixed day; tests override the
 * field under test. */
function entryRow(householdId: string) {
  return {
    id: randomUUID(),
    household_id: householdId,
    date: "2026-10-20",
    slot: "dinner",
    title: "Toast",
  };
}

describe("meal plan RLS isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdAId: string;
  let householdBId: string;
  let recipeAId: string;
  let recipeBId: string;
  let entryAId: string;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("a"),
      createTestUser("b"),
    ]);
    [householdAId, householdBId] = await Promise.all([
      createHousehold(userA.client, `Household A ${runId}`),
      createHousehold(userB.client, `Household B ${runId}`),
    ]);

    const [recipeA, recipeB] = await Promise.all([
      userA.client
        .from("recipes")
        .insert(recipeRow(userA, householdAId))
        .select("id")
        .single(),
      userB.client
        .from("recipes")
        .insert(recipeRow(userB, householdBId))
        .select("id")
        .single(),
    ]);
    if (!recipeA.data || !recipeB.data)
      throw recipeA.error ?? recipeB.error ?? new Error("recipe insert failed");
    recipeAId = recipeA.data.id as string;
    recipeBId = recipeB.data.id as string;

    // Without created_by: the column's default is the caller.
    const entry = entryRow(householdAId);
    const { error } = await userA.client
      .from("meal_plan_entries")
      .insert(entry);
    if (error) throw error;
    entryAId = entry.id;
  });

  afterAll(async () => {
    await deleteTestData([householdAId, householdBId], [userA, userB]);
  });

  it("lets a member read their own household's entries, created by them", async () => {
    const { data, error } = await userA.client
      .from("meal_plan_entries")
      .select("id, title, created_by")
      .eq("household_id", householdAId);
    expect(error).toBeNull();
    expect(data).toEqual([
      { id: entryAId, title: "Toast", created_by: userA.userId },
    ]);
  });

  it("returns zero of household A's entries to a member of household B", async () => {
    const { data, error } = await userB.client
      .from("meal_plan_entries")
      .select("id")
      .eq("household_id", householdAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("does not let entries be read without signing in", async () => {
    const { data, error } = await signedOut
      .from("meal_plan_entries")
      .select("id");
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("refuses an entry in another household", async () => {
    const { error } = await userB.client
      .from("meal_plan_entries")
      .insert(entryRow(householdAId));
    expect(error).not.toBeNull();
  });

  it("lets a member plan one of their household's recipes", async () => {
    const { error } = await userA.client
      .from("meal_plan_entries")
      .insert({ ...entryRow(householdAId), title: null, recipe_id: recipeAId });
    expect(error).toBeNull();
  });

  it("refuses another household's recipe", async () => {
    const { error } = await userA.client
      .from("meal_plan_entries")
      .insert({ ...entryRow(householdAId), title: null, recipe_id: recipeBId });
    expect(error).not.toBeNull();
  });

  it.each([
    ["neither a recipe nor a title", { title: null }],
    ["both a recipe and a title", { recipe_id: "recipe" }],
    ["a blank title", { title: "   " }],
    ["a title over 200 characters", { title: "x".repeat(201) }],
    ["an unknown slot", { slot: "brunch" }],
  ])("refuses an entry with %s", async (_, override) => {
    const row: Record<string, unknown> = {
      ...entryRow(householdAId),
      ...override,
    };
    if (row.recipe_id === "recipe") row.recipe_id = recipeAId;
    const { error } = await userA.client.from("meal_plan_entries").insert(row);
    expect(error).not.toBeNull();
  });

  it("refuses a created_by that is not the caller", async () => {
    const { error } = await userA.client
      .from("meal_plan_entries")
      .insert({ ...entryRow(householdAId), created_by: userB.userId });
    expect(error).not.toBeNull();
  });

  it("lets a member skip and soft-delete an entry", async () => {
    const entry = entryRow(householdAId);
    await userA.client.from("meal_plan_entries").insert(entry);
    const skip = await userA.client
      .from("meal_plan_entries")
      .update({ skipped_at: new Date().toISOString() })
      .eq("id", entry.id)
      .select("id");
    expect(skip.error).toBeNull();
    expect(skip.data).toHaveLength(1);
    const remove = await userA.client
      .from("meal_plan_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", entry.id)
      .select("id");
    expect(remove.error).toBeNull();
    expect(remove.data).toHaveLength(1);
  });

  it.each([
    ["household_id", () => ({ household_id: householdBId })],
    ["created_by", () => ({ created_by: userB.userId })],
  ])("refuses a change of %s", async (_, change) => {
    const { error } = await userA.client
      .from("meal_plan_entries")
      .update(change())
      .eq("id", entryAId);
    expect(error).not.toBeNull();
  });

  it("does not let a member of household B change household A's entry", async () => {
    const { data, error } = await userB.client
      .from("meal_plan_entries")
      .update({ title: "Changed" })
      .eq("id", entryAId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("does not let a member hard-delete an entry", async () => {
    const { error } = await userA.client
      .from("meal_plan_entries")
      .delete()
      .eq("id", entryAId);
    expect(error).not.toBeNull();
  });
});
