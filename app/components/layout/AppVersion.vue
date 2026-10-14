<script setup lang="ts">
const { appVersion } = useRuntimeConfig().public;
</script>

<template>
  <!-- The release this build was made from, so a deployed page can be
       matched to its entry in CHANGELOG.md. Smaller than the menu's
       entries: it is a fact about the app, not something to press. -->
  <p class="app-version">
    Version
    <span :data-testid="TEST_IDS.layout.appVersion">{{ appVersion }}</span>
  </p>
</template>

<style scoped>
.app-version {
  margin: 0;
  padding: 8px 16px;
  font-size: 0.8125rem;
  color: var(--theme-text-muted);
}
</style>
