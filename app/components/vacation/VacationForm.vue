<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import type {
  NewVacation,
  NewVacationPerson,
  VacationDetailsProblem,
} from "~/types/vacation";

/** The form for a new vacation. It waits for the save: the vacation is
 * added with its tasks in one step, and a failed save leaves the member
 * here with what they typed. A vacation starts with no tasks, or with
 * copies of an earlier one's. */
const props = defineProps<{ householdId: string }>();
const vacationStore = useVacationStore();
const householdStore = useHouseholdStore();
const user = useSupabaseUser();
const router = useRouter();

onMounted(() => {
  void vacationStore.load(props.householdId);
  // The members are who is coming to start with; the dashboard has usually
  // fetched them already.
  if (householdStore.members.length === 0) void householdStore.fetchMembers();
});

/** A person the form offers, and whether they are coming. */
interface Candidate extends NewVacationPerson {
  coming: boolean;
}

/**
 * Who is coming: every member, and the people without an account of the
 * vacation that was created last, all ticked. Null until both are known;
 * taken once then, so a change that arrives while the form is open doesn't
 * undo what was unticked or typed.
 */
const candidates = ref<Candidate[] | null>(null);

watch(
  () =>
    vacationStore.householdId && householdStore.members.length > 0
      ? householdStore.members
      : null,
  (members) => {
    if (!members || candidates.value) return;
    const lastId = lastCreatedVacationId(
      Object.values(vacationStore.vacationsById),
    );
    const lastPeople = lastId ? vacationStore.peopleOf(lastId) : [];
    candidates.value = peopleToStartWith(members, lastPeople).map((person) => ({
      ...person,
      coming: true,
    }));
  },
  { immediate: true },
);

/** The day the form was opened on, for the dates of the trips it offers
 * to copy (see VacationView). */
const today = localDateOf(new Date());

/** The trips whose tasks a new one can start with, the latest added first. */
const copySources = computed(() =>
  vacationsByCreation(vacationStore.vacationsById),
);

/**
 * The vacation whose tasks are copied, or "" for none. The one added last
 * to start with, as for the people; taken once, when the vacations are
 * known, so a trip that arrives while the form is open changes no choice.
 */
const copyTasksFrom = ref<string | null>(null);

/** What the choice of tasks offers, as Quasar's select takes it. */
const copyOptions = computed(() => [
  { value: "", label: "No tasks" },
  ...copySources.value.map((vacation) => ({
    value: vacation.id,
    label: `${vacation.title} (${vacationDates(vacation, today)})`,
  })),
]);

watch(
  () => vacationStore.householdId,
  (householdId) => {
    if (!householdId || copyTasksFrom.value !== null) return;
    copyTasksFrom.value = copySources.value[0]?.id ?? "";
  },
  { immediate: true },
);

const newName = ref("");
const nameInput = useTemplateRef<{ focus: () => void }>("nameInput");

/** Adds the typed name as a person without an account. Not the form's
 * submit: Enter in this field adds the name, it doesn't save the vacation. */
function addName() {
  const name = newName.value.trim();
  if (!name || !candidates.value) return;
  candidates.value.push({ name, user_id: null, coming: true });
  newName.value = "";
  nameInput.value?.focus();
}

const draft = reactive<NewVacation>({
  title: "",
  kind: "house",
  starts_on: "",
  ends_on: "",
});
const problem = ref<VacationDetailsProblem | null>(null);
const saving = ref(false);

const titleInput = useTemplateRef<{ focus: () => void }>("titleInput");

const kindOptions = VACATION_KINDS.map((kind) => ({
  value: kind,
  label: VACATION_KIND_LABELS[kind],
}));

