<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";

const props = defineProps<{ householdId: string }>();
const todoStore = useTodoStore();

onMounted(() => todoStore.load(props.householdId));

const newTitle = ref("");
const titleInput = useTemplateRef<{ focus: () => void }>("titleInput");

/** Adds the typed to-do and puts focus back in the input, so several items
 * can be entered in a row without clicking the field again. */
async function add() {
  const title = newTitle.value.trim();
  if (!title) return;
  newTitle.value = "";
  titleInput.value?.focus();
  await todoStore.add(title);
}

const { burst, playFrom: celebrateFrom } = useCelebration("todos");

/**
 * The person's own tap on an item's box. When it ticks off the last open
 * item, a burst plays from the box, at most once a minute; the check looks
 * at the list before the tick, which the store makes at once. A tick that
 * arrives by Realtime comes through the store only and never plays one.
 */
function toggleFromTap(id: string, box: DOMRect) {
  if (ticksLastOpen(todoStore.open, id)) celebrateFrom(box);
  void todoStore.toggle(id);
}
</script>

<template>
  <div>
    <q-form class="row q-gutter-sm q-mb-md" @submit.prevent="add">
      <q-input
        ref="titleInput"
        v-model="newTitle"
        label="Add a to-do"
        :data-testid="TEST_IDS.todos.titleInput"
        class="col"
        autofocus
      />
      <q-btn
        type="submit"
        color="primary"
        :icon="mdiPlus"
        label="Add"
        :data-testid="TEST_IDS.todos.addButton"
        unelevated
      />
    </q-form>

    <q-spinner v-if="todoStore.loading" color="primary" />

    <q-list
      v-else
      bordered
      separator
      class="list-rows"
      :data-testid="TEST_IDS.list.items"
    >
      <!-- No tag: the rows stay the list's own children, for its separators
           and its role. The motion is in assets/css/motion.css. -->
      <transition-group name="list-row" @before-leave="makeLeavingRowInert">
        <todo-item
          v-for="item in todoStore.visible"
          :key="item.id"
          :item="item"
          @toggle="toggleFromTap"
          @remove="todoStore.remove"
        />
      </transition-group>
      <q-item v-if="todoStore.visible.length === 0">
        <q-item-section>
          <empty-state feature="todos">
            <span class="text-muted" :data-testid="TEST_IDS.list.empty"
              >Nothing on the list yet.</span
            >
          </empty-state>
        </q-item-section>
      </q-item>
    </q-list>

    <celebration-burst
      v-if="burst"
      :key="burst.id"
      :origin="burst"
      feature="todos"
    />

    <p
      v-if="todoStore.error"
      class="text-negative"
      :data-testid="TEST_IDS.errorMessage"
    >
      {{ todoStore.error }}
    </p>
  </div>
</template>
