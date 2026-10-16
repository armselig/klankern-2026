import type { HouseholdChild } from "~/types/kids";
import type { ItemsById } from "~/types/list";
import type {
  NewVacationPerson,
  TaskFilter,
  TaskShare,
  VacationPerson,
  VacationPhase,
  VacationTask,
} from "~/types/vacation";
import { VACATION_ADD_TASK_LABELS, openTaskCount } from "./vacation-state";

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
 * "Who has what": the open tasks of every person on the trip, the one with
 * the most first, and those that are nobody's as the last line, where they
 * wait to be given. Equal counts keep the people's order, so the lines are
 * the same on every member's screen. A person without an open task is
 * listed with 0, so it shows who carries nothing.
 */
export function taskShares(
  tasks: readonly VacationTask[],
  people: readonly VacationPerson[],
  peopleById: ItemsById<VacationPerson>,
): TaskShare[] {
  const open = tasks.filter((task) => !task.done);
  const shares: TaskShare[] = people
    .map((person) => ({
      person,
      open: open.filter((task) => isTaskOf(task, person, peopleById)).length,
    }))
    // Stable: equal counts stay in the people's order.
    .sort((a, b) => b.open - a.open);
  shares.push({
    person: null,
    open: open.filter((task) => !assigneeOf(task, peopleById)).length,
  });
  return shares;
}

/**
 * What "Who has what" shows: a sentence when the trip has no people or no
 * open task, and otherwise its lines. One function for the component and
 * the page: a line that isn't shown can't be pressed again, so the page
 * may only filter by one while the lines are there.
 */
export function shareView(
  shares: readonly TaskShare[],
): "no-people" | "nothing-open" | "lines" {
  if (!shares.some((share) => share.person)) return "no-people";
  return shares.some((share) => share.open > 0) ? "lines" : "nothing-open";
}

/** The tasks a pressed line of "Who has what" leaves: the open ones of
 * that person, or the open ones nobody has. Done ones go too, so the
 * filtered view is what is left to do. */
export function openTasksIn(
  tasks: readonly VacationTask[],
  filter: TaskFilter,
  peopleById: ItemsById<VacationPerson>,
): VacationTask[] {
  return tasks.filter(
    (task) =>
      !task.done && assigneeOf(task, peopleById)?.id === filter.person?.id,
  );
}

/**
 * What stands beside a phase's heading while the tasks are filtered. The
 * unfiltered texts would contradict the filtered list: "5 open" above two
 * rows. The signed-in member is spoken to; another person is named.
 */
export function phaseSummaryIn(
  tasks: readonly VacationTask[],
  filter: TaskFilter,
  me: VacationPerson | null,
  peopleById: ItemsById<VacationPerson>,
): string {
  const { person } = filter;
  if (!person) {
    const open = openTasksIn(tasks, filter, peopleById).length;
    return open === 0
      ? "Nothing without a person here."
      : `${open} without a person`;
  }
  const mine = person.id === me?.id;
  const theirs = tasks.filter((task) => isTaskOf(task, person, peopleById));
  if (theirs.length === 0)
    return mine ? "Nothing of yours here." : `Nothing for ${person.name} here.`;
  const open = openTaskCount(theirs);
  if (open === 0) return mine ? "Yours are done" : `Done for ${person.name}`;
  return mine ? `${open} of yours open` : `${open} open for ${person.name}`;
}

/** The line under "Who has what" while the tasks are filtered: what is
 * shown, and how to get back to all of them. */
export function taskFilterHint(
  filter: TaskFilter,
  me: VacationPerson | null,
): string {
  const { person } = filter;
  if (!person)
    return "Only the open tasks nobody has. Press “Nobody yet” again to see all.";
  const whose = person.id === me?.id ? "your" : `${person.name}'s`;
  return `Only ${whose} open tasks. Press the name again to see all.`;
}

/** The label of a phase's field for a new task. While one person's tasks
 * are listed it names them, since the task becomes theirs; under "Nobody
 * yet" and without a filter the task is nobody's, as the plain label says. */
export function addTaskLabel(
  phase: VacationPhase,
  filter: TaskFilter | null,
  me: VacationPerson | null,
): string {
  const label = VACATION_ADD_TASK_LABELS[phase];
  const person = filter?.person;
  if (!person) return label;
  return `${label}, for ${person.id === me?.id ? "you" : person.name}`;
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

/** A name as two people's names are compared: without case and the spaces
 * around it, as migration 0022 linked the typed names to the children. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * The people the form for a new vacation starts with: every member of the
 * household, every child of it, then the people typed as names on the
 * vacation that was created last, so a guest's name is typed once. A member
 * keeps the name they had there. A typed name that is a child's is left
 * out: the child is in the list already.
 */
export function peopleToStartWith(
  members: readonly { user_id: string; email: string }[],
  children: readonly Pick<HouseholdChild, "id" | "name">[],
  lastPeople: readonly VacationPerson[],
): NewVacationPerson[] {
  const fromMembers = members.map((member) => ({
    name:
      lastPeople.find((person) => person.user_id === member.user_id)?.name ??
      nameFromEmail(member.email),
    user_id: member.user_id,
    child_id: null,
  }));
  const fromChildren = children.map((child) => ({
    name: child.name,
    user_id: null,
    child_id: child.id,
  }));
  const named = lastPeople
    .filter(
      (person) =>
        !person.user_id &&
        !person.child_id &&
        !children.some((child) => sameName(child.name, person.name)),
    )
    .map((person) => ({ name: person.name, user_id: null, child_id: null }));
  return [...fromMembers, ...fromChildren, ...named];
}

/**
 * The members and children of the household who are not on a trip, as
 * "Who is coming" offers them to be added. A member gets the name of their
 * address (see nameFromEmail), a child their own.
 */
export function peopleNotComing(
  members: readonly { user_id: string; email: string }[],
  children: readonly Pick<HouseholdChild, "id" | "name">[],
  people: readonly VacationPerson[],
): NewVacationPerson[] {
  const absentMembers = members
    .filter((member) => !people.some((p) => p.user_id === member.user_id))
    .map((member) => ({
      name: nameFromEmail(member.email),
      user_id: member.user_id,
      child_id: null,
    }));
  const absentChildren = children
    .filter((child) => !people.some((p) => p.child_id === child.id))
    .map((child) => ({ name: child.name, user_id: null, child_id: child.id }));
  return [...absentMembers, ...absentChildren];
}

/**
 * The people of the household's trips, each child named as the household's
 * list of children names them now: a person's own name is the one the child
 * had when added (see migration 0022), and a child renamed on the kids'
 * page is renamed on every trip. A child whose row is not loaded keeps the
 * name on the trip. Unchanged rows stay the same objects.
 */
export function withChildNames(
  peopleById: ItemsById<VacationPerson>,
  childrenById: ItemsById<HouseholdChild>,
): ItemsById<VacationPerson> {
  const named: ItemsById<VacationPerson> = {};
  for (const [id, person] of Object.entries(peopleById)) {
    const child = person.child_id ? childrenById[person.child_id] : undefined;
    named[id] =
      child && child.name !== person.name
        ? { ...person, name: child.name }
        : person;
  }
  return named;
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
