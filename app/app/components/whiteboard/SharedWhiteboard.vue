<script setup lang="ts">
import { Dialog } from "quasar";
import type { WhiteboardTool } from "~/types/whiteboard";

const props = defineProps<{ householdId: string }>();
const whiteboardStore = useWhiteboardStore();

onMounted(() => whiteboardStore.init(props.householdId));

const tool = ref<WhiteboardTool>("pen");
const color = ref(DEFAULT_PEN_COLOR);
const width = ref(DEFAULT_PEN_WIDTH);

/** Clearing removes every member's strokes and can't be undone, so it asks first. */
function confirmClear() {
  Dialog.create({
    title: "Clear the whiteboard?",
    message: "This removes everything on it, for the whole family.",
    // No color, said outright: the dialog would give "Cancel" its own
    // (primary, or amber in dark mode), and a highlight leaves colored text
    // on a surface below 4.5:1. Without one it is a plain flat button in
    // the text's color, with the theme's highlight for those
    // (assets/css/hover-contrast.css).
    cancel: { label: "Cancel", flat: true, color: undefined },
    ok: { label: "Clear", color: "negative", unelevated: true },
  }).onOk(() => whiteboardStore.clear());
}
</script>

<template>
  <div>
    <q-spinner v-if="whiteboardStore.loading" color="primary" />

    <!-- Only once the board is loaded: a stroke needs the board's id. -->
    <template v-else-if="whiteboardStore.boardId">
      <whiteboard-toolbar
        v-model:tool="tool"
        v-model:color="color"
        v-model:width="width"
        :can-undo="whiteboardStore.undoableId !== null"
        :can-clear="whiteboardStore.visible.length > 0"
        @undo="whiteboardStore.undo"
        @clear="confirmClear"
      />
      <whiteboard-surface
        :strokes="whiteboardStore.visible"
        :tool="tool"
        :color="color"
        :width="width"
        @draw="whiteboardStore.draw"
        @erase="whiteboardStore.remove"
      />
    </template>

    <p v-if="whiteboardStore.error" class="text-negative">
      {{ whiteboardStore.error }}
    </p>
  </div>
</template>
