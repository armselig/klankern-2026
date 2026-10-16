<script setup lang="ts">
import { mdiDeleteOutline } from "@quasar/extras/mdi-v7";
import type { TodoItem } from "~/types/todo";

const props = defineProps<{ item: TodoItem }>();
const emit = defineEmits<{ toggle: [id: string]; remove: [id: string] }>();

const { drawing, startFromTap, endDrawing } = useTickDrawing();

/** The person's own tap: draws the tick here, where a Realtime change can't
 * reach, then lets the list toggle the item. */
function toggleFromTap(checked: boolean) {
  startFromTap(checked);
  emit("toggle", props.item.id);
}
</script>

<template>
  <q-item :data-testid="TEST_IDS.list.row">
    <q-item-section>
      <!-- The title is the checkbox's label, so screen readers announce the item, not "on". -->
      <q-checkbox
        :model-value="item.done"
        :data-testid="TEST_IDS.list.checkbox"
        :class="{
          'text-strike text-muted': item.done,
          'list-tick--drawing': drawing,
        }"
        @update:model-value="toggleFromTap"
        @animationend="endDrawing"
        ><span class="list-tick__title">{{ item.title }}</span></q-checkbox
      >
    </q-item-section>
    <q-item-section side>
      <!-- Icon only, to keep rows narrow on phones; the name comes from aria-label. -->
      <q-btn
        flat
        dense
        round
        :icon="mdiDeleteOutline"
        aria-label="Remove"
        :data-testid="TEST_IDS.list.remove"
        @click="emit('remove', item.id)"
      />
    </q-item-section>
  </q-item>
</template>
