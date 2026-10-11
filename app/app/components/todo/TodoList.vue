<script setup lang="ts">
import { mdiPlus } from "@quasar/extras/mdi-v7";

const props = defineProps<{ householdId: string }>();
const todoStore = useTodoStore();

onMounted(() => todoStore.init(props.householdId));

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
</script>

<template>
  <div>
    <q-form class="row q-gutter-sm q-mb-md" @submit.prevent="add">
      <q-input
        ref="titleInput"
        v-model="newTitle"
        label="Add a to-do"
        class="col"
        autofocus
      />
      <q-btn
        type="submit"
        color="primary"
        :icon="mdiPlus"
        label="Add"
        unelevated
      />
    </q-form>

    <q-spinner v-if="todoStore.loading" color="primary" />

    <q-list v-else bordered separator>
      <todo-item
        v-for="item in todoStore.visible"
        :key="item.id"
        :item="item"
        @toggle="todoStore.toggle"
        @remove="todoStore.remove"
      />
      <q-item v-if="todoStore.visible.length === 0">
        <q-item-section class="text-muted"
          >Nothing on the list yet.</q-item-section
        >
      </q-item>
    </q-list>

    <p v-if="todoStore.error" class="text-negative">{{ todoStore.error }}</p>
  </div>
</template>
