<script setup lang="ts">
import type { TodoItem } from '~/types/todo'

defineProps<{ item: TodoItem }>()
const emit = defineEmits<{ toggle: [id: string]; remove: [id: string] }>()
</script>

<template>
  <q-item>
    <q-item-section>
      <!-- The title is the checkbox's label, so screen readers announce the item, not "on". -->
      <q-checkbox
        :model-value="item.done"
        :label="item.title"
        :class="{ 'text-strike text-grey-8': item.done }"
        @update:model-value="emit('toggle', item.id)"
      />
    </q-item-section>
    <q-item-section side>
      <q-btn flat dense label="Remove" @click="emit('remove', item.id)" />
    </q-item-section>
  </q-item>
</template>
