<script setup lang="ts">
import { mdiArrowLeft } from "@quasar/extras/mdi-v7";
import { Dialog, Notify } from "quasar";
import type {
  NewVacationPerson,
  TaskRowState,
  VacationDetails,
  VacationPhase,
  VacationTask,
} from "~/types/vacation";

const props = defineProps<{ householdId: string; vacationId: string }>();
const vacationStore = useVacationStore();
const householdStore = useHouseholdStore();
const user = useSupabaseUser();
const router = useRouter();
const route = useRoute();

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
const shares = computed(() =>
  taskShares(tasks.value, people.value, vacationStore.peopleById),
);

/** "Only my tasks": each phase lists the member's open tasks alone. It
 * lasts for the visit and is stored nowhere. */
const onlyMine = ref(false);

/** What each phase shows: its tasks, or the member's open ones, and the
 * text beside its heading to match. */
const phases = computed(() =>
  VACATION_PHASES.map((phase) => {
    const all = tasksInPhase(tasks.value, phase);
    const mine = onlyMine.value && me.value;
    return {
      phase,
      tasks: mine ? openTasksOf(all, me.value, vacationStore.peopleById) : all,
      summary: mine
        ? phaseSummaryOfMine(all, me.value, vacationStore.peopleById)
        : phaseSummary(all),
    };
  }),
);

/** The line a row gets after the member gave or rejected its task, by task
 * id. Held here only: nobody else sees it, and it is gone with the page. */
const tellLines = reactive<Record<string, string>>({});
/** The task a link led to, marked for a moment. */
const markedTaskId = ref<string | null>(null);

/** Whether a message about a task has someone to go to: its assignee, if
 * that is another person with an account, who can open the link; or
 * everyone, when it is the member's own "no". */
function canTell(task: VacationTask): boolean {
  const assignee = assigneeOf(task, vacationStore.peopleById);
  if (assignee) return !!assignee.user_id && assignee.id !== me.value?.id;
  return !!task.rejected_by && task.rejected_by === me.value?.id;
}

