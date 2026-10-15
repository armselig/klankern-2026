import type { VacationTileLines } from "~/types/dashboard";
import type { ItemsById } from "~/types/list";
import type { RowRealtimeEvent, SyncedRow } from "~/types/synced-row";
import type {
  NewVacationTask,
  Vacation,
  VacationDetails,
  VacationDetailsProblem,
  VacationGroups,
  VacationKind,
  VacationPhase,
  VacationTask,
} from "~/types/vacation";
import { upsertListItem } from "./list-state";
import {
  addDays,
  daysBetween,
  formatDay,
  isLocalDate,
  type LocalDate,
} from "./local-date";

// Vacations and their tasks follow the same rules as list items
// (client-generated ids, soft deletes, resync); the store uses the reducers
// in list-state.ts for those. Here is what differs: the rows hang on the
// household, a task belongs to a phase, and what a page shows depends on
// the day.
//
// Every function that depends on the day takes it as a parameter, so the
// tile, the list and the page can't disagree and the tests need no clock.

/** The kinds of stay, in the order the form for a new vacation offers them. */
export const VACATION_KINDS: readonly VacationKind[] = ["house", "hotel"];

/** The phases in the order a trip goes through them, which is also the
 * order of a vacation's page. */
export const VACATION_PHASES: readonly VacationPhase[] = [
  "before",
  "during",
  "after",
];

/** What a member reads for a kind of stay: in the trip's summary line and
 * where the kind is chosen. A kind decides nothing, so the words say only
 * where the household stays. */
export const VACATION_KIND_LABELS: Record<VacationKind, string> = {
  house: "House or apartment",
  hotel: "Hotel",
};

/** What a member reads for a phase. */
export const VACATION_PHASE_LABELS: Record<VacationPhase, string> = {
  before: "Before",
  during: "During",
  after: "Afterwards",
};

/** The largest title the two tables accept (see their check constraints in
 * migration 0015), so a field can stop at it instead of letting the save
 * fail. */
export const VACATION_TITLE_LIMIT = 200;

/** How long a trip that is over stays among the current ones while
 * "Afterwards" still has open tasks. A guess, to be checked on the first
 * trip. */
export const UNPACKING_DAYS = 14;

/** A row that hangs on a household, as both tables of the feature do. */
type HouseholdRow = SyncedRow & { household_id: string };

/**
 * Folds a Realtime change into local state, like applyListRealtimeEvent:
 * upserting by id makes the echo of our own write a no-op, and nothing may
 * undo a local soft delete. Guarded by the household, as the recipes'
 * reducer is, because these rows have no list to belong to. The event's row
 * replaces the local one: the rows are small, so no column is ever missing
 * from an UPDATE.
 */
export function applyVacationRowEvent<T extends HouseholdRow>(
  rowsById: ItemsById<T>,
  event: RowRealtimeEvent<T>,
  householdId: string | null,
): ItemsById<T> {
  const incoming = event.new;
  if (!householdId || incoming.household_id !== householdId) return rowsById;
  if (rowsById[incoming.id]?.deleted_at && !incoming.deleted_at)
    return rowsById;
  return upsertListItem(rowsById, incoming);
}

/** Lays an edit over a row at once, before the server has it. Nothing
 * changes for a row that isn't in state or is deleted. */
export function applyRowEdit<T extends SyncedRow>(
  rowsById: ItemsById<T>,
  id: string,
  // The row's type comes from the state alone; the changes are checked
  // against it and don't take part in working it out.
  changes: NoInfer<Partial<T>>,
): ItemsById<T> {
  const local = rowsById[id];
  if (!local || local.deleted_at) return rowsById;
  return upsertListItem(rowsById, { ...local, ...changes });
}

/**
 * Takes back an edit the server refused: the edited fields get the values
 * they had before, and everything else stays as it is now, so a change to
 * another field, or a removal, that arrived in the meantime is kept.
 */
export function revertRowEdit<T extends SyncedRow>(
  rowsById: ItemsById<T>,
  previous: T,
  changes: NoInfer<Partial<T>>,
): ItemsById<T> {
  const local = rowsById[previous.id];
  if (!local) return rowsById;
  const reverted = { ...local };
  for (const field of Object.keys(changes) as (keyof T)[]) {
    reverted[field] = previous[field];
  }
  return upsertListItem(rowsById, reverted);
}

/**
 * The fields of a vacation an edit changed, with the title trimmed. Only
 * these are sent, so two members who change different fields at the same
 * time don't overwrite each other.
 */
export function changedVacationDetails(
  previous: VacationDetails,
  edited: VacationDetails,
): Partial<VacationDetails> {
  const next: VacationDetails = { ...edited, title: edited.title.trim() };
  const changes: Partial<VacationDetails> = {};
  for (const field of ["title", "kind", "starts_on", "ends_on"] as const) {
    if (next[field] !== previous[field])
      Object.assign(changes, { [field]: next[field] });
  }
  return changes;
}

