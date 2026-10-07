<script setup lang="ts">
const user = useSupabaseUser()
const client = useSupabaseClient()
const router = useRouter()

/** Signs the user out and returns them to the login screen. */
async function signOut() {
  await client.auth.signOut()
  await router.push('/login')
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title>Klankern</q-toolbar-title>
        <q-btn v-if="user" flat label="Sign out" @click="signOut" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <slot />
    </q-page-container>
  </q-layout>
</template>
