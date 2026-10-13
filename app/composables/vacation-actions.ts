import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type {
  NewVacation,
  Vacation,
  VacationDetails,
  VacationPhase,
  VacationTask,
  VacationTemplateTask,
} from "~/types/vacation";
import { getCurrentUserId } from "./current-user";

type Client = SupabaseClient<Database>;

/**
 * Plain, framework-agnostic vacation operations -- see household-actions.ts
 * for why these are kept separate from the Pinia store.
 */

/** Rows fetched per request. Below PostgREST's row limit (1000 unless the
 * project lowers it), so a page shorter than this is certainly the last one. */
export const VACATION_PAGE_SIZE = 500;

/** What one request for a page of rows resolves to. */
interface Page<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Collects every page of a query. The pages are cut by id, not by offset: a
 * row removed between two requests would shift an offset and make the next
 * page skip a row.
 */
async function fetchAllPages<T extends { id: string }>(
  fetchPage: (afterId: string | null) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let afterId: string | null = null;
  for (;;) {
    const { data, error } = await fetchPage(afterId);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    const last = page.at(-1);
    if (!last || page.length < VACATION_PAGE_SIZE) return rows;
    afterId = last.id;
  }
}

/** Every vacation of the household that isn't removed, past ones included:
 * the list shows them all. The order is the caller's to establish (see
 * groupVacations). */
export async function fetchVacations(
  client: Client,
  householdId: string,
): Promise<Vacation[]> {
  const rows = await fetchAllPages((afterId) => {
    let query = client
      .from("vacations")
      .select()
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("id")
      .limit(VACATION_PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    return query;
  });
  // `kind` is text with a check constraint, so the generated type is string.
  return rows as Vacation[];
}

/**
 * Every task of the household that isn't removed, across its vacations: the
 * dashboard's tile and the list count them for each. The tasks of a removed
 * vacation come along and are never shown, since removing a vacation is one
 * write to the vacation alone.
 */
export async function fetchVacationTasks(
  client: Client,
  householdId: string,
): Promise<VacationTask[]> {
  const rows = await fetchAllPages((afterId) => {
    let query = client
      .from("vacation_tasks")
      .select()
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("id")
      .limit(VACATION_PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    return query;
  });
  // `phase` is text with a check constraint, as `kind` is.
  return rows as VacationTask[];
}

/** A new vacation with the ids the client gave it and its tasks. Type
 * aliases, not interfaces: only an alias is assignable to the generated
 * `Json` type of the function's arguments. */
export type VacationToCreate = NewVacation & {
  id: string;
  householdId: string;
};
export type TaskToCreate = VacationTemplateTask & { id: string };

/** The rows create_vacation wrote. */
export interface CreatedVacation {
  vacation: Vacation;
  tasks: VacationTask[];
}

/**
 * Adds a vacation with the tasks of its template in one transaction, through
 * the function create_vacation (migration 0015): with separate inserts a
 * failure after the first would leave a vacation without tasks, which every
 * member would see. The ids are the client's, so the rows that come back
 * and the Realtime echoes of their inserts share one key each.
 */
export async function createVacation(
  client: Client,
  vacation: VacationToCreate,
  tasks: TaskToCreate[],
): Promise<CreatedVacation> {
  const { data, error } = await client.rpc("create_vacation", {
    p_vacation: {
      id: vacation.id,
      household_id: vacation.householdId,
      title: vacation.title,
      kind: vacation.kind,
      starts_on: vacation.starts_on,
      ends_on: vacation.ends_on,
    },
    p_tasks: tasks.map((task) => ({
      id: task.id,
      phase: task.phase,
      title: task.title,
      position: task.position,
    })),
  });
  if (error) throw error;
  // The function returns jsonb, so the generated type is Json; it builds the
  // object from the two rows it inserted.
  return data as unknown as CreatedVacation;
}

/**
 * Saves an edit of a vacation. Only the fields the member changed are sent,
 * so two members changing different fields at the same time don't overwrite
 * each other. A removed vacation is not edited: the update then matches no
 * row, which is no error to Postgres, so the returned rows are counted to
 * tell a saved edit from one that went nowhere.
 */
export async function updateVacationRemote(
  client: Client,
  id: string,
  changes: Partial<VacationDetails>,
): Promise<void> {
  const { data, error } = await client
    .from("vacations")
    .update(changes)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  if (data.length === 0)
    throw new Error("This vacation was removed in the meantime.");
}

/** Removes a vacation. Its tasks stay as rows and leave the view with it. */
export async function softDeleteVacationRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("vacations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Inserts with a client-supplied id so the store's optimistic entry and the
 * server-confirmed row share one key (see utils/list-state.ts). */
export async function insertVacationTask(
  client: Client,
  task: {
    id: string;
    vacationId: string;
    householdId: string;
    phase: VacationPhase;
    title: string;
    position: number;
  },
): Promise<VacationTask> {
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from("vacation_tasks")
    .insert({
      id: task.id,
      vacation_id: task.vacationId,
      household_id: task.householdId,
      phase: task.phase,
      title: task.title,
      position: task.position,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as VacationTask;
}

export async function setVacationTaskDone(
  client: Client,
  id: string,
  done: boolean,
): Promise<void> {
  const { error } = await client
    .from("vacation_tasks")
    .update({ done })
    .eq("id", id);
  if (error) throw error;
}

/** Saves a task's new title. Like updateVacationRemote, it tells a saved
 * edit from one whose task was removed in the meantime. */
export async function renameVacationTaskRemote(
  client: Client,
  id: string,
  title: string,
): Promise<void> {
  const { data, error } = await client
    .from("vacation_tasks")
    .update({ title })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  if (data.length === 0)
    throw new Error("This task was removed in the meantime.");
}

export async function softDeleteVacationTaskRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("vacation_tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
