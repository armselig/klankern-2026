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
  signedOut,
  type TestUser,
} from "../support/supabase-fixtures";
import { ingredient, recipeRow } from "../support/rls-rows";

// Household RLS for recipes, and the limits the table's constraints enforce.

describe("recipe RLS isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdAId: string;
  let householdBId: string;
  let recipeAId: string;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("a"),
      createTestUser("b"),
    ]);

    [householdAId, householdBId] = await Promise.all([
      createHousehold(userA.client, `Household A ${runId}`),
      createHousehold(userB.client, `Household B ${runId}`),
    ]);

    const { data: recipe, error } = await userA.client
      .from("recipes")
      .insert(recipeRow(userA, householdAId))
      .select("id")
      .single();
    if (error || !recipe) throw error ?? new Error("recipe insert failed");
    recipeAId = recipe.id as string;
  });

  afterAll(async () => {
    await deleteTestData([householdAId, householdBId], [userA, userB]);
  });

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

  it.concurrent.each([
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
