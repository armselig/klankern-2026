<script setup lang="ts">
import type { ShoppingItem } from '~/types/shopping'

const props = defineProps<{ item: ShoppingItem }>()
const emit = defineEmits<{ toggle: [id: string]; remove: [id: string] }>()

/** The quantity is part of the checkbox label, so screen readers announce it with the item. */
const label = computed(() =>
  props.item.quantity ? `${props.item.title} (${props.item.quantity})` : props.item.title,
)
</script>

<template>
  <q-item>
    <q-item-section>
      <q-checkbox
        :model-value="item.checked"
        :label="label"
        :class="{ 'text-strike text-grey': item.checked }"
        @update:model-value="emit('toggle', item.id)"
      />
    </q-item-section>
    <q-item-section side>
      <q-btn flat dense label="Remove" @click="emit('remove', item.id)" />
    </q-item-section>
  </q-item>
</template>