/** The live tasks of one vacation, in no particular order. */
export function tasksOfVacation(
  tasksById: ItemsById<VacationTask>,
  vacationId: string,
): VacationTask[] {
  return Object.values(tasksById).filter(
    (task) => task.vacation_id === vacationId && !task.deleted_at,
  );
}

/** The live vacations, the one added last first: what the form for a new
 * vacation offers to copy the tasks of. The order is the one of
 * lastCreatedVacationId, whose trip the form picks to start with. */
export function vacationsByCreation(
  vacationsById: ItemsById<Vacation>,
): Vacation[] {
  return Object.values(vacationsById)
    .filter((vacation) => !vacation.deleted_at)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
}

/**
 * The tasks a new vacation starts with when it copies an earlier one's: the
 * live ones, each in its phase and in the order it had there, but open and
 * nobody's. What was done, given or rejected last time says nothing about
 * this trip, and the people on it may be others. The positions are counted
 * anew from 1, so the edits of the earlier trip leave no fractions behind.
 */
export function tasksToCopy(tasks: readonly VacationTask[]): NewVacationTask[] {
  return VACATION_PHASES.flatMap((phase) =>
    tasks
      .filter((task) => task.phase === phase && !task.deleted_at)
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((task, index) => ({
        phase,
        title: task.title,
        position: index + 1,
      })),
  );
}

/**
 * A phase's tasks as its list shows them: the open ones in their order,
 * then the done ones in theirs, so a ticked task moves to the end. The id
 * breaks a tie between two tasks added at the same moment, to keep the
 * order the same on every member's screen.
 */
export function tasksInPhase(
  tasks: readonly VacationTask[],
  phase: VacationPhase,
): VacationTask[] {
  return tasks
    .filter((task) => task.phase === phase)
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    );
}

export function openTaskCount(tasks: readonly VacationTask[]): number {
  return tasks.filter((task) => !task.done).length;
}

/** What stands beside a phase's heading. A phase without tasks is not "All
 * done": nothing was done there. */
export function phaseSummary(tasks: readonly VacationTask[]): string {
  if (tasks.length === 0) return "Nothing here yet";
  const open = openTaskCount(tasks);
  return open === 0 ? "All done" : `${open} open`;
}

/** The phase a trip is in on a day: before until its first day, during
 * until its last day has passed, after from then on. */
export function stageOf(
  vacation: Pick<Vacation, "starts_on" | "ends_on">,
  today: LocalDate,
): VacationPhase {
  if (today < vacation.starts_on) return "before";
  return today <= vacation.ends_on ? "during" : "after";
}

/** Whether a day of the trip's end needs its year to be understood: only
 * when the trip ended in an earlier year than the one it is read in. */
function endedInAnEarlierYear(
  vacation: Pick<Vacation, "ends_on">,
  today: LocalDate,
): boolean {
  return vacation.ends_on.slice(0, 4) < today.slice(0, 4);
}

/** The line that tells where a trip stands today: "in 54 days", "day 3 of
 * 8" or "back since 12 Dec". */
export function stageLine(
  vacation: Pick<Vacation, "starts_on" | "ends_on">,
  today: LocalDate,
): string {
  const stage = stageOf(vacation, today);
  if (stage === "before") {
    const days = daysBetween(today, vacation.starts_on);
    return days === 1 ? "tomorrow" : `in ${days} days`;
  }
  if (stage === "during") {
    const day = daysBetween(vacation.starts_on, today) + 1;
    const length = daysBetween(vacation.starts_on, vacation.ends_on) + 1;
    return `day ${day} of ${length}`;
  }
  const since = formatDay(
    vacation.ends_on,
    endedInAnEarlierYear(vacation, today),
  );
  return `back since ${since}`;
}

/** A trip's dates for a member to read: "5 to 12 Dec", "28 Nov to 5 Dec",
 * or "5 Dec" for a single day. */
export function vacationDates(
  vacation: Pick<Vacation, "starts_on" | "ends_on">,
  today: LocalDate,
): string {
  const { starts_on: start, ends_on: end } = vacation;
  const until = formatDay(end, endedInAnEarlierYear(vacation, today));
  if (start === end) return until;
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth ? String(Number(start.slice(8))) : formatDay(start);
  return `${from} to ${until}`;
}

/**
 * The phases a vacation's page shows unfolded when it is opened. The page
 * follows the trip: today's phase is open unless everything in it is done,
 * an earlier phase stays open while it has open tasks, and a later one is
 * folded to its heading and count. A member can open or fold any of them;
 * that lasts for the visit and is not this function's business.
 */
export function phasesOpenAtFirst(
  vacation: Pick<Vacation, "starts_on" | "ends_on">,
  tasks: readonly VacationTask[],
  today: LocalDate,
): VacationPhase[] {
  const stageIndex = VACATION_PHASES.indexOf(stageOf(vacation, today));
  return VACATION_PHASES.filter((phase, index) => {
    if (index > stageIndex) return false;
    const inPhase = tasks.filter((task) => task.phase === phase);
    const open = openTaskCount(inPhase);
    // Today's phase is also open while it is empty: that is where the
    // field to add its first task is.
    return index === stageIndex ? open > 0 || inPhase.length === 0 : open > 0;
  });
}

