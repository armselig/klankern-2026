import type { Database } from "./database.types";
import type { RowRealtimeEvent } from "./synced-row";

/** The kind of stay. It decides which template fills a new vacation, and a
 * house gets a meal plan. The column is text with a check constraint, so the
 * generated type only says `string`. */
export type VacationKind = "house" | "hotel";

/** When a task is due: a task has a phase, not a date. */
export type VacationPhase = "before" | "during" | "after";

/** A task as a template holds it, before a vacation gives it an id. */
export interface VacationTemplateTask {
  phase: VacationPhase;
  title: string;
  /** Its place within its phase, counted from 1. */
  position: number;
}

type VacationRow = Database["public"]["Tables"]["vacations"]["Row"];
type VacationTaskRow = Database["public"]["Tables"]["vacation_tasks"]["Row"];

/** A vacation row. `starts_on` and `ends_on` are calendar days as
 * "YYYY-MM-DD" (see utils/local-date.ts). */
export type Vacation = Omit<VacationRow, "kind"> & { kind: VacationKind };

/** A task of a vacation. */
export type VacationTask = Omit<VacationTaskRow, "phase"> & {
  phase: VacationPhase;
};

/** What a member can change about a vacation after it is added. Its kind is
 * not among it: the old kind's tasks would stay, and none would be added. */
export interface VacationDetails {
  title: string;
  starts_on: string;
  ends_on: string;
}

/** What the form for a new vacation collects. */
export interface NewVacation extends VacationDetails {
  kind: VacationKind;
}

/** Both rows are small, so an UPDATE event carries the whole row (see the
 * byte budget in migration 0015). */
export type VacationRealtimeEvent = RowRealtimeEvent<Vacation>;
export type VacationTaskRealtimeEvent = RowRealtimeEvent<VacationTask>;

/** The vacations a list or a tile shows, split as the household sees them. */
export interface VacationGroups {
  /** Upcoming, running, and over but not unpacked yet; the one that starts
   * first comes first. */
  current: Vacation[];
  /** The rest, the latest first. */
  past: Vacation[];
}

type VacationPersonRow = Database["public"]["Tables"]["vacation_people"]["Row"];

/** A person on a trip: a member of the household (`user_id`) or just a
 * name, such as a small child or a guest. A person taken off the trip stays
 * as a row with `deleted_at`, so a rejection keeps its name. */
export type VacationPerson = VacationPersonRow;

export type VacationPersonRealtimeEvent = RowRealtimeEvent<VacationPerson>;

/** A person as the form for a new vacation collects one, before the trip
 * gives them an id. A type alias: it is sent as JSON (see TaskToCreate). */
export type NewVacationPerson = {
  name: string;
  /** The member's account, or null for a person without one. */
  user_id: string | null;
};

/** One line of "Who has what": a person and their open tasks, or the tasks
 * that are nobody's (`person` is null). */
export interface TaskShare {
  person: VacationPerson | null;
  open: number;
}

/** What a task's row shows beyond the task itself, worked out by the page:
 * the row only renders. */
export interface TaskRowState {
  /** Who has the task, if that person is still on the trip. */
  assignee: VacationPerson | null;
  /** Who said no, for a task that is nobody's since. */
  rejecter: VacationPerson | null;
  /** The task is the signed-in member's. */
  mine: boolean;
  /** The line that offers "Tell them" after the member gave or rejected
   * the task ("Given to sam."), or null. */
  tellLine: string | null;
  /** Whether a message about the task has someone to go to: its assignee
   * with an account, or everyone after a rejection. */
  canTell: boolean;
  /** The row a link led to, marked for a moment. */
  marked: boolean;
}
