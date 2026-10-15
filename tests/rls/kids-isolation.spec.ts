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

// Household RLS for the kids (0021): the children, their reactions to the
// plan's entries, and the kids' version of a recipe; the shapes the
// constraints enforce, the columns a member may not change, and the one live
// reaction per child and entry.

describe("kids RLS isolation", () => {
  let userA: TestUser;
  let userB: TestUser;
  let householdAId: string;
  let householdBId: string;
  let childAId: string;
  let childBId: string;
  let entryAId: string;
  let entryBId: string;
  let recipeAId: string;

  /** An entry of the plan, as the app writes one. */
  async function addEntry(user: TestUser, householdId: string) {
    const id = randomUUID();
    const { error } = await user.client.from("meal_plan_entries").insert({
      id,
      household_id: householdId,
      date: "2026-10-20",
      slot: "dinner",
      title: "Toast",
    });
    if (error) throw error;
    return id;
  }

  /** A child, without created_by: the column's default is the caller. */
  async function addChild(user: TestUser, householdId: string, name: string) {
    const id = randomUUID();
    const { error } = await user.client
      .from("household_children")
      .insert({ id, household_id: householdId, name });
    if (error) throw error;
    return id;
  }

  /** A reaction of household A's child to household A's entry; tests
   * override the field under test. */
  function reactionRow(overrides: Record<string, unknown> = {}) {
    return {
      id: randomUUID(),
      household_id: householdAId,
      entry_id: entryAId,
      child_id: childAId,
      reaction: "refused",
      ...overrides,
    };
  }

  beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser("kids-a"),
      createTestUser("kids-b"),
    ]);
    [householdAId, householdBId] = await Promise.all([
      createHousehold(userA.client, `Household A ${runId}`),
      createHousehold(userB.client, `Household B ${runId}`),
    ]);
    [childAId, childBId, entryAId, entryBId] = await Promise.all([
      addChild(userA, householdAId, "Mila"),
      addChild(userB, householdBId, "Jo"),
      addEntry(userA, householdAId),
      addEntry(userB, householdBId),
    ]);
    const { data, error } = await userA.client
      .from("recipes")
      .insert(recipeRow(userA, householdAId))
      .select("id")
      .single();
    if (error) throw error;
    recipeAId = data.id;
  });

  afterAll(async () => {
    await deleteTestData([householdAId, householdBId], [userA, userB]);
  });

  describe("household_children", () => {
    it("lets a member read their own household's children, created by them", async () => {
      const { data, error } = await userA.client
        .from("household_children")
        .select("id, name, created_by")
        .eq("household_id", householdAId);
      expect(error).toBeNull();
      expect(data).toEqual([
        { id: childAId, name: "Mila", created_by: userA.userId },
      ]);
    });

    it("returns zero of household A's children to a member of household B", async () => {
      const { data, error } = await userB.client
        .from("household_children")
        .select("id")
        .eq("household_id", householdAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("does not let children be read without signing in", async () => {
      const { data, error } = await signedOut
        .from("household_children")
        .select("id");
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("refuses a child in another household", async () => {
      const { error } = await userB.client
        .from("household_children")
        .insert({ household_id: householdAId, name: "Intruder" });
      expect(error).not.toBeNull();
    });

    it.each([
      ["a blank name", { name: "   " }],
      ["a name over 100 characters", { name: "x".repeat(101) }],
    ])("refuses a child with %s", async (_, override) => {
      const { error } = await userA.client
        .from("household_children")
        .insert({ household_id: householdAId, ...override });
      expect(error).not.toBeNull();
    });

    it("refuses a created_by that is not the caller", async () => {
      const { error } = await userA.client.from("household_children").insert({
        household_id: householdAId,
        name: "Forged",
        created_by: userB.userId,
      });
      expect(error).not.toBeNull();
    });

    it("lets a member rename and soft-delete a child", async () => {
      const id = await addChild(userA, householdAId, "Noor");
      const rename = await userA.client
        .from("household_children")
        .update({ name: "Nora" })
        .eq("id", id)
        .select("id");
      expect(rename.error).toBeNull();
      expect(rename.data).toHaveLength(1);
      const remove = await userA.client
        .from("household_children")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      expect(remove.error).toBeNull();
      expect(remove.data).toHaveLength(1);
    });

    it.each([
      ["household_id", () => ({ household_id: householdBId })],
      ["created_by", () => ({ created_by: userB.userId })],
      ["created_at", () => ({ created_at: "2020-01-01T00:00:00Z" })],
    ])("refuses a change of %s", async (_, change) => {
      const { error } = await userA.client
        .from("household_children")
        .update(change())
        .eq("id", childAId);
      expect(error).not.toBeNull();
    });

    it("does not let a member of household B rename household A's child", async () => {
      const { data, error } = await userB.client
        .from("household_children")
        .update({ name: "Changed" })
        .eq("id", childAId)
        .select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("does not let a member hard-delete a child", async () => {
      const { error } = await userA.client
        .from("household_children")
        .delete()
        .eq("id", childAId);
      expect(error).not.toBeNull();
    });
  });

  describe("meal_reactions", () => {
    let reactionAId: string;

    beforeAll(async () => {
      const row = reactionRow();
      const { error } = await userA.client.from("meal_reactions").insert(row);
      if (error) throw error;
      reactionAId = row.id;
    });

    it("lets a member read their own household's reactions", async () => {
      const { data, error } = await userA.client
        .from("meal_reactions")
        .select("id, reaction, created_by")
        .eq("household_id", householdAId);
      expect(error).toBeNull();
      expect(data).toEqual([
        { id: reactionAId, reaction: "refused", created_by: userA.userId },
      ]);
    });

    it("returns zero of household A's reactions to a member of household B", async () => {
      const { data, error } = await userB.client
        .from("meal_reactions")
        .select("id")
        .eq("household_id", householdAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("does not let reactions be read without signing in", async () => {
      const { data, error } = await signedOut
        .from("meal_reactions")
        .select("id");
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("refuses a second live reaction of a child to an entry", async () => {
      const { error } = await userA.client
        .from("meal_reactions")
        .insert(reactionRow({ reaction: "picked_at" }));
      expect(error).not.toBeNull();
    });

    it("lets a reaction change, be taken back, and be recorded anew", async () => {
      const entryId = await addEntry(userA, householdAId);
      const first = reactionRow({ entry_id: entryId });
      expect(
        (await userA.client.from("meal_reactions").insert(first)).error,
      ).toBeNull();
      const change = await userA.client
        .from("meal_reactions")
        .update({ reaction: "picked_at" })
        .eq("id", first.id)
        .select("id");
      expect(change.error).toBeNull();
      expect(change.data).toHaveLength(1);
      const takeBack = await userA.client
        .from("meal_reactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", first.id)
        .select("id");
      expect(takeBack.error).toBeNull();
      expect(takeBack.data).toHaveLength(1);
      // Only one live row is unique: a new one is allowed beside the
      // removed one.
      const { error } = await userA.client
        .from("meal_reactions")
        .insert(reactionRow({ entry_id: entryId }));
      expect(error).toBeNull();
    });

    it.each([
      ["another household's entry", () => ({ entry_id: entryBId })],
      ["another household's child", () => ({ child_id: childBId })],
      ["an unknown reaction", () => ({ reaction: "loved" })],
      [
        "a created_by that is not the caller",
        () => ({ created_by: userB.userId }),
      ],
    ])("refuses a reaction with %s", async (_, override) => {
      // A real entry without a reaction, so only the override can be wrong.
      const entryId = await addEntry(userA, householdAId);
      const { error } = await userA.client
        .from("meal_reactions")
        .insert(reactionRow({ entry_id: entryId, ...override() }));
      expect(error).not.toBeNull();
    });

    it("refuses a reaction in another household", async () => {
      const entryId = await addEntry(userA, householdAId);
      const { error } = await userB.client
        .from("meal_reactions")
        .insert(reactionRow({ entry_id: entryId }));
      expect(error).not.toBeNull();
    });

    it.each([
      ["household_id", () => ({ household_id: householdBId })],
      ["entry_id", () => ({ entry_id: entryBId })],
      ["child_id", () => ({ child_id: childBId })],
      ["created_by", () => ({ created_by: userB.userId })],
    ])("refuses a change of %s", async (_, change) => {
      const { error } = await userA.client
        .from("meal_reactions")
        .update(change())
        .eq("id", reactionAId);
      expect(error).not.toBeNull();
    });

    it("does not let a member of household B change household A's reaction", async () => {
      const { data, error } = await userB.client
        .from("meal_reactions")
        .update({ reaction: "picked_at" })
        .eq("id", reactionAId)
        .select("id");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("does not let a member hard-delete a reaction", async () => {
      const { error } = await userA.client
        .from("meal_reactions")
        .delete()
        .eq("id", reactionAId);
      expect(error).not.toBeNull();
    });
  });

  describe("recipes.kids_version", () => {
    it("lets a member write a kids' version and take it away", async () => {
      const write = await userA.client
        .from("recipes")
        .update({ kids_version: "Without the pepper." })
        .eq("id", recipeAId)
        .select("kids_version");
      expect(write.error).toBeNull();
      expect(write.data).toEqual([{ kids_version: "Without the pepper." }]);
      const clear = await userA.client
        .from("recipes")
        .update({ kids_version: null })
        .eq("id", recipeAId)
        .select("kids_version");
      expect(clear.error).toBeNull();
      expect(clear.data).toEqual([{ kids_version: null }]);
    });

    it.each([
      ["a blank kids' version", "   "],
      ["a kids' version over 2000 characters", "x".repeat(2001)],
    ])("refuses %s", async (_, kidsVersion) => {
      const { error } = await userA.client
        .from("recipes")
        .update({ kids_version: kidsVersion })
        .eq("id", recipeAId);
      expect(error).not.toBeNull();
    });
  });
});