/** Whether the page says "Ready to go": every task before the trip is done,
 * and the trip hasn't started. */
export function isReadyToGo(
  vacation: Pick<Vacation, "starts_on" | "ends_on">,
  tasks: readonly VacationTask[],
  today: LocalDate,
): boolean {
  const before = tasks.filter((task) => task.phase === "before");
  return (
    stageOf(vacation, today) === "before" &&
    before.length > 0 &&
    openTaskCount(before) === 0
  );
}

/**
 * Whether a vacation is still among the current ones: until its last day
 * has passed, and after that while "Afterwards" has an open task, for at
 * most UNPACKING_DAYS. A trip is not over for a household on the day its
 * unpacking falls due.
 */
export function isCurrentVacation(
  vacation: Pick<Vacation, "starts_on" | "ends_on">,
  tasks: readonly VacationTask[],
  today: LocalDate,
): boolean {
  if (today <= vacation.ends_on) return true;
  if (today > addDays(vacation.ends_on, UNPACKING_DAYS)) return false;
  return openTaskCount(tasks.filter((task) => task.phase === "after")) > 0;
}

/**
 * The household's live vacations as the list and the tile show them. The
 * current ones are ordered by their first day, so a trip the household is
 * back from but hasn't unpacked stands before the next one, and a running
 * trip before an upcoming one. The past ones start with the latest.
 */
export function groupVacations(
  vacationsById: ItemsById<Vacation>,
  tasksById: ItemsById<VacationTask>,
  today: LocalDate,
): VacationGroups {
  const groups: VacationGroups = { current: [], past: [] };
  for (const vacation of Object.values(vacationsById)) {
    if (vacation.deleted_at) continue;
    const tasks = tasksOfVacation(tasksById, vacation.id);
    const group = isCurrentVacation(vacation, tasks, today)
      ? groups.current
      : groups.past;
    group.push(vacation);
  }
  groups.current.sort(
    (a, b) =>
      a.starts_on.localeCompare(b.starts_on) ||
      a.ends_on.localeCompare(b.ends_on) ||
      a.id.localeCompare(b.id),
  );
  groups.past.sort(
    (a, b) => b.ends_on.localeCompare(a.ends_on) || a.id.localeCompare(b.id),
  );
  return groups;
}

/** A number of open tasks in words, for where nothing around the number
 * says what it counts. */
export function openTasksLine(open: number): string {
  if (open === 0) return "No tasks open";
  return open === 1 ? "1 task open" : `${open} tasks open`;
}

/**
 * What the dashboard's tile says: the first of the current vacations, where
 * it stands today, its open tasks, and how many more are current. Null when
 * none is: the tile then says so itself.
 */
export function vacationTilePreview(
  vacationsById: ItemsById<Vacation>,
  tasksById: ItemsById<VacationTask>,
  today: LocalDate,
  /** What the tile adds for the signed-in member, of the vacation with
   * this id: how many open tasks are theirs and how many came back
   * rejected (see myShareOf). The tile stands in for notifications. */
  shareOf?: (vacationId: string) => { mine: number; rejected: number },
): VacationTileLines | null {
  const { current } = groupVacations(vacationsById, tasksById, today);
  const first = current[0];
  if (!first) return null;
  const share = shareOf?.(first.id);
  const parts = [
    share?.mine ? `${share.mine} yours` : "",
    share?.rejected ? `${share.rejected} came back` : "",
  ].filter(Boolean);
  const more = current.length - 1;
  return {
    id: first.id,
    title: first.title,
    when: stageLine(first, today),
    tasks: openTasksLine(openTaskCount(tasksOfVacation(tasksById, first.id))),
    share: parts.length > 0 ? parts.join(" · ") : null,
    more:
      more === 0
        ? null
        : `and ${more} more ${more === 1 ? "vacation" : "vacations"}`,
  };
}

/** What is wrong with a vacation's details as a form holds them, or null.
 * The fields are required in the form already; this catches what `required`
 * lets through: a title of spaces, a typed day that is no calendar day, and
 * an end before the start. */
export function vacationDetailsProblem(
  details: VacationDetails,
): VacationDetailsProblem | null {
  if (details.title.trim() === "") return "title";
  if (!details.starts_on || !details.ends_on) return "dates";
  if (!isLocalDate(details.starts_on) || !isLocalDate(details.ends_on))
    return "day";
  return details.ends_on < details.starts_on ? "dates" : null;
}

/** The texts of the problems, the same in the form for a new vacation and
 * in the edit of an existing one. */
export const VACATION_DETAILS_MESSAGES = {
  title: "Give the vacation a title.",
  day: "Give each day as year, month and day: YYYY-MM-DD.",
  dates: "The trip can't end before it starts.",
} as const;

/** The label of a phase's field for a new task. */
export const VACATION_ADD_TASK_LABELS: Record<VacationPhase, string> = {
  before: "Add a task before the trip",
  during: "Add a task for the trip",
  after: "Add a task for afterwards",
};
