<script setup lang="ts">
import { mdiArrowLeft } from "@quasar/extras/mdi-v7";
import { Dialog } from "quasar";
import type { VacationDetails, VacationPhase } from "~/types/vacation";

const props = defineProps<{ householdId: string; vacationId: string }>();
const vacationStore = useVacationStore();
const router = useRouter();

onMounted(() => vacationStore.load(props.householdId));

/** The day the page was opened on. It is not worked out again at midnight:
 * a page left open overnight shows yesterday's stage until it is opened
 * anew. */
const today = localDateOf(new Date());

const vacation = computed(() => vacationStore.find(props.vacationId));
const tasks = computed(() => vacationStore.tasksOf(props.vacationId));
const tasksByPhase = computed(
  () =>
    Object.fromEntries(
      VACATION_PHASES.map((phase) => [phase, tasksInPhase(tasks.value, phase)]),
    ) as Record<VacationPhase, ReturnType<typeof tasksInPhase>>,
);
const readyToGo = computed(
  () => !!vacation.value && isReadyToGo(vacation.value, tasks.value, today),
);

/** The phases that are unfolded. Null until the vacation is loaded; then
 * the page follows the trip (see phasesOpenAtFirst), once. After that a
 * phase is open or folded as the member left it, for the visit: one that
 * closed by itself when its last task was ticked would take the row away
 * from under the finger. */
const openPhases = ref<VacationPhase[] | null>(null);

watch(
  vacation,
  (loaded) => {
    if (loaded && !openPhases.value)
      openPhases.value = phasesOpenAtFirst(loaded, tasks.value, today);
  },
  { immediate: true },
);

function setPhaseOpen(phase: VacationPhase, open: boolean) {
  const others = (openPhases.value ?? []).filter((other) => other !== phase);
  openPhases.value = open ? [...others, phase] : others;
}

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
      <vacation-header
        v-model:editing="editing"
        :vacation="vacation"
        :today="today"
        :ready-to-go="readyToGo"
        :saving="saving"
        @save="saveDetails"
        @remove="confirmRemove"
      />

      <!-- A failed tick, edit or removal: said aloud as well as shown, since
           the row it concerns has already gone back to what it was. -->
      <p v-if="vacationStore.error" role="alert" class="text-negative q-mt-sm">
        {{ vacationStore.error }}
      </p>

      <vacation-phase
        v-for="phase in VACATION_PHASES"
        :key="phase"
        :phase="phase"
        :tasks="tasksByPhase[phase]"
        :open="openPhases.includes(phase)"
        :add-error="addErrors[phase]"
        @update:open="(open) => setPhaseOpen(phase, open)"
        @add="addTask"
        @toggle="vacationStore.toggleTask"
        @rename="vacationStore.renameTask"
        @remove="vacationStore.removeTask"
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
