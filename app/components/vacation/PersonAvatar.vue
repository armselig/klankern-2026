<script setup lang="ts">
import { mdiAccount } from "@quasar/extras/mdi-v7";

/**
 * The picture of a person on a trip: a member's avatar, or one generic icon
 * for a person without an email address, the same for every such person.
 * Always decoration: wherever it stands, the name stands beside it.
 */
defineProps<{
  /** The member's email address, or null for a person without an account. */
  email: string | null;
  /** Width and height in CSS pixels. */
  size: number;
}>();
</script>

<template>
  <user-avatar v-if="email" :email="email" :size="size" />
  <q-avatar
    v-else
    :size="`${size}px`"
    class="person-avatar--generic"
    aria-hidden="true"
  >
    <q-icon :name="mdiAccount" :size="`${Math.round(size * 0.75)}px`" />
  </q-avatar>
</template>

<style scoped>
.person-avatar--generic {
  background: var(--theme-placeholder);
  color: var(--theme-text);
}
</style>
