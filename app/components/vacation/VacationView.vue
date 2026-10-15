<script setup lang="ts">
import { mdiArrowLeft } from "@quasar/extras/mdi-v7";
import { Dialog, Notify } from "quasar";
import type {
  NewVacationPerson,
  TaskFilter,
  TaskRowState,
  VacationDetails,
  VacationPhase,
  VacationTask,
} from "~/types/vacation";

const props = defineProps<{ householdId: string; vacationId: string }>();
const vacationStore = useVacationStore();
const mealPlanStore = useMealPlanStore();
const householdStore = useHouseholdStore();
const user = useSupabaseUser();
const router = useRouter();

onMounted(() => {
  void vacationStore.load(props.householdId);
  // For the avatars and for the members who can be added to the trip; the
  // dashboard has usually fetched them already.
  if (householdStore.members.length === 0) void householdStore.fetchMembers();
});

/** The day the page was opened on. It is not worked out again at midnight:
 * a page left open overnight shows yesterday's stage until it is opened
 * anew. */
const today = localDateOf(new Date());

const vacation = computed(() => vacationStore.find(props.vacationId));
const tasks = computed(() => vacationStore.tasksOf(props.vacationId));
const people = computed(() => vacationStore.peopleOf(props.vacationId));
/** The person the signed-in member is on this trip, or null. */
const me = computed(() => personOfUser(people.value, user.value?.sub));
const emails = computed(() =>
  Object.fromEntries(
    householdStore.members.map((member) => [member.user_id, member.email]),
  ),
);
const readyToGo = computed(
  () => !!vacation.value && isReadyToGo(vacation.value, tasks.value, today),
);
/** The trip's days in the meal plan, fetched once the trip is known, for
 * the link to its meals. */
const tripRange = computed(() =>
  vacation.value
    ? { from: vacation.value.starts_on, to: vacation.value.ends_on }
    : null,
);
watch(
  tripRange,
  (range) => {
    if (range) void mealPlanStore.load(props.householdId, range);
  },
  { immediate: true },
);
/** What the link to the meals says: how many dinners the plan holds for
 * the trip's days; nothing until those days are loaded. */
const mealsLine = computed(() => {
  const range = tripRange.value;
  if (!range || !mealPlanStore.isLoaded(range)) return "";
  return dinnersPlannedLine(
    mealPlanStore.visible.filter(
      (entry) =>
        entry.slot === "dinner" &&
        range.from <= entry.date &&
        entry.date <= range.to,
    ).length,
  );
});
const shares = computed(() =>
  taskShares(tasks.value, people.value, vacationStore.peopleById),
);

/** The line of "Who has what" that was pressed. It lasts for the visit and
 * is stored nowhere. */
const chosenFilter = ref<TaskFilter | null>(null);

/** Whose open tasks each phase lists alone, or null for all tasks. Worked
 * out from the people of the trip, so a person who is renamed is named
 * anew, and one who is taken off takes the filter along. And only while
 * "Who has what" shows its lines: once the last open task is ticked it
 * says "Nothing open.", and a filter left on would hide every task, the
 * done ones too, with nothing to press to get them back. */
const taskFilter = computed<TaskFilter | null>(() => {
  if (shareView(shares.value) !== "lines") return null;
  const chosen = chosenFilter.value?.person;
  if (!chosenFilter.value || !chosen) return chosenFilter.value;
  const person = people.value.find((other) => other.id === chosen.id);
  return person ? { person } : null;
});

const filterHint = computed(() =>
  taskFilter.value ? taskFilterHint(taskFilter.value, me.value) : null,
);

/** What each phase shows: its tasks, or the open ones of the pressed line,
 * and the text beside its heading to match. */
const phases = computed(() =>
  VACATION_PHASES.map((phase) => {
    const all = tasksInPhase(tasks.value, phase);
    const filter = taskFilter.value;
    return {
      phase,
      tasks: filter ? openTasksIn(all, filter, vacationStore.peopleById) : all,
      summary: filter
        ? phaseSummaryIn(all, filter, me.value, vacationStore.peopleById)
        : phaseSummary(all),
    };
  }),
);

const rowStates = computed<Record<string, TaskRowState>>(() =>
  Object.fromEntries(
    tasks.value.map((task) => [
      task.id,
      {
        assignee: assigneeOf(task, vacationStore.peopleById),
        rejecter: rejecterOf(task, vacationStore.peopleById),
        mine: isTaskOf(task, me.value, vacationStore.peopleById),
      },
    ]),
  ),
);

