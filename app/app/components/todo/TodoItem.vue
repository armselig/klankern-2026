<script setup lang="ts">
import type { TodoItem } from '~/types/todo'

defineProps<{ item: TodoItem }>()
const emit = defineEmits<{ toggle: [id: string]; remove: [id: string] }>()
</script>

<template>
  <q-item>
    <q-item-section side top>
      <q-checkbox :model-value="item.done" @update:model-value="emit('toggle', item.id)" />
    </q-item-section>
    <q-item-section :class="{ 'text-strike text-grey': item.done }">
      {{ item.title }}
    </q-item-section>
    <q-item-section side>
      <q-btn flat dense label="Remove" @click="emit('remove', item.id)" />
    </q-item-section>
  </q-item>
</template>
