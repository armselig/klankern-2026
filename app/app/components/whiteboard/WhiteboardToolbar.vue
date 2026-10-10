<script setup lang="ts">
import { mdiDeleteSweepOutline, mdiUndo } from '@quasar/extras/mdi-v7'
import type { WhiteboardTool } from '~/types/whiteboard'
import type { PenOption } from '~/utils/whiteboard-pen'

defineProps<{ canUndo: boolean; canClear: boolean }>()
const emit = defineEmits<{ undo: []; clear: [] }>()

const tool = defineModel<WhiteboardTool>('tool', { required: true })
const color = defineModel<string>('color', { required: true })
const width = defineModel<number>('width', { required: true })

const TOOLS: PenOption<WhiteboardTool>[] = [
  { label: 'Pen', value: 'pen' },
  { label: 'Eraser', value: 'eraser' },
]
</script>

<template>
  <div role="toolbar" aria-label="Whiteboard tools" class="row items-center q-gutter-sm q-mb-sm">
    <q-option-group v-model="tool" :options="TOOLS" type="radio" inline aria-label="Tool" />
    <q-option-group
      v-model="color"
      :options="PEN_COLORS"
      :disable="tool !== 'pen'"
      type="radio"
      inline
      aria-label="Pen color"
    />
    <q-option-group
      v-model="width"
      :options="PEN_WIDTHS"
      :disable="tool !== 'pen'"
      type="radio"
      inline
      aria-label="Pen width"
    />
    <q-btn flat :icon="mdiUndo" label="Undo" :disable="!canUndo" @click="emit('undo')" />
    <q-btn
      flat
      :icon="mdiDeleteSweepOutline"
      label="Clear board"
      :disable="!canClear"
      @click="emit('clear')"
    />
  </div>
</template>
