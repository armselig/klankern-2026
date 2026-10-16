<script setup lang="ts">
import { mdiAccount } from "@quasar/extras/mdi-v7";
import type { VacationPerson } from "~/types/vacation";

/**
 * The picture of a person on a trip: a member's avatar, or for a person
 * without an account the first two letters of the name on a disc in an ink
 * of their own (see personBadge). Always decoration: wherever it stands, the
 * name stands beside it or names the control it is in.
 */
const props = defineProps<{
  /** The member's email address, or null for a person without an account. */
  email: string | null;
  /** Width and height in CSS pixels. */
  size: number;
  /** The person on the trip. Left out for a household member who is not on
   * it: they have an account, and one generic icon until their address is
   * known. */
  person?: Pick<VacationPerson, "id" | "name" | "user_id"> &
    Partial<Pick<VacationPerson, "child_id">>;
}>();

/** Only for a person without an account: a member whose address is still
 * on its way would otherwise show a letter first and the avatar after. A
 * child's ink follows the child, not the person on the trip, so the child
 * looks the same on every trip and on the kids' page. */
const badge = computed(() =>
  props.person && !props.person.user_id
    ? personBadge({
        id: props.person.child_id ?? props.person.id,
        name: props.person.name,
      })
    : null,
);
</script>

<template>
  <user-avatar v-if="email" :email="email" :size="size" />
  <q-avatar
    v-else-if="badge"
    :size="`${size}px`"
    class="person-avatar--badge"
    :style="{ '--person-ink': inkPaint(badge.color) }"
    aria-hidden="true"
  >
    <span class="person-avatar__letters">{{ badge.letters }}</span>
  </q-avatar>
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

/* The letters are in the text color on a disc tinted with the ink, and the
   ink itself is the ring: text in an ink, or on one, is below 4.5:1 for
   most of the eight. At a fifth of the ink the text is above 4.5:1 on
   every one of them in both modes (calculated up to a quarter: 4.6:1). */
.person-avatar--badge {
  flex-shrink: 0;
  background: var(--theme-surface);
  color: var(--theme-text);
  box-shadow: inset 0 0 0 1.5px var(--person-ink);
}

.person-avatar--badge::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--person-ink);
  opacity: 0.2;
}

/* Quasar sizes an avatar's content at half its width, which is what two
   letters need to stay inside the ring. */
.person-avatar__letters {
  position: relative;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.02em;
  /* As written, "Mi": a task's row is a button, and Quasar sets a button's
     text in upper case. */
  text-transform: none;
}
</style>
