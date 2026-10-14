<script setup lang="ts">
import { mdiDotsVertical, mdiPlus } from "@quasar/extras/mdi-v7";
import type {
  TaskRowState,
  VacationPerson,
  VacationTask,
} from "~/types/vacation";

const props = defineProps<{
  task: VacationTask;
  /** Who has the task, who said no and what the row offers (see
   * TaskRowState). */
  state: TaskRowState;
  /** The people on the trip, for "Give to…". Without any, the row is the
   * task alone, as before people could be on a vacation. */
  people: VacationPerson[];
  /** The person the signed-in member is on this trip, or null. */
  me: VacationPerson | null;
  /** The members' email addresses by user id, for their avatars. */
  emails: Record<string, string>;
}>();
const emit = defineEmits<{
  toggle: [id: string];
  rename: [id: string, title: string];
  remove: [id: string];
  /** Give the task to a person, or to nobody (null). */
  give: [id: string, personId: string | null];
  reject: [id: string];
}>();

interface HasElement {
  $el: HTMLElement;
}
const tickBox = useTemplateRef<HasElement>("tickBox");
const moreButton = useTemplateRef<HasElement>("moreButton");
const whoButton = useTemplateRef<HasElement>("whoButton");

/**
 * Whether the row's menu is open. The menu is opened here and not by
 * Quasar's own listener on the button: that one also opens it when Enter
 * is released on the button, which is what happens when Enter saves the
 * title and the focus has just moved back to the button.
 */
const menuOpen = ref(false);
/** The list of people to give the task to, opened from the row's person
 * button. */
const giveOpen = ref(false);

/** The row is edited in place: its title turns into a field where it
 * stands. Only the title, so the tick box and the menu give way to it. */
const editing = ref(false);
const draftTitle = ref("");

function startEditing() {
  // The menu goes with the line it belongs to before it can report that it
  // closed, and would be open again when the line comes back.
  menuOpen.value = false;
  draftTitle.value = props.task.title;
  editing.value = true;
}

/** Leaves the field and puts the focus back on "More", which opened it: the
 * field had the focus and is gone. */
async function stopEditing() {
  editing.value = false;
  await nextTick();
  moreButton.value?.$el.focus();
}

/** Saves the title. An empty one is not saved and the field stays, so a
 * task can't lose its name by a slip. */
async function saveTitle() {
  const title = draftTitle.value.trim();
  if (!title) return;
  if (title !== props.task.title) emit("rename", props.task.id, title);
  await stopEditing();
}

/** A task nobody has: free, rejected, or given to someone who was taken
 * off the trip. */
const isFree = computed(() => !props.state.assignee);

/**
 * Whether the row has its person button: an open task on a trip that has
 * people. A done task is nobody's business any more, and a vacation from
 * before people could be on one has nobody to give a task to.
 */
const showsWho = computed(() => !props.task.done && props.people.length > 0);

/** Who the list of people offers besides the member themselves: everyone
 * on the trip but the one who has the task. */
const others = computed(() =>
  props.people.filter(
    (person) =>
      person.id !== props.state.assignee?.id && person.id !== props.me?.id,
  ),
);

/** Who has the task, as the person button's name says it, before the
 * task's title: a page has some thirty of these buttons. */
const whoLabel = computed(() => {
  if (props.state.mine) return "Yours";
  return props.state.assignee?.name ?? "Nobody yet";
});

function emailOf(person: VacationPerson): string | null {
  return person.user_id ? (props.emails[person.user_id] ?? null) : null;
}

defineExpose({
  /** Puts the focus on the row's tick box: after a tick has moved the row,
   * and after the row above it was removed. */
  focusTickBox: () => tickBox.value?.$el.focus(),
  /** Puts the focus on the row's person button, after the member rejected
   * the task: it is where the task is taken or given next. */
  focusOffer: () => whoButton.value?.$el.focus(),
});
</script>

