<template>
  <div>
    <!-- Adds <link rel="manifest">; without it the browser can't install the app. -->
    <NuxtPwaManifest />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
