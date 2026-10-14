<script setup lang="ts">
import { mdiDeleteSweepOutline, mdiUndo } from "@quasar/extras/mdi-v7";
import type { WhiteboardTool } from "~/types/whiteboard";

defineProps<{ canUndo: boolean; canClear: boolean }>();
const emit = defineEmits<{ undo: []; clear: [] }>();

const tool = defineModel<WhiteboardTool>("tool", { required: true });
const color = defineModel<string>("color", { required: true });
const width = defineModel<number>("width", { required: true });
</script>

<template>
  <div
    role="toolbar"
    aria-label="Whiteboard tools"
    class="row items-center q-gutter-sm q-mb-sm"
  >
    <q-option-group
      v-model="tool"
      :options="WHITEBOARD_TOOLS"
      type="radio"
      inline
      aria-label="Tool"
      :data-testid="TEST_IDS.whiteboard.tools"
    />
    <q-option-group
      v-model="color"
      :options="PEN_COLORS"
      :disable="tool !== 'pen'"
      type="radio"
      inline
      aria-label="Pen color"
      :data-testid="TEST_IDS.whiteboard.colors"
    />
    <q-option-group
      v-model="width"
      :options="PEN_WIDTHS"
      :disable="tool !== 'pen'"
      type="radio"
      inline
      aria-label="Pen width"
      :data-testid="TEST_IDS.whiteboard.widths"
    />
    <q-btn
      flat
      :icon="mdiUndo"
      label="Undo"
      :data-testid="TEST_IDS.whiteboard.undo"
      :disable="!canUndo"
      @click="emit('undo')"
    />
    <q-btn
      flat
      :icon="mdiDeleteSweepOutline"
      label="Clear board"
      :data-testid="TEST_IDS.whiteboard.clear"
      :disable="!canClear"
      @click="emit('clear')"
    />
  </div>
</template>
