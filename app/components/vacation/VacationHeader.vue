<script setup lang="ts">
import { mdiDeleteOutline, mdiPencilOutline } from "@quasar/extras/mdi-v7";
import type { Vacation, VacationDetails } from "~/types/vacation";
import type { LocalDate } from "~/utils/local-date";

/**
 * The head of a vacation's page: its title, its dates and where the trip
 * stands today. It is also where a vacation is edited, in place: the title
 * and the dates turn into fields where they stand.
 */
const props = defineProps<{
  vacation: Vacation;
  /** The day the page is read on; it decides the line under the title. */
  today: LocalDate;
  /** Every task before the trip is done, and the trip hasn't started. */
  readyToGo: boolean;
  /** An edit is on its way to the server. */
  saving: boolean;
}>();
const emit = defineEmits<{
  save: [details: VacationDetails];
  remove: [];
}>();
/** Whether the fields are shown. The page closes them once a save worked. */
const editing = defineModel<boolean>("editing", { required: true });

/** The form's own copy to type into: a change another member makes while
 * it is open must not replace what is being typed. */
const draft = reactive<VacationDetails>({
  title: "",
  starts_on: "",
  ends_on: "",
});
const problem = ref<"title" | "dates" | null>(null);

const titleInput = useTemplateRef<{ focus: () => void }>("titleInput");
const editButton = useTemplateRef<{ $el: HTMLElement }>("editButton");

function startEditing() {
  draft.title = props.vacation.title;
  draft.starts_on = props.vacation.starts_on;
  draft.ends_on = props.vacation.ends_on;
  problem.value = null;
  editing.value = true;
}

// The fields had the focus and are gone when they close, by "Cancel" or by
// a save; it goes back to the button that opened them.
watch(editing, async (isEditing) => {
  if (isEditing) return;
  await nextTick();
  editButton.value?.$el.focus();
});

function submit() {
  problem.value = vacationDetailsProblem(draft);
  if (problem.value === "title") titleInput.value?.focus();
  if (problem.value) return;
  emit("save", { ...draft });
}
</script>

<template>
  <header>
    <!-- "Edit" stands beside the title and the dates, not under them: a row
         of its own cost 48px above the tasks. -->
    <div v-if="!editing" class="vacation-header__head">
      <div class="vacation-header__text">
        <h2
          class="text-h6 vacation-header__title"
          :data-testid="TEST_IDS.vacation.header.title"
        >
          {{ vacation.title }}
        </h2>
        <p
          class="text-muted q-my-none"
          :data-testid="TEST_IDS.vacation.header.summary"
        >
          {{ VACATION_KIND_LABELS[vacation.kind] }} ·
          {{ vacationDates(vacation, today) }} ·
          {{ stageLine(vacation, today) }}
        </p>
        <p v-if="readyToGo" class="vacation-header__ready">Ready to go</p>
      </div>
      <q-btn
        ref="editButton"
        flat
        :icon="mdiPencilOutline"
        label="Edit"
        :data-testid="TEST_IDS.vacation.header.edit"
        class="touch-target vacation-header__edit"
        @click="startEditing"
      />
    </div>

    <q-form v-else class="q-gutter-y-sm" @submit.prevent="submit">
      <q-input
        ref="titleInput"
        v-model="draft.title"
        label="Title"
        :data-testid="TEST_IDS.vacation.header.titleInput"
        :maxlength="VACATION_TITLE_LIMIT"
        :error="problem === 'title'"
        :error-message="VACATION_DETAILS_MESSAGES.title"
        hide-bottom-space
        required
        autofocus
      />
      <!-- Said, not offered: the kind decided the tasks the vacation was
           filled with. -->
      <p class="text-muted q-mb-none">
        {{ VACATION_KIND_DESCRIPTIONS[vacation.kind] }}
      </p>
      <div class="vacation-header__dates">
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
          :data-testid="TEST_IDS.vacation.header.until"
          stack-label
          required
          :min="draft.starts_on"
          class="col"
        />
      </div>
      <p
        v-if="problem === 'dates'"
        role="alert"
        class="text-negative q-mb-none"
        :data-testid="TEST_IDS.errorMessage"
      >
        {{ VACATION_DETAILS_MESSAGES.dates }}
      </p>
      <div class="vacation-header__actions">
        <q-btn
          flat
          label="Cancel"
          :data-testid="TEST_IDS.vacation.header.cancel"
          class="touch-target"
          :disable="saving"
          @click="editing = false"
        />
        <q-btn
          type="submit"
          color="primary"
          label="Save"
          :data-testid="TEST_IDS.vacation.header.save"
          unelevated
          class="touch-target"
          :loading="saving"
        />
      </div>
      <q-separator class="q-my-md" />
      <q-btn
        flat
        :icon="mdiDeleteOutline"
        label="Remove vacation"
        :data-testid="TEST_IDS.vacation.header.remove"
        class="touch-target"
        :disable="saving"
        @click="emit('remove')"
      />
    </q-form>
  </header>
</template>

<style scoped>
.vacation-header__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

/* The text gives way to the button and wraps; the button keeps its size. */
.vacation-header__text {
  flex: 1;
  min-width: 0;
}

.vacation-header__edit {
  flex: none;
}

/* A title is one long word at worst; it wraps rather than widening the
   page. */
.vacation-header__title {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}

.vacation-header__ready {
  margin: 4px 0 0;
  font-weight: 500;
}

.vacation-header__dates {
  display: flex;
  gap: 12px;
}

.vacation-header__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
