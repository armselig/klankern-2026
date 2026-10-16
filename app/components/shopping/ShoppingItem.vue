<script setup lang="ts">
import { mdiDeleteOutline } from "@quasar/extras/mdi-v7";
import type { ShoppingItem } from "~/types/shopping";

const props = defineProps<{ item: ShoppingItem }>();
const emit = defineEmits<{
  /** With the tick box's place, for a celebration to start from. */
  toggle: [id: string, box: DOMRect];
  remove: [id: string];
}>();

/** The quantity is part of the checkbox label, so screen readers announce it with the item. */
const label = computed(() =>
  props.item.quantity
    ? `${props.item.title} (${props.item.quantity})`
    : props.item.title,
);

const { drawing, startFromTap, endDrawing } = useTickDrawing();
const checkbox = useTemplateRef<{ $el: HTMLElement }>("checkbox");

/** The person's own tap: draws the tick here, where a Realtime change can't
 * reach, then lets the list toggle the item, telling it where the box is. */
function toggleFromTap(checked: boolean) {
  startFromTap(checked);
  emit("toggle", props.item.id, tickBoxRect(checkbox.value?.$el));
}
</script>

<template>
  <q-item :data-testid="TEST_IDS.list.row">
    <q-item-section>
      <q-checkbox
        ref="checkbox"
        :model-value="item.checked"
        :data-testid="TEST_IDS.list.checkbox"
        :class="{
          'text-strike text-muted': item.checked,
          'list-tick--drawing': drawing,
        }"
        @update:model-value="toggleFromTap"
        @animationend="endDrawing"
        ><span class="list-tick__title">{{ label }}</span></q-checkbox
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
