import { defineStore } from "pinia";
import type { ItemsById } from "~/types/list";
import type {
  NewVacation,
  Vacation,
  VacationDetails,
  VacationPhase,
  VacationRealtimeEvent,
  VacationTask,
  VacationTaskRealtimeEvent,
} from "~/types/vacation";
import {
  createVacation,
  fetchVacations,
  fetchVacationTasks,
  insertVacationTask,
  renameVacationTaskRemote,
  setVacationTaskDone,
  softDeleteVacationRemote,
  softDeleteVacationTaskRemote,
  updateVacationRemote,
} from "~/composables/vacation-actions";
import { errorMessage } from "~/utils/error-message";
import { createChangesDuringFetch } from "~/utils/changes-during-fetch";
import { createInsertsInFlight } from "~/utils/inserts-in-flight";
import { nextPosition } from "~/utils/position";
import { createRealtimeEventOrder } from "~/utils/realtime-event-order";
import {
  confirmListItem,
  mergeListResync,
  softDeleteListItem,
  upsertListItem,
} from "~/utils/list-state";
import type { LocalDate } from "~/utils/local-date";
import {
  applyRowEdit,
  applyVacationRowEvent,
  changedVacationDetails,
  groupVacations,
  revertRowEdit,
  tasksInPhase,
  tasksOfVacation,
} from "~/utils/vacation-state";
import { templateTasks } from "~/utils/vacation-templates";

// One store for the vacations and their tasks, and one of each piece of
// bookkeeping for both: they are keyed by a row's id, and ids are UUIDs, so
// a vacation and a task can't be mistaken for each other.

/** Task adds still being saved; see createInsertsInFlight. A vacation has
 * none: it is put into state only once it is saved (see add). */
const insertsInFlight = createInsertsInFlight();

/** Rows changed while a resync fetch is in flight; see createChangesDuringFetch. */
const changesDuringFetch = createChangesDuringFetch();

/** Drops Realtime events delivered out of commit order; see createRealtimeEventOrder. */
const realtimeEventOrder = createRealtimeEventOrder();

