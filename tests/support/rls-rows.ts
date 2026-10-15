import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TestUser } from "./supabase-fixtures";

// Row builders and small inserts shared by the RLS specs in tests/rls/, which
// were split by feature so that Vitest runs them in parallel.

export async function addTodoItem(
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
export async function addBoard(
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
export function strokeRow(
  user: TestUser,
  boardId: string,
  householdId: string,
) {
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
export function ingredient(
  index: number,
  name = "Flour",
  quantity: unknown = null,
) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name,
    quantity,
  };
}

/** A recipe row as the app inserts it; tests override the field under test. */
export function recipeRow(user: TestUser, householdId: string) {
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
export function vacationJson(householdId: string) {
  return {
    id: randomUUID(),
    household_id: householdId,
    title: "Denmark",
    kind: "house",
    starts_on: "2026-12-05",
    ends_on: "2026-12-12",
  };
}

/** A task as the app hands it to create_vacation. */
export function taskJson(position: number, title: string, phase = "before") {
  return { id: randomUUID(), phase, title, position };
}

/** A vacation row for a direct insert, which the app doesn't do but a member could. */
export function vacationRow(user: TestUser, householdId: string) {
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
export function vacationTaskRow(
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
export function personJson(name: string, userId: string | null = null) {
  return { id: randomUUID(), name, user_id: userId };
}

/** A person row for a direct insert, as the app adds one to a vacation. */
export function vacationPersonRow(
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

/** A meal row for a direct insert, as the app adds one: a recipe of the
 * household picked for the vacation. */
export function vacationMealRow(
  user: TestUser,
  vacationId: string,
  householdId: string,
  recipeId: string,
) {
  return {
    vacation_id: vacationId,
    household_id: householdId,
    recipe_id: recipeId,
    position: 1,
    created_by: user.userId,
  };
}
