<script setup lang="ts">
import type { ListPreview, TitledEntry } from "~/types/dashboard";

defineProps<{
  preview: ListPreview<TitledEntry>;
  /** What the number counts, said after it: "open", "to buy". */
  countLabel: string;
  /** Said in place of a count of zero. */
  emptyText: string;
}>();
</script>

<template>
  <!-- Nothing to name, which for a list is the same as a count of zero. -->
  <p
    v-if="preview.shown.length === 0"
    class="text-muted q-my-none"
    :data-testid="TEST_IDS.dashboard.tileEmpty"
  >
    {{ emptyText }}
  </p>
  <template v-else>
    <p
      class="tile-list-preview__count text-muted"
      :data-testid="TEST_IDS.dashboard.tileCount"
    >
      <span class="tile-list-preview__number">{{ preview.count }}</span>
      {{ countLabel }}
    </p>
    <!-- role="list" because Safari stops announcing a list once its bullets
         are styled away. -->
    <ul role="list" class="tile-list-preview__entries">
      <li
        v-for="entry in preview.shown"
        :key="entry.id"
        class="ellipsis"
        :data-testid="TEST_IDS.dashboard.tileEntry"
      >
        {{ entry.title }}
      </li>
      <li
        v-if="preview.more > 0"
        class="text-muted"
        :data-testid="TEST_IDS.dashboard.tileEntry"
      >
        and {{ preview.more }} more
      </li>
    </ul>
  </template>
</template>

<style scoped>
.tile-list-preview__count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
}

.tile-list-preview__number {
  color: var(--theme-text);
  font-size: 2.125rem;
  font-weight: 500;
  line-height: 2.5rem;
}

.tile-list-preview__entries {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;
  line-height: 1.25rem;
}
</style>