export const useVacationStore = defineStore("vacations", {
  state: () => ({
    /** The household whose vacations are in state; null until load() has
     * fetched them. The rows hang on the household directly, so Realtime
     * events and resync wait for it, as in the recipe store. */
    householdId: null as string | null,
    vacationsById: {} as ItemsById<Vacation>,
    /** The tasks of all vacations, since the dashboard's tile and the list
     * count them for each. */
    tasksById: {} as ItemsById<VacationTask>,
    /** Ids with a write still in flight; a resync must not overwrite them
     * with a fetch that may predate the write. */
    pendingIds: [] as string[],
    loading: false,
    error: null as string | null,
  }),
  getters: {
    /** The vacation with this id, unless it is removed or unknown: what its
     * page shows, or reports as not found. */
    find: (state) => (id: string) => {
      const vacation = state.vacationsById[id];
      return vacation && !vacation.deleted_at ? vacation : null;
    },
    /** A vacation's live tasks, in no particular order. */
    tasksOf: (state) => (vacationId: string) =>
      tasksOfVacation(state.tasksById, vacationId),
    /** The live vacations as the list and the tile show them on a day. */
    groups: (state) => (today: LocalDate) =>
      groupVacations(state.vacationsById, state.tasksById, today),
  },
  actions: {
    /**
     * Makes the household's vacations and their tasks available. The
     * dashboard and every vacation page call this, so only the first call
     * fetches everything behind a spinner. Later ones repair state in the
     * background (see resync): replacing it would drop a write that is
     * still on its way.
     *
     * Both tables are fetched before either is put into state, so a failure
     * of one leaves the state as it was instead of vacations without tasks.
     */
    async load(householdId: string) {
      if (this.householdId === householdId) return this.resync();
      this.loading = true;
      this.error = null;
      try {
        const client = useSupabaseClient();
        const [vacations, tasks] = await Promise.all([
          fetchVacations(client, householdId),
          fetchVacationTasks(client, householdId),
        ]);
        // A reset in the meantime (the user changed) ended this load; the
        // rows fetched are the previous user's.
        if (!this.loading) return;
        this.vacationsById = Object.fromEntries(
          vacations.map((vacation) => [vacation.id, vacation]),
        );
        this.tasksById = Object.fromEntries(
          tasks.map((task) => [task.id, task]),
        );
        this.householdId = householdId;
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        this.loading = false;
      }
    },

    /** Folds a vacation change from the household's Realtime channel into state. */
    applyVacationEvent(event: VacationRealtimeEvent) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp))
        return;
      changesDuringFetch.record(event.new.id);
      this.vacationsById = applyVacationRowEvent(
        this.vacationsById,
        event,
        this.householdId,
      );
    },

    /** Folds a task change from the household's Realtime channel into state. */
    applyTaskEvent(event: VacationTaskRealtimeEvent) {
      if (!realtimeEventOrder.accept(event.new.id, event.commitTimestamp))
        return;
      changesDuringFetch.record(event.new.id);
      this.tasksById = applyVacationRowEvent(
        this.tasksById,
        event,
        this.householdId,
      );
    },

    /** Repairs state after a (re)connect, since Realtime doesn't replay missed
     * events. Skipped until load() has fetched the rows (the channel can
     * connect first). As in load(), a failure of one fetch changes nothing. */
    async resync() {
      const householdId = this.householdId;
      if (!householdId) return;
      const changes = changesDuringFetch.start();
      try {
        const client = useSupabaseClient();
        const [vacations, tasks] = await Promise.all([
          fetchVacations(client, householdId),
          fetchVacationTasks(client, householdId),
        ]);
        if (householdId !== this.householdId) return;
        const keepLocalIds = [...this.pendingIds, ...changes.stop()];
        this.vacationsById = mergeListResync(
          this.vacationsById,
          vacations,
          keepLocalIds,
        );
        this.tasksById = mergeListResync(this.tasksById, tasks, keepLocalIds);
      } catch (e) {
        this.error = errorMessage(e);
      } finally {
        changes.stop();
      }
    },

    /** Runs a server write while its row id counts as pending (see
     * pendingIds). Its end counts as a change: a write that finishes while a
     * resync fetch is in flight is no longer pending when the fetch returns,
     * yet the fetch may predate it. */
    async withPending(id: string, write: () => Promise<void>) {
      this.pendingIds = [...this.pendingIds, id];
      try {
        await write();
      } finally {
        changesDuringFetch.record(id);
        // Only this write's entry: an add and a tick of the same task can
        // be pending at the same time.
        const index = this.pendingIds.indexOf(id);
        this.pendingIds = this.pendingIds.filter((_, i) => i !== index);
      }
    },

    /**
     * Adds a vacation, filled with the tasks of its kind's template. Not
     * optimistic, unlike an added task: the form waits for the result, so
     * that a failed save leaves the member on the form with what they typed,
     * and no member sees a vacation that then fails to save. The ids are
     * still generated here, so the Realtime echoes of the inserts upsert
     * instead of duplicating.
     *
     * @returns the new vacation's id, or null when saving failed (see `error`)
     */
    async add(vacation: NewVacation): Promise<string | null> {
      const householdId = this.householdId;
      if (!householdId) throw new Error("not_initialized");
      this.error = null;
      const id = crypto.randomUUID();
      const tasks = templateTasks(vacation.kind).map((task) => ({
        ...task,
        id: crypto.randomUUID(),
      }));
      let saved = false;
      await this.withPending(id, async () => {
        try {
          const created = await createVacation(
            useSupabaseClient(),
            { ...vacation, title: vacation.title.trim(), id, householdId },
            tasks,
          );
          saved = true;
          // Not after a reset.
          if (householdId !== this.householdId) return;
          // Not over an echo: a row that got here first is the same row or
          // a newer one.
          if (!this.vacationsById[id]) {
            this.vacationsById = upsertListItem(
              this.vacationsById,
              created.vacation,
            );
          }
          const tasksById = { ...this.tasksById };
          for (const task of created.tasks) {
            // A resync fetch in flight may predate these rows.
            changesDuringFetch.record(task.id);
            tasksById[task.id] ??= task;
          }
          this.tasksById = tasksById;
        } catch (e) {
          this.error = errorMessage(e);
        }
      });
      return saved ? id : null;
    },

    /**
     * Saves an edit of a vacation's title or dates: optimistic, and taken
     * back if the server refuses it. Only the fields that differ are sent
     * (see changedVacationDetails).
     *
     * @returns whether the edit is saved; false also leaves `error` set
     */
    async update(id: string, details: VacationDetails) {
      const previous = this.find(id);
      if (!previous) return false;
      const changes = changedVacationDetails(previous, details);
      if (Object.keys(changes).length === 0) return true;
      this.error = null;
      this.vacationsById = applyRowEdit(this.vacationsById, id, changes);
      let saved = false;
      await this.withPending(id, async () => {
        try {
          await updateVacationRemote(useSupabaseClient(), id, changes);
          saved = true;
        } catch (e) {
          this.vacationsById = revertRowEdit(
            this.vacationsById,
            previous,
            changes,
          );
          this.error = errorMessage(e);
        }
      });
      return saved;
    },

    /** Optimistic soft delete of a vacation, taken back if the server
     * refuses it. Its tasks stay in state and leave the view with it. */
    async remove(id: string) {
      if (!this.find(id)) return;
      this.error = null;
      this.vacationsById = softDeleteListItem(this.vacationsById, id);
      await this.withPending(id, async () => {
        try {
          await softDeleteVacationRemote(useSupabaseClient(), id);
        } catch (e) {
          const local = this.vacationsById[id];
          // Not after a reset: the vacation is the previous user's.
          if (local) {
            this.vacationsById = upsertListItem(this.vacationsById, {
              ...local,
              deleted_at: null,
            });
          }
          this.error = errorMessage(e);
        }
      });
    },

    /**
     * Optimistic add of a task at the end of its phase: the row appears at
     * once under a client-generated id and is reconciled (not duplicated)
     * once the server confirms it, keeping a tick or a removal made in the
     * meantime. A refused task is taken out again.
     *
     * @returns the reason the task could not be saved, or null when it is.
     *   It is returned, not put into `error`, because it belongs under the
     *   field the task was typed into.
     */
    async addTask(
      vacationId: string,
      phase: VacationPhase,
      title: string,
    ): Promise<string | null> {
      const householdId = this.householdId;
      if (!householdId || !this.find(vacationId))
        throw new Error("not_initialized");
      const userId = useSupabaseUser().value?.sub;
      if (!userId) throw new Error("not_authenticated");
      const id = crypto.randomUUID();
      const optimistic: VacationTask = {
        id,
        vacation_id: vacationId,
        household_id: householdId,
        phase,
        title,
        done: false,
        position: nextPosition(tasksInPhase(this.tasksOf(vacationId), phase)),
        created_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      this.tasksById = upsertListItem(this.tasksById, optimistic);

      let failure: string | null = null;
      await this.withPending(id, async () => {
        try {
          const confirmed = await insertsInFlight.track(
            id,
            insertVacationTask(useSupabaseClient(), {
              id,
              vacationId,
              householdId,
              phase,
              title,
              position: optimistic.position,
            }),
          );
          this.tasksById = confirmListItem(
            this.tasksById,
            optimistic,
            confirmed,
          );
        } catch (e) {
          const { [id]: _removed, ...rest } = this.tasksById;
          this.tasksById = rest;
          failure = errorMessage(e);
        }
      });
      return failure;
    },

    /** Optimistic tick or untick; the server update waits for the task's add
     * to be saved. */
    async toggleTask(id: string) {
      const task = this.tasksById[id];
      if (!task) return;
      this.error = null;
      const done = !task.done;
      this.tasksById = upsertListItem(this.tasksById, { ...task, done });
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        // The add failed and took the task with it: nothing left to update.
        if (!this.tasksById[id]) return;
        try {
          await setVacationTaskDone(useSupabaseClient(), id, done);
        } catch (e) {
          this.tasksById = revertRowEdit(this.tasksById, task, { done });
          this.error = errorMessage(e);
        }
      });
    },

    /**
     * Optimistic change of a task's title, taken back if the server refuses
     * it; like toggleTask, it waits for the task's add to be saved.
     *
     * @returns whether the title is saved; false also leaves `error` set
     */
    async renameTask(id: string, title: string) {
      const task = this.tasksById[id];
      if (!task || task.deleted_at) return false;
      if (title === task.title) return true;
      this.error = null;
      this.tasksById = applyRowEdit(this.tasksById, id, { title });
      let saved = false;
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        if (!this.tasksById[id]) return;
        try {
          await renameVacationTaskRemote(useSupabaseClient(), id, title);
          saved = true;
        } catch (e) {
          this.tasksById = revertRowEdit(this.tasksById, task, { title });
          this.error = errorMessage(e);
        }
      });
      return saved;
    },

    /** Optimistic soft delete of a task; like toggleTask, it waits for the
     * task's add to be saved. */
    async removeTask(id: string) {
      const previous = this.tasksById[id];
      if (!previous) return;
      this.error = null;
      this.tasksById = softDeleteListItem(this.tasksById, id);
      await this.withPending(id, async () => {
        await insertsInFlight.settled(id);
        if (!this.tasksById[id]) return;
        try {
          await softDeleteVacationTaskRemote(useSupabaseClient(), id);
        } catch (e) {
          this.tasksById = upsertListItem(this.tasksById, previous);
          this.error = errorMessage(e);
        }
      });
    },
  },
});
