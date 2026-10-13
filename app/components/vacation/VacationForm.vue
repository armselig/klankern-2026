<script setup lang="ts">
import type { NewVacation, VacationKind } from "~/types/vacation";

/** The form for a new vacation. It waits for the save: the vacation is
 * added with its tasks in one step, and a failed save leaves the member
 * here with what they typed. */
const props = defineProps<{ householdId: string }>();
const vacationStore = useVacationStore();
const router = useRouter();

onMounted(() => vacationStore.load(props.householdId));

const draft = reactive<NewVacation>({
  title: "",
  kind: "house",
  starts_on: "",
  ends_on: "",
});
const problem = ref<"title" | "dates" | null>(null);
const saving = ref(false);

const titleInput = useTemplateRef<{ focus: () => void }>("titleInput");

const KINDS: VacationKind[] = ["house", "hotel"];
const kindOptions = KINDS.map((kind) => ({
  value: kind,
  label: VACATION_KIND_DESCRIPTIONS[kind],
}));

/** Adds the vacation and opens its page. */
async function submit() {
  problem.value = vacationDetailsProblem(draft);
  if (problem.value === "title") titleInput.value?.focus();
  if (problem.value) return;
  saving.value = true;
  try {
    const id = await vacationStore.add({ ...draft });
    if (id) await router.replace(ROUTES.vacation(id));
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <q-spinner v-if="vacationStore.loading" color="primary" />

    <!-- Only once the vacations are loaded: a save needs the household. -->
    <q-form
      v-else-if="vacationStore.householdId"
      class="q-gutter-y-md"
      @submit.prevent="submit"
    >
      <q-input
        ref="titleInput"
        v-model="draft.title"
        label="Title"
        :maxlength="VACATION_TITLE_LIMIT"
        :error="problem === 'title'"
        :error-message="VACATION_DETAILS_MESSAGES.title"
        hide-bottom-space
        required
        autofocus
      />

      <!-- A group with its question as the name, so a screen reader says
           what the two choices are for. -->
      <fieldset class="vacation-form__kind">
        <legend class="text-muted">Kind of stay</legend>
        <q-option-group
          v-model="draft.kind"
          :options="kindOptions"
          type="radio"
        />
      </fieldset>

      <div class="vacation-form__dates">
        <q-input
          v-model="draft.starts_on"
          type="date"
          label="From"
          stack-label
          required
          class="col"
        />
        <q-input
          v-model="draft.ends_on"
          type="date"
          label="Until"
          stack-label
          required
          :min="draft.starts_on"
          class="col"
        />
      </div>
      <p v-if="problem === 'dates'" role="alert" class="text-negative">
        {{ VACATION_DETAILS_MESSAGES.dates }}
      </p>

      <p v-if="vacationStore.error" role="alert" class="text-negative">
        {{ vacationStore.error }}
      </p>

      <div class="vacation-form__actions">
        <q-btn
          flat
          :to="ROUTES.vacations"
          label="Cancel"
          class="touch-target"
          :disable="saving"
        />
        <q-btn
          type="submit"
          color="primary"
          label="Add vacation"
          unelevated
          class="touch-target"
          :loading="saving"
        />
      </div>
    </q-form>

    <p v-else-if="vacationStore.error" role="alert" class="text-negative">
      {{ vacationStore.error }}
    </p>
  </div>
</template>

<style scoped>
.vacation-form__kind {
  margin-inline: 0;
  padding: 0;
  border: 0;
}

.vacation-form__dates {
  display: flex;
  gap: 12px;
}

.vacation-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
