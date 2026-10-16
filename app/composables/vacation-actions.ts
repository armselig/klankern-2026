import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import type {
  NewVacation,
  NewVacationPerson,
  NewVacationTask,
  Vacation,
  VacationDetails,
  VacationPerson,
  VacationPhase,
  VacationTask,
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

/**
 * Every person of the household's vacations, those taken off a trip
 * included: a rejection keeps the name of who said no, and the app works
 * out from the row that a task given to such a person is nobody's.
 */
export async function fetchVacationPeople(
  client: Client,
  householdId: string,
): Promise<VacationPerson[]> {
  return fetchAllPages((afterId) => {
    let query = client
      .from("vacation_people")
      .select()
      .eq("household_id", householdId)
      .order("id")
      .limit(VACATION_PAGE_SIZE);
    if (afterId) query = query.gt("id", afterId);
    return query;
  });
}

/** A new vacation with the ids the client gave it and its tasks. Type
 * aliases, not interfaces: only an alias is assignable to the generated
 * `Json` type of the function's arguments. */
export type VacationToCreate = NewVacation & {
  id: string;
  householdId: string;
};
export type TaskToCreate = NewVacationTask & { id: string };
export type PersonToCreate = NewVacationPerson & { id: string };

/** The rows create_vacation wrote. */
export interface CreatedVacation {
  vacation: Vacation;
  tasks: VacationTask[];
  people: VacationPerson[];
}

/**
 * Adds a vacation with the tasks it starts with and the people who are
 * coming in one transaction, through the function create_vacation
 * (migrations 0015, 0016 and 0022): with separate inserts a failure after the
 * first would leave a vacation without tasks, which every member would see. The ids are the client's, so the rows that come back
 * and the Realtime echoes of their inserts share one key each.
 */
export async function createVacation(
  client: Client,
  vacation: VacationToCreate,
  tasks: TaskToCreate[],
  people: PersonToCreate[],
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
    p_people: people.map((person) => ({
      id: person.id,
      name: person.name,
      user_id: person.user_id,
      child_id: person.child_id,
    })),
  });
  if (error) throw error;
  // The function returns jsonb, so the generated type is Json; it builds the
  // object from the rows it inserted.
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
 * server-confirmed row share one key (see utils/list-state.ts). A task
 * added while the page lists one person's tasks is theirs from the start,
 * in the same insert, so it never shows as nobody's in between. */
export async function insertVacationTask(
  client: Client,
  task: {
    id: string;
    vacationId: string;
    householdId: string;
    phase: VacationPhase;
    title: string;
    position: number;
    /** The person on the trip whose task it is, or null for nobody's. */
    assigneeId: string | null;
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
      assignee_id: task.assigneeId,
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

/** Adds a person to a vacation, with a client-supplied id (see
 * insertVacationTask). */
export async function insertVacationPerson(
  client: Client,
  person: NewVacationPerson & {
    id: string;
    vacationId: string;
    householdId: string;
  },
): Promise<VacationPerson> {
  const userId = await getCurrentUserId(client);
  const { data, error } = await client
    .from("vacation_people")
    .insert({
      id: person.id,
      vacation_id: person.vacationId,
      household_id: person.householdId,
      name: person.name,
      user_id: person.user_id,
      child_id: person.child_id,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameVacationPersonRemote(
  client: Client,
  id: string,
  name: string,
): Promise<void> {
  const { error } = await client
    .from("vacation_people")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}

/** Takes a person off a vacation. One write: their open tasks are shown as
 * nobody's from the person's row, and are not rewritten (see assigneeOf). */
export async function softDeleteVacationPersonRemote(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("vacation_people")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Gives a task to a person, takes it, or hands it back to nobody (null):
 * the same write. It clears a rejection, since only the latest one is kept,
 * and a task handed back was not rejected. */
export async function assignVacationTaskRemote(
  client: Client,
  taskId: string,
  personId: string | null,
): Promise<void> {
  const { error } = await client
    .from("vacation_tasks")
    .update({
      assignee_id: personId,
      rejected_by: null,
      rejection_reason: null,
    })
    .eq("id", taskId);
  if (error) throw error;
}

/**
 * Rejects a task with a reason: one conditional update, which only matches
 * while the task is still the rejecting person's. If someone gave it to
 * another person in the meantime it matches no row, which is no error to
 * Postgres, so the returned rows are counted.
 *
 * @returns whether the task was rejected; false when it wasn't that
 *   person's any more
 */
export async function rejectVacationTaskRemote(
  client: Client,
  taskId: string,
  personId: string,
  reason: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("vacation_tasks")
    .update({
      assignee_id: null,
      rejected_by: personId,
      rejection_reason: reason,
    })
    .eq("id", taskId)
    .eq("assignee_id", personId)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}
