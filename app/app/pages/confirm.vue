<script setup lang="ts">
// Callback route for @nuxtjs/supabase's redirect-based flows (password
// recovery, OAuth -- not used by our primary email-OTP login, but the
// module requires a configured callback route to exist regardless). By the
// time this page renders, the module has already exchanged the URL for a
// session; just move on to the dashboard.
const router = useRouter()
onMounted(() => router.replace('/'))
</script>

<template>
  <q-page class="flex flex-center">
    <q-spinner color="primary" size="2em" />
  </q-page>
</template>
