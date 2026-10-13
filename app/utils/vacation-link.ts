import { ROUTES } from "./routes";

// The links the app hands to a messenger, and the sentences around them.
// Both kinds of link are built and read here, so the parameters' names live
// in one place. A parameter is only a key to find a row or a setting in the
// page's state; nothing is trusted from it.

const TASK_PARAMETER = "task";
const MINE_PARAMETER = "mine";

/** What a link to a vacation asks its page to do on arrival. */
export interface VacationLinkTarget {
  /** The task to open, scroll to, focus and mark. */
  taskId: string | null;
  /** Whether "Only my tasks" starts ticked. */
  onlyMine: boolean;
}

/** A link that lands at a task of a vacation. */
export function taskLink(
  origin: string,
  vacationId: string,
  taskId: string,
): string {
  const url = new URL(ROUTES.vacation(vacationId), origin);
  url.searchParams.set(TASK_PARAMETER, taskId);
  return url.toString();
}

/** A link that opens a vacation with "Only my tasks" ticked. */
export function myTasksLink(origin: string, vacationId: string): string {
  const url = new URL(ROUTES.vacation(vacationId), origin);
  url.searchParams.set(MINE_PARAMETER, "1");
  return url.toString();
}

/** Reads what a link asked for from the page's query. A parameter given
 * twice arrives as a list; the first one counts. */
export function readVacationLink(
  query: Record<string, unknown>,
): VacationLinkTarget {
  const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
  const task = first(query[TASK_PARAMETER]);
  return {
    taskId: typeof task === "string" && task !== "" ? task : null,
    onlyMine: first(query[MINE_PARAMETER]) === "1",
  };
}

/** The query without the link's parameters, to take them out of the address
 * once they are read: left there, a reload would mark the row again and
 * tick "Only my tasks" again. */
export function withoutVacationLink<T extends Record<string, unknown>>(
  query: T,
): Partial<T> {
  const { [TASK_PARAMETER]: _task, [MINE_PARAMETER]: _mine, ...rest } = query;
  return rest as Partial<T>;
}

/** The link is part of the sentence, and the share sheet gets the sentence
 * alone: apps that receive a share treat a separate link and text
 * differently, and some show only one. */
export function givenTaskMessage(
  taskTitle: string,
  vacationTitle: string,
  link: string,
): string {
  return `"${taskTitle}" is yours for ${vacationTitle}. Take a look: ${link}`;
}

export function rejectedTaskMessage(
  taskTitle: string,
  vacationTitle: string,
  reason: string,
  link: string,
): string {
  return `I said no to "${taskTitle}" for ${vacationTitle}: "${reason}" Who takes it? ${link}`;
}

/** One message for everything a person has, after a member gave them
 * several tasks in a row. */
export function openTasksMessage(
  open: number,
  vacationTitle: string,
  link: string,
): string {
  const tasks = open === 1 ? "1 open task" : `${open} open tasks`;
  return `You have ${tasks} for ${vacationTitle}: ${link}`;
}
