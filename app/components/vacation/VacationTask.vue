<script setup lang="ts">
import { mdiDotsVertical } from "@quasar/extras/mdi-v7";
import type { VacationTask } from "~/types/vacation";

const props = defineProps<{ task: VacationTask }>();
const emit = defineEmits<{
  toggle: [id: string];
  rename: [id: string, title: string];
  remove: [id: string];
}>();

interface HasElement {
  $el: HTMLElement;
}
const tickBox = useTemplateRef<HasElement>("tickBox");
const moreButton = useTemplateRef<HasElement>("moreButton");

/**
 * Whether the row's menu is open. The menu is opened here and not by
 * Quasar's own listener on the button: that one also opens it when Enter
 * is released on the button, which is what happens when Enter saves the
 * title and the focus has just moved back to the button.
 */
const menuOpen = ref(false);

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

defineExpose({
  /** Puts the focus on the row's tick box: after a tick has moved the row,
   * and after the row above it was removed. */
  focusTickBox: () => tickBox.value?.$el.focus(),
});
</script>

<template>
  <q-item class="vacation-task">
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

      <div v-else class="vacation-task__line">
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
        <!-- The visible sign is the same in every row, so the name adds the
             task: a page has some thirty of these buttons. -->
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