/** The phases that are unfolded. Null until the vacation is loaded; then
 * the page follows the trip (see phasesOpenAtFirst), once. After that a
 * phase is open or folded as the member left it, for the visit: one that
 * closed by itself when its last task is ticked would take the row away
 * from under the finger. */
const openPhases = ref<VacationPhase[] | null>(null);

function setPhaseOpen(phase: VacationPhase, open: boolean) {
  const others = (openPhases.value ?? []).filter((other) => other !== phase);
  openPhases.value = open ? [...others, phase] : others;
}

interface PhaseSection {
  focusOffer: (id: string) => void;
}
/** The phases' components, to reach a row in one of them. */
const phaseSections = new Map<VacationPhase, PhaseSection>();

function rememberPhase(phase: VacationPhase, section: unknown) {
  if (section) phaseSections.set(phase, section as PhaseSection);
  else phaseSections.delete(phase);
}

// Once, when the vacation is loaded: the page follows the trip.
watch(
  vacation,
  (loaded) => {
    if (loaded && !openPhases.value)
      openPhases.value = phasesOpenAtFirst(loaded, tasks.value, today);
  },
  { immediate: true },
);

/** Why the last task typed into a phase could not be saved; it stands
 * under that phase's field until the next task is typed there. */
const addErrors = reactive<Record<VacationPhase, string | null>>({
  before: null,
  during: null,
  after: null,
});

/** Adds a task to a phase. While one person's tasks are listed it is
 * theirs, so it stays in the list it was typed under. */
async function addTask(phase: VacationPhase, title: string) {
  addErrors[phase] = null;
  addErrors[phase] = await vacationStore.addTask(
    props.vacationId,
    phase,
    title,
    taskFilter.value?.person?.id ?? null,
  );
}

/** The task whose rejection the dialog is asking a reason for. */
const rejecting = ref<VacationTask | null>(null);
const rejectOpen = ref(false);
const rejectSaving = ref(false);
const rejectError = ref<string | null>(null);

function askWhyNot(id: string) {
  rejecting.value = tasks.value.find((task) => task.id === id) ?? null;
  rejectError.value = null;
  rejectOpen.value = !!rejecting.value;
}

/** Rejects the task with the reason from the dialog. The focus then goes to
 * the row's person button, where the task is taken or given next: the
 * dialog it was in is gone. */
async function rejectTask(reason: string) {
  const task = rejecting.value;
  if (!task || !me.value) return;
  rejectSaving.value = true;
  rejectError.value = null;
  const outcome = await vacationStore.rejectTask(task.id, me.value.id, reason);
  rejectSaving.value = false;
  if (typeof outcome === "object") {
    rejectError.value = outcome.failure;
    return;
  }
  rejectOpen.value = false;
  if (outcome === "not-yours") {
    Notify.create({ message: "This task isn't yours any more." });
    return;
  }
  await nextTick();
  phaseSections.get(task.phase)?.focusOffer(task.id);
}

/** "Who has what" turns into the list of names while people are changed.
 * All tasks are shown again then: the pressed line is no longer there to be
 * pressed again. */
const editingPeople = ref(false);

function startEditingPeople() {
  chosenFilter.value = null;
  editingPeople.value = true;
}
const addPersonError = ref<string | null>(null);
// Not named after the component: in a template, <fair-share> would then
// be this variable instead of the component.
const shareSection = useTemplateRef<{ focusChangePeople: () => void }>(
  "shareSection",
);

/** The household's members who are not on the trip, with the name they
 * would get. */
const absentMembers = computed<NewVacationPerson[]>(() =>
  householdStore.members
    .filter((member) => !people.value.some((p) => p.user_id === member.user_id))
    .map((member) => ({
      name: nameFromEmail(member.email),
      user_id: member.user_id,
    })),
);

async function addPerson(person: NewVacationPerson) {
  addPersonError.value = null;
  addPersonError.value = await vacationStore.addPerson(
    props.vacationId,
    person,
  );
}

async function stopEditingPeople() {
  editingPeople.value = false;
  addPersonError.value = null;
  await nextTick();
  shareSection.value?.focusChangePeople();
}

const editing = ref(false);
const saving = ref(false);

/** Saves the title and the dates. The fields close once the save worked; a
 * refused one leaves them open with what was typed and the store's error. */