<template>
  <q-item class="vacation-task" :data-testid="TEST_IDS.vacation.task.row">
    <q-item-section>
      <q-form
        v-if="editing"
        class="vacation-task__edit"
        @submit.prevent="saveTitle"
        @keydown.esc.prevent="stopEditing"
      >
        <q-input
          v-model="draftTitle"
          label="Task"
          :data-testid="TEST_IDS.vacation.task.titleInput"
          :maxlength="VACATION_TITLE_LIMIT"
          autofocus
        />
        <div class="vacation-task__actions">
          <q-btn
            flat
            label="Cancel"
            class="touch-target"
            @click="stopEditing"
          />
          <q-btn
            type="submit"
            color="primary"
            label="Save"
            unelevated
            class="touch-target"
          />
        </div>
      </q-form>

      <template v-else>
        <div class="vacation-task__line">
          <!-- The title is the checkbox's label, so screen readers announce
               the task, not "on". -->
          <q-checkbox
            ref="tickBox"
            :model-value="task.done"
            :label="task.title"
            class="vacation-task__tick"
            :data-testid="TEST_IDS.vacation.task.checkbox"
            :class="{ 'text-strike text-muted': task.done }"
            @update:model-value="emit('toggle', task.id)"
          />
          <!-- Who has the task, and the one control to change that: the
               person's picture, or an empty circle for nobody. One line per
               task keeps the list short enough to scan; a second line with
               the person's name and buttons made it twice as long. -->
          <q-btn
            v-if="showsWho"
            ref="whoButton"
            flat
            round
            :aria-label="`${whoLabel}: ${task.title}`"
            :data-testid="TEST_IDS.vacation.task.who"
            :aria-expanded="giveOpen"
            class="touch-target"
            @click="giveOpen = !giveOpen"
          >
            <person-avatar
              v-if="state.assignee"
              :email="emailOf(state.assignee)"
              :person="state.assignee"
              :size="28"
            />
            <span v-else class="vacation-task__nobody" aria-hidden="true">
              <q-icon :name="mdiPlus" size="16px" />
            </span>
            <q-tooltip>{{ whoLabel }}</q-tooltip>
            <q-menu
              v-model="giveOpen"
              no-parent-event
              auto-close
              anchor="bottom right"
              self="top right"
              role="group"
              :aria-label="`Give to…: ${task.title}`"
              :data-testid="TEST_IDS.vacation.giveMenu.group"
            >
              <div class="column vacation-task__menu">
                <!-- The member first: taking a task is as close as giving
                     it away. -->
                <q-btn
                  v-if="me && !state.mine"
                  flat
                  no-caps
                  align="left"
                  class="touch-target"
                  :data-testid="TEST_IDS.vacation.giveMenu.me"
                  @click="emit('give', task.id, me.id)"
                >
                  <person-avatar :email="emailOf(me)" :person="me" :size="24" />
                  <span class="q-ml-sm">Me</span>
                </q-btn>
                <q-btn
                  v-for="person in others"
                  :key="person.id"
                  flat
                  no-caps
                  align="left"
                  class="touch-target"
                  :data-testid="TEST_IDS.vacation.giveMenu.person"
                  @click="emit('give', task.id, person.id)"
                >
                  <person-avatar
                    :email="emailOf(person)"
                    :person="person"
                    :size="24"
                  />
                  <span class="q-ml-sm">{{ person.name }}</span>
                  <span v-if="!person.user_id" class="q-ml-sm text-muted"
                    >no account</span
                  >
                </q-btn>
                <q-btn
                  v-if="!isFree"
                  flat
                  no-caps
                  align="left"
                  label="Nobody"
                  class="touch-target text-muted"
                  @click="emit('give', task.id, null)"
                />
              </div>
            </q-menu>
          </q-btn>
          <!-- The visible sign is the same in every row, so the name adds
               the task: a page has some thirty of these buttons. -->
          <q-btn
            ref="moreButton"
            flat
            round
            :icon="mdiDotsVertical"
            :aria-label="`More: ${task.title}`"
            :aria-expanded="menuOpen"
            :data-testid="TEST_IDS.vacation.task.more"
            class="touch-target"
            @click="menuOpen = !menuOpen"
          >
            <!-- A group of real buttons, as the account menu is: list items
                 have no role that says they can be pressed. -->
            <q-menu
              v-model="menuOpen"
              :data-testid="TEST_IDS.vacation.taskMenu.group"
              no-parent-event
              auto-close
              anchor="bottom right"
              self="top right"
              role="group"
              :aria-label="`More: ${task.title}`"
            >
              <div class="column vacation-task__menu">
                <q-btn
                  flat
                  no-caps
                  align="left"
                  label="Edit"
                  :data-testid="TEST_IDS.vacation.taskMenu.edit"
                  class="touch-target"
                  @click="startEditing"
                />
                <q-btn
                  v-if="state.mine && !task.done"
                  flat
                  no-caps
                  align="left"
                  label="Reject"
                  :data-testid="TEST_IDS.vacation.taskMenu.reject"
                  class="touch-target"
                  @click="emit('reject', task.id)"
                />
                <q-btn
                  flat
                  no-caps
                  align="left"
                  label="Remove"
                  :data-testid="TEST_IDS.vacation.taskMenu.remove"
                  class="touch-target"
                  @click="emit('remove', task.id)"
                />
              </div>
            </q-menu>
          </q-btn>
        </div>

        <!-- Below the line only what needs a reader: the reason of a
             rejection. -->
        <p
          v-if="showsWho && isFree && state.rejecter && task.rejection_reason"
          class="vacation-task__reason text-muted"
          :data-testid="TEST_IDS.vacation.task.reason"
        >
          {{ state.rejecter.name }} said no: “{{ task.rejection_reason }}”
        </p>
      </template>
    </q-item-section>
  </q-item>
</template>

<style scoped>
/* Quasar pads an item by 16px at the sides; the row's own controls are
   44px wide and bring their room with them. */
.vacation-task {
  padding: 4px 8px;
}

.vacation-task__line {
  display: flex;
  align-items: flex-start;
}

/* The tick box takes the row's width, so the title is a target too, and is
   as high as the button beside it. */
.vacation-task__tick {
  flex: 1;
  min-width: 0;
  min-height: 44px;
}

/* A title is one long word at worst (a pasted link); it wraps rather than
   widening the page. */
.vacation-task__tick :deep(.q-checkbox__label) {
  overflow-wrap: anywhere;
}

/* The empty place of a person: a dashed circle, as the roster's "Invite"
   is, the size of a picture in this row. */
.vacation-task__nobody {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px dashed var(--theme-text-muted);
  border-radius: 50%;
  color: var(--theme-text-muted);
}

.vacation-task__reason {
  margin: 0 8px 4px 40px;
  overflow-wrap: anywhere;
}

.vacation-task__edit {
  padding: 0 0 4px;
}

.vacation-task__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.vacation-task__menu {
  min-width: 160px;
}
</style>