const rowStates = computed<Record<string, TaskRowState>>(() =>
  Object.fromEntries(
    tasks.value.map((task) => [
      task.id,
      {
        assignee: assigneeOf(task, vacationStore.peopleById),
        rejecter: rejecterOf(task, vacationStore.peopleById),
        mine: isTaskOf(task, me.value, vacationStore.peopleById),
        tellLine: tellLines[task.id] ?? null,
        canTell: canTell(task),
        marked: markedTaskId.value === task.id,
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
  arrive: (id: string) => void;
}
/** The phases' components, to reach a row in one of them. */
const phaseSections = new Map<VacationPhase, PhaseSection>();

function rememberPhase(phase: VacationPhase, section: unknown) {
  if (section) phaseSections.set(phase, section as PhaseSection);
  else phaseSections.delete(phase);
}

/** Said at the top when a link named a task that is gone. */
const linkNotice = ref<string | null>(null);

/**
 * Acts on what a link asked for (see utils/vacation-link.ts), once, and
 * takes the parameters out of the address: left there, every reload would
 * mark the row again and tick "Only my tasks" again.
 */
async function landFromLink() {
  const target = readVacationLink(route.query);
  if (!target.taskId && !target.onlyMine) return;
  await router.replace({ query: withoutVacationLink(route.query) });
  if (target.onlyMine && me.value) onlyMine.value = true;
  if (!target.taskId) return;
  const task = tasks.value.find((candidate) => candidate.id === target.taskId);
  if (!task) {
    linkNotice.value = "The task this link led to was removed.";
    return;
  }
  setPhaseOpen(task.phase, true);
  markedTaskId.value = task.id;
  await nextTick();
  phaseSections.get(task.phase)?.arrive(task.id);
}

// Only once the first load is in: before it, the row to scroll to does not
// exist.
watch(
  vacation,
  (loaded) => {
    if (!loaded || openPhases.value) return;
    openPhases.value = phasesOpenAtFirst(loaded, tasks.value, today);
    void landFromLink();
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

async function addTask(phase: VacationPhase, title: string) {
  addErrors[phase] = null;
  addErrors[phase] = await vacationStore.addTask(
    props.vacationId,
    phase,
    title,
  );
}

/** Gives a task to a person, to the member themselves or back to nobody.
 * After giving it to someone else who can open a link, the row offers to
 * tell them; nobody sends a message to themselves or to a small child. */
async function giveTask(id: string, personId: string | null) {
  // An earlier line of this row is about an assignment that no longer holds.
  Reflect.deleteProperty(tellLines, id);
  const saved = await vacationStore.assignTask(id, personId);
  const person = personId ? vacationStore.peopleById[personId] : null;
  if (saved && person?.user_id && person.id !== me.value?.id)
    tellLines[id] = `Given to ${person.name}.`;
}

function closeTellLine(id: string) {
  Reflect.deleteProperty(tellLines, id);
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
 * what the row offers next, "I'll take it": the "Reject" button it was on
 * is gone. */
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
  tellLines[task.id] = "Back to nobody.";
  await nextTick();
  phaseSections.get(task.phase)?.focusOffer(task.id);
}

/**
 * Hands a message to the share sheet, or copies it. Called straight from
 * the press, with nothing awaited before it: a browser opens the share
 * sheet only during a gesture.
 */
async function send(message: string) {
  const outcome = await shareOrCopy(navigator, message);
  if (outcome === "copied") {
    Notify.create({
      message: "Message copied",
      // See InviteDialog.vue for the colors.
      color: "primary",
      textColor: "on-accent",
    });
  } else if (outcome === "manual") {
    // Neither the share sheet nor the clipboard: the sentence is shown to
    // be selected by hand.
    Dialog.create({
      title: "Copy this message",
      message,
      ok: { label: "Close", flat: true, color: undefined },
    });
  }
}

/** Tells the others about one task: that it is someone's now, or that the
 * member said no to it. */
function tellAboutTask(id: string) {
  const task = tasks.value.find((candidate) => candidate.id === id);
  if (!task || !vacation.value) return;
  const link = taskLink(location.origin, props.vacationId, task.id);
  const message =
    task.rejected_by && task.rejection_reason
      ? rejectedTaskMessage(
          task.title,
          vacation.value.title,
          task.rejection_reason,
          link,
        )
      : givenTaskMessage(task.title, vacation.value.title, link);
  void send(message);
}

/** Tells one person about everything they have, in one message: after a
 * trip is added, a member gives several tasks in a row. */
function tellPerson(personId: string) {
  const share = shares.value.find((entry) => entry.person?.id === personId);
  if (!share || !vacation.value) return;
  void send(
    openTasksMessage(
      share.open,
      vacation.value.title,
      myTasksLink(location.origin, props.vacationId),
    ),
  );
}

/** "Who has what" turns into the list of names while people are changed. */
const editingPeople = ref(false);
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
    cancel: { label: "Cancel", flat: true, color: undefined },
    ok: { label: "Remove", color: "negative", unelevated: true },
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
      class="touch-target q-mb-xs"
    />

    <div v-if="vacationStore.loading"><q-spinner color="primary" /></div>

    <article v-else-if="vacation && openPhases">
      <p v-if="linkNotice" role="status" class="text-muted">
        {{ linkNotice }}
      </p>

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
      <p v-if="vacationStore.error" role="alert" class="text-negative q-mt-sm">
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
        @change-people="editingPeople = true"
        @tell="tellPerson"
      />

      <!-- Only for a person of this trip: a member who isn't coming has no
           tasks here. -->
      <div v-if="me" class="q-mt-md">
        <q-checkbox
          v-model="onlyMine"
          label="Only my tasks"
          class="touch-target"
        />
        <p v-if="onlyMine" class="vacation-view__hint text-muted">
          Untick to add tasks.
        </p>
      </div>

      <vacation-phase
        v-for="entry in phases"
        :key="entry.phase"
        :ref="(section) => rememberPhase(entry.phase, section)"
        :phase="entry.phase"
        :tasks="entry.tasks"
        :summary="entry.summary"
        :can-add="!onlyMine"
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
        @give="giveTask"
        @reject="askWhyNot"
        @tell="tellAboutTask"
        @close-tell="closeTellLine"
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
    <div v-else-if="vacationStore.householdId">
      <h2 class="text-h6">Vacation not found</h2>
      <p>This vacation doesn't exist, or it was removed.</p>
    </div>

    <p v-else-if="vacationStore.error" role="alert" class="text-negative">
      {{ vacationStore.error }}
    </p>
  </div>
</template>

<style scoped>
/* Under the checkbox's label, which starts 40px in. */
.vacation-view__hint {
  margin: 0 0 0 40px;
  font-size: 0.8125rem;
}
</style>
