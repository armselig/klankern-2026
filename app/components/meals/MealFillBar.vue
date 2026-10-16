<script setup lang="ts">
/**
 * "Fill my week" above the week's days, and once it has proposed dinners,
 * what to do with them: plan them, propose the ones not kept anew, or drop
 * them, with a line that says how many recipes they were chosen from. It
 * stands in the day list's row of actions, beside the shopping run's
 * button, and has no box of its own. It only renders and reports;
 * useWeekFill holds the proposal.
 */
defineProps<{
  /** There is a proposal on the days. */
  drafting: boolean;
  canFill: boolean;
  /** How many dinners the proposal holds. */
  draftCount: number;
  choiceLine: { text: string; dismissible: boolean };
  /** At least one proposed dinner is not kept. */
  canRerollRest: boolean;
  saving: boolean;
}>();
const emit = defineEmits<{
  fill: [];
  save: [];
  rerollRest: [];
  cancel: [];
  dismissNote: [];
}>();
</script>

<template>
  <div class="meal-fill">
    <template v-if="drafting">
      <p
        class="meal-fill__line q-my-none"
        :data-testid="TEST_IDS.meals.fill.choiceLine"
      >
        {{ choiceLine.text }}
        <!-- No color on the flat button: see hover-contrast.css. -->
        <q-btn
          v-if="choiceLine.dismissible"
          flat
          dense
          no-caps
          label="Got it"
          class="touch-target"
          :data-testid="TEST_IDS.meals.fill.dismissNote"
          @click="emit('dismissNote')"
        />
      </p>
      <div class="meal-fill__actions">
        <q-btn
          unelevated
          no-caps
          color="primary"
          :label="`Plan these ${draftCount}`"
          :loading="saving"
          class="touch-target"
          :data-testid="TEST_IDS.meals.fill.save"
          @click="emit('save')"
        />
        <q-btn
          flat
          no-caps
          label="Re-roll the rest"
          :disable="!canRerollRest || saving"
          class="touch-target"
          :data-testid="TEST_IDS.meals.fill.rerollRest"
          @click="emit('rerollRest')"
        />
        <q-btn
          flat
          no-caps
          label="Cancel"
          :disable="saving"
          class="touch-target"
          :data-testid="TEST_IDS.meals.fill.cancel"
          @click="emit('cancel')"
        />
      </div>
    </template>
    <q-btn
      v-else-if="canFill"
      unelevated
      no-caps
      color="primary"
      label="Fill my week"
      class="touch-target"
      :data-testid="TEST_IDS.meals.fill.start"
      @click="emit('fill')"
    />
  </div>
</template>

<style scoped>
/* Its parts are items of the row of actions it stands in. */
.meal-fill {
  display: contents;
}

/* A proposal takes the row: its line, then its buttons on a line. */
.meal-fill__line,
.meal-fill__actions {
  flex: 1 0 100%;
}

.meal-fill__line {
  font-size: 0.875rem;
}

.meal-fill__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}
</style>
