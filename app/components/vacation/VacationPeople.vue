<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";
import type { NewVacationPerson, VacationPerson } from "~/types/vacation";

/**
 * "Who is coming", on a vacation that exists: "Who has what" turns into
 * the list of names. Each name can be changed, a tick takes a person off,
 * and members who are not on the trip and new names can be added.
 */
const props = defineProps<{
  /** The people on the trip. */
  people: VacationPerson[];
  /** The household's members who are not on the trip, to be added. */
  absentMembers: NewVacationPerson[];
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
  emit("add", { name, user_id: null });
}
</script>

<template>
  <section>
    <h3 class="vacation-people__heading">
      <span>Who is coming</span>
      <q-btn flat label="Done" class="touch-target" @click="emit('done')" />
    </h3>

    <!-- role="list": see FairShare.vue. -->
    <ul role="list" class="vacation-people">
      <li v-for="person in people" :key="person.id">
        <q-checkbox
          :model-value="true"
          :aria-label="`${person.name} is coming`"
          class="touch-target"
          @update:model-value="emit('remove', person.id)"
        />
        <person-avatar :email="emailOf(person.user_id)" :size="24" />
        <q-input
          :model-value="person.name"
          :aria-label="`Name of ${person.name}`"
          dense
          :maxlength="VACATION_PERSON_NAME_LIMIT"
          class="col"
          @change="(event: Event) => rename(person, event)"
        />
        <span class="vacation-people__note text-muted">
          {{
            person.id === me?.id ? "(you)" : person.user_id ? "" : "no account"
          }}
        </span>
      </li>
      <li v-for="member in absentMembers" :key="member.user_id ?? member.name">
        <q-checkbox
          :model-value="false"
          :aria-label="`${member.name} is coming`"
          class="touch-target"
          @update:model-value="emit('add', member)"
        />
        <person-avatar :email="emailOf(member.user_id)" :size="24" />
        <span class="col vacation-people__absent">{{ member.name }}</span>
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
    <p v-if="addError" role="alert" class="text-negative q-mt-sm q-mb-none">
      {{ addError }}
    </p>
  </section>
</template>

<style scoped>
/* Quasar styles a bare h3 as a 3rem display line. */
.vacation-people__heading {
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

.vacation-people {
  margin: 0;
  padding: 4px 8px;
  list-style: none;
  border: 1px solid var(--theme-outline);
  border-radius: 4px;
}

.vacation-people li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
}

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
  margin-top: 8px;
}
</style>
