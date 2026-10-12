import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type { TodoItem, TodoList } from "~/types/todo";
import { getCurrentUserId } from "./current-user";

type Client = SupabaseClient<Database>;

/**
 * Plain, framework-agnostic todo-list operations -- see household-actions.ts
 * for why these are kept separate from the Pinia store.
 */

/**
 * MVP scope is one shared todo list per household: find it, or create it on
 * first use. The insert ignores a conflict on the household (the table allows
 * one list each), so two members opening the list for the first time at the
 * same moment end up on the same list; it is read back afterwards because an
 * ignored insert returns no row.
 */
export async function fetchOrCreateTodoList(
  client: Client,
  householdId: string,
): Promise<TodoList> {
  const { data: existing, error: fetchError } = await client
    .from("todo_lists")
    .select()
    .eq("household_id", householdId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (existing) return existing;

  const { error: createError } = await client
    .from("todo_lists")
    .upsert(
      { household_id: householdId },
      { onConflict: "household_id", ignoreDuplicates: true },
    );
  if (createError) throw createError;

  const { data: created, error: readError } = await client
    .from("todo_lists")
    .select()
    .eq("household_id", householdId)
    .single();
  if (readError) throw readError;
  return created;
}

export async function fetchTodoItems(
  client: Client,
  listId: string,
): Promise<TodoItem[]> {
  const { data, error } = await client
    .from("todo_items")
    .select()
    .eq("list_id", listId)
    .is("deleted_at", null)
    .order("position");
  if (error) throw error;
  return data;
}

/** Inserts with a client-supplied id so the store's optimistic entry and the
 * server-confirmed row share one key (see utils/list-state.ts). */
export async function insertTodoItem(
  client: Client,
  item: {
    id: string;
    listId: string;
    householdId: string;
    title: string;
    position: number;
  },
): Promise<TodoItem> {
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from("todo_items")
    .insert({
      id: item.id,
      list_id: item.listId,
      household_id: item.householdId,
      title: item.title,
      position: item.position,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setTodoItemDone(
  client: Client,
  id: string,
  done: boolean,
): Promise<void> {
  const { error } = await client
    .from("todo_items")
    .update({ done })
    .eq("id", id);
  if (error) throw error;
}

export async function softDeleteTodoItemRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("todo_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
