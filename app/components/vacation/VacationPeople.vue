<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import type { NewVacationPerson, VacationPerson } from "~/types/vacation";

/**
 * "Who is coming", on a vacation that exists: "Who has what" turns into
 * the list of names. A tick takes a person off, and members and children
 * who are not on the trip and new names can be added. The name of a person
 * without an account can be changed: it was typed here. A member's name is
 * text: it comes from the member's address, and the app has nowhere a
 * member sets a name of their own. A child's name is text too: it is the
 * household's name for the child, changed under "Kids" on the home page.
 */
const props = defineProps<{
  /** The people on the trip. */
  people: VacationPerson[];
  /** The household's members and children who are not on the trip, to be
   * added. */
  absentPeople: NewVacationPerson[];
  /** The person the signed-in member is on this trip, or null. */
  me: VacationPerson | null;
  /** The members' email addresses by user id, for their avatars. */
  emails: Record<string, string>;
  /** Why the name typed last could not be saved. */
  addError: string | null;
}>();
const emit = defineEmits<{
  add: [person: NewVacationPerson];
  rename: [id: string, name: string];
  remove: [id: string];
  done: [];
}>();

const newName = ref("");
const addInput = useTemplateRef<{ focus: () => void }>("addInput");

function emailOf(userId: string | null): string | null {
  return userId ? (props.emails[userId] ?? null) : null;
}

/** Saves a changed name when its field is left. An empty one is not saved;
 * the field shows the saved name again. */
function rename(person: VacationPerson, event: Event) {
  const field = event.target as HTMLInputElement;
  const name = field.value.trim();
  if (name && name !== person.name) emit("rename", person.id, name);
  else field.value = person.name;
}

/** Adds the typed name as a person without an account. The field keeps the
 * focus, so several names can be entered in a row. */
function addName() {
  const name = newName.value.trim();
  if (!name) return;
  newName.value = "";
  addInput.value?.focus();
  emit("add", { name, user_id: null, child_id: null });
}
</script>

<template>
  <section class="vacation-people-box">
    <h3 class="vacation-people__heading">
      <span>Who is coming</span>
      <q-btn
        flat
        label="Done"
        :data-testid="TEST_IDS.vacation.people.done"
        class="touch-target"
        @click="emit('done')"
      />
    </h3>

    <!-- role="list": see FairShare.vue. -->
    <ul role="list" class="vacation-people">
      <li
        v-for="person in people"
        :key="person.id"
        :data-testid="TEST_IDS.vacation.people.row"
      >
        <q-checkbox
          :model-value="true"
          :data-testid="TEST_IDS.vacation.people.coming"
          :aria-label="`${person.name} is coming`"
          class="touch-target"
          @update:model-value="emit('remove', person.id)"
        />
        <person-avatar
          :email="emailOf(person.user_id)"
          :person="person"
          :size="24"
        />
        <span
          v-if="person.user_id || person.child_id"
          class="col vacation-people__member"
          >{{ person.name }}</span
        >
        <q-input
          v-else
          :model-value="person.name"
          :aria-label="`Name of ${person.name}`"
          :data-testid="TEST_IDS.vacation.people.nameInput"
          dense
          :maxlength="VACATION_PERSON_NAME_LIMIT"
          class="col"
          @change="(event: Event) => rename(person, event)"
        />
        <span class="vacation-people__note text-muted">
          {{
            person.id === me?.id
              ? "(you)"
              : person.user_id
                ? ""
                : person.child_id
                  ? "child"
                  : "no account"
          }}
        </span>
      </li>
      <li
        v-for="absent in absentPeople"
        :key="absent.user_id ?? absent.child_id ?? absent.name"
        :data-testid="TEST_IDS.vacation.people.absentRow"
      >
        <q-checkbox
          :model-value="false"
          :aria-label="`${absent.name} is coming`"
          class="touch-target"
          @update:model-value="emit('add', absent)"
        />
        <!-- A child gets its badge, as on the trip; a member waits for
             the address. -->
        <person-avatar
          :email="emailOf(absent.user_id)"
          :person="
            absent.child_id
              ? {
                  id: absent.child_id,
                  name: absent.name,
                  user_id: null,
                }
              : undefined
          "
          :size="24"
        />
        <span class="col vacation-people__absent">{{ absent.name }}</span>
        <span class="vacation-people__note text-muted">not coming</span>
      </li>
    </ul>
    <p class="vacation-people__hint text-muted">
      Unticking takes a person off; their open tasks go back to nobody.
    </p>

    <q-form class="vacation-people__add" @submit.prevent="addName">
      <q-input
        ref="addInput"
        v-model="newName"
        label="Add a name"
        :maxlength="VACATION_PERSON_NAME_LIMIT"
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
    <p
      v-if="addError"
      role="alert"
      class="text-negative q-mt-sm q-mb-none"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ addError }}
    </p>
  </section>
</template>

<style scoped>
/* The frame of "Who has what" (FairShare.vue), whose place this takes
   while the people are changed: the box stays as it is, with its heading
   inside. */
.vacation-people-box {
  margin-top: 16px;
  padding: 4px 8px;
  border: 1px solid var(--theme-separator);
}

/* Quasar styles a bare h3 as a 3rem display line. */
.vacation-people__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5rem;
  letter-spacing: normal;
}

.vacation-people {
  margin: 0;
  padding: 0;
  list-style: none;
}

.vacation-people li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
}

.vacation-people__member,
.vacation-people__absent {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vacation-people__note {
  flex: 0 0 74px;
  font-size: 0.8125rem;
}

.vacation-people__hint {
  margin: 4px 0 0;
  font-size: 0.8125rem;
}

.vacation-people__add {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 8px 0 8px;
}
</style>