async function saveDetails(details: VacationDetails) {
  saving.value = true;
  try {
    const saved = await vacationStore.update(props.vacationId, details);
    if (saved) editing.value = false;
  } finally {
    saving.value = false;
  }
}

/** Removing takes the vacation and its tasks from every member and can't
 * be undone, so it asks first and says what goes. The removal is
 * optimistic, so the list is shown right away; should it fail, the
 * vacation is back there with the error. */
function confirmRemove() {
  const title = vacation.value?.title;
  const count = tasks.value.length;
  const what = count === 1 ? "its 1 task" : `its ${count} tasks`;
  Dialog.create({
    title: "Remove this vacation?",
    message: `This removes "${title}" and ${what} for the whole family.`,
    // No color for the flat button; see SharedWhiteboard.vue.
    cancel: withTestId(
      { label: "Cancel", flat: true, color: undefined },
      TEST_IDS.confirmDialog.cancel,
    ),
    ok: withTestId(
      { label: "Remove", color: "negative", unelevated: true },
      TEST_IDS.confirmDialog.ok,
    ),
  }).onOk(async () => {
    void vacationStore.remove(props.vacationId);
    await router.replace(ROUTES.vacations);
  });
}
</script>

<template>
  <div>
    <!-- An installed app has no back button of its own on every device. -->
    <q-btn
      flat
      :to="ROUTES.vacations"
      :icon="mdiArrowLeft"
      label="All vacations"
      :data-testid="TEST_IDS.vacation.view.back"
      class="touch-target q-mb-xs"
    />

    <div v-if="vacationStore.loading"><q-spinner color="primary" /></div>

    <article v-else-if="vacation && openPhases">
      <vacation-header
        v-model:editing="editing"
        :vacation="vacation"
        :today="today"
        :ready-to-go="readyToGo"
        :saving="saving"
        @save="saveDetails"
        @remove="confirmRemove"
      />

      <!-- A failed tick, edit, removal or assignment: said aloud as well as
           shown, since the row it concerns has already gone back to what it
           was. -->
      <p
        v-if="vacationStore.error"
        role="alert"
        class="text-negative q-mt-sm"
        :data-testid="TEST_IDS.errorMessage"
      >
        {{ vacationStore.error }}
      </p>

      <vacation-people
        v-if="editingPeople"
        :people="people"
        :absent-members="absentMembers"
        :me="me"
        :emails="emails"
        :add-error="addPersonError"
        @add="addPerson"
        @rename="vacationStore.renamePerson"
        @remove="vacationStore.removePerson"
        @done="stopEditingPeople"
      />
      <fair-share
        v-else
        ref="shareSection"
        :shares="shares"
        :me="me"
        :emails="emails"
        :shown="taskFilter"
        :hint="filterHint"
        @change-people="startEditingPeople"
        @show="(filter) => (chosenFilter = filter)"
      />

      <vacation-meals-link :vacation-id="vacationId" :summary="mealsLine" />

      <vacation-phase
        v-for="entry in phases"
        :key="entry.phase"
        :ref="(section) => rememberPhase(entry.phase, section)"
        :phase="entry.phase"
        :tasks="entry.tasks"
        :summary="entry.summary"
        :add-label="addTaskLabel(entry.phase, taskFilter, me)"
        :row-states="rowStates"
        :people="people"
        :me="me"
        :emails="emails"
        :open="openPhases.includes(entry.phase)"
        :add-error="addErrors[entry.phase]"
        @update:open="(open) => setPhaseOpen(entry.phase, open)"
        @add="addTask"
        @toggle="vacationStore.toggleTask"
        @rename="vacationStore.renameTask"
        @remove="vacationStore.removeTask"
        @give="vacationStore.assignTask"
        @reject="askWhyNot"
      />

      <reject-dialog
        v-model="rejectOpen"
        :task-title="rejecting?.title ?? ''"
        :saving="rejectSaving"
        :error="rejectError"
        @reject="rejectTask"
      />
    </article>

    <!-- Also for another household's vacation: RLS returns no row for it.
         And what replaces the page when someone removes the vacation while
         it is open. -->
    <div
      v-else-if="vacationStore.householdId"
      :data-testid="TEST_IDS.vacation.view.notFound"
    >
      <h2 class="text-h6">Vacation not found</h2>
      <p>This vacation doesn't exist, or it was removed.</p>
    </div>

    <p
      v-else-if="vacationStore.error"
      role="alert"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ vacationStore.error }}
    </p>
  </div>
</template>
