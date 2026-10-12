<script setup lang="ts">
const APP_NAME = "Klankern";

// Every page needs a <title> (WCAG 2.4.2): pages name themselves with
// useHead({ title }), the dashboard is just the app name.
useHead({
  titleTemplate: (title) => (title ? `${title} · ${APP_NAME}` : APP_NAME),
});
</script>

<template>
  <div>
    <!-- Adds <link rel="manifest">; without it the browser can't install the app. -->
    <nuxt-pwa-manifest />
    <nuxt-route-announcer />
    <nuxt-layout>
      <nuxt-page />
    </nuxt-layout>
  </div>
</template>