/** Adds the vacation and opens its page. */
async function submit() {
  problem.value = vacationDetailsProblem(draft);
  if (problem.value === "title") titleInput.value?.focus();
  if (problem.value) return;
  saving.value = true;
  try {
    const people = (candidates.value ?? [])
      .filter((person) => person.coming)
      .map(({ name, user_id }) => ({ name, user_id }));
    // A trip that was removed while the form was open has nothing to copy.
    const source = copySources.value.find(
      (vacation) => vacation.id === copyTasksFrom.value,
    );
    const id = await vacationStore.add(
      { ...draft },
      people,
      source?.id ?? null,
    );
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
        :data-testid="TEST_IDS.vacation.form.title"
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
          :data-testid="TEST_IDS.vacation.form.kinds"
          type="radio"
        />
      </fieldset>

      <!-- Framed, as is the choice of tasks: the two stand apart from the
           fields around them. -->
      <fieldset class="vacation-form__box">
        <legend class="vacation-form__box-legend text-muted">Dates</legend>
        <div class="vacation-form__dates">
          <vacation-date-field
            v-model="draft.starts_on"
            label="From"
            :test-id="TEST_IDS.vacation.form.from"
            class="col"
          />
          <vacation-date-field
            v-model="draft.ends_on"
            label="Until"
            :test-id="TEST_IDS.vacation.form.until"
            :min="draft.starts_on || undefined"
            class="col"
          />
        </div>
        <p
          v-if="problem && problem !== 'title'"
          role="alert"
          class="text-negative q-mb-none q-mt-sm"
          :data-testid="TEST_IDS.errorMessage"
        >
          {{ VACATION_DETAILS_MESSAGES[problem] }}
        </p>
      </fieldset>

      <fieldset v-if="candidates" class="vacation-form__kind">
        <legend class="text-muted">Who is coming</legend>
        <!-- role="list" because Safari stops announcing a list once its
             bullets are styled away. -->
        <ul role="list" class="vacation-form__people">
          <li v-for="(person, index) in candidates" :key="index">
            <q-checkbox
              v-model="person.coming"
              :data-testid="TEST_IDS.vacation.form.person"
              :label="
                person.user_id === user?.sub
                  ? `${person.name} (you)`
                  : person.name
              "
              class="touch-target"
            />
            <span v-if="!person.user_id" class="text-muted">no account</span>
          </li>
        </ul>
        <div class="vacation-form__add-name">
          <q-input
            ref="nameInput"
            v-model="newName"
            label="Add a name"
            :data-testid="TEST_IDS.vacation.form.addName"
            :maxlength="VACATION_PERSON_NAME_LIMIT"
            class="col"
            @keydown.enter.prevent="addName"
          />
          <q-btn
            flat
            :icon="mdiPlus"
            label="Add"
            class="touch-target"
            @click="addName"
          />
        </div>
        <!-- Not the field's own hint: Quasar sets that in a grey that is
             below 4.5:1 on the theme's background in light mode. -->
        <p class="vacation-form__hint text-muted">
          For someone without an account, such as a child.
        </p>
      </fieldset>

      <fieldset v-if="copySources.length > 0" class="vacation-form__box">
        <legend class="vacation-form__box-legend text-muted">Tasks</legend>
        <q-select
          v-model="copyTasksFrom"
          :options="copyOptions"
          label="Start with the tasks of"
          :data-testid="TEST_IDS.vacation.form.copyFrom"
          emit-value
          map-options
          class="touch-target"
        />
        <!-- Not the field's own hint, as for the names above. -->
        <p class="vacation-form__hint text-muted">
          Copied tasks start open and belong to nobody.
        </p>
      </fieldset>

      <p
        v-if="vacationStore.error"
        role="alert"
        class="text-negative"
        :data-testid="TEST_IDS.errorMessage"
      >
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
          :data-testid="TEST_IDS.vacation.form.submit"
          unelevated
          class="touch-target"
          :loading="saving"
        />
      </div>
    </q-form>

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

<style scoped>
.vacation-form__kind {
  margin-inline: 0;
  padding: 0;
  border: 0;
}

.vacation-form__people {
  margin: 0;
  padding: 0;
  list-style: none;
}

.vacation-form__people li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vacation-form__add-name {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.vacation-form__hint {
  margin: 4px 0 0;
  font-size: 0.75rem;
}

.vacation-form__box {
  margin-inline: 0;
  padding: 4px 12px 12px;
  border: 1px solid var(--theme-outline);
  border-radius: 4px;
}

.vacation-form__box-legend {
  padding-inline: 4px;
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
