<script setup lang="ts">
import { mdiInformationOutline } from "@quasar/extras/mdi-v7";
import type { QBtn } from "quasar";

const menuOpen = ref(false);
const trigger = useTemplateRef<QBtn>("trigger");
</script>

<template>
  <!-- For whoever is not signed in: the account menu, which holds the
       version for members, does not exist for them, and the version has to
       be readable on the login and join pages too. -->
  <q-btn
    ref="trigger"
    flat
    round
    class="header-control"
    :icon="mdiInformationOutline"
    aria-label="About"
    :aria-expanded="menuOpen"
    :data-testid="TEST_IDS.layout.versionButton"
  >
    <q-tooltip v-if="!menuOpen">About</q-tooltip>
    <!-- A group, not role="menu": the version is no menu item. -->
    <q-menu
      v-model="menuOpen"
      anchor="bottom right"
      self="top right"
      :offset="[0, 4]"
      role="group"
      aria-label="About"
      :data-testid="TEST_IDS.layout.versionMenu"
    >
      <app-version />
    </q-menu>
  </q-btn>
</template>

<style scoped>
/* Quasar's round button is 42px; 44px is the smallest comfortable target
   for a thumb. */
.header-control {
  min-width: 44px;
  min-height: 44px;
}
</style>
