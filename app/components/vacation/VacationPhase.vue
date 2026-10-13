<script setup lang="ts">
import {
  mdiChevronDown,
  mdiChevronRight,
  mdiPlus,
} from "@quasar/extras/mdi-v7";
import type { VacationPhase, VacationTask } from "~/types/vacation";

const props = defineProps<{
  phase: VacationPhase;
  /** The phase's tasks in the order they are shown (see tasksInPhase). */
  tasks: VacationTask[];
  /** Why the task typed last could not be saved, to stand under the field. */
  addError: string | null;
}>();
const emit = defineEmits<{
  add: [phase: VacationPhase, title: string];
  toggle: [id: string];
  rename: [id: string, title: string];
  remove: [id: string];
}>();
/** Whether the phase is unfolded. The page decides how it starts (it
 * follows the trip); a press here changes it for the visit. */
const open = defineModel<boolean>("open", { required: true });

const bodyId = useId();
const newTitle = ref("");
const addInput = useTemplateRef<{ focus: () => void }>("addInput");

interface TaskRow {
  focusTickBox: () => void;
}
/** The rows by task id, to put the focus on one after the list changed. */
const rows = new Map<string, TaskRow>();

function rememberRow(id: string, row: unknown) {
  if (row) rows.set(id, row as TaskRow);
  else rows.delete(id);
}

/** Adds the typed task. The field keeps the focus, so several tasks can be
 * entered in a row. */
function add() {
  const title = newTitle.value.trim();
  if (!title) return;
  newTitle.value = "";
  addInput.value?.focus();
  emit("add", props.phase, title);
}

/** Ticks a task and keeps the focus on its tick box. The row moves to the
 * end of the open or of the done tasks, and a browser drops the focus of an
 * element that is moved, so it is set again once the list is redrawn. */
async function toggle(id: string) {
  emit("toggle", id);
  await nextTick();
  rows.get(id)?.focusTickBox();
}

/** Removes a task and moves the focus on: its row had the focus and is
 * gone. To the row that follows, or to the field for a new task after the
 * last row. */
async function remove(id: string) {
  const index = props.tasks.findIndex((task) => task.id === id);
  const next = props.tasks[index + 1];
  emit("remove", id);
  await nextTick();
  if (next) rows.get(next.id)?.focusTickBox();
  else addInput.value?.focus();
}
</script>

<template>
  <section class="vacation-phase">
    <!-- A heading whose button says whether the phase is open, with the
         count beside it rather than in the button's name. -->
    <h3 class="vacation-phase__heading">
      <q-btn
        flat
        no-caps
        :icon="open ? mdiChevronDown : mdiChevronRight"
        :label="VACATION_PHASE_LABELS[phase]"
        :aria-expanded="open"
        :aria-controls="bodyId"
        class="touch-target vacation-phase__fold"
        @click="open = !open"
      />
      <span class="vacation-phase__summary text-muted">{{
        phaseSummary(tasks)
      }}</span>
    </h3>

    <div v-if="open" :id="bodyId">
      <q-list v-if="tasks.length > 0" bordered separator>
        <vacation-task
          v-for="task in tasks"
          :key="task.id"
          :ref="(row) => rememberRow(task.id, row)"
          :task="task"
          @toggle="toggle"
          @rename="(id, title) => emit('rename', id, title)"
          @remove="remove"
        />
      </q-list>

      <q-form class="vacation-phase__add" @submit.prevent="add">
        <q-input
          ref="addInput"
          v-model="newTitle"
          :label="VACATION_ADD_TASK_LABELS[phase]"
          :maxlength="VACATION_TITLE_LIMIT"
          class="col"
        />
        <q-btn
          type="submit"
          color="primary"
          :icon="mdiPlus"
          label="Add"
          unelevated
          class="touch-target"
        />
      </q-form>
      <p v-if="addError" role="alert" class="text-negative q-mt-sm q-mb-none">
        {{ addError }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/* Quasar styles a bare h3 as a 3rem display line. */
.vacation-phase__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 16px 0 4px;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

/* The button starts where the page's text does: its own padding is what
   stands out to the left. */
.vacation-phase__fold {
  margin-left: -8px;
  padding: 4px 8px;
  font-size: 1rem;
}

.vacation-phase__summary {
  font-size: 0.875rem;
  font-weight: 400;
}

.vacation-phase__add {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
