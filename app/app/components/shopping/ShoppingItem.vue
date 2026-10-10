<script setup lang="ts">
import { mdiDeleteOutline } from '@quasar/extras/mdi-v7'
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
        :class="{ 'text-strike text-grey-8': item.checked }"
        @update:model-value="emit('toggle', item.id)"
      />
    </q-item-section>
    <q-item-section side>
      <!-- Icon only, to keep rows narrow on phones; the name comes from aria-label. -->
      <q-btn
        flat
        dense
        round
        :icon="mdiDeleteOutline"
        aria-label="Remove"
        @click="emit('remove', item.id)"
      />
    </q-item-section>
  </q-item>
</template>
