<script setup lang="ts">
const props = defineProps<{ householdId: string }>()
const todoStore = useTodoStore()

onMounted(() => todoStore.init(props.householdId))

const newTitle = ref('')
const titleInput = useTemplateRef<{ focus: () => void }>('titleInput')

/** Adds the typed to-do and puts focus back in the input, so several items
 * can be entered in a row without clicking the field again. */
async function add() {
  const title = newTitle.value.trim()
  if (!title) return
  newTitle.value = ''
  titleInput.value?.focus()
  await todoStore.add(title)
}
</script>

<template>
  <div>
    <q-form class="row q-gutter-sm q-mb-md" @submit.prevent="add">
      <q-input ref="titleInput" v-model="newTitle" label="Add a to-do" class="col" autofocus />
      <q-btn type="submit" color="primary" label="Add" unelevated />
    </q-form>

    <q-spinner v-if="todoStore.loading" color="primary" />

    <q-list v-else bordered separator>
      <TodoItem
        v-for="item in todoStore.visible"
        :key="item.id"
        :item="item"
        @toggle="todoStore.toggle"
        @remove="todoStore.remove"
      />
      <q-item v-if="todoStore.visible.length === 0">
        <q-item-section class="text-grey">Nothing on the list yet.</q-item-section>
      </q-item>
    </q-list>

    <p v-if="todoStore.error" class="text-negative">{{ todoStore.error }}</p>
  </div>
</template>
