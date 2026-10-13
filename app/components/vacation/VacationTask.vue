<script setup lang="ts">
import { mdiClose, mdiDotsVertical } from "@quasar/extras/mdi-v7";
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
  tell: [id: string];
  closeTell: [id: string];
}>();

interface HasElement {
  $el: HTMLElement;
}
const row = useTemplateRef<HasElement>("row");
const tickBox = useTemplateRef<HasElement>("tickBox");
const moreButton = useTemplateRef<HasElement>("moreButton");
const takeButton = useTemplateRef<HasElement>("takeButton");
const giveButton = useTemplateRef<HasElement>("giveButton");

/**
 * Whether the row's menu is open. The menu is opened here and not by
 * Quasar's own listener on the button: that one also opens it when Enter
 * is released on the button, which is what happens when Enter saves the
 * title and the focus has just moved back to the button.
 */
const menuOpen = ref(false);
/** The list of people to give the task to, opened from the row's own
 * button or from the menu. */
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
 * off the trip. It offers itself to be taken or given. */
const isFree = computed(() => !props.state.assignee);

/** Who "Give to…" lists: everyone on the trip but the one who has the
 * task. */
const giveTo = computed(() =>
  props.people.filter((person) => person.id !== props.state.assignee?.id),
);

function emailOf(person: VacationPerson): string | null {
  return person.user_id ? (props.emails[person.user_id] ?? null) : null;
}

function nameOf(person: VacationPerson): string {
  return person.id === props.me?.id ? `${person.name} (you)` : person.name;
}

defineExpose({
  /** Puts the focus on the row's tick box: after a tick has moved the row,
   * and after the row above it was removed. */
  focusTickBox: () => tickBox.value?.$el.focus(),
  /** Puts the focus on the row's first offer, after the member rejected
   * the task: "I'll take it", or "Give to…" where that isn't offered. */
  focusOffer: () => (takeButton.value ?? giveButton.value)?.$el.focus(),
  /** Scrolls to the row and puts the focus on its tick box: where a link to
   * the task lands. */
  arrive: () => {
    row.value?.$el.scrollIntoView({ block: "center" });
    tickBox.value?.$el.focus({ preventScroll: true });
  },
});
</script>

<template>
  <q-item
    ref="row"
    class="vacation-task"
    :class="{ 'vacation-task--marked': state.marked }"
  >
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
            :class="{ 'text-strike text-muted': task.done }"
            @update:model-value="emit('toggle', task.id)"
          />
          <!-- The visible sign is the same in every row, so the name adds
               the task: a page has some thirty of these buttons. -->
          <q-btn
            ref="moreButton"
            flat
            round
            :icon="mdiDotsVertical"
            :aria-label="`More: ${task.title}`"
            :aria-expanded="menuOpen"
            class="touch-target"
            @click="menuOpen = !menuOpen"
          >
            <!-- A group of real buttons, as the account menu is: list items
                 have no role that says they can be pressed. -->
            <q-menu
              v-model="menuOpen"
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
                  class="touch-target"
                  @click="startEditing"
                />
                <q-btn
                  v-if="people.length > 0 && !task.done"
                  flat
                  no-caps
                  align="left"
                  label="Give to…"
                  class="touch-target"
                  @click="giveOpen = true"
                />
                <q-btn
                  v-if="state.canTell"
                  flat
                  no-caps
                  align="left"
                  label="Tell them"
                  class="touch-target"
                  @click="emit('tell', task.id)"
                />
                <q-btn
                  flat
                  no-caps
                  align="left"
                  label="Remove"
                  class="touch-target"
                  @click="emit('remove', task.id)"
                />
              </div>
            </q-menu>
          </q-btn>
        </div>

        <!-- From here on only for an open task on a trip that has people:
             a done task is nobody's business any more. -->
        <template v-if="!task.done && people.length > 0">
          <p
            v-if="isFree && state.rejecter && task.rejection_reason"
            class="vacation-task__reason text-muted"
          >
            {{ state.rejecter.name }} said no: “{{ task.rejection_reason }}”
          </p>

          <div class="vacation-task__second">
            <!-- A free task offers itself, in place of the words "Nobody
                 yet": with one button only, keeping every task would be the
                 easy path. -->
            <template v-if="isFree">
              <q-btn
                v-if="me"
                ref="takeButton"
                flat
                label="I'll take it"
                :aria-label="`I'll take it: ${task.title}`"
                class="touch-target"
                @click="emit('give', task.id, me.id)"
              />
            </template>
            <span v-else class="vacation-task__who">
              <person-avatar :email="emailOf(state.assignee!)" :size="24" />
              <span v-if="state.mine" class="text-weight-medium">yours</span>
              <template v-else>
                <span class="vacation-task__name">{{
                  state.assignee!.name
                }}</span>
                <span v-if="!state.assignee!.user_id" class="text-muted"
                  >no account</span
                >
              </template>
            </span>

            <!-- The list of people hangs on this button where the row has
                 it, and on "More" where it doesn't (someone's task). -->
            <q-btn
              v-if="isFree"
              ref="giveButton"
              flat
              label="Give to…"
              :aria-label="`Give to…: ${task.title}`"
              :aria-expanded="giveOpen"
              class="touch-target"
              @click="giveOpen = !giveOpen"
            />
            <q-btn
              v-else-if="state.mine"
              flat
              label="Reject"
              :aria-label="`Reject: ${task.title}`"
              class="touch-target"
              @click="emit('reject', task.id)"
            />

            <q-menu
              v-model="giveOpen"
              no-parent-event
              auto-close
              :target="(giveButton ?? moreButton)?.$el"
              anchor="bottom left"
              self="top left"
              role="group"
              :aria-label="`Give to…: ${task.title}`"
            >
              <div class="column vacation-task__menu">
                <q-btn
                  v-for="person in giveTo"
                  :key="person.id"
                  flat
                  no-caps
                  align="left"
                  class="touch-target"
                  @click="emit('give', task.id, person.id)"
                >
                  <person-avatar :email="emailOf(person)" :size="24" />
                  <span class="q-ml-sm">{{ nameOf(person) }}</span>
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
          </div>

          <!-- Announced when it appears. It has no timer: it stays until it
               is closed or the member leaves the page. -->
          <div v-if="state.tellLine" role="status" class="vacation-task__tell">
            <span class="col">{{ state.tellLine }}</span>
            <q-btn
              v-if="state.canTell"
              flat
              label="Tell them"
              :aria-label="`Tell them: ${task.title}`"
              class="touch-target"
              @click="emit('tell', task.id)"
            />
            <q-btn
              flat
              round
              :icon="mdiClose"
              aria-label="Close"
              class="touch-target"
              @click="emit('closeTell', task.id)"
            />
          </div>
        </template>
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

/* Where a link landed: the theme's veil for a surface, fading out. It is
   an animation of a color only, so it also runs for a person who has
   turned motion off, for whom it marks the row just the same. */
.vacation-task--marked {
  animation: vacation-task-arrival 2s ease-out;
}

@keyframes vacation-task-arrival {
  from {
    background: var(--theme-veil-on-surface);
  }
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

/* Under the title, which starts 40px in, after the tick box. */
.vacation-task__second {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-height: 44px;
  padding-left: 40px;
}

.vacation-task__who {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vacation-task__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vacation-task__reason {
  margin: 0 8px 4px 40px;
  overflow-wrap: anywhere;
}

.vacation-task__tell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding-left: 40px;
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
