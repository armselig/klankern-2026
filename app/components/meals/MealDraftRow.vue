<script setup lang="ts">
import {
  mdiLock,
  mdiLockOpenVariantOutline,
  mdiShuffleVariant,
} from "@quasar/extras/mdi-v7";

/**
 * A dinner "Fill my week" proposes for a day, in the place of the day's
 * "Add dinner" until it is planned: its name, a lock that keeps it when the
 * rest is proposed anew, and a button for another one. The dashed edge says
 * it is not planned yet, as an open dinner's does; the lock says whether it
 * is kept, so there is no word for either. It only renders and
 * reports; the week holds the proposal.
 */
defineProps<{
  name: string;
  dayLabel: string;
  locked: boolean;
  /** There is another recipe to propose. */
  canReroll: boolean;
}>();
const emit = defineEmits<{ toggleLock: []; reroll: [] }>();
</script>

<template>
  <li class="meal-draft" :data-testid="TEST_IDS.meals.draft.row">
    <!-- Read out when a re-roll changes it. -->
    <span class="meal-draft__name" aria-live="polite">
      <transition name="meal-draft-shuffle" mode="out-in">
        <span :key="name" :data-testid="TEST_IDS.meals.draft.name">{{
          name
        }}</span>
      </transition>
    </span>
    <q-btn
      flat
      round
      :icon="locked ? mdiLock : mdiLockOpenVariantOutline"
      :aria-label="`Keep the dinner for ${dayLabel}`"
      :aria-pressed="locked"
      class="touch-target"
      :data-testid="TEST_IDS.meals.draft.lock"
      @click="emit('toggleLock')"
    />
    <q-btn
      flat
      round
      :icon="mdiShuffleVariant"
      :aria-label="`Another dinner for ${dayLabel}`"
      :disable="locked || !canReroll"
      class="touch-target"
      :data-testid="TEST_IDS.meals.draft.reroll"
      @click="emit('reroll')"
    />
  </li>
</template>

<style scoped>
.meal-draft {
  display: flex;
  align-items: center;
  padding-left: 12px;
  border: 1px dashed var(--theme-outline);
  border-radius: 4px;
}

.meal-draft__name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

/* A short shuffle when another dinner is proposed; none for a member who
   asked for less motion. */
@media (prefers-reduced-motion: no-preference) {
  .meal-draft-shuffle-enter-active,
  .meal-draft-shuffle-leave-active {
    transition:
      opacity 120ms ease,
      transform 120ms ease;
  }

  .meal-draft-shuffle-enter-from {
    opacity: 0;
    transform: translateY(-6px);
  }

  .meal-draft-shuffle-leave-to {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>
