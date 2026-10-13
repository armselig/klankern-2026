import type { ItemsById } from "~/types/list";
import type {
  NewVacationPerson,
  TaskShare,
  VacationPerson,
  VacationTask,
} from "~/types/vacation";
import { openTaskCount } from "./vacation-state";

// Who is on a trip and who has which task. An assignment is a proposal
// between peers: the person does the task or rejects it with a reason, and
// a rejected task is nobody's until someone takes it.

/** The largest name and reason the tables accept (see their check
 * constraints in migration 0016). */
export const VACATION_PERSON_NAME_LIMIT = 100;
export const REJECTION_REASON_LIMIT = 200;

/**
 * The people who are on a vacation, in the order they were added. The
 * first ones are added in one statement and share its time; among those,
 * members come before people without an account, and then the name
 * decides, so the order is the same on every member's screen. People taken
 * off the trip are left out.
 */
export function peopleOfVacation(
  peopleById: ItemsById<VacationPerson>,
  vacationId: string,
): VacationPerson[] {
  return Object.values(peopleById)
    .filter((person) => person.vacation_id === vacationId && !person.deleted_at)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) ||
        Number(!a.user_id) - Number(!b.user_id) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
        a.id.localeCompare(b.id),
    );
}

/** The person the signed-in member is on a trip, or null: a member who
 * joined the household later is not on a vacation until someone adds them. */
export function personOfUser(
  people: readonly VacationPerson[],
  userId: string | null | undefined,
): VacationPerson | null {
  if (!userId) return null;
  return people.find((person) => person.user_id === userId) ?? null;
}

/**
 * Who has a task: its assignee, if that person is still on the trip. A task
 * given to someone who was taken off counts as nobody's. That is worked out
 * here, by the one function the task's row, "Who has what" and the
 * dashboard's tile all use, and not written to the tasks: removing a person
 * stays one write, and an assignment that arrives after the removal is
 * covered too.
 */
export function assigneeOf(
  task: Pick<VacationTask, "assignee_id">,
  peopleById: ItemsById<VacationPerson>,
): VacationPerson | null {
  if (!task.assignee_id) return null;
  const person = peopleById[task.assignee_id];
  return person && !person.deleted_at ? person : null;
}

/** Who said no to a task, if anyone. A person taken off the trip since is
 * still named: the row stays for that. */
export function rejecterOf(
  task: Pick<VacationTask, "rejected_by">,
  peopleById: ItemsById<VacationPerson>,
): VacationPerson | null {
  return task.rejected_by ? (peopleById[task.rejected_by] ?? null) : null;
}

/** Whether a task is the given person's. */
export function isTaskOf(
  task: Pick<VacationTask, "assignee_id">,
  person: VacationPerson | null,
  peopleById: ItemsById<VacationPerson>,
): boolean {
  return !!person && assigneeOf(task, peopleById)?.id === person.id;
}

/**
 * "Who has what": the open tasks of every person on the trip, in the
 * people's order, and those that are nobody's as the last line. A person
 * without an open task is listed with 0, so it shows who carries nothing.
 */
export function taskShares(
  tasks: readonly VacationTask[],
  people: readonly VacationPerson[],
  peopleById: ItemsById<VacationPerson>,
): TaskShare[] {
  const open = tasks.filter((task) => !task.done);
  const shares: TaskShare[] = people.map((person) => ({
    person,
    open: open.filter((task) => isTaskOf(task, person, peopleById)).length,
  }));
  shares.push({
    person: null,
    open: open.filter((task) => !assigneeOf(task, peopleById)).length,
  });
  return shares;
}

/** The tasks "Only my tasks" leaves: the open ones of the given person.
 * Done ones go too, so the filtered view is what is left to do. */
export function openTasksOf(
  tasks: readonly VacationTask[],
  person: VacationPerson | null,
  peopleById: ItemsById<VacationPerson>,
): VacationTask[] {
  return tasks.filter(
    (task) => !task.done && isTaskOf(task, person, peopleById),
  );
}

/**
 * What stands beside a phase's heading while "Only my tasks" is ticked. The
 * unfiltered texts would contradict the filtered list: "5 open" above two
 * rows.
 */
export function phaseSummaryOfMine(
  tasks: readonly VacationTask[],
  person: VacationPerson | null,
  peopleById: ItemsById<VacationPerson>,
): string {
  const mine = tasks.filter((task) => isTaskOf(task, person, peopleById));
  if (mine.length === 0) return "Nothing of yours here.";
  const open = openTaskCount(mine);
  return open === 0 ? "Yours are done" : `${open} of yours open`;
}

/** What the dashboard's tile adds for the signed-in member: how many of a
 * vacation's open tasks are theirs, and how many came back rejected and are
 * nobody's. */
export function myShareOf(
  tasks: readonly VacationTask[],
  me: VacationPerson | null,
  peopleById: ItemsById<VacationPerson>,
): { mine: number; rejected: number } {
  const open = tasks.filter((task) => !task.done);
  return {
    mine: open.filter((task) => isTaskOf(task, me, peopleById)).length,
    rejected: open.filter(
      (task) => task.rejected_by && !assigneeOf(task, peopleById),
    ).length,
  };
}

/** A member's name on a trip to start with: the part of the email address
 * before the "@". A member has no name in the app, and it can be changed on
 * the vacation. */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  return (local || email).slice(0, VACATION_PERSON_NAME_LIMIT);
}

/**
 * The people the form for a new vacation starts with: every member of the
 * household, then the people without an account of the vacation that was
 * created last, so a child's name is typed once. A member keeps the name
 * they had there.
 */
export function peopleToStartWith(
  members: readonly { user_id: string; email: string }[],
  lastPeople: readonly VacationPerson[],
): NewVacationPerson[] {
  const fromMembers = members.map((member) => ({
    name:
      lastPeople.find((person) => person.user_id === member.user_id)?.name ??
      nameFromEmail(member.email),
    user_id: member.user_id,
  }));
  const named = lastPeople
    .filter((person) => !person.user_id)
    .map((person) => ({ name: person.name, user_id: null }));
  return [...fromMembers, ...named];
}

/** The vacation that was created last among the live ones, whose people a
 * new one starts with. Not the one that starts last: with two trips planned
 * at once, the names typed last are the likelier ones to want again. */
export function lastCreatedVacationId(
  vacations: readonly {
    id: string;
    created_at: string;
    deleted_at: string | null;
  }[],
): string | null {
  const live = vacations.filter((vacation) => !vacation.deleted_at);
  if (live.length === 0) return null;
  return live.reduce((latest, vacation) =>
    vacation.created_at > latest.created_at ||
    (vacation.created_at === latest.created_at && vacation.id > latest.id)
      ? vacation
      : latest,
  ).id;
}
