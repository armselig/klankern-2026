<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import type {
  NewVacation,
  NewVacationPerson,
  VacationKind,
} from "~/types/vacation";

/** The form for a new vacation. It waits for the save: the vacation is
 * added with its tasks in one step, and a failed save leaves the member
 * here with what they typed. */
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
    const people = (candidates.value ?? [])
      .filter((person) => person.coming)
      .map(({ name, user_id }) => ({ name, user_id }));
    const id = await vacationStore.add({ ...draft }, people);
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

      <fieldset v-if="candidates" class="vacation-form__kind">
        <legend class="text-muted">Who is coming</legend>
        <!-- role="list" because Safari stops announcing a list once its
             bullets are styled away. -->
        <ul role="list" class="vacation-form__people">
          <li v-for="(person, index) in candidates" :key="index">
            <q-checkbox
              v-model="person.coming"
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
